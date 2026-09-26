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
    {shown.map(p => <div key={p.id} className={`flex items-center gap-2 text-[11px] ${p.isUser ? 'text-ks-gold' : 'text-ks-ink'}`}>
      <span className="w-5">{scorers.findIndex(row => row.goals === p.goals) + 1}</span><span className="flex-1 truncate">{p.name}{p.isUser ? ' · YOU' : ''}</span><span className="text-ks-muted w-9">{p.teamShort}</span><b className="tabular-nums">{p.goals}</b>
    </div>)}
    {shown.length === 0 && <p className="text-xs text-ks-muted">No league goals yet.</p>}
    <p className="text-[10px] text-ks-muted mt-2">Cup, friendly and international goals are listed separately in your career record.</p>
  </div></Panel>
}
