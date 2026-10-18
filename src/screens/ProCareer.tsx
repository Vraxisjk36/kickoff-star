import { useEffect, useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import { proFixture, professionalSeasonWeeks, PRO_CAREER_DESTINATIONS } from '../engine/proCareer'
import { playerForMatch } from '../engine/selection'
import type { HubTab } from '../components/navItems'
import WeeklyHub from './WeeklyHub'
import MatchDayScreen from './MatchDayScreen'
import MatchScreen from './MatchScreen'
import MatchSummary from './MatchSummary'
import { sfx } from '../engine/audio'
import { pendingProCup, cupLabel } from '../engine/proIntegration'
import { generateTeam } from '../engine/teams'
import { proCompetitionName } from '../engine/proTournaments'

type Result = Parameters<NonNullable<React.ComponentProps<typeof MatchScreen>['onComplete']>>[0]

export default function ProCareer({ onExitToMenu }: { onExitToMenu: () => void }) {
  const player = useCareerStore(s => s.player)
  const advance = useCareerStore(s => s.advanceProCareer)
  const complete = useCareerStore(s => s.completeProMatch)
  const completeCup = useCareerStore(s => s.completeProCupMatch)
  const ensureLivingWorld = useCareerStore(s => s.ensureLivingWorld)
  const [tab, setTab] = useState<HubTab>('home')
  const [mode, setMode] = useState<'hub' | 'matchday' | 'match' | 'summary'>('hub')
  const [autoResolve, setAutoResolve] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  useEffect(() => { ensureLivingWorld() }, [ensureLivingWorld])
  if (!player?.proCareer) return null
  const pro = player.proCareer
  const world = pro.world
  const division = world.divisions[1]
  const team = division.teams.find(t => t.id === world.playerTeamId)!
  const cup = pendingProCup(pro)
  const fixture = proFixture(pro)
  const home = cup ? cup.homeId === pro.clubWorldIds?.[world.playerTeamId] : fixture?.homeTeamId === world.playerTeamId
  const cupOpponentId = cup ? home ? cup.awayId : cup.homeId : null
  const cupClub = cupOpponentId ? pro.backgroundWorld?.clubs[cupOpponentId] : null
  const opponent = cupClub ? { ...generateTeam(Math.max(3, Math.min(8, Math.round(cupClub.reputation / 12)))),
    id: cupClub.id, name: cupClub.name, short: cupClub.name.split(' ').map(word => word[0]).join('').slice(0, 3).toUpperCase() }
    : division.teams.find(t => t.id === (home ? fixture?.awayTeamId : fixture?.homeTeamId))
  const matchReady = !!cup || !!fixture && pro.resolvedWeek !== pro.week
  const destination = PRO_CAREER_DESTINATIONS.find(item => item.id === (pro.associationId ?? 'eng'))
  const label = cup ? cupLabel(cup) : pro.activeCompetitionId
    ? proCompetitionName(pro.activeCompetitionId) : `${destination?.name ?? 'Professional'} Premier Division`
  // WeeklyHub's familiar frame owns the six destinations; professional content
  // replaces only the inner panels. The school calendar is never advanced here.
  const calendar = { currentWeek: { weekNumber: pro.week, seasonYear: pro.season, events: [] }, history: [] } as NonNullable<ReturnType<typeof useCareerStore.getState>['calendar']>
  const selected = playerForMatch(player, 'proLeague')
  if (mode === 'matchday' && matchReady && opponent) return <MatchDayScreen player={selected} playerTeam={team} opponent={opponent} isHome={home} competitionId={cup?.competitionId ?? 'proLeague'} competitionLabel={label} matchKey={`${player.id}:${pro.season}:${pro.week}:${cup?.id ?? fixture?.id}`} onSitOut={() => { advance(); setMode('hub') }} onKickOff={() => { sfx.whistle(); setMode('match') }} />
  if (mode === 'match' && matchReady && opponent) return <MatchScreen player={selected} playerTeam={team} opponent={opponent} playerIsHome={home} autoResolve={autoResolve} onToggleAutoResolve={() => setAutoResolve(v => !v)} onComplete={r => { setResult(r); setMode('summary') }} />
  if (mode === 'summary' && result && matchReady && opponent) return <MatchSummary rating={result.rating} goals={result.goals} assists={result.assists} won={result.won} drew={result.drew} injury={result.injury} wasSubbed={result.wasSubbed} redCarded={result.redCarded} playerStats={result.playerStats} ratingBreakdown={result.ratingBreakdown} minutesPlayed={result.minutesPlayed} yellowCards={result.yellowCards} onDone={() => {
    const outcome = { opponent, home, scored: result.playerScore, conceded: result.opponentScore, goals: result.goals, assists: result.assists, rating: result.rating, energy: result.finalMatchStamina, minutes: result.minutesPlayed, yellowCards: result.yellowCards, redCarded: result.redCarded, injury: result.injury }
    if (cup) completeCup(cup.id, outcome)
    else complete(outcome)
    setResult(null); setMode('hub')
  }} />
  return <div className="relative">
    <WeeklyHub tab={tab} onTabChange={setTab} onOpenOffers={() => setTab('club')} onExitToMenu={onExitToMenu} league={world} academyLeague={null} playerTeam={team} playerDivision={division} proCalendar={calendar} />
    <div className="career-continue fixed left-0 right-0 px-3 max-w-md mx-auto z-20" style={{ bottom: 'calc(var(--safe-bottom) + 4.5rem)' }}>
      <button className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm shadow-[0_0_25px_rgba(212,175,55,0.3)]" onClick={() => matchReady && !player.injury && !(player.suspensionMatches ?? 0) && player.fitness.stamina >= 30 ? setMode('matchday') : advance()}>
        {matchReady ? player.injury ? `injured — sit out ${opponent?.name ?? 'fixture'} →` : (player.suspensionMatches ?? 0) ? `suspended — sit out ${opponent?.name ?? 'fixture'} →` : player.fitness.stamina < 30 ? `unavailable — sit out ${opponent?.name ?? 'fixture'} →` : `${cup ? label : 'matchday'} — ${opponent?.name ?? 'opponent'} →` : `continue — week ${pro.week + 1 > professionalSeasonWeeks(pro) ? '1, new season' : pro.week + 1} →`}
      </button>
    </div>
  </div>
}
