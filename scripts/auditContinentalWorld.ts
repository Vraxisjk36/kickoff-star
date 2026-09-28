import assert from 'node:assert/strict'
import { academyProfiles, academyTeam, EUROPEAN_ACADEMY_COUNTRIES } from '../src/engine/academyClubs'
import { advanceQualifierWeek, CONTINENTAL_QUALIFIER_WEEKS, initContinentalQualifier } from '../src/engine/continentalQualifier'
import { playerCupFixture } from '../src/engine/cup'
import { advanceWorldLeagues, worldLeagueChampions, worldLeagueLeaders } from '../src/engine/worldLeagues'
import { NATIONS } from '../src/engine/nations'

const team = academyTeam('esp', academyProfiles('esp')[0])
for (const route of ['senior', 'domestic'] as const) {
  let cup = initContinentalQualifier(team, route)
  assert.equal(cup.stage, 'qualifying')
  assert.equal(cup.teams.length, 116)
  assert.equal(new Set(cup.teams.map(t => t.academyClubKey)).size, 116)
  assert.ok(cup.teams.every(t => EUROPEAN_ACADEMY_COUNTRIES.some(country => country === t.countryId)))
  for (const week of CONTINENTAL_QUALIFIER_WEEKS) cup = advanceQualifierWeek(cup, 2, week)
  assert.equal(cup.stage, 'knockout')
  assert.equal(cup.teams.length, 32)
  assert.equal(cup.knockoutRounds[0].length, 16)
  assert.equal(cup.qualifier?.round, 6)
  assert.equal(cup.matchRecords?.length, 248)
  assert.equal(new Set(cup.teams.map(t => t.academyClubKey)).size, 32)
  assert.equal(playerCupFixture(cup) === null, cup.playerEliminated)
}
let world = advanceWorldLeagues(undefined, 1, 23, 'eng', true)
assert.equal(Object.keys(world.divisions).length, NATIONS.length - 1)
for (const division of Object.values(world.divisions)) {
  assert.equal(division.fixtures.filter(f => f.played).length, 90)
  assert.equal(division.matchRecords?.length, 90)
  assert.ok(division.standings.every(s => s.played === 18))
}
const leader = worldLeagueLeaders(world, 23)[0]
assert.ok(leader.appearances > 0 && leader.points > 0)
world = worldLeagueChampions(world)
assert.equal(world.champions.length, NATIONS.length - 1)
const next = advanceWorldLeagues(world, 2, 6, 'eng', true)
assert.equal(next.champions.length, world.champions.length)
assert.ok(next.divisions.rsa.standings.every(s => s.played === 1))
console.log('Playable continental routes, 32-club draw, 24 country school calendars and year rollover passed.')
