import assert from 'node:assert/strict'
import { createProWorld } from '../src/engine/proWorldFactory'
import { beginContinentalSeason, advanceTournamentsTo, recordTournamentResult } from '../src/engine/proTournaments'
import { PLAYABLE_CONTINENTAL_RULES, domesticContinentalBerths } from '../src/engine/proQualification'

const confeds=['uefa','caf','conmebol','concacaf','afc','ofc'] as const
const world=createProWorld(714,'2026-08-01')
// Freeze a deterministic completed 2025 domestic table for each playable league.
const frozen: Record<string, string[]> = {}
for (const country of Object.keys(PLAYABLE_CONTINENTAL_RULES)) {
  const id = `top-${country}`
  const table = [...world.standings[id]].map((row, index) => ({
    ...row, played: 38, won: 25-index, drawn: 4, lost: 9+index,
    points: 79-index*2, goalsFor: 75-index, goalsAgainst: 25+index,
  }))
  frozen[country] = table.map(row => row.clubId)
  world.seasonHistory.push({competitionId:id,seasonId:'2025',
    championId:frozen[country][0],table})
  // A domestic cup winner already in the Champions tier passes the berth down.
  world.championHistory.push({competitionId:`cup-${country}`,seasonId:'2025',
    championId:frozen[country][0]})
}
beginContinentalSeason(world,2026)
for (const [country, rule] of Object.entries(PLAYABLE_CONTINENTAL_RULES)) {
  const confederation = world.associations[country].confederation
  const domestic = domesticContinentalBerths(world,country,2026)
  const champions = world.competitions[`continental-${confederation}`].entrantIds
  const secondary = world.competitions[`union-${confederation}`].entrantIds
  const third = world.competitions['conference-uefa']?.entrantIds ?? []
  assert.deepEqual(domestic.champions,frozen[country].slice(0,rule.champions),
    `${country} domestic champions route should use completed rankings`)
  for(const club of domestic.champions) assert.ok(champions.includes(club),
    `${country} Champions berth must exist in the continental draw`)
  for(const club of domestic.secondary) assert.ok(secondary.includes(club),
    `${country} cup or league secondary berth must reach continental draw`)
  for(const club of domestic.third) assert.ok(third.includes(club),
    `${country} third-tier berth must reach continental draw`)
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
