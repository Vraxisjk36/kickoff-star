// ============================================================================
// PHASE 49 — XP-BASED ATTRIBUTE PROGRESSION (engine layer only)
//
// Joel's design, agreed before any code: attributes are no longer grown by an
// automatic per-drill nudge. They're grown by spending XP the player earns,
// which the player allocates themselves. Two pools:
//   - TRAINING XP is restricted to exactly the attributes that session's
//     drills tested (SESSION_ATTRIBUTES already encodes this — was sitting
//     unused for this exact purpose).
//   - MATCH XP is universal — "you used everything," goes anywhere.
// No hard per-attribute cap. The brake is an ESCALATING COST CURVE: going
// from 80→90 in one attribute costs the same as spreading 40→50 across six
// different ones. Specialisation is allowed, but expensive — which is also
// exactly what produces the "90 shooting, 20 heading" identity Joel wants.
//
// This file is deliberately standalone and UI-free. Per the agreed build
// order: (1) this engine as data/logic, (2) simulate full careers and tune
// the constants against real measured outcomes, (3) only then build the
// allocation screen and wire it into training/match resolution.
// ============================================================================
import type { OutfieldAttribute, GoalkeeperAttribute } from '../types/attributes'
import type { ExecutionGrade } from './execution'

export type AttributeKey = OutfieldAttribute | GoalkeeperAttribute

// ---------------------------------------------------------------------------
// THE COST CURVE — XP required to gain +1 full level, by current level band.
//
// P49 CORRECTION: attributes in this codebase are internally on a 1-20
// scale (see rating.ts toOvr() — the 1-99 "OVR" ring is a DISPLAY mapping
// computed FROM the raw 1-20 value, floor ~33). The curve below is scaled
// for the real 1-20 range, not a mistaken 1-99 assumption.
// ---------------------------------------------------------------------------
const COST_BANDS: { below: number; cost: number }[] = [
  { below: 6, cost: 600 },
  { below: 10, cost: 1600 },
  { below: 13, cost: 3600 },
  { below: 16, cost: 8000 },
  { below: 18, cost: 18000 },
  { below: Infinity, cost: 36000 },
]

export function xpCostForLevel(currentLevel: number): number {
  for (const band of COST_BANDS) if (currentLevel < band.below) return band.cost
  return COST_BANDS[COST_BANDS.length - 1].cost
}

// P55 — real structural finding, not a tuning tweak: computeCurrentAbility's
// weighted OVR average reads only 4 GK attributes (reflexes/handling/
// gkPositioning/distribution) vs 12 for an outfield player. The cost curve
// above was position-agnostic, so the exact same amount of earned XP moved
// a keeper's OVR roughly 3x faster than an outfield player's — confirmed by
// simulation: a GK reached OVR 86 in the same 6 years an outfield player
// reached 76, with identical earning rates. This isn't about how the XP is
// SPENT (a real player choosing where to put it doesn't change how many
// attributes the weighted average reads) — it's structural, so the fix
// belongs in the cost curve itself.
export function positionCostMultiplier(isGoalkeeper: boolean): number {
  return isGoalkeeper ? 3 : 1
}

// ---------------------------------------------------------------------------
// SPENDING — continuous, not level-snapped. Attributes are already stored as
// decimals (e.g. 8.2), so XP spending fills the fractional part smoothly —
// this IS the progress bar Joel described: the fractional part of the level
// literally is how full the bar is. Correctly handles a pool big enough to
// cross more than one cost-band boundary in a single spend.
// ---------------------------------------------------------------------------
export interface SpendResult {
  newLevel: number
  xpUsed: number
  leftover: number
  levelsCrossed: number // how many whole-number boundaries were crossed — drives the "flash + reset" UI moment
}

export function spendXp(startLevel: number, xpPool: number, ceiling: number): SpendResult {
  const EPS = 1e-9
  let level = startLevel
  let remaining = Math.max(0, xpPool)
  let levelsCrossed = 0
  while (remaining > EPS && level < ceiling - EPS) {
    const bandFloor = Math.floor(level)
    const cost = xpCostForLevel(bandFloor)
    const stepTo = Math.min(bandFloor + 1, ceiling)
    const xpToReachStep = cost * (stepTo - level)
    if (remaining + EPS >= xpToReachStep) {
      remaining -= xpToReachStep
      level = stepTo
      if (Math.abs(stepTo - Math.floor(stepTo)) < EPS) levelsCrossed += 1
    } else {
      level += remaining / cost
      remaining = 0
    }
  }
  return {
    newLevel: Math.round(level * 100) / 100,
    xpUsed: Math.max(0, xpPool - remaining),
    leftover: Math.round(remaining * 100) / 100,
    levelsCrossed,
  }
}

// ---------------------------------------------------------------------------
// EARNING — training (restricted pool) and match (universal pool).
// ---------------------------------------------------------------------------

/** Base XP per drill before the execution multiplier. Tuned in P49 sim pass. */
export const XP_PER_DRILL_BASE = 35

/**
 * P49 fix for the "perfect but missed" complaint: execution grade barely
 * moves the football outcome (±14%, see EXECUTION_SWING) but now IS the
 * primary driver of how much you grow from the attempt. A perfect strike
 * that gets saved still earns full development credit — you did your job
 * correctly even when the situation didn't reward you for it. This is what
 * stops the mini-game from feeling like it's lying about what it measures.
 */
export const EXECUTION_XP_MULTIPLIER: Record<ExecutionGrade, number> = {
  miss: 0.5,
  ok: 0.8,
  good: 1.2,
  perfect: 1.6,
}

/**
 * Training drills (decision-card taps and mini-games) produce a 0-1 quality
 * ratio, not a raw ExecutionGrade the way a match TimingBar does. This maps
 * that ratio onto the same grade vocabulary so trainingXpForDrill can be
 * reused for both — one XP formula, not two.
 */
export function gradeFromRatio(ratio: number): ExecutionGrade {
  if (ratio >= 0.85) return 'perfect'
  if (ratio >= 0.55) return 'good'
  if (ratio >= 0.25) return 'ok'
  return 'miss'
}

export function trainingXpForDrill(grade: ExecutionGrade): number {
  return Math.round(XP_PER_DRILL_BASE * EXECUTION_XP_MULTIPLIER[grade])
}

export type CompetitionTier = 'grassroots' | 'academy' | 'cup' | 'international'

/** Base match XP by competition tier — a bigger stage genuinely means more development, not just more prestige. */
export const MATCH_XP_BASE: Record<CompetitionTier, number> = {
  grassroots: 150,
  academy: 350,
  cup: 520,
  international: 850,
}

/** Performance scales the base — a poor game still teaches you something, a great one teaches you a lot more. */
export function matchPerformanceMultiplier(rating: number): number {
  if (rating >= 8.5) return 1.6
  if (rating >= 7.5) return 1.35
  if (rating >= 6.5) return 1.05
  if (rating >= 5.5) return 0.8
  return 0.45
}

export const XP_GOAL_BONUS = 75
export const XP_ASSIST_BONUS = 45

export function matchXpEarned(tier: CompetitionTier, rating: number, goals: number, assists: number): number {
  const base = MATCH_XP_BASE[tier] * matchPerformanceMultiplier(rating)
  return Math.round(base + goals * XP_GOAL_BONUS + assists * XP_ASSIST_BONUS)
}
