import assert from 'node:assert/strict'
import { NATIONS } from '../src/engine/nations'
import { SENIOR_NATIONS, seniorNation } from '../src/engine/seniorNations'
import { PRO_LEAGUE_PLAN, PRO_INTERACTIVE_COUNTRIES, canStartInteractiveProCareer } from '../src/engine/proLeagueRegistry'
import { PRO_SATELLITE_ASSOCIATIONS } from '../src/engine/proSatelliteRegistry'
import { INTERNATIONAL_GROUPS, internationalProgress, internationalTournamentFixture } from '../src/engine/proInternationalTournament'
import { confederationForNation, continentalNations, continentalRound } from '../src/engine/proContinentalNations'
import { createProWorld } from '../src/engine/proWorldFactory'
import { selectSeniorNationalSquad } from '../src/engine/proNationalSquad'
import { beginWorldQualifiers, beginWorldSeason } from '../src/engine/proTournaments'

assert.equal(NATIONS.length,24,'Youth country catalog must remain unchanged')
assert.equal(SENIOR_NATIONS.length,218,'Every professional-world association must have a national team')
assert.equal(new Set(SENIOR_NATIONS.map(n=>n.id)).size,218)
assert.deepEqual([...PRO_INTERACTIVE_COUNTRIES].sort(),['eng','esp','ger','fra','ita','ned','por','rsa','sco'].sort())
assert.equal(canStartInteractiveProCareer('bra'),false)
assert.ok(PRO_LEAGUE_PLAN.some(l=>l.associationId==='bra'),'Brazil stays simulated')
const ids=new Set([...PRO_LEAGUE_PLAN.map(l=>l.associationId),...PRO_SATELLITE_ASSOCIATIONS.map(a=>a.id)])
assert.deepEqual(new Set(SENIOR_NATIONS.map(n=>n.id)),ids)
assert.ok(INTERNATIONAL_GROUPS.every(g=>g.length>=2&&g.length<=4))
assert.equal(new Set(INTERNATIONAL_GROUPS.flat()).size,218)
for(const nation of SENIOR_NATIONS) {
  assert.ok(seniorNation(nation.id))
  assert.ok(confederationForNation(nation.id),`No confederation for ${nation.id}`)
  assert.ok(continentalNations(nation.id).includes(nation.id))
  const draw=internationalTournamentFixture(nation.id,1,12)
  assert.ok(draw,`No world qualifying fixture for ${nation.id}`)
  assert.notEqual(draw!.opponentId,nation.id)
  const squad=selectSeniorNationalSquad(nation.id,1,12)
  assert.equal(squad.members.length,23)
  assert.equal(new Set(squad.members.map(m=>m.id)).size,23)
}
const satellite=PRO_SATELLITE_ASSOCIATIONS.find(a=>a.id==='alb')!
assert.equal(confederationForNation(satellite.id),'uefa')
assert.ok(continentalRound(satellite.id,1,8).length>0)
const progress=internationalProgress('alb',1)
assert.equal(progress.qualifiers.length,4)
assert.equal(progress.finalists.length,8)
const world=createProWorld(217,'2026-08-01')
assert.equal(Object.keys(world.associations).length,218)
beginWorldQualifiers(world,2029)
for(const confederation of ['uefa','caf','conmebol','concacaf','afc','ofc']) {
  const comp=world.competitions[`qualifiers-${confederation}`]
  assert.ok(comp)
  const expected=Object.values(world.associations).filter(a=>a.confederation===confederation).length
  assert.equal(comp.entrantIds.length,expected)
  assert.equal(new Set(comp.entrantIds).size,expected)
}
beginWorldSeason(world,2030)
assert.equal(world.competitions['world-national'].entrantIds.length,48)
assert.equal(new Set(world.competitions['world-national'].entrantIds).size,48)
console.log('All 218 senior national teams, six confederations, worldwide qualifiers, 48 World Cup entrants and 9 career countries validated')
