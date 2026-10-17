import assert from 'node:assert/strict'
import { createProWorld } from '../src/engine/proWorldFactory'
import { advanceProWorldTo } from '../src/engine/proWorldSimulation'
import { PRO_LEAGUE_PLAN } from '../src/engine/proLeagueRegistry'
import { PRO_SATELLITE_ASSOCIATIONS } from '../src/engine/proSatelliteRegistry'
import { nationalCallupFixture, proCompetitionName } from '../src/engine/proTournaments'
import { advanceProDay, beginProTrial } from '../src/engine/proCareer'
import { proRoll } from '../src/engine/proWorldFactory'

const initial = createProWorld(42, '2026-01-01')
assert.equal(PRO_LEAGUE_PLAN.length, 75)
assert.equal(PRO_SATELLITE_ASSOCIATIONS.length, Object.values(initial.associations).length - 75)
assert.equal(Object.values(initial.associations).filter(item => item.confederation === 'uefa').length, 55)
assert.equal(Object.values(initial.associations).filter(item => item.confederation === 'caf').length, 54)
assert.equal(Object.values(initial.associations).filter(item => item.confederation === 'concacaf').length, 41)
assert.equal(Object.values(initial.associations).filter(item => item.confederation === 'afc').length, 47)
assert.equal(Object.values(initial.associations).filter(item => item.confederation === 'ofc').length, 11)
const drawn = advanceProWorldTo(initial, '2026-09-01')
assert.equal(drawn.competitions['conference-uefa'].entrantIds.length, 36)
assert.equal(drawn.competitions['nations-uefa'].entrantIds.length, 55)
assert.equal(Object.values(advanceProWorldTo(initial, '2026-06-01').fixtures)
  .filter(item => item.competitionId === 'world-national').length, 72)
assert.equal(drawn.competitions['nations-concacaf'].entrantIds.length, 41)
assert.equal(proCompetitionName('conference-uefa'), 'European Conference Series')
assert.equal(proCompetitionName('cup-eng'), 'England Cup')
for (const id of ['league-cup-eng', 'league-cup-sco', 'super-cup-eng', 'super-cup-fra', 'super-cup-esp'])
  assert.ok(drawn.competitions[id]?.entrantIds.length >= 2, `${id} missing`)
const european = ['continental-uefa', 'union-uefa', 'conference-uefa'].map(id => drawn.competitions[id].entrantIds)
assert.equal(new Set(european.flat()).size, 108, 'a club entered more than one European tier')
assert.equal(Object.values(drawn.fixtures).filter(item => item.competitionId === 'conference-uefa').length, 108)
const earlyCup = advanceProWorldTo(initial, '2026-02-01')
const cupFixture = Object.values(earlyCup.fixtures).find(item => item.competitionId === 'cup-eng')!
const matchday = advanceProWorldTo(earlyCup, cupFixture.kickoffDate)
const candidate = Object.values(matchday.players).find(item => item.clubId === cupFixture.homeId &&
  proRoll(matchday.seed, `${item.id}:${cupFixture.kickoffDate}:performance`) > .87) ??
  Object.values(matchday.players).find(item => item.clubId === cupFixture.homeId)!
const career = { ...beginProTrial(cupFixture.kickoffDate), stage: 'signed' as const,
  playerId: candidate.id, clubId: candidate.clubId, trust: 70, energy: 90 }
const played = advanceProDay(matchday, career, 'rest', 'eng')
const matchResult = played.world.fixtures[cupFixture.id]?.result
const recorded = played.world.recentEvents.find(item => item.id === `event-${cupFixture.id}`)
const homeGoals = Number(matchResult?.homeGoals ?? recorded?.details.homeGoals ?? 0)
assert.ok(played.career.goals <= homeGoals, 'a personal goal cannot exceed the team cup score')

const background = PRO_SATELLITE_ASSOCIATIONS.find(item => item.confederation === 'uefa')!
assert.ok(!drawn.competitions['national-uefa'], 'European championship should not run in 2026')
assert.ok(drawn.competitions['nations-uefa'].entrantIds.includes(background.id))
assert.equal(nationalCallupFixture(drawn, Object.keys(drawn.players)[0], background.id, '2026-09-24'), null)
const twoYears = advanceProWorldTo(drawn, '2028-01-01')
assert.ok(twoYears.championHistory.some(item => item.competitionId === 'conference-uefa' && item.seasonId === '2026'))
assert.ok(twoYears.championHistory.some(item => item.competitionId === 'nations-uefa' && item.seasonId === '2026'))
const divisions = Object.values(twoYears.nationsTier ?? {}).reduce((totals, tier) => {
  totals[tier] = (totals[tier] ?? 0) + 1; return totals
}, {} as Record<number, number>)
assert.deepEqual(divisions, { 0: 16, 1: 16, 2: 16, 3: 7 })
assert.ok(Object.keys(twoYears.nationsTier ?? {}).some(id => twoYears.nationsTier?.[id] !== drawn.nationsTier?.[id]),
  'European Nations League never promoted or relegated a side')
const americanDivisions = Object.values(twoYears.concacafNationsTier ?? {}).reduce((totals, tier) => {
  totals[tier] = (totals[tier] ?? 0) + 1; return totals
}, {} as Record<number, number>)
assert.deepEqual(americanDivisions, { 0: 16, 1: 16, 2: 9 })
assert.ok(Object.keys(twoYears.concacafNationsTier ?? {}).some(id =>
  twoYears.concacafNationsTier?.[id] !== drawn.concacafNationsTier?.[id]),
  'North American Nations League never promoted or relegated a side')
assert.ok(twoYears.championHistory.some(item => item.competitionId === 'nations-concacaf' && item.seasonId === '2026'))
const fourYears = advanceProWorldTo(twoYears, '2030-01-01')
for (const region of ['uefa','caf','conmebol','ofc'])
  assert.ok(fourYears.championHistory.some(item => item.competitionId === `national-${region}` && item.seasonId === '2028'))
assert.ok(!fourYears.championHistory.some(item => item.competitionId === 'national-uefa' && item.seasonId === '2029'))
for (const region of ['uefa','caf','conmebol','concacaf','afc','ofc']) {
  assert.ok(fourYears.championHistory.some(item => item.competitionId === `qualifiers-${region}` && item.seasonId === '2029'))
}
const world = advanceProWorldTo(fourYears, '2030-06-01')
assert.equal(world.competitions['world-national'].entrantIds.length, 48)
assert.deepEqual(world.competitions['world-national'].entrantIds,
  advanceProWorldTo(advanceProWorldTo(initial, '2029-09-01'), '2030-06-01').competitions['world-national'].entrantIds)
assert.ok(JSON.stringify(world).length < 32 * 1024 * 1024)
console.log(`Pro Phase 6: ${Object.keys(world.associations).length} associations, three European tiers, extra cups, Nations League and six qualifying regions passed`)
