// Paired live-engine matches: isolate one attribute while every other player
// property and each match seed stays fixed. Run: node --import tsx scripts/auditAttributeEffect.ts
import { reseed, rand } from '../src/engine/rng'
import { generateTeam } from '../src/engine/teams'
import { initMatch, advanceToKeyMoment, resolveInjuryDecision, resolvePlayerMoment, resolveScenarioBeat } from '../src/engine/match'
import { momentToDecision, inferStatTag } from '../src/engine/matchDecisions'
import { autoResolveGrade, adjustChance } from '../src/engine/execution'
import type { Position } from '../src/types/attributes'
import type { Player } from '../src/types/player'

function player(position: Position, attr: string, value: number): Player {
  const keys = position === 'GK' ? ['reflexes', 'handling', 'gkPositioning', 'distribution'] :
    ['shooting', 'passing', 'dribbling', 'tackling', 'pace', 'strength', 'stamina', 'agility', 'vision', 'composure', 'positioning', 'concentration']
  return {
    name: 'Test Striker', position, potential: 19,
    attributes: { kind: position === 'GK' ? 'goalkeeper' : 'outfield', values: Object.fromEntries(keys.map(k => [k, k === attr ? value : 10])) },
    confidence: { value: 0, baseline: 0 }, fitness: { stamina: 100 },
    squadRole: 'starting-xi', careerClock: { ageYears: 18, phase: 'academy', grassrootsSeason: 4 },
    injury: null, matchesSinceReturn: 3, coachTrust: 0, reputation: 20,
  } as unknown as Player
}

function one(p: Player, seed: number) {
  reseed(seed)
  let m = initMatch(p, generateTeam(5), generateTeam(5), true)
  let count = 0
  let tackles = 0
  while (!m.finished && count < 90) {
    const next = advanceToKeyMoment(m, p)
    m = next.state
    if (!next.keyMoment) continue
    const moment = next.keyMoment
    count++
    if (moment.isInjuryDecision) { m = resolveInjuryDecision(m, false, p); continue }
    const bundle = momentToDecision(p, moment, `${m.minute}'`)
    // For a striker testing shooting, take a shooting option when offered.
    // The other scenarios use expected reward, including passing decisions.
    const shots = p.position === 'ST' ? bundle.keyAttributes.map((a, i) => a.includes('shooting') ? i : -1).filter(i => i >= 0) : []
    const indices = shots.length ? shots : bundle.decision.options.map((_, i) => i)
    const idx = indices.reduce((best, i) => bundle.decision.options[i].successChance * bundle.rewards[i] > bundle.decision.options[best].successChance * bundle.rewards[best] ? i : best)
    const grade = autoResolveGrade(p, m.matchStamina)
    const opt = bundle.decision.options[idx]
    const success = rand() < Math.min(.97, adjustChance(opt.successChance, grade))
    const quality = bundle.rewards[idx] / bundle.maxReward
    m = moment.scenarioId
      ? resolveScenarioBeat(m, moment, idx, quality, success, 1, 1, grade)
      : resolvePlayerMoment(m, moment, quality, success, 1, 1, p.position === 'GK', grade)
    if (!moment.isRoutine && inferStatTag(opt.label, moment.isDefensive, moment.isDistribution, p.position === 'GK', success) === 'tackle') tackles++
  }
  if (!m.finished) throw new Error('unfinished match')
  return { ...m.playerStats, momentTackles: tackles }
}

const results: Record<string, Record<number, Record<string, number>>> = {}
for (const [position, attribute] of [['ST', 'shooting'], ['GK', 'reflexes'], ['CM', 'passing'], ['CB', 'tackling']] as [Position, string][]) {
  results[position] = {}
  for (const level of [5, 15]) {
    const totals: Record<string, number> = {}
    for (let i = 0; i < 500; i++) {
      const stats = one(player(position, attribute, level), 91001 + i * 53)
      for (const [k, v] of Object.entries(stats)) totals[k] = (totals[k] ?? 0) + v
    }
    results[position][level] = totals
    console.log(JSON.stringify({ position, attribute, level, matches: 500,
      goals: totals.goals, assists: totals.assists, saves: totals.saves, shotsFaced: totals.shotsFaced,
      passesCompleted: totals.passesCompleted, passesAttempted: totals.passesAttempted,
      tacklesWon: totals.tacklesWon, tacklesAttempted: totals.tacklesAttempted,
      momentTackles: totals.momentTackles }))
  }
}
if (results.ST[15].goals < results.ST[5].goals * 1.25) throw new Error('Shooting growth is too weak in live matches')
if (results.GK[15].saves / results.GK[15].shotsFaced < results.GK[5].saves / results.GK[5].shotsFaced + .10) throw new Error('Reflexes growth is too weak')
if (results.CM[15].passesCompleted / results.CM[15].passesAttempted < results.CM[5].passesCompleted / results.CM[5].passesAttempted + .02) throw new Error('Passing growth is too weak')
const defensive = { tier: 'good' as const, isDefensive: true, isDistribution: false, minute: 45, situation: 'Defend the box' }
const tackleChance = (level: number) => momentToDecision(player('CB', 'tackling', level), defensive, '').decision.options.find(o => o.label === 'slide tackle')!.successChance
if (tackleChance(15) < tackleChance(5) + .15) throw new Error('Tackling does not improve the tackle decision enough')
console.log('ATTRIBUTE EFFECT AUDIT PASSED')
