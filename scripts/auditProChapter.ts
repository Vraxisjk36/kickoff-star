import 'fake-indexeddb/auto'
import { useCareerStore } from '../src/store/careerStore'
import { readSave } from '../src/engine/save'
import { OUTFIELD_ATTRIBUTES } from '../src/types/attributes'
import { strict as assert } from 'node:assert'
import { createProCareer, proFixture, proRound, advanceProWeek, resolveProMatch, proTrialClubs } from '../src/engine/proCareer'
import { sortStandings } from '../src/engine/league'
import type { Player } from '../src/types/player'

const offers = proTrialClubs(7)
assert.equal(proRound(4, 10), 1, 'old saves keep their ten-club match calendar')
assert.equal(proRound(3, 10), null)
assert.equal(offers.length, 4)
assert.equal(new Set(offers.map(club => club.name)).size, 4)
let state = createProCareer(offers[0].name, offers[0].prestige)
assert.equal(state.world.divisions[1].teams.length, 20)
assert.equal(state.world.divisions[1].fixtures.length, 380)
for (const team of state.world.divisions[1].teams) {
  const fixtures = state.world.divisions[1].fixtures.filter(f => f.homeTeamId === team.id || f.awayTeamId === team.id)
  assert.equal(fixtures.length, 38)
  assert.equal(fixtures.filter(f => f.homeTeamId === team.id).length, 19)
  assert.equal(fixtures.filter(f => f.awayTeamId === team.id).length, 19)
}
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
  assert.equal(new Set(standings.map(row => row.teamId)).size, 20)
  assert.equal(sortStandings(standings).length, 20)
}
assert.equal(appearances, 75)
assert.equal(state.season, 3)
assert.equal(state.week, 1)
assert.equal(state.world.divisions[1].fixtures.filter(f => f.played).length, 0)
assert.equal(state.world.matchHistory?.filter(record => record.lines.some(line => line.playerId === current.id)).length, 75)
assert.equal(current.careerClock.ageYears, 20)
assert.equal(current.money, 100 + 88 * 950) // independent agent: 5% commission
console.log('Pro chapter: 4 offers, two 38-match seasons, missed fixture, wages, history and rollover passed')

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
useCareerStore.getState().ensureLivingWorld()
const linked = useCareerStore.getState().player!.proCareer!
assert.equal(Object.keys(linked.backgroundWorld!.clubs).length, 1812)
assert.equal(linked.backgroundWorld!.players[`career-${entrant.id}`].clubId, linked.clubWorldIds![linked.world.playerTeamId])
// Interactive cup fixture must update the tournament table and match ledger once.
const ownWorldClub = linked.clubWorldIds![linked.world.playerTeamId]
const otherWorldClub = linked.clubWorldIds![linked.world.divisions[1].teams.find(team => team.id !== linked.world.playerTeamId)!.id]
linked.backgroundWorld!.competitions['audit-cup'] = { id: 'audit-cup', associationId: 'eng', kind: 'domestic-cup', seasonId: '2026',
  entrantIds: [ownWorldClub, otherWorldClub], format: { legs: 1, scheduledRounds: 1 }, tournament: { stage: 'knockout', round: 1 } }
linked.backgroundWorld!.standings['audit-cup'] = [ownWorldClub, otherWorldClub].map(clubId => ({ clubId, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }))
linked.backgroundWorld!.fixtures['audit-cup-fixture'] = { id: 'audit-cup-fixture', competitionId: 'audit-cup', kickoffDate: linked.date!, homeId: ownWorldClub, awayId: otherWorldClub }
const cupOpponent = linked.world.divisions[1].teams.find(team => team.id !== linked.world.playerTeamId)!
useCareerStore.getState().completeProCupMatch('audit-cup-fixture', { opponent: cupOpponent, home: true, scored: 2, conceded: 1, goals: 1, assists: 0, rating: 8,
  energy: 70, minutes: 90, yellowCards: 0, redCarded: false })
assert.deepEqual(useCareerStore.getState().player!.proCareer!.backgroundWorld!.fixtures['audit-cup-fixture'].result, { homeGoals: 2, awayGoals: 1 })
assert.equal(useCareerStore.getState().player!.matchLedger.at(-1)?.competitionId, 'audit-cup')
const matchCount = useCareerStore.getState().player!.matchLedger.length
useCareerStore.getState().completeProCupMatch('audit-cup-fixture', { opponent: cupOpponent, home: true, scored: 2, conceded: 1, goals: 1, assists: 0, rating: 8,
  energy: 70, minutes: 90, yellowCards: 0, redCarded: false })
assert.equal(useCareerStore.getState().player!.matchLedger.length, matchCount)
useCareerStore.getState().requestProOffers()
const firstOffer = useCareerStore.getState().player!.proCareer!.marketOffers![0]
assert.ok(firstOffer)
useCareerStore.getState().openProTransferTalks(firstOffer.teamId)
assert.equal(useCareerStore.getState().player?.proCareer?.talks?.readyWeek, 2)
const startDate = linked.date
for (let i = 0; i < 2; i++) useCareerStore.getState().advanceProCareer()
assert.equal(useCareerStore.getState().signProTransfer(), true)
assert.equal(useCareerStore.getState().player?.proCareer?.world.playerTeamId, firstOffer.teamId)
for (let i = 0; i < 4; i++) useCareerStore.getState().advanceProCareer()
const advanced = useCareerStore.getState().player!
assert.ok(advanced.proCareer!.date! > startDate!)
assert.ok(advanced.proCareer!.payStatements!.length >= 1)
assert.ok(advanced.proCareer!.backgroundWorld!.standings['top-eng'].some(row => row.played > 0))
await useCareerStore.getState().saveCurrent()
await useCareerStore.getState().loadFromSlot(2)
assert.equal(useCareerStore.getState().player?.proCareer?.date, advanced.proCareer!.date)
assert.equal(useCareerStore.getState().player?.proCareer?.payStatements?.length, advanced.proCareer!.payStatements!.length)
console.log('Living world, dated league fixtures, monthly pay and save reload passed')
useCareerStore.setState({ player: { ...entrant, proTrial: undefined, trialWeekCompleted: 3, turnedPro: { clubName: 'Legacy Club', weekSigned: 180 } } })
useCareerStore.getState().ensureProCareer()
assert.equal(useCareerStore.getState().player?.proCareer?.world.divisions[1].teams[0].name, 'Legacy Club')
assert.equal(useCareerStore.getState().player?.proCareer?.welcomed, false)
console.log('Existing V19 pro signing resumes at the celebration without replacing the old career')
useCareerStore.getState().ensureLivingWorld()
const beforeLoan = useCareerStore.getState().player!.proCareer!
const borrowingTeam = beforeLoan.world.divisions[1].teams.find(team => team.id !== beforeLoan.world.playerTeamId)!
const parentTeamId = beforeLoan.world.playerTeamId
assert.equal(useCareerStore.getState().acceptProLoan(borrowingTeam.id), true)
assert.equal(useCareerStore.getState().player?.proCareer?.loan?.parentTeamId, parentTeamId)
for (let i = 0; i < 44; i++) useCareerStore.getState().advanceProCareer()
assert.equal(useCareerStore.getState().player?.proCareer?.world.playerTeamId, parentTeamId)
assert.equal(useCareerStore.getState().player?.proCareer?.loan, null)
console.log('Bench loan, dated return and long-running world rollover passed')
