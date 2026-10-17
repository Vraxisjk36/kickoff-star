// AUDIT 7 (P31) — chance pacing, commentary coverage, team selection.
//
// Every check here exists because real play surfaced the problem first:
//   "I only get one chance and that's always at the 90+ minute"
//   "why does it only start getting alive when I come onto the field"
//   "I began my career on the bench, is there a way into the starting lineup?"
//   "the commentary is just basic, there's way too limited lines"
import { reseed, rand } from '../src/engine/rng'
import { initMatch, advanceToKeyMoment, resolvePlayerMoment, resolveScenarioBeat, resolveInjuryDecision } from '../src/engine/match'
import { generateTeam } from '../src/engine/teams'
import { generateSquad } from '../src/engine/squad'
import { decideSelection, selectionScore, selectionAdvice } from '../src/engine/selection'
import { targetMomentsPer90, pacingPressure, pacedInvolvement, shouldPromoteHalfChance } from '../src/engine/chancePacing'
import { createCommentator, type CommentaryKind } from '../src/engine/commentary'
import { miniGameForDrill, generateSession } from '../src/engine/training'
import { momentToDecision } from '../src/engine/matchDecisions'
import type { Player } from '../src/types/player'

reseed(31031)
let fails = 0
const check = (c: boolean, m: string) => { if (!c) { fails++; console.error('  ✗', m) } else console.log('  ✓', m) }

function mk(role: string, pos = 'ST', over: Partial<Player> = {}): Player {
  const values: Record<string, number> = {}
  for (const k of ['finishing', 'passing', 'dribbling', 'firstTouch', 'pace', 'strength', 'stamina', 'agility', 'vision', 'composure', 'positioning', 'concentration']) values[k] = 11
  for (const k of ['reflexes', 'handling', 'gkPositioning', 'distribution']) values[k] = 11
  return {
    name: 'Test Player', position: pos, potential: 16,
    attributes: { kind: pos === 'GK' ? 'goalkeeper' : 'outfield', values },
    confidence: { value: 0, baseline: 0 }, fitness: { stamina: 80 },
    careerClock: { ageYears: 16, phase: 'grassroots-season', grassrootsSeason: 1 },
    matchRatings: [7, 7, 7], career: { goals: 3, assists: 2, appearances: 12, wins: 5, cleanSheets: 0, bestRating: 8, motmAwards: 1 },
    coachTrust: 1, reputation: 25, scoutWatchers: [], contractOffers: [], totalWeeksElapsed: 20,
    squadRole: role, recentInjuryCount: 0, injury: null, squad: generateSquad(4),
    ...over,
  } as unknown as Player
}

function playMatch(player: Player) {
  const team = generateTeam(4), opp = generateTeam(4)
  let s = initMatch(player, team, opp, true)
  const moments: number[] = []
  let guard = 0
  while (!s.finished && guard++ < 400) {
    const r = advanceToKeyMoment(s, player)
    s = r.state
    if (r.keyMoment) {
      moments.push(s.minute)
      // P38: a scenario moment carries persistent state (activeScenario) that
      // must be resolved before the clock can move on — exactly like the real
      // UI, which pauses its auto-tick while a moment is pending and can only
      // resume once the player has actually chosen. Peeking at a moment
      // without resolving it (the old pattern here) was harmless for
      // single-shot moments, which carry no persistent state, but leaves a
      // scenario permanently stuck re-returning the same beat forever.
      const bundle = momentToDecision(player, r.keyMoment, 'test')
      const success = rand() < bundle.decision.options[0].successChance
      s = r.keyMoment.scenarioId
        ? resolveScenarioBeat(s, r.keyMoment, 0, bundle.rewards[0] / bundle.maxReward, success, bundle.rewards[0], bundle.maxReward, null)
        : r.keyMoment.isInjuryDecision
        ? resolveInjuryDecision(s, true, player) // play through — keeps testing pacing for an on-pitch starter rather than ending their match early
        : resolvePlayerMoment(s, r.keyMoment, 0.5, success, bundle.rewards[0], bundle.maxReward, false, null)
      s = { ...s, drivesSinceInvolved: 0 }
    }
  }
  return { moments, events: s.events, entry: s.entryMinute, full: 90 + s.addedTime }
}

// ---------------------------------------------------------------------------
console.log('\n[A] CHANCES — the reported bug: one chance, always at 90+')
{
  const RUNS = 60
  for (const pos of ['ST', 'CM', 'CB', 'GK']) {
    const results = Array.from({ length: RUNS }, () => playMatch(mk('starting-xi', pos)))
    const avg = results.reduce((a, r) => a + r.moments.length, 0) / RUNS
    const all = results.flatMap((r) => r.moments)
    const late = all.filter((m) => m >= 88).length / Math.max(1, all.length)
    const firstHalf = all.filter((m) => m <= 45).length / Math.max(1, all.length)
    const target = targetMomentsPer90(mk('starting-xi', pos))
    console.log(`    ${pos}: ${avg.toFixed(2)} moments/match (target ~${target}) · ${(late * 100).toFixed(0)}% at 88'+ · ${(firstHalf * 100).toFixed(0)}% in the first half`)

    check(avg >= target * 0.55, `${pos}: gets a playable number of moments (${avg.toFixed(2)} vs target ${target})`)
    check(late < 0.2, `${pos}: moments are NOT dumped into stoppage time (${(late * 100).toFixed(0)}% at 88'+)`)
    check(firstHalf > 0.25, `${pos}: involvement genuinely starts in the first half (${(firstHalf * 100).toFixed(0)}%)`)
    check(results.filter((r) => r.moments.length === 0).length / RUNS < 0.1, `${pos}: almost never a match with zero involvement`)
  }
}

// ---------------------------------------------------------------------------
console.log('\n[B] substitutes get involved quickly, not at the death')
{
  const RUNS = 60
  const results = Array.from({ length: RUNS }, () => playMatch(mk('bench')))
  const all = results.flatMap((r) => r.moments)
  const avg = results.reduce((a, r) => a + r.moments.length, 0) / RUNS
  // minutes between coming on and first involvement
  const waits = results.filter((r) => r.moments.length > 0).map((r) => r.moments[0] - r.entry)
  const avgWait = waits.reduce((a, b) => a + b, 0) / Math.max(1, waits.length)
  const late = all.filter((m) => m >= 88).length / Math.max(1, all.length)
  console.log(`    sub: ${avg.toFixed(2)} moments · first touch ${avgWait.toFixed(0)} min after coming on · ${(late * 100).toFixed(0)}% at 88'+`)
  check(avg >= 1, `a substitute gets real involvement (${avg.toFixed(2)})`)
  check(avgWait < 18, `and gets into the game quickly (${avgWait.toFixed(0)} min after entering)`)
  check(late < 0.45, `not everything arrives in stoppage time (${(late * 100).toFixed(0)}%)`)
}

// ---------------------------------------------------------------------------
console.log('\n[C] COMMENTARY — the feed must be alive, on the pitch or not')
{
  const starter = Array.from({ length: 30 }, () => playMatch(mk('starting-xi')))
  const sub = Array.from({ length: 30 }, () => playMatch(mk('bench')))
  const avgStarter = starter.reduce((a, r) => a + r.events.length, 0) / 30
  const avgSub = sub.reduce((a, r) => a + r.events.length, 0) / 30

  // events BEFORE a substitute comes on — this was literally zero
  const preEntry = sub.reduce((a, r) => a + r.events.filter((e) => e.minute < r.entry).length, 0) / 30
  console.log(`    starter ${avgStarter.toFixed(0)} events/match · sub ${avgSub.toFixed(0)} · ${preEntry.toFixed(0)} of the sub's arrive BEFORE they come on`)

  check(avgStarter >= 16, `a match is properly narrated (${avgStarter.toFixed(0)} events)`)
  check(preEntry >= 5, `the match is narrated while you're on the BENCH (${preEntry.toFixed(0)} events before coming on) — was 0`)

  // repetition: a single match must not exhaust a bank
  const feed = starter[0].events.map((e) => e.text)
  const dupes = feed.length - new Set(feed).size
  console.log(`    ${dupes} repeated lines within a single match feed of ${feed.length}`)
  check(dupes <= 2, `commentary does not visibly repeat within one match (${dupes} dupes)`)

  // bank depth — measured by drawing many lines and counting distinct output
  const kinds: CommentaryKind[] = ['ambient', 'bench', 'sidelined', 'near-miss']
  for (const kind of kinds) {
    const c = createCommentator()
    const seen = new Set<string>()
    for (let i = 0; i < 400; i++) {
      seen.add(c.line(kind, { player: 'Smith', team: 'ABC', opp: 'XYZ', minute: 10 + (i % 80), diff: (i % 5) - 2, momentum: (i % 11) - 5 }))
    }
    console.log(`    ${kind}: ${seen.size} distinct lines reachable`)
    check(seen.size >= (kind === 'ambient' ? 25 : 8), `${kind} bank is deep enough (${seen.size})`)
  }
}

// ---------------------------------------------------------------------------
console.log('\n[D] SELECTION — there is now a path off the bench')
{
  const weakSquad = generateSquad(3)
  const strongSquad = generateSquad(7)

  // A player who improves must eventually be picked.
  const progression = [
    { trust: -3, form: 5.0 }, { trust: 0, form: 6.0 }, { trust: 3, form: 7.0 }, { trust: 6, form: 7.8 }, { trust: 9, form: 8.5 },
  ]
  const rolesWeak = progression.map((p) =>
    decideSelection(mk('bench', 'ST', { coachTrust: p.trust, matchRatings: Array(5).fill(p.form), squadRoleSetAppearances: 9 } as Partial<Player>), weakSquad).role)
  console.log(`    grassroots squad: ${rolesWeak.join(' → ')}`)
  check(rolesWeak[rolesWeak.length - 1] === 'starting-xi', 'improving gets you into the starting XI')
  check(rolesWeak[0] !== 'starting-xi', 'a poor player does not start')
  check(decideSelection(mk('reserves', 'ST', { coachTrust: 10, matchRatings: [], squadRoleSetAppearances: 12 }), weakSquad).role === 'reserves', 'training and trust cannot promote a reserve with zero matches')
  check(decideSelection(mk('reserves', 'ST', { coachTrust: 10, matchRatings: [7, 7], squadRoleSetAppearances: 10 }), weakSquad).role === 'bench', 'two good reserve matches earn a bench opportunity, not an instant start')

  // Scores must be monotonic in the things a player can control.
  const scores = progression.map((p) =>
    selectionScore(mk('bench', 'ST', { coachTrust: p.trust, matchRatings: Array(5).fill(p.form) } as Partial<Player>)))
  check(scores.every((v, i) => i === 0 || v >= scores[i - 1]), `selection score rises monotonically with trust and form (${scores.join(', ')})`)

  // Better squads are harder to break into — this is what makes signing for a
  // big academy a real decision rather than a free upgrade.
  const eliteRole = decideSelection(mk('bench', 'ST', { coachTrust: 3, matchRatings: Array(5).fill(7.0) } as Partial<Player>), strongSquad).role
  const weakRole = decideSelection(mk('bench', 'ST', { coachTrust: 3, matchRatings: Array(5).fill(7.0) } as Partial<Player>), weakSquad).role
  console.log(`    same player: ${weakRole} at a small club, ${eliteRole} at a strong academy`)
  check(!(eliteRole === 'starting-xi' && weakRole !== 'starting-xi'), 'a strong squad is never EASIER to break into')

  // Hysteresis: a player hovering at a rival's level must not flip every week.
  let flips = 0
  let role: string = 'bench'
  for (let w = 0; w < 40; w++) {
    const jitter = (w % 2 === 0 ? 0.15 : -0.15)
    const p = mk(role, 'ST', { coachTrust: 2, matchRatings: Array(5).fill(6.9 + jitter) } as Partial<Player>)
    const v = decideSelection(p, weakSquad)
    if (v.role !== role) flips++
    role = v.role
  }
  console.log(`    a player hovering at the cutoff changed role ${flips} times in 40 weeks`)
  check(flips <= 4, `selection is sticky — no week-to-week flip-flopping (${flips} changes)`)

  // Advice must always say something actionable.
  for (const p of progression) {
    const player = mk('bench', 'ST', { coachTrust: p.trust, matchRatings: Array(5).fill(p.form) } as Partial<Player>)
    const advice = selectionAdvice(decideSelection(player, weakSquad), player)
    check(advice.length > 10, `advice given at trust ${p.trust}: "${advice}"`)
  }
}

// ---------------------------------------------------------------------------
console.log('\n[E] pacing maths behaves at the edges')
{
  const p = mk('starting-xi')
  check(pacedInvolvement(0.5, 0.3) < 0.5, 'just-involved players are damped')
  check(pacedInvolvement(0.5, 1) === 0.5, 'on-pace is unchanged')
  check(pacedInvolvement(0.5, 3) > 0.5 && pacedInvolvement(0.5, 3) <= 0.96, 'starved players are favoured but never guaranteed')
  check(pacedInvolvement(0.9, 10) <= 0.96, 'involvement never reaches certainty')
  check(!shouldPromoteHalfChance(1.0) && shouldPromoteHalfChance(2.0), 'half-chance promotion only kicks in when genuinely starved')
  const pressureEarly = pacingPressure(p, 12, 5, 0, 91, { lastMomentMinute: 0, momentsSoFar: 0 })
  const pressureLate = pacingPressure(p, 12, 60, 0, 91, { lastMomentMinute: 0, momentsSoFar: 0 })
  check(pressureLate > pressureEarly, 'pressure builds the longer you go without a touch')
  check(Number.isFinite(pacingPressure(p, 12, 90, 89, 91, { lastMomentMinute: 89, momentsSoFar: 0 })), 'no divide-by-zero for a 1-minute cameo')
}

// ---------------------------------------------------------------------------
console.log('\n[F] TRAINING variety')
{
  const p = mk('starting-xi')
  const session = generateSession(p)
  const kinds = session.drills.map((_, i) => miniGameForDrill(session, i))
  const miniCount = kinds.filter(Boolean).length
  console.log(`    a session of ${session.drills.length} drills contains ${miniCount} mini-games and ${session.drills.length - miniCount} decisions`)
  check(miniCount > 0, 'sessions contain mini-games')
  check(miniCount < session.drills.length, 'sessions still contain decisions — variety, not replacement')
  // deterministic: the same drill must not switch interaction mid-render
  check(kinds.every((k, i) => miniGameForDrill(session, i) === k), 'mini-game choice is stable for a given drill')
  // GK sessions must still work
  const gk = mk('starting-xi', 'GK')
  const gkSession = generateSession(gk)
  check(gkSession.drills.every((_, i) => miniGameForDrill(gkSession, i) !== undefined), 'goalkeeper sessions resolve an interaction for every drill')
}

console.log(fails === 0 ? '\n✅ AUDIT 7 PASSED' : `\n❌ AUDIT 7: ${fails} CHECK(S) FAILED`)
process.exit(fails ? 1 : 0)
