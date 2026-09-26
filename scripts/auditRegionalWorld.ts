import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { NATIONS } from '../src/engine/nations'
import { REGIONS, regionsFor, regionalSchoolNames, regionalClubNames } from '../src/engine/regions'
import { schoolsForRegion, getSchool } from '../src/engine/schools'
import { grassrootsClubsForRegion } from '../src/screens/GrassrootsSelection'
import { initSchoolLeagueWorld, initLeagueWorld } from '../src/engine/league'
import { nationalRegionalField } from '../src/engine/regionalRepresentatives'
import { initCupById, advanceCupStage, batchSimCupStage } from '../src/engine/cup'
import { initInternationalWorld, advanceInternationalStage } from '../src/engine/international'
import { addQualification, initCompetitionCareer } from '../src/engine/competitionCareer'
import { representativeEvidence } from '../src/engine/youthOpportunities'
import { useCareerStore } from '../src/store/careerStore'
import { OUTFIELD_ATTRIBUTES } from '../src/types/attributes'
import type { Player } from '../src/types/player'
import type { CalendarState } from '../src/types/calendar'

let checks = 0
function check(value: unknown, message: string) { assert.ok(value, message); checks++ }
const schoolNames = new Set<string>(), clubNames = new Set<string>()
for (const nation of NATIONS) {
  const regions = regionsFor(nation.id)
  check(regions.length >= 3, `${nation.name} has a region choice`)
  for (const region of regions) {
    const schools = regionalSchoolNames(region.id), clubs = regionalClubNames(region.id)
    check(schools.length >= 30 && clubs.length >= 36, `${region.name} has full local pools`)
    for (const name of schools) { check(!schoolNames.has(name), `school identity ${name} is not shared across regions`); schoolNames.add(name) }
    for (const name of clubs) { check(!clubNames.has(name), `club identity ${name} is not shared across regions`); clubNames.add(name) }
    const choices = schoolsForRegion(region.id)
    check(choices.length === 3 && choices.every(choice => getSchool(choice.id)?.name === choice.name), `${region.name} school choices reload by ID`)
    const clubChoices = grassrootsClubsForRegion(region.id)
    check(clubChoices.length === 3 && clubChoices.every(choice => choice.name.startsWith(region.localities[clubChoices.indexOf(choice)])), `${region.name} starter clubs are local`)
  }
}
check(REGIONS.length > NATIONS.length, 'country and region are distinct choices')

function newPlayer(regionId: string): Player {
  return {
    id: crypto.randomUUID(), name: 'Regional Audit', position: 'ST', preferredFoot: 'right', heightCm: 176,
    attributes: { kind: 'outfield', values: Object.fromEntries(OUTFIELD_ATTRIBUTES.map(key => [key, 10])) }, potential: 18,
    confidence: { value: 0, baseline: 0 }, fitness: { stamina: 100 }, careerClock: { ageYears: 14, phase: 'grassroots-trials', grassrootsSeason: 1 },
    nationality: 'rsa', regionId, schoolId: null, trialWeekCompleted: 0, squadRole: null, trainingMomentum: 0,
    matchRatings: [], seasonGoals: 0, seasonAssists: 0, injury: null, recentInjuryCount: 0, matchesSinceReturn: 3,
    coachTrust: 0, reputation: 5, scoutWatchers: [], contractOffers: [], totalWeeksElapsed: 0, academyClubName: null, turnedPro: null,
  } as Player
}
const calendar: CalendarState = { currentWeek: { weekNumber: 1, seasonYear: 1, events: [{ id: crypto.randomUUID(), day: 'mon', type: 'school', title: 'first day', resolved: false }] }, history: [] }
const regionId = 'rsa-northern-cape'
const school = schoolsForRegion(regionId)[0]
await useCareerStore.getState().startNewCareer(newPlayer(regionId), calendar, 0)
useCareerStore.getState().setSchool(school.id)
useCareerStore.getState().completeTrials('starting-xi', 0.75)
useCareerStore.getState().ensureLeagueWorld()
let state = useCareerStore.getState()
let teams = Object.values(state.league!.divisions).flatMap(division => division.teams)
check(state.league?.regionId === regionId && state.league?.kind === 'school' && teams.length === 30, 'South African school world has 30 regional teams')
check(teams.every(team => team.regionId === regionId && team.countryId === 'rsa') && new Set(teams.map(team => team.name)).size === 30, 'school teams have unique regional identities')
check(teams.find(team => team.id === state.league!.playerTeamId)?.name === school.name, 'selected school is the actual player team')
const schoolSnapshot = JSON.stringify(state.league)
await useCareerStore.getState().saveCurrent()
await useCareerStore.getState().loadFromSlot(0)
state = useCareerStore.getState()
check(state.player?.regionId === regionId && state.league?.divisions[state.league.playerDivision].teams.find(team => team.id === state.league!.playerTeamId)?.name === school.name, 'school region and selected identity survive reload')
check(JSON.stringify(state.league) === schoolSnapshot, 'reload preserves every regional opponent, table and fixture')

const starter = grassrootsClubsForRegion(regionId)[2]
await useCareerStore.getState().startNewCareer(newPlayer(regionId), calendar, 1)
useCareerStore.getState().setYouthRoute('grassroots', { id: starter.clubId, name: starter.name })
useCareerStore.getState().completeTrials('starting-xi', 0.75)
useCareerStore.getState().ensureLeagueWorld()
state = useCareerStore.getState()
teams = Object.values(state.league!.divisions).flatMap(division => division.teams)
check(state.league?.regionId === regionId && state.league?.kind === 'sunday' && teams.length === 36, 'South African Sunday pyramid has 36 regional teams')
check(teams.every(team => team.regionId === regionId && team.countryId === 'rsa') && new Set(teams.map(team => team.name)).size === 36, 'Sunday clubs are unique to their region')
check(teams.find(team => team.id === state.league!.playerTeamId)?.name === starter.name && state.player?.contractOffers.some(offer => offer.kind === 'club' && offer.clubName === starter.name), 'starter club and offer match the chosen locality')
await useCareerStore.getState().saveCurrent()
await useCareerStore.getState().loadFromSlot(1)
check(useCareerStore.getState().player?.regionId === regionId && useCareerStore.getState().league?.regionId === regionId, 'Grassroots region survives reload')

const english = regionsFor('eng').find(region => region.name === 'London')!
const englishWorld = initSchoolLeagueWorld(schoolsForRegion(english.id)[0].name, english.id)
const localWorld = initLeagueWorld(grassrootsClubsForRegion(regionId)[0].name, regionId)
check(englishWorld.regionId !== localWorld.regionId && !Object.values(englishWorld.divisions).flatMap(d => d.teams).some(team => teams.some(other => other.name === team.name)), 'England and South Africa do not share local opponents')

for (const nation of NATIONS) {
  const home = regionsFor(nation.id)[0]
  const field = nationalRegionalField(initSchoolLeagueWorld(schoolsForRegion(home.id)[0].name, home.id).divisions[1].teams[0], home.id, 1)
  const all = [field.playerTeam, ...field.opponents]
  check(all.length === 16 && new Set(all.map(team => team.name)).size === 16, `${nation.name} fields sixteen distinct regional XIs`)
  check(all.every(team => team.countryId === nation.id && team.regionId && regionsFor(nation.id).some(region => region.id === team.regionId)), `${nation.name} championship stays within its country`)
  const cup = initCupById('nationalChampionship', field.playerTeam, field.opponents)
  check(cup.stage === 'knockout' && cup.knockoutRounds[0].length === 8 && cup.teams.every(team => team.countryId === nation.id) && cup.teams.some(team => team.id === field.playerTeam.id), `${nation.name} Round of 16 uses regional representatives`)
  let finished = cup
  for (let round = 1; round <= 4; round++) finished = advanceCupStage(batchSimCupStage(finished, round, true))
  check(finished.stage === 'complete' && finished.knockoutRounds.map(fixtures => fixtures.length).join(',') === '8,4,2,1', `${nation.name} completes four knockout rounds`)
}
const northCapeSchool = initSchoolLeagueWorld(school.name, regionId).divisions[1].teams[0]
const seasonOne = nationalRegionalField(northCapeSchool, regionId, 1)
const seasonTwo = nationalRegionalField(northCapeSchool, regionId, 2)
check(new Set([...seasonOne.opponents, ...seasonTwo.opponents].map(team => team.regionId)).size === 8, 'South African national draws rotate through all other provinces')
const rsaInternational = initInternationalWorld('South Africa', 'rsa')
check(rsaInternational.qualifyingGroup.teams.length === 5 && new Set(rsaInternational.qualifyingGroup.teams.map(team => team.countryId)).size === 5,
  'International qualifying is five distinct named countries')
const finishedQualifiers = { ...rsaInternational, qualifyingGroup: { ...rsaInternational.qualifyingGroup,
  fixtures: rsaInternational.qualifyingGroup.fixtures.map(fixture => ({ ...fixture, played: true,
    homeGoals: fixture.homeTeamId === rsaInternational.nationTeamId ? 4 : 1,
    awayGoals: fixture.awayTeamId === rsaInternational.nationTeamId ? 4 : 0 })) } }
const finals = advanceInternationalStage(finishedQualifiers)
check(finals.stage === 'finals' && finals.finalsTeams.length === 8 && new Set(finals.finalsTeams.map(team => team.countryId)).size === 8,
  'International finals have eight distinct named nations')
check(JSON.parse(JSON.stringify(finals)).finalsTeams.every((team: { countryId?: string }) => !!team.countryId), 'Named international finalists survive serialization')
const nationalCup = initCupById('nationalChampionship', seasonOne.playerTeam, seasonOne.opponents)
const finalistRecord = { competitionId: 'nationalChampionship', season: 1, appearances: 3, starts: 3, minutes: 270,
  goals: 0, assists: 0, cleanSheets: 0, ratingTotal: 18, averageRating: 6, yellowCards: 0, redCards: 0, playerOfMatchAwards: 0 }
const finalist = { ...newPlayer(regionId), pathway: { regionalSelection: 'selected' },
  competitionCareer: { ...initCompetitionCareer(), current: { nationalChampionship: finalistRecord } } } as Player
check(!representativeEvidence(finalist, 'national').eligible, 'Non-finalist cannot reach international selection on appearances alone')
for (const position of [1, 2]) {
  const qualified = { ...finalist, competitionCareer: addQualification(finalist.competitionCareer, {
    competitionId: 'nationalChampionship', qualifiedFor: 'international', season: 1, reason: 'cup-result', position,
  }) }
  check(representativeEvidence(qualified, 'national').eligible, `National finalist in place ${position} reaches selection`)
}
const beforeCup = JSON.stringify(nationalCup), beforeInternational = JSON.stringify(finals)
const live = useCareerStore.getState()
useCareerStore.setState({ cups: { ...live.cups, nationalChampionship: nationalCup }, international: finals })
await useCareerStore.getState().saveCurrent()
await useCareerStore.getState().loadFromSlot(1)
check(JSON.stringify(useCareerStore.getState().cups.nationalChampionship) === beforeCup && JSON.stringify(useCareerStore.getState().international) === beforeInternational,
  'In-progress regional and international brackets survive save and reload')
console.log(`${checks} regional identity checks passed`)
