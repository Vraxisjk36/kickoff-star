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
  for (const k of ['finishing', 'passing', 'dribbling', 'firstTouch', 'pace', 'strength', 'stamina', 'agility', 'vision', 'composure', 'positioning', 'concentration']) values[k] = 11
  return {
    name: 'Sim Player', surname: 'Player', position: (process.env.FORCE_GK === '1' ? 'GK' : 'ST') as 'GK' | 'ST', foot: 'right', potential: 18,
    attributes: { values } as Player['attributes'],
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
function fakeMatch(): { rating: number; goals: number; assists: number; ps: number; os: number } {
  const goals = rand() < 0.35 ? 1 : rand() < 0.1 ? 2 : 0
  const assists = rand() < 0.25 ? 1 : 0
  const ps = goals + (rand() < 0.5 ? 1 : 0)
  const os = rand() < 0.4 ? 0 : rand() < 0.7 ? 1 : 2
  const rating = Math.min(10, 6 + goals * 0.9 + assists * 0.5 + (rand() - 0.3))
  return { rating: Math.round(rating * 10) / 10, goals, assists, ps, os }
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

  // Stop EXACTLY at the requested season boundary — overrunning into season
  // N+1 pollutes the per-season tallies the assertions check.
  const maxWeeks = SEASONS * SEASON_WEEKS
  while (weeksTicked < maxWeeks) {
    const st = s()
    const { player, calendar } = st
    if (!player || !calendar) break
    if (player.careerEnded || player.turnedPro) break

    if (forceSunday && st.league && !hasSundayContract(player, calendar.currentWeek.seasonYear, st.league)) {
      const renewal = player.contractOffers.find(o => o.kind === 'club' && o.contractSeason === calendar.currentWeek.seasonYear)
      if (renewal && calendar.currentWeek.weekNumber === 1) {
        st.respondToOffer(renewal.id, true)
        assert(hasSundayContract(s().player!, calendar.currentWeek.seasonYear, s().league), `season ${calendar.currentWeek.seasonYear} club contract signed`)
        continue
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
      if (neg.awaitingPlayer) {
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
      st.advanceToNextWeek()
      weeksTicked++
      continue
    }
    if (pending.title === 'October development fixture') octoberWindows++
    if (player.injury) { st.resolveCurrentEvent(); continue }

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
        const m = fakeMatch()
        const shootout = intl.stage === 'finals' && m.ps === m.os ? rand() < 0.55 : undefined
        st.applyMatchResult(m.rating, m.goals, m.assists, 60, null, opp.id, m.ps, m.os, nationHome, undefined, opp.name, 'international', shootout)
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
        const m = fakeMatch()
        st.applyMatchResult(m.rating, m.goals, m.assists, 60, null, opponent.id, m.ps, m.os, home, undefined, opponent.name, 'octoberDevelopment')
        tallies.octoberDevelopment = (tallies.octoberDevelopment ?? 0) + 1
        continue
      }

      const comp = activeCompetitionForWeek(calendar.currentWeek.weekNumber, phase, player.grassrootsPath, Boolean(st.cups.schoolDevelopment))
      if (!comp) { deadMatchdays++; st.resolveCurrentEvent(); continue }

      if (comp.competitionId === 'sundayLeague' || comp.competitionId === 'schoolLeague') {
        const division = (world!.divisions as Record<number, import('../src/engine/league').Division>)[world!.playerDivision]
        const fixture = division.fixtures
          .filter((f) => !f.played && f.week <= comp.round && (f.homeTeamId === world!.playerTeamId || f.awayTeamId === world!.playerTeamId))
          .sort((a, b) => a.week - b.week)[0]
        if (!fixture) { tallies['league:trainingFallback'] = (tallies['league:trainingFallback'] ?? 0) + 1; st.resolveCurrentEvent(); continue }
        const isHome = fixture.homeTeamId === world!.playerTeamId
        const opp = division.teams.find((t) => t.id === (isHome ? fixture.awayTeamId : fixture.homeTeamId))!
        const m = fakeMatch()
        st.applyMatchResult(m.rating, m.goals, m.assists, 60, null, opp.id, m.ps, m.os, isHome, undefined, opp.name, comp.competitionId)
        tallies[comp.competitionId] = (tallies[comp.competitionId] ?? 0) + 1
        continue
      }

      if (comp.competitionId === 'schoolFriendlies') {
        const opp = generateTeam(3)
        const m = fakeMatch()
        st.applyMatchResult(m.rating, m.goals, m.assists, 60, null, opp.id, m.ps, m.os, rand() < 0.5, undefined, opp.name, 'schoolFriendlies')
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
      const m = fakeMatch()
      const isKnockout = cupWorld.stage === 'knockout'
      const shootout = isKnockout && m.ps === m.os ? rand() < 0.55 : undefined
      st.applyMatchResult(m.rating, m.goals, m.assists, 60, null, opp.id, m.ps, m.os, isHome, undefined, opp.name, comp.competitionId, shootout)
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
  console.log('\n=== CAREER SIM COMPLETE ===')
  console.log('weeks ticked:', weeksTicked, '| seasons:', Math.floor(weeksTicked / SEASON_WEEKS))
  console.log('matches by competition:', tallies)
  console.log('career appearances:', player.career?.appearances, '| dead matchdays:', deadMatchdays)
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
  assert(deadMatchdays === 0, `dead matchdays should be 0, got ${deadMatchdays}`)
  if (!forceAcademy) {
    // A mid-window transfer can blank a fixture when the new club's round
    // has already been played; count that as a training fallback.
    const leaguePlayed = (tallies['schoolLeague'] ?? 0) + (tallies['sundayLeague'] ?? 0)
    const leagueBlanks = tallies['league:trainingFallback'] ?? 0
    if (forceSunday || forceTransfer) {
      assert(leaguePlayed + leagueBlanks >= 22 * perSeason - 3 && leaguePlayed + leagueBlanks <= 22 * perSeason, `league matches+blanks should cover the schedule, got ${leaguePlayed}+${leagueBlanks}`)
    } else {
      assert(leaguePlayed === 18 * perSeason, `school league matches should be ${18 * perSeason}, got ${leaguePlayed}`)
    }
  }
  if (!forceAcademy) {
    assert((tallies['schoolFriendlies'] ?? 0) === (forceSunday ? 0 : 2 * perSeason), `route friendlies should be ${forceSunday ? 0 : 2 * perSeason}, got ${tallies['schoolFriendlies']}`)
    const cupMatches = (tallies['schoolCup'] ?? 0) + (tallies['schoolDevelopment'] ?? 0) + (tallies['sundayCup'] ?? 0)
    assert(cupMatches >= perSeason, `the route's cup or development competition should remain reachable, got ${cupMatches}`)
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
  } else {
    const academyCupMatches = (tallies['academyLeagueCup'] ?? 0) + (tallies['academyKnockoutCup'] ?? 0)
    assert(academyCupMatches >= 4, `academy cup matches should appear after transition, got ${academyCupMatches}`)
    assert(s().player!.careerClock.phase === 'academy', 'player should be in academy phase')
  }
  if (forceIntl) {
    assert(intlMatches >= 3, `international matches should be played after call-up, got ${intlMatches}`)
    assert((tallies['international'] ?? 0) === intlMatches, 'international tally consistent')
  }
  const total = Object.entries(tallies).filter(([k]) => !k.includes(':')).reduce((a, [, v]) => a + v, 0)
  if (!forceAcademy) assert(total >= 22 * perSeason, `school pathway should provide at least 22 matches/season, got ${(total / perSeason).toFixed(1)}/season`)
  if (process.env.FORCE_GK === '1') {
    assert((player.career?.cleanSheets ?? 0) > 0, `GK should bank clean sheets over ${total} matches, got ${player.career?.cleanSheets}`)
  } else {
    // Outfield player: the GK-only clean-sheet fix means an ST must bank ZERO
    assert((player.career?.cleanSheets ?? 0) === 0, `outfield player cleanSheets must be 0 (GK-only stat), got ${player.career?.cleanSheets}`)
  }
  assert(player.career!.appearances === total, `career appearances (${player.career!.appearances}) should equal playable matches recorded (${total})`)
  if (forceTransfer) assert((s().player!.squadRole) === 'bench' || (s().player!.career!.appearances ?? 0) > 0, 'transfer leaves a playable state')
  // league integrity at the end of a completed season boundary is checked live below

  // standings sync: at any mid-season point everyone should have played the
  // same round count (checked continuously would be better; here we verify the
  // invariant that the player's team is never >1 round ahead of the field —
  // re-run a fresh short sim with a probe)
  // ---- P28: relationships + storyline arcs, at STORE level ----
  // Engine-level sims can't catch wiring bugs (the P25 lesson), so these
  // assertions run against whatever the real store actually produced.
  const rels = player.relationships ?? []
  assert(rels.length >= 7, `cast persisted through the career (${rels.length} people)`)
  assert(rels.every((r) => Number.isFinite(r.bond) && r.bond >= -100 && r.bond <= 100), 'all bonds finite and in range after a full career')
  assert(new Set(rels.map((r) => r.id)).size === rels.length, 'no duplicate people in the cast')
  const drifted = rels.some((r) => r.bond !== Math.round(r.bond) || r.weeksSinceContact > 0)
  assert(drifted, 'relationship drift actually ran during the career')
  const arcsSeen = (player.recentArcKeys ?? []).length
  assert(arcsSeen > 0, `storyline arcs opened AND resolved through the store (${arcsSeen} resolved)`)
  assert((player.activeArcs ?? []).length <= 2, `never more than 2 live arcs (${(player.activeArcs ?? []).length})`)
  assert((player.activeArcs ?? []).every((a) => a.deadlineWeek > a.startedWeek), 'live arcs have sane deadlines')
  console.log('relationships:', rels.length, '| arcs resolved:', arcsSeen, '| live arcs:', (player.activeArcs ?? []).length,
    '| avg bond:', (rels.reduce((a, r) => a + r.bond, 0) / rels.length).toFixed(1))

  // ---- P29: economy + sub appearances, at STORE level ----
  assert((player.money ?? 0) >= 0, `money never goes negative (${player.money})`)
  assert(Number.isFinite(player.money ?? 0), 'money stays finite')
  assert((player.equipment ?? []).every((e) => e.weeksRemaining > 0), 'no expired equipment lingers')
  assert((player.equipment ?? []).length <= 4, `equipment bounded by slots (${(player.equipment ?? []).length})`)
  const consumableCounts = Object.values(player.consumables ?? {})
  assert(consumableCounts.every((n) => n >= 0), 'consumable counts never negative')
  console.log('money:', player.money, '| equipment:', (player.equipment ?? []).length, '| allowance:', monthlyAllowance(player))
  // Money must have real sinks: a player who actually buys kit should not be
  // sitting on a fortune by the end of a career.
  assert((player.money ?? 0) < 1200, `money stays spendable rather than piling up (£${player.money})`)

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
  const before = { cups: st.cups, international: st.international, octoberLeague: st.player?.octoberLeague }
  await st.loadFromSlot(0)
  const after = useCareerStore.getState()
  assert(JSON.stringify(after.cups) === JSON.stringify(before.cups), 'cups must roundtrip through save/load')
  assert(JSON.stringify(after.international) === JSON.stringify(before.international), 'international world must roundtrip through save/load')
  assert(JSON.stringify(after.player?.octoberLeague) === JSON.stringify(before.octoberLeague), 'October league table and fixtures must roundtrip through save/load')
  assert(after.player?.career?.appearances === player.career?.appearances, 'career totals must roundtrip')
  assert(JSON.stringify(after.player?.relationships) === JSON.stringify(player.relationships), 'relationships must roundtrip through save/load')
  assert(JSON.stringify(after.player?.activeArcs) === JSON.stringify(player.activeArcs), 'live storyline arcs must roundtrip through save/load')
  assert(after.player?.money === player.money, 'money must roundtrip through save/load')
  assert(after.player?.agentId === player.agentId, 'agent must roundtrip through save/load')
  assert(JSON.stringify(after.player?.contract) === JSON.stringify(player.contract), 'contract must roundtrip through save/load')
  assert(JSON.stringify(after.player?.negotiation) === JSON.stringify(player.negotiation), 'live negotiation must roundtrip through save/load')
  assert(JSON.stringify(after.player?.equipment) === JSON.stringify(player.equipment), 'equipment must roundtrip through save/load')

  console.log(failures === 0 ? '\n✅ ALL ASSERTIONS PASSED' : `\n❌ ${failures} ASSERTION(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}

void main()


function formatWage(p: import('../src/types/player').Player): string {
  if (!p.contract) return '—'
  return `£${p.contract.terms.weeklyWage}/wk gross, £${netWage(p.contract.terms.weeklyWage, p.agentId)}/wk net`
}
