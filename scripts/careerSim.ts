// Full-career integration sim — drives the REAL zustand store (not isolated
// engine functions) through complete seasons, exactly mirroring the decisions
// Career.tsx makes. This is the harness the Phase 25 audit demanded: the
// season-loop bug it found was invisible to engine-level unit sims and only
// existed at store integration level.
//
// Run: npx tsx scripts/careerSim.ts [seasons] [seed]
import 'fake-indexeddb/auto'
import { reseed, rand } from '../src/engine/rng'
import { useCareerStore } from '../src/store/careerStore'
import { nextUnresolvedEvent, activeCompetitionForWeek, SEASON_WEEKS } from '../src/engine/calendar'
import { playerCupFixture, type CupWorld } from '../src/engine/cup'
import { playerOctoberFixture, octoberStandings } from '../src/engine/octoberLeague'
import { matchAvailability } from '../src/engine/selection'
import { hasSundayContract } from '../src/engine/sundayContracts'
import { nationFixture, internationalTeamById } from '../src/engine/international'
import { generateTeam } from '../src/engine/teams'
import { pickRelationshipEvent } from '../src/engine/relationshipEvents'
import { pickLifeEvent, buildLifeContext } from '../src/engine/lifeEvents'
import { monthlyAllowance } from '../src/engine/economy'
import { isLive } from '../src/engine/negotiation'
import { netWage } from '../src/engine/agents'
import { academyRecruitmentReport, academyTrialAvailable, academyOfferCleared, academyRegistrationOpen } from '../src/engine/academyRecruitment'
import { regionsFor } from '../src/engine/regions'
import { NATIONS } from '../src/engine/nations'
import type { Position } from '../src/types/attributes'
import { computeCurrentAbility, toOvr } from '../src/engine/rating'
import { generateSession, drillToDecision, recordDrillResult, gradeSession, applyTrainingGrowth, miniGameForDrill } from '../src/engine/training'
import { gradeFromRatio, trainingXpForDrill, matchXpEarned, type CompetitionTier } from '../src/engine/xp'
import { SESSION_ATTRIBUTES } from '../src/types/training'
import { intensitySpec, trainingInjuryChance } from '../src/engine/energy'
import { rollInjury } from '../src/engine/injuries'
import { ARCHETYPES, archetypeAttributeDeltas } from '../src/engine/archetypes'
import { initMatch, advanceToKeyMoment, resolveInjuryDecision, resolvePlayerMoment, resolveScenarioBeat } from '../src/engine/match'
import { momentToDecision, inferStatTag } from '../src/engine/matchDecisions'
import { autoResolveGrade, adjustChance } from '../src/engine/execution'
import { archetypeMomentBonus } from '../src/engine/archetypes'
import type { PlayerMatchStats } from '../src/engine/matchStats'
import type { Player } from '../src/types/player'
import type { CalendarState } from '../src/types/calendar'

const SEASONS = Number(process.argv[2] ?? 2)
const SEED = Number(process.argv[3] ?? 42)
reseed(SEED)

let failures = 0
function assert(cond: boolean, msg: string) {
  if (!cond) { failures++; console.error('  ✗ FAIL:', msg) }
}

function makePlayer(): Player {
  const values: Record<string, number> = {}
  const requestedPosition = process.env.SIM_POSITION ?? (process.env.FORCE_GK === '1' ? 'GK' : 'ST')
  const position: Position = (['GK', 'CB', 'FB', 'CM', 'WM', 'WG', 'ST'] as const).includes(requestedPosition as Position) ? requestedPosition as Position : 'ST'
  const nationality = NATIONS.some(n => n.id === process.env.SIM_NATION) ? process.env.SIM_NATION! : 'eng'
  const isKeeper = position === 'GK'
  const realistic = process.env.SIM_REAL_START === '1'
  const potential = realistic ? Math.round(8 + rand() * 8) : 18
  const archetype = realistic ? ARCHETYPES[Math.floor(rand() * ARCHETYPES.length)] : null
  for (const k of isKeeper
    ? ['reflexes', 'handling', 'gkPositioning', 'distribution', 'pace', 'strength', 'stamina', 'agility', 'vision', 'composure', 'positioning', 'concentration']
    : ['passing', 'shooting', 'dribbling', 'tackling', 'pace', 'strength', 'stamina', 'agility', 'vision', 'composure', 'positioning', 'concentration']) values[k] = realistic ? Math.round(1 + rand() * 3) : Number(process.env.SIM_START_ATTR ?? 11)
  if (isKeeper && !realistic) for (const k of Object.keys(values)) values[k] = Number(process.env.SIM_START_ATTR ?? 11)
  if (realistic && archetype) for (const [attr, delta] of Object.entries(archetypeAttributeDeltas(archetype, position))) {
    if (attr in values) values[attr] = Math.max(1, Math.min(potential - 1, values[attr] + delta))
  }
  return {
    id: crypto.randomUUID(),
    name: 'Sim Player', surname: 'Player', position, nationality, regionId: regionsFor(nationality)[0]?.id, preferredFoot: 'right', heightCm: 178, potential, archetype: archetype?.id,
    attributes: { kind: isKeeper ? 'goalkeeper' : 'outfield', values } as Player['attributes'],
    confidence: { value: 0, baseline: 0 },
    fitness: { stamina: 100 },
    careerClock: { ageYears: 14, phase: 'grassroots-trials', grassrootsSeason: 1 },
    schoolId: 'greenwood', youthRoute: process.env.FORCE_SUNDAY === '1' ? 'grassroots' : 'school', grassrootsPath: process.env.FORCE_SUNDAY === '1' ? 'sunday' : 'school', trialWeekCompleted: 0, squadRole: null, trainingMomentum: 0,
    matchRatings: [], seasonGoals: 0, seasonAssists: 0, injury: null, recentInjuryCount: 0,
    matchesSinceReturn: 3, coachTrust: 0, reputation: 5, scoutWatchers: [], contractOffers: [],
    totalWeeksElapsed: 0, academyClubName: null, turnedPro: null,
  } as unknown as Player
}

function initialCalendar(): CalendarState {
  return {
    currentWeek: { weekNumber: 1, seasonYear: 1, events: [{ id: crypto.randomUUID(), day: 'mon', type: 'school', title: 'first day', resolved: false }] },
    history: [],
  }
}

// Fake a played match: scores + a plausible rating. Mirrors what MatchScreen
// would output, without running the full interactive engine.
function fakeMatch(player: Player): { rating: number; goals: number; assists: number; ps: number; os: number; stats: ReturnType<typeof fakeStats> } {
  const position = player.position
  const realistic = process.env.SIM_ATTR_MATCH === '1'
  const ability = computeCurrentAbility(player)
  const fatigue = Math.max(0, (65 - player.fitness.stamina) / 100)
  const performance = realistic ? Math.max(.35, Math.min(1.35, .55 + ability / 20 - fatigue)) : 1
  const goalRate: Record<Position, number> = { GK: 0, CB: .045, FB: .07, CM: .12, WM: .16, WG: .24, ST: .34 }
  const assistRate: Record<Position, number> = { GK: .025, CB: .07, FB: .14, CM: .23, WM: .28, WG: .27, ST: .23 }
  const goals = rand() < goalRate[position] * performance ? 1 : position === 'ST' && rand() < .05 * performance ? 2 : 0
  const assists = rand() < assistRate[position] * performance ? 1 : 0
  const ps = goals + (rand() < .62 ? 1 : 0) + (rand() < .2 ? 1 : 0)
  const os = rand() < 0.4 ? 0 : rand() < 0.7 ? 1 : 2
  const stats = fakeStats(position)
  const defensive = position === 'GK' ? (stats.save >= 4 ? .3 : .1) + (os === 0 ? .45 : 0)
    : position === 'CB' || position === 'FB' ? (stats.tackle + stats.interception >= 3 ? .27 : .1) + (os === 0 ? .18 : 0)
      : position === 'CM' || position === 'WM' ? (stats.keyPass >= 2 ? .22 : .08) : position === 'WG' ? (stats.keyPass ? .13 : 0) : 0
  const quality = Number(process.env.SIM_QUALITY ?? 1)
  const rating = Math.max(4, Math.min(10, 6.15 + (quality - 1) * 1.7 + (realistic ? (ability - 10) * .11 - fatigue * 1.3 : 0) + defensive + goals * .75 + assists * .4 + (rand() - .28)))
  return { rating: Math.round(rating * 10) / 10, goals, assists, ps, os, stats }
}

function fakeStats(position: Player['position']) {
  return {
    tackle: position === 'CB' || position === 'FB' ? 1 + Math.floor(rand() * 3) : position === 'CM' ? Math.floor(rand() * 2) : 0,
    interception: position === 'CB' || position === 'FB' ? 1 + Math.floor(rand() * 3) : 0,
    header: position === 'CB' ? Math.floor(rand() * 3) : 0,
    keyPass: position === 'CM' || position === 'WM' || position === 'WG' ? Math.floor(rand() * 4) : 0,
    save: position === 'GK' ? 2 + Math.floor(rand() * 5) : 0,
  }
}

function realMatch(player: Player): ReturnType<typeof fakeMatch> & { playerStats: PlayerMatchStats; momentStats: ReturnType<typeof fakeStats> } {
  let match = initMatch(player, generateTeam(5), generateTeam(5), rand() < .5)
  let moments = 0
  const momentStats = { tackle: 0, interception: 0, header: 0, keyPass: 0, save: 0 }
  while (!match.finished && moments < 90) {
    const next = advanceToKeyMoment(match, player)
    match = next.state
    const moment = next.keyMoment
    if (!moment) continue
    moments++
    if (moment.isInjuryDecision) { match = resolveInjuryDecision(match, false, player); continue }
    const bundle = momentToDecision(player, moment, `${match.minute}'`)
    const idx = bundle.decision.options.reduce((best, opt, i, all) => opt.successChance > all[best].successChance ? i : best, 0)
    const option = bundle.decision.options[idx]
    const grade = autoResolveGrade(player, match.matchStamina)
    const bestChance = Math.max(...bundle.decision.options.map(o => o.successChance))
    const decisionQuality = bestChance > 0 ? option.successChance / bestChance : .5
    const rewardQuality = bundle.maxReward > 0 ? bundle.rewards[idx] / bundle.maxReward : .5
    const archBonus = archetypeMomentBonus(player.archetype, !moment.isDefensive, moment.isDefensive, option.successChance < .5)
    const success = rand() < Math.min(.97, adjustChance(option.successChance, grade) + archBonus)
    match = moment.scenarioId
      ? resolveScenarioBeat(match, moment, idx, rewardQuality, success, decisionQuality, 1, grade)
      : resolvePlayerMoment(match, moment, rewardQuality, success, decisionQuality, 1, player.position === 'GK', grade)
    const tag = moment.isRoutine ? null : inferStatTag(option.label, moment.isDefensive, moment.isDistribution, player.position === 'GK', success)
    if (tag) momentStats[tag]++
  }
  if (!match.finished) throw new Error(`match did not finish after ${moments} moments`)
  const stats = match.playerStats
  return {
    rating: Math.round(match.playerRating * 10) / 10, goals: match.playerGoals, assists: match.playerAssists,
    ps: match.playerIsHome ? match.homeScore : match.awayScore,
    os: match.playerIsHome ? match.awayScore : match.homeScore,
    stats: momentStats,
    playerStats: stats, momentStats,
  }
}

async function main() {
  const s = () => useCareerStore.getState()
  await s().startNewCareer(makePlayer(), initialCalendar(), 0)
  s().resolveCurrentEvent() // trial-week school event
  s().completeTrials('starting-xi', 0.7)
  s().ensureLeagueWorld()
  const forceSunday = process.env.FORCE_SUNDAY === '1'
  if (forceSunday) {
    const offer = s().player?.contractOffers.find(o => o.kind === 'club')
    assert(!!offer, 'grassroots starter receives a season club contract')
    if (offer) s().respondToOffer(offer.id, true)
    assert(!!s().player?.sundayContract, 'grassroots route signs its first club contract')
  }

  // Optional forced paths so the harness exercises code organic careers
  // reach slowly: FORCE_INTL=1 boosts reputation past the call-up bar after
  // week 5; FORCE_ACADEMY=1 injects+accepts an academy offer at season 2.
  const forceIntl = process.env.FORCE_INTL === '1'
  const forceAcademy = process.env.FORCE_ACADEMY === '1'
  const autoAcademy = process.env.AUTO_ACADEMY === '1'
  const autoPro = process.env.AUTO_PRO === '1'
  const lateProProbe = process.env.LATE_PRO_PROBE === '1'
  const lateProStall = process.env.LATE_PRO_STALL === '1'
  let lateProOfferInjected = false
  const forceTransfer = process.env.FORCE_TRANSFER === '1'
  let transferForced = false
  let intlForced = false
  let academyForced = false
  let negotiationStartWeek = -1
  let negotiationChoices = 0

  const tallies: Record<string, number> = {}
  let deadMatchdays = 0
  let intlMatches = 0
  let weeksTicked = 0
  let octoberWindows = 0
  let unavailableMatchdays = 0
  const seasonRoutes: ('school' | 'sunday' | 'academy')[] = []
  const seasonSnapshots: { season: number; route: string; appearances: number; goals: number; assists: number; reputation: number }[] = []
  let academyEntry: { season: number; week: number; age: number; club: string | null } | null = null
  const recruitmentReviews: { season: number; age: number; average: number; recent: number; ready: boolean; watchers: number; highestInterest: number; offers: number; trial: string; reasons: string[] }[] = []
  let firstProOfferWeek: number | null = null
  let maxAcademyInterest = 0
  const trainingFrequency = process.env.SIM_TRAINING === '1' ? Math.max(1, Number(process.env.SIM_TRAIN_EVERY ?? 1)) : 0
  const simulateTraining = trainingFrequency > 0
  const simulateMatchXp = process.env.SIM_MATCH_XP === '1'
  const actualMatches = process.env.SIM_REAL_MATCH === '1'
  const xpStrategy = process.env.SIM_XP_STRATEGY ?? 'balanced'
  const priorities: Record<Position, string[]> = {
    GK: ['reflexes', 'handling'], CB: ['tackling', 'positioning'], FB: ['tackling', 'pace'],
    CM: ['passing', 'vision'], WM: ['passing', 'vision'], WG: ['dribbling', 'pace'], ST: ['shooting', 'composure'],
  }
  const initialAttributes = { ...s().player!.attributes.values }
  const initialOvr = toOvr(computeCurrentAbility(s().player!))
  const xpByAttribute: Record<string, number> = {}
  const fullMatchStats: Partial<Record<keyof PlayerMatchStats, number>> = {}
  const keyMomentStats = { tackle: 0, interception: 0, header: 0, keyPass: 0, save: 0 }
  let realMatchesPlayed = 0
  let trainingSessions = 0, trainingXp = 0, trainingInjuries = 0
  let matchXpTotal = 0, matchXpMatches = 0
  const trainingGrades: Record<string, number> = {}
  function spendAcross(attrs: string[], xp: number): number {
    // A focused player taps preferred attributes, then lets the allocation
    // screen distribute the remainder. Balanced players auto-distribute all.
    const targets = xpStrategy === 'focused' ? priorities[s().player!.position].filter(a => attrs.includes(a)) : []
    let spent = 0
    if (targets.length) for (const attr of targets) {
      const used = s().spendAttributeXp(attr, xp * .7 / targets.length)?.xpUsed ?? 0
      spent += used; xpByAttribute[attr] = (xpByAttribute[attr] ?? 0) + used
    }
    const share = (xp - spent) / attrs.length
    for (const attr of attrs) {
      const used = s().spendAttributeXp(attr, share)?.xpUsed ?? 0
      spent += used; xpByAttribute[attr] = (xpByAttribute[attr] ?? 0) + used
    }
    return spent
  }
  function play(player: Player) { return actualMatches ? realMatch(player) : fakeMatch(player) }
  function accumulate(match: ReturnType<typeof play>) {
    if (!('playerStats' in match)) return
    realMatchesPlayed++
    for (const [key, value] of Object.entries(match.playerStats)) fullMatchStats[key as keyof PlayerMatchStats] = (fullMatchStats[key as keyof PlayerMatchStats] ?? 0) + value
    for (const key of Object.keys(keyMomentStats) as (keyof typeof keyMomentStats)[]) keyMomentStats[key] += match.momentStats[key]
  }
  function awardMatchXp(competitionId: string, match: ReturnType<typeof fakeMatch>) {
    if (!simulateMatchXp) return
    const tier: CompetitionTier = competitionId === 'international' ? 'international'
      : ['schoolCup', 'nationalChampionship', 'sundayCup', 'academyLeagueCup', 'academyKnockoutCup', 'academyChampionsCup'].includes(competitionId) ? 'cup'
        : s().player?.careerClock.phase === 'academy' ? 'academy' : 'grassroots'
    const xp = matchXpEarned(tier, match.rating, match.goals, match.assists)
    const attrs = s().player!.position === 'GK' ? ['reflexes', 'handling', 'gkPositioning', 'distribution'] : ['passing', 'shooting', 'dribbling', 'tackling', 'pace', 'strength', 'stamina', 'agility', 'vision', 'composure', 'positioning', 'concentration']
    matchXpTotal += spendAcross(attrs, xp)
    matchXpMatches++
  }
  const proTimeline: { week: number; offerCount: number; negotiation: string | null }[] = []

  // Stop EXACTLY at the requested season boundary — overrunning into season
  // N+1 pollutes the per-season tallies the assertions check.
  const maxWeeks = SEASONS * SEASON_WEEKS + (lateProProbe ? 9 : 0)
  let steps = 0
  while (weeksTicked < maxWeeks) {
    if (++steps > 8000) {
      failures++
      console.error('  ✗ FAIL: career loop stalled', JSON.stringify({ weeksTicked, week: s().calendar?.currentWeek.weekNumber,
        phase: s().player?.careerClock.phase, trial: s().player?.pathway?.academyTrialStatus,
        negotiation: s().player?.negotiation?.stage, pending: s().calendar && nextUnresolvedEvent(s().calendar)?.title }))
      break
    }
    const st = s()
    const { player, calendar } = st
    if (!player || !calendar) break
    if (player.careerEnded || player.turnedPro) break
    // Career.tsx creates the grassroots world from a React effect after an
    // academy release. The headless harness must perform that same step.
    if (player.careerClock.phase !== 'academy' && !st.league) { st.ensureLeagueWorld(); continue }
    if (player.careerClock.phase === 'academy') {
      if (!academyEntry) academyEntry = { season: calendar.currentWeek.seasonYear, week: calendar.currentWeek.weekNumber, age: player.careerClock.ageYears, club: player.academyClubName ?? null }
      maxAcademyInterest = Math.max(maxAcademyInterest, ...player.scoutWatchers.map(w => w.interest), 0)
      if (firstProOfferWeek === null && player.contractOffers.some(o => o.kind === 'professional')) firstProOfferWeek = player.totalWeeksElapsed ?? 0
      if (player.contractOffers.some(o => o.kind === 'professional') && !proTimeline.some(row => row.week === player.totalWeeksElapsed)) proTimeline.push({ week: player.totalWeeksElapsed ?? 0, offerCount: player.contractOffers.filter(o => o.kind === 'professional').length, negotiation: player.negotiation?.stage ?? null })
    }
    if (calendar.currentWeek.weekNumber === 1 && !seasonRoutes[calendar.currentWeek.seasonYear - 1]) {
      seasonRoutes[calendar.currentWeek.seasonYear - 1] = player.careerClock.phase === 'academy' ? 'academy' : player.grassrootsPath
    }
    if (calendar.currentWeek.weekNumber === 38 && !recruitmentReviews.some(review => review.season === calendar.currentWeek.seasonYear)) {
      const report = academyRecruitmentReport(player, calendar)
      recruitmentReviews.push({ season: report.season, age: player.careerClock.ageYears, average: Number(report.average.toFixed(2)), recent: Number(report.recentAverage.toFixed(2)), ready: report.canInvite, watchers: player.scoutWatchers.length, highestInterest: Math.round(Math.max(0, ...player.scoutWatchers.map(w => w.interest))), offers: player.contractOffers.filter(o => o.kind === 'academy').length, trial: player.pathway?.academyTrialStatus ?? 'none', reasons: report.reasons })
    }

    // School leavers also move into Sunday football at 18. Simulate the
    // player's contract choice, just as we do for grassroots starters.
    if (player.grassrootsPath === 'sunday' && st.league && !hasSundayContract(player, calendar.currentWeek.seasonYear, st.league)) {
      const renewal = player.contractOffers.find(o => o.kind === 'club' && o.contractSeason === calendar.currentWeek.seasonYear)
      if (renewal && calendar.currentWeek.weekNumber === 1) {
        st.respondToOffer(renewal.id, true)
        assert(hasSundayContract(s().player!, calendar.currentWeek.seasonYear, s().league), `season ${calendar.currentWeek.seasonYear} club contract signed`)
        continue
      }
    }

    // Organic academy path: respond to a genuine scout invitation, complete
    // one assessment per week, then choose an agent and negotiate the offer.
    if (autoAcademy && player.careerClock.phase !== 'academy') {
      const academyOffer = player.contractOffers.find(o => o.kind === 'academy')
      const trial = player.pathway?.academyTrialStatus
      if (academyOffer && academyTrialAvailable(player, academyOffer.id, calendar) && (trial === 'invited' || trial === 'active') && player.pathway?.academyTrialLastWeek !== player.totalWeeksElapsed) {
        const session = player.pathway?.academyTrialSessions ?? 0
        st.resolveAcademyTrial(academyOffer.id, [17, 17, 19][session])
        continue
      }
      const eligibleOffer = player.contractOffers.find(o => o.kind === 'academy' && academyTrialAvailable(player, o.id, calendar) && academyOfferCleared(player, o.id) && academyRegistrationOpen(player, o))
      if (trial === 'passed' && eligibleOffer && !player.negotiation && !player.contract) {
        st.signAgent('parent')
        st.beginNegotiation(eligibleOffer.id)
        if (isLive(s().player?.negotiation)) continue
      }
    }
    if (lateProProbe && !lateProOfferInjected && player.careerClock.phase === 'academy' && calendar.currentWeek.seasonYear === 6 && calendar.currentWeek.weekNumber === 43) {
      const club = generateTeam(5)
      useCareerStore.setState({ player: { ...player, contractOffers: [...player.contractOffers.filter(o => o.kind !== 'professional'), { id: 'late-pro-window-probe', clubId: club.id, clubName: club.name, clubShort: club.short, ratings: club.ratings, prestige: club.prestige, kind: 'professional', weekOffered: player.totalWeeksElapsed ?? 0, expiresInWeeks: 8 }] } })
      lateProOfferInjected = true
      continue
    }
    if (autoPro && player.careerClock.phase === 'academy' && !isLive(player.negotiation) && (!lateProProbe || lateProOfferInjected)) {
      const offer = player.contractOffers.find(o => o.kind === 'professional')
      if (offer) {
        if (!player.agentId) st.signAgent('parent')
        st.beginNegotiation(offer.id)
        if (isLive(s().player?.negotiation)) continue
      }
    }

    if (forceIntl && !intlForced && weeksTicked >= 5) {
      intlForced = true
      useCareerStore.setState({ player: { ...player, reputation: 60 } })
      continue
    }
    if (forceTransfer && !transferForced && weeksTicked >= 20 && st.league) {
      transferForced = true
      const lg = st.league
      const div = (lg.divisions as Record<number, import('../src/engine/league').Division>)[lg.playerDivision]
      const target = div.teams.find((t) => t.id !== lg.playerTeamId)!
      const offer = { id: 'ftr', clubId: target.id, clubName: target.name, clubShort: target.short, weekOffered: player.totalWeeksElapsed ?? 0, expiresInWeeks: 3, prestige: target.prestige, ratings: target.ratings, kind: 'club' as const, divisionTier: lg.playerDivision }
      useCareerStore.setState({ player: { ...player, contractOffers: [offer] } })
      s().respondToOffer('ftr', true)
      assert(s().league!.playerTeamId === target.id, 'club transfer moves playerTeamId')
      continue
    }
    if (forceAcademy && !academyForced && weeksTicked >= SEASON_WEEKS) {
      academyForced = true
      const offer = { id: 'forced', clubId: 'ac1', clubName: 'Harborview Academy', clubShort: 'HAR', weekOffered: player.totalWeeksElapsed ?? 0, expiresInWeeks: 4, prestige: 6, ratings: { attack: 60, midfield: 60, defense: 60 }, kind: 'academy' as const }
      useCareerStore.setState({ player: { ...player, contractOffers: [offer] } })
      // P30: an academy move now runs through representation + a multi-week
      // negotiation, driven here exactly as the UI drives it.
      s().signAgent(['parent', 'agency', 'independent'][Math.floor(rand() * 3)])
      s().beginNegotiation('forced')
      negotiationStartWeek = weeksTicked
      continue
    }

    // Drive any live negotiation the way a player would: answer when asked,
    // otherwise let the weekly tick move it along.
    if (s().player?.negotiation && isLive(s().player!.negotiation)) {
      const neg = s().player!.negotiation!
      if (neg.awaitingPlayer && !(lateProStall && player.careerClock.ageYears >= 20 && neg.kind === 'professional')) {
        const choice = neg.stage === 'approach' ? 'keen'
          : neg.stage === 'terms' ? (neg.pushCount < 1 ? 'push' : 'accept')
          : neg.stage === 'agreement' ? 'commit'
          : neg.stage === 'medical' ? 'honest'
          : 'sign'
        s().makeNegotiationChoice(choice)
        negotiationChoices++
        continue
      }
    }

    const pending = nextUnresolvedEvent(calendar)
    if (!pending) {
      if (calendar.currentWeek.weekNumber === SEASON_WEEKS) seasonSnapshots.push({ season: calendar.currentWeek.seasonYear, route: player.careerClock.phase === 'academy' ? 'academy' : player.grassrootsPath, appearances: player.career?.appearances ?? 0, goals: player.career?.goals ?? 0, assists: player.career?.assists ?? 0, reputation: Math.round(player.reputation) })
      st.advanceToNextWeek()
      weeksTicked++
      continue
    }
    if (pending.title === 'October development fixture') octoberWindows++
    if (player.injury) { st.resolveCurrentEvent(); continue }

    if (pending.type === 'training' && simulateTraining && (calendar.currentWeek.weekNumber - 1) % trainingFrequency === 0) {
      const session = generateSession(player)
      let completed = session
      let xp = 0, energy = 0
      for (let i = 0; i < session.drills.length; i++) {
        const drill = session.drills[i]
        const maxReward = Math.max(...drill.options.map(option => option.reward))
        if (miniGameForDrill(completed, i)) {
          const quality = .35 + rand() * .45
          completed = recordDrillResult(completed, Math.round(quality * maxReward * 10) / 10, maxReward, quality >= .5)
          xp += trainingXpForDrill(gradeFromRatio(quality)) * .8
          energy += 5 * intensitySpec('normal').energyMod
        } else {
          const decision = drillToDecision(player, completed)
          const choiceIndex = Math.floor(rand() * decision.options.length)
          const choice = decision.options[choiceIndex]
          const success = rand() < choice.successChance
          completed = recordDrillResult(completed, drill.options[choiceIndex].reward, maxReward, success)
          xp += trainingXpForDrill(gradeFromRatio(success ? .7 : .3)) * .8
          energy += Math.abs((success ? choice.onSuccess : choice.onFailure)?.energy ?? 5) * intensitySpec('normal').energyMod
        }
      }
      xp = Math.round(xp) + (((player.trainingStreak ?? 0) + 1) % 5 === 0 ? 100 : 0)
      const grade = gradeSession(completed)
      const outcome = applyTrainingGrowth(player, completed, grade, player.trainingMomentum ?? 0, 'normal')
      const injury = rollInjury(trainingInjuryChance(player, 'normal'))
      st.applyTrainingOutcome(outcome, Math.round(energy), injury)
      const attrs = SESSION_ATTRIBUTES[session.type] ?? []
      const spent = attrs.length ? spendAcross(attrs, xp) : 0
      trainingSessions++
      trainingXp += spent
      trainingGrades[grade] = (trainingGrades[grade] ?? 0) + 1
      if (injury?.weeksOut) trainingInjuries++
      continue
    }

    if (pending.type === 'match') {
      if (!matchAvailability(player).canPlay) { unavailableMatchdays++; st.resolveCurrentEvent(); continue }
      const phase = player.careerClock.phase
      const isInAcademy = phase === 'academy'
      const world = isInAcademy ? st.academyLeague : st.league

      // ---- exact mirror of Career.tsx's resolution ----
      if (pending.title === 'international duty') {
        const intl = st.international
        const fx = intl ? nationFixture(intl) : null
        if (!intl || !fx) { st.resolveCurrentEvent(); continue }
        const byId = internationalTeamById(intl)
        const nationHome = fx.homeTeamId === intl.nationTeamId
        const opp = byId.get(nationHome ? fx.awayTeamId : fx.homeTeamId)!
        const m = play(player)
        const shootout = intl.stage === 'finals' && m.ps === m.os ? rand() < 0.55 : undefined
        st.applyMatchResult(m.rating, m.goals, m.assists, 60, null, opp.id, m.ps, m.os, nationHome, undefined, opp.name, 'international', shootout, undefined, m.stats)
        accumulate(m)
        awardMatchXp('international', m)
        intlMatches++
        tallies['international'] = (tallies['international'] ?? 0) + 1
        continue
      }

      if (pending.title === 'October development fixture') {
        const league = player.octoberLeague
        const fixture = league ? playerOctoberFixture(league, calendar.currentWeek.weekNumber) : null
        if (!league || !fixture || fixture.homeGoals !== null) { deadMatchdays++; st.resolveCurrentEvent(); continue }
        const home = fixture.homeId === league.playerTeamId
        const opponent = league.teams.find(t => t.id === (home ? fixture.awayId : fixture.homeId))!
        const m = play(player)
        st.applyMatchResult(m.rating, m.goals, m.assists, 60, null, opponent.id, m.ps, m.os, home, undefined, opponent.name, 'octoberDevelopment', undefined, undefined, m.stats)
        accumulate(m)
        awardMatchXp('octoberDevelopment', m)
        tallies.octoberDevelopment = (tallies.octoberDevelopment ?? 0) + 1
        continue
      }

      if (pending.title === 'continental qualifier') {
        const cup = st.cups.academyChampionsCup
        const fixture = cup && playerCupFixture(cup)
        if (!cup || !fixture) { deadMatchdays++; st.resolveCurrentEvent(); continue }
        const home = fixture.homeTeamId === cup.playerTeamId
        const opponent = cup.teams.find(t => t.id === (home ? fixture.awayTeamId : fixture.homeTeamId))!
        const m = play(player)
        st.applyMatchResult(m.rating, m.goals, m.assists, 60, null, opponent.id, m.ps, m.os, home, undefined, opponent.name, 'academyChampionsCup', undefined, undefined, m.stats)
        accumulate(m)
        awardMatchXp('academyChampionsCup', m)
        tallies.academyChampionsCupQualifier = (tallies.academyChampionsCupQualifier ?? 0) + 1
        continue
      }

      const comp = activeCompetitionForWeek(calendar.currentWeek.weekNumber, phase, player.grassrootsPath, Boolean(st.cups.schoolDevelopment), player.academyCountryId)
      if (!comp) { deadMatchdays++; st.resolveCurrentEvent(); continue }

      if (comp.competitionId === 'sundayLeague' || comp.competitionId === 'schoolLeague') {
        const division = (world!.divisions as Record<number, import('../src/engine/league').Division>)[world!.playerDivision]
        const fixture = division.fixtures
          .filter((f) => !f.played && f.week <= comp.round && (f.homeTeamId === world!.playerTeamId || f.awayTeamId === world!.playerTeamId))
          .sort((a, b) => a.week - b.week)[0]
        if (!fixture) { tallies['league:trainingFallback'] = (tallies['league:trainingFallback'] ?? 0) + 1; st.resolveCurrentEvent(); continue }
        const isHome = fixture.homeTeamId === world!.playerTeamId
        const opp = division.teams.find((t) => t.id === (isHome ? fixture.awayTeamId : fixture.homeTeamId))!
        const m = play(player)
        st.applyMatchResult(m.rating, m.goals, m.assists, 60, null, opp.id, m.ps, m.os, isHome, undefined, opp.name, comp.competitionId, undefined, undefined, m.stats)
        accumulate(m)
        awardMatchXp(comp.competitionId, m)
        tallies[comp.competitionId] = (tallies[comp.competitionId] ?? 0) + 1
        continue
      }

      if (comp.competitionId === 'schoolFriendlies') {
        const opp = generateTeam(3)
        const m = play(player)
        st.applyMatchResult(m.rating, m.goals, m.assists, 60, null, opp.id, m.ps, m.os, rand() < 0.5, undefined, opp.name, 'schoolFriendlies', undefined, undefined, m.stats)
        accumulate(m)
        awardMatchXp('schoolFriendlies', m)
        tallies['schoolFriendlies'] = (tallies['schoolFriendlies'] ?? 0) + 1
        continue
      }

      // cup week
      const cupWorld = (st.cups as unknown as Record<string, CupWorld | null>)[comp.competitionId]
      const cupFixture = cupWorld ? playerCupFixture(cupWorld) : null
      if (!cupWorld || !cupFixture) {
        // eliminated / done — this is EXTRA TRAINING in-game, not a dead tap
        tallies[`${comp.competitionId}:trainingFallback`] = (tallies[`${comp.competitionId}:trainingFallback`] ?? 0) + 1
        st.resolveCurrentEvent()
        continue
      }
      const isHome = cupFixture.homeTeamId === cupWorld.playerTeamId
      const opp = cupWorld.teams.find((t) => t.id === (isHome ? cupFixture.awayTeamId : cupFixture.homeTeamId))!
      const m = play(player)
      const isKnockout = cupWorld.stage === 'knockout'
      const shootout = isKnockout && m.ps === m.os ? rand() < 0.55 : undefined
      st.applyMatchResult(m.rating, m.goals, m.assists, 60, null, opp.id, m.ps, m.os, isHome, undefined, opp.name, comp.competitionId, shootout, undefined, m.stats)
      accumulate(m)
      awardMatchXp(comp.competitionId, m)
      tallies[comp.competitionId] = (tallies[comp.competitionId] ?? 0) + 1
      continue
    }

    // P28: 'school' slots are the life layer. Resolve them the way Career.tsx
    // does — pick a real event (relationship pool included) and apply a real
    // choice — so relationships drift, bonds move and arcs get opened.
    if (pending.type === 'school') {
      const relPick = rand() < 0.55 ? pickRelationshipEvent(player, calendar.currentWeek.weekNumber, player.recentLifeEvents ?? []) : null
      const d = relPick ? relPick.decision : pickLifeEvent(buildLifeContext(player, calendar.currentWeek.weekNumber), player.recentLifeEvents ?? []).decision
      st.noteLifeEvent(relPick ? `${relPick.event.key}:${relPick.person.id}` : 'gen')
      const chosen = d.options[Math.floor(rand() * d.options.length)]
      const success = rand() < chosen.successChance
      st.applyDecisionResult({ chosen, success, effect: (success ? chosen.onSuccess : chosen.onFailure) ?? {} }, d.relationshipId)
      continue
    }

    if (pending.type === 'rest') {
      st.applyRestChoice('full-rest')
      continue
    }

    // P29: behave like a player with money — claim the weekly reward, take a
    // job when fresh, and buy kit when it can be afforded.
    st.claimWeeklyReward()
    if (rand() < 0.3) {
      const jobs = ['carwash', 'paper-round', 'stacking', 'gardening']
      st.workOddJob(jobs[Math.floor(rand() * jobs.length)])
    }
    // A player who actually kits up: keeps boots on, replaces them as they
    // wear out, and drinks when tired. This proves money has real sinks
    // rather than just piling up (careerSim caught it running to four figures).
    const p2 = s().player!
    if ((p2.equipment ?? []).length < 3 && rand() < 0.5) {
      // A player with a wage buys the good stuff; a schoolkid buys what they can.
      const wishlist = p2.contract
        ? ['boots-custom', 'kit-recovery-suit', 'shinpads-carbon-pro', 'boots-elite', 'boots-speed']
        : ['boots-speed', 'shinpads-pro', 'kit-compression', 'boots-elite']
      for (const id of wishlist) {
        if (st.buyItem(id).ok) break
      }
    }
    // P33: a player with money to spare sends some home — it's the sink that
    // exists precisely because wages otherwise pile up with nowhere to go.
    if ((p2.money ?? 0) > 400 && rand() < 0.4) st.sendMoneyHome(120)
    if (p2.fitness.stamina < 55 && rand() < 0.5) {
      if (!st.consumeItem('energy-drink').ok) st.buyItem('energy-drink')
    }

    // other non-match events just resolve
    st.resolveCurrentEvent()

    // Standings-sync invariant (the P25 desync bug): in the player's division,
    // no team may ever be more than one round ahead of any other.
    const w = (s().player!.careerClock.phase === 'academy' ? s().academyLeague : s().league)
    if (w) {
      const div = (w.divisions as Record<number, import('../src/engine/league').Division>)[w.playerDivision]
      const playedCounts = div.standings.map((x) => x.played)
      const spread = Math.max(...playedCounts) - Math.min(...playedCounts)
      assert(spread <= 1, `standings desync: played-count spread ${spread} (${JSON.stringify(playedCounts)}) at week ${s().calendar!.currentWeek.weekNumber}`)
      if (spread > 1) process.exit(1)
    }
  }

  const st = s()
  const player = st.player!
  if ((weeksTicked % SEASON_WEEKS !== 0 || lateProProbe) && !seasonSnapshots.some(row => row.season === st.calendar?.currentWeek.seasonYear)) seasonSnapshots.push({ season: st.calendar?.currentWeek.seasonYear ?? SEASONS, route: player.careerClock.phase === 'academy' ? 'academy' : player.grassrootsPath ?? 'school', appearances: player.career?.appearances ?? 0, goals: player.career?.goals ?? 0, assists: player.career?.assists ?? 0, reputation: Math.round(player.reputation) })
  console.log('\n=== CAREER SIM COMPLETE ===')
  console.log('weeks ticked:', weeksTicked, '| seasons:', Math.floor(weeksTicked / SEASON_WEEKS))
  console.log('end state:', player.careerEnded ? 'career ended' : player.turnedPro ? 'turned pro' : 'active', '| age:', player.careerClock.ageYears, '| phase:', player.careerClock.phase, '| route:', player.grassrootsPath, '| role:', player.squadRole)
  console.log('season snapshots:', JSON.stringify(seasonSnapshots))
  console.log('academy October reviews:', JSON.stringify(recruitmentReviews.filter(review => review.age >= 16)))
  console.log('scouting at finish:', JSON.stringify({ watchers: player.scoutWatchers.map(w => ({ interest: Math.round(w.interest), visits: w.watchedMatches })), offers: player.contractOffers.map(o => o.kind), contract: player.contract?.clubName ?? null, trial: player.pathway?.academyTrialStatus ?? null }))
  console.log('pro window:', JSON.stringify({ academySeasons: seasonRoutes.filter(route => route === 'academy').length, firstProOfferWeek, maxAcademyInterest: Math.round(maxAcademyInterest), outcome: player.turnedPro ? 'signed' : player.careerEnded ? 'aged out' : 'active' }))
  if (proTimeline.length) console.log('pro offer timeline:', JSON.stringify(proTimeline))
  console.log('matches by competition:', tallies)
  console.log('career appearances:', player.career?.appearances, '| dead matchdays:', deadMatchdays)
  console.log('career totals:', JSON.stringify({ goals: player.career?.goals ?? 0, assists: player.career?.assists ?? 0, cleanSheets: player.career?.cleanSheets ?? 0, saves: player.career?.saves ?? 0 }))
  console.log('unavailable matchdays:', unavailableMatchdays, '| October windows:', octoberWindows)
  console.log('reputation:', player.reputation, '| trust:', player.coachTrust?.toFixed?.(2) ?? player.coachTrust, '| confidence:', player.confidence.value.toFixed(2))
  console.log('glory: personal', JSON.stringify(player.personalGlory ?? {}), '| club', JSON.stringify(player.clubGlory ?? {}), '| national', JSON.stringify(player.nationalGlory ?? {}))

  // P36: glory fields must exist and be finite after real store play, even if empty.
  assert(typeof player.personalGlory === 'object' && player.personalGlory !== null, 'personalGlory exists on the player after real play')
  assert(typeof player.clubGlory === 'object' && player.clubGlory !== null, 'clubGlory exists on the player after real play')
  assert(typeof player.nationalGlory === 'object' && player.nationalGlory !== null, 'nationalGlory exists on the player after real play')
  assert(Object.values(player.personalGlory ?? {}).every((v) => Number.isFinite(v) && v >= 1), 'every recorded personal glory count is a real positive integer, never 0 or NaN sitting in the record')

  // ---------- ASSERTIONS ----------
  const perSeason = SEASONS
  const schoolSeasons = seasonRoutes.filter(route => route === 'school').length
  const sundaySeasons = seasonRoutes.filter(route => route === 'sunday').length
  assert(deadMatchdays === 0, `dead matchdays should be 0, got ${deadMatchdays}`)
  const academyReached = seasonRoutes.includes('academy') || player.careerClock.phase === 'academy'
  if (!forceAcademy && !academyReached) {
    // A mid-window transfer can blank a fixture when the new club's round
    // has already been played; count that as a training fallback.
    const leaguePlayed = (tallies['schoolLeague'] ?? 0) + (tallies['sundayLeague'] ?? 0)
    const leagueBlanks = tallies['league:trainingFallback'] ?? 0
    if (forceTransfer) {
      assert(leaguePlayed + leagueBlanks >= 22 * perSeason - 3 && leaguePlayed + leagueBlanks <= 22 * perSeason, `league matches+blanks should cover the schedule, got ${leaguePlayed}+${leagueBlanks}`)
    } else {
      assert((tallies.schoolLeague ?? 0) === 18 * schoolSeasons, `school league matches should be ${18 * schoolSeasons}, got ${tallies.schoolLeague ?? 0}`)
      assert((tallies.sundayLeague ?? 0) === 22 * sundaySeasons, `Sunday league matches should be ${22 * sundaySeasons}, got ${tallies.sundayLeague ?? 0}`)
    }
  }
  if (!forceAcademy && !academyReached) {
    assert((tallies['schoolFriendlies'] ?? 0) === 3 * schoolSeasons, `two preseason matches and one annual rivalry match per school season, got ${tallies['schoolFriendlies'] ?? 0}`)
    const cupMatches = (tallies['schoolCup'] ?? 0) + (tallies['schoolDevelopment'] ?? 0) + (tallies['sundayCup'] ?? 0)
    assert(cupMatches > 0, `the route's cup or development competition should remain reachable, got ${cupMatches}`)
    const records = [...(player.competitionCareer?.history ?? []), ...Object.values(player.competitionCareer?.current ?? {})]
    for (let season = 1; season <= SEASONS; season++) {
      const development = records.find(r => r.season === season && r.competitionId === 'schoolDevelopment')?.appearances ?? 0
      const regional = records.find(r => r.season === season && r.competitionId === 'schoolCup')?.appearances ?? 0
      assert(!(development > 0 && regional > 0), `season ${season} stays in one post-league school route`)
    }
    if (SEASONS === 1) {
      assert(octoberWindows === 4, `under-16 route receives four October matchdays, got ${octoberWindows}`)
      assert(!!player.octoberLeague && octoberStandings(player.octoberLeague).every(row => row.played === 4), 'October table finishes with four games per club')
    }
  } else if (forceAcademy || academyReached) {
    const academyCupMatches = (tallies['academyLeagueCup'] ?? 0) + (tallies['academyKnockoutCup'] ?? 0) + (tallies['academyChampionsCup'] ?? 0)
    if (!player.turnedPro) assert(academyCupMatches >= 1, `academy cup matches should appear after transition, got ${academyCupMatches}`)
    assert(s().player!.careerClock.phase === 'academy', 'player should be in academy phase')
  }
  if (forceIntl) {
    assert(intlMatches >= 3, `international matches should be played after call-up, got ${intlMatches}`)
    assert((tallies['international'] ?? 0) === intlMatches, 'international tally consistent')
  }
  if (lateProProbe) assert(lateProStall ? !!player.careerEnded && !player.turnedPro : !!player.turnedPro,
    lateProStall ? 'late pro talks cannot keep the career alive indefinitely' : 'a final-week professional offer can finish its already-started talks after the age-20 rollover')
  const total = Object.entries(tallies).filter(([k]) => !k.includes(':')).reduce((a, [, v]) => a + v, 0)
  // The school calendar has 18 league rounds plus friendlies/cups; exits,
  // selection and injury can lower personal appearances further. Exact league
  // round coverage is checked above, so a blanket 22-game floor is invalid.
  if (player.position === 'GK') {
    assert((player.career?.cleanSheets ?? 0) > 0, `GK should bank clean sheets over ${total} matches, got ${player.career?.cleanSheets}`)
    assert((player.career?.goals ?? 0) === 0, 'keeper fast match generator must not award striker goals')
    assert((player.career?.saves ?? 0) > 0, 'keeper saves must reach the career ledger')
  } else {
    // Outfield player: the GK-only clean-sheet fix means an ST must bank ZERO
    assert((player.career?.cleanSheets ?? 0) === 0, `outfield player cleanSheets must be 0 (GK-only stat), got ${player.career?.cleanSheets}`)
  }
  assert(player.career!.appearances === total, `career appearances (${player.career!.appearances}) should equal playable matches recorded (${total})`)
  const recordedByCompetition = Object.values(player.careerByCompetition ?? {}).reduce((count, row) => count + row.appearances, 0)
  assert(recordedByCompetition === player.career!.appearances, `competition career totals (${recordedByCompetition}) equal career appearances (${player.career!.appearances})`)
  if (forceTransfer) assert((s().player!.squadRole) === 'bench' || (s().player!.career!.appearances ?? 0) > 0, 'transfer leaves a playable state')
  // league integrity at the end of a completed season boundary is checked live below

  // standings sync: at any mid-season point everyone should have played the
  // same round count (checked continuously would be better; here we verify the
  // invariant that the player's team is never >1 round ahead of the field —
  // re-run a fresh short sim with a probe)
  // Relationships and season-long coach objectives, at STORE level.
  // Engine-level sims can't catch wiring bugs (the P25 lesson), so these
  // assertions run against whatever the real store actually produced.
  const rels = player.relationships ?? []
  assert(rels.length >= 7, `cast persisted through the career (${rels.length} people)`)
  assert(rels.every((r) => Number.isFinite(r.bond) && r.bond >= -100 && r.bond <= 100), 'all bonds finite and in range after a full career')
  assert(new Set(rels.map((r) => r.id)).size === rels.length, 'no duplicate people in the cast')
  const drifted = rels.some((r) => r.bond !== Math.round(r.bond) || r.weeksSinceContact > 0)
  assert(drifted, 'relationship drift actually ran during the career')
  assert((player.activeArcs ?? []).length === 0, 'retired timed challenges cannot recur')
  assert(player.seasonObjectives?.objectives.length === 4, 'four coach objectives persist into the new season')
  assert(player.seasonObjectives?.seasonYear === useCareerStore.getState().calendar?.currentWeek.seasonYear, 'coach objectives roll over with the season')
  console.log('relationships:', rels.length, '| season objectives:', player.seasonObjectives?.objectives.length,
    '| avg bond:', (rels.reduce((a, r) => a + r.bond, 0) / rels.length).toFixed(1))

  // ---- P29: economy + sub appearances, at STORE level ----
  assert((player.money ?? 0) >= 0, `money never goes negative (${player.money})`)
  assert(Number.isFinite(player.money ?? 0), 'money stays finite')
  assert((player.equipment ?? []).every((e) => e.weeksRemaining > 0), 'no expired equipment lingers')
  assert((player.equipment ?? []).length <= 4, `equipment bounded by slots (${(player.equipment ?? []).length})`)
  const consumableCounts = Object.values(player.consumables ?? {})
  assert(consumableCounts.every((n) => n >= 0), 'consumable counts never negative')
  console.log('money:', player.money, '| equipment:', (player.equipment ?? []).length, '| allowance:', monthlyAllowance(player))
  // Academy wages can legitimately be saved over several seasons. Finiteness,
  // non-negative balance and usable equipment are checked above.

  // ---- P30: agents, negotiation and wages, at STORE level ----
  if (forceAcademy) {
    assert(!!player.agentId, 'an agent was signed before the academy move')
    assert(!!player.contract || player.negotiation?.stage === 'collapsed',
      `the negotiation reached a real conclusion (stage=${player.negotiation?.stage})`)
    if (player.contract) {
      const weeksTaken = (player.contract.signedWeek) - negotiationStartWeek
      assert(weeksTaken >= 4, `the negotiation genuinely took weeks (${weeksTaken})`)
      assert(player.careerClock.phase === 'academy', 'signing moved the player into the academy')
      assert((player.careerEarnings ?? 0) > 0, 'wages accrued after signing')
      assert((player.money ?? 0) > 0, 'wages actually reached the wallet')
      const expectedFees = player.agentId === 'parent' ? 0 : (player.agentFeesPaid ?? 0)
      assert(player.agentId === 'parent' ? expectedFees === 0 : expectedFees > 0,
        `agent commission matches the agent (${player.agentId}: £${(player.agentFeesPaid ?? 0).toFixed(0)})`)
      assert((player.careerEarnings ?? 0) >= (player.agentFeesPaid ?? 0), 'fees never exceed earnings')
      console.log('contract:', player.contract.clubName, formatWage(player), '| agent:', player.agentId,
        '| earnings:', Math.round(player.careerEarnings ?? 0), '| fees:', Math.round(player.agentFeesPaid ?? 0),
        '| choices made:', negotiationChoices)
    }
  }

  // Save/load roundtrip through (fake) IndexedDB: everything the store holds
  // must survive persistence, including the new cup/international worlds.
  await st.saveCurrent()
  const before = { cups: st.cups, international: st.international, octoberLeague: st.player?.octoberLeague,
    matchLedger: st.player?.matchLedger, worldMatchHistory: st.player?.worldMatchHistory,
    schoolMatchHistory: st.league?.matchHistory, academyMatchHistory: st.academyLeague?.matchHistory }
  await st.loadFromSlot(0)
  const after = useCareerStore.getState()
  assert(JSON.stringify(after.cups) === JSON.stringify(before.cups), 'cups must roundtrip through save/load')
  assert(JSON.stringify(after.international) === JSON.stringify(before.international), 'international world must roundtrip through save/load')
  assert(JSON.stringify(after.player?.octoberLeague) === JSON.stringify(before.octoberLeague), 'October league table and fixtures must roundtrip through save/load')
  assert(JSON.stringify(after.player?.matchLedger) === JSON.stringify(before.matchLedger), 'played match ledger must survive save/load')
  assert(JSON.stringify(after.player?.worldMatchHistory) === JSON.stringify(before.worldMatchHistory), 'cup and country match history must survive save/load')
  assert(JSON.stringify(after.league?.matchHistory) === JSON.stringify(before.schoolMatchHistory), 'school league archive must survive save/load')
  assert(JSON.stringify(after.academyLeague?.matchHistory) === JSON.stringify(before.academyMatchHistory), 'academy league archive must survive save/load')
  assert(after.player?.career?.appearances === player.career?.appearances, 'career totals must roundtrip')
  assert(JSON.stringify(after.player?.relationships) === JSON.stringify(player.relationships), 'relationships must roundtrip through save/load')
  assert(JSON.stringify(after.player?.seasonObjectives) === JSON.stringify(player.seasonObjectives), 'season objectives must roundtrip through save/load')
  assert(after.player?.money === player.money, 'money must roundtrip through save/load')
  assert(after.player?.agentId === player.agentId, 'agent must roundtrip through save/load')
  assert(JSON.stringify(after.player?.contract) === JSON.stringify(player.contract), 'contract must roundtrip through save/load')
  assert(JSON.stringify(after.player?.negotiation) === JSON.stringify(player.negotiation), 'live negotiation must roundtrip through save/load')
  assert(JSON.stringify(after.player?.equipment) === JSON.stringify(player.equipment), 'equipment must roundtrip through save/load')
  assert(after.player?.proGraceDeadline === player.proGraceDeadline, 'pro negotiation grace deadline must roundtrip through save/load')

  if (process.env.SIM_JSON === '1') console.log('COHORT_JSON:' + JSON.stringify({
    seed: SEED, nationality: player.nationality, region: player.regionId, position: player.position,
    startingRoute: process.env.FORCE_SUNDAY === '1' ? 'grassroots' : 'school', quality: Number(process.env.SIM_QUALITY ?? 1),
    outcome: player.turnedPro ? 'pro' : player.careerEnded ? 'age-out' : 'active', finalAge: player.careerClock.ageYears,
    finalPhase: player.careerClock.phase, finalRole: player.squadRole, finalOvr: toOvr(computeCurrentAbility(player)),
    academyEntry, proSigning: player.turnedPro ? { ...player.turnedPro, season: Math.floor(player.turnedPro.weekSigned / SEASON_WEEKS) + 1 } : null,
    yearsSimulated: Math.floor(weeksTicked / SEASON_WEEKS), weeksSimulated: weeksTicked,
    stats: { ...player.career, reputation: Number(player.reputation.toFixed(2)), money: player.money, earnings: player.careerEarnings ?? 0,
      league: player.careerByCompetition?.league, cup: player.careerByCompetition?.cup,
      international: player.careerByCompetition?.international, other: player.careerByCompetition?.other },
    awards: { personal: player.personalGlory ?? {}, club: player.clubGlory ?? {}, national: player.nationalGlory ?? {} },
    seasonSnapshots, training: { sessions: trainingSessions, xpSpent: Math.round(trainingXp), injuries: trainingInjuries, grades: trainingGrades }, matchXp: { matches: matchXpMatches, xpSpent: Math.round(matchXpTotal) }, initialPotential: s().player?.potential, initialOvr, initialAttributes, finalAttributes: player.attributes.values, xpStrategy, xpByAttribute, realMatchesPlayed, fullMatchStats, keyMomentStats, competitions: { history: player.competitionCareer?.history ?? [], current: player.competitionCareer?.current ?? {} },
    recruitmentReviews, scoutInterestPeak: Math.round(maxAcademyInterest), firstProOfferWeek,
    matchCounts: tallies, deadMatchdays, unavailableMatchdays, failures,
  }))

  console.log(failures === 0 ? '\n✅ ALL ASSERTIONS PASSED' : `\n❌ ${failures} ASSERTION(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}

void main()


function formatWage(p: import('../src/types/player').Player): string {
  if (!p.contract) return '—'
  return `£${p.contract.terms.weeklyWage}/wk gross, £${netWage(p.contract.terms.weeklyWage, p.agentId)}/wk net`
}
