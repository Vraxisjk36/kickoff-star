import assert from 'node:assert/strict'
import { createYouthWorld } from '../src/engine/youthWorld'
import { buildSchoolCalendar,buildGrassrootsCalendar,mergeCalendarAfterElimination } from '../src/engine/careerCalendarV4'
import { createRegionalCamp,simulateNpcCampAssessments,recordCampAssessment,advanceRegionalCamp } from '../src/engine/regionalSelectionV4'
import { buildAcademySeason,reviewAcademyRole,proContractEligible } from '../src/engine/academyCareerV4'
import { buildCareerSummary } from '../src/engine/careerEndV4'

type Route='school'|'grassroots'
function simulate(seed:string,route:Route){
 const world=createYouthWorld(seed,'greenwood')
 let calendar=route==='school'?buildSchoolCalendar(1):buildGrassrootsCalendar(1)
 // Exercise elimination replacement rather than assuming a cup run.
 calendar=mergeCalendarAfterElimination(calendar,route,route==='school'?'regional-schools':'grassroots-cup',18)
 const schoolId=world.selectedSchoolId??world.schools[0].id
 let camp=createRegionalCamp(world,'north',{id:'user',name:'Sim Player',age:16,position:'ST',overall:60,schoolId},30)
 camp=simulateNpcCampAssessments(camp,world,1)
 camp=recordCampAssessment(camp,'user','technical',.72)
 camp=recordCampAssessment(camp,'user','position-test',.74)
 camp=advanceRegionalCamp(camp)
 if(camp.trialists.find(p=>p.id==='user')?.selected){
   camp=simulateNpcCampAssessments(camp,world,2)
   camp=recordCampAssessment(camp,'user','small-sided',.73)
   camp=recordCampAssessment(camp,'user','trial-match',.76)
   camp=advanceRegionalCamp(camp)
 }
 const academy=world.academyClubs[0],season=buildAcademySeason(academy,world.academyClubs,2030,17)
 const n=Number(seed.match(/(\\d+)$/)?.[1]??0)
 const profile=n%4===0?{averageRating:6.45,minutes:520,training:61,discipline:70,energy:66,positionCompetition:72}:n%4===1?{averageRating:6.85,minutes:760,training:69,discipline:76,energy:70,positionCompetition:64}:n%4===2?{averageRating:7.15,minutes:980,training:76,discipline:82,energy:74,positionCompetition:57}:{averageRating:7.55,minutes:1280,training:84,discipline:88,energy:79,positionCompetition:48}
 const review=reviewAcademyRole('rotation',profile)
 const developed={...season,proPathwayScore:review.proPathwayScore,releaseRisk:review.releaseRisk}
 const pro=proContractEligible(developed,18,63)
 const summary=buildCareerSummary({reason:pro?'professional-contract':'graduated-without-academy',age:18,finalOverall:63,peakOverall:65,matches:82,goals:19,assists:14,trophies:[],awards:[],representativeCaps:camp.finalSquadIds.includes('user')?3:0})
 return{route,events:calendar.events.length,regional:camp.finalSquadIds.includes('user'),pro,legacy:summary.legacyScore}
}
const runs=Array.from({length:24},(_,i)=>simulate(`career-${i}`,i%2?'school':'grassroots'))
assert(runs.every(r=>r.events>20))
assert(runs.some(r=>r.route==='school')&&runs.some(r=>r.route==='grassroots'))
assert(runs.every(r=>r.legacy>0))
const proCount=runs.filter(r=>r.pro).length
assert(proCount>0,'strong academy careers must be able to reach a professional contract')
assert(proCount<runs.length,'not every simulated academy career should earn a professional contract')
const weakSeason={...buildAcademySeason(createYouthWorld('weak-pro',null,1,'school','eng').academyClubs[0],createYouthWorld('weak-pro',null,1,'school','eng').academyClubs,2030,18),proPathwayScore:48,releaseRisk:58}
assert.equal(proContractEligible(weakSeason,18,61),false,'average/weak academy careers must not receive automatic pro contracts')
console.log('V5 career simulation audit passed',{careers:runs.length,school:runs.filter(r=>r.route==='school').length,grassroots:runs.filter(r=>r.route==='grassroots').length,regionalSelections:runs.filter(r=>r.regional).length,proContracts:runs.filter(r=>r.pro).length})
