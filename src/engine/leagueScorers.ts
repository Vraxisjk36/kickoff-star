import type { Player } from '../types/player'
import type { Division } from './league'

export interface PlayerLeagueGoals { competitionId: string; division: number; goals: number }

export function recordLeagueGoals(player: Player, competitionId: string, division: number, goals: number): PlayerLeagueGoals[] {
  const entries = player.leagueGoals ?? []
  const previous = entries.find(e => e.competitionId === competitionId && e.division === division)
  // Older saves have exact league totals but no division split. Backfill once;
  // subsequent transfers keep those goals in the division where they were scored.
  const baseline = previous?.goals ?? (entries.some(e => e.competitionId === competitionId) ? 0 : player.competitionCareer?.current[competitionId]?.goals ?? 0)
  return [...entries.filter(e => e !== previous), { competitionId, division, goals: baseline + goals }]
}

export function divisionTopScorers(division: Division, player: Player, playerTeamId: string, competitionId: string) {
  const ledger = division.matchRecords?.filter(record => record.competitionId === competitionId)
  if (ledger?.length && ledger.length === division.fixtures.filter(fixture => fixture.played).length) {
    const byId = new Map<string, { id: string; name: string; teamShort: string; goals: number; isUser: boolean }>()
    for (const record of ledger) for (const line of record.lines) {
      const team = division.teams.find(t => t.id === line.teamId)
      const previous = byId.get(line.playerId)
      byId.set(line.playerId, { id: line.playerId, name: line.name, teamShort: team?.short ?? '—',
        goals: (previous?.goals ?? 0) + line.goals, isUser: line.playerId === player.id })
    }
    return [...byId.values()].filter(row => row.goals > 0).sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name))
  }
  const candidates = division.teams.flatMap(team => team.notablePlayers.map(p => ({
    id: `${team.id}-${p.name}`, name: p.name, teamShort: team.short, goals: p.seasonGoals, isUser: false,
  })))
  const team = division.teams.find(t => t.id === playerTeamId)
  const entries = player.leagueGoals ?? []
  const recorded = entries.find(e => e.competitionId === competitionId && e.division === division.tier)
  const goals = recorded?.goals ?? (entries.some(e => e.competitionId === competitionId) ? 0 : team ? player.competitionCareer?.current[competitionId]?.goals ?? 0 : 0)
  if (goals > 0) candidates.push({ id: player.id, name: player.name, teamShort: team?.short ?? '—', goals, isUser: true })
  return candidates.filter(p => p.goals > 0).sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name))
}
