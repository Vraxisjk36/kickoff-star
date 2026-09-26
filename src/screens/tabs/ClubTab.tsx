import TopScorers from '../../components/TopScorers'
import type { Player } from '../../types/player'
import type { Division } from '../../engine/league'
import { sortStandings, divisionLabel } from '../../engine/league'
import { academyDivisionLabel } from '../../engine/academy'
import { teamOverall, type Team } from '../../engine/teams'
import { Panel, Bar, StatRow, TeamCrest } from '../../components/ui'

function ordinal(n: number): string {
  return `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`
}

export default function ClubTab({ player, playerTeam, division, isAcademy }: {
  player: Player
  playerTeam: Team
  division: Division
  isAcademy: boolean
}) {
  const sorted = sortStandings(division.standings)
  const pos = sorted.findIndex((s) => s.teamId === playerTeam.id) + 1
  const standing = sorted.find((s) => s.teamId === playerTeam.id)
  const rivals = division.teams.filter((t) => t.id !== playerTeam.id)
  const divName = isAcademy
    ? academyDivisionLabel(division.tier as 1 | 2)
    : player.grassrootsPath === 'school' ? 'Local School League' : divisionLabel(division.tier)

  return (
    <div className="flex flex-col gap-2.5">
      <section className="club-hero" style={{'--club-primary':playerTeam.primaryColor,'--club-secondary':playerTeam.secondaryColor} as React.CSSProperties}><div className="club-stand"/><small>{isAcademy?'ACADEMY CLUB':player.grassrootsPath==='school'?'SCHOOL TEAM':'GRASSROOTS CLUB'} · {divName}</small><div className="club-identity"><TeamCrest primary={playerTeam.primaryColor} secondary={playerTeam.secondaryColor} short={playerTeam.short} /><div><h2>{playerTeam.name}</h2><p>{pos>0?ordinal(pos):'—'} IN LEAGUE · PRESTIGE {playerTeam.prestige}/10</p></div><div className="club-strength"><b>{teamOverall(playerTeam)}</b><span>TEAM OVR</span></div></div><div className="club-record"><div><span>PLAYED</span><b>{standing?.played??0}</b></div><div><span>W-D-L</span><b>{standing?.won??0}-{standing?.drawn??0}-{standing?.lost??0}</b></div><div><span>POINTS</span><b>{standing?.points??0}</b></div><div><span>GD</span><b>{((standing?.goalsFor??0)-(standing?.goalsAgainst??0))>0?'+':''}{(standing?.goalsFor??0)-(standing?.goalsAgainst??0)}</b></div></div></section>

      <div className="home-section-label"><span>SQUAD PROFILE</span><i/></div><Panel title="💪 team strength">
        <div className="flex flex-col gap-1.5">
          {(['attack', 'midfield', 'defense'] as const).map((line) => (
            <div key={line} className="flex items-center gap-2">
              <span className="text-[10px] text-ks-muted capitalize w-16">{line}</span>
              <Bar value={playerTeam.ratings[line]} max={99} />
              <span className="text-[10px] text-ks-ink w-6 text-right">{playerTeam.ratings[line]}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="📊 your standing">
        <div className="flex flex-col gap-1.5">
          <StatRow label="squad role" value={<span className="capitalize">{player.squadRole ?? 'TBD'}</span>} />
          <StatRow label="position" value={pos > 0 ? ordinal(pos) : '—'} />
          <StatRow label="played" value={standing?.played ?? 0} />
          <StatRow label="record" value={`${standing?.won ?? 0}W ${standing?.drawn ?? 0}D ${standing?.lost ?? 0}L`} />
          <StatRow label="points" value={standing?.points ?? 0} />
          <StatRow
            label="goal difference"
            value={(() => {
              const gd = (standing?.goalsFor ?? 0) - (standing?.goalsAgainst ?? 0)
              return `${gd > 0 ? '+' : ''}${gd}`
            })()}
          />
        </div>
      </Panel>

      <Panel title="🎽 squad">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 rounded-md border border-ks-gold/40 bg-ks-gold/10 px-2 py-2">
            <span className="text-[9px] text-ks-gold w-8">YOU</span>
            <span className="text-[11px] text-ks-ink flex-1 truncate">{player.name}</span>
            <span className="text-[9px] text-ks-muted">{player.position}</span>
            <span className="text-[9px] text-ks-gold uppercase">{player.squadRole ?? 'trial'}</span>
          </div>
          {[...(player.squad ?? [])].sort((a, b) => (a.squadRole === b.squadRole ? b.quality - a.quality : a.squadRole === 'starter' ? -1 : 1)).map((mate) => (
            <div key={mate.id} className="flex items-center gap-2 px-2 py-1.5 border-b border-ks-border/35 last:border-0">
              <span className={`text-[8px] uppercase w-10 ${mate.squadRole === 'starter' ? 'text-green-500' : 'text-ks-muted'}`}>{mate.squadRole === 'starter' ? 'XI' : 'bench'}</span>
              <span className="text-[11px] text-ks-ink flex-1 truncate">{mate.name}</span>
              <span className="text-[9px] text-ks-muted w-7">{mate.position}</span>
              <span className="font-display text-[10px] text-ks-gold w-5 text-right">{mate.quality}</span>
              <span className="text-[8px] text-ks-muted w-12 text-right">{mate.seasonGoals}G {mate.seasonAssists}A</span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="home-section-label"><span>THE DIVISION</span><i/></div>
      <Panel title={`rivals — ${divName}`}>
        <div className="flex flex-col gap-2">
          {rivals.map((t) => (
            <div key={t.id} className="flex items-center gap-2.5">
              <TeamCrest primary={t.primaryColor} secondary={t.secondaryColor} short={t.short} size="sm" />
              <span className="text-[11px] text-ks-ink flex-1 truncate">{t.name}</span>
              <span className="text-[10px] text-ks-muted">strength {teamOverall(t)}</span>
            </div>
          ))}
        </div>
      </Panel>

      <TopScorers division={division} player={player} playerTeamId={playerTeam.id} competitionId={isAcademy ? 'academyLeague' : player.grassrootsPath === 'school' ? 'schoolLeague' : 'sundayLeague'} />

      <Panel title="⚽ top scoring teams">
        <div className="flex flex-col gap-1.5">
          {[...division.standings].sort((a, b) => b.goalsFor - a.goalsFor).slice(0, 5).map((s, i) => (
            <div key={s.teamId} className="flex items-center gap-2 text-[11px]">
              <span className="text-ks-muted w-4">{i + 1}</span>
              <span className={`flex-1 truncate ${s.teamId === playerTeam.id ? 'text-ks-gold' : 'text-ks-ink'}`}>{s.teamName}</span>
              <span className="text-ks-ink tabular-nums">{s.goalsFor} scored</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="🗓️ your season">
        <div className="flex flex-col gap-1.5">
          <StatRow label="goals" value={player.seasonGoals ?? 0} />
          <StatRow label="assists" value={player.seasonAssists ?? 0} />
          <StatRow
            label="average rating"
            value={
              (player.matchRatings ?? []).length > 0
                ? ((player.matchRatings ?? []).reduce((a, b) => a + b, 0) / (player.matchRatings ?? []).length).toFixed(1)
                : '—'
            }
          />
        </div>
      </Panel>
    </div>
  )
}
