import assert from 'node:assert/strict'
import { createYouthWorld } from '../src/engine/youthWorld'
import { applyTrialOutcome } from '../src/engine/youthPathways'
import {
  groupStanding,
  initInterSchools,
  initMinorSchoolCup,
  initNationalChampionship,
  initRegionalSchools,
  initSundayLeague,
  nextFixtureForTeam,
  recordKnockoutResult,
  simulateGroupRound,
  simulateKnockoutRound,
  simulateLeagueRound,
  teamStanding,
} from '../src/engine/youthCompetitionsV4'
import {
  applyMatchdayFinances,
  applyMonthlyAllowance,
  buyYouthExpense,
  financeSummary,
  weeklyFinancePlan,
  workYouthJob,
} from '../src/engine/youthFinancesV4'

const seedWorld=createYouthWorld('layer56-audit',null,1,'school','eng')
let world=createYouthWorld('layer56-audit',seedWorld.schools[1].id,1,'school','eng')
world=applyTrialOutcome(world,.66).world

// V5 Inter-Schools: ten schools, home-and-away, 18 rounds.
let inter=initInterSchools(world)
assert.equal(inter.teams.length,10)
assert.equal(Math.max(...inter.fixtures.map(f=>f.round)),18)
let guard=0
while(!inter.complete&&guard++<25)inter=simulateLeagueRound(inter,world.seed)
assert.equal(inter.complete,true)
assert(inter.standings.every(s=>s.played===18))
assert(teamStanding(inter,world.selectedSchoolId!)!==null)

// Regional Schools Championship: 24 teams -> 4 groups of 6 -> QF -> SF -> Final.
let regional=initRegionalSchools(world)
assert.equal(regional.teams.length,24)
assert.equal(Object.keys(regional.groups).length,4)
assert(Object.values(regional.groups).every(g=>g.length===6))
guard=0
while(regional.stage!=='complete'&&guard++<20)regional=simulateGroupRound(regional,world.seed)
assert.equal(regional.stage,'complete')
assert(regional.championId)
assert.equal(regional.qualifiedTeamIds.length,8)
assert.equal(regional.eliminatedTeamIds.length,23)
assert(groupStanding(regional,world.selectedSchoolId!)!==undefined)

// National representative competition: 8 regions, 2 groups, semis, final.
let national=initNationalChampionship(world)
guard=0
while(national.stage!=='complete'&&guard++<15)national=simulateGroupRound(national,world.seed+'-national')
assert.equal(national.stage,'complete')
assert(national.championId)

// School Invitational: true 8-team knockout. The player's match can be played manually.
let minor=initMinorSchoolCup(world)
assert.equal(minor.teams.length,8)
const ownFixture=nextFixtureForTeam(minor.fixtures,world.selectedSchoolId!)
assert(ownFixture)
minor=recordKnockoutResult(minor,ownFixture!.id,2,1,world.seed)
guard=0
while(minor.stage!=='complete'&&guard++<8)minor=simulateKnockoutRound(minor,world.seed)
assert.equal(minor.stage,'complete')
assert(minor.championId)

// V5 Grassroots League: 12 teams, home-and-away, 22 rounds.
world={...world,pathway:{...world.pathway,sundayClubId:world.sundayClubs[0].id,route:'grassroots'}}
const sunday=initSundayLeague(world)
assert.equal(sunday.teams.length,12)
assert.equal(Math.max(...sunday.fixtures.map(f=>f.round)),22)

// Youth finance: monthly allowance exists but wages do not appear at age 14.
const opening=world.finances.balance
world=applyMonthlyAllowance(world,5,14)
assert(world.finances.balance>opening)
const plan14=weeklyFinancePlan(world,5,14,true,true)
assert.equal(plan14.expectedIncome>=0,true)

// Essential football can never kill a career: low funds get covered transparently.
const broke={...world,finances:{...world.finances,balance:0}}
const schoolTrip=applyMatchdayFinances(broke,{week:8,age:14,type:'school',away:true})
assert(schoolTrip.finances.balance>=0)
assert(schoolTrip.finances.transactions.some(t=>t.category==='club-support'))

const trialTrip=applyMatchdayFinances(broke,{week:43,age:14,type:'academy-trial',away:true})
assert(trialTrip.finances.balance>=0)
assert(trialTrip.finances.transactions.some(t=>t.category==='academy-support'))

// Sunday club transport support changes who pays; no youth wage before age 16.
const fullClub=world.sundayClubs.find(c=>c.transportSupport==='full')
if(fullClub){
  const supported={...world,pathway:{...world.pathway,sundayClubId:fullClub.id}}
  const before=supported.finances.balance
  const after=applyMatchdayFinances(supported,{week:10,age:14,type:'sunday',away:true})
  assert.equal(after.finances.balance,before)
  assert(!after.finances.transactions.some(t=>t.week===10&&t.category==='match-allowance'))
}

// Optional spending never overdraws; equipment is logistical, not a magic attribute purchase.
const poor={...world,finances:{...world.finances,balance:1}}
const recovery=buyYouthExpense(poor,12,'recovery-physio')
assert.equal(recovery.ok,false)
assert.equal(recovery.world.finances.balance,1)

// Odd jobs are age, fatigue and one-per-week gated.
const worked=workYouthJob(world,14,14,'carwash',90)
assert.equal(worked.ok,true)
assert((worked.energyCost??0)>0)
assert.equal(workYouthJob(worked.world,14,14,'carwash',90).ok,false)
assert.equal(workYouthJob(world,15,14,'carwash',35).ok,false)
assert.equal(workYouthJob(world,15,14,'shop-help',90).ok,false)

const fin=financeSummary(worked.world)
assert(fin.balance>=0)
assert(fin.totalEarned>opening)

console.log('V4 layers 5-6 audit passed')
console.log({
  interSchoolsChampion:inter.standings[0].teamId,
  regionalChampion:regional.championId,
  nationalChampion:national.championId,
  minorCupChampion:minor.championId,
  sundayRounds:Math.max(...sunday.fixtures.map(f=>f.round)),
  finance:fin,
})
