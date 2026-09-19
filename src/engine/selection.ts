// ============================================================================
// PHASE 31 — TEAM SELECTION
//
// Player report: "I began my career on the bench, is there a way for me to
// make it into the starting lineup?"
//
// The honest answer was almost no. squadRole was set at three fixed points —
// after trials, on signing for an academy (always 'bench'), and as the payoff
// of one storyline arc that had to randomly roll in. Nothing else in the game
// could promote you. A player could train perfectly and score every week and
// the coach would never notice, because no code was watching.
//
// This is that missing system: the coach picks a team every matchday, and
// you're competing with real squadmates for the shirt. It reads from state
// that already exists and is already balanced — coach trust, recent form,
// energy, reputation — so it adds a mechanic without adding a new stat.
// ============================================================================
import type { Player } from '../types/player'
import type { SquadPlayer } from './squad'
import { currentPerformance } from './youthOpportunities'
import { SUNDAY_ENERGY_MULTIPLIERS } from './sundayContracts'

export function matchAvailability(player: Player) {
  const energy = player.fitness.stamina
  return { canPlay: energy >= 30, canStart: energy >= 50,
    reason: energy < 30 ? 'Below 30% energy: you sit this match out.' : energy < 50 ? 'Below 50% energy: you can only play from the bench.' : '' }
}

/** Match-specific selection must never overwrite the player's school/club role. */
export function playerForMatch(player: Player, competitionId: string): Player {
  let squadRole = player.squadRole
  let squad = player.squad
  if (competitionId === 'sundayLeague' && player.grassrootsPath === 'school') {
    squad = player.sundaySquad
    const record = currentPerformance(player, ['sundayLeague'])
    squadRole = record.appearances >= 3 && record.average >= 6.8 ? decideSelection({ ...player, squadRole: 'bench' }, squad).role : 'bench'
  }
  if (competitionId === 'nationalChampionship' || competitionId === 'international') {
    const record = currentPerformance(player, [competitionId])
    squadRole = record.appearances >= 3 && record.average >= 7 ? 'starting-xi' : 'bench'
  }
  const availability = matchAvailability(player)
  if (!availability.canPlay) squadRole = 'reserves'
  else if (!availability.canStart && (squadRole === 'starting-xi' || !squadRole)) squadRole = 'bench'
  const matchEnergyMultiplier = (competitionId === 'sundayLeague' || competitionId === 'sundayCup') && player.careerClock.phase !== 'academy'
    ? SUNDAY_ENERGY_MULTIPLIERS[player.sundayContract?.division ?? player.sundayLeague?.playerDivision ?? 3] : 1
  return { ...player, squadRole, squad, matchEnergyMultiplier }
}

export type SquadRole = 'starting-xi' | 'bench' | 'reserves'

export interface SelectionVerdict {
  role: SquadRole
  /** Your standing among players competing for your position, 1 = first choice. */
  pecking: number
  /** How many are competing for the shirt (including you). */
  competing: number
  /** 0-100 — how convinced the coach is right now. */
  score: number
  /** Set when the role changed this week. */
  changed: 'promoted' | 'demoted' | null
  reason: string
}

/**
 * How convinced is the coach? Weighted toward the things a coach can actually
 * see week to week. Trust is the heaviest input because it's the game's
 * existing measure of "does the manager rate you", and it already moves from
 * performances, training and life events.
 */
export function selectionScore(player: Player): number {
  const trust = ((player.coachTrust ?? 0) + 10) / 20 // -10..10 → 0..1
  const ratings = (player.matchRatings ?? []).slice(-5)
  const form = ratings.length ? Math.max(0, Math.min(1, (ratings.reduce((a, b) => a + b, 0) / ratings.length - 4.5) / 3.5)) : 0.4
  const fitness = Math.max(0, Math.min(1, player.fitness.stamina / 100))
  const rep = Math.max(0, Math.min(1, (player.reputation ?? 0) / 70))

  const raw = trust * 0.42 + form * 0.32 + fitness * 0.14 + rep * 0.12
  return Math.round(raw * 100)
}

/**
 * The competition. Squadmates who play your position are the bar you have to
 * clear — this is what stops selection being a solo stat check and makes a
 * strong squad genuinely harder to break into.
 */
export function competitionFor(player: Player, squad: SquadPlayer[] | undefined): number[] {
  const rivals = (squad ?? []).filter((s) => s.position === player.position)
  // SquadPlayer.quality is already a 1-99 headline number, the same scale
  // selectionScore produces — so rivals compare directly.
  return rivals.map((r) => r.quality)
}

/**
 * Decide the player's role for this matchday.
 *
 * Deliberately sticky: a coach doesn't rip his team up every week, so you need
 * to clear the man ahead of you by a clear margin to take his shirt, and you
 * drop out only when you fall clearly behind. Without hysteresis a player
 * hovering near a rival's level would flip between bench and XI every single
 * week, which reads as the game being broken rather than as competition.
 */
export function decideSelection(player: Player, squad: SquadPlayer[] | undefined): SelectionVerdict {
  const score = selectionScore(player)
  const rivals = competitionFor(player, squad)
  const current = (player.squadRole ?? 'bench') as SquadRole

  // Hysteresis: you must beat a rival by 6 to displace him, but only fall 6
  // behind to lose your own place.
  const promoteMargin = 6
  const demoteMargin = 6

  const effectiveForPromotion = score - promoteMargin
  const effectiveForDemotion = score + demoteMargin

  const ahead = rivals.filter((r) => r > (current === 'starting-xi' ? effectiveForDemotion : effectiveForPromotion)).length
  const pecking = ahead + 1
  const competing = rivals.length + 1

  // A typical youth side plays one keeper and roughly two of most outfield
  // positions, so first or second choice starts, third makes the bench.
  const startingSlots = player.position === 'GK' ? 1 : 2
  let role: SquadRole
  if (pecking <= startingSlots) role = 'starting-xi'
  else if (pecking <= startingSlots + 2) role = 'bench'
  else role = 'reserves'

  const availability = matchAvailability(player)
  if (!availability.canPlay) role = 'reserves'
  else if (!availability.canStart && role === 'starting-xi') role = 'bench'

  const changed = role === current ? null : rank(role) > rank(current) ? 'promoted' : 'demoted'

  return { role, pecking, competing, score, changed, reason: availability.reason || reasonFor(player, score, role, changed, pecking) }
}

function rank(role: SquadRole): number {
  return role === 'starting-xi' ? 3 : role === 'bench' ? 2 : 1
}

function reasonFor(player: Player, score: number, role: SquadRole, changed: SelectionVerdict['changed'], pecking: number): string {
  const trust = player.coachTrust ?? 0
  const ratings = (player.matchRatings ?? []).slice(-3)
  const form = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
  const tired = player.fitness.stamina < 40

  if (changed === 'promoted') {
    if (role === 'starting-xi') return 'You have forced your way into the starting eleven.'
    return 'You are back in the matchday squad.'
  }
  if (changed === 'demoted') {
    if (tired) return 'You are running on empty and the coach has noticed.'
    if (form > 0 && form < 6) return 'Your recent performances have cost you your place.'
    if (trust < 0) return 'The coach has lost faith in you.'
    return 'Somebody else has taken your shirt.'
  }
  if (role === 'starting-xi') return pecking === 1 ? 'First name on the team sheet.' : 'You keep your place in the side.'
  if (role === 'bench') {
    if (score >= 55) return 'You are close. The coach is thinking about it.'
    return 'On the bench again. There is work to do.'
  }
  return 'Not in the squad. You are a long way from the coach\'s thinking.'
}

/** What the player needs to do to move up, in plain language for the hub. */
export function selectionAdvice(verdict: SelectionVerdict, player: Player): string {
  if (!matchAvailability(player).canStart) return 'Recover to 50% energy to be considered for a start. Below 30%, you cannot play.'
  if (verdict.role === 'starting-xi' && verdict.pecking === 1) return 'Keep this up and the shirt is yours.'
  const trust = player.coachTrust ?? 0
  const ratings = (player.matchRatings ?? []).slice(-5)
  const form = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
  if (trust < 1) return 'Win the coach over — train hard and take his advice seriously.'
  if (form > 0 && form < 6.5) return 'Perform on matchday. Ratings are what he remembers.'
  if (player.fitness.stamina < 45) return 'Turn up fresh. He will not pick a player running on empty.'
  return 'Keep doing what you are doing. You are close.'
}
