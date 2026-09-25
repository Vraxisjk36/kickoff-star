import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import type { Player } from '../src/types/player'
import type { CalendarState } from '../src/types/calendar'
import { OUTFIELD_ATTRIBUTES } from '../src/types/attributes'
import { generateWeek, alignMatchDays, nextUnresolvedEvent } from '../src/engine/calendar'
import { initSchoolLeagueWorld, initLeagueWorld, resetSchoolLeagueSeason, applyPromotionRelegation } from '../src/engine/league'
import { initCompetitionCareer, recordCompetitionMatch } from '../src/engine/competitionCareer'
import { divisionTopScorers } from '../src/engine/leagueScorers'
import { initYouthPathway } from '../src/engine/pathway'
import { openSundayContractWindow, sundayWage, hasSundayContract } from '../src/engine/sundayContracts'
import { playerForMatch } from '../src/engine/selection'
import { sundayClub } from '../src/engine/sundayFootball'
import { useCareerStore } from '../src/store/careerStore'
import { EMPTY_CUPS, writeSave, SAVE_SCHEMA_VERSION } from '../src/engine/save'
import { reseed } from '../src/engine/rng'
import { generateTeam } from '../src/engine/teams'
import { initMatch, advanceToKeyMoment } from '../src/engine/match'

let checks = 0
function check(value: unknown, message: string) { assert.ok(value, message); checks++; console.log('✓', message) }
function player(): Player {
  const p = { id: 'sunday-audit', name: 'Audit Player', position: 'ST', preferredFoot: 'right', heightCm: 180,
    attributes: { kind: 'outfield', values: Object.fromEntries(OUTFIELD_ATTRIBUTES.map(a => [a, 10])) }, potential: 18,
    confidence: { value: 3, baseline: 0 }, fitness: { stamina: 100 }, careerClock: { ageYears: 14, phase: 'grassroots-season', grassrootsSeason: 1 },
    schoolId: null, trialWeekCompleted: 3, squadRole: 'starting-xi', grassrootsPath: 'school', trainingMomentum: 0, matchRatings: [],
    seasonGoals: 0, seasonAssists: 0, injury: null, recentInjuryCount: 0, matchesSinceReturn: 3, coachTrust: 5, reputation: 5,
    scoutWatchers: [], contractOffers: [], totalWeeksElapsed: 0, academyClubName: null, turnedPro: null, nationality: 'eng',
    competitionCareer: initCompetitionCareer(), inbox: [], relationships: [], activeArcs: [], standing: { teammates: 0, fans: 0 },
  } as Player
  p.pathway = initYouthPathway(p)
  return p
}
function calendar(week: number, season = 1): CalendarState {
  const currentWeek = generateWeek(week, season, 'grassroots-season', false, 'school', false)
  return { currentWeek: { ...currentWeek, events: currentWeek.events.map(e => ({ ...e, resolved: e.type !== 'match' })) }, history: [] }
}
function matchRecord(p: Player, id: string, goals = 1, rating = 8, season = 1) {
  return { ...p, matchRatings: [...p.matchRatings, rating].slice(-10), competitionCareer: recordCompetitionMatch(p.competitionCareer, { competitionId: id, season, started: true, minutes: 90, rating, goals, assists: 0, cleanSheet: false }) }
}

for (let week = 1; week <= 44; week++) {
  const school = generateWeek(week, 1, 'grassroots-season', false, 'school', true)
  assert.ok(school.events.filter(e => e.type === 'match' && e.title === 'matchday').every(e => e.day === 'thu'))
  assert.ok(school.events.filter(e => e.title === 'Sunday league fixture').every(e => e.day === 'sun'))
  assert.equal(new Set(school.events.map(e => e.day)).size, school.events.length, `No duplicate days in week ${week}`)
  const sunday = generateWeek(week, 1, 'grassroots-season', false, 'sunday')
  assert.ok(sunday.events.filter(e => e.type === 'match').every(e => e.day === 'sun'))
  assert.equal(new Set(sunday.events.map(e => e.day)).size, sunday.events.length)
}
check(true, 'All 44 weeks schedule school on Thursday and Sunday club football on Sunday without duplicate events')
const oldCalendar: CalendarState = { currentWeek: { seasonYear: 1, weekNumber: 12, events: [
  { id: 'street', day: 'thu', type: 'street', title: 'kickabout', resolved: false },
  { id: 'saved-match', day: 'sat', type: 'match', title: 'matchday', resolved: false },
  { id: 'sun-rest', day: 'sun', type: 'rest', title: 'rest day', resolved: false },
] }, history: [] }
const aligned = alignMatchDays(oldCalendar, 'grassroots-season', 'school', true)
check(nextUnresolvedEvent(aligned)?.id === 'saved-match' && nextUnresolvedEvent(aligned)?.day === 'thu', 'Saved match keeps its ID and moves to Thursday, with the conflicting kickabout removed')
check(aligned.currentWeek.events.some(e => e.day === 'sat' && e.type === 'rest') && !aligned.currentWeek.events.some(e => e.day === 'sun' && e.type === 'match'), 'Saved school route keeps recovery without adding a Sunday match')

const schoolWorld = initSchoolLeagueWorld('Audit High')
const division = schoolWorld.divisions[schoolWorld.playerDivision]
division.teams[1].notablePlayers[0].seasonGoals = 5
division.teams[2].notablePlayers[0].seasonGoals = 4
let scorer = player()
for (let i = 0; i < 6; i++) scorer = matchRecord(scorer, 'schoolLeague')
scorer = matchRecord(scorer, 'schoolCup', 20)
const board = divisionTopScorers(division, scorer, schoolWorld.playerTeamId, 'schoolLeague')
check(board[0].isUser && board[0].goals === 6, 'Player with six league goals ranks above NPCs with five and four')
check(board.find(p => p.isUser)?.goals === 6, 'Cup goals are not mixed into the league Golden Boot')
scorer.leagueGoals = [{ competitionId: 'sundayLeague', division: 3, goals: 6 }, { competitionId: 'sundayLeague', division: 2, goals: 1 }]
const sundayWorld = initLeagueWorld('First Sunday Club')
check(divisionTopScorers(sundayWorld.divisions[2], scorer, sundayWorld.playerTeamId, 'sundayLeague').find(p => p.isUser)?.goals === 1, 'Moving divisions does not carry old-division goals into the new scorer race')
check(resetSchoolLeagueSeason(schoolWorld).divisions[1].teams.every(t => t.notablePlayers.every(p => p.seasonGoals === 0)), 'School NPC goal counts reset with the season')
sundayWorld.divisions[3].teams[1].notablePlayers[0].seasonGoals = 12
check(Object.values(applyPromotionRelegation(sundayWorld).divisions).every(d => d.teams.every(t => t.notablePlayers.every(p => p.seasonGoals === 0))), 'Sunday promotion resets NPC seasonal scorer counts')

check(openSundayContractWindow(player(), sundayWorld, 1, true).contractOffers.length === 0, 'First school-to-Sunday contract cannot bypass the ten-match requirement')
const first = openSundayContractWindow({ ...player(), grassrootsPath: 'sunday' }, sundayWorld, 1, true)
check(first.contractOffers.length === 1 && first.contractOffers[0].divisionTier === 3 && first.contractOffers[0].weeklyWage! >= 10 && first.contractOffers[0].weeklyWage! <= 15, 'First contract is a named Division 3 club paying £10–£15')
check(openSundayContractWindow(first, sundayWorld, 1, true).contractOffers.length === 1, 'Initial contract is not reissued every week')
check(sundayWage(2, 8) === 30 && sundayWage(1, 8) === 50 && sundayWage(2, 6) === 20 && sundayWage(1, 6) === 35, 'Higher-division wage ranges are bounded and increase with sustained performance')

// Play the real school-to-Sunday recruitment path through the store.
useCareerStore.setState({ saveCurrent: async () => {} })
await useCareerStore.getState().startNewCareer(player(), calendar(3), 0)
useCareerStore.getState().ensureLeagueWorld()
for (let round = 1; round <= 10; round++) {
  const state = useCareerStore.getState()
  const world = state.league!
  const d = world.divisions[world.playerDivision]
  const fixture = d.fixtures.find(f => f.week === round && (f.homeTeamId === world.playerTeamId || f.awayTeamId === world.playerTeamId))!
  const home = fixture.homeTeamId === world.playerTeamId
  const opponentId = home ? fixture.awayTeamId : fixture.homeTeamId
  useCareerStore.setState({ calendar: calendar(round + 2), player: { ...state.player!, totalWeeksElapsed: round + 1, fitness: { stamina: 100 } } })
  useCareerStore.getState().applyMatchResult(8, 1, 0, 80, null, opponentId, 2, 0, home, undefined, 'School Opponent', 'schoolLeague')
}
let state = useCareerStore.getState()
check(state.player?.pathway?.sundayStatus === 'squad-offer' && state.player.sundayLeague, 'Ten sustained school appearances earn a real Sunday club offer')
const offered = state.player!.contractOffers.find(o => o.kind === 'club')!
check(offered.clubName === sundayClub(state.player!.sundayLeague)?.name && offered.weeklyWage! >= 10, 'Shown offer is the same club and wage that will be signed')
const schoolSnapshot = JSON.stringify(state.league)
useCareerStore.getState().acceptSundayRegistration()
state = useCareerStore.getState()
check(hasSundayContract(state.player!, 1, state.player!.sundayLeague), 'Accepting the offer creates a season contract for that club')
check(state.player!.sundayContract?.clubName === offered.clubName && state.player!.sundayContract.weeklyWage === offered.weeklyWage, 'Acceptance preserves the offered club identity and salary')
check(JSON.stringify(state.league) === schoolSnapshot && state.player!.grassrootsPath === 'school', 'Sunday signing preserves the school team and table')
// Contract signed after the week's school match: create its Sunday fixture slot.
useCareerStore.setState({ calendar: alignMatchDays({ currentWeek: generateWeek(12, 1, 'grassroots-season', false, 'school', true), history: [] }, 'grassroots-season', 'school', true) })
const side = state.player!.sundayLeague!
const sd = side.divisions[side.playerDivision]
const sf = sd.fixtures.find(f => !f.played && f.week === 12 && (f.homeTeamId === side.playerTeamId || f.awayTeamId === side.playerTeamId))!
check(!!sf, 'Signed club has a real outstanding Sunday fixture in the current round')
const sundayCalendar = useCareerStore.getState().calendar!
useCareerStore.setState({ player: { ...state.player!, fitness: { stamina: 100 } }, calendar: { ...sundayCalendar, currentWeek: { ...sundayCalendar.currentWeek, events: sundayCalendar.currentWeek.events.map(e => ({ ...e, resolved: e.day !== 'sun' })) } } })
const schoolBeforeSunday = JSON.stringify(useCareerStore.getState().league)
const sidePlayed = sd.standings.find(s => s.teamId === side.playerTeamId)!.played
useCareerStore.getState().applyMatchResult(8, 2, 1, 75, null, sf.homeTeamId === side.playerTeamId ? sf.awayTeamId : sf.homeTeamId, 3, 0, sf.homeTeamId === side.playerTeamId, undefined, 'Sunday Opponent', 'sundayLeague', undefined, false, undefined, true, { minutes: 30, started: false })
state = useCareerStore.getState()
check(JSON.stringify(state.league) === schoolBeforeSunday, 'A Sunday match never changes school standings')
check(state.player!.sundayLeague!.divisions[3].standings.find(s => s.teamId === side.playerTeamId)!.played === sidePlayed + 1, 'Sunday result updates its own persistent league table')
check(state.player!.competitionCareer!.current.schoolLeague.goals === 10 && state.player!.competitionCareer!.current.sundayLeague.goals === 2, 'School and Sunday goals remain separate')

const beforePay = state.player!.finances?.transactions.length ?? 0
useCareerStore.getState().advanceToNextWeek()
state = useCareerStore.getState()
const salary = state.player!.finances!.transactions.slice(beforePay).filter(t => t.description.includes('Sunday league salary'))
check(salary.length === 1 && salary[0].amount === offered.weeklyWage, 'Exactly one agreed weekly salary is posted to the pound ledger')
check(state.player!.contractOffers.filter(o => o.kind === 'club').length === 0, 'No new Sunday offers during the signed season')
const signedClubId = state.player!.sundayContract!.clubId
const otherTeam = state.player!.sundayLeague!.divisions[2].teams[0]
useCareerStore.setState({ player: { ...state.player!, contractOffers: [{ ...offered, id: 'blocked-midseason', clubId: otherTeam.id, clubName: otherTeam.name, divisionTier: 2, weeklyWage: 30, weekOffered: state.player!.totalWeeksElapsed }] } })
useCareerStore.getState().respondToOffer('blocked-midseason', true)
check(useCareerStore.getState().player!.sundayContract!.clubId === signedClubId, 'A current season contract prevents a midseason club switch')

// Persist and reload both worlds and the wage agreement.
state = useCareerStore.getState()
await writeSave({ schemaVersion: SAVE_SCHEMA_VERSION, slotId: 1, savedAt: new Date().toISOString(), player: state.player!, calendar: state.calendar!, league: state.league, academyLeague: null, cups: { ...EMPTY_CUPS }, international: null, pendingTraining: null })
const storedSunday = JSON.stringify(state.player!.sundayLeague)
await useCareerStore.getState().loadFromSlot(1)
check(JSON.stringify(useCareerStore.getState().player!.sundayLeague) === storedSunday && useCareerStore.getState().player!.sundayContract!.weeklyWage === offered.weeklyWage, 'Both leagues and the signed wage survive save/reload')

let endPlayer = useCareerStore.getState().player!
for (let i = 0; i < 12; i++) endPlayer = matchRecord(endPlayer, 'sundayLeague')
endPlayer = { ...endPlayer, contractOffers: [], totalWeeksElapsed: 43 }
useCareerStore.setState({ player: endPlayer, calendar: calendar(44), cups: { ...EMPTY_CUPS }, international: null })
useCareerStore.getState().advanceToNextWeek()
state = useCareerStore.getState()
const windowOffers = state.player!.contractOffers.filter(o => o.kind === 'club')
check(state.calendar!.currentWeek.seasonYear === 2 && state.calendar!.currentWeek.weekNumber === 1 && windowOffers.length > 0, 'Transfer week opens at the season boundary after table promotion')
check(windowOffers.some(o => o.renewal) && windowOffers.every(o => o.contractSeason === 2 && o.expiresInWeeks === 1), 'Renewal and other approaches are one batch of full-season contracts with a one-week deadline')
check(state.player!.leagueGoals!.length === 0, 'Player league goal ledger resets for the new season')
const better = windowOffers.find(o => !o.renewal && o.divisionTier! < state.player!.sundayLeague!.playerDivision)
check(!!better, 'A sustained strong season can earn a higher-division contract')
useCareerStore.getState().respondToOffer(better!.id, true)
state = useCareerStore.getState()
check(state.player!.sundayLeague!.playerTeamId === better!.clubId && state.player!.sundayContract!.weeklyWage === better!.weeklyWage, 'Transfer-week signing moves to the offered real club and pays its agreed higher wage')
check(state.player!.contractOffers.every(o => o.kind !== 'club'), 'Signing closes the other Sunday contract offers')

const p3 = playerForMatch({ ...state.player!, grassrootsPath: 'sunday', squadRole: 'starting-xi', fitness: { stamina: 100 }, sundayContract: { ...state.player!.sundayContract!, division: 3 } }, 'sundayLeague')
const p1 = playerForMatch({ ...p3, sundayContract: { ...p3.sundayContract!, division: 1 } }, 'sundayLeague')
check(p3.matchEnergyMultiplier === 1 && p1.matchEnergyMultiplier === 1.25, 'Higher Sunday division supplies the correct match-energy context')
const team = generateTeam(4), opponent = generateTeam(4)
reseed(91); const third = advanceToKeyMoment(initMatch(p3, team, opponent, true), p3).state
reseed(91); const firstDivision = advanceToKeyMoment(initMatch(p1, team, opponent, true), p1).state
check(firstDivision.matchStamina < third.matchStamina, 'Higher-division match actually drains more energy in the live engine')
console.log(`\n${checks} Sunday football checks passed`)
