import { initSchoolLeagueWorld } from '../src/engine/league'
import { recordCompetitionMatch, initCompetitionCareer } from '../src/engine/competitionCareer'
import { decideSelection, playerForMatch } from '../src/engine/selection'
import { schoolsForRegion } from '../src/engine/schools'
import { regionsFor } from '../src/engine/regions'
import { useCareerStore } from '../src/store/careerStore'
import type { Player } from '../src/types/player'

function check(condition: unknown, message: string) { if (!condition) throw new Error(message) }
const regionId = regionsFor('eng')[0].id
const schools = schoolsForRegion(regionId)
const league = initSchoolLeagueWorld(schools[0].name, regionId)
const legacy = initSchoolLeagueWorld(schoolsForRegion(null)[0].name)
check(schoolsForRegion(null).every(school => Object.values(legacy.divisions).some(division => division.teams.some(team => team.name === school.name))), 'unlocated careers have all transfer schools in their league')
let player = {
  schoolId: schools[0].id, regionId, position: 'ST',
  grassrootsPath: 'school', squadRole: 'released',
  careerClock: { phase: 'grassroots-season', ageYears: 15 },
  fitness: { stamina: 90 }, confidence: { value: 0, baseline: 0 },
  coachTrust: 10, reputation: 60, attributes: { kind: 'outfield', values: {} },
  competitionCareer: initCompetitionCareer(), career: { appearances: 0 },
  matchRatings: [], squad: [], pathway: { schoolSquad: 'development' },
  contractOffers: [], totalWeeksElapsed: 24,
} as unknown as Player
check(decideSelection(player, []).changed === null, 'cut player cannot rise from trust alone')
check(playerForMatch(player, 'schoolDevelopmentLeague').squadRole === 'starting-xi', 'cut player can play development fixtures')
for (let i = 0; i < 3; i++) {
  player = { ...player, competitionCareer: recordCompetitionMatch(player.competitionCareer, {
    competitionId: 'schoolDevelopmentLeague', season: 1, started: true,
    minutes: 90, rating: 7, goals: 0, assists: 0, cleanSheet: false,
  }) }
}
const calendar = { currentWeek: { weekNumber: 24, seasonYear: 1, events: [] }, history: [] }
useCareerStore.setState({ player, calendar: calendar as never, league, activeSlot: null })
useCareerStore.getState().requestSchoolTransfer(schools[1].id)
const transferred = useCareerStore.getState()
check(transferred.player?.schoolId === schools[1].id, 'sustained development form earns school transfer')
check(transferred.player?.squadRole === 'reserves', 'transfer begins with reserves, not first team')
check(transferred.league?.playerTeamId !== league.playerTeamId, 'transfer changes the represented team')
check(transferred.player?.schoolTransferSeason === 1, 'only one transfer assessment per season')
const firstTeamId = transferred.league?.playerTeamId
useCareerStore.getState().requestSchoolTransfer(schools[2].id)
check(useCareerStore.getState().league?.playerTeamId === firstTeamId, 'second assessment is blocked')
console.log('School pathway: released player match access and evidence based transfer passed')
