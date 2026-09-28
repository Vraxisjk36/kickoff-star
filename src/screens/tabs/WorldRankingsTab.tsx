import { useState } from 'react'
import type { Player } from '../../types/player'
import type { Division } from '../../engine/league'
import { worldLeagueLeaders } from '../../engine/worldLeagues'
import { schoolsLeaders, type SchoolsRankingRow } from '../../engine/worldSchools'

export default function WorldRankingsTab({ player, homeDivision, playerTeamId }: { player: Player; homeDivision: Division | null; playerTeamId: string }) {
  const [mode, setMode] = useState<'schools' | 'players'>('schools')
  const world = player.worldLeagues
  const schoolRanking = world?.schoolRankings?.filter(entry => entry.season === world.season).at(-1)
  const teamRank = schoolRanking?.rows.findIndex(row => row.teamId === playerTeamId) ?? -1
  const completedWeek = schoolRanking?.week ?? 0
  const previousPlayers = player.worldSchools?.rankings.filter(entry => entry.season === world?.season && entry.week < completedWeek).at(-1)
  const rows = world && completedWeek ? worldLeagueLeaders(world, completedWeek, homeDivision, player.id, previousPlayers) : []
  const user = player.worldSchools && completedWeek && player.careerClock.phase !== 'academy'
    ? schoolsLeaders(player.worldSchools, player, completedWeek, previousPlayers, true).find(row => row.id === player.id) : undefined
  const playerRows: SchoolsRankingRow[] = [...rows, ...(user ? [user] : [])].sort((a, b) => b.points - a.points || b.averageRating - a.averageRating || a.id.localeCompare(b.id))
  const playerRank = playerRows.findIndex(row => row.id === player.id)
  const movement = (rank: number, previous?: number) => previous == null ? '—' : previous === rank ? '—' : previous > rank ? `▲ ${previous - rank}` : `▼ ${rank - previous}`
  return <section className="space-y-4 pb-8">
    <div className="border-l-2 border-ks-gold pl-4 py-2"><p className="text-[10px] uppercase tracking-[.24em] text-ks-gold">World football</p>
      <h2 className="font-display text-3xl text-white">The rankings</h2><p className="text-sm text-ks-muted mt-1">Season form across the featured school leagues. Updated every four weeks.</p></div>
    <div className="grid grid-cols-2 gap-2">{(['schools','players'] as const).map(value => <button key={value} onClick={() => setMode(value)} className={`rounded-lg py-3 font-display uppercase text-sm ${mode === value ? 'bg-ks-gold text-ks-black' : 'border border-ks-border text-ks-muted'}`}>{value}</button>)}</div>
    {!schoolRanking ? <p className="rounded-xl border border-ks-border p-5 text-ks-muted text-sm">The first world rankings are published after week eight’s league fixtures.</p> : <>
      <div className="rounded-xl border border-ks-gold/40 bg-ks-gold/5 px-4 py-3">
        <p className="text-[10px] text-ks-gold tracking-widest uppercase">Your {mode === 'schools' ? 'school' : 'player'} · Week {completedWeek}</p>
        <p className="mt-1 font-display text-lg text-white">{mode === 'schools' ? homeDivision?.teams.find(team => team.id === playerTeamId)?.name ?? 'Your school' : player.name}</p>
        <p className="text-xs text-ks-muted mt-1">{mode === 'schools' ? teamRank >= 0 ? `World #${teamRank + 1} · ${schoolRanking.rows[teamRank].score} ranking points` : 'Outside this season’s featured school list' : playerRank >= 0 ? `World #${playerRank + 1} · ${playerRows[playerRank].points} season points` : 'Awaiting a school league appearance'}</p>
      </div>
      <p className="text-[10px] tracking-[.2em] uppercase text-ks-gold">Top 30 {mode} · {mode === 'schools' ? schoolRanking.rows.length : playerRows.length} ranked</p>
      {(mode === 'schools' ? schoolRanking.rows.slice(0, 30) : playerRows.slice(0, 30)).map((row, index) => {
        const isUser = mode === 'schools' ? 'teamId' in row && row.teamId === playerTeamId : 'id' in row && row.id === player.id
        return <div key={'teamId' in row ? row.teamId : row.id} className={`flex items-center gap-3 border-b border-ks-border/50 px-2 py-2.5 ${isUser ? 'bg-ks-gold/10 border-l-2 border-l-ks-gold' : ''}`}>
          <b className="font-display text-ks-gold w-7">{index + 1}</b><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-ks-ink">{'teamId' in row ? row.name : row.name}{isUser ? ' · YOU' : ''}</strong>
          <small className="block truncate text-[10px] text-ks-muted">{'teamId' in row ? `${row.countryId.toUpperCase()} · ${row.points} league pts · ${row.goalDifference >= 0 ? '+' : ''}${row.goalDifference} GD` : `${row.school} · ${row.countryId.toUpperCase()} · ${row.goals}G ${row.assists}A · ${row.appearances} apps`}</small></span>
          <span className="text-right shrink-0"><b className="block text-sm text-ks-gold">{'teamId' in row ? row.score : row.points}</b><small className="text-[10px] text-ks-muted">{movement(index + 1, row.previousRank)}</small></span>
        </div>
      })}
      {mode === 'schools' && teamRank >= 30 && <p className="border-t border-ks-gold/40 py-3 text-sm text-ks-gold">#{teamRank + 1} · {schoolRanking.rows[teamRank].name} · {schoolRanking.rows[teamRank].score}</p>}
      {mode === 'players' && playerRank >= 30 && <p className="border-t border-ks-gold/40 py-3 text-sm text-ks-gold">#{playerRank + 1} · {player.name} · {playerRows[playerRank].points}</p>}
    </>}
  </section>
}
