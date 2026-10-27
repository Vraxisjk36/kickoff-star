import assert from 'node:assert/strict'
import { initAcademyWorld, applyAcademyPromotion, academyDivisionLabel } from '../src/engine/academy'
import { ACADEMY_SEASON_SCHEDULE, SPAIN_ACADEMY_SCHEDULE, activeCompetitionForWeek, generateWeek } from '../src/engine/calendar'
import { weeklyStoryDecision, isStoryWeek } from '../src/engine/weeklyStories'
import type { Player } from '../src/types/player'
import 'fake-indexeddb/auto'
import { useCareerStore } from '../src/store/careerStore'
import { initStreetGame } from '../src/engine/streetGame'
import { academyClubNames, academyOfferBatch, academyRatings, europeanContinentalField, EUROPEAN_ACADEMY_COUNTRIES, seniorClubRatings, rebalanceAcademyTeam } from '../src/engine/academyClubs'
import { academyRegistrationOpen } from '../src/engine/academyRecruitment'
import { NATIONS } from '../src/engine/nations'
import { competitionPrestige, scoutingPrestigeMultiplier } from '../src/engine/competitionCareer'
import { initScoutingState, updateReputation } from '../src/engine/scouting'

assert.equal(competitionPrestige('schoolLeague', 'eng'), 31)
assert.equal(competitionPrestige('schoolLeague', 'rsa'), 20)
assert.ok(competitionPrestige('academyLeague', 'eng') > competitionPrestige('academyLeague', 'rsa'))
assert.equal(competitionPrestige('international', 'eng'), competitionPrestige('international', 'rsa'))
const scoutingDisplay = { rating: 8.1, position: 'ST', goals: 1, assists: 0, tackles: 0, interceptions: 0, headers: 0, keyPasses: 0, saves: 0, cleanSheet: false }
const englishRep = updateReputation(initScoutingState(), { ...scoutingDisplay, competitionPrestigeMultiplier: scoutingPrestigeMultiplier('schoolLeague', 'eng') }).reputation
const southAfricanRep = updateReputation(initScoutingState(), { ...scoutingDisplay, competitionPrestigeMultiplier: scoutingPrestigeMultiplier('schoolLeague', 'rsa') }).reputation
assert.ok(englishRep > southAfricanRep)

for (const nation of NATIONS) assert.ok(academyClubNames(nation.id).length >= 12, `${nation.id} has a real-club-based academy pool`)
const madrid = academyRatings('esp', 10)
const pretoria = academyRatings('rsa', 8)
assert.ok(Math.min(...Object.values(madrid)) - Math.max(...Object.values(pretoria)) >= 14)
assert.ok(Math.min(...Object.values(seniorClubRatings('esp', 10))) - Math.max(...Object.values(madrid)) >= 14)
assert.ok(Math.max(...Object.values(madrid)) <= 73)
const oldAcademy = { countryId: 'esp', ratings: { attack: 81, midfield: 79, defense: 80 } } as import('../src/engine/teams').Team
assert.deepEqual(rebalanceAcademyTeam(oldAcademy).ratings, { attack: 73, midfield: 71, defense: 72 })
assert.deepEqual(rebalanceAcademyTeam(rebalanceAcademyTeam(oldAcademy)).ratings, { attack: 73, midfield: 71, defense: 72 })
const africanYouth = { nationality: 'rsa', careerClock: { ageYears: 17 }, matchRatings: Array(8).fill(8.5), reputation: 70,
  attributes: { kind: 'outfield', values: { passing: 14, shooting: 14, dribbling: 14, tackling: 14, pace: 14, strength: 14,
    stamina: 14, agility: 14, vision: 14, composure: 14, positioning: 14, concentration: 14 } } } as Player
const englishInterest = { id: 'english-scout', clubId: 'eng-scout', clubName: academyClubNames('eng')[0], clubShort: 'MAN', countryId: 'eng', prestige: 10,
  ratings: madrid, kind: 'academy' as const, weekOffered: 100, expiresInWeeks: 8 }
const crossBorderOffers = academyOfferBatch(englishInterest, 'rsa', 100, africanYouth)
assert.equal(crossBorderOffers[0].countryId, 'eng')
assert.equal(crossBorderOffers[0].availableFromAge, 18)
assert.equal(academyRegistrationOpen(africanYouth, crossBorderOffers[0]), false)
assert.equal(academyRegistrationOpen({ ...africanYouth, careerClock: { ...africanYouth.careerClock, ageYears: 18 } }, crossBorderOffers[0]), true)
assert.ok(crossBorderOffers.some(offer => offer.countryId === 'rsa' && academyRegistrationOpen(africanYouth, offer)))
const englishTeam = initAcademyWorld(academyClubNames('eng')[0], 10, 'eng').divisions[2].teams[0]
for (const route of ['senior', 'domestic'] as const) {
  const field = europeanContinentalField(englishTeam, route)
  assert.equal(field.length, 32)
  assert.equal(new Set(field.map(team => `${team.countryId}:${team.name}`)).size, 32)
  assert.ok(field.every(team => EUROPEAN_ACADEMY_COUNTRIES.some(country => country === team.countryId)))
}

for (const country of ['eng', 'esp']) {
  const world = initAcademyWorld('Harbour Athletic', 7, country)
  const count = country === 'esp' ? 16 : 12
  const rounds = country === 'esp' ? 30 : 22
  assert.equal(world.divisions[1].teams.length, count)
  assert.equal(world.divisions[2].teams.length, count)
  assert.equal(world.divisions[1].fixtures.length, count * rounds / 2)
  assert.equal(world.divisions[2].fixtures.length, count * rounds / 2)
  assert.equal(world.divisions[1].teams.filter(t => t.name === 'Harbour Athletic').length, 1)
  assert.equal(world.divisions[2].teams.filter(t => t.name === 'Harbour Athletic').length, 1)
  assert.equal(new Set(world.divisions[1].teams.map(t => t.name)).size, count)
  const season = country === 'esp' ? SPAIN_ACADEMY_SCHEDULE : ACADEMY_SEASON_SCHEDULE
  assert.equal(season.schoolLeague.length, rounds)
  for (let round = 1; round <= rounds; round++) {
    const week = season.schoolLeague[round - 1]
    assert.deepEqual(activeCompetitionForWeek(week, 'academy', 'school', false, country), { competitionId: 'sundayLeague', round })
    assert.ok(generateWeek(week, 2, 'academy', false, 'school', false, country).events.some(e => e.type === 'match'))
  }
  const unproven = { careerClock: { ageYears: 16 }, seasonAppearances: 3, seasonRatings: [7, 7, 7] } as Player
  const strong = { ...unproven, seasonAppearances: 12, seasonRatings: Array(12).fill(7) } as Player
  const held = applyAcademyPromotion(world, unproven)
  const moved = applyAcademyPromotion(world, strong)
  assert.equal(held.playerDivision, country === 'esp' ? 1 : 2) // Spain's U17 age limit
  assert.equal(moved.playerDivision, 1)
  assert.equal(moved.divisions[1].teams.find(t => t.id === moved.playerTeamId)?.name, 'Harbour Athletic')
  assert.equal(moved.divisions[1].teams.length, count)
  assert.ok(academyDivisionLabel(1, country).includes(country === 'esp' ? 'Juvenil' : 'Premier League 2'))
}

const player = { weeklyStories: {} } as Player
const seen = new Set<string>()
for (const season of [1, 2]) for (let week = 1; week <= 44; week++) {
  const calendar = generateWeek(week, season)
  assert.ok(calendar.events.filter(e => e.type === 'school').length <= 1)
  if (!isStoryWeek(week)) continue
  const beat = weeklyStoryDecision(player, season, week)
  assert.ok(beat, `Story missing at season ${season} week ${week}`)
  assert.equal(beat.options.length, 2)
  assert.ok(beat.options.every(option => option.successChance === 1))
  const choice = beat.options[0].onSuccess?.storyChoice
  assert.ok(choice)
  player.weeklyStories![choice.key] = { path: choice.path, beat: choice.beat }
  seen.add(choice.key.split(':')[1])
  if (choice.beat === 3) assert.ok(beat.options[0].onSuccess?.narrative?.includes('earlier choices'))
}
assert.equal(seen.size, 6)
const live = { ...player, id: 'weekly-rhythm-test', attributes: { kind: 'outfield' as const,
  values: { passing: 10, shooting: 10, dribbling: 10, tackling: 10, pace: 10, strength: 10, stamina: 10, agility: 10,
    vision: 10, composure: 10, positioning: 10, concentration: 10 } }, fitness: { stamina: 60 },
  confidence: { value: 0, baseline: 0 }, totalWeeksElapsed: 7, coachTrust: 0, reputation: 0,
  careerClock: { ageYears: 16, phase: 'grassroots-season' as const, grassrootsSeason: 2 as const } } as Player
const event = { id: 'school-beat', day: 'fri' as const, type: 'school' as const, title: 'off the pitch', resolved: false }
useCareerStore.setState({ player: live, calendar: { currentWeek: { weekNumber: 2, seasonYear: 1, events: [event] }, history: [] } })
const first = weeklyStoryDecision(live, 1, 2)!
useCareerStore.getState().applyDecisionResult({ chosen: first.options[0], success: true, effect: first.options[0].onSuccess! })
assert.equal(useCareerStore.getState().player?.weeklyStories?.['1:home-kit']?.beat, 1)
assert.equal(useCareerStore.getState().calendar?.currentWeek.events[0].resolved, true)
useCareerStore.getState().chooseWeeklyFocus('recovery')
const recovered = useCareerStore.getState().player!.fitness.stamina
useCareerStore.getState().chooseWeeklyFocus('shift')
assert.equal(useCareerStore.getState().player?.fitness.stamina, recovered)
assert.equal(useCareerStore.getState().player?.weeklyFocus?.kind, 'recovery')
const playerLow = { ...live, attributes: { ...live.attributes, kind: 'outfield' as const,
  values: { ...live.attributes.values, shooting: 5 } } } as Player
const playerHigh = { ...live, attributes: { ...live.attributes, kind: 'outfield' as const,
  values: { ...live.attributes.values, shooting: 18 } } } as Player
assert.ok(initStreetGame(playerHigh, 'street', 'balanced').config.yourTeam[0].quality >
  initStreetGame(playerLow, 'street', 'balanced').config.yourTeam[0].quality)
console.log('Academy age squads, two country schedules, one life decision per week and six persistent stories passed.')
