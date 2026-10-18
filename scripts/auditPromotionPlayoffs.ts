import assert from 'node:assert/strict'
import { createProWorld } from '../src/engine/proWorldFactory'
import { advanceProWorldTo } from '../src/engine/proWorldSimulation'

const initial = createProWorld(89, '2026-08-01')
const before = advanceProWorldTo(initial, '2027-05-23')
for (const [id, expected] of [['eng', 2], ['rsa', 6]] as const) {
  const state = before.promotionPlayoffs?.[`promotion-${id}`]
  assert.ok(state, `${id} playoff scheduled`)
  assert.equal(state.fixtureIds.length, expected)
  assert.ok(state.fixtureIds.every(fixtureId => !before.fixtures[fixtureId].result), 'future playoff not prematurely played')
  assert.equal(before.competitions[`top-${id}`].seasonId, '2026', 'season remains open until playoffs finish')
}
const partial = advanceProWorldTo(before, '2027-05-31')
assert.equal(partial.promotionPlayoffs?.['promotion-eng']?.stage, 'semifinal')
assert.equal(partial.promotionPlayoffs?.['promotion-eng']?.fixtureIds.length, 6)
assert.ok(partial.promotionPlayoffs?.['promotion-rsa']?.fixtureIds.some(id => !!partial.fixtures[id].result))
const resumed = advanceProWorldTo(partial, '2027-07-01')
const direct = advanceProWorldTo(initial, '2027-07-01')
for (const id of ['eng', 'rsa']) assert.deepEqual(
  resumed.promotionHistory?.find(item => item.associationId === id && item.seasonId === '2026'),
  direct.promotionHistory?.find(item => item.associationId === id && item.seasonId === '2026'),
  `${id} resume changes playoff outcome`)
for (const id of ['eng', 'rsa']) {
  const history = direct.promotionHistory?.find(item => item.associationId === id && item.seasonId === '2026')
  assert.ok(history, `${id} promotion recorded`)
  assert.ok(history.fixtures.every(fixture => !!fixture.result), 'all playoff matches have a score')
  assert.equal(history.fixtures.length, id === 'eng' ? 7 : 6)
  for (const promoted of history.promotedIds) {
    assert.equal(direct.clubs[promoted].tier, 1)
    assert.ok(direct.competitions[`top-${id}`].entrantIds.includes(promoted))
  }
  for (const relegated of history.relegatedIds) {
    assert.equal(direct.clubs[relegated].tier, 2)
    assert.ok(direct.competitions[`second-${id}`].entrantIds.includes(relegated))
  }
  assert.equal(direct.competitions[`top-${id}`].entrantIds.length, initial.competitions[`top-${id}`].entrantIds.length)
  assert.equal(direct.competitions[`second-${id}`].entrantIds.length, initial.competitions[`second-${id}`].entrantIds.length)
}
assert.equal(direct.promotionHistory?.find(item => item.associationId === 'eng')?.promotedIds.length, 3)
assert.ok([1, 2].includes(direct.promotionHistory!.find(item => item.associationId === 'rsa')!.promotedIds.length))
const upset = advanceProWorldTo(createProWorld(1, '2026-08-01'), '2027-07-01')
const englishTable = upset.seasonHistory.find(item => item.competitionId === 'second-eng' && item.seasonId === '2026')!.table
  .sort((a, b) => b.points - a.points ||
    (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor || a.clubId.localeCompare(b.clubId))
assert.equal(upset.promotionHistory!.find(item => item.associationId === 'eng')!.promotedIds[2], englishTable[4].clubId,
  'fifth-place club can win the playoff instead of automatic third place')
for (const [id, fixtures] of [['esp', 6], ['ger', 2], ['fra', 4], ['sco', 6]] as const) {
  const history = direct.promotionHistory?.find(item => item.associationId === id && item.seasonId === '2026')
  assert.ok(history, `${id} playoff archived`)
  assert.equal(history.fixtures.length, fixtures)
  assert.ok(history.fixtures.every(fixture => !!fixture.result))
  assert.equal(direct.competitions[`top-${id}`].entrantIds.length, initial.competitions[`top-${id}`].entrantIds.length)
  assert.equal(direct.competitions[`second-${id}`].entrantIds.length, initial.competitions[`second-${id}`].entrantIds.length)
  for (const clubId of history.promotedIds) assert.ok(direct.competitions[`top-${id}`].entrantIds.includes(clubId))
  for (const clubId of history.relegatedIds) assert.ok(direct.competitions[`second-${id}`].entrantIds.includes(clubId))
  assert.deepEqual(resumed.promotionHistory?.find(item => item.associationId === id && item.seasonId === '2026'), history,
    `${id} save/resume changes playoff outcome`)
}
for (const [seed, id, promoted] of [[7, 'ger', 3], [1, 'ger', 2], [2, 'fra', 3], [1, 'fra', 2],
  [2, 'sco', 2], [1, 'sco', 1]] as const) {
  const world = seed === 1 ? upset : seed === 7 ? advanceProWorldTo(createProWorld(7, '2026-08-01'), '2027-07-01')
    : advanceProWorldTo(createProWorld(2, '2026-08-01'), '2027-07-01')
  assert.equal(world.promotionHistory!.find(item => item.associationId === id)!.promotedIds.length, promoted,
    `${id} playoff can promote a challenger or retain the incumbent`)
}
console.log('England, South Africa, Spain, Germany, France and Scotland: playoff brackets, saves and membership passed')
