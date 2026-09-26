// ============================================================================
// PHASE 28 — STORYLINES (multi-week arcs)
//
// The problem this solves: every life event resolved in the same week it
// fired. Nothing could be OWED. The coach couldn't say "two goals in three
// weeks or you're benched", because there was no machinery to remember the
// promise, watch your matches, and come back with a verdict.
//
// An ActiveArc is a promise the game makes to itself. It has:
//   - an objective the engine can MEASURE (goals, ratings, trust, bond...)
//   - a deadline in absolute weeks
//   - a success payoff and a failure consequence, both real
// Arcs tick once per week in the store. When one resolves, its verdict is
// queued for the UI as a beat the player actually sees.
//
// Arcs are started BY events (a choice you made in week 4 opens the arc that
// pays off in week 7), which is what makes the life layer feel causal.
// ============================================================================
import { rand } from './rng'
import type { Player } from '../types/player'

export type ArcObjective =
  | { kind: 'scoreGoals'; count: number }
  | { kind: 'assists'; count: number }
  | { kind: 'avgRating'; value: number; minMatches: number }
  | { kind: 'appearances'; count: number }
  | { kind: 'reachTrust'; value: number }
  | { kind: 'reachReputation'; value: number }
  | { kind: 'keepBond'; relationshipId: string; min: number }
  | { kind: 'raiseBond'; relationshipId: string; min: number }
  | { kind: 'stayFit' } // simply avoid injury until the deadline

export interface ArcConsequence {
  confidence?: number
  coachTrust?: number
  reputation?: number
  energy?: number
  /** bond change applied to the arc's linked person, if any */
  bond?: number
  /** squad role forced on failure/success (the "or you're benched" teeth) */
  setSquadRole?: 'starting-xi' | 'bench' | 'reserves'
  narrative: string
}

export interface ActiveArc {
  id: string
  key: string // template key, for no-repeat tracking
  title: string
  /** Shown on the hub while the arc is live. */
  brief: string
  objective: ArcObjective
  startedWeek: number // absolute totalWeeksElapsed
  deadlineWeek: number // absolute
  /** Progress snapshot taken when the arc started, so we measure the DELTA. */
  baseline: { goals: number; assists: number; appearances: number; ratingsCount: number }
  onSuccess: ArcConsequence
  onFailure: ArcConsequence
  /** Linked person, if this arc is about a relationship. */
  relationshipId?: string
  relationshipName?: string
}

export interface ArcVerdict {
  arc: ActiveArc
  succeeded: boolean
  consequence: ArcConsequence
}

// ---------------------------------------------------------------------------
// Arc templates. Each is gated so it only opens when it makes sense, and each
// has REAL teeth — a failure that costs something the player will feel.
// ---------------------------------------------------------------------------
export interface ArcTemplate {
  key: string
  title: string
  weeks: number
  /** Can this arc start right now? */
  when: (p: Player, week: number) => boolean
  weight: number
  build: (p: Player) => Omit<ActiveArc, 'id' | 'startedWeek' | 'deadlineWeek' | 'baseline' | 'key' | 'title'>
}

const isStarter = (p: Player) => p.squadRole === 'starting-xi'
const benchedOrWorse = (p: Player) => p.squadRole === 'bench' || p.squadRole === 'reserves'
const hasPlayed = (p: Player) => (p.career?.appearances ?? 0) >= 3

export const ARC_TEMPLATES: ArcTemplate[] = [
  {
    key: 'coach-ultimatum', title: 'Prove It Or Lose It', weeks: 3, weight: 3,
    when: (p) => isStarter(p) && (p.coachTrust ?? 0) < 2 && hasPlayed(p),
    build: () => ({
      brief: 'The coach wants 2 goal contributions in 3 weeks — or you lose your place.',
      objective: { kind: 'scoreGoals', count: 2 },
      onSuccess: { coachTrust: 2, confidence: 2, narrative: 'You delivered exactly what he asked for. He says nothing, but you keep the shirt.' },
      onFailure: { coachTrust: -1, confidence: -2, setSquadRole: 'bench', narrative: "He warned you. You're on the bench for the foreseeable." },
    }),
  },
  {
    key: 'earn-your-shirt', title: 'Earn Your Shirt', weeks: 4, weight: 3,
    when: (p) => benchedOrWorse(p) && hasPlayed(p),
    build: () => ({
      brief: 'Play 3 matches at a 6.8 average in 4 weeks and the coach will start you.',
      objective: { kind: 'avgRating', value: 6.8, minMatches: 3 },
      onSuccess: { coachTrust: 2, confidence: 2, setSquadRole: 'starting-xi', narrative: 'You forced his hand. The shirt is yours.' },
      onFailure: { confidence: -1, narrative: 'Not enough. You stay where you are and the door stays shut.' },
    }),
  },
  {
    key: 'scout-watching', title: 'They\'re Watching', weeks: 3, weight: 2,
    when: (p) => (p.reputation ?? 0) >= 18 && (p.scoutWatchers ?? []).length > 0,
    build: () => ({
      brief: 'A scout is coming back in 3 weeks. Keep a 7.0 average across 2 matches.',
      objective: { kind: 'avgRating', value: 7.0, minMatches: 2 },
      onSuccess: { reputation: 2, confidence: 2, narrative: 'He saw exactly what he came for. Notes were taken.' },
      onFailure: { confidence: -1, narrative: 'He watched two quiet games and left early.' },
    }),
  },
  {
    key: 'family-grades', title: 'The Deal At Home', weeks: 4, weight: 3,
    when: (p) => (p.totalWeeksElapsed ?? 0) > 4,
    build: (p) => ({
      brief: 'Keep your parent onside for 4 weeks or football gets cut back.',
      objective: { kind: 'keepBond', relationshipId: relId(p, 'parent'), min: 25 },
      onSuccess: { confidence: 1, energy: 6, bond: 6, narrative: 'Home is calm. They even come to the next away game.' },
      onFailure: { confidence: -2, energy: -8, bond: -8, narrative: 'The row you were avoiding finally happens. Training gets cut for a fortnight.' },
    }),
  },
  {
    key: 'rival-duel', title: 'Head To Head', weeks: 5, weight: 3,
    when: (p) => hasPlayed(p),
    build: (p) => ({
      brief: 'Your rival reckons he ends the month with more goals than you. Get 3.',
      objective: { kind: 'scoreGoals', count: 3 },
      relationshipId: relId(p, 'rival'),
      onSuccess: { confidence: 3, reputation: 1, bond: 10, narrative: 'He watched you do it. Grudging respect is still respect.' },
      onFailure: { confidence: -2, bond: -6, narrative: "He won't let this go. Not this season, anyway." },
    }),
  },
  {
    key: 'mentor-trial', title: 'Under His Wing', weeks: 4, weight: 2,
    when: (p) => (p.coachTrust ?? 0) >= 2 && hasPlayed(p),
    build: () => ({
      brief: 'An old pro offered to work with you — turn up sharp for 4 matches.',
      objective: { kind: 'appearances', count: 4 },
      onSuccess: { confidence: 2, coachTrust: 1, narrative: 'He tells you you remind him of himself. Then makes you do it again, properly.' },
      onFailure: { confidence: -1, narrative: 'He stops texting back. People are busy.' },
    }),
  },
  {
    key: 'injury-comeback', title: 'All The Way Back', weeks: 5, weight: 3,
    when: (p) => (p.recentInjuryCount ?? 0) > 0 && !p.injury,
    build: () => ({
      brief: 'Get through 5 weeks without breaking down again.',
      objective: { kind: 'stayFit' },
      onSuccess: { confidence: 3, narrative: 'Five weeks, no setbacks. You stop thinking about it every time you sprint.' },
      onFailure: { confidence: -2, narrative: 'Down again. The doubt creeps in properly this time.' },
    }),
  },
  {
    key: 'captain-audition', title: 'Armband Audition', weeks: 4, weight: 2,
    when: (p) => (p.coachTrust ?? 0) >= 3 && isStarter(p),
    build: () => ({
      brief: "The coach is choosing a vice-captain. Hit a 7.2 average over 3 games.",
      objective: { kind: 'avgRating', value: 7.2, minMatches: 3 },
      onSuccess: { coachTrust: 2, confidence: 3, reputation: 1, narrative: 'You get the nod. The lads seem fine with it, which is the real test.' },
      onFailure: { confidence: -1, narrative: 'It goes to someone else. He says it was close.' },
    }),
  },
  {
    key: 'social-repair', title: 'Mending Fences', weeks: 3, weight: 2,
    when: (p) => (p.relationships ?? []).some((r) => !r.ended && r.bond <= -20),
    build: (p) => {
      const worst = [...(p.relationships ?? [])].filter((r) => !r.ended).sort((a, b) => a.bond - b.bond)[0]
      return {
        brief: `Things are bad with ${worst?.name ?? 'someone'}. Fix it within 3 weeks.`,
        objective: { kind: 'raiseBond', relationshipId: worst?.id ?? '', min: 0 },
        relationshipId: worst?.id,
        relationshipName: worst?.name,
        onSuccess: { confidence: 2, bond: 8, narrative: 'You sorted it. It took effort, and they noticed the effort.' },
        onFailure: { confidence: -2, bond: -10, narrative: 'It hardened. Some things you leave too long.' },
      }
    },
  },
  {
    key: 'reputation-push', title: 'Make Them Notice', weeks: 6, weight: 2,
    when: (p) => (p.reputation ?? 0) >= 10 && (p.reputation ?? 0) < 45,
    build: (p) => ({
      brief: `Push your reputation past ${Math.round((p.reputation ?? 0) + 6)} within 6 weeks.`,
      objective: { kind: 'reachReputation', value: Math.round((p.reputation ?? 0) + 6) },
      onSuccess: { reputation: 1, confidence: 2, narrative: 'Word is travelling. More people at the fence than last month.' },
      onFailure: { confidence: -1, narrative: 'A quiet spell. Nobody outside the club is talking about you.' },
    }),
  },
  {
    key: 'partner-balance', title: 'Two Lives', weeks: 4, weight: 2,
    when: (p) => (p.relationships ?? []).some((r) => !r.ended && r.kind === 'partner'),
    build: (p) => {
      const partner = (p.relationships ?? []).find((r) => !r.ended && r.kind === 'partner')
      return {
        brief: `Keep things good with ${partner?.name ?? 'them'} while the season runs.`,
        objective: { kind: 'keepBond', relationshipId: partner?.id ?? '', min: 20 },
        relationshipId: partner?.id,
        relationshipName: partner?.name,
        onSuccess: { confidence: 3, energy: 4, bond: 5, narrative: 'You managed both. It sounds small. It really is not.' },
        onFailure: { confidence: -3, bond: -12, narrative: 'Something had to give, and it was not football.' },
      }
    },
  },
  {
    key: 'creator-run', title: 'The Provider', weeks: 4, weight: 2,
    when: (p) => hasPlayed(p) && p.position !== 'GK' && p.position !== 'CB',
    build: () => ({
      brief: 'Set up 2 goals in 4 weeks — the coach wants to see you create, not just finish.',
      objective: { kind: 'assists', count: 2 },
      onSuccess: { coachTrust: 2, confidence: 2, narrative: 'Two assists and a new line in his notebook: sees the pass.' },
      onFailure: { coachTrust: -1, narrative: "He says you're playing for yourself. It stings because it's fair." },
    }),
  },
  {
    key: 'trust-rebuild', title: 'Back In The Fold', weeks: 5, weight: 3,
    when: (p) => (p.coachTrust ?? 0) <= -2,
    build: () => ({
      brief: 'Get the coach back onside — reach a trust level of 0 within 5 weeks.',
      objective: { kind: 'reachTrust', value: 0 },
      onSuccess: { coachTrust: 1, confidence: 2, narrative: 'He talks to you like a footballer again rather than a problem.' },
      onFailure: { confidence: -2, setSquadRole: 'reserves', narrative: 'He has stopped trying with you. Reserves on Thursday.' },
    }),
  },
  {
    key: 'iron-man', title: 'A regular in the side', weeks: 6, weight: 2,
    when: (p) => isStarter(p) && !p.injury && hasPlayed(p),
    build: () => ({
      brief: 'Make 5 appearances over the next 6 weeks.',
      objective: { kind: 'appearances', count: 5 },
      onSuccess: { coachTrust: 2, reputation: 1, confidence: 2, narrative: 'Five appearances in six weeks. You are becoming a regular.' },
      onFailure: { confidence: -1, narrative: 'You did not reach five appearances this time. There will be another chance to establish yourself.' },
    }),
  },
]

function relId(p: Player, kind: string): string {
  return (p.relationships ?? []).find((r) => !r.ended && r.kind === kind)?.id ?? ''
}

// ---------------------------------------------------------------------------
// lifecycle
// ---------------------------------------------------------------------------

export function baselineOf(player: Player): ActiveArc['baseline'] {
  return {
    goals: player.career?.goals ?? 0,
    assists: player.career?.assists ?? 0,
    appearances: player.career?.appearances ?? 0,
    ratingsCount: (player.matchRatings ?? []).length,
  }
}

/** Roll for a new arc. Deliberately conservative — arcs should feel like events, not a chore list. */
export function maybeStartArc(player: Player, week: number, activeArcs: ActiveArc[], recentKeys: string[]): ActiveArc | null {
  if (activeArcs.length >= 2) return null // never more than two live promises at once
  if (rand() > 0.22) return null
  const eligible = ARC_TEMPLATES.filter((t) =>
    !activeArcs.some((a) => a.key === t.key) &&
    !recentKeys.slice(-6).includes(t.key) &&
    t.when(player, week)
  )
  if (eligible.length === 0) return null
  const total = eligible.reduce((a, t) => a + t.weight, 0)
  let roll = rand() * total
  const template = eligible.find((t) => (roll -= t.weight) <= 0) ?? eligible[0]
  const built = template.build(player)
  // arcs keyed to a person that doesn't exist are meaningless — skip
  if ((built.objective.kind === 'keepBond' || built.objective.kind === 'raiseBond') && !built.objective.relationshipId) return null
  const absoluteWeek = player.totalWeeksElapsed ?? 0
  return {
    ...built,
    id: crypto.randomUUID(),
    key: template.key,
    title: template.title,
    startedWeek: absoluteWeek,
    deadlineWeek: absoluteWeek + template.weeks,
    baseline: baselineOf(player),
  }
}

/** Has this arc been satisfied yet? Measured as a DELTA from its baseline. */
export function arcSatisfied(arc: ActiveArc, player: Player): boolean {
  const c = player.career
  const o = arc.objective
  switch (o.kind) {
    case 'scoreGoals': return (c?.goals ?? 0) - arc.baseline.goals >= o.count
    case 'assists': return (c?.assists ?? 0) - arc.baseline.assists >= o.count
    case 'appearances': return (c?.appearances ?? 0) - arc.baseline.appearances >= o.count
    case 'avgRating': {
      const played = (c?.appearances ?? 0) - arc.baseline.appearances
      if (played < o.minMatches) return false
      const recent = (player.matchRatings ?? []).slice(-played)
      if (recent.length === 0) return false
      return recent.reduce((a, b) => a + b, 0) / recent.length >= o.value
    }
    case 'reachTrust': return (player.coachTrust ?? 0) >= o.value
    case 'reachReputation': return (player.reputation ?? 0) >= o.value
    case 'keepBond': {
      const r = (player.relationships ?? []).find((x) => x.id === o.relationshipId)
      return !!r && r.bond >= o.min
    }
    case 'raiseBond': {
      const r = (player.relationships ?? []).find((x) => x.id === o.relationshipId)
      return !!r && r.bond >= o.min
    }
    case 'stayFit': return !player.injury
  }
}

/**
 * Tick every live arc. Arcs resolve EARLY on success for the countable
 * objectives (hitting the target is the moment, not the deadline), but
 * "keep/stay" objectives can only be judged at the deadline — you haven't
 * kept anything until the time is up.
 */
export function tickArcs(arcs: ActiveArc[], player: Player): { remaining: ActiveArc[]; verdicts: ArcVerdict[] } {
  const remaining: ActiveArc[] = []
  const verdicts: ArcVerdict[] = []
  const now = player.totalWeeksElapsed ?? 0

  for (const arc of arcs) {
    const holdToDeadline = arc.objective.kind === 'keepBond' || arc.objective.kind === 'stayFit'
    const satisfied = arcSatisfied(arc, player)

    if (!holdToDeadline && satisfied) {
      verdicts.push({ arc, succeeded: true, consequence: arc.onSuccess })
      continue
    }
    // a 'keep' arc that has already been broken fails immediately — waiting
    // out the clock on a bond that's already collapsed is just dead weight
    if (holdToDeadline && !satisfied && arc.objective.kind === 'keepBond') {
      verdicts.push({ arc, succeeded: false, consequence: arc.onFailure })
      continue
    }
    if (now >= arc.deadlineWeek) {
      verdicts.push({ arc, succeeded: satisfied, consequence: satisfied ? arc.onSuccess : arc.onFailure })
      continue
    }
    remaining.push(arc)
  }
  return { remaining, verdicts }
}

export function weeksLeft(arc: ActiveArc, player: Player): number {
  return Math.max(0, arc.deadlineWeek - (player.totalWeeksElapsed ?? 0))
}

/** Human-readable progress line for the hub tracker. */
export function arcProgressText(arc: ActiveArc, player: Player): string {
  const c = player.career
  const o = arc.objective
  switch (o.kind) {
    case 'scoreGoals': return `${Math.min(o.count, (c?.goals ?? 0) - arc.baseline.goals)}/${o.count} goals`
    case 'assists': return `${Math.min(o.count, (c?.assists ?? 0) - arc.baseline.assists)}/${o.count} assists`
    case 'appearances': return `${Math.min(o.count, (c?.appearances ?? 0) - arc.baseline.appearances)}/${o.count} matches`
    case 'avgRating': {
      const played = (c?.appearances ?? 0) - arc.baseline.appearances
      const recent = (player.matchRatings ?? []).slice(-Math.max(0, played))
      const avg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0
      return `${played}/${o.minMatches} matches · ${avg ? avg.toFixed(1) : '—'} avg (need ${o.value})`
    }
    case 'reachTrust': return `trust ${(player.coachTrust ?? 0).toFixed(1)} / ${o.value}`
    case 'reachReputation': return `rep ${Math.round(player.reputation ?? 0)} / ${o.value}`
    case 'keepBond':
    case 'raiseBond': {
      const r = (player.relationships ?? []).find((x) => x.id === o.relationshipId)
      return `${r?.name ?? 'them'}: ${Math.round(r?.bond ?? 0)} (need ${o.min})`
    }
    case 'stayFit': return player.injury ? 'injured' : 'fit'
  }
}
