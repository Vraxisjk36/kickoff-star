import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import type { Player } from '../src/types/player'
import type { CalendarState } from '../src/types/calendar'
import { OUTFIELD_ATTRIBUTES } from '../src/types/attributes'
import { initCompetitionCareer, recordCompetitionMatch, archiveCompetitionSeason } from '../src/engine/competitionCareer'
import { academyRecruitmentReport, reviewAcademyShowcase, migrateAcademyRecruitment, canPlayYouthShowcase, academyOfferCleared } from '../src/engine/academyRecruitment'
import { initYouthPathway, representativeSelection, selectionPassed } from '../src/engine/pathway'
import { currentPerformance, updateSundayRecruitment, representativeEvidence } from '../src/engine/youthOpportunities'
import { initScoutingState, maybeAddWatcher, checkForOffers, updateWatcherInterest } from '../src/engine/scouting'
import { matchAvailability, decideSelection, playerForMatch } from '../src/engine/selection'
import { initMatch, advanceToKeyMoment } from '../src/engine/match'
import { generateTeam } from '../src/engine/teams'
import { formQualifiesForSelection } from '../src/engine/international'
import { activeCompetitionForWeek } from '../src/engine/calendar'
import { useCareerStore } from '../src/store/careerStore'
import { EMPTY_CUPS, writeSave, SAVE_SCHEMA_VERSION } from '../src/engine/save'
import { reseed } from '../src/engine/rng'
import { initSchoolLeagueWorld } from '../src/engine/league'

let checks = 0
function check(condition: unknown, message: string) { assert.ok(condition, message); checks++; console.log('✓', message) }
function calendar(season = 1, week = 3): CalendarState {
  return { currentWeek: { seasonYear: season, weekNumber: week, events: [{ id: `match-${season}-${week}`, day: 'sat', type: 'match', title: 'matchday', resolved: false }] }, history: [] }
}
function player(): Player {
  const p = { id: 'progression-audit', name: 'Audit Striker', position: 'ST', preferredFoot: 'right', heightCm: 180,
    attributes: { kind: 'outfield', values: Object.fromEntries(OUTFIELD_ATTRIBUTES.map(a => [a, 12])) }, potential: 18,
    confidence: { value: 5, baseline: 0 }, fitness: { stamina: 100 }, careerClock: { ageYears: 14, phase: 'grassroots-season', grassrootsSeason: 1 },
    schoolId: null, trialWeekCompleted: 3, squadRole: 'starting-xi', grassrootsPath: 'school', trainingMomentum: 0, matchRatings: [],
    seasonGoals: 0, seasonAssists: 0, injury: null, recentInjuryCount: 0, matchesSinceReturn: 3, coachTrust: 8, reputation: 5,
    scoutWatchers: [], contractOffers: [], totalWeeksElapsed: 0, academyClubName: null, turnedPro: null, nationality: 'eng',
    competitionCareer: initCompetitionCareer(), inbox: [], relationships: [], activeArcs: [], standing: { teammates: 0, fans: 0 },
  } as Player
  p.pathway = initYouthPathway(p)
  return p
}
function addMatches(p: Player, count: number, season: number, rating = 7.5, id = 'schoolLeague'): Player {
  let result = p
  for (let i = 0; i < count; i++) result = { ...result,
    matchRatings: [...result.matchRatings, rating].slice(-10),
    competitionCareer: recordCompetitionMatch(result.competitionCareer, { competitionId: id, season, started: true, minutes: 90, rating, goals: 0, assists: 0, cleanSheet: false }),
  }
  return result
}
function established(rating = 7.5): Player {
  let p = player()
  for (let season = 1; season <= 2; season++) {
    p = addMatches(p, 18, season, rating)
    p.competitionCareer = archiveCompetitionSeason(p.competitionCareer, season)
  }
  p = addMatches(p, 18, 3, rating)
  return { ...p, careerClock: { ageYears: 16, phase: 'grassroots-season', grassrootsSeason: 3 }, totalWeeksElapsed: 123 }
}

const young = addMatches(player(), 3, 1, 9.5)
check(!academyRecruitmentReport(young, calendar(1, 36)).canInvite, 'Three outstanding games cannot trigger an academy invitation')
check(!reviewAcademyShowcase(young, calendar(1, 36)).pathway?.showcaseInvited, 'October itself does not bypass age or experience')
check(maybeAddWatcher({ ...initScoutingState(), reputation: 100 }, 15, 30).watchers.length === 0, 'Even maximum reputation cannot attract academy scouts before 16')
const proven = established()
check(!academyRecruitmentReport(proven, calendar(3, 35)).canInvite, 'Third-year September remains closed')
check(academyRecruitmentReport(proven, calendar(3, 36)).canInvite, 'Sustained three-year record qualifies in third-year October')
check(!academyRecruitmentReport({ ...proven, careerClock: { ...proven.careerClock, ageYears: 15 } }, calendar(3, 36)).canInvite, 'Age and season are independent gates')
check(!academyRecruitmentReport({ ...young, careerClock: proven.careerClock }, calendar(3, 36)).canInvite, 'Simply aging up cannot replace a performance record')
check(!academyRecruitmentReport(addMatches(established(5.5), 3, 3, 10), calendar(3, 36)).canInvite, 'Three great matches cannot erase two poor seasons')
const invited = reviewAcademyShowcase(proven, calendar(3, 36))
check(invited.pathway?.showcaseInvited && invited.inbox?.length === 1, 'Qualified player gets an explained showcase invitation')
check(reviewAcademyShowcase(invited, calendar(3, 37)).inbox?.length === 1, 'Showcase announcement is issued only once per season')
check(canPlayYouthShowcase(invited, calendar(3, 37)) && !canPlayYouthShowcase(invited, calendar(4, 37)), 'A showcase invitation cannot carry into another season')
check(activeCompetitionForWeek(38, 'grassroots-season', 'sunday')?.competitionId === 'youthShowcase', 'Sunday pathway has an October showcase without displacing its cup final')

const club = generateTeam(3)
let scouting = { ...initScoutingState(), watchers: [{ club, tier: 'local' as const, interest: 100, watchedMatches: 0 }] }
check(checkForOffers(scouting, 123, false, 16, academyRecruitmentReport(proven, calendar(3, 36))).offers.length === 0, 'Interest alone cannot skip repeated scouting visits')
let watched = updateWatcherInterest(scouting, 8, 90)
watched = updateWatcherInterest(watched, 8, 90)
check(watched.watchers[0].watchedMatches === 1, 'Two matches in one week count as one scouting visit')
for (let week = 91; week < 96; week++) watched = updateWatcherInterest(watched, 8, week)
check(checkForOffers(watched, 123, false, 16, academyRecruitmentReport(proven, calendar(3, 36))).offers.length === 1, 'A watched, proven player can receive an academy trial in October')
check(checkForOffers(watched, 122, false, 16, academyRecruitmentReport(proven, calendar(3, 35))).offers.length === 0, 'A ready club waits for the invitation window')
check(checkForOffers(watched, 123, false, 16).offers.length === 0, 'Legacy offer calls cannot bypass the career review')
check(checkForOffers(watched, 123, true, 16).offers.length === 0 && checkForOffers(watched, 123, true, 17).offers.length === 1, 'Professional age gate still works')

for (const energy of [29, 30, 49, 50]) {
  const p = { ...player(), fitness: { stamina: energy } }
  const a = matchAvailability(p)
  check(a.canPlay === (energy >= 30) && a.canStart === (energy >= 50), `${energy}% energy respects both boundaries`)
  const verdict = decideSelection(p, [])
  check(energy >= 50 || verdict.role !== 'starting-xi', `${energy}% cannot sneak into the XI through selection`)
  const match = initMatch(p, generateTeam(3), generateTeam(3), true)
  check(match.onPitch === (energy >= 50), `${energy}% is enforced by the match engine`)
  if (energy < 30) {
    let state = match
    for (let i = 0; i < 100 && !state.finished; i++) {
      const next = advanceToKeyMoment(state, p)
      check(!next.keyMoment, 'Excluded player receives no playable moments')
      state = next.state
    }
    check(state.finished && state.playerStats.goals === 0 && state.playerMoments === 0, 'Team can finish the match with exhausted player excluded')
  }
}

let sunday = player()
for (let i = 1; i <= 10; i++) {
  sunday = updateSundayRecruitment(addMatches(sunday, 1, 1, 8), 8)
  if (i === 3) check(sunday.pathway?.sundayStatus === 'undiscovered', 'Three games do not earn Sunday training or squad offers')
  if (i === 6) check(sunday.pathway?.sundayStatus === 'training-invite', 'Six sustained performances can earn a training invitation')
}
check(sunday.pathway?.sundayStatus === 'squad-offer', 'Ten strong performances can earn a Sunday squad offer')
sunday.pathway!.sundayStatus = 'registered'
check(updateSundayRecruitment(sunday, 4).pathway?.sundayStatus === 'registered', 'A registered Sunday player never loses registration after a match')
check(!representativeEvidence(young, 'regional').eligible && !selectionPassed(representativeSelection(young, 'regional'), 'regional'), 'Three excellent games cannot qualify for Regional XI')
check(representativeEvidence(addMatches(player(), 10, 1, 7.5), 'regional').eligible, 'A sustained school-season record can qualify for regional consideration')
const regional = { ...addMatches(player(), 2, 1, 9, 'nationalChampionship'), pathway: { ...initYouthPathway(player()), regionalSelection: 'selected' as const } }
check(!representativeEvidence(regional, 'national').eligible, 'Two championship matches cannot earn national selection')
const national = addMatches(regional, 1, 1, 9, 'nationalChampionship')
check(representativeEvidence(national, 'national').eligible, 'Three strong championship appearances can reach national consideration')
check(playerForMatch(regional, 'nationalChampionship').squadRole === 'bench', 'School starter begins representative football on the bench')
check(playerForMatch(national, 'nationalChampionship').squadRole === 'starting-xi', 'Representative starts can be earned through representative appearances')
check(!formQualifiesForSelection([9, 9]) && formQualifiesForSelection([7.5, 7.5, 7.5, 7.5, 7.5]), 'International match selection requires a full five-match form window')

const premature = { ...young, pathway: { ...young.pathway!, recruitmentVersion: undefined, showcaseInvited: true, academyTrialStatus: 'invited' as const },
  contractOffers: [{ id: 'early', kind: 'academy' as const, clubId: club.id, clubName: club.name, clubShort: club.short, ratings: club.ratings, prestige: 3, weekOffered: 2, expiresInWeeks: 8 }] }
const migrated = migrateAcademyRecruitment(premature, calendar(1, 5))
check(!migrated.pathway?.showcaseInvited && migrated.contractOffers.length === 0, 'Existing premature academy invitations are cleared')
assert.deepEqual(migrated.competitionCareer, premature.competitionCareer)
check(migrated.matchRatings.length === 3 && migrated.careerClock.ageYears === 14, 'Save repair preserves history and age')
const alreadyJoined = { ...premature, careerClock: { ...premature.careerClock, phase: 'academy' as const } }
check(migrateAcademyRecruitment(alreadyJoined, calendar(1, 5)) === alreadyJoined, 'Previously completed academy moves are not undone')

// Reproduce the user's exact scenario through the production store.
useCareerStore.setState({ saveCurrent: async () => {} })
await useCareerStore.getState().startNewCareer(player(), calendar(), 0)
for (let i = 0; i < 3; i++) {
  useCareerStore.setState({ calendar: calendar(1, i + 3) })
  useCareerStore.getState().applyMatchResult(8.5, [2, 2, 1][i], i === 1 ? 1 : 0, 100, null, 'opponent', 3, 0, true, undefined, 'Opponent', 'schoolLeague')
}
const after = useCareerStore.getState().player!
check(after.career?.goals === 5 && after.career.assists === 1 && after.career.appearances === 3, 'Production store records three games, five goals, one assist')
check(!after.pathway?.showcaseInvited && after.contractOffers.length === 0 && after.scoutWatchers.length === 0 && after.pathway?.sundayStatus === 'undiscovered', 'Exact reproduction produces no premature academy or Sunday invitation')
useCareerStore.getState().completeAcademyMove('Early Academy', 5)
check(useCareerStore.getState().player?.careerClock.phase === 'grassroots-season', 'Direct academy move cannot bypass eligibility and trial/negotiation')
useCareerStore.setState({ player: { ...after, fitness: { stamina: 29 } }, calendar: calendar(1, 6) })
useCareerStore.getState().applyMatchResult(10, 5, 2, 10, null, 'opponent', 5, 0, true, undefined, 'Opponent', 'schoolLeague')
check(useCareerStore.getState().player?.career?.appearances === 3, 'An excluded player cannot receive phantom appearances or stats')
await writeSave({ schemaVersion: SAVE_SCHEMA_VERSION, slotId: 1, savedAt: new Date().toISOString(), player: premature, calendar: calendar(1, 5), league: null, academyLeague: null, cups: { ...EMPTY_CUPS }, international: null, pendingTraining: null })
await useCareerStore.getState().loadFromSlot(1)
check(!useCareerStore.getState().player?.pathway?.showcaseInvited && currentPerformance(useCareerStore.getState().player!, ['schoolLeague']).appearances === 3, 'Real save loading repairs invitations without resetting match history')

// Check a weekly review with no fixture: eliminated players still get a chance.
await useCareerStore.getState().startNewCareer(player(), calendar(3, 35), 2)
useCareerStore.setState({ player: proven, calendar: calendar(3, 35) })
reseed(731)
useCareerStore.getState().advanceToNextWeek()
check(useCareerStore.getState().player?.pathway?.showcaseInvited, 'October invitation runs on the weekly clock even without a match')

const weeklyBase = useCareerStore.getState().player!
useCareerStore.setState({ player: { ...weeklyBase, ...young }, calendar: calendar(1, 28), league: initSchoolLeagueWorld('Audit High'), cups: { ...EMPTY_CUPS }, international: null })
useCareerStore.getState().advanceToNextWeek()
check(useCareerStore.getState().player?.pathway?.regionalSelection === 'cut', 'Production regional review rejects a three-match record')

const academyOffer = { id: 'three-week-trial', kind: 'academy' as const, clubId: club.id, clubName: club.name,
  clubShort: club.short, countryId: 'eng', ratings: club.ratings, prestige: 6, weekOffered: 123, expiresInWeeks: 8 }
useCareerStore.setState({ player: { ...proven, totalWeeksElapsed: 123, contractOffers: [academyOffer] }, calendar: calendar(3, 36) })
useCareerStore.getState().resolveAcademyTrial(academyOffer.id, 17)
check(useCareerStore.getState().player?.pathway?.academyTrialSessions === 1 && useCareerStore.getState().player?.pathway?.academyTrialStatus === 'active',
  'First academy assessment is saved as an active weekly trial')
useCareerStore.getState().resolveAcademyTrial(academyOffer.id, 17)
check(useCareerStore.getState().player?.pathway?.academyTrialSessions === 1, 'Trial cannot complete two assessments in one week')
await writeSave({ schemaVersion: SAVE_SCHEMA_VERSION, slotId: 2, savedAt: new Date().toISOString(),
  player: useCareerStore.getState().player!, calendar: calendar(3, 36), league: null, academyLeague: null,
  cups: { ...EMPTY_CUPS }, international: null, pendingTraining: null })
await useCareerStore.getState().loadFromSlot(2)
check(useCareerStore.getState().player?.pathway?.academyTrialSessions === 1 && useCareerStore.getState().player?.pathway?.academyTrialPoints === 17,
  'Academy trial session and score survive save and reload')
for (const [week, points] of [[37, 17], [38, 19]]) {
  const current = useCareerStore.getState().player!
  useCareerStore.setState({ player: { ...current, totalWeeksElapsed: current.totalWeeksElapsed + 1 }, calendar: calendar(3, week) })
  useCareerStore.getState().resolveAcademyTrial(academyOffer.id, points)
}
check(useCareerStore.getState().player?.pathway?.academyTrialSessions === 3 && useCareerStore.getState().player?.pathway?.academyTrialStatus === 'passed',
  'Three weekly assessments complete the academy trial before negotiations')
check(useCareerStore.getState().player?.competitionCareer?.selections.filter(record => record.competitionId === 'academyTrials').length === 3,
  'All three trial cuts are recorded in the career')
const trialGraduate = useCareerStore.getState().player!
const academyOffers = trialGraduate.contractOffers.filter(offer => offer.kind === 'academy')
check(academyOffers.length >= 3 && academyOffers.length <= 6 && new Set(academyOffers.map(offer => offer.countryId)).size === academyOffers.length,
  'Passed trial produces three to six academy choices across distinct countries')
check(academyOffers.every(offer => academyOfferCleared(trialGraduate, offer.id)), 'Every post-trial academy offer can enter talks')
const alternative = academyOffers[1]
useCareerStore.setState({ player: { ...trialGraduate, agentId: 'parent' } })
useCareerStore.getState().beginNegotiation(alternative.id)
check(useCareerStore.getState().player?.negotiation?.clubId === alternative.clubId,
  'Player can choose a different academy from the original trial club')
const negotiating = useCareerStore.getState().player!
useCareerStore.setState({ player: { ...negotiating, negotiation: { ...negotiating.negotiation!, stage: 'complete' } } })
useCareerStore.getState().completeAcademyMove(alternative.clubName, alternative.prestige)
const signedAcademy = useCareerStore.getState()
check(signedAcademy.player?.academyCountryId === alternative.countryId && signedAcademy.academyLeague?.divisions[2].teams.every(team => team.countryId === alternative.countryId),
  'Signing an alternate academy creates its domestic league in the offered country')
const academyPlayer = signedAcademy.player!
const academyWorld = signedAcademy.academyLeague!
useCareerStore.setState({ player: academyPlayer, academyLeague: academyWorld, calendar: calendar(3, 23) })
useCareerStore.getState().advanceToNextWeek()
check(useCareerStore.getState().cups.academyChampionsCup === null, 'Lower-tier academy does not receive a continental cup place')
const topTeam = academyWorld.divisions[1].teams[0]
useCareerStore.setState({ player: academyPlayer, academyLeague: { ...academyWorld, playerDivision: 1, playerTeamId: topTeam.id },
  calendar: calendar(3, 23), cups: { ...EMPTY_CUPS } })
useCareerStore.getState().advanceToNextWeek()
const continental = useCareerStore.getState().cups.academyChampionsCup
check(continental?.teams.length === 8 && new Set(continental.teams.map(team => team.countryId)).size === 8 &&
  useCareerStore.getState().player?.competitionCareer?.qualifications.some(q => q.qualifiedFor === 'academyChampionsCup'),
  'Top-four academy qualifies and receives an eight-country continental bracket')

console.log(`\n${checks} progression checks passed`)
