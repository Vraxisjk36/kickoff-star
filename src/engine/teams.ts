import { rand } from './rng'
import { FIRST_NAMES, LAST_NAMES } from './squad'
// Locked spec: team strength = separate attack/mid/defense ratings (not one blended).
// Teams are procedurally generated (names/ratings/badges auto-made).

export interface TeamRatings {
  attack: number // 1-99
  midfield: number
  defense: number
}

// P64 — Joel: "4 players a team for all 3 divisions... shouldn't we like
// add some players to each club to make the game realistic." Every OTHER
// team in the game (league/cup/international opponents) was previously
// pure abstraction — name, colors, ratings, no individual players at all,
// only the player's own squad had real named members. Deliberately scoped
// to 4 NOTABLE players per team (one per key position), not a full 11-18
// man roster — that would be a much bigger, mostly-unseen cost for very
// little extra realism. Enough to give a real Golden Boot rival, a real
// "danger man" in a match preview, and a genuine top-scorer leaderboard.
export type NotablePosition = 'GK' | 'CB' | 'CM' | 'ST'
export interface NotablePlayer {
  name: string
  position: NotablePosition
  seasonGoals: number
}

export interface Team {
  id: string
  name: string
  countryId?: string
  regionId?: string
  short: string // 3-letter code for scoreboards
  ratings: TeamRatings
  prestige: number // 1-10, drives which league tier and scout attention
  primaryColor: string
  secondaryColor: string
  notablePlayers: NotablePlayer[]
}

// --- Procedural name generation ---
const PREFIXES = ['North', 'South', 'East', 'West', 'Old', 'New', 'Kings', 'Queens', 'Saint', 'Port', 'Green', 'Red', 'High', 'Ash', 'Oak', 'River', 'Hill', 'Fair']
const CORES = ['field', 'ton', 'ford', 'bridge', 'wood', 'dale', 'gate', 'burn', 'ley', 'well', 'worth', 'moor', 'stead', 'ham']
const SUFFIXES = ['FC', 'United', 'Town', 'City', 'Rovers', 'Athletic', 'Wanderers', 'Albion', 'County', 'Rangers']
const COLORS = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#d35400', '#16a085', '#2c3e50', '#f39c12', '#7f8c8d', '#c0392b']

function pick<T>(arr: T[]): T { return arr[Math.floor(rand() * arr.length)] }
function id() { return crypto.randomUUID() }

function generateName(): { name: string; short: string } {
  const prefix = pick(PREFIXES)
  const core = pick(CORES)
  const suffix = pick(SUFFIXES)
  const place = prefix + core
  const name = `${place} ${suffix}`
  const short = place.slice(0, 3).toUpperCase()
  return { name, short }
}

// Generate a team around a target prestige. Ratings cluster near prestige*10 with variance,
// so a prestige-3 team sits ~30s and a prestige-8 team ~80s, with each line (att/mid/def)
// varying independently so teams have identities (strong attack / weak defense etc).
function generatePlayerName(taken: Set<string>): string {
  let name = ''
  let guard = 0
  do {
    name = `${FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)]}`
    guard++
  } while (taken.has(name) && guard < 20)
  taken.add(name)
  return name
}

function generateNotablePlayers(): NotablePlayer[] {
  const taken = new Set<string>()
  const positions: NotablePosition[] = ['GK', 'CB', 'CM', 'ST']
  return positions.map((position) => ({ name: generatePlayerName(taken), position, seasonGoals: 0 }))
}

export function generateTeam(prestige: number): Team {
  const { name, short } = generateName()
  const base = Math.min(90, Math.max(20, prestige * 9 + 15))
  const jitter = () => Math.round(base + (rand() - 0.5) * 20)
  const clampR = (v: number) => Math.min(95, Math.max(15, v))
  const c1 = pick(COLORS)
  let c2 = pick(COLORS)
  if (c2 === c1) c2 = '#ffffff'
  return {
    id: id(),
    name,
    short,
    ratings: { attack: clampR(jitter()), midfield: clampR(jitter()), defense: clampR(jitter()) },
    prestige,
    primaryColor: c1,
    secondaryColor: c2,
    notablePlayers: generateNotablePlayers(),
  }
}

// Build the player's own team (school/club side) around a modest grassroots prestige.
export function generatePlayerTeam(name: string, prestige = 3): Team {
  const t = generateTeam(prestige)
  return { ...t, name, short: name.slice(0, 3).toUpperCase() }
}

// Overall rating helper for display.
export function teamOverall(t: Team): number {
  return Math.round((t.ratings.attack + t.ratings.midfield + t.ratings.defense) / 3)
}
