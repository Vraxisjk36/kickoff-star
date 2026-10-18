import assert from 'node:assert/strict'
import { PRO_DEEP_LEAGUE_PLAN, PRO_LEAGUE_PLAN, PRO_LOWER_LEAGUE_PLAN } from '../src/engine/proLeagueRegistry'
import { createProWorld } from '../src/engine/proWorldFactory'
import { advanceProWorldTo } from '../src/engine/proWorldSimulation'

const leagues = [...PRO_LEAGUE_PLAN, ...PRO_LOWER_LEAGUE_PLAN, ...PRO_DEEP_LEAGUE_PLAN]
const initial = createProWorld(23, '2026-08-01')
assert.equal(PRO_LEAGUE_PLAN.length, 100)
function inspectFixtures(world: typeof initial) {
  const byCompetition = new Map<string, typeof initial.fixtures[string][]>()
  const occupied = new Set<string>()
  for (const fixture of Object.values(world.fixtures)) {
    if (['top-', 'second-', 'third-', 'fourth-'].some(prefix => fixture.competitionId.startsWith(prefix))) {
      const group = byCompetition.get(fixture.competitionId) ?? []
      group.push(fixture); byCompetition.set(fixture.competitionId, group)
    }
    for (const clubId of [fixture.homeId, fixture.awayId]) {
      const key = `${clubId}:${fixture.kickoffDate}`
      assert.ok(!occupied.has(key), `club double-booked: ${key} (${fixture.competitionId})`)
      occupied.add(key)
    }
  }
  for (const league of leagues) {
    const comp = world.competitions[league.id]
    const fixtures = byCompetition.get(league.id) ?? []
    const clubCount = comp.entrantIds.length
    const split = league.id === 'top-sco' && comp.splitScheduled
    assert.equal(fixtures.length, clubCount * (clubCount - 1) * (league.id === 'top-sco' ? 3 : league.associationId === 'sco' ? 4 : 2) / 2 + (split ? 30 : 0),
      `${league.id} fixture count`)
    const pairings = new Map<string, number>()
    const home = new Map<string, number>(), away = new Map<string, number>()
    for (const fixture of fixtures) {
      assert.ok(comp.entrantIds.includes(fixture.homeId) && comp.entrantIds.includes(fixture.awayId), `${league.id} nonmember`)
      assert.notEqual(fixture.homeId, fixture.awayId)
      const pair = [fixture.homeId, fixture.awayId].sort().join(':')
      pairings.set(pair, (pairings.get(pair) ?? 0) + 1)
      home.set(fixture.homeId, (home.get(fixture.homeId) ?? 0) + 1)
      away.set(fixture.awayId, (away.get(fixture.awayId) ?? 0) + 1)
    }
    for (const count of pairings.values()) assert.ok(league.id === 'top-sco' ? count === 3 || split && count === 4 :
      count === (league.associationId === 'sco' ? 4 : 2),
      `${league.id} duplicate/missing pair`)
    for (const clubId of comp.entrantIds) {
      assert.equal((home.get(clubId) ?? 0) + (away.get(clubId) ?? 0), split ? 38 : league.id === 'top-sco' ? 33 : comp.format.scheduledRounds,
        `${league.id} club matches`)
      if (league.id !== 'top-sco') assert.equal(home.get(clubId), away.get(clubId), `${league.id} home/away balance`)
    }
  }
}
inspectFixtures(initial)
const yearOne = advanceProWorldTo(initial, '2027-10-01')
const yearTwo = advanceProWorldTo(yearOne, '2028-10-01')
const direct = advanceProWorldTo(initial, '2028-10-01')
for (const league of leagues) {
  assert.deepEqual(yearTwo.competitions[league.id].entrantIds, direct.competitions[league.id].entrantIds,
    `${league.id} resume changed season membership`)
  assert.deepEqual(yearTwo.standings[league.id], direct.standings[league.id], `${league.id} resume changed table`)
  assert.deepEqual(yearTwo.championHistory.filter(item => item.competitionId === league.id),
    direct.championHistory.filter(item => item.competitionId === league.id), `${league.id} resume changed champions`)
}
for (const world of [yearOne, yearTwo]) {
  inspectFixtures(world)
  for (const league of leagues) {
    const comp = world.competitions[league.id]
    assert.ok(world.championHistory.some(row => row.competitionId === league.id), `${league.id} has no champion`)
    assert.equal(world.standings[league.id].length, comp.entrantIds.length, `${league.id} standings mismatch`)
    assert.deepEqual(new Set(world.standings[league.id].map(row => row.clubId)), new Set(comp.entrantIds), `${league.id} members`)
    for (const row of world.standings[league.id]) {
      assert.equal(row.played, row.won + row.drawn + row.lost, `${league.id} table arithmetic`)
      assert.equal(row.points, row.won * 3 + row.drawn, `${league.id} points arithmetic`)
    }
  }
}
console.log(`${leagues.length} leagues, two season rollovers: unique fixtures, membership, standings and champions passed`)
