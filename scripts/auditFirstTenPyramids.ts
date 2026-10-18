import assert from 'node:assert/strict'
import { createProWorld } from '../src/engine/proWorldFactory'
import { advanceProWorldTo } from '../src/engine/proWorldSimulation'
import { VERIFIED_PRO_RULES } from '../src/engine/proRulebook'

/** First-ten regression gate: division identities, league fixtures, season movement. */
const countries = ['eng','esp','ger','fra','ita','ned','por','bra','rsa','sco'] as const
const initial = createProWorld(20261018, '2026-08-01')
const first = advanceProWorldTo(initial, '2027-10-01')
const resumed = advanceProWorldTo(advanceProWorldTo(initial, '2027-02-01'), '2027-10-01')
for (const country of countries) {
  const rules = VERIFIED_PRO_RULES[country]
  const top = initial.competitions[`top-${country}`]
  const second = initial.competitions[`second-${country}`]
  assert.ok(top && second, `${country}: missing top/second tier`)
  assert.equal(top.entrantIds.length, rules.topFlightClubs)
  assert.equal(second.entrantIds.length, rules.lowerTierClubs)
  assert.equal(top.format.scheduledRounds, rules.topFlightMatches)
  assert.equal(second.format.scheduledRounds, rules.lowerTierMatches)
  for (const tier of ['top','second'] as const) {
    const id = `${tier}-${country}`
    const comp = initial.competitions[id]
    const fixtures = Object.values(initial.fixtures).filter(f => f.competitionId === id)
    const played = new Map(comp.entrantIds.map(id => [id, 0]))
    const dates = new Set<string>()
    for (const f of fixtures) {
      assert.ok(f.homeId !== f.awayId && played.has(f.homeId) && played.has(f.awayId), `${id}: invalid pairing`)
      for (const club of [f.homeId,f.awayId]) {
        const key = `${club}:${f.kickoffDate}`
        assert.ok(!dates.has(key), `${id}: duplicate club date ${key}`)
        dates.add(key)
        played.set(club, played.get(club)! + 1)
      }
    }
    for (const count of played.values()) assert.equal(count, comp.format.scheduledRounds, `${id}: wrong match count`)
    assert.deepEqual(first.competitions[id].entrantIds, resumed.competitions[id].entrantIds, `${id}: save/resume changed entrants`)
    assert.deepEqual(first.standings[id], resumed.standings[id], `${id}: save/resume changed standings`)
    assert.ok(first.championHistory.some(h => h.competitionId === id), `${id}: missing season champion`)
  }
  const movement = first.promotionHistory?.find(h => h.associationId === country)
  assert.ok(movement, `${country}: missing top-flight promotion/relegation history`)
  assert.equal(movement.promotedIds.length, movement.relegatedIds.length, `${country}: unbalanced movement`)
  assert.equal(new Set(movement.promotedIds).size, movement.promotedIds.length, `${country}: duplicate promoted club`)
  assert.equal(new Set(movement.relegatedIds).size, movement.relegatedIds.length, `${country}: duplicate relegated club`)
  assert.ok(movement.fixtures.every(f => !!f.result), `${country}: unfinished promotion playoff`)
  assert.ok(movement.promotedIds.every(id => first.competitions[`top-${country}`].entrantIds.includes(id)), `${country}: promoted club missing from top tier`)
  assert.ok(movement.relegatedIds.every(id => first.competitions[`second-${country}`].entrantIds.includes(id)), `${country}: relegated club missing from second tier`)
}
console.log('First-ten top/second pyramid regression passed')

const brazilFeeder = first.promotionHistory?.find(h => h.associationId === 'bra-2')
assert.ok(brazilFeeder, 'Brazil Série C promotion missing')
assert.equal(brazilFeeder.promotedIds.length, 4)
assert.ok(brazilFeeder.fixtures.length >= 12, 'Brazil Série C final-group fixtures missing')
assert.ok(brazilFeeder.fixtures.every(f => !!f.result), 'Brazil Série C final-group result missing')
assert.ok(brazilFeeder.promotedIds.every(id => first.competitions['second-bra'].entrantIds.includes(id)),
  'Brazil Série C winner missing from next Série B')

for (const [country, expectedTeams, expectedGames] of [['bra', 8, 24], ['por', 8, 56]] as const) {
  const history = first.promotionHistory?.find(h => h.associationId === `${country}-2`)
  assert.ok(history, `${country}: missing feeder history`)
  // Brazil: two groups of four, double round robin (12 games each).
  // Portugal: one eight-team final phase, double round robin (56 games).
  assert.equal(history.fixtures.length, expectedGames, `${country}: wrong feeder fixture count`)
  const entrants = new Set(history.fixtures.flatMap(f => [f.homeId, f.awayId]))
  assert.equal(entrants.size, expectedTeams, `${country}: feeder entrants`)
  const occupied = new Set<string>()
  const pairings = new Map<string, { home: string; away: string }[]>()
  for (const fixture of history.fixtures) {
    for (const id of [fixture.homeId, fixture.awayId]) {
      const key = `${fixture.kickoffDate}:${id}`
      assert.ok(!occupied.has(key), `${country}: feeder club double booked ${key}`)
      occupied.add(key)
    }
    const pair = [fixture.homeId, fixture.awayId].sort().join(':')
    pairings.set(pair, [...(pairings.get(pair) ?? []), { home: fixture.homeId, away: fixture.awayId }])
  }
  for (const games of pairings.values()) {
    assert.equal(games.length, 2, `${country}: feeder teams must meet twice`)
    assert.equal(games[0].home, games[1].away, `${country}: feeder return leg must reverse venue`)
  }
}
