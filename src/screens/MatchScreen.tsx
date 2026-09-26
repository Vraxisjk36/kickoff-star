import { useState, useRef, useEffect } from 'react'
import type { Player } from '../types/player'
import type { Team } from '../engine/teams'
import type { MatchState, KeyMoment, ChanceTier } from '../engine/match'
import { initMatch, advanceToKeyMoment, resolvePlayerMoment, resolveScenarioBeat, resolveInjuryDecision } from '../engine/match'
import { momentToDecision, miniGameKindForMoment, inferStatTag, type MatchDecisionBundle } from '../engine/matchDecisions'
import { TeamCrest } from '../components/ui'
import LiveMatchPitch, { type PitchAction } from '../components/LiveMatchPitch'
import {
  executionSpecFor, adjustChance, autoResolveGrade, GRADE_LABEL, GRADE_COLOR,
  type ExecutionGrade, type ExecutionSpec,
} from '../engine/execution'
import TimingBar from '../components/TimingBar'
import ShootingMinigame from '../components/ShootingMinigame'
import PassingMinigame from '../components/PassingMinigame'
import DribbleMinigame from '../components/DribbleMinigame'
import TackleMinigame from '../components/TackleMinigame'
import KeeperMinigame from '../components/KeeperMinigame'
import CrossHeaderMinigame from '../components/CrossHeaderMinigame'

type ExecutionComponentProps = { spec: ExecutionSpec; label: string; onResolve: (grade: ExecutionGrade, position: number) => void; tier?: ChanceTier }
function resolveExecutionComponent(bundle: MatchDecisionBundle, optIndex: number): React.ComponentType<ExecutionComponentProps> {
  const attrs = bundle.keyAttributes[optIndex] ?? []
  const label = bundle.decision.options[optIndex]?.label.toLowerCase() ?? ''
  const situation = bundle.decision.situation?.toLowerCase() ?? ''
  const isGkContext = bundle.decision.context === 'gk'

  if (isGkContext && situation.includes('penalty')) return KeeperMinigame
  if (situation.includes('penalty') || situation.includes('free kick') || situation.includes('free-kick')) {
    return situation.includes('wide') || situation.includes('flank') ? CrossHeaderMinigame : ShootingMinigame
  }
  if (label.includes('cross') || label.includes('header') || label.includes('whip')) return CrossHeaderMinigame
  if (attrs.includes('reflexes') || attrs.includes('gkPositioning') || attrs.includes('handling') || attrs.includes('distribution')) return KeeperMinigame
  if (attrs.includes('tackling')) return TackleMinigame
  if (attrs.includes('dribbling')) return DribbleMinigame
  if (attrs.includes('shooting')) return ShootingMinigame
  if (attrs.includes('positioning') && (attrs.includes('concentration') || attrs.includes('strength') || attrs.includes('pace'))) return TackleMinigame
  if (attrs.includes('passing') || attrs.includes('vision')) return PassingMinigame
  return TimingBar
}

const EXECUTION_GUIDES = {
  shooting: { icon: '◎', title: 'Pick your finish', body: 'A marker sweeps across the goal. Tap when it reaches the green centre zone to make the cleanest contact.', tip: 'Gold is good. Green is perfect. Do not rush the first sweep.' },
  passing: { icon: '↗', title: 'Thread the pass', body: 'Read the moving passing lane, then release the ball when your teammate is open and the route is clear.', tip: 'Wait for the lane to open—accuracy beats speed.' },
  dribbling: { icon: '◇', title: 'Beat your marker', body: 'React to the defender and choose the open route before the space disappears.', tip: 'Watch the defender, not just the ball.' },
  tackling: { icon: '◆', title: 'Time the challenge', body: 'Hold your position and commit when the attacker enters the winning zone.', tip: 'Too early gets beaten; too late gives away the chance.' },
  keeping: { icon: '▣', title: 'Make the save', body: 'Track the shot and tap when your goalkeeper reaches the projected path of the ball.', tip: 'The smallest green zone produces the strongest save.' },
  crossing: { icon: '⌁', title: 'Attack the cross', body: 'Let the delivery arrive, then tap as your player meets the ball in the central contact zone.', tip: 'The header phase starts only after the cross lands.' },
  timing: { icon: '◉', title: 'Execute the action', body: 'Stop the moving marker as close to the green centre as possible.', tip: 'Read one pass of the marker before committing.' },
} as const

function executionGuideFor(bundle: MatchDecisionBundle, optIndex: number) {
  const Component = resolveExecutionComponent(bundle, optIndex)
  if (Component === ShootingMinigame) return EXECUTION_GUIDES.shooting
  if (Component === PassingMinigame) return EXECUTION_GUIDES.passing
  if (Component === DribbleMinigame) return EXECUTION_GUIDES.dribbling
  if (Component === TackleMinigame) return EXECUTION_GUIDES.tackling
  if (Component === KeeperMinigame) return EXECUTION_GUIDES.keeping
  if (Component === CrossHeaderMinigame) return EXECUTION_GUIDES.crossing
  return EXECUTION_GUIDES.timing
}
import TrainingMiniGame from '../components/TrainingMiniGame'
import { gradeFromRatio } from '../engine/xp'
import GoalCelebration, { type CelebrationKind } from '../components/GoalCelebration'
import HalfTimeBreak from '../components/HalfTimeBreak'
import { rand } from '../engine/rng'
import { sfx, isMuted, toggleMuted } from '../engine/audio'
import { syncMusicMute } from '../engine/music'
import { archetypeMomentBonus } from '../engine/archetypes'
import { captainMomentFor, applyCaptainMoment, type CaptainMoment } from '../engine/captainMomentsV32'
import type { RatingBreakdown } from '../engine/ratingSystemV32'
import type { PlayerMatchStats } from '../engine/matchStats'

interface MatchScreenProps {
  player: Player
  playerTeam: Team
  opponent: Team
  playerIsHome: boolean
  autoResolve: boolean
  onToggleAutoResolve: () => void
  onComplete: (result: { rating: number; goals: number; assists: number; won: boolean; drew: boolean; finalMatchStamina: number; injury: { severity: string; weeksOut: number; description: string } | null; wasSubbed: boolean; redCarded: boolean; playerScore: number; opponentScore: number; motm?: { playerWon: boolean; winnerName: string; winnerRating: number; winnerPosition: string }; squad?: import('../engine/squad').SquadPlayer[]; matchStats: { tackle: number; interception: number; header: number; keyPass: number; save: number }; playerStats: PlayerMatchStats; ratingBreakdown?: RatingBreakdown; minutesPlayed: number; yellowCards: number }) => void
}

const SPEEDS = [1, 2, 3] as const
const BASE_TICK_MS = 450

export default function MatchScreen({ player, playerTeam, opponent, playerIsHome, autoResolve, onToggleAutoResolve, onComplete }: MatchScreenProps) {
  const [state, setState] = useState<MatchState>(() => initMatch(player, playerTeam, opponent, playerIsHome, player.squad))
  const [moment, setMoment] = useState<KeyMoment | null>(null)
  const [bundle, setBundle] = useState<MatchDecisionBundle | null>(null)
  const [revealed, setRevealed] = useState<{ text: string; success: boolean; grade: ExecutionGrade | null; action?: PitchAction } | null>(null)
  const [executing, setExecuting] = useState<{ optIndex: number; started: boolean } | null>(null)
  const [muted, setMutedUi] = useState(isMuted())
  const [speed, setSpeed] = useState<1 | 2 | 3>(1)
  const [displayMinute, setDisplayMinute] = useState(0)
  const [celebration, setCelebration] = useState<{ kind: CelebrationKind; minute: number; ratingDelta?: number } | null>(null)
  const [halfTimeShown, setHalfTimeShown] = useState(false)
  const halfTimeSeen = useRef(false)
  const priorPlayerGoals = useRef(0)
  const priorPlayerAssists = useRef(0)
  const priorGoalRating = useRef(6.0)
  const goalsShown = useRef(0)
  const displayScoreRef = useRef({ home: 0, away: 0 })
  const matchStatsRef = useRef({ tackle: 0, interception: 0, header: 0, keyPass: 0, save: 0 })
  const [displayScore, setDisplayScore] = useState({ home: 0, away: 0 })
  const [pitchAction, setPitchAction] = useState<PitchAction>('idle')
  const [captainMoment, setCaptainMoment] = useState<CaptainMoment | null>(null)
  const captainMomentUsed = useRef(false)
  const feedRef = useRef<HTMLDivElement>(null)

  const stateRef = useRef(state)
  stateRef.current = state

  const runSim = () => {
    const result = advanceToKeyMoment(stateRef.current, player)
    stateRef.current = result.state
    setState(result.state)
    if (!result.keyMoment && player.captaincy?.role === 'captain' && !captainMomentUsed.current && result.state.onPitch && !result.state.finished) {
      const leadership = captainMomentFor(result.state)
      if (leadership) { setCaptainMoment(leadership); return }
    }
    if (result.keyMoment) {
      setMoment(result.keyMoment)
      setBundle(momentToDecision(player, result.keyMoment, `${result.state.minute}' · ${result.state.homeTeam.short} ${displayScore.home}-${displayScore.away} ${result.state.awayTeam.short}`))
    }
  }

  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    sfx.whistle()
    runSim()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visibleCount = state.events.filter((e) => e.minute <= displayMinute).length
  const visibleEvents = state.events.slice(0, visibleCount)

  useEffect(() => {
    if (halfTimeSeen.current) return
    if (visibleEvents.some((e) => e.kind === 'halftime')) {
      halfTimeSeen.current = true
      setHalfTimeShown(true)
    }
  }, [visibleEvents])
  const caughtUp = displayMinute >= state.minute
  const momentStillValid = moment !== null && !state.substituted && !state.injury && state.onPitch && !state.finished
  const showMoment = momentStillValid && bundle !== null && caughtUp
  useEffect(() => {
    if (moment !== null && !momentStillValid) { setMoment(null); setBundle(null) }
  }, [moment, momentStillValid])
  const matchOver = state.finished && caughtUp && !moment && !revealed

  useEffect(() => {
    const paused = showMoment || captainMoment !== null || revealed !== null || matchOver || celebration !== null || halfTimeShown
    if (paused) return
    if (caughtUp && !state.finished && !moment) {
      runSim()
      return
    }
    if (caughtUp) return
    const t = window.setInterval(() => {
      setDisplayMinute((m) => Math.min(m + 1, state.minute))
    }, BASE_TICK_MS / speed)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caughtUp, showMoment, captainMoment, revealed, matchOver, celebration, halfTimeShown, speed, state.minute, state.finished, moment])

  const lastVisibleEvent = visibleEvents[visibleEvents.length - 1]
  useEffect(() => {
    if (!lastVisibleEvent) return
    const t=lastVisibleEvent.text.toLowerCase()
    const action:PitchAction=lastVisibleEvent.kind==='goal'?'goal':t.includes('save')?'save':t.includes('shot')||t.includes('effort')?'shot':t.includes('cross')?'cross':t.includes('tackle')||t.includes('challenge')?'tackle':lastVisibleEvent.kind==='chance'?'attack':'idle'
    setPitchAction(action)
    if(action!=='idle'){const timer=window.setTimeout(()=>setPitchAction('idle'),1100);return()=>window.clearTimeout(timer)}
  }, [lastVisibleEvent])

  const revealedGoalEvents = visibleEvents.filter((e) => e.kind === 'goal')
  const revealedGoals = revealedGoalEvents.length
  useEffect(() => {
    if (revealedGoals <= goalsShown.current) return
    const newGoals = revealedGoalEvents.slice(goalsShown.current)
    let home = displayScoreRef.current.home
    let away = displayScoreRef.current.away
    let lastKind: CelebrationKind = 'concede'
    for (const ev of newGoals) {
      // New match events carry their authoritative post-goal score. Keep the
      // fallback only for transient states created by an older hot-reloaded
      // build; never infer a side from commentary text.
      const homeScored = ev.scoringSide
        ? ev.scoringSide === 'home'
        : ev.homeScore !== undefined ? ev.homeScore > home : false
      home = ev.homeScore ?? (home + (homeScored ? 1 : 0))
      away = ev.awayScore ?? (away + (homeScored ? 0 : 1))
      const playerSideScored = playerIsHome ? homeScored : !homeScored
      ;(playerSideScored ? sfx.goal : sfx.concede)()
      lastKind = state.playerGoals > priorPlayerGoals.current
        ? 'player-goal'
        : state.playerAssists > priorPlayerAssists.current
        ? 'player-assist'
        : playerSideScored ? 'team-goal' : 'concede'
    }
    priorPlayerGoals.current = state.playerGoals
    priorPlayerAssists.current = state.playerAssists
    goalsShown.current = revealedGoals
    displayScoreRef.current = { home, away }
    setDisplayScore({ home, away })
    // Only claim a rating gain on a PLAYER goal. Team/opponent goals must not
    // inherit rating movement from unrelated decisions between celebrations.
    const ratingDelta=lastKind==='player-goal' ? Math.max(0,state.playerRating-priorGoalRating.current) : undefined
    if(lastKind==='player-goal') priorGoalRating.current=state.playerRating
    setCelebration({ kind: lastKind, minute: state.minute, ratingDelta })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedGoals, state.homeScore, state.awayScore, state.playerGoals, state.playerAssists, state.minute, playerIsHome])

  const ftPlayed = useRef(false)
  useEffect(() => {
    if (matchOver && !ftPlayed.current) { ftPlayed.current = true; sfx.fullTime() }
  }, [matchOver])

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [visibleCount])

  const handleCaptainChoice = (optIndex: number) => {
    if (!captainMoment) return
    const next = applyCaptainMoment(stateRef.current, captainMoment, optIndex)
    captainMomentUsed.current = true
    stateRef.current = next
    setState(next)
    setCaptainMoment(null)
    setRevealed({ text: next.events[next.events.length - 1]?.text ?? '', success: optIndex === 0, grade: null })
  }

    const handleChoose = (optIndex: number) => {
    if (!moment || !bundle) return
    if (moment.isInjuryDecision) {
      const next = resolveInjuryDecision(state, optIndex === 0, player)
      stateRef.current = next
      setState(next)
      setDisplayMinute(next.minute)
      const lastEvent = next.events[next.events.length - 1]
      setRevealed({ text: lastEvent?.text ?? '', success: !next.injury, grade: null })
      setMoment(null)
      setBundle(null)
      setExecuting(null)
      return
    }
    if (autoResolve) {
      settle(optIndex, autoResolveGrade(player, state.matchStamina))
      return
    }
    setExecuting({ optIndex, started: false })
  }

  const settle = (optIndex: number, grade: ExecutionGrade) => {
    if (!moment || !bundle) return
    const option = bundle.decision.options[optIndex]
    const chosenReward = bundle.rewards[optIndex]

    // V3.1 fairness fix: decision quality is no longer the authored reward tier.
    // Reward describes ambition/upside; quality describes how sensible the read was
    // for THIS player in THIS moment. Rating the two as the same thing punished safe,
    // intelligent football and taught players that the game had a hidden "correct"
    // button. Compare the option's real attribute-driven chance with the strongest
    // available option instead. No raw percentage is shown to the player.
    const bestOptionChance = Math.max(...bundle.decision.options.map((o) => o.successChance))
    const decisionQuality = bestOptionChance > 0 ? option.successChance / bestOptionChance : 0.5
    const outcomeQuality = bundle.maxReward > 0 ? chosenReward / bundle.maxReward : 0.5

    const archBonus = archetypeMomentBonus(player.archetype, !moment.isDefensive, moment.isDefensive, option.successChance < 0.5)
    const finalChance = Math.min(0.97, adjustChance(option.successChance, grade) + archBonus)
    const success = rand() < finalChance

    const next = moment.scenarioId
      ? resolveScenarioBeat(state, moment, optIndex, outcomeQuality, success, decisionQuality, 1, grade)
      : resolvePlayerMoment(state, moment, outcomeQuality, success, decisionQuality, 1, player.position === 'GK', grade)

    const tag = inferStatTag(option.label, moment.isDefensive, moment.isDistribution, player.position === 'GK', success)
    if (tag) matchStatsRef.current[tag] += 1

    stateRef.current = next
    setState(next)
    setDisplayMinute(next.minute)
    const lastEvent = next.events[next.events.length - 1]
    setRevealed({ text: lastEvent?.text ?? '', success, grade, action: tag==='save'?'save':tag==='tackle'||tag==='interception'?'tackle':tag==='header'?'cross':moment.isDefensive?'tackle':tag==='keyPass'?'cross':'shot' })
    setMoment(null)
    setBundle(null)
    setExecuting(null)
  }

  const continueAfterReveal = () => {
    setRevealed(null)
    if (!state.finished) runSim()
  }

  const skipAhead = () => setDisplayMinute(state.minute)

  const clockLabel = displayMinute > 90 ? `90+${displayMinute - 90}'` : `${displayMinute}'`

  return (
    <div className="relative h-[100dvh] w-full bg-ks-black flex flex-col overflow-hidden">
      {captainMoment && caughtUp && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center px-5">
          <div className="w-full max-w-md rounded-2xl border border-ks-gold/40 bg-[#0f0f0d] p-5 shadow-2xl">
            <div className="text-[10px] uppercase tracking-[0.28em] text-ks-gold font-display mb-2">© Captain's Moment</div>
            <div className="text-ks-ink text-base font-display mb-5">{captainMoment.situation}</div>
            <div className="flex flex-col gap-2">
              {captainMoment.options.map((o,i)=><button key={i} onClick={()=>handleCaptainChoice(i)} className="w-full text-left rounded-xl border border-ks-border bg-black/30 px-4 py-3 text-sm text-ks-ink active:border-ks-gold">{o.label}</button>)}
            </div>
          </div>
        </div>
      )}
      {celebration && (
        <GoalCelebration
          kind={celebration.kind}
          scorerName={celebration.kind === 'player-goal' || celebration.kind === 'player-assist' ? player.name : undefined}
          homeShort={state.homeTeam.short}
          awayShort={state.awayTeam.short}
          homeScore={displayScore.home}
          awayScore={displayScore.away}
          minute={celebration.minute}
          avatarId={celebration.kind === 'player-goal' || celebration.kind === 'player-assist' ? player.avatarId : undefined}
          playerRating={state.playerRating}
          ratingDelta={celebration.ratingDelta}
          onDone={() => setCelebration(null)}
        />
      )}
      {halfTimeShown && (
        <HalfTimeBreak
          homeShort={state.homeTeam.short}
          awayShort={state.awayTeam.short}
          homeScore={displayScore.home}
          awayScore={displayScore.away}
          playerRating={state.playerRating}
          coachTrust={player.coachTrust}
          onContinue={() => setHalfTimeShown(false)}
        />
      )}
      {showMoment && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-[2px] pointer-events-none transition-opacity duration-200" />
      )}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#0a0f0a 0%,#07110a 40%,#050504 100%)' }} />
      <svg className="absolute inset-x-0 top-0 w-full opacity-[0.14]" viewBox="0 0 400 260" preserveAspectRatio="xMidYMin slice" aria-hidden>
        <rect x="20" y="10" width="360" height="500" fill="none" stroke="#7bd88a" strokeWidth="2" />
        <line x1="20" y1="260" x2="380" y2="260" stroke="#7bd88a" strokeWidth="2" />
        <circle cx="200" cy="260" r="50" fill="none" stroke="#7bd88a" strokeWidth="2" />
        <rect x="110" y="10" width="180" height="70" fill="none" stroke="#7bd88a" strokeWidth="2" />
        <rect x="155" y="10" width="90" height="28" fill="none" stroke="#7bd88a" strokeWidth="2" />
        {Array.from({ length: 6 }).map((_, i) => (
          <rect key={i} x="20" y={10 + i * 42} width="360" height="21" fill="#ffffff" opacity="0.05" />
        ))}
      </svg>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 90% 55% at 50% 0%, transparent 30%, rgba(5,5,4,0.92) 78%)' }} />

      <div className="match-broadcast relative z-10 px-5 pt-5 max-w-md mx-auto w-full">
        <div className="flex items-center justify-between mb-2">
          <div className="playback-selector" aria-label="Match playback speed">
            {!matchOver && SPEEDS.map(value=><button key={value} aria-label={`Playback speed ${value} times`} aria-pressed={speed===value} onClick={()=>setSpeed(value)}>{value}×</button>)}
          </div>
          <div className="broadcast-clock" aria-label="Match clock"><small>{matchOver ? 'FULL TIME' : halfTimeShown ? 'HALF TIME' : displayMinute > 45 ? 'SECOND HALF' : 'FIRST HALF'}</small><strong>{matchOver ? 'FT' : halfTimeShown ? 'HT' : clockLabel}</strong></div>
          <button className="broadcast-audio" onClick={() => { const m = toggleMuted(); setMutedUi(m); syncMusicMute() }} aria-label={muted ? 'Unmute sound' : 'Mute sound'} aria-pressed={!muted}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/>{muted ? <path d="m17 9 5 6m0-6-5 6"/> : <><path d="M16 8q4 4 0 8"/><path d="M19 5q7 7 0 14"/></>}</svg>
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className={`flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1 ${playerIsHome ? 'bg-ks-gold' : 'bg-[#1c1c18]'}`}>
            <TeamCrest primary={state.homeTeam.primaryColor} secondary={state.homeTeam.secondaryColor} short={state.homeTeam.short} size="sm" />
            <span className={`font-display tracking-wide text-xs ${playerIsHome ? 'text-ks-black' : 'text-ks-ink'}`}>{state.homeTeam.short}</span>
          </div>
          <span key={`${displayScore.home}-${displayScore.away}`} className="font-display tracking-widest text-ks-gold text-3xl animate-[scorepop_0.4s_ease-out] shrink-0">
            {displayScore.home}–{displayScore.away}
          </span>
          <div className={`flex items-center gap-1.5 rounded-full pl-2.5 pr-1 py-1 flex-row-reverse ${!playerIsHome ? 'bg-ks-gold' : 'bg-[#1c1c18]'}`}>
            <TeamCrest primary={state.awayTeam.primaryColor} secondary={state.awayTeam.secondaryColor} short={state.awayTeam.short} size="sm" />
            <span className={`font-display tracking-wide text-xs ${!playerIsHome ? 'text-ks-black' : 'text-ks-ink'}`}>{state.awayTeam.short}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          <div className="broadcast-stat"><span>RATING</span><b>{state.playerRating.toFixed(1)}</b></div>
          <div className="broadcast-stat"><span>STAMINA</span><b>{Math.round(state.matchStamina)}%</b></div>
          <div className="broadcast-stat"><span>ROLE</span><b>{player.captaincy?.role==='captain'?'© CAP':player.position}</b></div>
        </div>
                <div className="h-1 rounded-full bg-[#2a2a27] overflow-hidden mb-3 relative">
          <div className="absolute inset-y-0 left-1/2 w-px bg-ks-border" />
          <div
            className="h-full bg-ks-gold rounded-full transition-all"
            style={{
              width: `${Math.abs(state.momentum) * 5}%`,
              marginLeft: state.momentum >= 0 ? '50%' : `${50 - Math.abs(state.momentum) * 5}%`,
            }}
          />
        </div>
      </div>

      <div className="relative z-10 px-5 max-w-md mx-auto w-full mb-2">
        <LiveMatchPitch momentum={state.momentum} homeColor={state.homeTeam.primaryColor} awayColor={state.awayTeam.primaryColor} homeShort={state.homeTeam.short} awayShort={state.awayTeam.short} playerIsHome={playerIsHome} player={player} playerOnPitch={state.onPitch} minute={displayMinute} action={pitchAction} scoringSide={lastVisibleEvent?.scoringSide} focusPlayer={showMoment || executing !== null} />
      </div>

      <div ref={feedRef} className="relative z-10 flex-1 min-h-0 overflow-y-auto px-5 max-w-md mx-auto w-full" style={{ maxHeight: '30vh' }}>
        <div className="flex flex-col gap-2 pb-4">
          {visibleEvents.map((e, i) => {
            const isLast = i === visibleEvents.length - 1
            const size = e.kind === 'goal' ? 'text-base text-ks-ink font-medium' : e.kind === 'fulltime' || e.kind === 'halftime' ? 'text-sm text-ks-gold' : isLast ? 'text-sm text-ks-ink' : 'text-xs text-ks-muted'
            const fromEnd = visibleEvents.length - 1 - i
            const opacity = e.kind === 'goal' || e.kind === 'halftime' || e.kind === 'fulltime' ? 1 : Math.max(0.35, 1 - fromEnd * 0.12)
            return (
              <p key={i} className={`${size} leading-snug ${isLast ? 'animate-[feedin_0.3s_ease-out]' : ''}`} style={{ opacity }}>
                <span className="text-ks-muted tabular-nums">{e.minute}'</span> · {e.text}
              </p>
            )
          })}
          {!caughtUp && !showMoment && (
            <p className="text-[11px] text-ks-muted/60 animate-pulse">▪▪▪</p>
          )}
        </div>
      </div>

      {(showMoment || revealed) && !celebration && (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center p-5"
          style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 40%, rgba(212,175,55,0.08), transparent 65%), #050504' }}
        >
          <div className="max-w-md w-full max-h-[85vh] overflow-y-auto">
            {showMoment && executing && bundle && moment ? (
              <div className="flex flex-col gap-2.5">
                <div className="rounded-xl border border-ks-gold/40 bg-ks-gold/5 px-4 py-3 mb-1">
                  <p className="text-ks-ink text-sm leading-relaxed">{moment.situation}</p>
                </div>
                {miniGameKindForMoment(moment) ? (
                  <TrainingMiniGame
                    kind={miniGameKindForMoment(moment)!}
                    label={bundle.decision.options[executing.optIndex].label}
                    ceiling={bundle.ceilings[executing.optIndex]}
                    onComplete={(quality) => settle(executing.optIndex, gradeFromRatio(quality))}
                  />
                ) : !executing.started ? (() => {
                  const guide = executionGuideFor(bundle, executing.optIndex)
                  return (
                    <div className="minigame-preview">
                      <div className="minigame-steps"><b>1</b><span>READ</span><i/><b>2</b><span>EXECUTE</span><i/><b>3</b><span>RESULT</span></div>
                      <div className="minigame-preview-icon">{guide.icon}</div>
                      <div className="text-[9px] uppercase tracking-[.24em] text-ks-gold">how to play</div>
                      <h2>{guide.title}</h2>
                      <p>{guide.body}</p>
                      <div className="minigame-tip"><span>COACH'S TIP</span>{guide.tip}</div>
                      <button onClick={() => setExecuting({ ...executing, started: true })}>I'm ready →</button>
                    </div>
                  )
                })() : (() => {
                  const ExecutionComponent = resolveExecutionComponent(bundle, executing.optIndex)
                  return (
                    <div className="minigame-live-stage">
                      <div className="minigame-live-label"><span>2 / 3</span> EXECUTE</div>
                      <ExecutionComponent
                        spec={executionSpecFor(player, bundle.ceilings[executing.optIndex], state.matchStamina)}
                        label={bundle.decision.options[executing.optIndex].label}
                        onResolve={(grade) => settle(executing.optIndex, grade)}
                        tier={moment.tier}
                      />
                    </div>
                  )
                })()}
              </div>
            ) : showMoment && bundle && moment ? (
              <div className="flex flex-col gap-2.5">
                <div className="moment-kicker"><span>{clockLabel}</span><b>{moment.isDefensive ? 'DEFENSIVE MOMENT' : moment.tier === 'clear' ? 'CLEAR CHANCE' : moment.tier === 'good' ? 'ATTACKING MOMENT' : 'KEY MOMENT'}</b><span>{player.position}</span></div>
                <div className={"moment-danger "+(moment.tier==='clear'?'danger-clear':moment.tier==='good'?'danger-good':'danger-half')}><span></span><span></span><span></span></div>
                <div className="moment-scene"><div className="moment-scene-glow"/><div className="text-[9px] uppercase tracking-[.24em] text-ks-gold mb-2">The game slows down</div><p className="text-white text-[15px] font-medium leading-relaxed relative z-10">{moment.situation}</p></div>
                {bundle.decision.options.map((opt, i) => (
                  <button key={opt.id} onClick={() => handleChoose(i)}
                    className="moment-choice text-left" style={{animationDelay:`${120+i*90}ms`}}>
                    <div className="font-display tracking-wide text-ks-gold text-sm uppercase">{opt.label}</div>
                    {opt.hint && <div className="text-[11px] text-ks-muted mt-0.5">{opt.hint}</div>}
                  </button>
                ))}
                <button
                  onClick={onToggleAutoResolve}
                  className="text-center text-[10px] text-ks-muted underline underline-offset-2 pt-1"
                >
                  {autoResolve ? 'auto-resolve is ON — play moments yourself' : 'auto-resolve these moments instead'}
                </button>
              </div>
            ) : revealed ? (
              <div className="flex flex-col gap-3 result-stage">
                <div className={"result-impact "+(revealed.success?'result-success':'result-fail')}>
                  <div className="result-icon">{revealed.action==='save'?'🧤':revealed.action==='tackle'?'◆':revealed.action==='cross'?'↗':revealed.action==='shot'?'⚽':'◆'}</div>
                  <div className="result-word">{revealed.success ? (revealed.grade==='perfect'?'PERFECT':revealed.action==='save'?'SAVED':revealed.action==='tackle'?'WON':revealed.action==='cross'?'CREATED':'EXECUTED') : 'DENIED'}</div>
                </div>
                <div className={`rounded-xl border px-4 py-3 result-copy ${revealed.success ? 'border-green-500/50 bg-green-500/5' : 'border-orange-500/40 bg-orange-500/5'}`}>
                  {revealed.grade && (
                    <div className={`font-display tracking-widest text-[10px] uppercase mb-1.5 ${GRADE_COLOR[revealed.grade]}`}>
                      {GRADE_LABEL[revealed.grade]}
                    </div>
                  )}
                  <p className="text-ks-ink text-sm leading-relaxed">{revealed.text}</p>
                  {!revealed.success && (revealed.grade === 'perfect' || revealed.grade === 'good') && (
                    <p className="text-ks-muted text-[11px] mt-2 pt-2 border-t border-white/5">
                      Good process — the situation just didn't fall your way. Your decision and execution still matter to your rating.
                    </p>
                  )}
                </div>
                <button onClick={continueAfterReveal} className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3 text-sm">
                  {state.finished ? 'full time →' : 'play on →'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <div className="relative z-10 px-5 pb-8 max-w-md mx-auto w-full" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}>
        {matchOver ? (
          <>
          <div className="fulltime-stage">
            <div className="ft-label">FULL TIME</div>
            <div className="ft-scoreline">
              <div><TeamCrest primary={state.homeTeam.primaryColor} secondary={state.homeTeam.secondaryColor} short={state.homeTeam.short} size="sm" /><span>{state.homeTeam.short}</span></div>
              <b><span>{state.homeScore}</span><i>—</i><span>{state.awayScore}</span></b>
              <div><TeamCrest primary={state.awayTeam.primaryColor} secondary={state.awayTeam.secondaryColor} short={state.awayTeam.short} size="sm" /><span>{state.awayTeam.short}</span></div>
            </div>
            <div className="ft-player-line">
              <div><small>RATING</small><strong>{state.playerRating.toFixed(1)}</strong></div>
              <div><small>GOALS</small><strong>{state.playerGoals}</strong></div>
              <div><small>ASSISTS</small><strong>{state.playerAssists}</strong></div>
            </div>
          </div>
          {state.motm && (
            <div className={"motm-reveal "+(state.motm.playerWon?'motm-you':'')}>
              <div className="motm-star">★</div>
              <div><small>PLAYER OF THE MATCH</small><strong>{state.motm.winner.name}</strong><span>{state.motm.winner.position} · {state.motm.winner.rating.toFixed(1)}</span></div>
            </div>
          )}
          <button
            onClick={() => {
              const won = state.playerIsHome ? state.homeScore > state.awayScore : state.awayScore > state.homeScore
              const drew = state.homeScore === state.awayScore
              const playerScore = state.playerIsHome ? state.homeScore : state.awayScore
              const opponentScore = state.playerIsHome ? state.awayScore : state.homeScore
              onComplete({
                rating: Math.round(state.playerRating * 10) / 10, goals: state.playerGoals, assists: state.playerAssists,
                won, drew, finalMatchStamina: state.matchStamina, injury: state.injury, wasSubbed: state.substituted, redCarded: state.redCarded,
                playerScore, opponentScore, motm: state.motm ? { playerWon: state.motm.playerWon, winnerName: state.motm.winner.name, winnerRating: state.motm.winner.rating, winnerPosition: state.motm.winner.position } : undefined, squad: state.squad, matchStats: matchStatsRef.current,
                playerStats: state.playerStats, ratingBreakdown: state.ratingBreakdown,
                minutesPlayed: Math.max(0, Math.min(state.minute, state.subMinute ?? state.minute) - state.entryMinute), yellowCards: state.yellowCards,
              })
            }}
            className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm shadow-[0_0_25px_rgba(212,175,55,0.3)]"
          >
            match summary →
          </button>
          </>
        ) : !showMoment && !revealed ? (
          <button onClick={skipAhead} className="w-full text-center text-[11px] text-ks-muted border border-ks-border rounded-xl py-2.5">
            skip ahead ⏩
          </button>
        ) : null}
      </div>
    </div>
  )
}
