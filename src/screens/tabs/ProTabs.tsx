import type { Player } from '../../types/player'
import type { HubTab } from '../../components/navItems'
import { proFixture, proRound } from '../../engine/proCareer'
import { sortStandings } from '../../engine/league'
import { toOvr, computeCurrentAbility } from '../../engine/rating'
import { getAgent } from '../../engine/agents'
import Avatar from '../../components/Avatar'
import { TeamCrest, Panel } from '../../components/ui'
import { useCareerStore } from '../../store/careerStore'
import { useState } from 'react'
import ProNewsScreen from '../ProNewsScreen'
import ProWorldPanel from '../ProWorldPanel'
import { registrationOpen } from '../../engine/proMovement'

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
  const requestOffers = useCareerStore(s => s.requestProOffers)
  const openTalks = useCareerStore(s => s.openProTransferTalks)
  const counterTalks = useCareerStore(s => s.counterProTransferTalks)
  const signMove = useCareerStore(s => s.signProTransfer)
  const acceptLoan = useCareerStore(s => s.acceptProLoan)
  const [newsOpen, setNewsOpen] = useState(false)
  const [worldOpen, setWorldOpen] = useState(false)
  const windowOpen = pro.date ? registrationOpen('eng', pro.date) : false
  const cards = (title: string, body: React.ReactNode) => <Panel title={title}>{body}</Panel>
  const stat = (label: string, value: string | number) => <div className="flex justify-between border-b border-ks-border/40 py-2 text-sm"><span className="text-ks-muted">{label}</span><strong className="text-ks-ink">{value}</strong></div>
  const header = <section className="career-hero"><div className="career-hero-glow"/><div className="career-hero-top"><span>KICKOFF STAR · PROFESSIONAL</span><b>SEASON {pro.season} · WEEK {pro.week}</b></div><div className="career-player"><Avatar id={player.avatarId ?? 0} size={62} className="career-avatar"/><div className="min-w-0"><small>{club.name.toUpperCase()} · {player.position}</small><h1>{player.name}</h1><p>AGE {player.careerClock.ageYears} · {player.squadRole === 'starting-xi' ? 'STARTING XI' : 'FIRST TEAM SQUAD'}</p></div><div className="career-ovr"><strong>{toOvr(computeCurrentAbility(player))}</strong><span>OVR</span></div></div><div className="career-hero-strip"><div><span>ENERGY</span><b>{Math.round(player.fitness.stamina)}%</b></div><div><span>FORM</span><b>{player.matchRatings.length ? (player.matchRatings.slice(-5).reduce((a,b) => a+b,0) / Math.min(5, player.matchRatings.length)).toFixed(1) : '—'}</b></div><div><span>LEAGUE</span><b>{table.findIndex(r => r.teamId === club.id) + 1}/{table.length}</b></div></div></section>
  return <div className="flex flex-col gap-2.5 stagger-children">
    {tab === 'home' ? <>
      {header}
      {cards('NEXT UP · YOUR WEEK', <div><p className="text-ks-ink text-lg font-display">{fixture && pro.resolvedWeek !== pro.week ? `${fixture.homeTeamId === club.id ? 'HOME' : 'AWAY'} · ${opponent?.name}` : 'Training & recovery'}</p><p className="text-ks-muted text-xs mt-2">{fixture ? 'Professional League · matchweek ' + proRound(pro.week) : nextOpponent ? `Next fixture: ${nextOpponent.name}` : 'The next league calendar is being prepared.'}</p></div>)}
      {cards('WEEKLY TRAINING', <div><p className="text-ks-muted text-xs mb-3">One team session per week. Costs 12 energy and improves your standing with the coach.</p><button disabled={pro.trainedWeek === pro.week || player.fitness.stamina < 12} onClick={train} className="rounded-lg bg-ks-gold px-4 py-2 text-ks-black font-display text-xs disabled:opacity-35">{pro.trainedWeek === pro.week ? 'SESSION COMPLETE' : 'TRAIN WITH THE SQUAD →'}</button></div>)}
      {cards('THE GAZETTE · PRO EDITION', <div><p className="font-display text-ks-ink text-lg">{pro.news?.at(-1)?.headline ?? 'The season opens'}</p><p className="text-ks-muted text-xs mt-2">Club, country and world stories from recorded events.</p><button className="text-ks-gold text-xs mt-4" onClick={() => setNewsOpen(true)}>BROWSE THE GAZETTE →</button></div>)}
      <div className="grid grid-cols-2 gap-2"><button className="rounded-xl border border-ks-border p-4 text-left text-ks-gold" onClick={() => onGoTo('fixtures')}>LEAGUE <span className="block text-xs text-ks-muted mt-1">Table & fixtures →</span></button><button className="rounded-xl border border-ks-border p-4 text-left text-ks-gold" onClick={() => onGoTo('club')}>CONTRACT <span className="block text-xs text-ks-muted mt-1">Your first team deal →</span></button></div>
    </> : tab === 'player' || tab === 'scouts' ? <>
      {cards('PLAYER DOSSIER', <>{stat('Position', player.position)}{stat('Age', player.careerClock.ageYears)}{stat('Overall', toOvr(computeCurrentAbility(player)))}{stat('Shirt number', pro.shirtNumber ?? '—')}{stat('Coach trust', Math.round(player.coachTrust))}{stat('Career appearances', player.career?.appearances ?? 0)}{stat('Career goals', player.career?.goals ?? 0)}{stat('Career assists', player.career?.assists ?? 0)}{stat('Latest match rating', player.matchRatings.at(-1)?.toFixed(1) ?? '—')}{stat('Injury', player.injury ? `${player.injury.weeksRemaining} weeks · ${player.injury.severity}` : 'Fit')}{stat('Suspension', player.suspensionMatches ?? 0)}</>)}
      {cards('THE ROAD SO FAR', <p className="text-sm text-ks-muted">Your school and academy appearances, trophies and stats stay in this career. Your professional record now builds on them.</p>)}
    </> : tab === 'people' ? <>
      {cards('YOUR REPRESENTATION', <>{stat('Agent', getAgent(player.agentId)?.name ?? 'Unrepresented')}{stat('Coach trust', Math.round(player.coachTrust))}<p className="text-ks-muted text-xs mt-3">Your existing relationships and agent carry into the professional chapter.</p></>)}
      {cards('DRESSING ROOM', <div className="flex flex-col gap-2">{club.notablePlayers.map(person => <div key={person.name} className="flex justify-between text-sm text-ks-ink"><span>{person.name}</span><span className="text-ks-muted">{person.position}</span></div>)}</div>)}
      {pro.backgroundWorld && cards('MANAGER & CLUB', <>{stat('Manager', Object.values(pro.backgroundWorld.managers).find(manager => manager.clubId === pro.clubWorldIds?.[club.id])?.name ?? '—')}{stat('Home stadium', pro.backgroundWorld.stadiums[pro.backgroundWorld.clubs[pro.clubWorldIds?.[club.id] ?? '']?.stadiumId ?? '']?.name ?? '—')}{stat('Squad players', Object.values(pro.backgroundWorld.players).filter(person => person.clubId === pro.clubWorldIds?.[club.id]).length)}</>)}
    </> : tab === 'club' ? <>
      <section className="club-hero" style={{'--club-primary':club.primaryColor,'--club-secondary':club.secondaryColor} as React.CSSProperties}><div className="club-stand"/><small>PROFESSIONAL CLUB · FIRST TEAM</small><div className="club-identity"><TeamCrest primary={club.primaryColor} secondary={club.secondaryColor} short={club.short}/><div><h2>{club.name}</h2><p>LEAGUE POSITION {table.findIndex(r => r.teamId === club.id) + 1}</p></div></div><div className="club-record"><div><span>PLAYED</span><b>{row.played}</b></div><div><span>W-D-L</span><b>{row.won}-{row.drawn}-{row.lost}</b></div><div><span>POINTS</span><b>{row.points}</b></div></div></section>
      {cards('YOUR CONTRACT', <>{stat('Parent club', player.contract?.clubName ?? club.name)}{stat('Gross weekly wage', `£${(player.contract?.terms.weeklyWage ?? 1200).toLocaleString()}`)}{stat('Appearance fee', `£${player.contract?.terms.appearanceFee ?? 0}`)}{stat('Goal bonus', `£${player.contract?.terms.goalBonus ?? 0}`)}{stat('Contract end', `Week ${player.contract?.expiresWeek ?? '—'}`)}{stat('Squad role', player.squadRole ?? 'First team squad')}{pro.loan && <p className="text-ks-gold text-xs mt-3">On loan at {club.name}. Your parent club retains your contract until the end of the season.</p>}</>)}
      {cards('TRANSFER DESK', <div><p className="text-ks-muted text-xs mb-3">Talks take two weeks. Club budgets and the registration window control which moves can happen.</p>{stat('Registration', windowOpen ? 'Open' : 'Closed')}
        {pro.talks ? <div className="mt-3 text-ks-ink text-sm"><b>{division.teams.find(team => team.id === pro.talks?.offer.teamId)?.name}</b><p className="text-ks-muted text-xs mt-1">£{pro.talks.offer.weeklyWage.toLocaleString()}/week · {pro.talks.readyWeek > player.totalWeeksElapsed ? `${pro.talks.readyWeek - player.totalWeeksElapsed} week(s) to terms` : 'terms ready to sign'}</p><div className="flex gap-3 mt-3"><button disabled={pro.talks.readyWeek > player.totalWeeksElapsed} onClick={() => signMove()} className="text-ks-gold text-xs disabled:opacity-35">SIGN DEAL →</button><button disabled={pro.talks.readyWeek > player.totalWeeksElapsed || pro.talks.countered} onClick={counterTalks} className="text-ks-muted text-xs disabled:opacity-35">ASK FOR 5% MORE</button></div></div> : <><button disabled={!windowOpen || !!pro.loan} onClick={requestOffers} className="text-ks-gold text-xs mt-3 disabled:opacity-35">ASK AGENT FOR OFFERS →</button>{pro.marketOffers?.map(offer => <button key={offer.teamId} onClick={() => openTalks(offer.teamId)} className="block w-full text-left border-t border-ks-border/50 py-3 text-xs text-ks-ink">{division.teams.find(team => team.id === offer.teamId)?.name}<span className="float-right text-ks-gold">£{offer.weeklyWage.toLocaleString()}/wk →</span></button>)}</>}
        {windowOpen && !pro.loan && player.squadRole !== 'starting-xi' && <div className="border-t border-ks-border mt-4 pt-3"><p className="text-ks-muted text-xs">Need senior minutes? A temporary loan keeps your parent contract.</p>{division.teams.filter(team => team.id !== club.id).slice(0, 2).map(team => <button key={team.id} onClick={() => acceptLoan(team.id)} className="block text-ks-gold text-xs mt-2">REQUEST LOAN · {team.name} →</button>)}</div>}
      </div>)}
    </> : tab === 'fixtures' || tab === 'table' ? <>
      {cards('PROFESSIONAL LEAGUE TABLE', <div>{table.map((r, i) => <div key={r.teamId} className={`grid grid-cols-[1.5rem_1fr_2rem_2rem_2rem] gap-1 py-2 text-xs border-b border-ks-border/40 ${r.teamId === club.id ? 'text-ks-gold' : 'text-ks-ink'}`}><span>{i + 1}</span><span className="truncate">{r.teamName}</span><span>{r.played}</span><span>{r.goalsFor-r.goalsAgainst > 0 ? '+' : ''}{r.goalsFor-r.goalsAgainst}</span><b>{r.points}</b></div>)}</div>)}
      {cards('YOUR FIXTURES', <div>{division.fixtures.filter(f => f.homeTeamId === club.id || f.awayTeamId === club.id).map(f => { const other = division.teams.find(t => t.id === (f.homeTeamId === club.id ? f.awayTeamId : f.homeTeamId)); return <div key={f.id} className="flex justify-between py-2 text-xs border-b border-ks-border/40 text-ks-ink"><span>ROUND {f.week} · {f.homeTeamId === club.id ? 'H' : 'A'} · {other?.name}</span><b>{f.played ? `${f.homeGoals}–${f.awayGoals}` : '—'}</b></div> })}</div>)}
      {pro.backgroundWorld && <><button className="rounded-xl border border-ks-gold/50 text-ks-gold font-display text-sm py-4" onClick={() => setWorldOpen(!worldOpen)}>{worldOpen ? 'CLOSE WORLD FOOTBALL' : 'EXPLORE WORLD FOOTBALL →'}</button>{worldOpen && <ProWorldPanel world={pro.backgroundWorld} />}</>}
    </> : <>
      {cards('PROFESSIONAL FINANCES', <>{stat('Balance', `£${(player.money ?? 0).toLocaleString()}`)}{stat('Career gross earnings', `£${(player.careerEarnings ?? 0).toLocaleString()}`)}{stat('Weekly wage', `£${(player.contract?.terms.weeklyWage ?? 1200).toLocaleString()}`)}{stat('Pending match bonuses', `£${(pro.pendingBonus ?? 0).toLocaleString()}`)}<p className="text-ks-muted text-xs mt-3">Monthly pay includes estimated deductions, your agent and accommodation. Figures are part of the game economy.</p></>)}
      {cards('YOUR RESIDENCE', <>{stat('City', pro.residence?.city ?? 'Settling in')}{stat('Monthly rent', `£${(pro.residence?.monthlyRent ?? 0).toLocaleString()}`)}{stat('Hotel until', pro.residence?.hotelUntil ?? '—')}</>)}
      {cards('PAY STATEMENTS', <div>{[...(pro.payStatements ?? [])].reverse().slice(0, 6).map(statement => <div key={statement.month} className="border-b border-ks-border/40 py-3 text-xs"><strong className="text-ks-gold">{statement.month} · NET £{statement.net.toLocaleString()}</strong><div className="grid grid-cols-2 gap-1 text-ks-muted mt-2"><span>Gross £{statement.gross.toLocaleString()}</span><span>Bonus £{statement.bonus.toLocaleString()}</span><span>Withholding £{statement.estimatedWithholding.toLocaleString()}</span><span>Agent £{statement.agentFee.toLocaleString()}</span><span>Housing £{statement.housing.toLocaleString()}</span></div></div>)}{!pro.payStatements?.length && <p className="text-ks-muted text-xs">Your first statement arrives at the end of the month.</p>}</div>)}
    </>}
    {newsOpen && <ProNewsScreen articles={pro.news ?? []} onClose={() => setNewsOpen(false)} />}
  </div>
}
