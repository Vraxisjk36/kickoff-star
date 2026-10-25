import type { Player } from '../../types/player'
import type { HubTab } from '../../components/navItems'
import { proFixture } from '../../engine/proCareer'
import { sortStandings } from '../../engine/league'
import { toOvr, computeCurrentAbility } from '../../engine/rating'
import { getAgent } from '../../engine/agents'
import Avatar from '../../components/Avatar'
import { TeamCrest, Panel, Section } from '../../components/ui'
import PlayerTab from './PlayerTab'
import PeopleTab from './PeopleTab'
import ClubTab from './ClubTab'
import ShopTab from './ShopTab'
import ProLifestyleTab from './ProLifestyleTab'
import ProSponsorshipTab from './ProSponsorshipTab'
import StandingsTable from '../../components/StandingsTable'
import ProWeeklyCalendar from './ProWeeklyCalendar'
import { mondayFrom, proMatchDay, proTrainingAvailable } from '../../engine/proWeeklySchedule'
import { useCareerStore } from '../../store/careerStore'
import { useEffect, useMemo, useState } from 'react'
import ProNewsScreen from '../ProNewsScreen'
import ProWorldPanel from '../ProWorldPanel'
import { registrationOpen } from '../../engine/proMovement'
import { proCompetitionName } from '../../engine/proTournaments'
import { getNation } from '../../engine/nations'
import { internationalCycle, internationalProgress, visibleQualifyingTable } from '../../engine/proInternationalTournament'
import { continentalNationsProgress } from '../../engine/proContinentalNations'
import { seniorWorldNationRankings } from '../../engine/proNationWorldRankings'
import { proLeagueRecords,worldPlayerAwards } from '../../engine/proHonours'

export default function ProTabs({ player, tab, onGoTo, onOpenInbox, onOpenEnergy, onTrain, matchKind, matchOpponent, matchDate }: { player: Player; tab: HubTab; onGoTo: (tab: HubTab) => void; onOpenInbox: () => void; onOpenEnergy: () => void; onTrain: () => void; matchKind?: 'league'|'domestic-cup'|'europe'|'international'|'final'; matchOpponent?: string; matchDate?: string }) {
  const pro = player.proCareer!
  const division = pro.world.divisions[1]
  const club = division.teams.find(t => t.id === pro.world.playerTeamId)!
  const fixture = proFixture(pro)
  const opponent = division.teams.find(t => t.id === (fixture?.homeTeamId === club.id ? fixture?.awayTeamId : fixture?.homeTeamId))
  const table = sortStandings(division.standings)
  const row = table.find(r => r.teamId === club.id)!
  const nextFixture = division.fixtures.find(f => !f.played && (f.homeTeamId === club.id || f.awayTeamId === club.id))
  const nextOpponent = division.teams.find(t => t.id === (nextFixture?.homeTeamId === club.id ? nextFixture?.awayTeamId : nextFixture?.homeTeamId))
  const requestOffers = useCareerStore(s => s.requestProOffers)
  const requestRenewal = useCareerStore(s => s.requestProRenewal)
  const openTalks = useCareerStore(s => s.openProTransferTalks)
  const counterTalks = useCareerStore(s => s.counterProTransferTalks)
  const signMove = useCareerStore(s => s.signProTransfer)
  const acceptLoan = useCareerStore(s => s.acceptProLoan)
  const [newsOpen, setNewsOpen] = useState(false)
  const [homeView,setHomeView]=useState<'overview'|'schedule'|'updates'>('overview')
  const [shopView,setShopView]=useState<'sponsors'|'essentials'|'finances'>('sponsors')
  const [fixtureFilter,setFixtureFilter]=useState<'upcoming'|'results'>('upcoming')
  const [fixtureLimit,setFixtureLimit]=useState(8)
  const [competitionFilter,setCompetitionFilter]=useState<'all'|'league'>('all')
  const [archiveExpanded,setArchiveExpanded]=useState(false)
  const [clubDetailsExpanded,setClubDetailsExpanded]=useState(false)
  const [showAllPayStatements,setShowAllPayStatements]=useState(false)
  const [proLeagueView, setProLeagueView] = useState<'fixtures' | 'table' | 'international' | 'world'>('fixtures')
  useEffect(() => {
    if (tab === 'table') setProLeagueView('table')
    else if (tab === 'fixtures') setProLeagueView('fixtures')
  }, [tab])
  const windowOpen = pro.freeAgentSinceWeek !== undefined || (pro.date ? registrationOpen(pro.associationId ?? 'eng', pro.date) : false)
  const championshipCycle = internationalCycle(pro.season)
  const championship = player.nationality && pro.international
    ? internationalProgress(player.nationality, championshipCycle, pro.international.fixtures) : null
  const nationRankings = useMemo(() => seniorWorldNationRankings(pro.season,pro.week,pro.international?.fixtures ?? []),
    [pro.season, pro.week, pro.international?.fixtures])
  const nationRank = nationRankings.find(row=>row.nationId===player.nationality)
  const regionalNations = player.nationality ? continentalNationsProgress(player.nationality,
    pro.season,pro.week,pro.international?.fixtures ?? []) : null
  const qualifierTable = player.nationality ? visibleQualifyingTable(player.nationality,
    pro.season, pro.week, pro.international?.fixtures ?? []) : []
  const moneySymbol = ({ eng: 'GBP', sco: 'GBP', esp: 'EUR', ger: 'EUR', fra: 'EUR', ita: 'EUR', ned: 'EUR', por: 'EUR', bra: 'BRL', rsa: 'ZAR' } as Record<string, string>)[pro.associationId ?? 'eng'] ?? 'GBP'
  const offerName = (id: string, teamId: string) => division.teams.find(team => team.id === teamId)?.name ?? pro.backgroundWorld?.clubs[id]?.name ?? id
  const cards = (title: string, body: React.ReactNode) => <Panel title={title}>{body}</Panel>
  const stat = (label: string, value: string | number) => <div className="flex justify-between border-b border-ks-border/40 py-2 text-sm"><span className="text-ks-muted">{label}</span><strong className="text-ks-ink">{value}</strong></div>
  const header = <section className="career-hero"><div className="career-hero-glow"/><div className="career-hero-top"><span>KICKOFF STAR · PROFESSIONAL</span><b>SEASON {pro.season} · WEEK {pro.week}</b></div><div className="career-player"><Avatar id={player.avatarId ?? 0} size={62} className="career-avatar"/><div className="min-w-0"><small>{club.name.toUpperCase()} · {player.position}</small><h1>{player.name}</h1><p>AGE {player.careerClock.ageYears} · {player.squadRole === 'starting-xi' ? 'STARTING XI' : 'FIRST TEAM SQUAD'}</p></div><div className="career-ovr"><strong>{toOvr(computeCurrentAbility(player))}</strong><span>OVR</span></div></div><div className="career-hero-strip"><div><span>ENERGY</span><b>{Math.round(player.fitness.stamina)}%</b></div><div><span>FORM</span><b>{player.matchRatings.length ? (player.matchRatings.slice(-5).reduce((a,b) => a+b,0) / Math.min(5, player.matchRatings.length)).toFixed(1) : '—'}</b></div><div><span>LEAGUE</span><b>{table.findIndex(r => r.teamId === club.id) + 1}/{table.length}</b></div></div></section>
  return <div className="flex flex-col gap-2.5 stagger-children">
    {tab === 'home' ? <>
      {header}
      <nav aria-label="Home sections" className="grid grid-cols-3 gap-1 rounded-xl border border-ks-border p-1 bg-[#0f120e]">
        {(['overview','schedule','updates'] as const).map(view=><button key={view} onClick={()=>setHomeView(view)} aria-current={homeView===view?'page':undefined} className={`rounded-lg min-h-11 py-2.5 text-[11px] font-display uppercase transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ks-gold ${homeView===view?'bg-ks-gold text-ks-black':'text-ks-muted'}`}>{view}</button>)}
      </nav>
      {homeView==='overview' && <>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={()=>setHomeView('schedule')} className="rounded-xl border border-ks-gold/30 bg-[#17190f] p-3 text-left"><span className="block text-[10px] text-ks-gold font-display">TODAY</span><span className="block text-ks-ink text-sm mt-2">{proTrainingAvailable(pro.day??0,proMatchDay(pro,matchKind??'league',matchDate))?'Training session':'Match preparation'}</span><span className="block text-[10px] text-ks-muted mt-1">View schedule →</span></button>
          <button onClick={()=>onGoTo('club')} className="rounded-xl border border-ks-border bg-[#111710] p-3 text-left"><span className="block text-[10px] text-ks-gold font-display">YOUR CONTRACT</span><span className="block text-ks-ink text-sm mt-2">£{(player.contract?.terms.weeklyWage??0).toLocaleString()}/wk</span><span className="block text-[10px] text-ks-muted mt-1">Club & transfers →</span></button>
          <button onClick={()=>onGoTo('fixtures')} className="rounded-xl border border-ks-border bg-[#111710] p-3 text-left"><span className="block text-[10px] text-ks-gold font-display">LEAGUE POSITION</span><span className="block text-ks-ink text-xl mt-1 font-display">#{table.findIndex(r=>r.teamId===club.id)+1}</span><span className="block text-[10px] text-ks-muted mt-1">{row.points} pts · Fixtures →</span></button>
          <button onClick={()=>onGoTo('player')} className="rounded-xl border border-ks-border bg-[#111710] p-3 text-left"><span className="block text-[10px] text-ks-gold font-display">TEAM STATUS</span><span className="block text-ks-ink text-sm mt-2">{player.squadRole==='starting-xi'?'Starting XI':'First team'}</span><span className="block text-[10px] text-ks-muted mt-1">Coach trust {Math.round(player.coachTrust??0)} / 10 →</span></button>
        </div>
        <div className="rounded-xl border border-ks-gold/25 bg-[#151810] p-3 flex justify-between gap-3 items-center"><div className="min-w-0"><div className="text-[10px] text-ks-gold font-display">NEXT MATCH</div><div className="text-sm text-ks-ink mt-1 truncate">{matchOpponent??opponent?.name??nextOpponent?.name??'Awaiting fixture'}</div></div><button onClick={()=>onGoTo('fixtures')} className="text-xs text-ks-gold shrink-0">VIEW →</button></div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onOpenInbox} className="rounded-xl border border-ks-border p-3 text-left text-xs text-ks-ink">✉ INBOX <span className="block text-ks-muted text-[10px] mt-1">{(player.inbox??[]).filter(item=>!item.read).length} unread →</span></button>
          <button onClick={()=>setHomeView('updates')} className="rounded-xl border border-ks-border p-3 text-left text-xs text-ks-ink">THE GAZETTE <span className="block text-ks-muted text-[10px] mt-1">Latest stories →</span></button>
        </div>
      </>}
      {homeView==='schedule' && <>
        <ProWeeklyCalendar pro={pro} opponent={matchOpponent??opponent?.name} matchKind={matchKind??'league'} matchDate={matchDate} onTrain={onTrain}/>
        <div className="grid grid-cols-2 gap-2"><button onClick={onTrain} disabled={!proTrainingAvailable(pro.day??0,proMatchDay(pro,matchKind??'league',matchDate))||(pro.trainedDays??[]).includes(pro.day??0)||!!player.injury?.weeksRemaining||player.fitness.stamina<12} className="rounded-xl bg-ks-gold text-ks-black text-xs font-display p-3 disabled:opacity-40">OPEN TRAINING →</button><button onClick={onOpenEnergy} className="rounded-xl border border-ks-border text-ks-ink text-xs font-display p-3">RECOVERY →</button></div>
      </>}
      {homeView==='updates' && <>
        {cards('LATEST FOOTBALL NEWS',<div><p className="text-ks-ink text-sm">{pro.news?.at(-1)?.headline??'Your professional journey begins'}</p><button onClick={()=>setNewsOpen(true)} className="text-ks-gold text-xs mt-3">OPEN GAZETTE →</button></div>)}
        {pro.clubObjective&&cards('BOARD EXPECTATIONS',<div>{stat('Target',`Finish #${pro.clubObjective.targetPosition} or higher`)}{stat('Confidence',`${pro.clubObjective.boardConfidence}/100`)}</div>)}
        {cards('INTERNATIONAL FOOTBALL',<button onClick={()=>onGoTo('fixtures')} className="text-ks-ink text-sm">{getNation(player.nationality).name} · {pro.international?.caps??0} caps →</button>)}
      </>}
    </> : tab === 'player' || tab === 'scouts' ? <>
      <PlayerTab player={player} onOpenOffers={() => onGoTo('club')} />
      <Section title="SEASON AWARDS & CEREMONIES">
        {(pro.seasonRecords??[]).length?[...(pro.seasonRecords??[])].reverse().slice(0,4).map(record=>
          <div key={record.season} className="rounded-lg bg-[#151710] border border-ks-border/40 p-3 mb-3">
            <div className="font-display text-ks-gold text-xs mb-2">SEASON {record.season} · AWARDS NIGHT</div>
            {worldPlayerAwards(record).map(award=><div key={award.id} className="flex gap-2 text-xs items-center justify-between py-1.5 border-t border-ks-border/30">
              <span className="text-ks-muted max-w-[62%]">{award.title}</span>
              <span className={award.won?'text-ks-gold font-display':'text-ks-ink'}>{award.won?'🏆 YOU':award.recipient}</span>
            </div>)}
          </div>):<p className="text-ks-muted text-xs">The first annual awards ceremony arrives after your first professional season.</p>}
      </Section>
      <Section title="PROFESSIONAL SEASON ARCHIVE">
        {(pro.seasonRecords??[]).length ? [...(pro.seasonRecords??[])].reverse().slice(0,archiveExpanded?undefined:3).map(record=>
          <div key={record.season} className="border-b border-ks-border/40 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-display text-ks-ink">SEASON {record.season} · {record.clubName}</div>
              <span className="text-ks-gold text-xs">#{record.leaguePosition}/{record.clubs}</span>
            </div>
            <div className="grid grid-cols-3 text-center mt-3 rounded-lg bg-[#151710] py-2">
              <div><b className="block text-ks-gold text-lg">{record.appearances}</b><small className="text-[9px] text-ks-muted">APPS</small></div>
              <div><b className="block text-ks-gold text-lg">{record.goals}</b><small className="text-[9px] text-ks-muted">GOALS</small></div>
              <div><b className="block text-ks-gold text-lg">{record.assists}</b><small className="text-[9px] text-ks-muted">ASSISTS</small></div>
            </div>
            {record.leagueChampion && <div className="text-xs text-ks-gold mt-2">🏆 LEAGUE CHAMPIONS</div>}
          </div>) : <p className="text-xs text-ks-muted">Your professional season records will appear here after your first completed campaign.</p>}
        {(pro.seasonRecords??[]).length>3 && <button type="button" onClick={()=>setArchiveExpanded(value=>!value)} aria-expanded={archiveExpanded} className="mt-3 w-full rounded-xl border border-ks-gold/30 bg-[#181c13] px-4 py-3 text-xs font-display text-ks-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ks-gold">{archiveExpanded?'SHOW RECENT SEASONS':'VIEW ALL '+(pro.seasonRecords??[]).length+' SEASONS'} →</button>}
      </Section>
    </> : tab === 'people' ? <>
      <PeopleTab player={player} />
      {cards('YOUR REPRESENTATION', <>{stat('Agent', getAgent(player.agentId)?.name ?? 'Unrepresented')}{stat('Coach trust', `${Math.round(player.coachTrust ?? 0)} / 10`)}</>)}
      {cards('PRO DRESSING ROOM', <div className="flex flex-col gap-2">{club.notablePlayers.map(person => <div key={person.name} className="flex justify-between text-sm text-ks-ink"><span>{person.name}</span><span className="text-ks-muted">{person.position}</span></div>)}</div>)}
    </> : tab === 'club' ? <>
      <ClubTab player={player} playerTeam={club} division={division} isAcademy={false} isPro />
      <button type="button" onClick={()=>setClubDetailsExpanded(value=>!value)} aria-expanded={clubDetailsExpanded} className="w-full rounded-xl border border-ks-gold/30 bg-[#181c13] px-4 py-3 text-left text-xs font-display text-ks-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ks-gold">{clubDetailsExpanded?'HIDE CLUB OPERATIONS':'CLUB OPERATIONS · CONTRACTS & TRANSFERS'} →</button>
      {clubDetailsExpanded && <>
      {pro.clubObjective && cards('BOARD EXPECTATIONS', <div>
        {stat('Objective', ({ title: 'Fight for the title', continental: 'Qualify near the top', 'top-half': 'Finish in the top half', survival: 'Avoid relegation' } as Record<string,string>)[pro.clubObjective.type])}
        {stat('Target position', `#${pro.clubObjective.targetPosition} or better`)}
        {stat('Board confidence', `${pro.clubObjective.boardConfidence}/100`)}
        {stat('Current standing', `#${table.findIndex(item => item.teamId === club.id) + 1}`)}
        <p className="text-xs text-ks-muted mt-2">Expectations reset when you join a new club or your division changes.</p>
      </div>)}
      {pro.freeAgentSinceWeek !== undefined && cards('FREE AGENT', <div><p className="text-ks-gold font-display text-lg">YOUR CONTRACT HAS ENDED</p><p className="text-ks-muted text-xs mt-2">You are unattached. You will not play club matches or receive wages until you sign for a new team. Ask your agent for opportunities from the ten supported countries.</p>{stat('Unattached since', `Week ${pro.freeAgentSinceWeek}`)}</div>)}
      {cards('YOUR CONTRACT', <>{stat('Country', (pro.associationId ?? 'eng').toUpperCase())}{stat('Division', pro.activeCompetitionId ? proCompetitionName(pro.activeCompetitionId) : 'Professional League')}{stat('Contract status', pro.freeAgentSinceWeek !== undefined ? 'Free agent' : player.contract?.clubName ?? club.name)}{stat('Gross weekly wage', `${moneySymbol}${(player.contract?.terms.weeklyWage ?? 0).toLocaleString()}`)}{stat('Appearance fee', `${moneySymbol}${player.contract?.terms.appearanceFee ?? 0}`)}{stat('Goal bonus', `${moneySymbol}${player.contract?.terms.goalBonus ?? 0}`)}{stat('Contract end', `Week ${player.contract?.expiresWeek ?? '—'}`)}{stat('Squad role', player.squadRole ?? 'First team squad')}{pro.loan && <p className="text-ks-gold text-xs mt-3">On loan at {club.name}. Your parent club retains your contract until the end of the season.</p>}</>)}
      {player.contract && pro.freeAgentSinceWeek === undefined && cards('CONTRACT RENEWAL', <div>
        {stat('Weeks remaining', Math.max(0, player.contract.expiresWeek - (player.totalWeeksElapsed ?? 0)))}
        {stat('Board confidence', pro.clubObjective?.boardConfidence ?? 60)}
        <p className="text-xs text-ks-muted mt-2">Extensions are considered in the final 26 weeks of a deal. Club finances and board confidence determine the offer.</p>
        <button className="mt-3 text-ks-gold text-xs disabled:opacity-35"
          disabled={player.contract.expiresWeek - (player.totalWeeksElapsed ?? 0) > 26 ||
            player.contract.expiresWeek <= (player.totalWeeksElapsed ?? 0) ||
            (pro.clubObjective?.boardConfidence ?? 60) < 30 || !!pro.loan ||
            pro.lastRenewalWeek === player.totalWeeksElapsed}
          onClick={() => requestRenewal()}>REQUEST TWO-YEAR EXTENSION →</button>
      </div>)}
      {cards('TRANSFER DESK', <div><p className="text-ks-muted text-xs mb-3">Talks take two weeks. Club budgets and the registration window control which moves can happen.</p>{stat('Registration', pro.freeAgentSinceWeek !== undefined ? 'Free-agent signing' : windowOpen ? 'Open' : 'Closed')}
        {pro.talks ? <div className="mt-3 text-ks-ink text-sm"><b>{offerName(pro.talks.offer.worldClubId, pro.talks.offer.teamId)}</b><p className="text-ks-muted text-xs mt-1">{moneySymbol}{pro.talks.offer.weeklyWage.toLocaleString()}/week · {pro.talks.readyWeek > player.totalWeeksElapsed ? `${pro.talks.readyWeek - player.totalWeeksElapsed} week(s) to terms` : 'terms ready to sign'}</p><div className="flex gap-3 mt-3"><button disabled={pro.talks.readyWeek > player.totalWeeksElapsed} onClick={() => signMove()} className="text-ks-gold text-xs disabled:opacity-35">SIGN DEAL →</button><button disabled={pro.talks.readyWeek > player.totalWeeksElapsed || pro.talks.countered} onClick={counterTalks} className="text-ks-muted text-xs disabled:opacity-35">ASK FOR 5% MORE</button></div></div> : <><button disabled={!windowOpen || !!pro.loan} onClick={requestOffers} className="text-ks-gold text-xs mt-3 disabled:opacity-35">ASK AGENT FOR OFFERS →</button>{pro.marketOffers?.map(offer => <button key={offer.teamId} onClick={() => openTalks(offer.teamId)} className="block w-full text-left border-t border-ks-border/50 py-3 text-xs text-ks-ink">{offerName(offer.worldClubId, offer.teamId)}<span className="float-right text-ks-gold">{moneySymbol}{offer.weeklyWage.toLocaleString()}/wk →</span></button>)}</>}
        {windowOpen && pro.freeAgentSinceWeek === undefined && !pro.loan && player.squadRole !== 'starting-xi' && <div className="border-t border-ks-border mt-4 pt-3"><p className="text-ks-muted text-xs">Need senior minutes? A temporary loan keeps your parent contract.</p>{division.teams.filter(team => team.id !== club.id).slice(0, 2).map(team => <button key={team.id} onClick={() => acceptLoan(team.id)} className="block text-ks-gold text-xs mt-2">REQUEST LOAN · {team.name} →</button>)}</div>}
      </div>)}
      </>}
    </> : tab === 'fixtures' || tab === 'table' ? <>
      <nav className="flex gap-1 p-1 rounded-xl border border-ks-border bg-[#0f0d0d]" aria-label="Professional competition views">
        {(['fixtures','table','international','world'] as const).map(view =>
          <button key={view} onClick={() => setProLeagueView(view)} aria-current={proLeagueView===view?'page':undefined}
            className={`flex-1 min-h-11 py-3 rounded-lg font-display text-[10px] uppercase tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ks-gold ${proLeagueView===view?'bg-ks-gold text-ks-black':'text-ks-muted'}`}>{view}</button>)}
      </nav>
      <section className="table-hero"><small>PROFESSIONAL FOOTBALL · COMPETITION CENTRE</small>
        <h1>{pro.activeCompetitionId ? proCompetitionName(pro.activeCompetitionId) : 'Professional League'}</h1>
        <div className="table-story"><div><span>YOUR POSITION</span><b>{table.findIndex(r => r.teamId === club.id)+1}</b></div>
          <div><span>POINTS</span><b>{row.points}</b></div><div><span>LEADER</span><strong>{table[0]?.teamName??'—'}</strong></div>
          <div><span>GAP</span><b>{Math.max(0,(table[0]?.points??0)-row.points)}</b></div></div>
      </section>
      {proLeagueView==='table' && <>
        <StandingsTable division={division} playerTeamId={club.id} hideZones />
        <Section title="LEAGUE HISTORY · RECORDS TO BREAK">
          {proLeagueRecords(pro.associationId??'eng',pro.activeCompetitionId??`top-${pro.associationId??'eng'}`,
            pro.seasonRecords??[],pro).map(record=><div key={record.kind} className="py-2 border-b border-ks-border/40">
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-ks-ink">{record.kind==='career-goals'?'Career league goals':record.kind==='season-goals'?'Most league goals in a season':'Most league assists in a season'}</span>
                <b className={record.broken?'text-green-400':'text-ks-gold'}>{record.current} / {record.mark}</b>
              </div>
              <p className="text-[10px] text-ks-muted mt-1">Historical benchmark: {record.holder} {record.broken?'· NEW RECORD!':''}</p>
              <div className="w-full bg-white/10 rounded-full h-1.5 mt-2 overflow-hidden"><span className="block bg-ks-gold h-full" style={{width:`${Math.min(100,record.current/record.mark*100)}%`}}/></div>
            </div>)}
          <p className="text-[10px] text-ks-muted mt-2">Fictional historic football legends and records for your playable division. Domestic league goals and assists only.</p>
        </Section>
        <Section title="Your professional season">
          {stat('League record', `${row.won}W · ${row.drawn}D · ${row.lost}L`)}
          {stat('Goal difference', row.goalsFor-row.goalsAgainst)}
          {stat('Season goals', player.seasonGoals??0)}
          {stat('Season assists', player.seasonAssists??0)}
        </Section>
      </>}
      {proLeagueView==='fixtures' && <div className="rounded-xl border border-ks-border overflow-hidden bg-[#10110e]">
        <div className="px-4 py-3 border-b border-ks-gold/20 font-display text-xs tracking-widest text-ks-gold">YOUR MATCH CALENDAR</div>
        <div className="grid grid-cols-2 gap-1 p-2">{(['upcoming','results'] as const).map(filter=><button key={filter} onClick={()=>{setFixtureFilter(filter);setFixtureLimit(8)}} className={`rounded-lg py-2.5 text-[11px] font-display uppercase ${fixtureFilter===filter?'bg-ks-gold text-ks-black':'bg-white/5 text-ks-muted'}`}>{filter}</button>)}</div>
        <div className="flex gap-2 px-3 pb-2"><button type="button" onClick={()=>setCompetitionFilter('all')} className={`rounded-md px-3 py-2 text-xs ${competitionFilter==='all'?'bg-ks-gold text-ks-black':'bg-white/5 text-ks-muted'}`}>ALL AVAILABLE</button><button type="button" onClick={()=>setCompetitionFilter('league')} className={`rounded-md px-3 py-2 text-xs ${competitionFilter==='league'?'bg-ks-gold text-ks-black':'bg-white/5 text-ks-muted'}`}>LEAGUE</button></div>
        <p className="px-3 pb-2 text-[10px] text-ks-muted">League schedule shown below. Cup, continental and friendly fixtures appear in the weekly schedule when generated; they are not yet included in this season-long list.</p>
        {division.fixtures.filter(f=>(f.homeTeamId===club.id||f.awayTeamId===club.id)&&(fixtureFilter==='results'?f.played:!f.played)).sort((a,b)=>fixtureFilter==='results'?b.week-a.week:a.week-b.week).slice(0,fixtureLimit).map(f=>{
          const isHome=f.homeTeamId===club.id
          const other=division.teams.find(t=>t.id===(isHome?f.awayTeamId:f.homeTeamId))
          const score=f.played && f.homeGoals!==null&&f.awayGoals!==null
            ? `${isHome?f.homeGoals:f.awayGoals}–${isHome?f.awayGoals:f.homeGoals}` : 'UPCOMING'
          return <div key={f.id} className="flex items-center gap-3 px-3 py-3 border-b border-ks-border/30 last:border-0">
            {other && <TeamCrest primary={other.primaryColor} secondary={other.secondaryColor} short={other.short} size="sm"/>}
            <div className="min-w-0 flex-1"><div className="text-ks-ink text-xs truncate">{other?.name??'Opponent'}</div>
              <div className="text-ks-muted text-[10px]">ROUND {f.week} · {isHome?'HOME':'AWAY'}</div></div>
            <span className={`text-xs font-display ${f.played?'text-ks-ink':'text-ks-gold'}`}>{score}</span>
          </div>
        })}
        {division.fixtures.filter(f=>(f.homeTeamId===club.id||f.awayTeamId===club.id)&&(fixtureFilter==='results'?f.played:!f.played)).length>fixtureLimit&&<button onClick={()=>setFixtureLimit(n=>n+8)} className="w-full py-3 text-xs font-display text-ks-gold border-t border-ks-border/40">SHOW 8 MORE MATCHES ↓</button>}
      </div>}
      {proLeagueView==='international' && <Section title="SENIOR NATIONAL TEAM · COMPETITIONS" defaultOpen>
      <div>
        {stat('Nation', getNation(player.nationality).name)}
        {stat('International caps', pro.international?.caps ?? 0)}
        {stat('International goals', pro.international?.goals ?? 0)}
        {stat('International assists', pro.international?.assists ?? 0)}
        {nationRank && stat('International ranking', `#${nationRank.place}/${nationRankings.length}`)}
        {nationRank && stat('Ranking movement', `${nationRank.change>=0 ? '+' : ''}${nationRank.change.toFixed(1)} pts`)}
        <p className="text-xs text-ks-muted mt-2">Fictional rankings track simulated national results and your actual internationals; they are not official FIFA rankings.</p>
        {regionalNations && <div className="mt-3 border-t border-ks-border pt-3">
          <p className="font-display text-xs text-ks-gold mb-2">{regionalNations.name.toUpperCase()}</p>
          <p className="text-xs text-ks-muted mb-2">Two-season regional competition · {regionalNations.participants.length} countries</p>
          {regionalNations.championId && stat('Champion', getNation(regionalNations.championId).name)}
          <div className="max-h-36 overflow-y-auto">{regionalNations.table.map((row,index)=>
            <div key={row.nationId} className="flex justify-between text-xs border-b border-ks-border/30 py-1">
              <span>{index+1}. {getNation(row.nationId).name}</span>
              <span className="text-ks-muted">{row.played} PL · {row.points} PTS</span>
            </div>)}</div>
        </div>}
        {pro.international?.pending?.squad && <div className="mt-3 rounded-lg border border-ks-border p-3">
          <p className="font-display text-xs text-ks-gold">NATIONAL TEAM SQUAD · 23 PLAYERS</p>
          <p className="text-ks-muted text-xs mt-1">Selected: {pro.international.pending.squad.playerSelected ? 'YES' : 'NO'} · Captain: {pro.international.pending.squad.members.find(member=>member.id===pro.international?.pending?.squad?.captainId)?.name ?? '—'}</p>
          <div className="max-h-40 overflow-y-auto mt-2">{pro.international.pending.squad.members.map(member=>
            <div key={member.id} className={`text-xs flex justify-between border-t border-ks-border/30 py-1 ${member.source==='career' ? 'text-ks-gold' : 'text-ks-muted'}`}>
              <span>{member.position} · {member.name}</span><span>{member.overall} OVR</span>
            </div>)}</div>
        </div>}
        {championship && <div className="mt-3 border-t border-ks-border pt-3">
          <p className="font-display text-xs text-ks-gold mb-2">INTERNATIONAL CHAMPIONSHIP · CYCLE {championship.cycle}</p>
          {stat('Qualifying group', qualifierTable.map(r => getNation(r.nationId).short).join(' · '))}
          {pro.season - championshipCycle >= 2 && stat('Qualified for finals', championship.qualified ? 'YES' : 'NO')}
          {pro.season - championshipCycle >= 2 && championship.finalsGroup && stat('Finals group', championship.finalsGroup.map(r => getNation(r.nationId).short).join(' · '))}
          {pro.season - championshipCycle === 3 && pro.week > 25 &&
            stat('Champion', getNation(championship.championId).name)}
          <div className="mt-2">{qualifierTable.map((r, index) =>
            <div key={r.nationId} className="flex justify-between text-xs py-1 border-b border-ks-border/40">
              <span>{index + 1}. {getNation(r.nationId).name}</span>
              <span className="text-ks-muted">{r.points} pts · {r.goalsFor - r.goalsAgainst >= 0 ? '+' : ''}{r.goalsFor - r.goalsAgainst}</span>
            </div>)}</div>
        </div>}
        {pro.international?.pending ? <p className="text-ks-gold text-xs mt-2">CALLED UP · {pro.international.pending.competition.toUpperCase()} AGAINST {getNation(pro.international.pending.opponentId).name.toUpperCase()} · PLAY YOUR INTERNATIONAL MATCH</p>
          : <p className="text-ks-muted text-xs mt-2">Senior selection depends on your current performances, reputation and previous international experience.</p>}
      </div>
      </Section>}
      {proLeagueView==='world' && pro.backgroundWorld && <ProWorldPanel world={pro.backgroundWorld}/>}
    </> : tab === 'lifestyle' ? <ProLifestyleTab player={player}/> : <>
      <nav aria-label="Professional shop sections" className="grid grid-cols-3 gap-1 p-1 rounded-xl border border-ks-border bg-[#10120e]">
        {(['sponsors','essentials','finances'] as const).map(view=><button key={view} onClick={()=>setShopView(view)} aria-current={shopView===view?'page':undefined} className={`rounded-lg min-h-11 py-2.5 text-[10px] font-display uppercase transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ks-gold ${shopView===view?'bg-ks-gold text-ks-black':'text-ks-muted'}`}>{view}</button>)}
      </nav>
      {shopView==='sponsors'&&<ProSponsorshipTab player={player}/>}
      {shopView==='essentials'&&<ShopTab player={player}/>}
      {shopView==='finances'&&<Section title="PROFESSIONAL PAY & RESIDENCE">
        {cards('FINANCIAL OVERVIEW',<>
          <div className="rounded-xl border border-ks-gold/30 bg-gradient-to-r from-[#242919] to-[#10140e] p-4 mb-3">
            <p className="text-[10px] font-display uppercase tracking-widest text-ks-muted">Available balance · {moneySymbol}</p>
            <p className="text-2xl font-display text-ks-gold tabular-nums mt-1">{(player.money??0).toLocaleString()}</p>
            <p className="text-[11px] text-ks-muted mt-2">Your current spendable funds, before future wages and bills.</p>
          </div>
          {stat('Career earnings',`${moneySymbol} ${(player.careerEarnings??0).toLocaleString()}`)}
          {stat('Weekly wage',`${moneySymbol} ${(player.contract?.terms.weeklyWage??0).toLocaleString()}`)}
          {stat('Pending bonuses',`${moneySymbol} ${(pro.pendingBonus??0).toLocaleString()}`)}
        </>)}
        {cards('RESIDENCE',<>{stat('City',pro.residence?.city??'Settling in')}{stat('Monthly rent',`${moneySymbol} ${(pro.residence?.monthlyRent??0).toLocaleString()}`)}</>)}
        {cards('PAY STATEMENTS',<div>
          {[...(pro.payStatements??[])].reverse().slice(0,showAllPayStatements?undefined:6).map(statement=><div key={statement.month} className="flex items-center justify-between gap-3 py-2.5 border-b border-ks-border/60 text-xs"><span className="text-ks-muted">{statement.month}</span><span className="font-display text-ks-ink tabular-nums">NET {moneySymbol} {statement.net.toLocaleString()}</span></div>)}
          {!pro.payStatements?.length&&<p className="text-xs text-ks-muted">First statement arrives at month end.</p>}
          {(pro.payStatements??[]).length>6&&<button type="button" onClick={()=>setShowAllPayStatements(value=>!value)} aria-expanded={showAllPayStatements} className="mt-3 w-full min-h-11 rounded-lg border border-ks-gold/30 bg-[#181c13] text-xs font-display text-ks-gold">{showAllPayStatements?'SHOW RECENT PAYMENTS':'VIEW ALL '+(pro.payStatements??[]).length+' STATEMENTS'} →</button>}
        </div>)}
      </Section>}
    </>}
    {newsOpen && <ProNewsScreen articles={pro.news ?? []} onClose={() => setNewsOpen(false)} />}
  </div>
}
