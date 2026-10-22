// P51 — Joel wants to SEE full careers: goals scored, when they turned pro,
// how they started, season-by-season stats, relationships. Built on the
// same proven store-integration harness as careerSim.ts (drives the REAL
// zustand store, not isolated functions), extended with:
//   1. A REAL training branch — the existing careerSim.ts skips training
//      events with a bare resolveCurrentEvent(), meaning NO training XP was
//      ever earned in that harness. That would understate growth and give a
//      misleading picture for exactly what this report needs to show, so
//      this one actually simulates a session's drills (real per-drill grade
//      rolls -> trainingXpForDrill -> spendAttributeXp on the session's
//      restricted attributes) before moving on.
//   2. Rich season-by-season tracking + a human-readable report per career.
//   3. Four DIFFERENT starting configs (position + trial quality) so the
//      careers actually diverge, not four copies of the same run.
import 'fake-indexeddb/auto'
import { reseed, rand } from '../src/engine/rng'
import { useCareerStore } from '../src/store/careerStore'

// This is a diagnostic report, not real gameplay — persistence isn't needed,
// and every single spendAttributeXp/resolveCurrentEvent call triggering a
// REAL save across thousands of calls per career × 4 careers is exactly
// what exhausted memory on the first run (crashed mid-way through career 2,
// after career 1 printed a complete, correct report). No production code
// touched — just short-circuiting the save call for this script only.
useCareerStore.setState({ saveCurrent: async () => {} } as any)

import { nextUnresolvedEvent, activeCompetitionForWeek, SEASON_WEEKS } from '../src/engine/calendar'
import { nationFixture, internationalTeamById } from '../src/engine/international'
import { pickRelationshipEvent } from '../src/engine/relationshipEvents'
import { pickLifeEvent, buildLifeContext } from '../src/engine/lifeEvents'
import { isLive } from '../src/engine/negotiation'
import { computeCurrentAbility, toOvr } from '../src/engine/rating'
import { generateSession, drillToDecision } from '../src/engine/training'
import { trainingXpForDrill, gradeFromRatio, matchXpEarned, type CompetitionTier } from '../src/engine/xp'
import { SESSION_ATTRIBUTES } from '../src/types/training'
import { OUTFIELD_ATTRIBUTES, GOALKEEPER_ATTRIBUTES } from '../src/types/attributes'
import type { Player } from '../src/types/player'
import type { CalendarState } from '../src/types/calendar'

const SEASONS = 6

function fakeMatch(position: string): { rating: number; goals: number; assists: number; ps: number; os: number; stats: { tackle: number; interception: number; header: number; keyPass: number; save: number } } {
  const isGk = position === 'GK'
  const isDef = position === 'CB' || position === 'FB'
  const isMid = position === 'CM' || position === 'WM' || position === 'WG'
  const goalChance = isGk ? 0.01 : position === 'ST' ? 0.35 : isMid ? 0.12 : 0.03
  const assistChance = isGk ? 0.03 : position === 'ST' ? 0.25 : isMid ? 0.22 : 0.08
  const goals = rand() < goalChance ? 1 : (!isGk && position === 'ST' && rand() < 0.1) ? 2 : 0
  const assists = rand() < assistChance ? 1 : 0
  const ps = goals + (rand() < 0.5 ? 1 : 0)
  const os = rand() < 0.4 ? 0 : rand() < 0.7 ? 1 : 2

  // P52 — realistic per-position defensive/passing/GK output, so a career
  // report actually shows what a scout would be watching for that role,
  // not just goals. A CB doing their job well every match; a keeper making
  // several saves when the opponent actually threatens; a midfielder
  // stringing passes together.
  const stats = { tackle: 0, interception: 0, header: 0, keyPass: 0, save: 0 }
  if (isDef) {
    stats.tackle = Math.floor(rand() * 4) // 0-3
    stats.interception = Math.floor(rand() * 3)
    stats.header = Math.floor(rand() * 2)
  } else if (isMid) {
    stats.keyPass = Math.floor(rand() * 4)
    stats.tackle = Math.floor(rand() * 2)
  } else if (position === 'ST') {
    stats.keyPass = Math.floor(rand() * 2)
  }
  if (isGk) stats.save = os + Math.floor(rand() * 3) // at least covers shots faced

  // P52 fix: rating here only ever factored in goals/assists — the real
  // match engine's updateRating() gives genuine rating credit for ANY
  // successful moment (a tackle, a save, a key pass), not just a goal. This
  // fixture was silently understating a defender's actual match rating
  // despite their defensive stats being tracked correctly, which then
  // dragged down the base-rating component of reputation they share with
  // everyone else. Matched to the real engine's rough magnitude per action.
  const defensiveContribution = (stats.tackle + stats.interception + stats.header) * 0.18
  const creativeContribution = stats.keyPass * 0.15
  const saveContribution = stats.save * 0.12
  const rating = Math.min(10, 6 + goals * 0.9 + assists * 0.5 + defensiveContribution + creativeContribution + saveContribution
    + (isGk && os === 0 ? 0.6 : 0) + (rand() - 0.3))

  return { rating: Math.round(rating * 10) / 10, goals, assists, ps, os, stats }
}

interface CareerConfig {
  label: string
  position: 'ST' | 'GK' | 'CB' | 'CM'
  trialQuality: number
  seed: number
}

function makePlayer(cfg: CareerConfig): Player {
  // P51 fix: this used to hand every position the same 12 OUTFIELD attribute
  // keys, including goalkeepers — a real GK's actual attributes (reflexes,
  // handling, gkPositioning, distribution) never got seeded at all, so
  // computeCurrentAbility's GK-weighted formula read them as 0 and their OVR
  // floor-crashed. Confirmed this was a bug in THIS SCRIPT, not the real
  // game, by checking PlayerCreation.tsx — the actual onboarding already
  // branches correctly by position. Matched that here.
  //
  // P55 — SECOND real bug in this same function, found by Joel directly
  // questioning why the simulation showed absurdly high starting/ending
  // OVRs: every attribute was hardcoded to exactly 8, completely
  // disconnected from the REAL onboarding seed (P54 fixed PlayerCreation.tsx
  // to randomBetween(1,4) — this script's own separate makePlayer() was
  // never updated to match, so every "verification" run through this
  // richer script since P54 was silently checking the WRONG starting point).
  // Fixed to use the exact same seed call as real onboarding.
  const isGk = cfg.position === 'GK'
  const attrList = isGk ? GOALKEEPER_ATTRIBUTES : OUTFIELD_ATTRIBUTES
  const values: Record<string, number> = {}
  for (const k of attrList) values[k] = Math.round(1 + rand() * 3) // matches PlayerCreation.tsx's randomBetween(1,4) exactly
  return {
    name: cfg.label, surname: 'Player', position: cfg.position, foot: 'right', potential: 18,
    attributes: (isGk ? { kind: 'goalkeeper', values } : { kind: 'outfield', values }) as Player['attributes'],
    confidence: { value: 0, baseline: 0 }, fitness: { stamina: 100 },
    careerClock: { ageYears: 14, phase: 'grassroots-trials', grassrootsSeason: 1 },
    schoolId: 'greenwood', trialWeekCompleted: 0, squadRole: null, trainingMomentum: 0,
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

interface SeasonSnapshot {
  season: number
  phase: string
  goals: number
  assists: number
  appearances: number
  avgRating: number
  ovrAtEnd: number
  reputationAtEnd: number
}

function earnRealMatchXp(tier: CompetitionTier, rating: number, goals: number, assists: number, st: ReturnType<typeof useCareerStore.getState>, player: Player) {
  const xp = matchXpEarned(tier, rating, goals, assists)
  const attrs = Object.keys(player.attributes.values as Record<string, number>)
  const share = xp / attrs.length
  for (const attr of attrs) st.spendAttributeXp(attr, share)
}

async function runCareer(cfg: CareerConfig) {
  reseed(cfg.seed)
  const s = () => useCareerStore.getState()
  await s().startNewCareer(makePlayer(cfg), initialCalendar(), 0)
  s().resolveCurrentEvent()
  s().completeTrials(cfg.trialQuality >= 0.6 ? 'starting-xi' : cfg.trialQuality >= 0.35 ? 'bench' : 'reserves', cfg.trialQuality)
  s().ensureLeagueWorld()

  const startOvr = toOvr(computeCurrentAbility(s().player!))
  const startRole = s().player!.squadRole

  const seasons: SeasonSnapshot[] = []
  let seasonGoals = 0, seasonAssists = 0, seasonApps = 0, seasonRatingSum = 0
  let intlCaps = 0, intlGoals = 0, intlAssists = 0
  let currentSeason = 1
  let turnedProWeek: number | null = null
  let turnedProClub: string | null = null
  let academySignedWeek: number | null = null
  let weeksTicked = 0
  const maxWeeks = SEASONS * SEASON_WEEKS

  const closeSeasonSnapshot = () => {
    const p = s().player
    if (!p) return
    seasons.push({
      season: currentSeason, phase: p.careerClock.phase,
      goals: seasonGoals, assists: seasonAssists, appearances: seasonApps,
      avgRating: seasonApps > 0 ? Math.round((seasonRatingSum / seasonApps) * 100) / 100 : 0,
      ovrAtEnd: toOvr(computeCurrentAbility(p)),
      reputationAtEnd: Math.round((p.reputation ?? 0) * 10) / 10,
    })
    seasonGoals = 0; seasonAssists = 0; seasonApps = 0; seasonRatingSum = 0
  }

  while (weeksTicked < maxWeeks) {
    const st = s()
    const { player, calendar } = st
    if (!player || !calendar) break
    if (player.careerEnded) break
    if (player.turnedPro && turnedProWeek === null) {
      turnedProWeek = player.totalWeeksElapsed ?? weeksTicked
      turnedProClub = player.academyClubName ?? player.turnedPro ?? 'unknown club'
    }
    if (player.academyClubName && academySignedWeek === null && player.careerClock.phase === 'academy') {
      academySignedWeek = player.totalWeeksElapsed ?? weeksTicked
    }

    const seasonNow = calendar.currentWeek.seasonYear
    if (seasonNow !== currentSeason) {
      closeSeasonSnapshot()
      currentSeason = seasonNow
    }

    if (player.negotiation && isLive(player.negotiation)) {
      const neg = player.negotiation
      if (neg.awaitingPlayer) {
        const choice = neg.stage === 'approach' ? 'keen'
          : neg.stage === 'terms' ? (neg.pushCount < 1 ? 'push' : 'accept')
          : neg.stage === 'agreement' ? 'commit'
          : neg.stage === 'medical' ? 'honest' : 'sign'
        st.makeNegotiationChoice(choice)
        continue
      }
    }

    if (!player.agentId && (player.reputation ?? 0) > 15) st.signAgent(['parent', 'agency', 'independent'][Math.floor(rand() * 3)])
    const academyOffer = (player.contractOffers ?? []).find((o) => o.kind === 'academy')
    if (academyOffer && !player.negotiation) st.beginNegotiation(academyOffer.id)
    const proOffer = (player.contractOffers ?? []).find((o) => o.kind === 'professional')
    if (proOffer) st.respondToOffer(proOffer.id, true)

    const pending = nextUnresolvedEvent(calendar)
    if (!pending) { st.advanceToNextWeek(); weeksTicked++; continue }
    if (player.injury) { st.resolveCurrentEvent(); continue }

    if (pending.type === 'training') {
      const session = generateSession(player)
      let xpEarned = 0
      for (const drill of session.drills) {
        const decision = drillToDecision(player, session)
        const opt = decision.options[Math.floor(rand() * decision.options.length)]
        const success = rand() < opt.successChance
        xpEarned += trainingXpForDrill(gradeFromRatio(success ? 0.7 : 0.3))
        void drill
      }
      const attrs = SESSION_ATTRIBUTES[session.type] ?? []
      if (attrs.length > 0 && xpEarned > 0) {
        const share = xpEarned / attrs.length
        for (const attr of attrs) st.spendAttributeXp(attr, share)
      }
      st.resolveCurrentEvent()
      continue
    }

    if (pending.type === 'school') {
      const relPick = rand() < 0.55 ? pickRelationshipEvent(player, calendar.currentWeek.weekNumber, player.recentLifeEvents ?? []) : null
      const d = relPick ? relPick.decision : pickLifeEvent(buildLifeContext(player, calendar.currentWeek.weekNumber), player.recentLifeEvents ?? []).decision
      st.noteLifeEvent(relPick ? `${relPick.event.key}:${relPick.person.id}` : 'gen')
      const chosen = d.options[Math.floor(rand() * d.options.length)]
      const success = rand() < chosen.successChance
      st.applyDecisionResult({ chosen, success, effect: (success ? chosen.onSuccess : chosen.onFailure) ?? {} }, d.relationshipId)
      continue
    }

    if (pending.type === 'match') {
      const phase = player.careerClock.phase
      const isInAcademy = phase === 'academy'

      if (pending.title === 'international duty') {
        const intl = st.international
        const fx = intl ? nationFixture(intl) : null
        if (!intl || !fx) { st.resolveCurrentEvent(); continue }
        const byId = internationalTeamById(intl)
        const nationHome = fx.homeTeamId === intl.nationTeamId
        const opp = byId.get(nationHome ? fx.awayTeamId : fx.homeTeamId)!
        const m = fakeMatch(player.position)
        const shootout = intl.stage === 'finals' && m.ps === m.os ? rand() < 0.55 : undefined
        st.applyMatchResult(m.rating, m.goals, m.assists, 60, null, opp.id, m.ps, m.os, nationHome, undefined, opp.name, 'international', shootout, undefined, m.stats)
        seasonGoals += m.goals; seasonAssists += m.assists; seasonApps++; seasonRatingSum += m.rating
        intlCaps++; intlGoals += m.goals; intlAssists += m.assists
        earnRealMatchXp('international', m.rating, m.goals, m.assists, st, player)
        continue
      }

      const comp = activeCompetitionForWeek(calendar.currentWeek.weekNumber, phase, player.grassrootsPath)
      if (!comp) { st.resolveCurrentEvent(); continue }

      const m = fakeMatch(player.position)
      const tier: CompetitionTier = comp.competitionId.toLowerCase().includes('cup') ? 'cup' : isInAcademy ? 'academy' : 'grassroots'
      st.applyMatchResult(m.rating, m.goals, m.assists, 60, null, 'opp', m.ps, m.os, true, undefined, 'Opponent', comp.competitionId, undefined, undefined, m.stats)
      seasonGoals += m.goals; seasonAssists += m.assists; seasonApps++; seasonRatingSum += m.rating
      earnRealMatchXp(tier, m.rating, m.goals, m.assists, st, player)
      continue
    }

    st.claimWeeklyReward()
    st.resolveCurrentEvent()
  }
  closeSeasonSnapshot()

  const final = s().player!
  return {
    label: cfg.label, position: cfg.position, startOvr, startRole,
    finalOvr: toOvr(computeCurrentAbility(final)),
    seasons, turnedProWeek, turnedProClub, academySignedWeek,
    career: final.career, coachTrust: final.coachTrust, reputation: final.reputation,
    intlCaps, intlGoals, intlAssists,
    standing: final.standing, relationships: final.relationships?.length ?? 0,
    achievements: final.achievements?.length ?? 0,
    money: final.money,
  }
}

async function main() {
  const configs: CareerConfig[] = [
    { label: 'Alex (ST, strong trial)', position: 'ST', trialQuality: 0.85, seed: 101 },
    { label: 'Sam (GK, mid trial)', position: 'GK', trialQuality: 0.5, seed: 202 },
    { label: 'Jordan (CM, weak trial)', position: 'CM', trialQuality: 0.25, seed: 303 },
    { label: 'Casey (CB, strong trial)', position: 'CB', trialQuality: 0.75, seed: 404 },
  ]

  for (const cfg of configs) {
    const r = await runCareer(cfg)
    console.log('\n' + '='.repeat(70))
    console.log(`${r.label} — started as ${r.position}`)
    console.log('='.repeat(70))
    console.log(`Trial result: ${r.startRole} · starting OVR ${r.startOvr}`)
    console.log(`Final OVR after ${SEASONS} years: ${r.finalOvr}`)
    console.log(`Academy signed: ${r.academySignedWeek !== null ? `week ${r.academySignedWeek}` : 'never'}`)
    console.log(`Turned professional: ${r.turnedProWeek !== null ? `week ${r.turnedProWeek} (${r.turnedProClub})` : 'not yet'}`)
    console.log(`\nSeason-by-season:`)
    for (const sn of r.seasons) {
      console.log(`  S${sn.season} [${sn.phase}] — ${sn.appearances} apps, ${sn.goals}G ${sn.assists}A, avg rating ${sn.avgRating || 'n/a'}, OVR ${sn.ovrAtEnd}, reputation ${sn.reputationAtEnd}`)
    }
    console.log(`\nInternational duty (eligible at OVR ≥ 58, then picked per-fixture on recent form ≥ 7.0): ${r.intlCaps} caps, ${r.intlGoals}G ${r.intlAssists}A`)
    console.log(`\nCareer totals: ${r.career.appearances} apps, ${r.career.goals}G ${r.career.assists}A, ${r.career.wins}W, ${r.career.motmAwards} MOTM`)
    console.log(`Defensive/creative output — tackles ${r.career.tacklesWon}, interceptions ${r.career.interceptions}, headers won ${r.career.headersWon}, key passes ${r.career.keyPasses}, saves ${r.career.saves}, clean sheets ${r.career.cleanSheets}`)
    console.log(`Coach trust: ${(r.coachTrust ?? 0).toFixed(1)} · Reputation: ${(r.reputation ?? 0).toFixed(0)} · Standing — teammates ${r.standing?.teammates ?? 0}, fans ${r.standing?.fans ?? 0}`)
    console.log(`Relationships tracked: ${r.relationships} · Achievements unlocked: ${r.achievements} · Money: £${r.money ?? 0}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
