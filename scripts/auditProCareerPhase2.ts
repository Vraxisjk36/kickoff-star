import assert from 'node:assert/strict'
import { createProCareer, proRound, proTrialClubs, PRO_CAREER_DESTINATIONS } from '../src/engine/proCareer'
import { plannedClubCount } from '../src/engine/proWorldFactory'
import { PRO_INTERACTIVE_COUNTRIES, canStartInteractiveProCareer } from '../src/engine/proLeagueRegistry'

assert.equal(PRO_INTERACTIVE_COUNTRIES.length, 10, 'Phase 2 must permit ten professional destinations')
assert.equal(new Set(PRO_INTERACTIVE_COUNTRIES).size, 10)
for (const destination of PRO_CAREER_DESTINATIONS) {
  const country = destination.id
  assert.ok(canStartInteractiveProCareer(country), `${country} unavailable`)
  const offers = proTrialClubs(6, country)
  assert.equal(offers.length, 4)
  assert.equal(new Set(offers.map(club => club.name)).size, 4)
  const career = createProCareer(offers[0].name, 5, country)
  assert.equal(career.associationId, country)
  const division = career.world.divisions[1]
  const count = plannedClubCount(country)
  assert.equal(division.teams.length, count, `${country} wrong club count`)
  assert.equal(new Set(division.teams.map(team => team.id)).size, count)
  assert.equal(new Set(division.teams.map(team => team.name)).size, count)
  assert.equal(division.fixtures.length, count * (count - 1))
  assert.equal(division.standings.length, count)
  assert.ok(division.teams.some(team => team.id === career.world.playerTeamId))
  const opponents = new Map<string, Set<string>>()
  for (const match of division.fixtures) {
    assert.notEqual(match.homeTeamId, match.awayTeamId)
    const key = [match.homeTeamId, match.awayTeamId].sort().join(':')
    const homes = opponents.get(key) ?? new Set<string>()
    assert.ok(!homes.has(match.homeTeamId), `${country}: repeated home tie ${key}`)
    homes.add(match.homeTeamId)
    opponents.set(key, homes)
  }
  assert.equal(opponents.size, count * (count - 1) / 2)
  for (const homes of opponents.values()) assert.equal(homes.size, 2)
  const activeRounds = Array.from({length:44},(_,i)=>proRound(i+1,count)).filter((round):round is number=>round!==null)
  assert.equal(activeRounds.length, (count - 1) * 2, `${country} match calendar incomplete`)
  assert.equal(new Set(activeRounds).size, activeRounds.length)
}
assert.equal(createProCareer('North London Athletic').associationId, 'eng', 'Old pro careers must default to England')
assert.equal(proRound(4,10), 1, 'Legacy ten-team week alignment changed')
console.log('Phase 2: ten countries, trial contracts, fixtures, round calendars and legacy saves passed')
