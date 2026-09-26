import assert from 'node:assert/strict'
import { generateTeam } from '../src/engine/teams'
import { initOctoberLeague, octoberStandings, playerOctoberFixture, recordOctoberResult, simulateOctoberWeek } from '../src/engine/octoberLeague'

const teams = Array.from({ length: 5 }, (_, i) => ({ ...generateTeam(3), id: `oct-${i}`, name: `October ${i}` }))
let league = initOctoberLeague(2, teams[0].id, teams)
assert.ok(league)
for (let week = 36; week <= 39; week++) {
  const fixture = playerOctoberFixture(league, week)
  assert.ok(fixture)
  const opponentId = fixture.homeId === league.playerTeamId ? fixture.awayId : fixture.homeId
  if (week !== 38) league = recordOctoberResult(league, week, opponentId, 2, 1)
  league = simulateOctoberWeek(league, week)
  const once = JSON.stringify(league)
  assert.equal(JSON.stringify(simulateOctoberWeek(league, week)), once, 'week simulation must be safe across reloads')
  assert.notEqual(playerOctoberFixture(league, week)?.homeGoals, null)
}
assert.equal(league.fixtures.length, 10, 'five teams have ten single-leg pairings')
assert.equal(new Set([36, 37, 38, 39].map(week => {
  const f = playerOctoberFixture(league, week)!
  return f.homeId === league.playerTeamId ? f.awayId : f.homeId
})).size, 4, 'player faces four distinct clubs')
assert.equal(playerOctoberFixture(league, 36)?.homeGoals, 2, 'played result survives the weekly simulation')
assert.ok(octoberStandings(league).every(row => row.played === 4), 'all five clubs finish four league matches')
assert.equal(octoberStandings(league).reduce((sum, row) => sum + row.played, 0), 20)
assert.equal(JSON.parse(JSON.stringify(league)).fixtures.length, 10, 'the fixture ledger survives save serialization')
console.log('October league fixture, result, table and save checks passed')
