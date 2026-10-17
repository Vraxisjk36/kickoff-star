import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { createProWorld } from '../src/engine/proWorldFactory'
import { advanceProWorldTo } from '../src/engine/proWorldSimulation'
import { advanceProDay, beginProTrial, beginYouthProOffers, chooseProAgent, openProTalks, resolveProOpportunity, signProOffer } from '../src/engine/proCareer'
import { EMPTY_CUPS, readSave, SAVE_SCHEMA_VERSION, writeSave } from '../src/engine/save'

let world = createProWorld(44, '2026-07-01')
let career = beginProTrial(world.currentDate)
for (let index = 0; index < 21; index++) {
  const state = advanceProDay(world, career, index % 4 === 0 ? 'recover' : 'train', 'rsa')
  world = state.world; career = state.career
}
assert.equal(career.stage, 'offers')
assert.equal(career.trialDay, 21)
assert.equal(career.offers.length, 4)
assert.equal(new Set(career.offers.map(offer => offer.clubId)).size, 4)
assert.throws(() => advanceProDay(world, career, 'rest', 'rsa'))
assert.throws(() => signProOffer(world, career, career.offers[0].clubId,
  { id: 'audit', name: 'Test Striker', nationalityId: 'rsa', position: 'ST', overall: 53, age: 18 }),
  'a direct pro player cannot bypass negotiations')
career = openProTalks(world, chooseProAgent(career, 'family'), career.offers[0].clubId)
while (career.talks?.status === 'pending') {
  const result = advanceProDay(world, career, 'rest', 'rsa'); world = result.world; career = result.career
}
const signed = signProOffer(world, career, career.offers[0].clubId,
  { id: 'audit', name: 'Test Striker', nationalityId: 'rsa', position: 'ST', overall: 53, age: 18 })
world = signed.world; career = signed.career
assert.equal(career.stage, 'signed')
assert.ok(world.players[career.playerId!]?.shirtNumber > 24)
assert.throws(() => signProOffer(world, career, 'other', { id: 'audit', name: 'Test', nationalityId: 'rsa', position: 'ST', overall: 50, age: 18 }))
for (let index = 0; index < 80; index++) {
  if (career.pendingEvent) career = resolveProOpportunity(career, index % 2 as 0 | 1)
  const state = advanceProDay(world, career,
    career.injuryUntil && career.injuryUntil >= career.date || index % 3 === 0 ? 'recover' : 'train', 'rsa')
  world = state.world; career = state.career
}
assert.ok(career.appearances >= 1)
assert.ok(career.days.length <= 90)
assert.ok(career.reputation > 10)
assert.equal(world.currentDate, career.date)
const youth = beginYouthProOffers(world, world.currentDate, 'rsa', 68)
assert.equal(youth.offers.length, 4)
const save = { schemaVersion: SAVE_SCHEMA_VERSION, slotId: 2 as const, savedAt: new Date().toISOString(),
  player: { id: 'audit' } as never, calendar: { currentWeek: { weekNumber: 1, seasonYear: 1, events: [] }, history: [] },
  league: null, academyLeague: null, cups: EMPTY_CUPS, international: null, pendingTraining: null, proWorld: world, proCareer: career }
await writeSave(save)
assert.deepEqual((await readSave(2))?.proCareer, career)
assert.equal((await readSave(2))?.proWorld?.players[career.playerId!]?.clubId, career.clubId)
const long = advanceProWorldTo(world, '2061-01-01')
assert.ok(long.retirementCount > 10_000, 'old players retire')
assert.equal(long.retirementCount, long.academyGraduateCount + long.transferIntakeCount, 'all vacancies are filled')
assert.equal(Object.values(long.players).filter(player => player.clubId).length, Object.keys(createProWorld(44, '2026-07-01').players).length + 1)
assert.equal(Object.keys(long.academyProspects).length, Object.keys(long.clubs).length * 2)
assert.ok(long.academyGraduateCount > 0 && long.transferIntakeCount > long.academyGraduateCount)
assert.ok(JSON.stringify(long).length < 32 * 1024 * 1024)
console.log(`Pro lifecycle: trial, offers, save, ${long.retirementCount} retirements, ${long.transferIntakeCount} signings and ${long.academyGraduateCount} academy graduates across 35 years passed`)
