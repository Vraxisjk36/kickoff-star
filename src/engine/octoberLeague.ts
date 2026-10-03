import type { Team } from './teams'
import type { LeagueStanding } from './league'

export interface OctoberFixture {
  week: number
  homeId: string
  awayId: string
  homeGoals: number | null
  awayGoals: number | null
}

export interface OctoberLeague {
  season: number
  playerTeamId: string
  teams: Team[]
  fixtures: OctoberFixture[]
}

export function initOctoberLeague(season: number, playerTeamId: string, teams: Team[]): OctoberLeague | null {
  const playerTeam = teams.find(team => team.id === playerTeamId)
  const rivals = teams.filter(team => team.id !== playerTeamId).slice(0, 4)
  if (!playerTeam || rivals.length < 4) return null
  const field = [playerTeam, ...rivals]
  const fixtures: OctoberFixture[] = rivals.map((team, round) => ({
    week: 36 + round, homeId: round % 2 === 0 ? playerTeamId : team.id,
    awayId: round % 2 === 0 ? team.id : playerTeamId, homeGoals: null, awayGoals: null,
  }))
  const npcWeeks = [36, 36, 37, 37, 38, 39]
  let index = 0
  for (let a = 0; a < rivals.length; a++) for (let b = a + 1; b < rivals.length; b++) {
    fixtures.push({ week: npcWeeks[index++], homeId: rivals[a].id, awayId: rivals[b].id, homeGoals: null, awayGoals: null })
  }
  return { season, playerTeamId, teams: field, fixtures }
}

export function playerOctoberFixture(state: OctoberLeague, week: number): OctoberFixture | null {
  return state.fixtures.find(f => f.week === week && (f.homeId === state.playerTeamId || f.awayId === state.playerTeamId)) ?? null
}

export function recordOctoberResult(state: OctoberLeague, week: number, opponentId: string, homeGoals: number, awayGoals: number): OctoberLeague {
  const fixture = playerOctoberFixture(state, week)
  if (!fixture || fixture.homeGoals !== null || (fixture.homeId === state.playerTeamId ? fixture.awayId : fixture.homeId) !== opponentId) return state
  return { ...state, fixtures: state.fixtures.map(f => f === fixture ? { ...f, homeGoals, awayGoals } : f) }
}

function npcScore(state: OctoberLeague, fixture: OctoberFixture): [number, number] {
  const seed = `${state.season}:${fixture.week}:${fixture.homeId}:${fixture.awayId}`
  let hash = 0
  for (const char of seed) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0
  return [Math.abs(hash) % 4, Math.abs(hash >>> 5) % 4]
}

/** Fill every unplayed fixture in the completed week, including a missed player match. */
export function simulateOctoberWeek(state: OctoberLeague, week: number): OctoberLeague {
  return { ...state, fixtures: state.fixtures.map(f => {
    if (f.week !== week || f.homeGoals !== null) return f
    const [homeGoals, awayGoals] = npcScore(state, f)
    return { ...f, homeGoals, awayGoals }
  }) }
}

export function octoberStandings(state: OctoberLeague): LeagueStanding[] {
  const rows = state.teams.map(team => ({ teamId: team.id, teamName: team.name, teamShort: team.short, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }))
  for (const f of state.fixtures) {
    if (f.homeGoals === null || f.awayGoals === null) continue
    for (const [id, scored, conceded] of [[f.homeId, f.homeGoals, f.awayGoals], [f.awayId, f.awayGoals, f.homeGoals]] as const) {
      const row = rows.find(r => r.teamId === id)!
      row.played++; row.goalsFor += scored; row.goalsAgainst += conceded
      if (scored > conceded) { row.won++; row.points += 3 }
      else if (scored === conceded) { row.drawn++; row.points++ }
      else row.lost++
    }
  }
  return rows.sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor)
}
