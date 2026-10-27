// ============================================================================
// PHASE 32 — STREET GAMES
//
// The problem, in the player's words: "it can sometimes get boring waiting an
// entire week to play a match". A career sim that only lets you play on Sunday
// leaves five days of menus in between.
//
// A street game is a match that costs you something and gives you something,
// but sits outside the competitive structure entirely:
//   - no clock. First to 5 goals, that's it.
//   - you get at least 3 chances and EVERY chance is a mini-game, played
//     faster than the training ones
//   - it never touches the league table, your appearance record or your
//     selection standing
//   - it costs real energy and carries a HIGHER injury risk than a proper
//     match, because there's no physio, no warm-up and a concrete surface
//   - you pick the formation from your four players, and that choice genuinely
//     changes how many chances you get versus how many they get
//
// The same engine also runs the coach's mid-week small-sided sessions (6v6),
// which is the training-day variant of exactly this format.
// ============================================================================
import { rand } from './rng'
import type { Player } from '../types/player'

export type StreetVariant = 'street' | 'small-sided'

export interface StreetFormation {
  id: string
  name: string
  shape: string
  description: string
  /** Multiplier on how many chances YOU get. */
  attackBias: number
  /** Multiplier on how many chances THEY get. */
  defenceBias: number
  /** Your own share of your team's chances. */
  playerShare: number
}

export const FORMATIONS: StreetFormation[] = [
  {
    id: 'all-out', name: 'All Out', shape: '1–3',
    description: 'Everyone forward. Nobody covers. Pure chaos and you love it.',
    attackBias: 1.45, defenceBias: 1.5, playerShare: 0.5,
  },
  {
    id: 'balanced', name: 'Balanced', shape: '2–2',
    description: 'Two back, two up. The shape everyone defaults to for a reason.',
    attackBias: 1.0, defenceBias: 1.0, playerShare: 0.45,
  },
  {
    id: 'solid', name: 'Solid', shape: '3–1',
    description: 'Sit deep, hit them on the break. Fewer chances, better ones.',
    attackBias: 0.72, defenceBias: 0.6, playerShare: 0.62,
  },
  {
    id: 'pivot', name: 'Diamond', shape: '1–2–1',
    description: 'One anchor, one up top, two working. Everything through the middle.',
    attackBias: 1.1, defenceBias: 0.88, playerShare: 0.55,
  },
]

export function formationById(id: string): StreetFormation {
  return FORMATIONS.find((f) => f.id === id) ?? FORMATIONS[1]
}

export interface StreetPlayer {
  name: string
  quality: number // 1-99
  isYou: boolean
}

export interface StreetGameConfig {
  variant: StreetVariant
  title: string
  /** Goals needed to win. */
  target: number
  /** Your side, including you. */
  yourTeam: StreetPlayer[]
  theirTeam: StreetPlayer[]
  formation: StreetFormation
  /** Multiplier on injury risk vs a normal match. */
  injuryMultiplier: number
  energyCost: number
}

export interface StreetGameState {
  config: StreetGameConfig
  yourScore: number
  theirScore: number
  /** Chances the player has taken. */
  playerChances: number
  finished: boolean
  won: boolean
  log: string[]
  injury: { severity: string; weeksOut: number; description: string } | null
}

export const STREET_TARGET = 5
export const MIN_PLAYER_CHANCES = 3

export function initStreetGame(player: Player, variant: StreetVariant, formationId: string, squadNames: string[] = []): StreetGameState {
  const formation = formationById(formationId)
  const size = variant === 'street' ? 4 : 6
  const ability = Math.round((player.attributes.kind === 'goalkeeper'
    ? (player.attributes.values.reflexes + player.attributes.values.distribution) / 2
    : player.attributes.values.shooting) * 4)

  const mates: StreetPlayer[] = [{ name: 'You', quality: Math.max(20, ability), isYou: true }]
  for (let i = 1; i < size; i++) {
    mates.push({ name: squadNames[i - 1] ?? `Teammate ${i}`, quality: 30 + Math.floor(rand() * 40), isYou: false })
  }
  const theirs: StreetPlayer[] = []
  for (let i = 0; i < size; i++) {
    theirs.push({ name: `Opponent ${i + 1}`, quality: 30 + Math.floor(rand() * 40), isYou: false })
  }

  return {
    config: {
      variant,
      title: variant === 'street' ? 'Street Game' : 'Small-Sided Game',
      target: STREET_TARGET,
      yourTeam: mates,
      theirTeam: theirs,
      formation,
      // No warm-up, no physio, concrete or a rutted field — this is the trade
      // for the extra football.
      injuryMultiplier: variant === 'street' ? 2.2 : 1.3,
      energyCost: variant === 'street' ? 22 : 16,
    },
    yourScore: 0,
    theirScore: 0,
    playerChances: 0,
    finished: false,
    won: false,
    log: [variant === 'street'
      ? 'Jumpers down. First to five wins.'
      : 'Bibs on. Coach says first to five, losers do the cones.'],
    injury: null,
  }
}

export type StreetBeat =
  | { kind: 'your-chance'; text: string }
  | { kind: 'their-goal'; text: string }
  | { kind: 'teammate-goal'; text: string }
  | { kind: 'nothing'; text: string }
  | { kind: 'finished'; text: string }

/**
 * Advance until something happens that needs the player. Formation decides how
 * often play comes to you versus how often they break on you.
 */
export function advanceStreet(state: StreetGameState): { state: StreetGameState; beat: StreetBeat } {
  const s: StreetGameState = { ...state, log: [...state.log] }
  if (s.finished) return { state: s, beat: { kind: 'finished', text: 'Game over.' } }

  const f = s.config.formation
  const teamQuality = s.config.yourTeam.reduce((a, p) => a + p.quality, 0) / s.config.yourTeam.length
  const oppQuality = s.config.theirTeam.reduce((a, p) => a + p.quality, 0) / s.config.theirTeam.length

  // GUARANTEE: the player must get at least MIN_PLAYER_CHANCES.
  //
  // The first version only triggered when the game was "nearing its end",
  // which failed when the opponent raced to 5 — audited games came in at 2
  // chances. The debt is now paid down continuously: the closer the game is to
  // finishing, the more aggressively the ball finds you, and at match point it
  // is certain.
  const owed = MIN_PLAYER_CHANCES - s.playerChances
  if (owed > 0) {
    const leadingScore = Math.max(s.yourScore, s.theirScore)
    const progress = leadingScore / s.config.target // 0 → 1 across the game
    // P64 — real bug found via a failing audit: paying the debt off ONE
    // chance per call meant the opponent could still score the winning
    // goal on an intervening tick before the full owed amount was
    // delivered — "certain at match point" was only certain for the FIRST
    // owed chance, not the rest. Once we're one goal from the game
    // potentially ending on any tick, the entire remaining debt is paid in
    // this one call instead of being paced out further.
    if (leadingScore >= s.config.target - 1) {
      s.playerChances = MIN_PLAYER_CHANCES
      return { state: s, beat: { kind: 'your-chance', text: pickLine(YOUR_CHANCE) } }
    }
    if (rand() < progress * (owed / MIN_PLAYER_CHANCES) * 1.6) {
      s.playerChances += 1
      return { state: s, beat: { kind: 'your-chance', text: pickLine(YOUR_CHANCE) } }
    }
  }

  const yourAttack = (teamQuality / 100) * f.attackBias
  const theirAttack = (oppQuality / 100) * f.defenceBias
  const total = yourAttack + theirAttack + 0.35 // the 0.35 is "nothing happens"

  const roll = rand() * total
  if (roll < yourAttack) {
    // your team creates — does it come to you?
    if (rand() < f.playerShare) {
      s.playerChances += 1
      return { state: s, beat: { kind: 'your-chance', text: pickLine(YOUR_CHANCE) } }
    }
    // a teammate finishes it, or doesn't
    if (rand() < 0.45) {
      s.yourScore += 1
      const text = pickLine(TEAMMATE_GOAL)
      s.log.push(text)
      return { state: checkEnd(s), beat: { kind: 'teammate-goal', text } }
    }
    const text = pickLine(NOTHING)
    s.log.push(text)
    return { state: s, beat: { kind: 'nothing', text } }
  }

  if (roll < yourAttack + theirAttack) {
    if (rand() < 0.42) {
      s.theirScore += 1
      const text = pickLine(THEIR_GOAL)
      s.log.push(text)
      return { state: checkEnd(s), beat: { kind: 'their-goal', text } }
    }
    const text = pickLine(THEY_MISS)
    s.log.push(text)
    return { state: s, beat: { kind: 'nothing', text } }
  }

  const text = pickLine(NOTHING)
  s.log.push(text)
  return { state: s, beat: { kind: 'nothing', text } }
}

/** Resolve the player's mini-game result into a goal or a miss. */
export function resolveStreetChance(state: StreetGameState, quality: number): { state: StreetGameState; text: string; scored: boolean } {
  const s: StreetGameState = { ...state, log: [...state.log] }
  const scored = quality >= 0.55
  const text = scored
    ? pickLine(quality >= 0.85 ? YOUR_GOAL_GREAT : YOUR_GOAL)
    : pickLine(quality >= 0.35 ? YOUR_MISS_CLOSE : YOUR_MISS)
  if (scored) s.yourScore += 1
  s.log.push(text)
  return { state: checkEnd(s), text, scored }
}

function checkEnd(s: StreetGameState): StreetGameState {
  if (s.yourScore >= s.config.target || s.theirScore >= s.config.target) {
    const won = s.yourScore > s.theirScore
    return {
      ...s,
      finished: true,
      won,
      log: [...s.log, won ? 'That\'s the game. Winners stay on.' : 'That\'s it. Next four are on.'],
    }
  }
  return s
}

// ---------------------------------------------------------------------------
// commentary — street football has its own voice, not match-day commentary
// ---------------------------------------------------------------------------
function pickLine(bank: string[]): string { return bank[Math.floor(rand() * bank.length)] }

const YOUR_CHANCE = [
  'It breaks to you on the edge. No keeper worth the name.',
  'One-two off the wall and you are through.',
  'The ball sits up perfectly. This is on you.',
  'Nutmegged him and now the goal is open.',
  'A scramble, and it drops at your feet.',
  'Everyone stops. It is yours to take.',
  'You have half a yard. That is all you need here.',
  'They back off you. Go on then.',
]
const YOUR_GOAL = [
  'Buried it. Roars from the touchline.',
  'Bottom corner. No arguments.',
  'Slotted it away like it was nothing.',
  'Through his legs and in. Brutal.',
  'Right into the top corner off the post.',
]
const YOUR_GOAL_GREAT = [
  'Unbelievable. People will talk about that one for weeks.',
  'Absolute worldie. Even they applauded that.',
  'You beat two and finished it. Ridiculous.',
  'That is the best goal anyone here has seen all summer.',
]
const YOUR_MISS = [
  'Skied it. Someone is going to have to fetch that.',
  'Wide. You hear about it immediately.',
  'Straight at him. Wasteful.',
  'Scuffed it completely. Awful.',
]
const YOUR_MISS_CLOSE = [
  'Off the post and away. Agony.',
  'Inches wide. You put your hands on your head.',
  'Great save. Hands like buckets, that lad.',
  'Cleared off the line by a boot.',
]
const TEAMMATE_GOAL = [
  'Your mate finishes it off. Level pegging in the celebration.',
  'Tucked away at the back post. Get in.',
  'A scrappy one, but they all count.',
  'Lovely team goal, three passes and in.',
]
const THEIR_GOAL = [
  'They break and finish it. Nobody tracked back.',
  'Straight through the middle. Too easy.',
  'A cracker from distance. Nothing you could do.',
  'They score, and they are far too pleased about it.',
]
const THEY_MISS = [
  'They should have scored there. Let off.',
  'Off the crossbar and away.',
  'Dragged it wide. You breathe again.',
  'Blocked brilliantly by your last man.',
]
const NOTHING = [
  'Scrappy stuff in the middle.',
  'The ball goes out and there is a debate about whose it is.',
  'A crunching tackle. No apology offered.',
  'Someone has kicked it into the road. Everyone waits.',
  'End to end and nobody in control.',
  'A dog gets involved briefly.',
  'Shouts for a foul. Play carries on.',
  'The ball is getting heavier by the minute.',
]

/**
 * Reward for a street game. Deliberately modest and skill-shaped: this is
 * extra practice, not a shortcut. It never touches appearances, league tables
 * or selection — the brief was explicit that it "doesn't affect anything".
 */
export function streetRewards(state: StreetGameState): { attributeGains: Record<string, number>; confidence: number; note: string } {
  const goals = state.yourScore
  const chances = state.playerChances
  const conversion = chances > 0 ? Math.min(1, goals / chances) : 0
  const base = 0.05 + conversion * 0.09

  const gains: Record<string, number> = {
    dribbling: Math.round(base * 100) / 100,
    firstTouch: Math.round(base * 0.8 * 100) / 100,
    finishing: Math.round(base * 0.9 * 100) / 100,
    composure: Math.round(base * 0.5 * 100) / 100,
  }
  return {
    attributeGains: gains,
    confidence: state.won ? 1 : conversion >= 0.5 ? 0.5 : -0.5,
    note: state.won ? 'Winners stay on. You walk home buzzing.' : 'Beaten, but your touch felt sharper by the end.',
  }
}
