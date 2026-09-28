import type { Player } from '../types/player'
import type { Division } from '../engine/league'
import { divisionTopScorers } from '../engine/leagueScorers'
import { Panel } from './ui'

export default function TopScorers({ division, player, playerTeamId, competitionId }: { division: Division; player: Player; playerTeamId: string; competitionId: string }) {
  const scorers = divisionTopScorers(division, player, playerTeamId, competitionId)
  const userIndex = scorers.findIndex(p => p.isUser)
  const shown = scorers.slice(0, 5)
  if (userIndex >= 5) shown.push(scorers[userIndex])
  return <Panel title="top scorers — league only"><div className="flex flex-col gap-1.5">
    {shown.map(p => <details key={p.id} className={`text-[11px] ${p.isUser ? 'text-ks-gold' : 'text-ks-ink'}`}>
      <summary className="flex items-center gap-2 cursor-pointer list-none">
        <span className="w-5">{scorers.findIndex(row => row.goals === p.goals) + 1}</span><span className="flex-1 truncate">{p.name}{p.isUser ? ' · YOU' : ''}</span><span className="text-ks-muted w-9">{p.teamShort}</span><b className="tabular-nums">{p.goals}</b>
      </summary>
      <div className="pl-5 py-1.5 text-[10px] text-ks-muted">
        {division.matchRecords?.filter(record => record.lines.some(line => line.playerId === p.id)).slice(-5).map(record => {
          const line = record.lines.find(entry => entry.playerId === p.id)!
          return <div key={record.id}>W{record.week} · {line.goals} goals · {line.assists} assists · {line.rating.toFixed(1)} rating</div>
        }) ?? <span>Earlier save: season tally retained.</span>}
      </div>
    </details>)}
    {shown.length === 0 && <p className="text-xs text-ks-muted">No league goals yet.</p>}
    <p className="text-[10px] text-ks-muted mt-2">Cup, friendly and international goals are listed separately in your career record.</p>
  </div></Panel>
}
