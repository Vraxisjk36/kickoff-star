import assert from 'node:assert/strict'
import { PRO_LEAGUE_PLAN, validateProLeaguePlan } from '../src/engine/proLeagueRegistry'
import { PRO_SATELLITE_ASSOCIATIONS } from '../src/engine/proSatelliteRegistry'
import { createProWorld } from '../src/engine/proWorldFactory'
import { advanceProWorldTo } from '../src/engine/proWorldSimulation'

const added = 'ukr rou hun bul irl fin zwe eth rwa lby ben bfa hti cur dom sur guy jor oma bhr kwt mas phi sol png'.split(' ')
assert.equal(added.length, 25)
assert.deepEqual(validateProLeaguePlan(), [])
assert.equal(PRO_LEAGUE_PLAN.filter(league => league.mode === 'playable').length, 30)
assert.equal(PRO_LEAGUE_PLAN.filter(league => league.mode === 'simulated').length, 70)
assert.equal(PRO_SATELLITE_ASSOCIATIONS.length, 118)
const world = createProWorld(214, '2026-08-01')
assert.equal(Object.keys(world.associations).length, 218)
for (const id of added) {
  assert.equal(world.associations[id].domesticMode, 'full')
  assert.ok(world.competitions[`top-${id}`].entrantIds.length >= 12)
}
const old = structuredClone(world)
const oldClub = old.clubs['club-eng-01']
const title = { competitionId: 'top-eng', seasonId: '2025', championId: oldClub.id }
old.championHistory.push(title)
for (const id of added) {
  old.associations[id].domesticMode = 'background'
  delete old.competitions[`top-${id}`]
  delete old.standings[`top-${id}`]
}
for (const [id, fixture] of Object.entries(old.fixtures)) if (added.includes(fixture.competitionId.slice(4))) delete old.fixtures[id]
for (const [id, club] of Object.entries(old.clubs)) if (added.includes(club.associationId)) {
  delete old.clubs[id]
  delete old.stadiums[club.stadiumId]
  delete old.managers[`manager-${id}`]
}
for (const [id, player] of Object.entries(old.players)) if (player.clubId && !old.clubs[player.clubId]) delete old.players[id]
for (const [id, prospect] of Object.entries(old.academyProspects)) if (!old.clubs[prospect.clubId]) delete old.academyProspects[id]
const migrated = advanceProWorldTo(old, '2026-08-02')
assert.ok(migrated.championHistory.some(record => record.competitionId === title.competitionId &&
  record.seasonId === title.seasonId && record.championId === title.championId))
assert.deepEqual(migrated.clubs[oldClub.id], oldClub)
assert.equal(Object.keys(migrated.associations).length, 218)
assert.equal(Object.keys(migrated.clubs).length, Object.keys(world.clubs).length)
for (const id of added) {
  assert.equal(migrated.associations[id].domesticMode, 'full')
  assert.equal(migrated.competitions[`top-${id}`].entrantIds.length, world.competitions[`top-${id}`].entrantIds.length)
}
console.log('25 new background countries, 218 stable associations, and legacy-world migration passed')
