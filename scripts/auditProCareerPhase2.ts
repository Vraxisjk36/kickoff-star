import assert from 'node:assert/strict'
import type { Player } from '../src/types/player'
import type { ProWorldState } from '../src/engine/proWorld'
import { createProCareer, advanceProWeek, proRound, proTrialClubs, PRO_CAREER_DESTINATIONS } from '../src/engine/proCareer'
import { plannedClubCount, createProWorld } from '../src/engine/proWorldFactory'
import { recordHumanProLeagueMatch } from '../src/engine/proWorldSimulation'
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

const worldSeed = createProWorld(1907, '2026-08-01')
const firstFixture = Object.values(worldSeed.fixtures).find(f => f.competitionId === 'top-esp')!
assert.ok(firstFixture)
const beforeRows = worldSeed.standings['top-esp']
const updated = recordHumanProLeagueMatch(worldSeed, 'esp', firstFixture.homeId,
  firstFixture.awayId, 4, 1)
assert.equal(worldSeed.fixtures[firstFixture.id].result, undefined, 'Human result mutated the original save')
assert.deepEqual(updated.fixtures[firstFixture.id].result, {homeGoals:4,awayGoals:1})
const homeBefore = beforeRows.find(row=>row.clubId===firstFixture.homeId)!
const awayBefore = beforeRows.find(row=>row.clubId===firstFixture.awayId)!
const homeAfter = updated.standings['top-esp'].find(row=>row.clubId===firstFixture.homeId)!
const awayAfter = updated.standings['top-esp'].find(row=>row.clubId===firstFixture.awayId)!
assert.equal(homeAfter.points, homeBefore.points+3)
assert.equal(awayAfter.points, awayBefore.points)
assert.equal(homeAfter.goalsFor, homeBefore.goalsFor+4)
assert.equal(awayAfter.goalsAgainst, awayBefore.goalsAgainst+4)
assert.equal(recordHumanProLeagueMatch(updated,'esp',firstFixture.homeId,
  firstFixture.awayId,4,1), updated, 'Replaying human result should be idempotent')
const correction = recordHumanProLeagueMatch(updated,'esp',firstFixture.homeId,
  firstFixture.awayId,0,2)
assert.equal(correction.standings['top-esp'].find(row=>row.clubId===firstFixture.homeId)!.points,homeBefore.points)
assert.equal(correction.standings['top-esp'].find(row=>row.clubId===firstFixture.awayId)!.points,awayBefore.points+3)
console.log('Phase 2: human national-league result reconciled, corrected and saved deterministically')

let seniorCareer = createProCareer('South London Blue',5,'eng')
seniorCareer.backgroundWorld = {} as ProWorldState // salary-accounting stub; no living-world advancement
let seniorPlayer = {
  id:'phase2-retirement',name:'Pro Career Tester',careerClock:{ageYears:37,phase:'academy'},
  position:'CM',fitness:{stamina:100},money:0,careerEarnings:0,
  totalWeeksElapsed:0,seasonAppearances:29,seasonGoals:6,seasonAssists:11,
} as unknown as Player
for(let i=0;i<44;i++){
  const result=advanceProWeek(seniorCareer,seniorPlayer)
  seniorCareer=result.state
  seniorPlayer=result.player
}
assert.equal(seniorCareer.retired,true,'Age-38 retirement did not trigger')
assert.equal(seniorPlayer.careerClock.ageYears,38)
assert.equal(seniorCareer.seasonRecords?.length,1)
assert.equal(seniorCareer.seasonRecords?.[0].appearances,29)
assert.equal(seniorCareer.seasonRecords?.[0].goals,6)
assert.equal(seniorCareer.seasonRecords?.[0].assists,11)
assert.equal(advanceProWeek(seniorCareer,seniorPlayer).state,seniorCareer,
  'Retired career may not advance')
console.log('Phase 2: senior season archive and retirement lifecycle passed')
