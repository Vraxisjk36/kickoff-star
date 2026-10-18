import assert from 'node:assert/strict'
import { GROUPED_THIRD, PRO_GROUPED_LEAGUE_PLAN } from '../src/engine/proLeagueRegistry'
import { createProWorld } from '../src/engine/proWorldFactory'
import { advanceProWorldTo } from '../src/engine/proWorldSimulation'

const seed = createProWorld(991, '2026-08-01')
for (const [country, format] of Object.entries(GROUPED_THIRD)) {
  for (let group = 1; group <= format.groups; group++) {
    const comp = seed.competitions[`third-${country}-${group}`]
    assert.equal(comp.entrantIds.length, format.clubsPerGroup)
    assert.equal(comp.format.scheduledRounds, (format.clubsPerGroup - 1) * 2)
    assert.ok(comp.entrantIds.every(id => seed.clubs[id].feederGroup === group && seed.clubs[id].tier === 3))
  }
}
assert.equal(PRO_GROUPED_LEAGUE_PLAN.length, 16)
const direct = advanceProWorldTo(seed, '2027-08-10')
const resumed = advanceProWorldTo(advanceProWorldTo(seed, '2027-02-01'), '2027-08-10')
for (const [country, format] of Object.entries(GROUPED_THIRD)) {
  const movement = direct.promotionHistory?.find(row => row.associationId === `${country}-2`)
  assert.ok(movement, `${country} feeder did not promote`)
  assert.equal(movement.promotedIds.length, format.promoted)
  assert.equal(movement.relegatedIds.length, format.promoted)
  assert.ok(movement.fixtures.length >= (country === 'por' ? 56 : country === 'bra' ? 0 : country === 'rsa' ? 7 : 5),
    `${country} qualification results missing`)
  assert.ok(movement.fixtures.every(fixture => !!fixture.result && fixture.kickoffDate > '2026-01-01'))
  assert.deepEqual(movement, resumed.promotionHistory?.find(row => row.associationId === `${country}-2`))
  for (let group = 1; group <= format.groups; group++) {
    const comp = direct.competitions[`third-${country}-${group}`]
    assert.equal(comp.entrantIds.length, format.clubsPerGroup, `${country} group ${group} shifted size`)
    assert.ok(comp.entrantIds.every(id => direct.clubs[id].tier === 3 && direct.clubs[id].feederGroup === group))
    assert.deepEqual(comp.entrantIds, resumed.competitions[comp.id].entrantIds)
    assert.ok(direct.championHistory.some(row => row.competitionId === comp.id))
  }
  const cup = direct.competitions[`cup-${country}`]
  assert.ok(cup?.entrantIds.length >= format.groups * format.clubsPerGroup)
}
for (const country of ['fra', 'bra']) {
  const comp = direct.competitions[`third-${country}`]
  assert.equal(comp.entrantIds.length, country === 'fra' ? 18 : 20)
  assert.ok(direct.promotionHistory?.some(row => row.associationId === `${country}-2`))
}
// A save made before this expansion receives all missing groups without losing an active second-tier table.
const legacy = structuredClone(seed)
const original = structuredClone(legacy.competitions['second-esp'].entrantIds)
for (const club of Object.values(legacy.clubs).filter(item => item.associationId === 'esp' && item.tier === 3)) {
  delete legacy.clubs[club.id]; delete legacy.stadiums[club.stadiumId]; delete legacy.managers[`manager-${club.id}`]
  for (const player of Object.values(legacy.players).filter(item => item.clubId === club.id)) delete legacy.players[player.id]
  for (const prospect of Object.values(legacy.academyProspects).filter(item => item.clubId === club.id)) delete legacy.academyProspects[prospect.id]
}
for (const comp of PRO_GROUPED_LEAGUE_PLAN.filter(item => item.associationId === 'esp')) {
  delete legacy.competitions[comp.id]; delete legacy.standings[comp.id]
  for (const fixture of Object.values(legacy.fixtures).filter(item => item.competitionId === comp.id)) delete legacy.fixtures[fixture.id]
}
const hydrated = advanceProWorldTo(legacy, '2026-08-02')
assert.deepEqual(hydrated.competitions['second-esp'].entrantIds, original)
assert.equal(hydrated.competitions['third-esp-1'].entrantIds.length, 20)
assert.equal(hydrated.competitions['third-esp-2'].entrantIds.length, 20)
console.log('Grouped and national feeders: fixtures, promotions, cups, resume, legacy hydration passed')
