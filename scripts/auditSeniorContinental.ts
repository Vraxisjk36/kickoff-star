import assert from 'node:assert/strict'
import { createProWorld } from '../src/engine/proWorldFactory'
import { beginContinentalSeason, advanceTournamentsTo, recordTournamentResult } from '../src/engine/proTournaments'

const confeds=['uefa','caf','conmebol','concacaf','afc','ofc'] as const
const world=createProWorld(714,'2026-08-01')
beginContinentalSeason(world,2026)
// All full and simulated league associations feed the continental entry field.
for(const confederation of confeds) {
  const comp=world.competitions[`continental-${confederation}`]
  const fields={uefa:36,caf:16,conmebol:32,concacaf:16,afc:24,ofc:8}
  const target=fields[confederation]
  assert.ok(comp.entrantIds.length>=target)
  if(comp.entrantIds.length>target){
    assert.equal(comp.tournament?.stage,'qualifying')
    assert.equal(comp.tournament?.qualifyingTarget,target)
    const ties=Object.values(world.fixtures).filter(f=>f.competitionId===comp.id)
    assert.ok(ties.length%2===0,'Every preliminary tie must have both legs')
    const pairs=new Map<string,number>()
    for(const tie of ties){
      const key=[tie.homeId,tie.awayId].sort().join('|')
      pairs.set(key,(pairs.get(key)??0)+1)
    }
    assert.ok([...pairs.values()].every(count=>count===2),
      'Every preliminary opponent pairing needs exactly two legs')
  }
  const associations=Object.values(world.associations).filter(a=>a.confederation===confederation &&
    world.standings[`top-${a.id}`]?.length)
  for(const association of associations){
    const champion=[...world.standings[`top-${association.id}`]]
      .sort((a,b)=>b.points-a.points||a.clubId.localeCompare(b.clubId))[0]?.clubId
    // The domestic champion must at least reach the initial qualifying field.
    if(champion)assert.ok(comp.entrantIds.includes(champion),
      `${association.id} domestic champion excluded from ${confederation} qualification`)
  }
}
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
// Validate the real human-player cup interface for every continental tier,
// including the three UEFA routes and both CAF routes. A generated fixture
// must be playable and must not be recorded twice.
import { pendingProCup, resolveProCup } from '../src/engine/proIntegration'
import type { ProCareerState } from '../src/engine/proCareer'
import type { Player } from '../src/types/player'
for(const id of allCompIds){
  const fixture=Object.values(world.fixtures).find(f=>f.competitionId===id&&!f.result)!
  assert.ok(fixture,`${id}: no playable fixture`)
  const player={id:'continental-audit',name:'Audit',position:'ST',squadRole:'starting-xi'} as Player
  const state={backgroundWorld:world,date:fixture.kickoffDate,week:1,season:1,
    world:{playerTeamId:'audit-team'},clubWorldIds:{'audit-team':fixture.homeId}} as ProCareerState
  const pending=pendingProCup(state)
  assert.equal(pending?.id,fixture.id,`${id}: player cannot access continental fixture`)
  const outcome=resolveProCup(state,player,fixture.id,{scored:2,conceded:1,goals:1,assists:0,rating:8.5,energy:80,minutes:90,yellowCards:0,redCarded:false})
  assert.ok(outcome,`${id}: human match result rejected`)
  assert.equal(outcome.record.competitionId,id)
  assert.equal(outcome.state.backgroundWorld?.fixtures[fixture.id].result?.homeGoals,2)
  assert.equal(resolveProCup(outcome.state,player,fixture.id,{scored:2,conceded:1,goals:1,assists:0,rating:8.5,energy:80,minutes:90,yellowCards:0,redCarded:false}),null,`${id}: duplicate result accepted`)
}

const sample=Object.values(world.fixtures).find(f=>f.competitionId==='continental-caf')!
assert.ok(recordTournamentResult(world,sample.id,2,1),'CAF fixture result must record')
assert.equal(world.fixtures[sample.id].result?.homeGoals,2)
assert.equal(recordTournamentResult(world,sample.id,9,9),false,
  'Continental fixtures must not count repeated results')
advanceTournamentsTo(world,'2028-12-31')
for(const id of allCompIds){
  const tournament=world.competitions[id].tournament
  assert.equal(tournament?.completed,true,`${id}: knockout bracket did not reach a champion`)
  const titles=world.championHistory.filter(h=>h.competitionId===id&&h.seasonId==='2026')
  assert.equal(titles.length,1,`${id}: expected exactly one champion`)
  assert.ok(world.competitions[id].entrantIds.includes(titles[0].championId),
    `${id}: champion was not in the field`)
}
console.log('Thirteen continental club competitions across UEFA, CAF, CONMEBOL, CONCACAF, AFC and OFC validated')
