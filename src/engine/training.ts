import { rand } from './rng'
import { effectiveValues } from './economy'
import type { Player } from '../types/player'
import type { TrainingSessionType, TrainingGrade } from '../types/training'
import { SESSION_ATTRIBUTES, SESSION_LABEL, sessionPoolFor, GRADE_ORDER } from '../types/training'
import type { OutfieldAttribute, GoalkeeperAttribute } from '../types/attributes'
import { DRILL_POOLS, type DrillTemplate } from './drills'
import { trainingGrowthModifier, intensityGrowthModifier, intensitySpec, type TrainingIntensity } from './energy'
import type { Decision, DecisionOption } from '../types/decision'

type AnyAttribute = OutfieldAttribute | GoalkeeperAttribute

function id() { return crypto.randomUUID() }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

function attrValue(player: Player, attr: AnyAttribute): number {
  // P29: drill performance uses boosted values...
  const values = effectiveValues(player)
  return values[attr] ?? 8
}

// --- Session type selection (locked spec Section 2) ---
// Coach-assigned: weight the position pool toward the player's weakest relevant attributes.
export function pickCoachSession(player: Player): TrainingSessionType {
  const pool = sessionPoolFor(player.position)
  const entries = Object.entries(pool) as [TrainingSessionType, number][]
  // weakness bias: sessions targeting low attributes get a boost
  const scored = entries.map(([type, baseWeight]) => {
    const attrs = SESSION_ATTRIBUTES[type] ?? []
    const avg = attrs.length ? attrs.reduce((s, a) => s + attrValue(player, a), 0) / attrs.length : 10
    const weaknessBoost = (20 - avg) / 10 // lower attr -> bigger boost
    return { type, weight: baseWeight * (1 + weaknessBoost) }
  })
  const total = scored.reduce((s, x) => s + x.weight, 0)
  let r = rand() * total
  for (const s of scored) { r -= s.weight; if (r <= 0) return s.type }
  return scored[0].type
}

export function playerChoiceSessions(player: Player): TrainingSessionType[] {
  return Object.keys(sessionPoolFor(player.position)) as TrainingSessionType[]
}

// --- Procedural probability from attributes (locked spec: baseCeiling x attributeModifier x mentalState) ---
function optionSuccessChance(player: Player, baseCeiling: number, keyAttributes: AnyAttribute[]): number {
  const avgAttr = keyAttributes.length
    ? keyAttributes.reduce((s, a) => s + attrValue(player, a), 0) / keyAttributes.length
    : 10
  // New youth players start with modest attributes. The old .5 modifier made
  // even a safe 90% option fail roughly a third of the time at age 14.
  const attributeModifier = 0.78 + (avgAttr / 20) * 0.32
  // mental-state modifier: confidence nudges, disproportionately affecting riskier (lower ceiling) options
  const riskFactor = 1 - baseCeiling // riskier options are more confidence-sensitive
  const mentalMod = 1 + (player.confidence.value / 40) * (0.5 + riskFactor)
  return clamp(baseCeiling * attributeModifier * mentalMod, 0.12, 0.97)
}

// --- Objectives (locked spec Section 2) ---
export interface SessionObjective {
  id: string
  text: string
  target: number
  progress: number
  kind: 'successes' | 'grade-floor' | 'no-fails'
}

function generateObjectives(sessionType: TrainingSessionType, drillCount: number): SessionObjective[] {
  const label = SESSION_LABEL[sessionType].toLowerCase()
  const objs: SessionObjective[] = [
    { id: id(), text: `Complete ${Math.max(2, drillCount - 1)} successful ${label} reps`, target: Math.max(2, drillCount - 1), progress: 0, kind: 'successes' },
    { id: id(), text: 'Finish with a B grade or higher', target: GRADE_ORDER.indexOf('B'), progress: 0, kind: 'grade-floor' },
  ]
  if (drillCount >= 4) {
    objs.push({ id: id(), text: 'No failed drills', target: 0, progress: 0, kind: 'no-fails' })
  }
  return objs
}

// --- Session object ---
export interface TrainingSession {
  id: string
  type: TrainingSessionType
  label: string
  drills: DrillTemplate[]
  objectives: SessionObjective[]
  // rolling results
  currentDrill: number
  successes: number
  fails: number
  qualitySum: number // accumulates reward-weighted quality for grading
  qualityMax: number
}

export function generateSession(player: Player, type?: TrainingSessionType): TrainingSession {
  const sessionType = type ?? pickCoachSession(player)
  const pool = DRILL_POOLS[sessionType]
  // pull 3-5 drills (repeat from pool if pool is small)
  const count = clamp(3 + Math.floor(rand() * 3), 3, 5)
  // P69 — real, confirmed bug (Joel: "you basically could get the same
  // event 3 times"): drills were picked sequentially by index
  // (pool[i % pool.length]) — meaning every session of a given type
  // showed the exact same fixed sequence every single time it was
  // generated, and any pool smaller than the session length guaranteed
  // duplicate drills within one sitting. Now genuinely shuffled, and only
  // repeats a drill within a session once every other drill in the pool
  // has already appeared — real variety whenever the pool can support it,
  // rather than the same handful of drills forever.
  const shuffled = [...pool].sort(() => rand() - 0.5)
  const drills: DrillTemplate[] = []
  for (let i = 0; i < count; i++) drills.push(shuffled[i % shuffled.length])
  return {
    id: id(),
    type: sessionType,
    label: SESSION_LABEL[sessionType],
    drills,
    objectives: generateObjectives(sessionType, count),
    currentDrill: 0,
    successes: 0,
    fails: 0,
    qualitySum: 0,
    qualityMax: 0,
  }
}

// P44 — real playtester feedback: "feels more like luck (or does it depend on
// your ability?)". It genuinely does — optionSuccessChance is fully
// attribute-driven — but nothing on screen ever said so. The no-raw-number
// rule stays (Decision.hint's contract explicitly forbids a percentage), but
// naming WHICH attribute an option leans on answers the real question without
// breaking that rule: "high risk, high reward" becomes "high risk, high
// reward — tests Shooting", which is enough for a player to notice their weak
// attributes are the ones failing, without turning it into a spreadsheet.
const ATTRIBUTE_LABEL: Record<string, string> = {
  shooting: 'Shooting', passing: 'Passing', dribbling: 'Dribbling', tackling: 'Tackling',
  pace: 'Pace', strength: 'Strength', stamina: 'Stamina', agility: 'Agility',
  vision: 'Vision', composure: 'Composure', positioning: 'Positioning', concentration: 'Concentration',
  reflexes: 'Reflexes', handling: 'Handling', gkPositioning: 'Positioning', distribution: 'Distribution',
}
function withAttributeHint(hint: string, keyAttributes: string[]): string {
  const primary = keyAttributes[0]
  const label = primary ? ATTRIBUTE_LABEL[primary] : undefined
  return label ? `${hint} · tests ${label}` : hint
}

// Build the Decision for the current drill, with live attribute-driven odds.
export function drillToDecision(player: Player, session: TrainingSession): Decision {
  const drill = session.drills[session.currentDrill]
  const options: DecisionOption[] = drill.options.map((opt) => {
    const chance = optionSuccessChance(player, opt.baseCeiling, opt.keyAttributes)
    return {
      id: id(),
      label: opt.label,
      hint: withAttributeHint(opt.hint, opt.keyAttributes),
      successChance: chance,
      onSuccess: { confidence: 0, energy: -5, narrative: opt.successText },
      onFailure: { confidence: 0, energy: -5, narrative: opt.failText },
    }
  })
  return {
    id: id(),
    context: 'training',
    situation: drill.situation,
    meta: `${drill.title} · ${session.currentDrill + 1}/${session.drills.length}`,
    options,
  }
}

// Record a drill result into the session, tracking quality for grading.
export function recordDrillResult(
  session: TrainingSession, chosenRewardTier: number, maxRewardTier: number, success: boolean
): TrainingSession {
  return {
    ...session,
    currentDrill: session.currentDrill + 1,
    successes: session.successes + (success ? 1 : 0),
    fails: session.fails + (success ? 0 : 1),
    qualitySum: session.qualitySum + (success ? chosenRewardTier : 0),
    qualityMax: session.qualityMax + maxRewardTier,
  }
}

// --- Grading (locked spec Section 1) ---
export function gradeSession(session: TrainingSession): TrainingGrade {
  const ratio = session.qualityMax > 0 ? session.qualitySum / session.qualityMax : 0
  if (ratio >= 0.85) return 'A+'
  if (ratio >= 0.68) return 'A'
  if (ratio >= 0.5) return 'B'
  if (ratio >= 0.33) return 'C'
  if (ratio >= 0.15) return 'D'
  return 'F'
}

export function objectivesComplete(session: TrainingSession, grade: TrainingGrade): SessionObjective[] {
  return session.objectives.map((o) => {
    let done = false
    if (o.kind === 'successes') done = session.successes >= o.target
    if (o.kind === 'grade-floor') done = GRADE_ORDER.indexOf(grade) >= o.target
    if (o.kind === 'no-fails') done = session.fails === 0
    return { ...o, progress: done ? o.target : o.progress }
  })
}

// --- Potential-weighted attribute growth + momentum (locked spec Section 1 & 2) ---
export interface TrainingOutcome {
  grade: TrainingGrade
  attributeGains: Partial<Record<string, number>>
  objectivesMet: number
  newMomentum: number
  confidenceDelta: number
  // Phase 11: energy is no longer silent. These are reported so the results screen
  // can show the player exactly why their gains were what they were.
  intensity: TrainingIntensity
  energyGrowthMod: number   // penalty/bonus from how tired they were
  intensityGrowthMod: number // bonus/penalty from the intensity they picked
  trustDelta: number
}

export function applyTrainingGrowth(
  player: Player, session: TrainingSession, grade: TrainingGrade, momentum: number,
  intensity: TrainingIntensity = 'normal'
): TrainingOutcome {
  const objs = objectivesComplete(session, grade)
  const objectivesMet = objs.filter((o) => o.progress >= o.target).length

  // momentum: consecutive good sessions build a small buffer (-3..+3)
  const gradeIsGood = GRADE_ORDER.indexOf(grade) >= GRADE_ORDER.indexOf('B')
  const newMomentum = clamp((momentum ?? 0) + (gradeIsGood ? 1 : -1), -3, 3)

  // Phase 11: energy and intensity now gate growth. Previously growth ignored fatigue
  // entirely, which is the main reason energy felt like it did nothing.
  const energyGrowthMod = trainingGrowthModifier(player.fitness.stamina)
  // Band-aware: intense while tired is overtraining and gains LESS than normal.
  const intensityGrowthMod = intensityGrowthModifier(intensity, player.fitness.stamina)
  const iSpec = intensitySpec(intensity)

  // P50 cleanup — this function used to compute an elaborate headroom/
  // momentum/energy/intensity/archetype-weighted per-attribute gain here,
  // but P49 already stopped anything from ever APPLYING it (spendAttributeXp
  // / the allocation screen is the only real growth path now), and the
  // session results screen no longer DISPLAYS it either (TrainingScreen.tsx
  // was showing numbers that never actually happened). That computation —
  // and the baseGrowth/objectiveBonus/momentumMod/SESSION_ATTRIBUTES lookup
  // that only ever fed it — had zero remaining consumers, so it's gone
  // rather than left computing something nobody reads. attributeGains stays
  // on the TrainingOutcome shape as an empty object rather than being
  // ripped out of the type, since other code still destructures this shape.

  const confidenceDelta = gradeIsGood ? 1 : grade === 'F' ? -1 : 0
  return {
    grade, attributeGains: {}, objectivesMet, newMomentum, confidenceDelta,
    intensity, energyGrowthMod, intensityGrowthMod, trustDelta: iSpec.trustDelta,
  }
}


// ---------------------------------------------------------------------------
// P31 — which drills are played as mini-games
// ---------------------------------------------------------------------------

/**
 * Roughly half of each session's drills are played as a mini-game rather than
 * a decision, chosen deterministically from the session and drill index so a
 * re-render can't switch the interaction underneath the player mid-drill.
 *
 * The mini-game is matched to what the session is actually training:
 *   - technical work (finishing, passing, touch) → TARGETS
 *   - possession and awareness work → RONDO
 *   - physical work → SPRINT
 */
export function miniGameForDrill(session: TrainingSession, index: number): 'rondo' | 'targets' | 'sprint' | null {
  // alternate: decision, mini-game, decision, mini-game...
  if (index % 2 === 0) return null

  switch (session.type) {
    case 'defending-physical':
    case 'gk-reactions':
      return 'sprint'
    case 'passing-vision':
    case 'tactical':
    case 'gk-distribution':
      return 'rondo'
    case 'finishing':
    case 'dribbling':
    case 'gk-shot-stopping':
    case 'gk-positioning':
      return 'targets'
    default:
      return 'targets'
  }
}
