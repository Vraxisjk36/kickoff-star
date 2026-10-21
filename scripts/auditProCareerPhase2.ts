import { nextProMilestone } from '../src/engine/proMilestones'
import { allPlayableRecordCatalog, proLeagueRecords, worldPlayerAwards } from '../src/engine/proHonours'
import { proWorldClubIdentity } from '../src/engine/proWorldFactory'
import { seniorTrialOffers } from '../src/engine/proTrialOffers'
import assert from 'node:assert/strict'
import type { Player } from '../src/types/player'
import type { ProWorldState } from '../src/engine/proWorld'
import { createProCareer, advanceProWeek, professionalSeasonWeeks, proRound, proFixture, resolveProMatch, proTrialClubs, PRO_CAREER_DESTINATIONS, seniorTrialPoints } from '../src/engine/proCareer'
import { plannedClubCount, createProWorld } from '../src/engine/proWorldFactory'
import { recordHumanProLeagueMatch } from '../src/engine/proWorldSimulation'
import { syncPlayableProLeague, offerProRenewal, releaseExpiredProContract, generateMarketOffers, finalizeProMove } from '../src/engine/proIntegration'
import { scheduleSeniorInternational, completeSeniorInternational, forfeitSeniorInternational } from '../src/engine/proInternational'
import { INTERNATIONAL_GROUPS, INTERNATIONAL_WINDOWS, internationalCycle, internationalTournamentFixture, internationalProgress, visibleQualifyingTable } from '../src/engine/proInternationalTournament'
import { NATIONS } from '../src/engine/nations'
import { SENIOR_NATIONS } from '../src/engine/seniorNations'
import { prepareProGraduate, proRatingTarget, seniorNationalTeamRating, calibrateSeniorTeam } from '../src/engine/proRatings'
import { proWeekSchedule, proMatchDay, proTrainingAvailable, mondayFrom } from '../src/engine/proWeeklySchedule'
import { teamOverall } from '../src/engine/teams'
import { PRO_TOP_FLIGHT_IDENTITIES, proClubIdentity, renameLegacyProClubs } from '../src/engine/proClubIdentities'
import { professionalDecisionModifier } from '../src/engine/matchDecisions'
import { simulateMatchV2 } from '../src/engine/matchSimulationV2'
import { toOvr, computeCurrentAbility } from '../src/engine/rating'
import { selectSeniorNationalSquad } from '../src/engine/proNationalSquad'
import { seniorNationRankings } from '../src/engine/proNationalRankings'
import { buildNationalWorldResults, seniorWorldNationRankings } from '../src/engine/proNationWorldRankings'
import { CONTINENTAL_WINDOWS, continentalCycle, continentalNations, continentalRound, continentalNationsProgress, confederationForNation } from '../src/engine/proContinentalNations'
import { PRO_INTERACTIVE_COUNTRIES, PRO_LEAGUE_PLAN, canStartInteractiveProCareer } from '../src/engine/proLeagueRegistry'

assert.equal(PRO_INTERACTIVE_COUNTRIES.length, 9, 'Initial Phase 2 release must permit nine professional destinations')
assert.equal(new Set(PRO_INTERACTIVE_COUNTRIES).size, 9)
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
  assert.equal(activeRounds.length, country === 'sco' ? 38 : (count - 1) * 2,
    `${country} match calendar incomplete`)
  assert.equal(new Set(activeRounds).size, activeRounds.length)
}
assert.equal(createProCareer('North London Athletic').associationId, 'eng', 'Old pro careers must default to England')
assert.equal(proRound(4,10), 1, 'Legacy ten-team week alignment changed')
console.log('Phase 2: nine countries, trial contracts, fixtures, round calendars and legacy saves passed')

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
  firstFixture.awayId,0,2,firstFixture.id)
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
assert.ok(seniorPlayer.reputation > 20, 'Veteran contributions should improve career reputation')
assert.equal(seniorPlayer.coachTrust,55, 'Regular senior appearances must improve coach confidence')
assert.equal(seniorCareer.seasonRecords?.length,1)
assert.equal(seniorCareer.seasonRecords?.[0].appearances,29)
assert.equal(seniorCareer.seasonRecords?.[0].goals,6)
assert.equal(seniorCareer.seasonRecords?.[0].assists,11)
assert.equal(advanceProWeek(seniorCareer,seniorPlayer).state,seniorCareer,
  'Retired career may not advance')
console.log('Phase 2: senior season archive and retirement lifecycle passed')

const careerWorld = createProWorld(3400, '2026-08-01')
for (const country of PRO_INTERACTIVE_COUNTRIES) {
  const nation = careerWorld.competitions[`top-${country}`]
  const openingClub = careerWorld.clubs[nation.entrantIds[0]]
  const career = createProCareer(openingClub.name, 5, country)
  const clubWorldIds = Object.fromEntries(career.world.divisions[1].teams
    .map((club, index) => [club.id, nation.entrantIds[index]]))
  const synced = syncPlayableProLeague({ ...career, clubWorldIds, backgroundWorld: careerWorld })
  assert.equal(synced.activeCompetitionId, nation.id)
  assert.equal(synced.activeSeasonId, nation.seasonId)
  const fixtureIds = new Set(Object.values(careerWorld.fixtures)
    .filter(fixture => fixture.competitionId === nation.id &&
      fixture.id.includes(`-${nation.seasonId}-`)).map(fixture => fixture.id))
  assert.equal(synced.world.divisions[1].fixtures.length, fixtureIds.size,
    `${country}: playable calendar excludes real fixtures`)
  assert.ok(synced.world.divisions[1].fixtures.every(f => fixtureIds.has(f.id)),
    `${country}: local fixture mismatched world ID`)
  assert.equal(new Set(Object.values(synced.clubWorldIds!)).size, nation.entrantIds.length)
  const firstClub = synced.clubWorldIds![synced.world.playerTeamId]
  assert.equal(firstClub, nation.entrantIds[0])
}
const secondLeague = careerWorld.competitions['second-eng']
const secondClub = secondLeague.entrantIds[0]
const emulatedDrop = createProCareer(careerWorld.clubs[secondClub].name, 4, 'eng')
const oldMapping = Object.fromEntries(emulatedDrop.world.divisions[1].teams.map((team, i) =>
  [team.id, i === 0 ? secondClub : careerWorld.competitions['top-eng'].entrantIds[i]]))
const secondSynced = syncPlayableProLeague({ ...emulatedDrop, clubWorldIds: oldMapping, backgroundWorld: careerWorld })
assert.equal(secondSynced.activeCompetitionId, 'second-eng')
assert.equal(secondSynced.world.divisions[1].teams.length, secondLeague.entrantIds.length)
assert.ok(secondSynced.world.divisions[1].fixtures.length > 0)
const secondFixture = Object.values(careerWorld.fixtures).find(f => f.competitionId === 'second-eng')!
const secondScore = recordHumanProLeagueMatch(careerWorld, 'eng', secondFixture.homeId,
  secondFixture.awayId, 2, 0, secondFixture.id, 'second-eng')
assert.equal(secondScore.standings['second-eng'].find(r => r.clubId === secondFixture.homeId)!.points, 3)
console.log('Phase 2: nine real fixture calendars, second-tier club membership and playable result audit passed')

assert.equal(professionalSeasonWeeks(secondSynced), 52)
const secondRoundCount = Math.max(...secondSynced.world.divisions[1].fixtures.map(f => f.week))
assert.equal(secondRoundCount, 46)
const playableRounds = Array.from({ length: 52 }, (_, week) =>
  proRound(week + 1, secondSynced.world.divisions[1].teams.length, secondRoundCount))
  .filter((value): value is number => value !== null)
assert.deepEqual(playableRounds, Array.from({ length: 46 }, (_, index) => index + 1),
  'Forty-six-round league must play every fixture before year-end')
assert.equal(proRound(44, 24, 46) !== null, true, 'Long league season ended before final weeks')
const scottishLower = careerWorld.competitions['second-sco']
const scottishCareer = createProCareer(careerWorld.clubs[scottishLower.entrantIds[0]].name, 4, 'sco')
const scottishMapping = Object.fromEntries(scottishCareer.world.divisions[1].teams.map((team, i) =>
  [team.id, i === 0 ? scottishLower.entrantIds[0] : careerWorld.competitions['top-sco'].entrantIds[i]]))
const scottishSynced = syncPlayableProLeague({
  ...scottishCareer, clubWorldIds: scottishMapping, backgroundWorld: careerWorld,
})
assert.equal(scottishSynced.activeCompetitionId, 'second-sco')
assert.equal(scottishSynced.world.divisions[1].teams.length, 10)
assert.equal(Math.max(...scottishSynced.world.divisions[1].fixtures.map(f => f.week)), 36)
assert.equal(Array.from({ length: 44 }, (_, index) => proRound(index + 1, 10, 36))
  .filter(value => value !== null).length, 36)
console.log('Phase 2: 46-round EFL and four-leg Scottish lower league calendars passed')

const regionalLeague = careerWorld.competitions['third-esp-1']
const regionalClub = regionalLeague.entrantIds[0]
const regionalCareer = createProCareer(careerWorld.clubs[regionalClub].name, 4, 'esp')
const regionalMapping = Object.fromEntries(regionalCareer.world.divisions[1].teams.map((team, i) =>
  [team.id, i === 0 ? regionalClub : careerWorld.competitions['top-esp'].entrantIds[i]]))
const regionalSynced = syncPlayableProLeague({
  ...regionalCareer, clubWorldIds: regionalMapping, backgroundWorld: careerWorld,
})
assert.equal(regionalSynced.activeCompetitionId, 'third-esp-1')
assert.equal(regionalSynced.world.divisions[1].teams.length, regionalLeague.entrantIds.length)
assert.equal(new Set(Object.values(regionalSynced.clubWorldIds!)).size, regionalLeague.entrantIds.length)
console.log('Phase 2: grouped regional relegation preserves playable club membership')

const objectiveClub = careerWorld.competitions['top-eng'].entrantIds[0]
const objectiveCareer = createProCareer(careerWorld.clubs[objectiveClub].name, 5, 'eng')
const objectiveMap = Object.fromEntries(objectiveCareer.world.divisions[1].teams
  .map((team, index) => [team.id, careerWorld.competitions['top-eng'].entrantIds[index]]))
const objectiveWorld = structuredClone(careerWorld)
objectiveWorld.players['career-contract-test'] = {
  id:'career-contract-test',name:'Contract Test',birthDate:'2000-01-01',
  nationalityIds:['eng'], position:'CM',overall:64,potential:78,clubId:objectiveClub,
  annualWage:52000,shirtNumber:18,
}
objectiveWorld.clubs[objectiveClub].finances.annualSquadCostLimit = 999_999_999
const withBoard = syncPlayableProLeague({
  ...objectiveCareer, clubWorldIds:objectiveMap, backgroundWorld:objectiveWorld })
assert.ok(withBoard.clubObjective,'Senior club board objective not assigned')
assert.ok(withBoard.clubObjective.targetPosition >= 1 &&
  withBoard.clubObjective.targetPosition <= withBoard.world.divisions[1].teams.length)
const renewalPlayer = {
  id:'contract-test',totalWeeksElapsed:100,contract:{
    clubName:careerWorld.clubs[objectiveClub].name,signedWeek:0,expiresWeek:110,
    terms:{weeklyWage:1000,years:2},
  },
} as unknown as Player
const renewable = offerProRenewal(withBoard, renewalPlayer)
assert.ok(renewable,'Affordable senior renewal should be offered inside final 26 weeks')
assert.ok(renewable.player.contract!.expiresWeek > renewalPlayer.contract!.expiresWeek)
assert.ok(renewable.player.contract!.terms.weeklyWage > 1000)
assert.equal(renewable.state.backgroundWorld!.players['career-contract-test'].annualWage,
  renewable.player.contract!.terms.weeklyWage*52)
assert.equal(offerProRenewal(renewable.state,renewable.player),null,
  'New 104-week contract cannot immediately renew again')
assert.ok(syncPlayableProLeague(renewable.state).clubObjective)
console.log('Phase 2: club board objectives and affordable senior contract extensions passed')

const expiryWorld = structuredClone(objectiveWorld)
const expireClub = expiryWorld.clubs[objectiveClub]
const originalCommitment = expireClub.finances.committedAnnualWages
const expiringPlayer = { ...renewalPlayer, totalWeeksElapsed: 110,
  contract: { ...renewalPlayer.contract!, expiresWeek: 110 } } as Player
const expiringCareer = { ...withBoard, backgroundWorld: expiryWorld, date: expiryWorld.currentDate }
const released = releaseExpiredProContract(expiringCareer, expiringPlayer)
assert.equal(released.state.freeAgentSinceWeek, 110)
assert.equal(released.player.contract, null)
assert.equal(released.state.backgroundWorld!.players['career-contract-test'].clubId, null)
assert.equal(released.state.backgroundWorld!.players['career-contract-test'].annualWage, 0)
assert.equal(released.state.backgroundWorld!.clubs[objectiveClub].finances.committedAnnualWages,
  Math.max(0,originalCommitment - 52000))
assert.equal(releaseExpiredProContract(released.state,released.player).state,released.state,
  'Free-agent release must be idempotent after reload')
assert.equal(proFixture(released.state),undefined,'Free agent must not have a playable club fixture')
const unsignedPlayer = { ...released.player, money:5000, careerEarnings:125000,
  careerClock:{ageYears:24,phase:'academy'}, fitness:{stamina:100},
  seasonAppearances:0,seasonGoals:0,seasonAssists:0,reputation:40,coachTrust:55 } as Player
const unsignedWeek = advanceProWeek(released.state,unsignedPlayer)
assert.equal(unsignedWeek.player.money,5000,'Free agents may not earn a phantom weekly salary')
assert.equal(unsignedWeek.player.careerEarnings,125000,'Free-agent earnings must not accrue')
assert.equal(unsignedWeek.state.freeAgentSinceWeek,110,'Free agency must survive weekly progression')
assert.equal((advanceProWeek(released.state,{...released.player,careerClock:{
  ageYears:24,phase:'academy'},fitness:{stamina:100},seasonAppearances:0,
  seasonGoals:0,seasonAssists:0,reputation:40,coachTrust:55} as Player)).state.freeAgentSinceWeek,110)

const marketWorld = structuredClone(released.state.backgroundWorld!)
const targetClub = marketWorld.competitions['top-esp'].entrantIds[0]
marketWorld.clubs[targetClub].finances.cash = 1000000000
marketWorld.clubs[targetClub].finances.annualSquadCostLimit = 1000000000
const freeMarket = { ...released.state, backgroundWorld: marketWorld }
const offers = generateMarketOffers(freeMarket,released.player)
assert.ok(offers.length > 0,'Unattached senior must be eligible for club offers')
const chosen = offers.find(offer => offer.worldClubId !== objectiveClub)!
const destination = marketWorld.clubs[chosen.worldClubId]
destination.finances.cash=1000000000
destination.finances.annualSquadCostLimit=1000000000
const negotiated = {...freeMarket, talks:{offer:chosen,readyWeek:110,countered:false}}
const signed = finalizeProMove(negotiated,released.player)
assert.ok(signed,'Free agent must sign a zero-transfer-fee club deal')
assert.equal(signed.state.freeAgentSinceWeek,undefined)
assert.ok(signed.player.contract && signed.player.contract.expiresWeek>110)
assert.equal(signed.state.backgroundWorld!.players['career-contract-test'].clubId,chosen.worldClubId)
assert.equal(signed.state.associationId,destination.associationId)
assert.equal(signed.state.clubWorldIds![signed.state.world.playerTeamId],chosen.worldClubId)
console.log('Phase 2: expired contracts, no wages, free-agent market and club signing passed')

const nationalPlayer = {
  ...unsignedPlayer, turnedPro: {clubName:'London Athletic',weekSigned:0,countryId:'eng'},
  nationality:'rsa',seasonAppearances:32,seasonGoals:7,seasonAssists:9,
  reputation:65,matchRatings:[7.1,7.7,7.4,8.1],
} as Player
const internationalBase = { ...withBoard, season:3, week:12 }
const called = scheduleSeniorInternational(internationalBase,nationalPlayer)
assert.equal(called.international?.pending?.nationId,'rsa')
assert.equal(called.international?.pending?.week,12)
assert.equal(scheduleSeniorInternational(called,nationalPlayer),called,
  'Call-up may not be duplicated after save/reload')
const duty = completeSeniorInternational(called,nationalPlayer,
  {scored:2,conceded:1,goals:1,assists:1,rating:8.4,minutes:90})
assert.ok(duty)
assert.equal(duty.state.international?.caps,1)
assert.equal(duty.state.international?.goals,1)
assert.equal(duty.state.international?.assists,1)
assert.equal(duty.state.international?.pending,null)
assert.equal(completeSeniorInternational(duty.state,duty.player,
  {scored:2,conceded:1,goals:1,assists:1,rating:8.4,minutes:90}),null,
  'International game cannot be resolved twice')
assert.equal(scheduleSeniorInternational(duty.state,duty.player),duty.state,
  'Completed international game cannot spawn a duplicate')
const missed = forfeitSeniorInternational(called)
assert.equal(missed.international?.caps,0)
assert.equal(missed.international?.pending,null)
assert.equal(missed.international?.fixtures.length,1)
assert.ok(!scheduleSeniorInternational({...withBoard,week:13},nationalPlayer).international?.pending)
console.log('Phase 2: national-team call-ups, save safety, caps and missed duty passed')

assert.equal(INTERNATIONAL_GROUPS.length, Math.ceil(SENIOR_NATIONS.length / 4))
assert.ok(INTERNATIONAL_GROUPS.every(group => group.length >= 2 && group.length <= 4))
assert.equal(new Set(INTERNATIONAL_GROUPS.flat()).size,SENIOR_NATIONS.length)
for(let cycle=1;cycle<=17;cycle+=4) {
  assert.equal(internationalCycle(cycle+3),cycle)
  const appearances=new Map(NATIONS.map(n=>[n.id,new Set<string>()]))
  for(let season=cycle;season<cycle+2;season++)for(const week of INTERNATIONAL_WINDOWS)for(const nation of NATIONS){
    const scheduled=internationalTournamentFixture(nation.id,season,week)
    assert.ok(scheduled)
    assert.equal(scheduled.competition,'qualifier')
    appearances.get(nation.id)!.add(scheduled.opponentId)
  }
  for(const nation of NATIONS)assert.equal(appearances.get(nation.id)!.size,3,
    'Four-year qualifying group must meet three opponents home and away')
  const first=internationalProgress('rsa',cycle)
  assert.equal(first.finalists.length,8)
  assert.equal(new Set(first.finalists).size,8)
  assert.equal(first.semifinalists.length,4)
  assert.equal(first.finalistsMatch.length,2)
  assert.ok(first.finalistsMatch.includes(first.championId!))
  for(const nation of NATIONS) {
    const progress=internationalProgress(nation.id,cycle)
    assert.equal(progress.qualifiers.length,4)
    if(progress.qualified){
      assert.equal(progress.finalsGroup?.length,4)
      for(const week of INTERNATIONAL_WINDOWS)
        assert.equal(internationalTournamentFixture(nation.id,cycle+2,week)?.competition,'finals-group')
    }
    const semifinal=internationalTournamentFixture(nation.id,cycle+3,12)
    if(first.semifinalists.includes(nation.id))assert.equal(semifinal?.competition,'semifinal')
    const medal=internationalTournamentFixture(nation.id,cycle+3,25)
    if(first.semifinalists.includes(nation.id))
      assert.ok(medal?.competition==='final'||medal?.competition==='third-place')
  }
}
console.log('Phase 2: five independent international four-year cycles, qualifiers and knockout fixtures passed')

const winningRsaResults = INTERNATIONAL_WINDOWS.flatMap((week, round) => [1,2].map((leg) => {
  const season=leg
  const scheduled=internationalTournamentFixture('rsa',season,week)!
  return { id:`audit-rsa-${season}-${week}`,nationId:'rsa',opponentId:scheduled.opponentId,
    competition:'qualifier' as const,season,week,home:scheduled.home,
    scored:8,conceded:0,goals:0,assists:0,rating:7.5,minutes:90 }
}))
const beforeKickoff=visibleQualifyingTable('rsa',1,1)
assert.ok(beforeKickoff.every(row=>row.played===0),'Do not reveal future qualification results')
const midQualifying=visibleQualifyingTable('rsa',1,25,winningRsaResults)
assert.ok(midQualifying.every(row=>row.played===2))
const afterQualifying=visibleQualifyingTable('rsa',2,37,winningRsaResults)
assert.ok(afterQualifying.every(row=>row.played===6))
const qualifyingWin = internationalProgress('rsa',1,winningRsaResults)
assert.equal(qualifyingWin.qualified,true,'Six emphatic qualifying victories must earn a finals berth')
assert.equal(qualifyingWin.qualifiers.find(r=>r.nationId==='rsa')?.points,18)
const qualifyingLosses = winningRsaResults.map(record=>({...record,scored:0,conceded:8}))
const qualifyingLoss = internationalProgress('rsa',1,qualifyingLosses)
assert.equal(qualifyingLoss.qualified,false,'Six heavy qualifying defeats must eliminate nation')
const finalsExample = internationalTournamentFixture('rsa',3,12,winningRsaResults)
assert.equal(finalsExample?.competition,'finals-group')
const lossesExample = internationalTournamentFixture('rsa',3,12,qualifyingLosses)
assert.equal(lossesExample?.competition,'friendly')
console.log('Phase 2: human qualifying results change qualification and finals access')

for(const country of ['eng','rsa'] as const){
  let career = createProCareer('Twenty Year Wanderers',4,country)
  let player = { ...unsignedPlayer, id:`career-long-${country}`, nationality:undefined,
    turnedPro:{clubName:'Twenty Year Wanderers',weekSigned:0,countryId:country},
    careerClock:{ageYears:18,phase:'academy'},seasonAppearances:0,seasonGoals:0,
    seasonAssists:0,totalWeeksElapsed:0,reputation:35,coachTrust:50,
    contract:null,fitness:{stamina:100} } as unknown as Player
  let ticks=0
  while(!career.retired && ticks<1040){
    const next=advanceProWeek(career,player)
    assert.ok(next.state.week>0 && next.state.week<=52)
    assert.equal(next.state.world.divisions[1].teams.length,plannedClubCount(country))
    career=next.state;player=next.player;ticks++
  }
  assert.equal(career.retired,true,`${country} senior career failed to retire`)
  assert.equal(player.careerClock.ageYears,38,`${country} retired at wrong age`)
  assert.equal(career.seasonRecords?.length,20,`${country} missing annual career records`)
  assert.equal(new Set(career.seasonRecords!.map(s=>s.season)).size,20)
  assert.ok(ticks>=800 && ticks<=1040,`${country} invalid twenty-season calendar length`)
  const onceMore=advanceProWeek(career,player)
  assert.equal(onceMore.state,career,`${country} retirement did not stop the calendar`)
}
console.log('Phase 2: twenty complete senior seasons in two countries retire cleanly at 38')

for (const nation of NATIONS) {
  const a=selectSeniorNationalSquad(nation.id,3,12,careerWorld)
  const b=selectSeniorNationalSquad(nation.id,3,12,careerWorld)
  assert.deepEqual(a,b,'National squad draw must survive save and reload')
  assert.equal(a.members.length,23)
  assert.equal(new Set(a.members.map(m=>m.id)).size,23)
  assert.equal(a.members.filter(m=>m.position.toUpperCase().includes('GK')).length,3)
  assert.ok(a.members.every(member=>member.source!=='world' ||
    careerWorld.players[member.id]?.nationalityIds.includes(nation.id)))
  assert.ok(a.members.some(member=>member.id===a.captainId))
}
const capPlayer = {...nationalPlayer,nationality:'rsa',name:'Senior Test Player',
  position:'CM',injury:null} as Player
const capSquad=selectSeniorNationalSquad('rsa',5,12,careerWorld,capPlayer,true)
assert.equal(capSquad.playerSelected,true)
assert.equal(capSquad.members.filter(m=>m.source==='career').length,1)
assert.equal(capSquad.members.filter(m=>m.id===`career-${capPlayer.id}`).length,1)
const wrongNation=selectSeniorNationalSquad('eng',5,12,careerWorld,capPlayer,true)
assert.equal(wrongNation.playerSelected,false,'Foreign-nationality player in England squad')
const injuredPlayer={...capPlayer,injury:{kind:'hamstring',weeksRemaining:2}} as Player
assert.equal(selectSeniorNationalSquad('rsa',5,12,careerWorld,injuredPlayer,true).playerSelected,false)
const cachedCallup=scheduleSeniorInternational({...withBoard,week:12,season:5},capPlayer)
assert.ok(cachedCallup.international?.pending?.squad)
assert.equal(cachedCallup.international!.pending!.squad!.members.length,23)
assert.equal(cachedCallup.international!.pending!.squad!.playerSelected,true)
console.log('Phase 2: 24 stable federation squads, nationality, player fitness and roster persistence passed')

for(const nation of NATIONS){
  const participants=continentalNations(nation.id)
  assert.ok(participants.includes(nation.id))
  assert.ok(participants.every(id=>confederationForNation(id)===confederationForNation(nation.id)))
  for(const season of [1,2,11,12]){
    const unique=new Set<string>()
    for(const week of CONTINENTAL_WINDOWS){
      const matches=continentalRound(nation.id,season,week)
      const playing=new Set<string>()
      for(const pair of matches){
        assert.notEqual(pair.homeId,pair.awayId)
        assert.ok(participants.includes(pair.homeId)&&participants.includes(pair.awayId),
          'National series must not cross confederations')
        assert.ok(!playing.has(pair.homeId)&&!playing.has(pair.awayId),
          'A nation cannot have two regional games in the same international window')
        playing.add(pair.homeId);playing.add(pair.awayId)
      }
      const match=matches.find(p=>p.homeId===nation.id||p.awayId===nation.id)
      if(match)unique.add(`${season}:${week}`)
    }
    assert.ok(unique.size>0)
  }
  const progress=continentalNationsProgress(nation.id,2,32)
  assert.ok(progress)
  assert.equal(progress.championId!==undefined,true)
  assert.equal(progress.table.length,participants.length)
  const points=progress.table.reduce((sum,row)=>sum+row.points,0)
  assert.ok(points>=0)
  assert.equal(progress.table.reduce((sum,row)=>sum+row.goalsFor,0),
    progress.table.reduce((sum,row)=>sum+row.goalsAgainst,0),
    'Regional competition score totals must balance')
}
assert.equal(continentalCycle(12),11)
const africaRound=CONTINENTAL_WINDOWS.find(week=>
  continentalRound('rsa',1,week).some(p=>p.homeId==='rsa'||p.awayId==='rsa'))!
const africaPair=continentalRound('rsa',1,africaRound).find(p=>p.homeId==='rsa'||p.awayId==='rsa')!
const africaOpponent=africaPair.homeId==='rsa'?africaPair.awayId:africaPair.homeId
const playedAfrica={
  id:'regional-rsa-test',nationId:'rsa',opponentId:africaOpponent,
  season:1,week:africaRound,competition:'continental' as const,
  home:africaPair.homeId==='rsa',scored:6,conceded:0,
  goals:1,assists:1,rating:8.5,minutes:90,
}
const replacedAfrica=continentalNationsProgress('rsa',1,africaRound,[playedAfrica])!
assert.equal(replacedAfrica.table.find(row=>row.nationId==='rsa')!.goalsFor -
    replacedAfrica.table.find(row=>row.nationId==='rsa')!.goalsAgainst,6,
    'User-controlled regional national result must replace simulated score')
assert.equal(replacedAfrica.table.reduce((sum,row)=>sum+row.goalsFor,0),
  replacedAfrica.table.reduce((sum,row)=>sum+row.goalsAgainst,0))
console.log('Phase 2: confederation-only senior competition, geographic fixtures and balanced standings passed')

const firstRankings=seniorNationRankings([])
assert.equal(firstRankings.length,NATIONS.length)
assert.equal(new Set(firstRankings.map(row=>row.place)).size,NATIONS.length)
const rankingResult = {
  ...playedAfrica, competition:'qualifier' as const,
  season:1,week:12,id:'ranking-rsa-eng',opponentId:'eng',home:true,
  scored:4,conceded:0,goals:2,assists:1,rating:9,minutes:90,
}
const rankAfter = seniorNationRankings([rankingResult])
const rsaRanking = rankAfter.find(row=>row.nationId==='rsa')!
const engRanking = rankAfter.find(row=>row.nationId==='eng')!
assert.ok(rsaRanking.change>0,'International win must increase national rating')
assert.ok(engRanking.change<0,'National opponent must lose corresponding points')
assert.equal(Math.round((rsaRanking.change+engRanking.change)*10)/10,0,
  'Two-sided rating transfer must conserve points')
assert.deepEqual(seniorNationRankings([rankingResult]),seniorNationRankings([rankingResult,rankingResult]),
  'Duplicate saved national game may not be counted more than once')
assert.equal(seniorNationRankings([rankingResult],1,8).find(row=>row.nationId==='rsa')!.change,0,
  'National rankings must not reveal future match results')
const skippedRank={...rankingResult,id:'skipped-rank',minutes:0,scored:0,conceded:0}
assert.deepEqual(seniorNationRankings([skippedRank]),firstRankings,
  'Missed duty may not change national ratings')
const injuredCallup={...nationalPlayer, injury:{kind:'hamstring',weeksRemaining:1}} as Player
assert.equal(scheduleSeniorInternational({...withBoard,season:5,week:12},injuredCallup).international?.pending,
  undefined,'Injured player must not be called up for senior national duty')
console.log('Phase 2: nation ratings, correct home-away transfers, no future records, injury eligibility passed')

const worldFirst=buildNationalWorldResults(1,1)
assert.equal(worldFirst.length,0,'No international result before first scheduled window')
const worldWeek8=buildNationalWorldResults(1,8)
assert.ok(worldWeek8.length>0,'Global national simulations must include regional AI fixtures')
assert.ok(worldWeek8.every(r=>r.season===1&&r.week<=8))
assert.equal(new Set(worldWeek8.map(r=>[r.season,r.week,
  r.home?r.nationId:r.opponentId,r.home?r.opponentId:r.nationId].join(':'))).size,worldWeek8.length,
  'Simulated world national fixtures must never repeat')
const worldWeek12=buildNationalWorldResults(1,12)
assert.ok(worldWeek12.length>worldWeek8.length,
  'Global rankings need national championship qualification fixtures too')
const againstEngland=worldWeek12.find(r=>
  (r.nationId==='eng'||r.opponentId==='eng')&&r.week===12)!
assert.ok(againstEngland)
const realHome=againstEngland.home?againstEngland.nationId:againstEngland.opponentId
const realAway=againstEngland.home?againstEngland.opponentId:againstEngland.nationId
const actualWorld={...againstEngland,id:'user-controlled-ranking',
  nationId:realHome,opponentId:realAway,home:true,
  scored:10,conceded:0,goals:1,assists:0,rating:9,minutes:90}
const overridden=buildNationalWorldResults(1,12,[actualWorld])
const overriddenGame=overridden.find(r=>r.id==='user-controlled-ranking')
assert.equal(overriddenGame?.scored,10)
assert.equal(overridden.length,worldWeek12.length,
  'A real result must replace, not duplicate, a simulated fixture')
assert.ok(overridden.every(r=>r.id!=='user-controlled-ranking'||r.minutes===90))
const overriddenRatings=seniorWorldNationRankings(1,12,[actualWorld])
const baselineRatings=seniorWorldNationRankings(1,12)
assert.notDeepEqual(overriddenRatings,baselineRatings,
  'User international scores must change worldwide ranking points')
assert.deepEqual(seniorWorldNationRankings(1,12,[actualWorld,actualWorld]),overriddenRatings,
  'Duplicate human records cannot duplicate world ranking points')
assert.deepEqual(seniorWorldNationRankings(1,8,[actualWorld]),seniorWorldNationRankings(1,8),
  'Future human international result cannot change earlier world rankings')
const worldClock=Date.now()
const twentyWorld=buildNationalWorldResults(20,44)
const fullWorldRankings=seniorWorldNationRankings(20,44)
assert.equal(fullWorldRankings.length,NATIONS.length)
assert.ok(twentyWorld.length>800 && twentyWorld.length<25000,
  'Twenty-year national fixture feed must stay bounded after expanding regional opponents to 218 associations')
assert.ok(fullWorldRankings.every(r=>Number.isFinite(r.points)))
assert.ok(Date.now()-worldClock<30000,
  'Twenty-season national ranking reconstruction is too slow on CI')
console.log('Phase 2: world AI-national results, score overrides, duplicate safety, 20-year ranking load passed')

const youthGraduate={...unsignedPlayer,position:'CM',potential:15,attributes:{
  kind:'outfield',values:{passing:4,shooting:3,dribbling:4,tackling:3,
    pace:4,strength:3,stamina:4,agility:4,vision:4,composure:3,
    positioning:3,concentration:4}}} as unknown as Player
const seniorGraduate=prepareProGraduate(youthGraduate)
assert.ok(toOvr(computeCurrentAbility(seniorGraduate))>=60,
  'First professional contract must not leave an academy graduate rated 29 OVR')
assert.ok(toOvr(computeCurrentAbility(seniorGraduate))<=68,
  'First graduate adjustment should not create an elite international')
assert.deepEqual(prepareProGraduate(seniorGraduate),seniorGraduate,
  'Already balanced graduate must not be boosted a second time')
for(const country of ['eng','esp','ger','ita','fra','por','ned','rsa','sco']){
  const pro=createProCareer('Rating Audit FC',4,country)
  const first=pro.world.divisions[1].teams
  assert.ok(first.every(t=>teamOverall(t)>=58),'No top-flight professional club should be youth-level')
  if(['eng','esp','ger','ita'].includes(country))
    assert.ok(first.some(t=>teamOverall(t)>=80),'Elite top flights need strong first teams')
  const sevenDays=proWeekSchedule(pro,'Fictional United')
  assert.equal(sevenDays.length,7)
  assert.equal(sevenDays[5].kind,'match')
  assert.equal(sevenDays[0].kind,'training')
  assert.equal(proMatchDay(pro),5)
  assert.ok(proTrainingAvailable(0,5))
}
assert.ok(proRatingTarget('eng',1,0,20)>proRatingTarget('eng',2,0,24),
  'Top flight must rate stronger than lower divisions')
assert.ok(proRatingTarget('eng',2,0,24)>proRatingTarget('eng',3,0,24))
assert.ok(seniorNationalTeamRating('eng')>seniorNationalTeamRating('rsa'))
console.log('Phase 2: pro graduation 60 OVR, national/club band separation, daily senior schedule passed')

for(const country of PRO_INTERACTIVE_COUNTRIES) {
  const sample=createProCareer('Local Test',4,country)
  const names=sample.world.divisions[1].teams.map(t=>t.name)
  assert.equal(new Set(names).size,names.length,`${country}: duplicated professional club name`)
  assert.ok(names.every(name=>!/\b\d{1,4}\b/.test(name)),`${country}: numeric name placeholder`)
  assert.ok((PRO_TOP_FLIGHT_IDENTITIES[country]??[]).length>=10)
  assert.equal(proRound(1,sample.world.divisions[1].teams.length),null)
  assert.equal(proRound(2,sample.world.divisions[1].teams.length),null)
  assert.equal(proRound(3,sample.world.divisions[1].teams.length),null)
  assert.equal(proRound(4,sample.world.divisions[1].teams.length),null)
  assert.equal(proRound(5,sample.world.divisions[1].teams.length),1)
}
assert.equal(proRound(4,10),1,'Old ten-team saves retain legacy round mapping')
assert.ok(proClubIdentity('fra',0).name.includes('Paris'))
assert.ok(proClubIdentity('ita',0).name.includes('Turin'))
assert.ok(proClubIdentity('eng',3).name.includes('London'))
const renameWorld=createProWorld(93,'2026-07-18')
const oldClub=renameWorld.clubs['club-fra-01']
renameWorld.clubs['club-fra-01']={...oldClub,name:'Paris 17'}
const upgradedWorld=renameLegacyProClubs(renameWorld)
assert.equal(upgradedWorld.clubs['club-fra-01'].id,oldClub.id)
assert.notEqual(upgradedWorld.clubs['club-fra-01'].name,'Paris 17')
assert.equal(renameWorld.clubs['club-fra-01'].name,'Paris 17',
  'Renaming a saved world must not mutate its original object')
assert.equal(mondayFrom('2026-07-18'),'2026-07-13')
assert.equal(proMatchDay({...createProCareer('Calendar FC'),date:'2026-07-18'},'europe','2026-07-15'),2,
  'Dated Wednesday fixture must appear on Wednesday')
assert.equal(proMatchDay({...createProCareer('Calendar FC'),date:'2026-07-18'},'domestic-cup','2026-07-14'),1)
assert.equal(seniorTrialPoints(0,60)>=0,true)
assert.ok(seniorTrialPoints(.9,62)>seniorTrialPoints(.2,62),
  'Timed mini-game quality must change three-week trial scoring')
assert.ok(professionalDecisionModifier(60,90)<.80,'Low-rated senior facing elite opposition should be disadvantaged')
assert.equal(professionalDecisionModifier(60,60),1)
assert.ok(professionalDecisionModifier(90,60)>1)
let seed=39
const seeded=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
const low=calibrateSeniorTeam(createProCareer('Low Tier',3,'eng').world.divisions[1].teams[0],61)
const elite=calibrateSeniorTeam(createProCareer('Elite FC',6,'eng').world.divisions[1].teams[0],88)
let lowGoals=0,eliteGoals=0,rareHighScores=0
for(let i=0;i<160;i++){
  const match=simulateMatchV2(low,elite,seeded)
  lowGoals+=match.homeGoals;eliteGoals+=match.awayGoals
  if(match.homeGoals>=5)rareHighScores++
}
assert.ok(eliteGoals>lowGoals,'Pro match balance must favor the much stronger team')
assert.ok(rareHighScores<=3,
  'Five goals for a 61-rated team against an 88-rated team must be a rare event')
console.log('Phase 2: club identities, preseason kickoff, playable mini-game scoring, dated cup weeks and 160 balanced football results passed')

for(const country of PRO_LEAGUE_PLAN){
  const clubNames=Array.from({length:plannedClubCount(country.associationId)},(_,i)=>
    proClubIdentity(country.associationId,i,1,country.associationName).name)
  assert.equal(new Set(clubNames).size,clubNames.length,
    `${country.associationId} first-division club names must stay unique`)
  assert.ok(clubNames.every(name=>!/\\b\\d{1,3}\\b/.test(name)),
    `${country.associationId} contains unnamed/numbered professional club`)
}
const noAppearance=createProCareer('North London Gunners',4,'eng')
const missedFixture=proFixture({...noAppearance,week:5})
assert.ok(missedFixture,'First senior league match must be scheduled after preseason')
const missedOpponentId=missedFixture!.homeTeamId===noAppearance.world.playerTeamId
  ?missedFixture!.awayTeamId:missedFixture!.homeTeamId
const missedOpponent=noAppearance.world.divisions[1].teams.find(team=>team.id===missedOpponentId)!
const missedHome=missedFixture!.homeTeamId===noAppearance.world.playerTeamId
const missedSeniorResult=resolveProMatch({...noAppearance,week:5},unsignedPlayer,{
  opponent:missedOpponent,home:missedHome,scored:1,conceded:2,
  goals:0,assists:0,rating:6,energy:70,minutes:0,yellowCards:0,redCarded:false,
})
assert.equal(missedSeniorResult.state.resolvedWeek,5)
assert.equal(missedSeniorResult.state.world.divisions[1].fixtures.find(f=>f.id===missedFixture!.id)?.played,true,
  'Senior fixture must count even when the human does not appear')
assert.equal(missedSeniorResult.record.lines.find(line=>line.playerId===unsignedPlayer.id)?.minutes,0)
console.log('Phase 2: all national professional club names and missed-match league reconciliation passed')

for(const points of [0,2,4,6,7,9])for(const ovr of [55,60,65,70]){
  const offers=seniorTrialOffers(points,ovr)
  assert.equal(offers.length,4)
  assert.equal(new Set(offers.map(o=>o.id)).size,4)
  assert.ok(offers.every(o=>o.overall<80),'Elite clubs must not invite youth trialists')
  assert.ok(offers.every(o=>o.overall<=Math.min(points>=7&&ovr>=57?79:76,ovr+(points>=7&&ovr>=57?14:10))))
  assert.ok(points>=7 || offers.every(o=>o.tier===2||!['eng','esp','ger','ita','fra'].includes(o.associationId)))
  assert.ok(offers.filter(o=>o.tier===1&&['eng','esp','ger','ita','fra'].includes(o.associationId)).length<=1)
}
console.log('Phase 2: four global earned offers, 0-9 performance/55-70 OVR and safe tier matching passed')

assert.equal(allPlayableRecordCatalog().length,20)
for(const country of PRO_INTERACTIVE_COUNTRIES){
  const low=seniorTrialOffers(3,60)
  for(const offer of low.filter(o=>o.associationId===country)){
    const leagueId=`${offer.tier===1?'top':'second'}-${country}`
    assert.equal(offer.name,proWorldClubIdentity(country,offer.tier,offer.rank).name)
    const members=careerWorld.competitions[leagueId].entrantIds
    assert.ok(members.some(id=>careerWorld.clubs[id].name===offer.name),
      `${offer.name} does not exist in the actual ${leagueId} world`)
  }
  const history=proLeagueRecords(country,`top-${country}`,[],undefined)
  assert.equal(history.length,3)
  assert.ok(history.every(record=>record.mark>0))
}
const recordSeason={season:1,associationId:'eng',clubName:'West London Blues',
  competitionId:'top-eng',leaguePosition:2,clubs:20,
  appearances:38,goals:70,assists:25,leagueGoals:70,leagueAssists:25,leagueAppearances:38,leagueChampion:false}
const broken=proLeagueRecords('eng','top-eng',[recordSeason])
assert.ok(broken.some(rec=>rec.kind==='season-goals'&&rec.broken))
assert.ok(broken.some(rec=>rec.kind==='season-assists'&&rec.broken))
assert.ok(broken.some(rec=>rec.kind==='career-goals'&&!rec.broken))
const awards=worldPlayerAwards(recordSeason)
assert.equal(awards.length,5)
assert.ok(awards.some(item=>item.won))
assert.deepEqual(worldPlayerAwards(recordSeason),awards,'Awards must survive reload without rerolling')
const awardState={...withBoard,season:2,week:1,seasonRecords:[recordSeason],
  seenMilestones:[],date:'2027-07-12'}
const awardMoment=nextProMilestone(awardState)
assert.equal(awardMoment?.kind,'ceremony')
assert.notEqual(nextProMilestone({...awardState,seenMilestones:[awardMoment!.id]})?.id,awardMoment?.id,
  'Award ceremony must only appear once per saved season')
console.log('Phase 2: 20 league record catalogs, awards, and seasonal ceremony save-safety audited')
