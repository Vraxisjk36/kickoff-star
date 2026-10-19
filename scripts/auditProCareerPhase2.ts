import assert from 'node:assert/strict'
import type { Player } from '../src/types/player'
import type { ProWorldState } from '../src/engine/proWorld'
import { createProCareer, advanceProWeek, professionalSeasonWeeks, proRound, proFixture, proTrialClubs, PRO_CAREER_DESTINATIONS } from '../src/engine/proCareer'
import { plannedClubCount, createProWorld } from '../src/engine/proWorldFactory'
import { recordHumanProLeagueMatch } from '../src/engine/proWorldSimulation'
import { syncPlayableProLeague, offerProRenewal, releaseExpiredProContract, generateMarketOffers, finalizeProMove } from '../src/engine/proIntegration'
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
  assert.equal(activeRounds.length, country === 'sco' ? 38 : (count - 1) * 2,
    `${country} match calendar incomplete`)
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
console.log('Phase 2: ten real fixture calendars, second-tier club membership and playable result audit passed')

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
