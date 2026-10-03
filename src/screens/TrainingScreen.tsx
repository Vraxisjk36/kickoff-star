import { useState } from 'react'
import type { Player } from '../types/player'
import type { DecisionResult } from '../types/decision'
import { resolveDecision } from '../types/decision'
import { useCareerStore } from '../store/careerStore'
import type { PendingTrainingSnapshot } from '../engine/save'
import {
  generateSession, drillToDecision, recordDrillResult, gradeSession,
  applyTrainingGrowth, objectivesComplete, type TrainingSession, type TrainingOutcome,
} from '../engine/training'
import type { TrainingSessionType } from '../types/training'
import { GRADE_ORDER, SESSION_ATTRIBUTES } from '../types/training'
import DecisionCard from '../components/DecisionCard'
import TrainingMiniGame, { type MiniGameKind } from '../components/TrainingMiniGame'
import { miniGameForDrill } from '../engine/training'
import {
  INTENSITIES, bandSpec, trainingInjuryChance, effectiveGrowthModifier, intensitySpec,
  intensityGrowthModifier, type TrainingIntensity,
} from '../engine/energy'
import { rollInjury, type Injury } from '../engine/injuries'
import { EnergyMeter } from '../components/EnergySheet'
import { gradeFromRatio, trainingXpForDrill, type AttributeKey } from '../engine/xp'

interface TrainingScreenProps {
  player: Player
  forcedType?: TrainingSessionType
  onComplete: (outcome: TrainingOutcome, energySpent: number, injury: Injury | null, xpEarned: number, restrictedAttrs: AttributeKey[]) => void
}

type Phase = 'intro' | 'drills' | 'results'

export default function TrainingScreen({ player, forcedType, onComplete }: TrainingScreenProps) {
  // P53 — real, confirmed playtest bug: mid-session progress lived only in
  // this component's local state, so a mobile reload (itch's iframe embed
  // backgrounding is far more prone to this than a desktop tab) silently
  // wiped the whole session and restarted from drill 0 with no warning.
  // Checkpointed to the save file after every completed drill now — if one
  // exists on mount, resume it instead of generating a fresh session and
  // jumping straight past the intro screen the player already saw.
  const rawResumable = useState<PendingTrainingSnapshot | null>(() => useCareerStore.getState().pendingTraining)[0]
  // A pending session only makes sense to resume if it's for the SAME slot
  // the player is actually entering right now — a stale snapshot from an
  // abandoned different session shouldn't silently resume into the wrong
  // context. Discarded rather than resumed in that case.
  const resumable = rawResumable && (!forcedType || rawResumable.session.type === forcedType) ? rawResumable : null
  const setPendingTraining = useCareerStore((s) => s.setPendingTraining)

  const [session, setSession] = useState<TrainingSession>(() => resumable?.session ?? generateSession(player, forcedType))
  const [phase, setPhase] = useState<Phase>(resumable ? 'drills' : 'intro')
  const [energySpent, setEnergySpent] = useState(resumable?.energySpent ?? 0)
  const [outcome, setOutcome] = useState<TrainingOutcome | null>(null)
  const [intensity, setIntensity] = useState<TrainingIntensity>(resumable?.intensity ?? 'normal')
  const [injury, setInjury] = useState<Injury | null>(null)
  // P49 — real per-drill execution feeds XP now, replacing the old direct
  // auto-growth. Accumulated across the whole session, spent all at once on
  // the allocation screen afterward.
  const [xpEarned, setXpEarned] = useState(resumable?.xpEarned ?? 0)

  // One helper, used at every checkpoint below, so the snapshot shape can
  // never drift out of sync between the 4 places a drill completes.
  const checkpoint = (updatedSession: TrainingSession, updatedXp: number, updatedEnergy: number) => {
    setPendingTraining({ session: updatedSession, xpEarned: updatedXp, energySpent: updatedEnergy, intensity })
  }

  const drill = session.drills[session.currentDrill]

  // P63 — "allow players to sim training and just distribute XP." Reuses
  // the exact same resolution logic manual play uses (resolveDecision for
  // decision drills — the real probability roll, not a reinvented one) and
  // the same trainingXpForDrill/gradeFromRatio XP formulas, so a simmed
  // session is genuinely the same underlying system, just not manually
  // played. A flat reduction keeps hands-on training the stronger choice —
  // matching how other career games handle auto-resolve vs manual (FM's
  // auto-resolve, EA FC's quick sim) — without needing to secretly bias the
  // rolls themselves, which would make "sim" quietly worse in a way the
  // player couldn't see or reason about.
  const SIM_XP_MULTIPLIER = 0.8

  // P63 — a small bonus at streak milestones (every 5th session in a row,
  // no missed week) — cheap, sticky, matches how mobile career games like
  // New Star Soccer reward consistency without needing a whole new system.
  const streakMilestoneBonus = () => ((player.trainingStreak ?? 0) + 1) % 5 === 0 ? 50 : 0

  const simulateSession = () => {
    let s = session
    let xp = xpEarned
    let energy = energySpent
    while (s.currentDrill < s.drills.length) {
      const idx = s.currentDrill
      const d = s.drills[idx]
      const maxReward = Math.max(...d.options.map((o) => o.reward))
      if (miniGameForDrill(s, idx)) {
        // No manual tap-timing to reflect — approximate an average, honest
        // rep rather than assume best-case execution every time.
        const quality = 0.35 + Math.random() * 0.45
        const earned = Math.round(quality * maxReward * 10) / 10
        s = recordDrillResult(s, earned, maxReward, quality >= 0.5)
        xp += trainingXpForDrill(gradeFromRatio(quality)) * SIM_XP_MULTIPLIER
        energy += 5 * intensitySpec(intensity).energyMod
      } else {
        // Build the real Decision the same way manual play does (real,
        // attribute-computed successChance per option) rather than resolve
        // against the raw drill template, which has no successChance at all.
        const decision = drillToDecision(player, s)
        const chosenOption = decision.options[Math.floor(Math.random() * decision.options.length)]
        const result = resolveDecision(chosenOption)
        const optionIndex = d.options.findIndex((o) => o.label === chosenOption.label)
        const chosenReward = d.options[optionIndex]?.reward ?? 1
        s = recordDrillResult(s, chosenReward, maxReward, result.success)
        xp += trainingXpForDrill(gradeFromRatio(result.success ? 0.7 : 0.3)) * SIM_XP_MULTIPLIER
        energy += Math.abs(result.effect.energy ?? 5) * intensitySpec(intensity).energyMod
      }
    }
    xp = Math.round(xp) + streakMilestoneBonus()
    const grade = gradeSession(s)
    const grown = applyTrainingGrowth(player, s, grade, player.trainingMomentum ?? 0, intensity)
    setInjury(rollInjury(trainingInjuryChance(player, intensity)))
    setSession(s)
    setXpEarned(xp)
    setEnergySpent(energy)
    setOutcome(grown)
    setPhase('results')
    setPendingTraining(null)
  }

  const handleDrillResolved = (result: DecisionResult) => {
    // map chosen option back to its reward tier (index in drill options = tier proxy)
    const optionIndex = drill.options.findIndex((o) => o.label === result.chosen.label)
    const chosenReward = drill.options[optionIndex]?.reward ?? 1
    const maxReward = Math.max(...drill.options.map((o) => o.reward))

    const updated = recordDrillResult(session, chosenReward, maxReward, result.success)
    // Reward tier reflects how ambitious the CHOICE was, not how well it was
    // executed — a safe option that succeeds isn't a "miss." The only real
    // execution signal a plain decision-card drill has is success/failure.
    const isComplete = updated.currentDrill >= updated.drills.length
    const newXp = xpEarned + trainingXpForDrill(gradeFromRatio(result.success ? 0.7 : 0.3)) + (isComplete ? streakMilestoneBonus() : 0)
    setXpEarned(newXp)
    // Intensity scales the energy each drill costs — this is what makes the choice real.
    const drillCost = Math.abs(result.effect.energy ?? 5) * intensitySpec(intensity).energyMod
    const newEnergy = energySpent + drillCost
    setEnergySpent(newEnergy)

    if (isComplete) {
      const grade = gradeSession(updated)
      const grown = applyTrainingGrowth(player, updated, grade, player.trainingMomentum ?? 0, intensity)
      // One injury roll for the whole session, not per drill — keeps it rare and narrative.
      setInjury(rollInjury(trainingInjuryChance(player, intensity)))
      setSession(updated)
      setOutcome(grown)
      setPhase('results')
      // Session genuinely finished — nothing left to resume from.
      setPendingTraining(null)
    } else {
      setSession(updated)
      checkpoint(updated, newXp, newEnergy)
    }
  }

  if (phase === 'intro') {
    return (
      <div className="relative min-h-screen w-full bg-ks-black flex flex-col justify-center px-5 py-8">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 25%, rgba(212,175,55,0.07), transparent 60%), linear-gradient(180deg,#0a0a09,#050504)' }} />
        <div className="relative z-10 max-w-md mx-auto w-full">
          <div className="training-kicker">TRAINING CENTRE · SESSION</div>
          <div className="training-hero"><div className="training-cones"/><small>TODAY'S PROGRAMME</small><h1>{session.label}</h1><p>{session.drills.length} drills · {player.position} development</p><div className="training-session-dots">{session.drills.map((_,i)=><i key={i}/>)}</div></div>
          {(player.trainingStreak ?? 0) > 0 && (
            <p className="text-[11px] text-ks-gold mb-5">
              🔥 {player.trainingStreak}-session streak{((player.trainingStreak ?? 0) + 1) % 5 === 0 ? ' — one more for a bonus' : ''}
            </p>
          )}

          <div className="rounded-2xl border border-ks-border bg-[#0f0f0d] px-5 py-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-display tracking-widest text-[10px] text-ks-muted uppercase">your energy</span>
              <span className={`text-[10px] uppercase tracking-wider ${bandSpec(player.fitness.stamina).colorClass}`}>
                {bandSpec(player.fitness.stamina).label}
              </span>
            </div>
            <EnergyMeter stamina={player.fitness.stamina} showLabel={false} />
            <p className={`text-[10px] leading-relaxed mt-2 ${
              effectiveGrowthModifier(intensity, player.fitness.stamina) < 1 ? 'text-orange-400' : 'text-green-400'
            }`}>
              At this energy, going {intensity} is worth about{' '}
              {Math.round(effectiveGrowthModifier(intensity, player.fitness.stamina) * 100)}% of normal growth.
            </p>
          </div>

          <div className="rounded-2xl border border-ks-border bg-[#0f0f0d] px-5 py-4 mb-3">
            <div className="font-display tracking-widest text-[10px] text-ks-muted uppercase mb-3">how hard are you going?</div>
            <div className="flex flex-col gap-2">
              {INTENSITIES.map((opt) => {
                const isSelected = opt.id === intensity
                const risk = trainingInjuryChance(player, opt.id) * 100
                // Show what this intensity is worth AT THE PLAYER'S CURRENT ENERGY,
                // not its headline number — that's the whole point of the overtraining model.
                const liveGrowth = intensityGrowthModifier(opt.id, player.fitness.stamina)
                return (
                  <button
                    key={opt.id}
                    onClick={() => setIntensity(opt.id)}
                    className={`training-intensity text-left ${
                      isSelected ? 'selected' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`font-display tracking-wide text-sm capitalize ${isSelected ? 'text-ks-gold' : 'text-ks-ink'}`}>
                        {opt.label}
                      </span>
                      <span className={`text-[10px] ${liveGrowth >= 1 ? 'text-green-500' : 'text-orange-500'}`}>
                        {Math.round(liveGrowth * 100)}% growth
                      </span>
                    </div>
                    <p className="text-[11px] text-ks-muted leading-relaxed">{opt.blurb}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[9px] text-ks-muted uppercase tracking-wider">
                        ≈{Math.round(session.drills.length * 5 * opt.energyMod)} energy
                      </span>
                      {opt.id === 'intense' && liveGrowth < 1 && (
                        <span className="text-[9px] text-red-500 uppercase tracking-wider">overtraining</span>
                      )}
                      {risk >= 0.5 && (
                        <span className={`text-[9px] uppercase tracking-wider ${risk >= 4 ? 'text-red-500' : 'text-orange-500'}`}>
                          {risk.toFixed(1)}% injury risk
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="training-objectives">
            <div className="font-display tracking-widest text-[10px] text-ks-muted uppercase mb-3">today's objectives</div>
            <div className="flex flex-col gap-2.5">
              {session.objectives.map((o) => (
                <div key={o.id} className="flex items-center gap-3">
                  <span className="w-4 h-4 rounded-full border border-ks-border shrink-0" />
                  <span className="text-ks-ink text-sm">{o.text}</span>
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => setPhase('drills')} className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm shadow-[0_0_25px_rgba(212,175,55,0.25)]">
            start session
          </button>
          <button onClick={simulateSession} className="w-full mt-2.5 text-center text-[12px] text-ks-muted underline underline-offset-2">
            simulate this session instead
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'drills') {
    // P31 (player report: "training gets boring"). Some drills are now played
    // as a mini-game rather than a decision, so a session mixes interactions
    // instead of repeating one forever. Both paths feed the same grading
    // pipeline, so the balance underneath is unchanged.
    const mini: MiniGameKind | null = miniGameForDrill(session, session.currentDrill)
    if (mini) {
      const maxReward = Math.max(...drill.options.map((o) => o.reward))
      return (
        <div className="min-h-screen w-full bg-ks-black flex flex-col justify-center px-5 py-8">
          <div className="max-w-md mx-auto w-full">
            <TrainingMiniGame
              key={session.currentDrill}
              kind={mini}
              label={drill.title}
              ceiling={Math.max(...drill.options.map((o) => o.baseCeiling))}
              onComplete={(quality) => {
                // Quality maps onto the same reward scale a decision produces:
                // a strong performance earns the top tier, a poor one earns none.
                const earned = Math.round(quality * maxReward * 10) / 10
                const updated = recordDrillResult(session, earned, maxReward, quality >= 0.5)
                const isComplete = updated.currentDrill >= updated.drills.length
                const newXp = xpEarned + trainingXpForDrill(gradeFromRatio(quality)) + (isComplete ? streakMilestoneBonus() : 0)
                const newEnergy = energySpent + 5 * intensitySpec(intensity).energyMod
                setXpEarned(newXp)
                setEnergySpent(newEnergy)
                if (isComplete) {
                  const grade = gradeSession(updated)
                  setOutcome(applyTrainingGrowth(player, updated, grade, player.trainingMomentum ?? 0, intensity))
                  setSession(updated)
                  setPhase('results')
                  setPendingTraining(null)
                } else {
                  setSession(updated)
                  checkpoint(updated, newXp, newEnergy)
                }
              }}
            />
          </div>
        </div>
      )
    }
    return <DecisionCard key={session.currentDrill} decision={drillToDecision(player, session)} onResolved={handleDrillResolved} />
  }

  // results
  const grade = outcome!.grade
  const objs = objectivesComplete(session, grade)
  const gradeColor = GRADE_ORDER.indexOf(grade) >= GRADE_ORDER.indexOf('B') ? 'text-green-500' : grade === 'F' ? 'text-red-500' : 'text-ks-gold'

  return (
    <div className="relative min-h-screen w-full bg-ks-black flex flex-col justify-center px-5 py-8">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 20%, rgba(212,175,55,0.08), transparent 60%), linear-gradient(180deg,#0a0a09,#050504)' }} />
      <div className="relative z-10 max-w-md mx-auto w-full">
        <div className={"training-result "+(GRADE_ORDER.indexOf(grade)>=GRADE_ORDER.indexOf('A')?'elite':'')}>
          <div className="training-result-rays"/>
          <div className="training-result-kicker">SESSION COMPLETE</div>
          <div className={`training-grade ${gradeColor}`}>{grade}</div>
          <div className="training-verdict">{GRADE_ORDER.indexOf(grade)>=GRADE_ORDER.indexOf('A')?'ELITE SESSION':GRADE_ORDER.indexOf(grade)>=GRADE_ORDER.indexOf('B')?'STRONG WORK':grade==='F'?'SESSION MISSED':'WORK BANKED'}</div>
          <div className="training-payoff"><div><span>XP EARNED</span><b>+{Math.round(xpEarned)}</b></div><div><span>ENERGY</span><b>−{Math.round(energySpent)}</b></div><div><span>OBJECTIVES</span><b>{outcome!.objectivesMet}/{session.objectives.length}</b></div></div>
        </div>

        {injury && (
          <div className={`rounded-2xl border px-5 py-4 mb-3 ${
            injury.weeksOut > 0 ? 'border-red-500/40 bg-red-500/10' : 'border-orange-500/40 bg-orange-500/10'
          }`}>
            <div className="font-display tracking-widest text-[10px] text-ks-muted uppercase mb-2">
              {injury.weeksOut > 0 ? 'injury' : 'knock'}
            </div>
            <p className={`text-sm leading-relaxed ${injury.weeksOut > 0 ? 'text-red-400' : 'text-orange-400'}`}>
              {injury.description}
            </p>
          </div>
        )}

        <div className="training-development">
          <div className="font-display tracking-widest text-[10px] text-ks-muted uppercase mb-3">development report</div>
          {/* P50 — this used to show a per-attribute "+X" breakdown computed
              from a formula that no longer actually applies anything (XP
              allocation replaced it in P49) — actively misleading numbers
              that never matched what the player's attributes went on to do.
              This shows the real, truthful thing: the XP you're about to
              allocate yourself, on the very next screen. */}
          {xpEarned > 0 ? (
            <p className="text-ks-ink text-sm">
              <span className="font-display text-green-500 text-lg">{xpEarned}</span> XP earned — restricted to what you trained today. Allocate it next.
            </p>
          ) : (
            <p className="text-ks-muted text-sm">No development this session — push harder next time.</p>
          )}

          {/* Phase 11: show WHY the gains were what they were, instead of a silent number. */}
          <div className="flex flex-col gap-1 mt-3 pt-3 border-t border-ks-border/40">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-ks-muted">energy ({bandSpec(player.fitness.stamina).label})</span>
              <span className={outcome!.energyGrowthMod < 1 ? 'text-orange-500' : outcome!.energyGrowthMod > 1 ? 'text-green-500' : 'text-ks-muted'}>
                {outcome!.energyGrowthMod === 1 ? 'normal' : `×${outcome!.energyGrowthMod.toFixed(2)}`}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-ks-muted">intensity ({outcome!.intensity})</span>
              <span className={outcome!.intensityGrowthMod < 1 ? 'text-orange-500' : outcome!.intensityGrowthMod > 1 ? 'text-green-500' : 'text-ks-muted'}>
                {outcome!.intensityGrowthMod === 1 ? 'normal' : `×${outcome!.intensityGrowthMod.toFixed(2)}`}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-ks-muted">energy spent</span>
              <span className="text-orange-500">−{Math.round(energySpent)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-ks-border bg-[#0f0f0d] px-5 py-4 mb-6">
          <div className="font-display tracking-widest text-[10px] text-ks-muted uppercase mb-3">objectives</div>
          <div className="flex flex-col gap-2">
            {objs.map((o) => {
              const done = o.progress >= o.target
              return (
                <div key={o.id} className="flex items-center gap-3">
                  <span className={`text-sm ${done ? 'text-green-500' : 'text-ks-muted'}`}>{done ? '✓' : '○'}</span>
                  <span className={`text-sm ${done ? 'text-ks-ink' : 'text-ks-muted line-through'}`}>{o.text}</span>
                </div>
              )
            })}
          </div>
          <div className="text-[11px] text-ks-muted mt-3">{outcome!.objectivesMet} objective{outcome!.objectivesMet === 1 ? '' : 's'} met · bonus growth applied</div>
        </div>

        <button onClick={() => onComplete(outcome!, Math.round(energySpent), injury, Math.round(xpEarned), (SESSION_ATTRIBUTES[session.type] ?? []) as AttributeKey[])} className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm">
          done
        </button>
      </div>
    </div>
  )
}
