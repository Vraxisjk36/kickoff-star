import type { Player } from '../../types/player'
import type { HubTab } from '../../components/navItems'
import { proFixture, proRound } from '../../engine/proCareer'
import { sortStandings } from '../../engine/league'
import { toOvr, computeCurrentAbility } from '../../engine/rating'
import { getAgent } from '../../engine/agents'
import Avatar from '../../components/Avatar'
import { TeamCrest, Panel } from '../../components/ui'
import { useCareerStore } from '../../store/careerStore'

export default function ProTabs({ player, tab, onGoTo }: { player: Player; tab: HubTab; onGoTo: (tab: HubTab) => void }) {
  const pro = player.proCareer!
  const division = pro.world.divisions[1]
  const club = division.teams.find(t => t.id === pro.world.playerTeamId)!
  const fixture = proFixture(pro)
  const opponent = division.teams.find(t => t.id === (fixture?.homeTeamId === club.id ? fixture?.awayTeamId : fixture?.homeTeamId))
  const table = sortStandings(division.standings)
  const row = table.find(r => r.teamId === club.id)!
  const nextFixture = division.fixtures.find(f => !f.played && (f.homeTeamId === club.id || f.awayTeamId === club.id))
  const nextOpponent = division.teams.find(t => t.id === (nextFixture?.homeTeamId === club.id ? nextFixture?.awayTeamId : nextFixture?.homeTeamId))
  const train = useCareerStore(s => s.trainProCareer)
  const cards = (title: string, body: React.ReactNode) => <Panel title={title}>{body}</Panel>
  const stat = (label: string, value: string | number) => <div className="flex justify-between border-b border-ks-border/40 py-2 text-sm"><span className="text-ks-muted">{label}</span><strong className="text-ks-ink">{value}</strong></div>
  const header = <section className="career-hero"><div className="career-hero-glow"/><div className="career-hero-top"><span>KICKOFF STAR · PROFESSIONAL</span><b>SEASON {pro.season} · WEEK {pro.week}</b></div><div className="career-player"><Avatar id={player.avatarId ?? 0} size={62} className="career-avatar"/><div className="min-w-0"><small>{club.name.toUpperCase()} · {player.position}</small><h1>{player.name}</h1><p>AGE {player.careerClock.ageYears} · {player.squadRole === 'starting-xi' ? 'STARTING XI' : 'FIRST TEAM SQUAD'}</p></div><div className="career-ovr"><strong>{toOvr(computeCurrentAbility(player))}</strong><span>OVR</span></div></div><div className="career-hero-strip"><div><span>ENERGY</span><b>{Math.round(player.fitness.stamina)}%</b></div><div><span>FORM</span><b>{player.matchRatings.length ? (player.matchRatings.slice(-5).reduce((a,b) => a+b,0) / Math.min(5, player.matchRatings.length)).toFixed(1) : '—'}</b></div><div><span>LEAGUE</span><b>{table.findIndex(r => r.teamId === club.id) + 1}/{table.length}</b></div></div></section>
  return <div className="flex flex-col gap-2.5 stagger-children">
    {tab === 'home' ? <>
      {header}
      {cards('NEXT UP · YOUR WEEK', <div><p className="text-ks-ink text-lg font-display">{fixture && pro.resolvedWeek !== pro.week ? `${fixture.homeTeamId === club.id ? 'HOME' : 'AWAY'} · ${opponent?.name}` : 'Training & recovery'}</p><p className="text-ks-muted text-xs mt-2">{fixture ? 'Professional League · matchweek ' + proRound(pro.week) : nextOpponent ? `Next fixture: ${nextOpponent.name}` : 'The next league calendar is being prepared.'}</p></div>)}
      {cards('WEEKLY TRAINING', <div><p className="text-ks-muted text-xs mb-3">One team session per week. Costs 12 energy and improves your standing with the coach.</p><button disabled={pro.trainedWeek === pro.week || player.fitness.stamina < 12} onClick={train} className="rounded-lg bg-ks-gold px-4 py-2 text-ks-black font-display text-xs disabled:opacity-35">{pro.trainedWeek === pro.week ? 'SESSION COMPLETE' : 'TRAIN WITH THE SQUAD →'}</button></div>)}
      <div className="grid grid-cols-2 gap-2"><button className="rounded-xl border border-ks-border p-4 text-left text-ks-gold" onClick={() => onGoTo('fixtures')}>LEAGUE <span className="block text-xs text-ks-muted mt-1">Table & fixtures →</span></button><button className="rounded-xl border border-ks-border p-4 text-left text-ks-gold" onClick={() => onGoTo('club')}>CONTRACT <span className="block text-xs text-ks-muted mt-1">Your first team deal →</span></button></div>
    </> : tab === 'player' || tab === 'scouts' ? <>
      {cards('PLAYER DOSSIER', <>{stat('Position', player.position)}{stat('Age', player.careerClock.ageYears)}{stat('Overall', toOvr(computeCurrentAbility(player)))}{stat('Coach trust', Math.round(player.coachTrust))}{stat('Career appearances', player.career?.appearances ?? 0)}{stat('Career goals', player.career?.goals ?? 0)}{stat('Career assists', player.career?.assists ?? 0)}{stat('Latest match rating', player.matchRatings.at(-1)?.toFixed(1) ?? '—')}</>)}
      {cards('THE ROAD SO FAR', <p className="text-sm text-ks-muted">Your school and academy appearances, trophies and stats stay in this career. Your professional record now builds on them.</p>)}
    </> : tab === 'people' ? <>
      {cards('YOUR REPRESENTATION', <>{stat('Agent', getAgent(player.agentId)?.name ?? 'Unrepresented')}{stat('Coach trust', Math.round(player.coachTrust))}<p className="text-ks-muted text-xs mt-3">Your existing relationships and agent carry into the professional chapter.</p></>)}
      {cards('DRESSING ROOM', <div className="flex flex-col gap-2">{club.notablePlayers.map(person => <div key={person.name} className="flex justify-between text-sm text-ks-ink"><span>{person.name}</span><span className="text-ks-muted">{person.position}</span></div>)}</div>)}
    </> : tab === 'club' ? <>
      <section className="club-hero" style={{'--club-primary':club.primaryColor,'--club-secondary':club.secondaryColor} as React.CSSProperties}><div className="club-stand"/><small>PROFESSIONAL CLUB · FIRST TEAM</small><div className="club-identity"><TeamCrest primary={club.primaryColor} secondary={club.secondaryColor} short={club.short}/><div><h2>{club.name}</h2><p>LEAGUE POSITION {table.findIndex(r => r.teamId === club.id) + 1}</p></div></div><div className="club-record"><div><span>PLAYED</span><b>{row.played}</b></div><div><span>W-D-L</span><b>{row.won}-{row.drawn}-{row.lost}</b></div><div><span>POINTS</span><b>{row.points}</b></div></div></section>
      {cards('YOUR CONTRACT', <>{stat('Gross weekly wage', `£${(player.contract?.terms.weeklyWage ?? 1200).toLocaleString()}`)}{stat('Appearance fee', `£${player.contract?.terms.appearanceFee ?? 0}`)}{stat('Goal bonus', `£${player.contract?.terms.goalBonus ?? 0}`)}{stat('Squad role', player.squadRole ?? 'First team squad')}</>)}
    </> : tab === 'fixtures' || tab === 'table' ? <>
      {cards('PROFESSIONAL LEAGUE TABLE', <div>{table.map((r, i) => <div key={r.teamId} className={`grid grid-cols-[1.5rem_1fr_2rem_2rem_2rem] gap-1 py-2 text-xs border-b border-ks-border/40 ${r.teamId === club.id ? 'text-ks-gold' : 'text-ks-ink'}`}><span>{i + 1}</span><span className="truncate">{r.teamName}</span><span>{r.played}</span><span>{r.goalsFor-r.goalsAgainst > 0 ? '+' : ''}{r.goalsFor-r.goalsAgainst}</span><b>{r.points}</b></div>)}</div>)}
      {cards('YOUR FIXTURES', <div>{division.fixtures.filter(f => f.homeTeamId === club.id || f.awayTeamId === club.id).map(f => { const other = division.teams.find(t => t.id === (f.homeTeamId === club.id ? f.awayTeamId : f.homeTeamId)); return <div key={f.id} className="flex justify-between py-2 text-xs border-b border-ks-border/40 text-ks-ink"><span>ROUND {f.week} · {f.homeTeamId === club.id ? 'H' : 'A'} · {other?.name}</span><b>{f.played ? `${f.homeGoals}–${f.awayGoals}` : '—'}</b></div> })}</div>)}
    </> : <>
      {cards('PROFESSIONAL FINANCES', <>{stat('Balance', `£${(player.money ?? 0).toLocaleString()}`)}{stat('Career gross earnings', `£${(player.careerEarnings ?? 0).toLocaleString()}`)}{stat('Weekly wage', `£${(player.contract?.terms.weeklyWage ?? 1200).toLocaleString()}`)}<p className="text-ks-muted text-xs mt-3">Your salary is paid when a week advances. Match bonuses are paid when the result is recorded.</p></>)}
    </>}
  </div>
}
