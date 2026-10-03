// AUDIT 8 (P32) — standing meters, street games, and the P31b engine fixes.
//
// Driven entirely by the second round of real-play feedback:
//   "I played 3 games and got 2 chances, 1, and 1 — both at 90+"
//   "how do I get a chance after being substituted?"
//   NSS-style coach / teammates / fans meters
//   mid-week street games so there's something to do before Sunday
import { reseed, rand } from '../src/engine/rng'
import { initMatch, advanceToKeyMoment } from '../src/engine/match'
import { generateTeam } from '../src/engine/teams'
import {
  standingFromMatch, applyStandingDeltas, driftStanding, standingOf, standingLabel,
  coachStanding, standingMatchEffects,
} from '../src/engine/standing'
import {
  initStreetGame, advanceStreet, resolveStreetChance, streetRewards, FORMATIONS,
  formationById, STREET_TARGET, MIN_PLAYER_CHANCES,
} from '../src/engine/streetGame'
import { streetGameKindFor } from '../src/components/StreetMiniGame'
import { generateWeek } from '../src/engine/calendar'
import type { Player } from '../src/types/player'

reseed(32032)
let fails = 0
const check = (c: boolean, m: string) => { if (!c) { fails++; console.error('  ✗', m) } else console.log('  ✓', m) }

function mk(over: Partial<Player> = {}): Player {
  const v: Record<string, number> = {}
  for (const k of ['finishing', 'passing', 'dribbling', 'firstTouch', 'pace', 'strength', 'stamina', 'agility', 'vision', 'composure', 'positioning', 'concentration']) v[k] = 10
  return {
    name: 'Test', position: 'ST', potential: 15, attributes: { kind: 'outfield', values: v },
    confidence: { value: 0, baseline: 0 }, fitness: { stamina: 65 },
    careerClock: { ageYears: 15, phase: 'grassroots-season', grassrootsSeason: 1 },
    matchRatings: [6, 6, 6], career: { goals: 1, assists: 1, appearances: 8, wins: 2, cleanSheets: 0, bestRating: 7, motmAwards: 0 },
    coachTrust: 0, reputation: 18, scoutWatchers: [], contractOffers: [], totalWeeksElapsed: 12,
    squadRole: 'starting-xi', recentInjuryCount: 0, injury: null, standing: { teammates: 0, fans: 0 },
    ...over,
  } as unknown as Player
}

// ---------------------------------------------------------------------------
console.log('\n[A] CHANCES no longer collapse when your team is bad')
{
  // The gap my earlier audit missed: it only ever tested EVENLY MATCHED teams.
  // A player in a weak side was getting a third of the involvement — which is
  // exactly what the player reported (2 chances, then 1, then 1).
  const results: Record<string, { moments: number; subbed: number }> = {}
  for (const [mine, theirs] of [[2, 7], [4, 4], [7, 2]] as [number, number][]) {
    let moments = 0, subbed = 0
    const runs = 120
    for (let i = 0; i < runs; i++) {
      const p = mk()
      let s = initMatch(p, generateTeam(mine), generateTeam(theirs), true)
      let g = 0
      while (!s.finished && g++ < 400) {
        const r = advanceToKeyMoment(s, p); s = r.state
        if (r.keyMoment) { moments++; s = { ...s, drivesSinceInvolved: 0 } }
      }
      if (s.substituted) subbed++
    }
    results[`${mine}v${theirs}`] = { moments: moments / runs, subbed: subbed / runs }
    console.log(`    prestige ${mine} vs ${theirs}: ${(moments / runs).toFixed(2)} moments · subbed off ${((subbed / runs) * 100).toFixed(0)}%`)
  }

  check(results['2v7'].moments >= 2.6, `a player in a WEAK team still gets real involvement (${results['2v7'].moments.toFixed(2)}) — was 2.17`)
  check(results['2v7'].moments / results['7v2'].moments > 0.4, 'the gap between a weak and strong team is no longer punishing')
  check(results['2v7'].subbed < 0.5, `a struggling player is not hooked every week (${(results['2v7'].subbed * 100).toFixed(0)}%) — was 97%`)
  check(results['4v4'].subbed < 0.35, `and rarely in an even game (${(results['4v4'].subbed * 100).toFixed(0)}%)`)
}

// ---------------------------------------------------------------------------
console.log('\n[B] a player who has left the pitch can never receive a moment')
{
  // The reported bug: scoring a goal after being substituted off at 72'.
  let violations = 0
  const runs = 400
  for (let i = 0; i < runs; i++) {
    const p = mk({ fitness: { stamina: 35 }, coachTrust: -3, matchRatings: [5, 5, 5] } as Partial<Player>)
    let s = initMatch(p, generateTeam(2), generateTeam(7), true)
    let g = 0
    while (!s.finished && g++ < 400) {
      const r = advanceToKeyMoment(s, p); s = r.state
      if (r.keyMoment && (s.substituted || s.injury || !s.onPitch || s.finished)) violations++
      if (r.keyMoment) s = { ...s, drivesSinceInvolved: 0 }
    }
    // and once off, onPitch must be false
    if (s.substituted && s.onPitch) violations++
  }
  check(violations === 0, `no moment is ever granted off the pitch, across ${runs} matches (${violations} violations)`)
}

// ---------------------------------------------------------------------------
console.log('\n[C] STANDING — three groups that move on performance')
{
  check(coachStanding(mk({ coachTrust: 5 } as Partial<Player>)) === 50, 'the coach meter reads directly off coachTrust — one source of truth')
  check(standingLabel(80) === 'adored' && standingLabel(-80) === 'hostile' && standingLabel(0) === 'neutral', 'labels map correctly')

  // The two groups must weight DIFFERENT things, or they're one meter twice.
  const scorerInDefeat = standingFromMatch({ rating: 7.0, goals: 2, assists: 0, won: false, drew: false, played: true, isHomeCrowd: true })
  const workhorseInWin = standingFromMatch({ rating: 7.2, goals: 0, assists: 1, won: true, drew: false, played: true, isHomeCrowd: true })
  console.log(`    scored twice in a defeat: teammates ${scorerInDefeat.teammates}, fans ${scorerInDefeat.fans}`)
  console.log(`    quiet assist in a win:    teammates ${workhorseInWin.teammates}, fans ${workhorseInWin.fans}`)
  check(scorerInDefeat.fans > workhorseInWin.fans, 'the terraces reward goals even in defeat')
  check(workhorseInWin.teammates > scorerInDefeat.teammates, 'the dressing room rewards winning and doing your job')

  // Not played = nothing moves.
  const watched = standingFromMatch({ rating: 0, goals: 0, assists: 0, won: true, drew: false, played: false, isHomeCrowd: true })
  check(watched.teammates === 0 && watched.fans === 0, 'watching from the bench moves nothing')

  // Small margins, as briefed.
  const best = standingFromMatch({ rating: 9.5, goals: 3, assists: 2, won: true, drew: false, played: true, isHomeCrowd: true })
  console.log(`    a perfect afternoon: teammates +${best.teammates}, fans +${best.fans}`)
  check(best.fans <= 20 && best.teammates <= 15, 'even a hat-trick moves standing by a modest amount — built over a season')

  // Clamping and drift.
  let st = { teammates: 0, fans: 0 }
  for (let i = 0; i < 100; i++) st = applyStandingDeltas(st, best)
  check(st.teammates <= 100 && st.fans <= 100, 'standing clamps at 100')
  let drifting = { teammates: 80, fans: -80 }
  const trace: number[] = []
  for (let i = 0; i < 300; i++) { drifting = driftStanding(drifting); trace.push(drifting.teammates) }
  check(Math.abs(drifting.teammates) < 1 && Math.abs(drifting.fans) < 1, 'standing decays toward neutral if not maintained')
  check(trace.every((v, i) => i === 0 || v <= trace[i - 1] + 0.001), 'drift is monotone — never oscillates')

  // Effects are bounded (they apply to EVERY match).
  const maxed = mk({ standing: { teammates: 100, fans: 100 }, coachTrust: 10 } as Partial<Player>)
  const eff = standingMatchEffects(maxed, true)
  check(Math.abs(eff.ratingBonus) <= 0.25 && Math.abs(eff.confidenceShift) <= 0.4, 'standing effects stay tiny — they apply every single match')
  check(standingMatchEffects(maxed, false).confidenceShift === 0, 'the home crowd only lifts you at home')
  check(standingOf(mk({ standing: { teammates: 42, fans: -13 } } as Partial<Player>), 'teammates') === 42, 'standing reads back correctly')
}

// ---------------------------------------------------------------------------
console.log('\n[D] STREET GAMES')
{
  const p = mk()
  check(FORMATIONS.length === 4, '4 formations to choose from')
  check(new Set(FORMATIONS.map((f) => f.id)).size === 4, 'formation ids unique')
  check(formationById('nonsense').id === 'balanced', 'unknown formation falls back safely')

  // Formation must genuinely change the shape of the game.
  const attackIds = [...FORMATIONS].sort((a, b) => b.attackBias - a.attackBias)
  check(attackIds[0].attackBias / attackIds[attackIds.length - 1].attackBias > 1.5, 'formations differ meaningfully in how much you attack')
  check(FORMATIONS.some((f) => f.defenceBias < 0.8), 'at least one formation genuinely protects you')
  check(FORMATIONS.every((f) => f.playerShare > 0.3 && f.playerShare < 0.8), 'the ball always finds you sometimes, never always')

  // Play full games across every formation.
  for (const f of FORMATIONS) {
    let totalChances = 0, finished = 0, minChances = 99
    const runs = 60
    for (let i = 0; i < runs; i++) {
      let g = initStreetGame(p, 'street', f.id, ['A', 'B', 'C'])
      let guard = 0
      while (!g.finished && guard++ < 400) {
        const { state, beat } = advanceStreet(g)
        g = state
        if (beat.kind === 'your-chance') {
          g = resolveStreetChance(g, rand()).state
        }
      }
      if (g.finished) finished++
      totalChances += g.playerChances
      minChances = Math.min(minChances, g.playerChances)
    }
    console.log(`    ${f.name.padEnd(9)}: ${(totalChances / runs).toFixed(1)} chances/game · min ${minChances} · ${finished}/${runs} completed`)
    check(finished === runs, `${f.id}: every game reaches a conclusion (no infinite loops)`)
    check(minChances >= MIN_PLAYER_CHANCES, `${f.id}: the promised minimum of ${MIN_PLAYER_CHANCES} chances always holds (worst was ${minChances})`)
  }

  // The attacking formation must actually give you more of the ball.
  const chancesFor = (id: string) => {
    let total = 0
    for (let i = 0; i < 80; i++) {
      let g = initStreetGame(p, 'street', id, [])
      let guard = 0
      while (!g.finished && guard++ < 400) {
        const { state, beat } = advanceStreet(g)
        g = state
        if (beat.kind === 'your-chance') g = resolveStreetChance(g, rand()).state
      }
      total += g.playerChances
    }
    return total / 80
  }
  const allOut = chancesFor('all-out')
  const solid = chancesFor('solid')
  console.log(`    all-out ${allOut.toFixed(1)} chances vs solid ${solid.toFixed(1)}`)
  check(Math.abs(allOut - solid) > 0.4, 'your formation choice measurably changes how much you get on the ball')

  // Scoring rules
  let g2 = initStreetGame(p, 'street', 'balanced', [])
  let guard2 = 0
  while (!g2.finished && guard2++ < 400) {
    const { state, beat } = advanceStreet(g2)
    g2 = state
    if (beat.kind === 'your-chance') g2 = resolveStreetChance(g2, 1).state
  }
  check(g2.yourScore === STREET_TARGET || g2.theirScore === STREET_TARGET, `a game ends exactly when someone reaches ${STREET_TARGET}`)
  check(g2.yourScore <= STREET_TARGET && g2.theirScore <= STREET_TARGET, 'scores never overshoot the target')

  // A perfect conversion rate should USUALLY win, but the opponent can still
  // outscore you while you're waiting for the ball — that's four-a-side.
  let perfectWins = 0
  for (let i = 0; i < 60; i++) {
    let g = initStreetGame(p, 'street', 'all-out', [])
    let guard = 0
    while (!g.finished && guard++ < 400) {
      const { state, beat } = advanceStreet(g)
      g = state
      if (beat.kind === 'your-chance') g = resolveStreetChance(g, 1).state
    }
    if (g.won) perfectWins++
  }
  console.log(`    converting every chance wins ${((perfectWins / 60) * 100).toFixed(0)}% of games`)
  check(perfectWins / 60 > 0.6, 'finishing everything usually wins you the game')
  check(perfectWins / 60 < 1, 'but your team-mates can still let you down — it is four-a-side')

  // Rewards are modest and skill-shaped.
  const rewards = streetRewards(g2)
  const totalGain = Object.values(rewards.attributeGains).reduce((a, b) => a + b, 0)
  console.log(`    a perfect street game gives ${totalGain.toFixed(2)} total attribute points`)
  check(totalGain < 0.7, 'street games are practice, not a shortcut')
  check(Object.values(rewards.attributeGains).every((v) => v >= 0), 'no negative gains')
  check(rewards.confidence !== 0, 'the result always moves confidence one way or the other')

  // Injury risk and energy are real costs.
  const streetCfg = initStreetGame(p, 'street', 'balanced', []).config
  const smallCfg = initStreetGame(p, 'small-sided', 'balanced', []).config
  check(streetCfg.injuryMultiplier > smallCfg.injuryMultiplier, 'street football is riskier than a coached session')
  check(streetCfg.injuryMultiplier > 1.5, 'and meaningfully riskier than a normal match')
  check(streetCfg.energyCost > smallCfg.energyCost, 'and costs more energy')

  // Mini-games rotate.
  const kinds = [0, 1, 2, 3, 4].map(streetGameKindFor)
  check(new Set(kinds).size === 3, 'street chances rotate through all three mini-games')
}

// ---------------------------------------------------------------------------
console.log('\n[E] the week actually contains mid-week football')
{
  let streetWeeks = 0, schoolStreetWeeks = 0
  const WEEKS = 400
  for (let i = 0; i < WEEKS; i++) {
    const week = 5 + (i % 40)
    const w = generateWeek(week, 1, 'grassroots-season', false, 'sunday')
    if (w.events.some((e) => e.type === 'street')) streetWeeks++
    const school = generateWeek(week, 1, 'grassroots-season', false, 'school')
    if (school.events.some((e) => e.type === 'street')) schoolStreetWeeks++
  }
  const rate = streetWeeks / WEEKS
  console.log(`    Sunday route ${(rate * 100).toFixed(0)}% · school route ${(schoolStreetWeeks / WEEKS * 100).toFixed(0)}%`)
  check(rate > 0.35 && rate < 0.65, `Sunday route offers mid-week football on open Thursdays (${(rate * 100).toFixed(0)}%)`)
  check(schoolStreetWeeks < streetWeeks, 'school match Thursdays take precedence over street games')

  // Never on an international week — two midweek games is too much.
  let clash = 0
  for (let i = 0; i < 200; i++) {
    const w = generateWeek(8, 1, 'grassroots-season', true) // week 8 is an international window
    if (w.events.some((e) => e.type === 'street') && w.events.some((e) => e.title === 'international duty')) clash++
  }
  check(clash === 0, 'a street game never collides with midweek international duty')
}

console.log(fails === 0 ? '\n✅ AUDIT 8 PASSED' : `\n❌ AUDIT 8: ${fails} CHECK(S) FAILED`)
process.exit(fails ? 1 : 0)
