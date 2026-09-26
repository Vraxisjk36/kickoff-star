import { useState } from 'react'
import type { Player } from '../types/player'
import type { School } from '../engine/schools'
import type { DecisionResult } from '../types/decision'
import {
  TRIAL_WEEKS, initTrialState, recordTrialDrill, completeTrialWeek,
  coachFeedback, decideSquadRole, generateRival, rivalScoreAt, coachReaction,
  standingVsRival, requiredPerformance, TOTAL_TRIAL_MOMENTS,
  ROLE_LABEL, ROLE_MESSAGE, type TrialState, type SquadRole,
} from '../engine/trials'
import { generateSession, drillToDecision, type TrainingSession } from '../engine/training'
import DecisionCard from '../components/DecisionCard'
import TimingBar from '../components/TimingBar'
import {
  executionSpecFor, qualityOf, GRADE_LABEL, GRADE_COLOR, type ExecutionGrade,
} from '../engine/execution'
import type { TrainingSessionType } from '../types/training'

interface TrialsScreenProps {
  player: Player
  school: School
  onComplete: (role: SquadRole, performance: number) => void
}

type Phase = 'week-intro' | 'drills' | 'showcase' | 'reaction' | 'week-done' | 'feedback' | 'reveal'

// Phase 14 rework. The old flow was: intro -> 4 identical DecisionCard drills -> a
// content-free "week complete ✓" tap -> repeat 3x -> one verdict at the very end.
// Twelve blind decisions with no feedback and nothing at stake.
//
// Now each week is shorter, ends with a live execution moment (the Phase 13 timing
// bar, so onboarding actually teaches the mechanic the game is built on), gives an
// immediate coach reaction after every moment, and tracks you against a named rival
// competing for the same shirt.

const SHOWCASE_PROMPT: Record<number, { situation: string; label: string; ceiling: number }> = {
  0: { situation: 'Last drill of the day. The coach sets up a shooting box and the whole group stops to watch.', label: 'strike it', ceiling: 0.6 },
  1: { situation: 'Small-sided game, level. The ball drops to you at the top of the box with your rival tracking back.', label: 'hit it first time', ceiling: 0.5 },
  2: { situation: 'Trial match, last minute. It breaks to you eight yards out. This is the moment they decide on.', label: 'finish it', ceiling: 0.45 },
}
const GK_SHOWCASE_PROMPT: typeof SHOWCASE_PROMPT = {
  0: { situation: 'The coach fires shots through a crowd of players. Track the ball and get your hands behind it.', label: 'make the save', ceiling: 0.7 },
  1: { situation: 'A counterattack leaves you one-on-one with a striker. Close the angle and react.', label: 'stop the shot', ceiling: 0.65 },
  2: { situation: 'Trial match, final minute. A hard shot bends toward the corner. The coaches are watching your positioning.', label: 'dive for it', ceiling: 0.6 },
}

export default function TrialsScreen({ player, school, onComplete }: TrialsScreenProps) {
  const [trial, setTrial] = useState<TrialState>(() => initTrialState(school.id, generateRival(school)))
  const [weekIdx, setWeekIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('week-intro')
  const [session, setSession] = useState<TrainingSession | null>(null)
  const [reaction, setReaction] = useState<{ text: string; quality: number; grade: ExecutionGrade | null } | null>(null)
  const [showcaseDone, setShowcaseDone] = useState(false)

  const weekCfg = TRIAL_WEEKS[weekIdx]
  const showcase = (player.position === 'GK' ? GK_SHOWCASE_PROMPT : SHOWCASE_PROMPT)[weekIdx]
  const rivalScore = rivalScoreAt(trial.rival, trial.drillsPlayed, TOTAL_TRIAL_MOMENTS)
  const xiBar = requiredPerformance(school, 'startingXI')

  const startWeek = () => {
    const keeperThemes: TrainingSessionType[] = ['gk-reactions', 'gk-positioning', 'gk-shot-stopping']
    const s = generateSession(player, player.position === 'GK' ? keeperThemes[weekIdx] : weekCfg.drillTheme as TrainingSessionType)
    // Weeks are deliberately shorter now — the old 4-drill blocks dragged.
    setSession({ ...s, drills: s.drills.slice(0, weekCfg.drills), currentDrill: 0 })
    setPhase('drills')
  }

  const scoreMoment = (quality: number, grade: ExecutionGrade | null) => {
    setTrial((t) => recordTrialDrill(t, quality))
    setReaction({ text: coachReaction(quality), quality, grade })
    setPhase('reaction')
  }

  const handleDrillResolved = (result: DecisionResult) => {
    if (!session) return
    const drill = session.drills[session.currentDrill]
    const optIdx = drill.options.findIndex((o) => o.label === result.chosen.label)
    const chosenReward = drill.options[optIdx]?.reward ?? 1
    const maxReward = Math.max(...drill.options.map((o) => o.reward))
    const quality = result.success ? chosenReward / maxReward : 0
    scoreMoment(quality, null)
  }

  // After a reaction, either continue the drill block or move to the showcase.
  const afterReaction = () => {
    setReaction(null)
    if (!session) { setPhase('week-done'); return }
    const nextDrill = session.currentDrill + 1
    if (nextDrill < session.drills.length) {
      setSession({ ...session, currentDrill: nextDrill })
      setPhase('drills')
    } else if (weekCfg.showcase && !showcaseDone) {
      setPhase('showcase')
    } else {
      setTrial((t) => completeTrialWeek(t))
      setPhase('week-done')
    }
  }

  const handleShowcase = (grade: ExecutionGrade) => {
    // Execution grade maps straight onto trial quality — a perfect strike is a
    // maximum-quality moment, a mistimed one scores nothing.
    setShowcaseDone(true)
    scoreMoment(qualityOf(grade), grade)
  }

  const advanceWeek = () => {
    if (weekIdx < TRIAL_WEEKS.length - 1) {
      setWeekIdx(weekIdx + 1)
      setSession(null)
      setShowcaseDone(false)
      setPhase('week-intro')
    } else {
      setPhase('feedback')
    }
  }

  const Shell = ({ children, glow = 0.07 }: { children: React.ReactNode; glow?: number }) => (
    <div className="relative min-h-screen w-full bg-ks-black flex flex-col justify-center px-5 py-8">
      <div className="absolute inset-0" style={{
        background: `radial-gradient(ellipse 60% 40% at 50% 25%, rgba(212,175,55,${glow}), transparent 60%), linear-gradient(180deg,#0a0a09,#050504)`,
      }} />
      <div className="relative z-10 max-w-md mx-auto w-full">{children}</div>
    </div>
  )

  // Running progress against the bar and the rival — the trial's core new feedback.
  const ProgressStrip = () => (
    <div className="rounded-xl border border-ks-border bg-[#0f0f0d] px-3 py-2.5 mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-display tracking-widest text-[9px] text-ks-muted uppercase">you</span>
        <span className="font-display tracking-widest text-[9px] text-ks-muted uppercase">{trial.rival.name}</span>
      </div>
      <div className="relative h-2 rounded-full bg-[#2a2a27] overflow-hidden mb-1.5">
        <div className="h-full rounded-full bg-ks-gold transition-[width] duration-500"
          style={{ width: `${Math.min(100, trial.performanceScore * 100)}%` }} />
        <div className="absolute inset-y-0 w-px bg-ks-ink/70" style={{ left: `${Math.min(100, rivalScore * 100)}%` }} />
      </div>
      <div className="flex items-center justify-between text-[9px] text-ks-muted">
        <span>starting xi needs {Math.round(xiBar * 100)}</span>
        <span>{trial.drillsPlayed} / {TOTAL_TRIAL_MOMENTS} moments</span>
      </div>
    </div>
  )

  // --- render ---
  if (phase === 'week-intro') {
    return (
      <Shell>
        <div className="font-display tracking-widest text-[11px] text-ks-gold uppercase mb-2">{school.name} · trials</div>
        <div className="flex gap-1.5 mb-5">
          {TRIAL_WEEKS.map((w, i) => (
            <div key={w.week} className={`h-1 rounded-full flex-1 ${i < weekIdx ? 'bg-ks-gold/50' : i === weekIdx ? 'bg-ks-gold' : 'bg-ks-border'}`} />
          ))}
        </div>
        <h1 className="font-display text-ks-ink text-3xl tracking-wide mb-2">{weekCfg.title}</h1>
        <p className="text-ks-muted text-sm mb-4 leading-relaxed">{weekCfg.focus}</p>

        {weekIdx === 0 && (
          <div className="rounded-xl border border-ks-border bg-[#0f0f0d] px-3 py-2.5 mb-4">
            <p className="text-[11px] text-ks-muted leading-relaxed">
              <span className="text-ks-ink">{trial.rival.name}</span> is trialling for the same position.
              Only one of you is walking into that Starting XI.
            </p>
          </div>
        )}
        {weekIdx > 0 && <ProgressStrip />}

        {/* progressive disclosure — one system per week, in the coach's voice */}
        <div className="rounded-xl border border-ks-gold/30 bg-ks-gold/5 px-3 py-2.5 mb-6">
          <div className="font-display tracking-widest text-[9px] text-ks-gold uppercase mb-1">coach</div>
          <p className="text-[12px] text-ks-ink leading-relaxed italic">"{weekCfg.coachTip}"</p>
        </div>

        <button onClick={startWeek} className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm shadow-[0_0_25px_rgba(212,175,55,0.25)]">
          {weekCfg.isMatch ? 'walk out →' : `begin week ${weekCfg.week}`}
        </button>
      </Shell>
    )
  }

  if (phase === 'drills' && session) {
    return <DecisionCard key={`${weekIdx}-${session.currentDrill}`} decision={{ ...drillToDecision(player, session), context: 'trial' }} onResolved={handleDrillResolved} />
  }

  if (phase === 'showcase' && showcase) {
    return (
      <Shell glow={0.1}>
        <div className="font-display tracking-widest text-[11px] text-ks-gold uppercase mb-4">
          {weekCfg.isMatch ? 'trial match · 89\'' : 'showcase'}
        </div>
        <div className="rounded-2xl border border-ks-gold/40 bg-ks-gold/5 px-5 py-5 mb-6">
          <p className="text-ks-ink text-base leading-relaxed">{showcase.situation}</p>
        </div>
        <TimingBar
          spec={executionSpecFor(player, showcase.ceiling, player.fitness.stamina)}
          label={showcase.label}
          onResolve={handleShowcase}
        />
      </Shell>
    )
  }

  if (phase === 'reaction' && reaction) {
    const good = reaction.quality >= 0.6
    return (
      <Shell glow={good ? 0.1 : 0.04}>
        <div className="font-display tracking-widest text-[11px] text-ks-muted uppercase mb-4">touchline</div>
        {reaction.grade && (
          <div className={`font-display tracking-widest text-sm uppercase mb-3 ${GRADE_COLOR[reaction.grade]}`}>
            {GRADE_LABEL[reaction.grade]}
          </div>
        )}
        <div className={`rounded-2xl border px-5 py-5 mb-6 ${
          good ? 'border-green-500/40 bg-green-500/5' : reaction.quality > 0 ? 'border-ks-border bg-[#0f0f0d]' : 'border-orange-500/40 bg-orange-500/5'
        }`}>
          <p className="text-ks-ink text-base leading-relaxed">{reaction.text}</p>
        </div>
        <ProgressStrip />
        <button onClick={afterReaction} className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm">
          continue →
        </button>
      </Shell>
    )
  }

  if (phase === 'week-done') {
    const standing = standingVsRival(trial.performanceScore, rivalScore)
    const isLast = weekIdx >= TRIAL_WEEKS.length - 1
    return (
      <Shell>
        <div className="font-display tracking-widest text-[11px] text-ks-muted uppercase mb-2">week {weekCfg.week} complete</div>
        <h1 className={`font-display text-2xl tracking-wide mb-4 ${standing.ahead ? 'text-green-500' : 'text-orange-400'}`}>
          {standing.text}
        </h1>
        <ProgressStrip />
        <p className="text-ks-muted text-sm mb-8 leading-relaxed">
          {isLast
            ? 'That\'s the trial done. The coaches are naming the squad tonight.'
            : 'The coaches have seen enough for this week. There\'s still time to change their minds.'}
        </p>
        <button onClick={advanceWeek} className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm">
          {isLast ? 'the verdict →' : 'next week →'}
        </button>
      </Shell>
    )
  }

  if (phase === 'feedback') {
    const lines = coachFeedback(trial)
    return (
      <Shell glow={0.06}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-[#2a2a27] border border-ks-border flex items-center justify-center text-ks-muted text-xl">☺</div>
          <div>
            <div className="font-display tracking-wide text-ks-ink text-base">The Coach</div>
            <div className="text-[11px] text-ks-muted">{school.name}</div>
          </div>
        </div>
        <div className="rounded-2xl border border-ks-border bg-[#0f0f0d] px-5 py-5 mb-6 flex flex-col gap-3">
          {lines.map((line, i) => (
            <p key={i} className="text-ks-ink text-base leading-relaxed italic">{line}</p>
          ))}
        </div>
        <button onClick={() => setPhase('reveal')} className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm">
          see the squad list →
        </button>
      </Shell>
    )
  }

  // reveal
  const role = decideSquadRole(trial, school)
  const roleColor = role === 'starting-xi' ? 'text-green-500' : role === 'bench' ? 'text-ks-gold' : role === 'reserves' ? 'text-orange-400' : 'text-red-500'
  const beatRival = trial.performanceScore >= rivalScore

  return (
    <Shell glow={0.1}>
      <div className="text-center">
        <div className="font-display tracking-widest text-[11px] text-ks-muted uppercase mb-3">squad selection</div>
        <div className={`font-display text-4xl tracking-wide mb-4 ${roleColor}`}>{ROLE_LABEL[role]}</div>
        <p className="text-ks-ink text-base leading-relaxed mb-4 px-2">{ROLE_MESSAGE[role]}</p>
        <p className="text-[12px] text-ks-muted leading-relaxed mb-10 px-2">
          {beatRival
            ? `You finished ahead of ${trial.rival.name}.`
            : `${trial.rival.name} edged you out this time.`}
        </p>
        <button
          onClick={() => onComplete(role, trial.performanceScore)}
          className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm shadow-[0_0_25px_rgba(212,175,55,0.3)]"
        >
          {role === 'released' ? 'try another school →' : 'start your season'}
        </button>
      </div>
    </Shell>
  )
}
