import assert from 'node:assert/strict'
import { createProWorld } from '../src/engine/proWorldFactory'
import { advanceProWorldTo } from '../src/engine/proWorldSimulation'

const seed = createProWorld(89, '2026-08-01')
const groups = { eng: [['third', 24, 46], ['fourth', 24, 46]],
  ger: [['third', 20, 38]], sco: [['third', 10, 36], ['fourth', 10, 36]] } as const
for (const [country, divisions] of Object.entries(groups)) for (const [level, count, rounds] of divisions) {
  const comp = seed.competitions[`${level}-${country}`]
  assert.equal(comp.entrantIds.length, count)
  assert.equal(comp.format.scheduledRounds, rounds)
  assert.equal(new Set(comp.entrantIds.map(id => seed.clubs[id].name)).size, count, 'duplicated club names')
  assert.ok(comp.entrantIds.every(id => !seed.clubs[id].name.includes('undefined')))
}
const mid = advanceProWorldTo(seed, '2027-01-02')
for (const [country, expected] of [['eng', 92], ['sco', 42], ['ger', 56]] as const) {
  assert.equal(mid.competitions[`cup-${country}`].entrantIds.length, expected, `${country} cup missing lower clubs`)
  assert.ok(mid.competitions[`cup-${country}`].entrantIds.every(id => !!mid.clubs[id]))
}
assert.equal(mid.competitions['league-cup-eng'].entrantIds.length, 92)
assert.equal(mid.competitions['league-cup-sco'].entrantIds.length, 42)
const direct = advanceProWorldTo(seed, '2027-07-01')
const resumed = advanceProWorldTo(advanceProWorldTo(seed, '2027-05-28'), '2027-07-01')
for (const [country, divisions] of Object.entries(groups)) for (const [index, [level, count]] of divisions.entries()) {
  const tier = index + 3
  const comp = direct.competitions[`${level}-${country}`]
  assert.equal(comp.entrantIds.length, count, 'tier changed size')
  assert.ok(comp.entrantIds.every(id => direct.clubs[id].tier === tier), 'tier and membership disagree')
  assert.deepEqual(comp.entrantIds, resumed.competitions[comp.id].entrantIds, 'save/resume changed members')
  assert.ok(direct.championHistory.some(row => row.competitionId === comp.id), 'missing lower title')
  const boundary = `${country}-${tier - 1}`
  const history = direct.promotionHistory!.find(row => row.associationId === boundary)!
  assert.ok(history, 'missing feeder exchange')
  assert.equal(history.promotedIds.length, history.relegatedIds.length)
  assert.ok(history.fixtures.every(game => !!game.result), 'unfinished playoff archived')
  assert.deepEqual(history, resumed.promotionHistory!.find(row => row.associationId === boundary), 'save/resume changed playoff')
  assert.ok(history.promotedIds.every(id => direct.clubs[id].tier === tier - 1))
  assert.ok(history.relegatedIds.every(id => direct.clubs[id].tier === tier))
}
assert.equal(direct.promotionHistory!.find(row => row.associationId === 'eng-2')!.fixtures.length, 5)
assert.equal(direct.promotionHistory!.find(row => row.associationId === 'eng-3')!.fixtures.length, 5)
assert.equal(direct.promotionHistory!.find(row => row.associationId === 'ger-2')!.fixtures.length, 2)
assert.equal(direct.promotionHistory!.find(row => row.associationId === 'sco-2')!.fixtures.length, 6)
assert.equal(direct.promotionHistory!.find(row => row.associationId === 'sco-3')!.fixtures.length, 6)

// A pre-expansion save gains new tiers without replacing its established top/second IDs.
const legacy = structuredClone(seed)
const original = structuredClone(legacy.competitions['second-eng'].entrantIds)
for (const country of Object.keys(groups)) {
  for (const club of Object.values(legacy.clubs).filter(item => item.associationId === country && (item.tier ?? 1) >= 3)) {
    delete legacy.clubs[club.id]; delete legacy.stadiums[club.stadiumId]; delete legacy.managers[`manager-${club.id}`]
    for (const player of Object.values(legacy.players).filter(item => item.clubId === club.id)) delete legacy.players[player.id]
    for (const prospect of Object.values(legacy.academyProspects).filter(item => item.clubId === club.id)) delete legacy.academyProspects[prospect.id]
  }
  for (const [level] of groups[country as keyof typeof groups]) {
    const id = `${level}-${country}`
    delete legacy.competitions[id]; delete legacy.standings[id]
    for (const game of Object.values(legacy.fixtures).filter(item => item.competitionId === id)) delete legacy.fixtures[game.id]
  }
}
const hydrated = advanceProWorldTo(legacy, '2026-08-02')
assert.deepEqual(hydrated.competitions['second-eng'].entrantIds, original)
for (const [country, divisions] of Object.entries(groups)) for (const [level, count] of divisions)
  assert.equal(hydrated.competitions[`${level}-${country}`].entrantIds.length, count)
console.log('Five national feeder divisions: promotion, cups, season rollover, resume and legacy hydration passed')
