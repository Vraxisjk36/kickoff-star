import type { Player } from '../types/player'
import type { LeagueWorld, Division, Fixture } from './league'
import { batchSimDivisionRound, recordPlayerMatchResult, resetSchoolLeagueSeason } from './league'
import { generateTeam, type Team } from './teams'
import { calibrateSeniorTeam, proRatingTarget } from './proRatings'
import { proClubIdentity, PRO_TOP_FLIGHT_IDENTITIES } from './proClubIdentities'
import type { MatchLine, MatchRecord } from './matchLedger'
import { netWage } from './agents'
import type { ProWorldState } from './proWorld'
import { plannedClubCount } from './proWorldFactory'
import { recordHumanProLeagueMatch } from './proWorldSimulation'
import { PRO_INTERACTIVE_COUNTRIES } from './proLeagueRegistry'
import { scheduleSeniorInternational, forfeitSeniorInternational, type SeniorInternationalCareer } from './proInternational'

export interface ProPayStatement { season: number; month: string; gross: number; bonus: number; estimatedWithholding: number; agentFee: number; housing: number; net: number }
export interface ProMarketOffer { teamId: string; worldClubId: string; weeklyWage: number; expiresWeek: number }

export type ClubObjective = 'title' | 'continental' | 'top-half' | 'survival'
export interface ProClubObjective {
  seasonId: string
  competitionId: string
  clubId: string
  type: ClubObjective
  targetPosition: number
  boardConfidence: number
  lastReviewedSeason?: string
}
export interface ProSeasonRecord { season: number; associationId: string; clubName: string; leaguePosition: number; clubs: number; appearances: number; goals: number; assists: number; leagueChampion: boolean; objectiveMet?: boolean; boardConfidence?: number }

export interface ProCareerState {
  world: LeagueWorld
  associationId?: string
  ratingBalanceVersion?: number
  clubNameVersion?: number
  /** Actual living-world competition identity (may become second-tier after relegation). */
  activeCompetitionId?: string
  activeSeasonId?: string
  season: number
  week: number
  welcomed: boolean
  preseasonIntroducedSeason?: number
  leagueIntroducedSeason?: number
  preseasonPlayedWeeks?: number[]
  /** Career ends at age 38 after the final senior season. */
  retired?: boolean
  seasonRecords?: ProSeasonRecord[]
  clubObjective?: ProClubObjective
  lastRenewalWeek?: number
  /** Persisted unattached status after an expired contract; career still advances. */
  freeAgentSinceWeek?: number
  international?: SeniorInternationalCareer
  trainedWeek?: number
  /** Day 0-6 within the current week; legacy saves begin on Monday. */
  day?: number
  trainedDays?: number[]
  /** Matchday resolution is persisted before advancing so a reload cannot replay a result. */
  resolvedWeek?: number
  /** The original 75-association simulation, only allocated after reaching pro. */
  backgroundWorld?: ProWorldState
  clubWorldIds?: Record<string, string>
  date?: string
  shirtNumber?: number
  residence?: { countryId: string; city: string; monthlyRent: number; hotelUntil: string }
  payStatements?: ProPayStatement[]
  pendingBonus?: number
  marketOffers?: ProMarketOffer[]
  talks?: { offer: ProMarketOffer; readyWeek: number; countered: boolean } | null
  loan?: { parentTeamId: string; parentWorldClubId: string; borrowingClubId: string; ends: string; originalWage: number; returnSeason: number } | null
  news?: import('./proNews').ProNewsArticle[]
}

const LEAGUE_WEEKS = Array.from({ length: 40 }, (_, index) => index + 5).filter(week => week !== 18 && week !== 29)
const LONG_LEAGUE_WEEKS = Array.from({ length: 48 }, (_, index) => index + 5).filter(week => week !== 18 && week !== 29)

export const PRO_CAREER_DESTINATIONS = [
  { id: 'eng', name: 'England', cities: ['London', 'Manchester', 'Liverpool', 'Leeds'] },
  { id: 'esp', name: 'Spain', cities: ['Madrid', 'Barcelona', 'Valencia', 'Seville'] },
  { id: 'ger', name: 'Germany', cities: ['Berlin', 'Munich', 'Hamburg', 'Dortmund'] },
  { id: 'fra', name: 'France', cities: ['Paris', 'Marseille', 'Lyon', 'Lille'] },
  { id: 'ita', name: 'Italy', cities: ['Rome', 'Milan', 'Turin', 'Naples'] },
  { id: 'ned', name: 'Netherlands', cities: ['Amsterdam', 'Rotterdam', 'Eindhoven', 'Utrecht'] },
  { id: 'por', name: 'Portugal', cities: ['Lisbon', 'Porto', 'Braga', 'Coimbra'] },
  { id: 'bra', name: 'Brazil', cities: ['São Paulo', 'Rio de Janeiro', 'Salvador', 'Belo Horizonte'] },
  { id: 'rsa', name: 'South Africa', cities: ['Johannesburg', 'Pretoria', 'Cape Town', 'Durban'] },
  { id: 'sco', name: 'Scotland', cities: ['Glasgow', 'Edinburgh', 'Aberdeen', 'Dundee'] },
] as const

export function proTrialClubs(points: number, associationId = 'eng'): Team[] {
  const region = PRO_CAREER_DESTINATIONS.find(item => item.id === associationId) ?? PRO_CAREER_DESTINATIONS[0]
  const base = points >= 5 ? 5 : points >= 3 ? 4 : 3
  return region.cities.map((_, index) => {
    const team = generateTeam(Math.min(6, base + (index === 3 ? 1 : 0)))
    const options = PRO_TOP_FLIGHT_IDENTITIES[associationId] ?? []
    const name = options[(index * 3 + Math.min(2,Math.floor(points/3))) % Math.max(1,options.length)]
      ?? proClubIdentity(associationId,index,1,region.name).name
    return { ...team, name, short: name.split(' ').map(part => part[0]).join('').slice(0, 3).toUpperCase() }
  })
}

export function createProCareer(clubName: string, prestige = 4, associationId = 'eng'): ProCareerState {
  if (!PRO_INTERACTIVE_COUNTRIES.includes(associationId)) throw new Error('Unavailable professional destination')
  const region = PRO_CAREER_DESTINATIONS.find(item => item.id === associationId) ?? PRO_CAREER_DESTINATIONS[0]
  const count = plannedClubCount(associationId)
  const own = calibrateSeniorTeam(generateTeam(Math.max(3, Math.min(6, prestige))),
    proRatingTarget(associationId,1,Math.max(0,Math.round((10-prestige)/10*(count-1))),count))
  own.name = clubName
  own.short = clubName.split(' ').map(part => part[0]).join('').slice(0, 3).toUpperCase()
  const others = Array.from({ length: count - 1 }, (_, index) => {
    const chosen = (PRO_TOP_FLIGHT_IDENTITIES[associationId] ?? []).filter(name=>name!==clubName)
    const name = chosen[index] ?? proClubIdentity(associationId,index+1,1,region.name).name
    const team = calibrateSeniorTeam(generateTeam(3 + index % 4),
      proRatingTarget(associationId,1,index+1,count))
    return { ...team, name, short: name.split(' ').map(part => part[0]).join('').slice(0, 3).toUpperCase() }
  })
  const teams = [own, ...others]
  const rounds: Fixture[] = []
  const ids = teams.map(team => team.id)
  for (let round = 0; round < ids.length - 1; round++) {
    for (let i = 0; i < ids.length / 2; i++) {
      const a = ids[i], b = ids[ids.length - 1 - i]
      for (const leg of [0, 1]) {
        const homeTeamId = leg ? b : a, awayTeamId = leg ? a : b
        rounds.push({ id: `pro:${round}:${i}:${leg}`, week: round + 1 + leg * (ids.length - 1), homeTeamId, awayTeamId, played: false, homeGoals: null, awayGoals: null })
      }
    }
    ids.splice(1, 0, ids.pop()!)
  }
  const standings = teams.map(team => ({ teamId: team.id, teamName: team.name, teamShort: team.short, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }))
  const division: Division = { tier: 1, teams, standings, fixtures: rounds, matchRecords: [] }
  return { associationId, world: { divisions: { 1: division, 2: { ...division, teams: [], standings: [], fixtures: [], matchRecords: [] }, 3: { ...division, teams: [], standings: [], fixtures: [], matchRecords: [] } }, playerDivision: 1, playerTeamId: own.id, kind: 'pro' }, season: 1, week: 1, welcomed: false }
}

/** Professional calendars follow the number of fixtures in their competition.
 * Old ten-team saves retain their original eighteen-match schedule.
 */
export function proRound(week: number, teamCount = 20, scheduledRounds?: number): number | null {
  if (teamCount === 10 && (!scheduledRounds || scheduledRounds <= 18))
    return week >= 4 && week <= 38 && (week - 4) % 2 === 0 ? (week - 4) / 2 + 1 : null
  const rounds = scheduledRounds ?? (teamCount === 12 ? 38 : (teamCount - 1) * 2)
  const weeks = rounds > LEAGUE_WEEKS.length ? LONG_LEAGUE_WEEKS : LEAGUE_WEEKS
  const index = weeks.indexOf(week)
  return index < 0 || index >= rounds ? null : index + 1
}

export function professionalSeasonWeeks(state: ProCareerState): number {
  const rounds = Math.max(0, ...state.world.divisions[1].fixtures.map(fixture => fixture.week))
  return rounds > LEAGUE_WEEKS.length ? 52 : 44
}

export function proFixture(state: ProCareerState): Fixture | undefined {
  const round = proRound(state.week, state.world.divisions[1].teams.length,
    Math.max(0, ...state.world.divisions[1].fixtures.map(fixture => fixture.week)))
  return round === null || state.freeAgentSinceWeek !== undefined ? undefined : state.world.divisions[1].fixtures.find(fixture => fixture.week === round && !fixture.played && (fixture.homeTeamId === state.world.playerTeamId || fixture.awayTeamId === state.world.playerTeamId))
}

export function resolveProMatch(state: ProCareerState, player: Player, result: {
  opponent: Team; home: boolean; scored: number; conceded: number; goals: number; assists: number; rating: number; energy: number; minutes: number; yellowCards: number; redCarded: boolean; injury?: { severity: string; weeksOut: number; description: string } | null
}): { state: ProCareerState; record: MatchRecord } {
  const line: MatchLine = { playerId: player.id, name: player.name, position: player.position, teamId: state.world.playerTeamId,
    minutes: result.minutes, started: player.squadRole === 'starting-xi', rating: result.rating, goals: result.goals, assists: result.assists,
    saves: 0, tackles: 0, interceptions: 0, keyPasses: 0, yellowCards: result.yellowCards, redCards: result.redCarded ? 1 : 0 }
  const scheduled = proFixture(state)
  if (!scheduled) throw new Error('No scheduled professional fixture for this week')
  const world = recordPlayerMatchResult(state.world, result.opponent.id, result.scored,
    result.conceded, result.home, result.goals, line, state.season, state.week, scheduled.id)
  const record = world.divisions[1].matchRecords!.at(-1)!
  const humanClub = state.clubWorldIds?.[state.world.playerTeamId]
  const opponentClub = state.clubWorldIds?.[result.opponent.id]

  const backgroundWorld = state.backgroundWorld && humanClub && opponentClub
    ? recordHumanProLeagueMatch(state.backgroundWorld, state.associationId ?? 'eng',
      result.home ? humanClub : opponentClub, result.home ? opponentClub : humanClub,
      result.home ? result.scored : result.conceded, result.home ? result.conceded : result.scored,
      scheduled.id, state.activeCompetitionId)
    : state.backgroundWorld
  return { state: { ...state, world, backgroundWorld, resolvedWeek: state.week },
    record: { ...record, competitionId: 'proLeague', season: state.season, week: state.week } }
}

export function advanceProWeek(state: ProCareerState, player: Player): { state: ProCareerState; player: Player } {
  if (state.retired) return { state, player }
  const scheduledRounds = Math.max(0, ...state.world.divisions[1].fixtures.map(f => f.week))
  const round = proRound(state.week, state.world.divisions[1].teams.length, scheduledRounds)
  let world = state.world
  if (round !== null) {
    world = { ...world, divisions: { ...world.divisions, 1: batchSimDivisionRound(world.divisions[1], round, state.freeAgentSinceWeek === undefined ? world.playerTeamId : '', true, 'proLeague', state.season, state.week) } }
  }
  const nextWeek = state.week + 1
  const seasonEnd = nextWeek > professionalSeasonWeeks(state)
  let seasonRecords = state.seasonRecords ?? []
  let clubObjective = state.clubObjective
  if (seasonEnd) {
    const division = world.divisions[1]
    const ranking = [...division.standings].sort((a, b) => b.points - a.points ||
      (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) ||
      b.goalsFor - a.goalsFor || a.teamId.localeCompare(b.teamId))
    const position = ranking.findIndex(row => row.teamId === world.playerTeamId) + 1
    const clubName = division.teams.find(team => team.id === world.playerTeamId)?.name ?? 'Unknown club'
    const objectiveMet = state.freeAgentSinceWeek === undefined && !!clubObjective && position > 0 && position <= clubObjective.targetPosition
    if (clubObjective) clubObjective = { ...clubObjective, boardConfidence: Math.max(0,
      Math.min(100, clubObjective.boardConfidence + (objectiveMet ? 15 : -18))),
      lastReviewedSeason: clubObjective.seasonId }
    seasonRecords = [...seasonRecords, {
      season: state.season, associationId: state.associationId ?? 'eng',
      clubName: state.freeAgentSinceWeek === undefined ? clubName : 'Free agent',
      leaguePosition: state.freeAgentSinceWeek === undefined ? position : 0, clubs: division.teams.length,
      appearances: player.seasonAppearances ?? 0, goals: player.seasonGoals ?? 0,
      assists: player.seasonAssists ?? 0,
      leagueChampion: state.freeAgentSinceWeek === undefined && position === 1,
      objectiveMet, boardConfidence: clubObjective?.boardConfidence,
    }].slice(-30)
    world = resetSchoolLeagueSeason(world)
  }
  world.kind = 'pro'
  const hasContract = state.freeAgentSinceWeek === undefined && !!player.contract &&
    player.contract.expiresWeek > (player.totalWeeksElapsed ?? 0)
  const wage = hasContract ? player.contract!.terms.weeklyWage : 0
  const pay = state.backgroundWorld ? 0 : netWage(wage, player.agentId)
  const injury = player.injury && player.injury.weeksRemaining > 1 ? { ...player.injury, weeksRemaining: player.injury.weeksRemaining - 1 } : null
  // Senior development is based on minutes, actual season contribution and age,
  // not unlimited per-week overall growth. Older stars can retain reputation
  // while declining in match influence.
  const starts = player.seasonAppearances ?? 0
  const contribution = (player.seasonGoals ?? 0) + (player.seasonAssists ?? 0)
  const youthPrime = player.careerClock.ageYears <= 27 ? 1 : player.careerClock.ageYears <= 32 ? .65 : .35
  const impact = Math.round((Math.min(38, starts) * .11 + Math.min(22, contribution) * .19 -
    (starts < 8 ? 3 : 0)) * youthPrime)
  const reputation = seasonEnd ? Math.max(0, Math.min(100, (player.reputation ?? 20) + (state.freeAgentSinceWeek === undefined ? impact : -2))) : player.reputation
  const coachTrust = seasonEnd ? Math.max(0, Math.min(100, (player.coachTrust ?? 50) +
    (starts >= 24 ? 5 : starts >= 10 ? 1 : -6))) : player.coachTrust
  return {
    state: scheduleSeniorInternational({ ...forfeitSeniorInternational(state), world, seasonRecords, clubObjective, season: seasonEnd ? state.season + 1 : state.season, week: seasonEnd ? 1 : nextWeek, resolvedWeek: undefined, trainedWeek: undefined, day: 0, trainedDays: [], preseasonPlayedWeeks: seasonEnd ? [] : state.preseasonPlayedWeeks,
      retired: seasonEnd && player.careerClock.ageYears + 1 >= 38 ? true : state.retired }, player),
    player: { ...player, injury, reputation, coachTrust, suspensionMatches: Math.max(0, (player.suspensionMatches ?? 0) - (round !== null ? 1 : 0)), totalWeeksElapsed: (player.totalWeeksElapsed ?? 0) + 1, money: (player.money ?? 0) + pay,
      careerEarnings: (player.careerEarnings ?? 0) + (state.backgroundWorld ? 0 : wage), fitness: { stamina: Math.min(100, player.fitness.stamina + 18) },
      seasonAppearances: seasonEnd ? 0 : player.seasonAppearances, seasonGoals: seasonEnd ? 0 : player.seasonGoals, seasonAssists: seasonEnd ? 0 : player.seasonAssists,
      careerClock: seasonEnd ? { ...player.careerClock, ageYears: player.careerClock.ageYears + 1 } : player.careerClock },
  }
}
