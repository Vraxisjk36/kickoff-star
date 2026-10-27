import type { Player } from '../types/player'
import type { MatchRecord } from './matchLedger'
import { countryLeagueVisibility } from './competitionCareer'

export interface SchoolStar { id: string; name: string; countryId: string; school: string; position: 'ST' | 'CM' | 'GK' | 'CB'; age: number }
export interface SchoolMatch { starId: string; week: number; opponent: string; goals: number; assists: number; saves: number; cleanSheet: boolean; rating: number }
export interface SchoolsRankingRow extends SchoolStar { appearances: number; goals: number; assists: number; saves: number; cleanSheets: number; averageRating: number; points: number; monthGoals: number; monthAssists: number; previousRank?: number }
export interface SchoolsRanking { season: number; week: number; rows: SchoolsRankingRow[]; scope?: 'world-schools' | 'academy' }
export interface SchoolsAward { name: string; winnerId: string; winnerName: string; countryId: string; value: string }
export interface SchoolsAwards { season: number; winners: SchoolsAward[]; teamOfYear: SchoolsRankingRow[]; local: SchoolsAward[]; regional: SchoolsAward[]; scope?: 'world-schools' | 'academy' }
export interface WorldSchoolsState { season: number; matches: SchoolMatch[]; rankings: SchoolsRanking[]; awards: SchoolsAwards[] }

// Persistent fictional footballers representing other school systems. Every
// number in the paper is accumulated from their saved simulated match rows.
export const SCHOOL_STARS: SchoolStar[] = [
  { id: 'eng-baxter', name: 'Jordan Baxter', countryId: 'eng', school: 'Manchester North High', position: 'ST', age: 17 },
  { id: 'esp-ruiz', name: 'Mateo Ruiz', countryId: 'esp', school: 'Madrid Central High', position: 'CM', age: 17 },
  { id: 'rsa-mokoena', name: 'Thabo Mokoena', countryId: 'rsa', school: 'Soweto West High', position: 'ST', age: 16 },
  { id: 'bra-silva', name: 'Rafael Silva', countryId: 'bra', school: 'Santos Technical High', position: 'ST', age: 17 },
  { id: 'fra-diallo', name: 'Amadou Diallo', countryId: 'fra', school: 'Saint-Denis Central High', position: 'GK', age: 17 },
  { id: 'ger-weber', name: 'Lukas Weber', countryId: 'ger', school: 'Munich North High', position: 'CB', age: 17 },
  { id: 'arg-fernandez', name: 'Nico Fernández', countryId: 'arg', school: 'Buenos Aires College', position: 'ST', age: 16 },
  { id: 'nga-okafor', name: 'Chidi Okafor', countryId: 'nga', school: 'Lagos Central High', position: 'CM', age: 17 },
  { id: 'jpn-tanaka', name: 'Haruto Tanaka', countryId: 'jpn', school: 'Tokyo East High', position: 'GK', age: 16 },
  { id: 'por-costa', name: 'Tiago Costa', countryId: 'por', school: 'Lisbon Sports School', position: 'ST', age: 17 },
  { id: 'mex-reyes', name: 'Diego Reyes', countryId: 'mex', school: 'Guadalajara West High', position: 'CM', age: 17 },
  { id: 'gha-mensah', name: 'Kofi Mensah', countryId: 'gha', school: 'Accra North High', position: 'GK', age: 17 },
  { id: 'usa-carter', name: 'Eli Carter', countryId: 'usa', school: 'New York Technical High', position: 'CB', age: 16 },
  { id: 'sen-ndiaye', name: 'Ibrahima Ndiaye', countryId: 'sen', school: 'Dakar Community School', position: 'ST', age: 17 },
  { id: 'ned-dejong', name: 'Milan de Jong', countryId: 'ned', school: 'Amsterdam College', position: 'CM', age: 17 },
  { id: 'ita-rossi', name: 'Alessio Rossi', countryId: 'ita', school: 'Milan Technical High', position: 'CB', age: 17 },
  { id: 'bel-dupont', name: 'Noah Dupont', countryId: 'bel', school: 'Brussels Central High', position: 'CB', age: 16 },
]
const NEXT_CLASS = ['Callum Price','Iker Navarro','Sipho Dlamini','João Ribeiro','Yanis Traoré','Felix Bauer','Tomás Herrera',
  'Emeka Obi','Kaito Mori','Miguel Sousa','Andrés Vega','Kwame Boateng','Mason Brooks','Ousmane Fall','Jasper Visser','Marco Bianchi','Louis Lambert']
export function schoolStarsForSeason(season: number): SchoolStar[] {
  return SCHOOL_STARS.map((star, index) => {
    const years = star.age - 16 + Math.max(0, season - 1)
    const cohort = Math.floor(years / 3)
    return { ...star, id: cohort ? `${star.id}:class-${cohort}` : star.id, name: cohort ? NEXT_CLASS[index] : star.name, age: 16 + years % 3 }
  })
}

function hash(input: string): number { let n = 2166136261; for (const char of input) n = Math.imul(n ^ char.charCodeAt(0), 16777619); return n >>> 0 }
function matchFor(star: SchoolStar, season: number, week: number): SchoolMatch {
  const roll = hash(`${star.id}:${season}:${week}`)
  const form = hash(`${star.id}:${season}:form`) % 5
  const attacking = star.position === 'ST' || star.position === 'CM'
  const goals = attacking ? Number(roll % (star.position === 'ST' ? 5 : 9) === 0) + Number(star.position === 'ST' && roll % 23 === 0) : 0
  const assists = attacking ? Number((roll >>> 4) % (star.position === 'CM' ? 5 : 10) === 0) : 0
  const saves = star.position === 'GK' ? 2 + (roll >>> 7) % 6 : 0
  const cleanSheet = !attacking && (roll >>> 12) % 4 === 0
  const rating = Math.min(9, Math.round((6.1 + form * .12 + (roll >>> 17) % 16 * .07 + goals * .5 + assists * .3 + (cleanSheet ? .3 : 0)) * 10) / 10)
  return { starId: star.id, week, opponent: `${star.school.split(' ')[0]} District School`, goals, assists, saves, cleanSheet, rating }
}
export function advanceWorldSchools(state: WorldSchoolsState | undefined, season: number, completedWeek: number, externalLeagues = false): WorldSchoolsState {
  const same = state?.season === season
  const matches = same ? [...state.matches] : []
  const rankings = same ? [...state.rankings] : []
  const awards = state?.awards ?? []
  const known = new Set(matches.map(match => `${match.starId}:${match.week}`))
  for (let week = 6; !externalLeagues && week <= Math.min(35, completedWeek); week++) {
    // School calendar: local league through W23, then selected cup fixtures.
    if (week > 23 && week % 2 === 0) continue
    for (const star of schoolStarsForSeason(season)) if (!known.has(`${star.id}:${week}`)) matches.push(matchFor(star, season, week))
  }
  return { season, matches, rankings, awards }
}
function playerRows(player: Player, season: number, throughWeek: number, leagueOnly = false): SchoolMatch[] {
  const records: MatchRecord[] = player.matchLedger ?? []
  return records.filter(record => record.season === season && record.week <= throughWeek && record.week >= 1 &&
    (leagueOnly ? record.competitionId === 'schoolLeague' : ['schoolLeague', 'schoolCup', 'schoolDevelopment', 'schoolDevelopmentLeague', 'schoolFriendlies', 'nationalChampionship'].includes(record.competitionId)))
    .flatMap(record => record.lines.filter(line => line.playerId === player.id).map(line => ({ starId: player.id, week: record.week,
      opponent: record.homeTeamId === line.teamId ? record.awayTeamName : record.homeTeamName, goals: line.goals, assists: line.assists,
      saves: line.saves, cleanSheet: record.homeTeamId === line.teamId ? record.awayGoals === 0 : record.homeGoals === 0, rating: line.rating })))
}
export function schoolsLeaders(state: WorldSchoolsState, player: Player, week: number, previous?: SchoolsRanking, leagueOnly = false): SchoolsRankingRow[] {
  const home = player.regionId?.split('-')[0] ?? player.nationality ?? 'eng'
  const stars = schoolStarsForSeason(state.season)
  if (player.careerClock.phase !== 'academy') stars.push({ id: player.id, name: player.name, countryId: home, school: player.schoolId ?? 'Your school',
    position: (['ST', 'CM', 'GK', 'CB'].includes(player.position) ? player.position : 'CM') as SchoolStar['position'], age: player.careerClock.ageYears })
  return stars.map(star => {
    const rows = star.id === player.id ? playerRows(player, state.season, week, leagueOnly) : state.matches.filter(match => match.starId === star.id && match.week <= week)
    const goals = rows.reduce((sum, row) => sum + row.goals, 0), assists = rows.reduce((sum, row) => sum + row.assists, 0)
    const saves = rows.reduce((sum, row) => sum + row.saves, 0), cleanSheets = rows.filter(row => row.cleanSheet).length
    const averageRating = rows.length ? rows.reduce((sum, row) => sum + row.rating, 0) / rows.length : 0
    const points = Math.round(rows.reduce((sum, row) => sum + Math.max(0, (row.rating - 5.8) * 2.5 + row.goals * 3.5 + row.assists * 2.5 + (star.position === 'GK' ? row.saves * .45 : 0) + (row.cleanSheet && ['GK','CB'].includes(star.position) ? 1.5 : 0)), 0) * countryLeagueVisibility(star.countryId) * 10) / 10
    return { ...star, appearances: rows.length, goals, assists, saves, cleanSheets, averageRating: Math.round(averageRating * 10) / 10,
      points, monthGoals: rows.filter(row => row.week > week - 4).reduce((sum, row) => sum + row.goals, 0),
      monthAssists: rows.filter(row => row.week > week - 4).reduce((sum, row) => sum + row.assists, 0),
      previousRank: previous?.rows.findIndex(entry => entry.id === star.id) === undefined ? undefined : (() => { const index = previous.rows.findIndex(entry => entry.id === star.id); return index < 0 ? undefined : index + 1 })(),
    }
  }).sort((a, b) => b.points - a.points || b.averageRating - a.averageRating || a.id.localeCompare(b.id))
}
export function publishSchoolsRanking(state: WorldSchoolsState, player: Player, completedWeek: number, externalRows?: SchoolsRankingRow[]): WorldSchoolsState {
  if (completedWeek < 8 || completedWeek > 32 || completedWeek % 4 !== 0 || state.rankings.some(entry => entry.week === completedWeek)) return state
  const previous = state.rankings.at(-1)
  return { ...state, rankings: [...state.rankings, { season: state.season, week: completedWeek, rows: (externalRows ?? schoolsLeaders(state, player, completedWeek, previous)).slice(0, 5) }] }
}
function recordAwards(records: MatchRecord[], season: number, prefix: string): SchoolsAward[] {
  const values = new Map<string, { id: string; name: string; position: string; goals: number; assists: number; saves: number; cleanSheets: number; ratings: number[] }>()
  for (const record of records.filter(entry => entry.season === season)) for (const line of record.lines) {
    const row = values.get(line.playerId) ?? { id: line.playerId, name: line.name, position: line.position, goals: 0, assists: 0, saves: 0, cleanSheets: 0, ratings: [] }
    row.goals += line.goals; row.assists += line.assists; row.saves += line.saves; row.ratings.push(line.rating)
    if (line.position === 'GK' && (line.teamId === record.homeTeamId ? record.awayGoals : record.homeGoals) === 0) row.cleanSheets++
    values.set(line.playerId, row)
  }
  const eligible = [...values.values()].filter(row => row.ratings.length >= 3)
  const leader = (stat: 'goals' | 'assists' | 'saves') => [...eligible].sort((a, b) => b[stat] - a[stat] || a.id.localeCompare(b.id))[0]
  const scorer = leader('goals'), assister = leader('assists')
  const keeper = [...eligible].filter(row => row.position === 'GK').sort((a, b) => b.cleanSheets - a.cleanSheets || b.saves - a.saves)[0]
  const playerOf = [...eligible].sort((a, b) => b.ratings.reduce((sum, rating) => sum + rating, 0) / b.ratings.length - a.ratings.reduce((sum, rating) => sum + rating, 0) / a.ratings.length)[0]
  const award = (name: string, row: typeof scorer, value: string): SchoolsAward => ({ name: `${prefix} ${name}`, winnerId: row?.id ?? '', winnerName: row?.name ?? 'No eligible player', countryId: '', value })
  return [award('Top Scorer', scorer, `${scorer?.goals ?? 0} goals`), award('Top Assister', assister, `${assister?.assists ?? 0} assists`),
    award('Goalkeeper', keeper, `${keeper?.cleanSheets ?? 0} clean sheets`), ...(prefix === 'Regional' ? [award('Player', playerOf, `${playerOf?.ratings.length ?? 0} matches`)] : [])]
}
export function schoolsAwards(state: WorldSchoolsState, player: Player, localRecords: MatchRecord[] = [], regionalRecords: MatchRecord[] = [], externalRows?: SchoolsRankingRow[]): SchoolsAwards {
  const leaders = (externalRows ?? schoolsLeaders(state, player, 44)).filter(row => row.appearances >= 8)
  const best = (rows: SchoolsRankingRow[], sort: (row: SchoolsRankingRow) => number) => [...rows].sort((a, b) => sort(b) - sort(a) || a.id.localeCompare(b.id))[0]
  const award = (name: string, row: SchoolsRankingRow | undefined, value: string): SchoolsAward => ({ name, winnerId: row?.id ?? '', winnerName: row?.name ?? 'No eligible player', countryId: row?.countryId ?? '', value })
  const gk = best(leaders.filter(row => row.position === 'GK'), row => row.points)
  const scorer = best(leaders, row => row.goals)
  const creator = best(leaders, row => row.assists)
  const young = best(leaders.filter(row => row.age <= 16), row => row.points)
  const teamOfYear = (['GK', 'CB', 'CB', 'CB', 'CB', 'CM', 'CM', 'CM', 'ST', 'ST', 'ST'] as const).reduce<SchoolsRankingRow[]>((team, position) => {
    const candidate = leaders.find(row => row.position === position && !team.some(picked => picked.id === row.id))
    if (candidate) team.push(candidate)
    return team
  }, [])
  const world = [award('World Schools Player', leaders[0], `${leaders[0]?.points ?? 0} points`), award('World Schools Goalkeeper', gk, `${gk?.saves ?? 0} saves`),
    award('Young Player', young, `${young?.points ?? 0} points`), award('Golden Boot', scorer, `${scorer?.goals ?? 0} goals`),
    award('Playmaker', creator, `${creator?.assists ?? 0} assists`)]
  const local = recordAwards(localRecords.filter(record => record.competitionId === 'schoolLeague'), state.season, 'Local')
    .filter(entry => entry.name !== 'Local Player')
  const regional = recordAwards(regionalRecords.filter(record => record.competitionId === 'schoolCup'), state.season, 'Regional')
  return { season: state.season, winners: world, teamOfYear, local, regional, scope: 'world-schools' }
}

/** Academy race uses only the current academy league's recorded match lines. */
export function academyLeaders(records: MatchRecord[], season: number, week: number, countryId: string, previous?: SchoolsRanking): SchoolsRankingRow[] {
  const rows = new Map<string, SchoolsRankingRow & { ratingTotal: number }>()
  for (const record of records.filter(entry => entry.season === season && entry.week <= week && entry.competitionId === 'academyLeague')) for (const line of record.lines) {
    const prior = rows.get(line.playerId) ?? { id: line.playerId, name: line.name, school: line.teamId, countryId,
      age: 18, position: (['GK', 'CB', 'CM', 'ST'].includes(line.position) ? line.position : 'CM') as SchoolStar['position'],
      appearances: 0, goals: 0, assists: 0, saves: 0, cleanSheets: 0, averageRating: 0, ratingTotal: 0, points: 0, monthGoals: 0, monthAssists: 0 }
    const cleanSheet = (line.teamId === record.homeTeamId ? record.awayGoals : record.homeGoals) === 0
    prior.appearances++; prior.goals += line.goals; prior.assists += line.assists; prior.saves += line.saves; prior.ratingTotal += line.rating
    if (cleanSheet && (prior.position === 'GK' || prior.position === 'CB')) prior.cleanSheets++
    if (record.week > week - 4) { prior.monthGoals += line.goals; prior.monthAssists += line.assists }
    prior.points += Math.max(0, (line.rating - 5.8) * 2.5 + line.goals * 3.5 + line.assists * 2.5 + (prior.position === 'GK' ? line.saves * .45 : 0) + (cleanSheet && ['GK','CB'].includes(prior.position) ? 1.5 : 0))
    rows.set(line.playerId, prior)
  }
  return [...rows.values()].filter(row => row.appearances >= 2).map(row => ({ ...row,
    averageRating: Math.round(row.ratingTotal / row.appearances * 10) / 10,
    points: Math.round(row.points * countryLeagueVisibility(countryId) * 10) / 10,
    previousRank: (() => { const index = previous?.rows.findIndex(entry => entry.id === row.id) ?? -1; return index < 0 ? undefined : index + 1 })(),
  })).sort((a, b) => b.points - a.points || a.id.localeCompare(b.id))
}
export function academySeasonAwards(records: MatchRecord[], cupRecords: MatchRecord[], season: number, countryId: string): SchoolsAwards {
  const leaders = academyLeaders(records, season, 44, countryId)
  const award = (name: string, row: SchoolsRankingRow | undefined, value: string): SchoolsAward => ({ name, winnerId: row?.id ?? '', winnerName: row?.name ?? 'No eligible player', countryId, value })
  const by = (stat: 'goals' | 'assists') => [...leaders].sort((a, b) => b[stat] - a[stat])[0]
  const keeper = leaders.find(row => row.position === 'GK')
  const teamOfYear = (['GK', 'CB', 'CB', 'CM', 'CM', 'ST', 'ST'] as const).reduce<SchoolsRankingRow[]>((team, position) => {
    const candidate = leaders.find(row => row.position === position && !team.some(picked => picked.id === row.id))
    if (candidate) team.push(candidate)
    return team
  }, [])
  return { season, scope: 'academy', winners: [award('Academy Player', leaders[0], `${leaders[0]?.points ?? 0} points`),
    award('Academy Goalkeeper', keeper, `${keeper?.cleanSheets ?? 0} clean sheets`),
    award('Academy Top Scorer', by('goals'), `${by('goals')?.goals ?? 0} goals`),
    award('Academy Top Assister', by('assists'), `${by('assists')?.assists ?? 0} assists`)], teamOfYear,
    local: recordAwards(records, season, 'Academy League'), regional: recordAwards(cupRecords, season, 'Academy Cup') }
}
