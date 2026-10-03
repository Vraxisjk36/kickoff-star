import { reseed } from '../src/engine/rng'
import { generateTeam } from '../src/engine/teams'
import { initMatch, advanceToKeyMoment, resolvePlayerMoment } from '../src/engine/match'
import { momentToDecision } from '../src/engine/matchDecisions'
import type { Player } from '../src/types/player'
import type { Position } from '../src/types/attributes'

let checked = 0
for (const position of ['GK', 'CB', 'FB', 'CM', 'WM', 'WG', 'ST'] as Position[]) {
  for (let seed = 1; seed <= 30; seed++) {
    reseed(seed * 117 + position.charCodeAt(0))
    const p = { name: 'Audit Player', position, potential: 18,
      attributes: { kind: position === 'GK' ? 'goalkeeper' : 'outfield', values: Object.fromEntries(
        (position === 'GK' ? ['reflexes', 'handling', 'gkPositioning', 'distribution'] :
          ['shooting', 'passing', 'dribbling', 'tackling', 'pace', 'strength', 'stamina', 'agility', 'vision', 'composure', 'positioning', 'concentration']).map(k => [k, 10])) },
      confidence: { value: 0, baseline: 0 }, fitness: { stamina: 100 },
      careerClock: { ageYears: 17, phase: 'academy' }, squadRole: 'starting-xi', injury: null,
    } as unknown as Player
    let state = initMatch(p, generateTeam(5), generateTeam(5), true)
    for (let i = 0; i < 20 && !state.finished; i++) {
      const result = advanceToKeyMoment(state, p)
      state = result.state
      const moment = result.keyMoment
      if (!moment) continue
      if (moment.isInjuryDecision || moment.scenarioId) break
      if (!moment.isRoutine) break
      const bundle = momentToDecision(p, moment, '')
      for (const success of [true, false]) {
        const after = resolvePlayerMoment(state, moment, 1, success, 1, 1, p.position === 'GK')
        if (after.homeScore !== state.homeScore || after.awayScore !== state.awayScore ||
          after.playerGoals !== state.playerGoals || after.playerAssists !== state.playerAssists ||
          after.playerStats.saves !== state.playerStats.saves || bundle.decision.options.length < 2) {
          throw new Error(`${position}: a routine moment changed a scoring or save outcome`)
        }
        checked++
      }
      break
    }
  }
}
if (checked < 50) throw new Error(`Too few routine moments tested: ${checked}`)
console.log(`ROUTINE MOMENT AUDIT PASSED — ${checked} outcomes`)
