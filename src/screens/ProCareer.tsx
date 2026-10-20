import { useEffect, useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import { proFixture, PRO_CAREER_DESTINATIONS } from '../engine/proCareer'
import { playerForMatch } from '../engine/selection'
import type { HubTab } from '../components/navItems'
import WeeklyHub from './WeeklyHub'
import MatchDayScreen from './MatchDayScreen'
import MatchScreen from './MatchScreen'
import MatchSummary from './MatchSummary'
import { sfx } from '../engine/audio'
import { pendingProCup, cupLabel } from '../engine/proIntegration'
import { generateTeam, teamOverall } from '../engine/teams'
import { proCompetitionName } from '../engine/proTournaments'
import { getNation } from '../engine/nations'
import { calibrateSeniorTeam, seniorNationalTeamRating } from '../engine/proRatings'
import { proMatchDay, proTrainingAvailable, PRO_WEEKDAYS } from '../engine/proWeeklySchedule'
import TrainingScreen from './TrainingScreen'
import AllocationScreen from '../components/AllocationScreen'
import type { TrainingOutcome } from '../engine/training'
import type { AttributeKey } from '../engine/xp'
import ProSeasonCeremony from './ProSeasonCeremony'

type Result = Parameters<NonNullable<React.ComponentProps<typeof MatchScreen>['onComplete']>>[0]

export default function ProCareer({ onExitToMenu }: { onExitToMenu: () => void }) {
  const player = useCareerStore(s => s.player)
  const advance = useCareerStore(s => s.advanceProCareer)
  const complete = useCareerStore(s => s.completeProMatch)
  const sitOutProMatch = useCareerStore(s => s.sitOutProMatch)
  const completeCup = useCareerStore(s => s.completeProCupMatch)
  const completeNational = useCareerStore(s => s.completeSeniorNationalMatch)
  const completeTraining = useCareerStore(s => s.completeProTraining)
  const completePreseason = useCareerStore(s=>s.completeProPreseasonFriendly)
  const acknowledgeCeremony = useCareerStore(s => s.acknowledgeProSeasonCeremony)
  const spendXp = useCareerStore(s => s.spendAttributeXp)
  const ensureLivingWorld = useCareerStore(s => s.ensureLivingWorld)
  const [tab, setTab] = useState<HubTab>('home')
  const [mode, setMode] = useState<'hub' | 'matchday' | 'match' | 'summary' | 'training' | 'xp'>('hub')
  const [trainingReward, setTrainingReward] = useState<{xp:number;attrs:AttributeKey[]}|null>(null)
  const [autoResolve, setAutoResolve] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  useEffect(() => { ensureLivingWorld() }, [ensureLivingWorld])
  if (!player?.proCareer) return null
  const pro = player.proCareer
  const world = pro.world
  const division = world.divisions[1]
  const team = division.teams.find(t => t.id === world.playerTeamId)!
  const preseason = (pro.week===2 || pro.week===3) && !(pro.preseasonPlayedWeeks??[]).includes(pro.week)
  const warmupOpponent=preseason ? division.teams.filter(club=>club.id!==team.id)[(pro.week-2)%Math.max(1,division.teams.length-1)] : undefined
  const national = pro.international?.pending
  const cup = national ? null : pro.freeAgentSinceWeek === undefined ? pendingProCup(pro) : null
  const fixture = national ? undefined : proFixture(pro)
  const home = national ? national.home : cup ? cup.homeId === pro.clubWorldIds?.[world.playerTeamId] : preseason ? pro.week===2 : fixture?.homeTeamId === world.playerTeamId
  const cupOpponentId = cup ? home ? cup.awayId : cup.homeId : null
  const cupClub = cupOpponentId ? pro.backgroundWorld?.clubs[cupOpponentId] : null
  const nationalOpponent = national ? getNation(national.opponentId) : null
  const opponent = nationalOpponent ? { ...calibrateSeniorTeam(generateTeam(nationalOpponent.strength),seniorNationalTeamRating(nationalOpponent.id)),
    id: nationalOpponent.id, name: nationalOpponent.name, short: nationalOpponent.short } : cupClub ? { ...generateTeam(Math.max(3, Math.min(8, Math.round(cupClub.reputation / 12)))),
    id: cupClub.id, name: cupClub.name, short: cupClub.name.split(' ').map(word => word[0]).join('').slice(0, 3).toUpperCase() }
    : warmupOpponent ?? division.teams.find(t => t.id === (home ? fixture?.awayTeamId : fixture?.homeTeamId))
  const matchReady = !!national || (pro.freeAgentSinceWeek === undefined && (!!preseason || !!cup || (!!fixture && pro.resolvedWeek !== pro.week)))
  const destination = PRO_CAREER_DESTINATIONS.find(item => item.id === (pro.associationId ?? 'eng'))
  const internationalLabel = ({ qualifier: 'Championship Qualifier', 'finals-group': 'Championship Finals · Group Stage', continental: 'Regional Nations Series', semifinal: 'Championship Semifinal', final: 'International Championship Final', 'third-place': 'Championship Third Place', friendly: 'International Friendly' } as Record<string,string>)[national?.competition ?? 'friendly']
  const label = preseason ? 'PRESEASON FRIENDLY · TRAINING CAMP' : national ? `${getNation(national.nationId).name} · ${internationalLabel}` : cup ? cupLabel(cup) : pro.activeCompetitionId
    ? proCompetitionName(pro.activeCompetitionId) : `${destination?.name ?? 'Professional'} Premier Division`
  // WeeklyHub's familiar frame owns the six destinations; professional content
  // replaces only the inner panels. The school calendar is never advanced here.
  const calendar = { currentWeek: { weekNumber: pro.week, seasonYear: pro.season, events: [] }, history: [] } as NonNullable<ReturnType<typeof useCareerStore.getState>['calendar']>
  const selected = { ...playerForMatch(player, 'proLeague'), matchOpponentOverall: opponent ? teamOverall(opponent) : undefined }
  const nationalTeam = national ? { ...calibrateSeniorTeam(generateTeam(getNation(national.nationId).strength),seniorNationalTeamRating(national.nationId)),
    id: national.nationId, name: getNation(national.nationId).name, short: getNation(national.nationId).short } : team
  const activeTeam = national ? nationalTeam : team
  const kind = national ? 'international' as const : cup ? (/final/i.test(cup.id) ? 'final' as const : /champions|europa|continental|conference/i.test(cup.competitionId) ? 'europe' as const : 'domestic-cup' as const) : 'league' as const
  const matchDate = cup?.kickoffDate ??
    (fixture ? pro.backgroundWorld?.fixtures[fixture.id]?.kickoffDate : undefined)
  const matchDay = proMatchDay(pro,kind,matchDate)
  const day = pro.day ?? 0
  const canTrain = proTrainingAvailable(day,matchDay) &&
    !(pro.trainedDays??[]).includes(day) && !player.injury?.weeksRemaining && player.fitness.stamina>=12
  const beginTraining=()=>{if(canTrain)setMode('training')}
  const sitOut=()=>{
    if(preseason)completePreseason(6,player.fitness.stamina,0,0)
    else if(fixture && !national && !cup)sitOutProMatch()
    else if(cup || national)advance()
    setMode('hub')
  }
  if(pro.week===1 && (pro.day??0)===0 && pro.preseasonIntroducedSeason!==pro.season)
    return <ProSeasonCeremony pro={pro} clubName={team.name} kind="preseason"
      onContinue={()=>acknowledgeCeremony('preseason')}/>
  if(pro.week===4 && (pro.day??0)===0 && pro.leagueIntroducedSeason!==pro.season)
    return <ProSeasonCeremony pro={pro} clubName={team.name} kind="kickoff"
      onContinue={()=>acknowledgeCeremony('kickoff')}/>

  if(mode==='training') return <TrainingScreen player={player} onComplete={(outcome:TrainingOutcome,spent,injury,xp,attrs)=>{
    completeTraining(outcome,spent,injury)
    setTrainingReward({xp,attrs})
    setMode('xp')
  }}/>
  if(mode==='xp' && trainingReward) return <AllocationScreen
    title="professional training complete" subtitle="spend XP on the skills you trained"
    totalXp={trainingReward.xp} attrs={trainingReward.attrs}
    values={player.attributes.values as Record<string,number>} potential={player.potential}
    onSpend={(attr,amount)=>spendXp(attr,amount)} onDone={()=>{setTrainingReward(null);setMode('hub')}}/>
  if (mode === 'matchday' && matchReady && opponent) return <MatchDayScreen player={selected} playerTeam={activeTeam} opponent={opponent} isHome={home} competitionId={national ? 'seniorInternational' : cup?.competitionId ?? 'proLeague'} competitionLabel={label} matchKey={`${player.id}:${pro.season}:${pro.week}:${national?.id ?? cup?.id ?? fixture?.id ?? 'preseason'}`} onSitOut={sitOut} onKickOff={() => { sfx.whistle(); setMode('match') }} />
  if (mode === 'match' && matchReady && opponent) return <MatchScreen player={selected} playerTeam={activeTeam} opponent={opponent} playerIsHome={home} autoResolve={autoResolve} onToggleAutoResolve={() => setAutoResolve(v => !v)} onComplete={r => { setResult(r); setMode('summary') }} />
  if (mode === 'summary' && result && matchReady && opponent) return <MatchSummary homeTeamName={home?activeTeam.name:opponent.name} awayTeamName={home?opponent.name:activeTeam.name} homeGoals={home?result.playerScore:result.opponentScore} awayGoals={home?result.opponentScore:result.playerScore} rating={result.rating} goals={result.goals} assists={result.assists} won={result.won} drew={result.drew} injury={result.injury} wasSubbed={result.wasSubbed} redCarded={result.redCarded} playerStats={result.playerStats} ratingBreakdown={result.ratingBreakdown} minutesPlayed={result.minutesPlayed} yellowCards={result.yellowCards} onDone={() => {
    const outcome = { opponent, home, scored: result.playerScore, conceded: result.opponentScore, goals: result.goals, assists: result.assists, rating: result.rating, energy: result.finalMatchStamina, minutes: result.minutesPlayed, yellowCards: result.yellowCards, redCarded: result.redCarded, injury: result.injury }
    if (preseason) completePreseason(outcome.rating,outcome.energy,outcome.goals,outcome.assists)
    else if (national) completeNational({scored:outcome.scored, conceded:outcome.conceded, goals:outcome.goals,
      assists:outcome.assists, rating:outcome.rating, minutes:outcome.minutes, energy:outcome.energy})
    else if (cup) completeCup(cup.id, outcome)
    else complete(outcome)
    setResult(null); setMode('hub')
  }} />
  return <div className="relative">
    <WeeklyHub tab={tab} onTabChange={setTab} onOpenOffers={() => setTab('club')} onExitToMenu={onExitToMenu} league={world} academyLeague={null} playerTeam={team} playerDivision={division} proCalendar={calendar} onProTrain={beginTraining} proMatchKind={kind} proMatchOpponent={opponent?.name} proMatchDate={matchDate} />
    <div className="career-continue fixed left-0 right-0 px-3 max-w-md mx-auto z-20" style={{ bottom: 'calc(var(--safe-bottom) + 4.5rem)' }}>
      <button className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm shadow-[0_0_25px_rgba(212,175,55,0.3)]" onClick={() => matchReady && day === matchDay ? (!player.injury && !(player.suspensionMatches ?? 0) && player.fitness.stamina >= 30 ? setMode('matchday') : sitOut()) : advance()}>
        {matchReady && day===matchDay
          ? national ? `INTERNATIONAL · ${getNation(national.opponentId).name} →`
            : player.injury || (player.suspensionMatches??0)>0 || player.fitness.stamina<30 ? 'UNAVAILABLE · SIMULATE MATCH →' : `MATCHDAY · ${opponent?.name??'OPPONENT'} →`
          : `CONTINUE · ${PRO_WEEKDAYS[day]} → ${day<6?PRO_WEEKDAYS[day+1]:'NEXT WEEK'}`}

      </button>
    </div>
  </div>
}
