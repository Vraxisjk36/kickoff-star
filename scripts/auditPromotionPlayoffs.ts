import assert from 'node:assert/strict'
import { createProWorld } from '../src/engine/proWorldFactory'
import { advancePromotionPlayoff } from '../src/engine/proPromotionPlayoffs'
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
for (const id of ['eng', 'esp', 'ger', 'fra', 'ita', 'ned', 'por', 'bra', 'rsa', 'sco']) {
  assert.ok(direct.championHistory.some(item => item.competitionId === `cup-${id}`), `${id} national cup did not conclude`)
  assert.ok(direct.championHistory.some(item => item.competitionId === `top-${id}`), `${id} top title missing`)
  assert.ok(direct.championHistory.some(item => item.competitionId === `second-${id}`), `${id} second-tier title missing`)
  assert.ok(direct.promotionHistory?.some(item => item.associationId === id), `${id} division exchange missing`)
}
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
for (const [id, fixtures] of [['esp', 6], ['ger', 2], ['fra', 4], ['sco', 6], ['por', 2], ['ita', 8], ['bra', 4], ['ned', 12]] as const) {
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
const brazil = direct.promotionHistory!.find(item => item.associationId === 'bra' && item.seasonId === '2026')!
const dutch = direct.promotionHistory!.find(item => item.associationId === 'ned' && item.seasonId === '2026')!
assert.ok([2, 3].includes(dutch.promotedIds.length))
assert.equal(new Set(dutch.fixtures.slice(0, 6).flatMap(fixture => [fixture.homeId, fixture.awayId])).size, 6)
assert.ok(!dutch.fixtures.slice(0, 6).some(fixture => dutch.promotedIds.slice(0, 2).includes(fixture.homeId) ||
  dutch.promotedIds.slice(0, 2).includes(fixture.awayId)), 'Dutch direct promotion clubs cannot enter the playoff')
const brazilTable = [...direct.seasonHistory.find(item => item.competitionId === 'second-bra' && item.seasonId === '2026')!.table]
  .sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor)
assert.deepEqual(brazil.promotedIds.slice(0, 2), brazilTable.slice(0, 2).map(row => row.clubId))
assert.ok(brazil.promotedIds.slice(2).every(id => brazilTable.slice(2, 6).some(row => row.clubId === id)))
assert.equal(new Set(brazil.promotedIds).size, 4)
const italianGap = createProWorld(1, '2026-08-01')
const italyLower = italianGap.standings['second-ita'].map((row, index) => ({ ...row, points: 70 - index * 3 - (index >= 3 ? 20 : 0) }))
assert.equal(advancePromotionPlayoff(italianGap, 'ita', '2026', '2027-05-22', '2027-07-01',
  italianGap.standings['top-ita'], italyLower), italyLower[2].clubId)
assert.equal(italianGap.promotionPlayoffs!['promotion-ita'].fixtureIds.length, 0, 'Italian points gap should bypass playoff')
const portugalUpset = createProWorld(6, '2026-08-01')
const portugalTop = portugalUpset.standings['top-por'].map((row, index) => ({ ...row, points: 40 - index }))
const portugalLower = portugalUpset.standings['second-por'].map((row, index) => ({ ...row, points: 40 - index }))
assert.equal(advancePromotionPlayoff(portugalUpset, 'por', '2026', '2027-05-22', '2027-07-01',
  portugalTop, portugalLower), portugalLower[2].clubId, 'Portuguese challenger can win promotion')
for (const [seed, id, promoted] of [[7, 'ger', 3], [1, 'ger', 2], [2, 'fra', 3], [1, 'fra', 2],
  [3, 'sco', 2], [1, 'sco', 1]] as const) {
  const world = seed === 1 ? upset : seed === 7 ? advanceProWorldTo(createProWorld(7, '2026-08-01'), '2027-07-01')
    : advanceProWorldTo(createProWorld(seed, '2026-08-01'), '2027-07-01')
  assert.equal(world.promotionHistory!.find(item => item.associationId === id)!.promotedIds.length, promoted,
    `${id} playoff can promote a challenger or retain the incumbent`)
}
console.log('Nine countries: playoff brackets, bypass rules, saved results and division membership passed')
