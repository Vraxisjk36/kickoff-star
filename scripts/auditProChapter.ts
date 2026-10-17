import 'fake-indexeddb/auto'
import { useCareerStore } from '../src/store/careerStore'
import { readSave } from '../src/engine/save'
import { OUTFIELD_ATTRIBUTES } from '../src/types/attributes'
import { strict as assert } from 'node:assert'
import { createProCareer, proFixture, advanceProWeek, resolveProMatch, proTrialClubs } from '../src/engine/proCareer'
import { sortStandings } from '../src/engine/league'
import type { Player } from '../src/types/player'

const offers = proTrialClubs(7)
assert.equal(offers.length, 4)
assert.equal(new Set(offers.map(club => club.name)).size, 4)
let state = createProCareer(offers[0].name, offers[0].prestige)
const own = state.world.playerTeamId
const player = { id: 'audit-pro', name: 'Test Player', position: 'ST', squadRole: 'bench', fitness: { stamina: 100 }, injury: null,
  contract: { terms: { weeklyWage: 1000, appearanceFee: 80, goalBonus: 120, years: 2, signingBonus: 1000 } }, money: 100, agentId: 'independent', careerEarnings: 0, careerClock: { ageYears: 18 }, seasonGoals: 0, seasonAssists: 0 } as Player
let current = player
let appearances = 0
for (let week = 1; week <= 88; week++) {
  const fixture = proFixture(state)
  if (fixture && week !== 6) { // one missed match must still be simulated
    const home = fixture.homeTeamId === own
    const opponent = state.world.divisions[1].teams.find(team => team.id === (home ? fixture.awayTeamId : fixture.homeTeamId))!
    const resolution = resolveProMatch(state, current, { opponent, home, scored: 2, conceded: 1, goals: 1, assists: 0, rating: 7.5, energy: 65, minutes: 65, yellowCards: 0, redCarded: false })
    state = resolution.state
    assert.equal(resolution.record.lines.some(line => line.playerId === current.id), true)
    assert.equal(proFixture(state), undefined)
    appearances++
  }
  const next = advanceProWeek(state, current)
  state = next.state; current = next.player
  const standings = state.world.divisions[1].standings
  assert.equal(standings.reduce((sum, row) => sum + row.played, 0) % 2, 0)
  assert.equal(new Set(standings.map(row => row.teamId)).size, 10)
  assert.equal(sortStandings(standings).length, 10)
}
assert.equal(appearances, 35)
assert.equal(state.season, 3)
assert.equal(state.week, 1)
assert.equal(state.world.divisions[1].fixtures.filter(f => f.played).length, 0)
assert.equal(state.world.matchHistory?.filter(record => record.lines.some(line => line.playerId === current.id)).length, 35)
assert.equal(current.careerClock.ageYears, 20)
assert.equal(current.money, 100 + 88 * 950) // independent agent: 5% commission
console.log('Pro chapter: 4 offers, two 18-match seasons, missed fixture, wages, history and rollover passed')

// Production store: direct entry, three trial decisions, signing, disk reload.
const entrant = { id: 'trial-audit', name: 'New Entrant', position: 'ST', preferredFoot: 'right', heightCm: 181,
  attributes: { kind: 'outfield', values: Object.fromEntries(OUTFIELD_ATTRIBUTES.map(attribute => [attribute, 3])) }, potential: 15,
  confidence: { value: 0, baseline: 0 }, fitness: { stamina: 100 }, careerClock: { ageYears: 14, phase: 'grassroots-trials', grassrootsSeason: 1 },
  schoolId: null, trialWeekCompleted: 0, squadRole: null, trainingMomentum: 0, matchRatings: [], seasonGoals: 0, seasonAssists: 0,
  injury: null, recentInjuryCount: 0, matchesSinceReturn: 3, coachTrust: 0, reputation: 5, scoutWatchers: [], contractOffers: [],
  totalWeeksElapsed: 0, academyClubName: null, turnedPro: null, proTrial: { week: 0, points: 0 }, nationality: 'eng', regionId: 'eng-london'
} as Player
const calendar = { currentWeek: { weekNumber: 4, seasonYear: 1, events: [] }, history: [] } as NonNullable<ReturnType<typeof useCareerStore.getState>['calendar']>
await useCareerStore.getState().startNewCareer(entrant, calendar, 2)
for (const points of [3, 2, 2]) useCareerStore.getState().completeProTrialWeek(points)
assert.deepEqual(useCareerStore.getState().player?.proTrial, { week: 3, points: 7 })
const club = proTrialClubs(7)[0]
useCareerStore.getState().signOpeningProClub(club.name, club.prestige)
assert.equal(useCareerStore.getState().player?.turnedPro?.clubName, club.name)
assert.equal(useCareerStore.getState().player?.contract?.terms.years, 2)
useCareerStore.getState().acknowledgeProSigning()
await useCareerStore.getState().saveCurrent()
assert.equal((await readSave(2))?.player.proCareer?.welcomed, true)
await useCareerStore.getState().loadFromSlot(2)
assert.equal(useCareerStore.getState().player?.proCareer?.world.kind, 'pro')
assert.equal(useCareerStore.getState().player?.trialWeekCompleted, 3)
console.log('Direct-start trial, contract, same-slot save and reload passed')
useCareerStore.setState({ player: { ...entrant, proTrial: undefined, trialWeekCompleted: 3, turnedPro: { clubName: 'Legacy Club', weekSigned: 180 } } })
useCareerStore.getState().ensureProCareer()
assert.equal(useCareerStore.getState().player?.proCareer?.world.divisions[1].teams[0].name, 'Legacy Club')
assert.equal(useCareerStore.getState().player?.proCareer?.welcomed, false)
console.log('Existing V19 pro signing resumes at the celebration without replacing the old career')
