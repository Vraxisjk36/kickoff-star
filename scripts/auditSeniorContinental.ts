import assert from 'node:assert/strict'
import { createProWorld } from '../src/engine/proWorldFactory'
import { beginContinentalSeason, recordTournamentResult } from '../src/engine/proTournaments'

const confeds=['uefa','caf','conmebol','concacaf','afc','ofc'] as const
const world=createProWorld(714,'2026-08-01')
beginContinentalSeason(world,2026)
const allCompIds=new Set<string>()
for(const confederation of confeds){
  const ids=[`continental-${confederation}`,`union-${confederation}`,
    ...(confederation==='uefa'?['conference-uefa']:[])]
  const occupied=new Set<string>()
  for(const id of ids){
    const comp=world.competitions[id]
    assert.ok(comp,`${id} competition missing`)
    assert.equal(comp.kind,'continental-club')
    assert.ok(comp.entrantIds.length>=8,`${id} insufficient entrants`)
    assert.equal(new Set(comp.entrantIds).size,comp.entrantIds.length,
      `${id} contains duplicate entrants`)
    for(const clubId of comp.entrantIds){
      assert.equal(world.associations[world.clubs[clubId].associationId].confederation,
        confederation,`${id} contains a foreign-confederation club`)
      assert.ok(!occupied.has(clubId),
        `${id} double-registers a club in two parallel continental tiers`)
      occupied.add(clubId)
    }
    const fixtureList=Object.values(world.fixtures).filter(f=>f.competitionId===id)
    assert.ok(fixtureList.length>0,`${id} schedule not generated`)
    const doubleBooked=new Set<string>()
    for(const fixture of fixtureList){
      assert.notEqual(fixture.homeId,fixture.awayId)
      assert.ok(comp.entrantIds.includes(fixture.homeId)&&comp.entrantIds.includes(fixture.awayId))
      for(const clubId of [fixture.homeId,fixture.awayId]){
        const key=`${clubId}:${fixture.kickoffDate}`
        assert.ok(!doubleBooked.has(key),`${id} double-books ${key}`)
        doubleBooked.add(key)
      }
      // UEFA-style continental group/league fixtures should be on Tue/Wed/Thu.
      if(confederation==='uefa'&&comp.tournament?.stage!=='knockout'){
        const dow=new Date(`${fixture.kickoffDate}T00:00:00Z`).getUTCDay()
        assert.ok([2,3,4].includes(dow),`${id} scheduled off European midweek`)
      }
    }
    allCompIds.add(id)
  }
}
assert.equal(allCompIds.size,13)
const sample=Object.values(world.fixtures).find(f=>f.competitionId==='continental-caf')!
assert.ok(recordTournamentResult(world,sample.id,2,1),'CAF fixture result must record')
assert.equal(world.fixtures[sample.id].result?.homeGoals,2)
assert.equal(recordTournamentResult(world,sample.id,9,9),false,
  'Continental fixtures must not count repeated results')
console.log('Thirteen continental club competitions across UEFA, CAF, CONMEBOL, CONCACAF, AFC and OFC validated')
