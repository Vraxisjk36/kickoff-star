import type { Player } from '../types/player'
import type { HubTab } from './navItems'
import type { Team } from '../engine/teams'
import type { Division } from '../engine/league'
import { sortStandings } from '../engine/league'
import { TeamCrest } from './ui'
import Avatar from './Avatar'

const scenes = {
  player: { eyebrow: 'PLAYER DOSSIER', title: 'THE MAKING OF A PLAYER', mark: '01', tint: 'gold' },
  club: { eyebrow: 'DRESSING ROOM', title: 'ONE BADGE. ONE SEASON.', mark: '02', tint: 'green' },
  people: { eyebrow: 'YOUR INNER CIRCLE', title: 'EVERY BOND COUNTS.', mark: '03', tint: 'blue' },
  fixtures: { eyebrow: 'COMPETITION CENTRE', title: 'THE ROAD AHEAD.', mark: '04', tint: 'amber' },
  table: { eyebrow: 'COMPETITION CENTRE', title: 'THE ROAD AHEAD.', mark: '04', tint: 'amber' },
  shop: { eyebrow: 'OFF THE PITCH', title: 'BUILD YOUR FUTURE.', mark: '05', tint: 'teal' },
  scouts: { eyebrow: 'PLAYER DOSSIER', title: 'THE MAKING OF A PLAYER', mark: '01', tint: 'gold' },
} as const

export default function BroadcastHeader({ tab, player, team, division, week }: {
  tab: HubTab; player: Player; team: Team; division: Division; week: number
}) {
  if (tab === 'home') return null
  const scene = scenes[tab]
  const standings = sortStandings(division.standings)
  const position = standings.findIndex(row => row.teamId === team.id) + 1
  const stats = tab === 'player' || tab === 'scouts'
    ? [{ label: 'APPEARANCES', value: player.career?.appearances ?? 0 }, { label: 'GOALS', value: player.career?.goals ?? 0 }, { label: 'ASSISTS', value: player.career?.assists ?? 0 }]
    : tab === 'club'
    ? [{ label: 'LEAGUE', value: position ? `#${position}` : '—' }, { label: 'SQUAD', value: player.squad?.length ?? 0 }, { label: 'WEEK', value: week }]
    : tab === 'people'
    ? [{ label: 'CONNECTIONS', value: player.relationships?.length ?? 0 }, { label: 'COACH TRUST', value: Math.round(player.coachTrust ?? 0) }, { label: 'WEEK', value: week }]
    : tab === 'shop'
    ? [{ label: 'BALANCE', value: `£${player.money ?? 0}` }, { label: 'EQUIPMENT', value: player.equipment?.length ?? 0 }, { label: 'WEEK', value: week }]
    : [{ label: 'POSITION', value: position ? `#${position}` : '—' }, { label: 'TEAMS', value: division.teams.length }, { label: 'WEEK', value: week }]
  return <section className={`broadcast-head broadcast-head--${scene.tint}`} aria-label={`${scene.eyebrow} overview`}>
    <div className="broadcast-head__texture" aria-hidden="true" />
    <div className="broadcast-head__top"><span>KS / {scene.eyebrow}</span><span>SEASON {player.careerClock.ageYears} · WK {week}</span></div>
    <div className="broadcast-head__body">
      <div className="broadcast-head__identity">
        <span className="broadcast-head__index">{scene.mark} / 05</span>
        <h2>{scene.title}</h2>
        <p>{tab === 'player' || tab === 'scouts' ? player.name : tab === 'club' ? team.name : tab === 'people' ? 'The people behind your journey' : tab === 'shop' ? 'Every choice has a cost' : `${division.teams.length} teams. One destination.`}</p>
      </div>
      <div className="broadcast-head__emblem" aria-hidden="true">
        {tab === 'player' || tab === 'scouts' ? <Avatar id={player.avatarId ?? 0} size={82} /> : tab === 'club' ? <TeamCrest primary={team.primaryColor} secondary={team.secondaryColor} short={team.short} /> : <span>{tab === 'people' ? '✦' : tab === 'shop' ? '£' : '★'}</span>}
      </div>
    </div>
    <div className="broadcast-head__metrics">{stats.map(stat => <div key={stat.label}><b>{stat.value}</b><span>{stat.label}</span></div>)}</div>
  </section>
}
