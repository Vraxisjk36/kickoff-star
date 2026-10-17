import { NATIONS } from './nations'
import { regionsFor } from './regions'
import { schoolsForRegion } from './schools'
import { initSchoolLeagueWorld, batchSimDivisionRound, resetTeamScorers, sortStandings, type Division } from './league'
import { generateRoundRobin } from './competitions'
import { countryLeagueVisibility } from './competitionCareer'
import { capturePlayedFixtures, type MatchRecord } from './matchLedger'
import { schoolRival } from './friendlies'
import type { SchoolsRankingRow } from './worldSchools'

export interface WorldStory { id: string; season: number; kind: 'donation' | 'eligibility' | 'sponsor'; countryId: string; teamId: string; teamName: string; pointsAtStart: number; sponsor?: string; issuedWeeks?: number[] }
export interface WorldLeagues { season: number; divisions: Record<string, Division>; champions: { season: number; countryId: string; school: string }[];
  stories?: WorldStory[]; leagueNames?: Record<string, string>; schoolRankings?: SchoolPowerRanking[]; rivalryRecords?: MatchRecord[] }

export interface SchoolPowerRow { teamId: string; name: string; countryId: string; played: number; points: number; goalDifference: number; score: number; previousRank?: number }
export interface SchoolPowerRanking { season: number; week: number; rows: SchoolPowerRow[] }

/** World list uses completed league results, weighted by the competition's visibility. */
export function publishSchoolPowerRanking(world: WorldLeagues, week: number, home?: Division | null): WorldLeagues {
  if (week < 8 || week > 24 || week % 4 !== 0 || world.schoolRankings?.some(entry => entry.season === world.season && entry.week === week)) return world
  const previous = world.schoolRankings?.filter(entry => entry.season === world.season).at(-1)
  const rows = [...Object.entries(world.divisions).map(([countryId, division]) => ({ countryId, division })), ...(home ? [{ countryId: home.teams[0]?.countryId ?? 'eng', division: home }] : [])]
    .flatMap(({ countryId, division }) => division.standings.map(row => ({
      teamId: row.teamId, name: row.teamName, countryId, played: row.played, points: row.points,
      goalDifference: row.goalsFor - row.goalsAgainst,
      score: Math.round((row.points * 3 + (row.goalsFor - row.goalsAgainst) * .7 + row.won) * countryLeagueVisibility(countryId) * 10) / 10,
      previousRank: (() => { const rank = previous?.rows.findIndex(entry => entry.teamId === row.teamId) ?? -1; return rank < 0 ? undefined : rank + 1 })(),
    }))).filter(row => row.played > 0).sort((a, b) => b.score - a.score || b.points - a.points || a.teamId.localeCompare(b.teamId))
  return { ...world, schoolRankings: [...(world.schoolRankings ?? []), { season: world.season, week, rows }] }
}

function newDivision(countryId: string): Division {
  const region = regionsFor(countryId)[0]
  const school = schoolsForRegion(region?.id)[0]
  return resetDivision(initSchoolLeagueWorld(school?.name ?? `${countryId.toUpperCase()} Central High`, region?.id).divisions[1])
}
function resetDivision(division: Division): Division {
  const teams = division.teams.map(resetTeamScorers)
  return { ...division, teams, standings: teams.map(team => ({ teamId: team.id, teamName: team.name, teamShort: team.short,
    played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 })),
    fixtures: generateRoundRobin(teams.map(team => team.id), 2).map(fixture => ({ ...fixture, week: fixture.round })), matchRecords: [] }
}
/** All countries advance on the same calendar weeks as the player's school. */
export function advanceWorldLeagues(state: WorldLeagues | undefined, season: number, completedWeek: number, homeCountryId?: string, homeActive = false): WorldLeagues {
  const previous = state?.season === season ? state : undefined
  const champions = state?.champions ?? []
  const divisions: Record<string, Division> = { ...(previous?.divisions ?? {}) }
  for (const nation of NATIONS) {
    if (nation.id === homeCountryId && homeActive) { delete divisions[nation.id]; continue } // player's live league is authoritative
    let division = divisions[nation.id]
    if (!division) division = state?.divisions[nation.id] && state.season !== season ? resetDivision(state.divisions[nation.id]) : newDivision(nation.id)
    const throughRound = Math.max(0, Math.min(18, completedWeek - 5))
    for (let round = 1; round <= throughRound; round++)
      if (division.fixtures.some(fixture => fixture.week === round && !fixture.played))
        division = batchSimDivisionRound(division, round, '', true, 'schoolLeague', season, round + 5)
    divisions[nation.id] = division
  }
  let rivalryRecords = state?.rivalryRecords ?? []
  if (completedWeek >= 29) for (const division of Object.values(divisions))
    rivalryRecords = simulateSchoolRivalries(rivalryRecords, division, season)
  return { season, divisions, champions, stories: state?.stories ?? [], leagueNames: state?.leagueNames ?? {}, schoolRankings: state?.schoolRankings ?? [], rivalryRecords }
}

/** Separate exhibition ledger: these scores never change the league table. */
export function simulateSchoolRivalries(existing: MatchRecord[], division: Division, season: number, excludedTeamId?: string): MatchRecord[] {
  let rivalryRecords = existing
  for (const team of division.teams) {
    const rival = schoolRival(division, team.id)
    if (!rival || team.id.localeCompare(rival.id) > 0 || team.id === excludedTeamId || rival.id === excludedTeamId) continue
    const id = `school-rivalry-${season}-${team.id}-${rival.id}`
    if (rivalryRecords.some(record => record.id === id)) continue
    const score = (side: typeof team) => {
      const seed = [...`${season}:${side.id}:${rival!.id}`].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7)
      const opponent = side.id === team.id ? rival! : team
      return Math.min(5, Math.max(0, Math.floor((side.ratings.attack + side.ratings.midfield - opponent.ratings.defense) / 48) + seed % 3))
    }
    rivalryRecords = capturePlayedFixtures(rivalryRecords, [{ id, round: 1, homeTeamId: team.id, awayTeamId: rival.id,
      played: true, homeGoals: score(team), awayGoals: score(rival) }], division.teams, 'schoolFriendlies', season, 29)
  }
  return rivalryRecords
}

export function worldLeagueRecords(world: WorldLeagues, home?: Division | null): MatchRecord[] {
  return [...Object.values(world.divisions).flatMap(division => division.matchRecords ?? []), ...(home?.matchRecords ?? [])]
}

export function worldLeagueLeaders(world: WorldLeagues, week: number, home?: Division | null, playerId?: string, previous?: { rows: SchoolsRankingRow[] }): SchoolsRankingRow[] {
  const records = worldLeagueRecords(world, home).filter(record => record.season === world.season && record.week <= week)
  const teams = new Map([...Object.values(world.divisions).flatMap(division => division.teams), ...(home?.teams ?? [])].map(team => [team.id, team]))
  const leaders = new Map<string, SchoolsRankingRow & { ratingTotal: number }>()
  for (const record of records) for (const line of record.lines) {
    if (line.playerId === playerId) continue // actual user match line added below
    const team = teams.get(line.teamId)
    const countryId = team?.countryId ?? 'eng'
    const row = leaders.get(line.playerId) ?? { id: line.playerId, name: line.name, countryId, school: team?.name ?? 'School XI',
      position: (['GK','CB','CM','ST'].includes(line.position) ? line.position : 'CM') as SchoolsRankingRow['position'], age: [...line.playerId].reduce((value, ch) => value + ch.charCodeAt(0), 0) % 5 === 0 ? 16 : 17,
      appearances: 0, goals: 0, assists: 0, saves: 0, cleanSheets: 0, averageRating: 0, points: 0, monthGoals: 0, monthAssists: 0, ratingTotal: 0 }
    row.appearances++; row.goals += line.goals; row.assists += line.assists; row.saves += line.saves; row.ratingTotal += line.rating
    const cleanSheet = (line.teamId === record.homeTeamId ? record.awayGoals : record.homeGoals) === 0
    if (cleanSheet && ['GK','CB'].includes(line.position)) row.cleanSheets++
    if (record.week > week - 4) { row.monthGoals += line.goals; row.monthAssists += line.assists }
    row.points += Math.max(0, (line.rating - 5.8) * 2.5 + line.goals * 3.5 + line.assists * 2.5 + (line.position === 'GK' ? line.saves * .45 : 0) + (cleanSheet && ['GK','CB'].includes(line.position) ? 1.5 : 0))
    leaders.set(line.playerId, row)
  }
  return [...leaders.values()].map(row => ({ ...row, averageRating: Math.round(row.ratingTotal / row.appearances * 10) / 10,
    points: Math.round(row.points * countryLeagueVisibility(row.countryId) * 10) / 10,
    previousRank: (() => { const index = previous?.rows.findIndex(entry => entry.id === row.id) ?? -1; return index < 0 ? undefined : index + 1 })(),
  })).sort((a, b) => b.points - a.points || b.averageRating - a.averageRating || a.id.localeCompare(b.id))
}

export function worldLeagueChampions(world: WorldLeagues): WorldLeagues {
  const champions = [...world.champions]
  for (const [countryId, division] of Object.entries(world.divisions)) {
    if (champions.some(entry => entry.season === world.season && entry.countryId === countryId)) continue
    const winner = sortStandings(division.standings)[0]
    if (winner?.played >= 18) champions.push({ season: world.season, countryId, school: winner.teamName })
  }
  return { ...world, champions }
}
