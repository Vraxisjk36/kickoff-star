// AUDIT 14 (P38) — branching match scenarios: the architecture that lets a
// key moment continue into another key moment instead of resolving in one
// shot ("halfway line — run at goal — into the box — shoot or square it").
//
// This checks: every scenario is structurally sound (no dangling beats), a
// full drive-based match can actually enter and complete a multi-beat chain
// end to end, rating/goals/momentum only apply on the TERMINAL beat (never
// double-counted across a chain), a dropped/interrupted scenario can never
// strand the match, and single-shot moments (the ~60% that don't roll into a
// scenario) are completely unaffected.
import { reseed, rand } from '../src/engine/rng'
import { SCENARIOS, validateScenario, scenariosFor } from '../src/engine/matchScenarios'
import { initMatch, advanceToKeyMoment, resolveScenarioBeat, resolvePlayerMoment, resolveInjuryDecision } from '../src/engine/match'
import { momentToDecision } from '../src/engine/matchDecisions'
import { generateTeam } from '../src/engine/teams'
import { generateSquad } from '../src/engine/squad'
import type { Player } from '../src/types/player'

reseed(38038)
let fails = 0
const check = (c: boolean, m: string) => { if (!c) { fails++; console.error('  ✗', m) } else console.log('  ✓', m) }

function mk(pos = 'ST', over: Partial<Player> = {}): Player {
  const v: Record<string, number> = {}
  for (const k of ['finishing', 'passing', 'dribbling', 'firstTouch', 'pace', 'strength', 'stamina', 'agility', 'vision', 'composure', 'positioning', 'concentration']) v[k] = 12
  for (const k of ['reflexes', 'handling', 'gkPositioning', 'distribution']) v[k] = 12
  return {
    name: 'Test Player', position: pos, potential: 16, attributes: { kind: pos === 'GK' ? 'goalkeeper' : 'outfield', values: v },
    confidence: { value: 0, baseline: 0 }, fitness: { stamina: 80 },
    careerClock: { ageYears: 16, phase: 'grassroots-season', grassrootsSeason: 1 },
    matchRatings: [7, 7, 7], career: { goals: 3, assists: 2, appearances: 12, wins: 5, cleanSheets: 0, bestRating: 8, motmAwards: 1 },
    coachTrust: 1, reputation: 25, scoutWatchers: [], contractOffers: [], totalWeeksElapsed: 20,
    squadRole: 'starting-xi', recentInjuryCount: 0, injury: null, squad: generateSquad(4),
    ...over,
  } as unknown as Player
}

// ---------------------------------------------------------------------------
console.log('\n[A] every authored scenario is structurally sound')
{
  check(SCENARIOS.length >= 6, `at least 6 scenarios authored (got ${SCENARIOS.length})`)
  for (const s of SCENARIOS) {
    const problems = validateScenario(s)
    check(problems.length === 0, `${s.id}: no dangling beats or empty option lists${problems.length ? ` (${problems.join('; ')})` : ''}`)
  }
  check(new Set(SCENARIOS.map((s) => s.id)).size === SCENARIOS.length, 'scenario ids are unique')

  // multi-beat depth: the whole point is that this ISN'T single-shot
  const multiBeat = SCENARIOS.filter((s) => Object.keys(s.beats).length >= 2)
  check(multiBeat.length >= 4, `most scenarios have real depth — at least 2 beats (${multiBeat.length}/${SCENARIOS.length} do)`)

  // every beat must be REACHABLE from the entry beat (no orphaned beats
  // nobody can ever see)
  for (const s of SCENARIOS) {
    const reachable = new Set([s.entryBeatId])
    let grew = true
    while (grew) {
      grew = false
      for (const b of Object.values(s.beats)) {
        if (!reachable.has(b.id)) continue
        for (const o of b.options) {
          for (const outcome of [o.onSuccess, o.onFailure]) {
            if (outcome.kind === 'continue' && !reachable.has(outcome.beatId)) { reachable.add(outcome.beatId); grew = true }
          }
        }
      }
    }
    const orphans = Object.keys(s.beats).filter((id) => !reachable.has(id))
    check(orphans.length === 0, `${s.id}: every beat is reachable from the entry (orphans: ${orphans.join(', ') || 'none'})`)
  }
}

// ---------------------------------------------------------------------------
console.log('\n[B] every scenario terminates — no infinite continue loops')
{
  for (const s of SCENARIOS) {
    // walk every possible path (both success and failure at every choice) up
    // to a generous depth; if we ever exceed it, something loops forever
    let looped = false
    const walk = (beatId: string, depth: number) => {
      if (depth > 10) { looped = true; return }
      const b = s.beats[beatId]
      if (!b) return
      for (const o of b.options) {
        for (const outcome of [o.onSuccess, o.onFailure]) {
          if (outcome.kind === 'continue') walk(outcome.beatId, depth + 1)
        }
      }
    }
    walk(s.entryBeatId, 0)
    check(!looped, `${s.id}: every path terminates within a sane number of beats (no infinite loop)`)
  }
}

// ---------------------------------------------------------------------------
console.log('\n[C] scenarios can actually be entered and completed through a real match')
{
  const striker = mk('ST')
  let sawContinue = false
  let sawTerminal = false
  let sawMultiBeatPath = false

  for (let run = 0; run < 60 && !(sawContinue && sawMultiBeatPath); run++) {
    const team = generateTeam(4), opp = generateTeam(4)
    let s = initMatch(striker, team, opp, true)
    let guard = 0
    let beatsInThisScenario = 0
    while (!s.finished && guard++ < 400) {
      const r = advanceToKeyMoment(s, striker)
      s = r.state
      if (r.keyMoment?.scenarioId) {
        beatsInThisScenario++
        const bundle = momentToDecision(striker, r.keyMoment, 'test')
        // always pick the first option, alternate the "roll" so we see both continues and terminals
        const success = rand() < bundle.decision.options[0].successChance
        const next = resolveScenarioBeat(s, r.keyMoment, 0, bundle.rewards[0] / bundle.maxReward, success, bundle.rewards[0], bundle.maxReward, null)
        if (next.activeScenario) sawContinue = true
        else { sawTerminal = true; if (beatsInThisScenario > 1) sawMultiBeatPath = true; beatsInThisScenario = 0 }
        s = next
      } else if (r.keyMoment) {
        // single-shot moment — resolve trivially and move on
        const bundle = momentToDecision(striker, r.keyMoment, 'test')
        const success = rand() < bundle.decision.options[0].successChance
        s = resolvePlayerMoment(s, r.keyMoment, 0.5, success, bundle.rewards[0], bundle.maxReward, false, null)
      }
    }
  }
  check(sawContinue, 'a real match actually enters a scenario and continues past the first beat')
  check(sawTerminal, 'and scenarios actually terminate through real play (goal/save/miss)')
  check(sawMultiBeatPath, 'at least one real playthrough walked through 2+ beats before resolving — genuine multi-act play, not just entry+exit')
}

// ---------------------------------------------------------------------------
console.log('\n[D] a CONTINUE outcome never touches score, goals, or rating — only the terminal beat does')
{
  const p = mk('ST')
  const team = generateTeam(4), opp = generateTeam(4)
  const base = initMatch(p, team, opp, true)
  const enteringMoment = { tier: 'clear' as const, isDefensive: false, isDistribution: false, minute: 30, situation: 'x', scenarioId: 'halfway-carry', beatId: 'start' }

  // force the 'run at goal' success path (continue to 'box')
  let guard = 0
  let s = base
  let continued = false
  while (guard++ < 50) {
    const success = true // deterministic: keep forcing success to walk the 'happy path' continue chain
    const next = resolveScenarioBeat(s, guard === 1 ? enteringMoment : { ...enteringMoment, beatId: s.activeScenario!.beatId }, 0, 0.8, success, 2, 3, null)
    if (next.activeScenario) {
      check(next.playerGoals === base.playerGoals && next.playerAssists === base.playerAssists, `continue step ${guard}: no goal/assist credited mid-chain`)
      check(next.playerRating === base.playerRating, `continue step ${guard}: rating untouched mid-chain`)
      s = next
      continued = true
    } else {
      break
    }
  }
  check(continued, 'the happy-path walk actually produced at least one continue step to test')
}

// ---------------------------------------------------------------------------
console.log('\n[E] a dropped or dangling scenario reference can never strand the match')
{
  const p = mk('ST')
  const team = generateTeam(4), opp = generateTeam(4)
  const base = initMatch(p, team, opp, true)
  // simulate a corrupted/impossible reference — should degrade gracefully, never throw
  const badMoment = { tier: 'clear' as const, isDefensive: false, isDistribution: false, minute: 30, situation: 'x', scenarioId: 'does-not-exist', beatId: 'nope' }
  let safe = true
  let result
  try { result = resolveScenarioBeat(base, badMoment, 0, 0.5, true, 1, 3, null) } catch { safe = false }
  check(safe, 'resolving a nonexistent scenario/beat never throws')
  check(!!result && result.activeScenario === null, 'and it cleanly drops out of the (nonexistent) scenario rather than getting stuck')

  // a state with a dangling activeScenario, fed back into advanceToKeyMoment
  const dangling = { ...base, activeScenario: { scenarioId: 'ghost', beatId: 'ghost', tier: 'clear' as const } }
  let safe2 = true
  try { advanceToKeyMoment(dangling, p) } catch { safe2 = false }
  check(safe2, 'advanceToKeyMoment never throws on a dangling activeScenario reference — it drops out and resumes normal play')
}

// ---------------------------------------------------------------------------
console.log('\n[F] single-shot moments are completely unaffected — scenarios are additive, not a replacement')
{
  const striker = mk('ST')
  let sawSingleShot = false
  for (let run = 0; run < 30 && !sawSingleShot; run++) {
    const team = generateTeam(4), opp = generateTeam(4)
    let s = initMatch(striker, team, opp, true)
    let guard = 0
    while (!s.finished && guard++ < 400) {
      const r = advanceToKeyMoment(s, striker)
      s = r.state
      if (r.keyMoment && !r.keyMoment.scenarioId) { sawSingleShot = true; break }
      if (r.keyMoment) {
        const bundle = momentToDecision(striker, r.keyMoment, 'test')
        const success = rand() < bundle.decision.options[0].successChance
        s = r.keyMoment.scenarioId
          ? resolveScenarioBeat(s, r.keyMoment, 0, 0.5, success, bundle.rewards[0], bundle.maxReward, null)
          : resolvePlayerMoment(s, r.keyMoment, 0.5, success, bundle.rewards[0], bundle.maxReward, false, null)
      }
    }
  }
  check(sawSingleShot, 'plenty of moments still resolve as ordinary single-shot decisions (scenarios are ~40% of eligible chances, not all of them)')
}

// ---------------------------------------------------------------------------
console.log('\n[G] content scale — the combinatorial count Joel asked about')
{
  let totalBeats = 0, totalOptions = 0, totalDistinctPaths = 0
  for (const s of SCENARIOS) {
    totalBeats += Object.keys(s.beats).length
    for (const b of Object.values(s.beats)) totalOptions += b.options.length
    // count root-to-terminal paths (a rough combinatorial measure)
    const countPaths = (beatId: string): number => {
      const b = s.beats[beatId]
      if (!b) return 1
      let sum = 0
      for (const o of b.options) {
        for (const outcome of [o.onSuccess, o.onFailure]) {
          sum += outcome.kind === 'continue' ? countPaths(outcome.beatId) : 1
        }
      }
      return sum
    }
    totalDistinctPaths += countPaths(s.entryBeatId)
  }
  console.log(`    ${SCENARIOS.length} scenarios · ${totalBeats} authored beats · ${totalOptions} authored options · ${totalDistinctPaths} distinct success/failure paths through them`)
  check(totalDistinctPaths >= 40, `authored content already yields ${totalDistinctPaths} distinct playthrough paths from ${totalOptions} hand-written options — this is the combinatorial leverage the architecture exists for`)
}


// ---------------------------------------------------------------------------
console.log('\n[H] INJURY DECISIONS — real agency on a knock, not a zero-stakes aside')
{
  const fitPlayer = mk('ST', { fitness: { stamina: 90 }, recentInjuryCount: 0 } as Partial<Player>)
  const knackeredPlayer = mk('ST', { fitness: { stamina: 20 }, recentInjuryCount: 3 } as Partial<Player>)

  const team = generateTeam(4), opp = generateTeam(4)
  const freshBase = { ...initMatch(fitPlayer, team, opp, true), matchStamina: 90 }
  const tiredBase = { ...initMatch(knackeredPlayer, team, opp, true), matchStamina: 15 }

  // "ask to come off" is always deterministic and safe
  for (let i = 0; i < 30; i++) {
    const next = resolveInjuryDecision(freshBase, false, fitPlayer)
    check(next.substituted === true && next.onPitch === false && next.injury === null, 'asking to come off always subs the player safely, never escalates to a real injury')
  }

  // "play through it" carries a REAL, fatigue-scaled risk
  let freshAggravated = 0, tiredAggravated = 0
  const RUNS = 800
  for (let i = 0; i < RUNS; i++) {
    if (resolveInjuryDecision(freshBase, true, fitPlayer).injury) freshAggravated++
    if (resolveInjuryDecision(tiredBase, true, knackeredPlayer).injury) tiredAggravated++
  }
  console.log(`    play-through aggravation rate — fresh player ${(freshAggravated / RUNS * 100).toFixed(1)}% · exhausted/injury-prone ${(tiredAggravated / RUNS * 100).toFixed(1)}%`)
  check(freshAggravated > 0, 'even a fresh player carries some real risk playing through a knock')
  check(tiredAggravated > freshAggravated, 'a tired, injury-prone player is meaningfully more likely to aggravate it than a fresh one')
  check(tiredAggravated / RUNS < 0.6, 'but it never becomes a near-certainty — playing through is a genuine gamble, not a trap')

  // playing through it and NOT aggravating it keeps you on the pitch with no injury
  let sawCleanPlayThrough = false
  for (let i = 0; i < 100 && !sawCleanPlayThrough; i++) {
    const next = resolveInjuryDecision(freshBase, true, fitPlayer)
    if (!next.injury && next.onPitch && !next.substituted) sawCleanPlayThrough = true
  }
  check(sawCleanPlayThrough, 'playing through it successfully keeps the player on with no consequence at all')

  // the moment actually surfaces through a real match, not just the direct function
  let sawInjuryDecisionMoment = false
  // A knock is a genuinely rare compound event by design (the injury roll
  // must trigger AND land in the 'knock' severity band specifically) — 60
  // matches at moderate fatigue wasn't a reliable sample once the new
  // scenario/commentary content shifted the RNG sequence downstream. Widened
  // and pushed to near-maximum fatigue/injury-proneness, matching how other
  // rare-event checks in this codebase (e.g. audit8's ad-boost scenarios) use
  // a large enough sample that a real miss would mean something, not just bad luck.
  // Selection requires 50 energy to start. Force match stamina low after
  // kickoff to exercise the injury roll without making the player unavailable.
  const veryRiskyPlayer = mk('ST', { fitness: { stamina: 50 }, recentInjuryCount: 5 } as Partial<Player>)
  for (let run = 0; run < 250 && !sawInjuryDecisionMoment; run++) {
    const t = generateTeam(4), o = generateTeam(4)
    let s = { ...initMatch(veryRiskyPlayer, t, o, true), matchStamina: 8 }
    let guard = 0
    while (!s.finished && guard++ < 400) {
      const r = advanceToKeyMoment(s, veryRiskyPlayer)
      s = r.state
      if (r.keyMoment?.isInjuryDecision) { sawInjuryDecisionMoment = true; break }
      if (r.keyMoment) {
        const bundle = momentToDecision(veryRiskyPlayer, r.keyMoment, 'test')
        const success = rand() < bundle.decision.options[0].successChance
        s = r.keyMoment.scenarioId
          ? resolveScenarioBeat(s, r.keyMoment, 0, 0.5, success, bundle.rewards[0], bundle.maxReward, null)
          : r.keyMoment.isInjuryDecision
          ? resolveInjuryDecision(s, true, veryRiskyPlayer)
          : resolvePlayerMoment(s, r.keyMoment, 0.5, success, bundle.rewards[0], bundle.maxReward, false, null)
      }
    }
  }
  check(sawInjuryDecisionMoment, 'a real match, played out through the actual engine, can surface an injury decision')

  // the bundle for an injury decision is exactly 2 clear options, never attribute-flavoured
  const p2 = mk('ST')
  const decisionMoment = { tier: 'half' as const, isDefensive: false, isDistribution: false, isInjuryDecision: true, minute: 40, situation: 'test' }
  const bundle = momentToDecision(p2, decisionMoment, 'test')
  check(bundle.decision.options.length === 2, 'exactly 2 options: play through it, ask to come off')
  check(bundle.decision.options.some((o) => /play through/i.test(o.label)) && bundle.decision.options.some((o) => /come off/i.test(o.label)), 'both options are clearly labelled')
}


// ---------------------------------------------------------------------------
console.log('\n[J] SINGLE MOMENTS (P41) — the second content pool, one decision each')
{
  const { SINGLE_MOMENTS } = await import('../src/engine/matchScenarios')
  check(SINGLE_MOMENTS.length >= 60, `the full 60-single-moment target is met (got ${SINGLE_MOMENTS.length})`)
  check(SINGLE_MOMENTS.every((m) => Object.keys(m.beats).length === 1), 'every single moment really is exactly one beat — no accidental branching snuck in')
  check(SINGLE_MOMENTS.every((m) => {
    const b = Object.values(m.beats)[0]
    return b.options.every((o) => o.onSuccess.kind !== 'continue' && o.onFailure.kind !== 'continue')
  }), 'no single moment secretly continues to another beat — every option is genuinely terminal')
  check(new Set(SINGLE_MOMENTS.map((m) => m.id)).size === SINGLE_MOMENTS.length, 'single moment ids are unique')

  // corners/free-kicks/penalties exist as their OWN dedicated single-event entries
  const hasCorner = SINGLE_MOMENTS.some((m) => m.id.includes('corner'))
  const hasFreeKick = SINGLE_MOMENTS.some((m) => m.id.includes('free-kick'))
  const hasPenalty = SINGLE_MOMENTS.some((m) => m.id.includes('penalty'))
  check(hasCorner && hasFreeKick && hasPenalty, 'corners, free kicks and penalties all exist as dedicated single-event moments, distinct from the multi-beat scenario versions')

  // reachable through the SAME engine, not a disconnected pool
  const { scenariosFor } = await import('../src/engine/matchScenarios')
  const attackPool = scenariosFor('attack', 'good')
  check(attackPool.some((s) => SINGLE_MOMENTS.includes(s)), 'scenariosFor actually returns single moments alongside full scenarios — not dead, unreferenced content')
  const { scenarioById } = await import('../src/engine/matchScenarios')
  check(SINGLE_MOMENTS.every((m) => scenarioById(m.id) !== undefined), 'every single moment resolves correctly through scenarioById — the exact lookup resolveScenarioBeat depends on')
}

console.log(fails === 0 ? '\n✅ AUDIT 14 (full, incl. single moments) PASSED' : `\n❌ AUDIT 14: ${fails} CHECK(S) FAILED`)
process.exit(fails ? 1 : 0)
