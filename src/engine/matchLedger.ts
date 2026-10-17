/** Saved match lines are the source for new season reports and newspaper claims.
 * Older saves retain their existing aggregate counters until they build a ledger. */
import type { Team } from './teams'
import type { GenericFixture } from './competitions'
export interface MatchLine {
  playerId: string
  name: string
  position: string
  teamId: string
  minutes: number
  started: boolean
  rating: number
  goals: number
  assists: number
  saves: number
  tackles: number
  interceptions: number
  keyPasses: number
  yellowCards: number
  redCards: number
}

export interface MatchRecord {
  id: string
  competitionId: string
  season: number
  week: number
  homeTeamId: string
  awayTeamId: string
  homeTeamName: string
  awayTeamName: string
  homeGoals: number
  awayGoals: number
  lines: MatchLine[]
}

export function playerTotals(records: MatchRecord[], playerId: string, competitionId?: string, season?: number) {
  const lines = records.filter(record => (!competitionId || record.competitionId === competitionId) && (!season || record.season === season))
    .flatMap(record => record.lines.filter(line => line.playerId === playerId))
  return { appearances: lines.length, goals: lines.reduce((sum, line) => sum + line.goals, 0),
    assists: lines.reduce((sum, line) => sum + line.assists, 0), saves: lines.reduce((sum, line) => sum + line.saves, 0),
    average: lines.length ? lines.reduce((sum, line) => sum + line.rating, 0) / lines.length : 0 }
}

export function matchRecordForWeek(records: MatchRecord[], season: number, week: number, competitionId: string) {
  return records.find(record => record.season === season && record.week === week && record.competitionId === competitionId)
}

export function leagueAwardLeaders(records: MatchRecord[], playerId: string) {
  const totals = new Map<string, { goals: number; assists: number }>()
  for (const record of records) for (const line of record.lines) {
    const prior = totals.get(line.playerId) ?? { goals: 0, assists: 0 }
    totals.set(line.playerId, { goals: prior.goals + line.goals, assists: prior.assists + line.assists })
  }
  const player = totals.get(playerId) ?? { goals: 0, assists: 0 }
  const rivals = [...totals.entries()].filter(([id]) => id !== playerId).map(([, value]) => value)
  return { playerGoals: player.goals, playerAssists: player.assists,
    rivalGoals: Math.max(0, ...rivals.map(row => row.goals)), rivalAssists: Math.max(0, ...rivals.map(row => row.assists)) }
}

/** Capture simulated cup/country fixtures once. The notable players are a
 * four-person slice of each squad; together with the user's line, their goal
 * credits reconcile exactly to the saved team result. */
export function capturePlayedFixtures(existing: MatchRecord[], fixtures: GenericFixture[], teams: Team[],
  competitionId: string, season: number, week: number, playerMatch?: MatchRecord): MatchRecord[] {
  const known = new Set(existing.map(record => record.id))
  const records = [...existing]
  for (const fixture of fixtures) {
    if (!fixture.played || fixture.homeGoals === null || fixture.awayGoals === null || known.has(fixture.id)) continue
    const home = teams.find(team => team.id === fixture.homeTeamId), away = teams.find(team => team.id === fixture.awayTeamId)
    if (!home || !away) continue
    const playerLine = playerMatch?.homeTeamId === home.id && playerMatch.awayTeamId === away.id ? playerMatch.lines[0] : undefined
    const lines: MatchLine[] = []
    for (const [team, scored, conceded] of [[home, fixture.homeGoals, fixture.awayGoals], [away, fixture.awayGoals, fixture.homeGoals]] as const) {
      const remaining = Math.max(0, scored - (playerLine?.teamId === team.id ? playerLine.goals : 0))
      const named = team.notablePlayers.map((person, index): MatchLine => ({
        playerId: `${team.id}:${index}`, name: person.name, position: person.position, teamId: team.id,
        minutes: 90, started: true, rating: 6.2 + (scored - conceded) * .1, goals: 0, assists: 0,
        saves: person.position === 'GK' ? Math.max(1, conceded + 1) : 0,
        tackles: person.position === 'CB' ? 2 : 0, interceptions: person.position === 'CB' ? 1 : 0,
        keyPasses: person.position === 'CM' ? 1 : 0, yellowCards: 0, redCards: 0,
      }))
      const attackers = [named.find(line => line.position === 'ST'), named.find(line => line.position === 'ST'),
        named.find(line => line.position === 'CM'), named.find(line => line.position === 'CB')].filter((line): line is MatchLine => !!line)
      for (let goal = 0; goal < remaining; goal++) if (attackers.length) attackers[goal % attackers.length].goals++
      const creator = named.find(line => line.position === 'CM')
      if (creator) creator.assists = Math.max(0, Math.floor(scored * .6) - (playerLine?.teamId === team.id ? playerLine.assists : 0))
      for (const line of named) line.rating = Math.max(5, Math.min(9, line.rating + line.goals * .8 + line.assists * .3))
      lines.push(...named)
    }
    if (playerLine) lines.push(playerLine)
    records.push({ id: fixture.id, competitionId, season, week, homeTeamId: home.id, awayTeamId: away.id,
      homeTeamName: home.name, awayTeamName: away.name, homeGoals: fixture.homeGoals, awayGoals: fixture.awayGoals, lines })
    known.add(fixture.id)
  }
  return records
}
