// The universal decision shape reused across match key-moments, training drills,
// trial weeks, GK saves, and life events. Per locked spec: context → 2-3 options → outcome.

export type DecisionContext = 'match' | 'training' | 'trial' | 'gk' | 'event'

export interface DecisionOption {
  id: string
  label: string
  hint?: string // short framing text, never a raw probability (per hidden-number rule for options)
  // Hidden from player: the resolution weighting the engine uses.
  successChance: number // 0-1
  // Effects applied on success vs failure (partial effects handled by engine later).
  onSuccess?: OutcomeEffect
  onFailure?: OutcomeEffect
}

export interface OutcomeEffect {
  confidence?: number
  energy?: number
  // Phase 15: life events need to move the state they're gated on, otherwise the
  // life layer is decorative — you'd make choices that never change anything.
  coachTrust?: number
  reputation?: number
  narrative?: string // outcome commentary line

  // Phase 28: life events can now move RELATIONSHIPS and open multi-week ARCS.
  // relationshipDelta targets the person the event was built around (events
  // carry that id in Decision.relationshipId), so a fallout in week 4 is with
  // a specific named person who remembers it in week 6.
  relationshipDelta?: number
  /** Adds a new person to the cast (a partner appears, an agent calls). */
  addPerson?: { kind: import('../engine/relationships').RelationshipKind; note: string; bond?: number }
  /** Opens a storyline arc by template key. */
  startArc?: string
  /** P29: cash won or spent by this outcome. */
  money?: number
  /** Persist a chosen route through a three-beat weekly story. */
  storyChoice?: { key: string; path: 'help' | 'focus'; beat: 1 | 2 | 3 }
  attributePractice?: 'passing' | 'shooting' | 'tackling' | 'vision' | 'handling' | 'distribution'
}

export interface Decision {
  id: string
  context: DecisionContext
  /** Phase 28: the person this decision concerns, if any. */
  relationshipId?: string
  relationshipName?: string
  // Header/context shown above the options.
  situation: string
  meta?: string // e.g. "67' · 1-1" for match, "finishing drill 2/3" for training
  options: DecisionOption[]
}

export interface DecisionResult {
  chosen: DecisionOption
  success: boolean
  effect: OutcomeEffect
}

export function resolveDecision(option: DecisionOption): DecisionResult {
  const success = Math.random() < option.successChance
  const effect = (success ? option.onSuccess : option.onFailure) ?? {}
  return { chosen: option, success, effect }
}
