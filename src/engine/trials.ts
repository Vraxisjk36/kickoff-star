import { rand } from './rng'
import type { Player } from '../types/player'
import type { School } from './schools'
import { computeCurrentAbility } from './rating'

// Locked spec: 3 scripted trial weeks using the decision engine. Performance across
// the weeks sets STARTING CA within a range (potential untouched) and the squad role.

export type SquadRole = 'starting-xi' | 'bench' | 'reserves' | 'released'

export interface TrialWeekConfig {
  week: 1 | 2 | 3
  title: string
  focus: string
  // which session type drives this week's trial drills (reuses training drills)
  drillTheme: string
  /** How many decision drills this week — trimmed from 4 so the trial moves. */
  drills: number
  /** Whether the week ends with a live execution moment (Phase 13's timing bar). */
  showcase: boolean
  /** Week 3 is framed as an actual match rather than a training session. */
  isMatch?: boolean
  /** Progressive disclosure: one system introduced per week, in the coach's voice. */
  coachTip: string
}

export const TRIAL_WEEKS: TrialWeekConfig[] = [
  {
    week: 1, title: 'Session 1 — First Impressions',
    focus: 'Fitness tests, first touch, passing. The coaches are watching everyone.',
    drillTheme: 'fitness', drills: 2, showcase: true,
    coachTip: 'Every drill has a safe option and a risky one. Risk pays more — when it comes off.',
  },
  {
    week: 2, title: 'Session 2 — Small-Sided Games',
    focus: 'Tactical work and small-sided matches. Now you\'re up against the others.',
    drillTheme: 'tactical', drills: 2, showcase: true,
    coachTip: 'Timing matters as much as the decision. Strike it clean and the odds move your way.',
  },
  {
    week: 3, title: 'Session 3 — The Trial Match',
    focus: 'Eleven-a-side, coaches on the touchline, squad list decided at full time.',
    drillTheme: 'finishing', drills: 1, showcase: true, isMatch: true,
    coachTip: 'This is the one that counts. Everything you\'ve shown gets weighed up tonight.',
  },
]

// ---------------------------------------------------------------------------
// Phase 14: the rival trialist.
//
// The old trials had no stakes and no visible feedback — twelve blind drills, then a
// verdict at the end. The rival is a named kid competing for the SAME squad place, and
// crucially their running score is derived from the school's actual Starting XI
// threshold. So "you're ahead of him" literally means "you're on track to start".
// It makes the invisible bar legible without changing a single balance number.
// ---------------------------------------------------------------------------

const RIVAL_FIRST = ['Tunde', 'Marcus', 'Danny', 'Reece', 'Kofi', 'Luca', 'Jayden', 'Sam', 'Owen', 'Musa']
const RIVAL_LAST = ['Okoye', 'Bennett', 'Fletcher', 'Adeyemi', 'Walsh', 'Doyle', 'Mensah', 'Clarke', 'Reid', 'Vance']

export interface TrialRival {
  name: string
  /** The performance this school demands for a Starting XI place. */
  bar: number
}

export function generateRival(school: School): TrialRival {
  const first = RIVAL_FIRST[Math.floor(rand() * RIVAL_FIRST.length)]
  const last = RIVAL_LAST[Math.floor(rand() * RIVAL_LAST.length)]
  return { name: `${first} ${last}`, bar: requiredPerformance(school, 'startingXI') }
}

/**
 * What the rival has "scored" so far. Tracks the Starting XI bar with a little
 * wobble so it reads as a person having a good or bad day rather than a number.
 */
export function rivalScoreAt(rival: TrialRival, momentsPlayed: number, totalMoments: number): number {
  if (momentsPlayed === 0) return 0
  const progress = momentsPlayed / Math.max(1, totalMoments)
  const wobble = Math.sin(momentsPlayed * 2.1) * 0.04
  return Math.max(0, Math.min(1, rival.bar + wobble * (1 - progress)))
}

/** Immediate, specific reaction after a single moment — no more waiting 12 drills. */
export function coachReaction(quality: number): string {
  if (quality >= 0.95) return 'The coach stops what he\'s doing and watches you.'
  if (quality >= 0.6) return 'A nod from the touchline. That\'s the level.'
  if (quality >= 0.3) return 'It works, but he\'s seen better today.'
  if (quality > 0) return 'Scrappy. It counts, but only just.'
  return 'He writes something down. It isn\'t praise.'
}

/** One-line status against the rival, shown at each week's end. */
export function standingVsRival(yours: number, theirs: number): { text: string; ahead: boolean } {
  const gap = yours - theirs
  if (gap >= 0.12) return { text: 'You\'re clearly ahead of him.', ahead: true }
  if (gap >= 0.02) return { text: 'You\'ve got your nose in front.', ahead: true }
  if (gap > -0.02) return { text: 'Nothing between you two.', ahead: true }
  if (gap > -0.12) return { text: 'He\'s edging it right now.', ahead: false }
  return { text: 'He\'s well ahead of you.', ahead: false }
}

// Running trial state accumulated across the 3 weeks.
export interface TrialState {
  schoolId: string
  weeksCompleted: 0 | 1 | 2 | 3
  performanceScore: number // 0..1 running average of drill quality
  drillsPlayed: number
  qualitySum: number
  rival: TrialRival
}

export function initTrialState(schoolId: string, rival: TrialRival): TrialState {
  return { schoolId, weeksCompleted: 0, performanceScore: 0, drillsPlayed: 0, qualitySum: 0, rival }
}

/** Total scored moments across the whole trial — drives the rival's pacing. */
export const TOTAL_TRIAL_MOMENTS = TRIAL_WEEKS.reduce((n, w) => n + w.drills + (w.showcase ? 1 : 0), 0)

// Record a trial drill outcome (quality 0..1 from the decision reward tier vs max).
export function recordTrialDrill(state: TrialState, quality: number): TrialState {
  const drillsPlayed = state.drillsPlayed + 1
  const qualitySum = state.qualitySum + quality
  return { ...state, drillsPlayed, qualitySum, performanceScore: qualitySum / drillsPlayed }
}

export function completeTrialWeek(state: TrialState): TrialState {
  return { ...state, weeksCompleted: Math.min(3, state.weeksCompleted + 1) as TrialState['weeksCompleted'] }
}

// Coach feedback: narrative, no raw numbers (locked spec).
export function coachFeedback(state: TrialState): string[] {
  const p = state.performanceScore
  const lines: string[] = []
  if (p >= 0.75) {
    lines.push('"Outstanding. You\'ve got real quality — composed on the ball and sharp in the final third."')
    lines.push('"You\'ve made my decision easy."')
  } else if (p >= 0.55) {
    lines.push('"Solid. You showed good touches and a strong attitude across the three weeks."')
    lines.push('"There\'s more to come from you, but you\'ve done enough."')
  } else if (p >= 0.35) {
    lines.push('"Some promising moments, but you were inconsistent. You need to sharpen up."')
    lines.push('"You\'ll have to fight for your place."')
  } else {
    lines.push('"Honestly? You struggled. The basics need work before you\'re ready."')
    lines.push('"Keep grafting — the door isn\'t closed forever."')
  }
  return lines
}

// Final squad decision, combining performance with the school's difficulty/odds knobs.
/**
 * Role thresholds, expressed against a Greenwood-equivalent (neutral) school.
 *
 * Phase 14: re-derived from simulation rather than guessed. Actual achievable
 * performance across 3000 simulated trials runs roughly 0.22 (weak player, safe picks)
 * to 0.77 (maxed attributes, optimal picks), centred near 0.50. The old thresholds
 * (0.72 / 0.48 / 0.25) were set against an assumed 0-1 range that the scoring can't
 * actually produce, so nearly every trial ended in the reserves — a big part of why
 * the onboarding landed so flat.
 */
export const ROLE_THRESHOLDS = { startingXI: 0.60, bench: 0.40, reserves: 0.20 }

/** The performance a given school demands for a role. Used for the live progress bar too. */
export function requiredPerformance(school: School, role: 'startingXI' | 'bench' | 'reserves'): number {
  return ROLE_THRESHOLDS[role] * school.trialDifficulty / school.squadPlaceOdds
}

export function decideSquadRole(state: TrialState, school: School): SquadRole {
  // effective score = performance adjusted by how hard the school is and its place odds
  const effective = state.performanceScore * (1 / school.trialDifficulty) * school.squadPlaceOdds
  if (effective >= ROLE_THRESHOLDS.startingXI) return 'starting-xi'
  if (effective >= ROLE_THRESHOLDS.bench) return 'bench'
  if (effective >= ROLE_THRESHOLDS.reserves) return 'reserves'
  return 'released'
}

// Set starting CA within a realistic range based on trial performance (potential untouched).
// Excellent trials start higher; poor trials lower — but never near potential (locked spec).
export function trialStartingCA(state: Player, performance: number): number {
  const base = computeCurrentAbility(state) // current raw baseline from generated attrs
  // performance nudges within a small band; potential is never touched here
  const bump = (performance - 0.5) * 2 // -1 .. +1
  return Math.max(1, Math.min(state.potential - 1, base + bump))
}

export const ROLE_LABEL: Record<SquadRole, string> = {
  'starting-xi': 'Starting XI',
  bench: 'Substitute',
  reserves: 'Reserves',
  released: 'Released',
}

export const ROLE_MESSAGE: Record<SquadRole, string> = {
  'starting-xi': 'You\'ve made the Starting XI. The coach expects big things from you this season.',
  bench: 'You\'ve made the squad, but you\'ll need to fight for a starting place.',
  reserves: 'You\'re in the reserves. Keep working — your chance will come.',
  released: 'You didn\'t make the cut this time. But every setback is a setup for a comeback.',
}
