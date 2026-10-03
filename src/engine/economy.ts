import { rand } from './rng'
import type { Player } from '../types/player'

export type ItemKind = 'consumable' | 'equipment'
export type ItemSlot = 'boots' | 'shinpads' | 'gloves' | 'kit' | 'none'

export interface ShopItem {
  id: string
  name: string
  kind: ItemKind
  slot: ItemSlot
  price: number
  description: string
  /** Consumable: fraction of MAX energy restored, e.g. 0.2 = 20%. Always caps at 100 total. */
  energyPct?: number
  /** Equipment: attribute boosts while worn, and how long it lasts. */
  boosts?: Record<string, number>
  durationWeeks?: number
  /** Goalkeeper-only kit (gloves) — hidden for outfielders and vice versa. */
  gkOnly?: boolean
  outfieldOnly?: boolean
  /** Minimum age before a shop will sell it to you. */
  minAge?: number
}

export function energyGainFromPct(currentStamina: number, pct: number): number {
  return Math.max(0, Math.min(100, currentStamina + pct * 100) - currentStamina)
}

// V3.1 economy pass: recovery items are optional accelerators, not a wall.
// Prices are high enough that an odd job can never be converted into a net
// energy gain, but low enough that normal youth income can still fund an
// emergency top-up without rewarded ads.
export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'energy-drink', name: 'Energy Drink (20%)', kind: 'consumable', slot: 'none', price: 18,
    energyPct: 0.2, description: 'A quick top-up. Restores 20% of your energy bar, capped at full.',
  },
  {
    id: 'recovery-shake', name: 'Recovery Shake (50%)', kind: 'consumable', slot: 'none', price: 44,
    energyPct: 0.5, description: 'Proper recovery formula. Restores half your energy bar, capped at full.',
  },
  {
    id: 'ice-bath', name: 'Ice Bath Session (100%)', kind: 'consumable', slot: 'none', price: 88,
    energyPct: 1.0, description: 'An hour at the physio centre. Fills your energy bar completely.',
  },
  {
    id: 'boots-trainers', name: 'Worn Trainers', kind: 'equipment', slot: 'boots', price: 10,
    boosts: { pace: 1 }, durationWeeks: 8, outfieldOnly: false,
    description: 'Better than nothing. +1 pace for 8 weeks.',
  },
  {
    id: 'boots-speed', name: 'Speed Boots', kind: 'equipment', slot: 'boots', price: 45,
    boosts: { pace: 2, agility: 1 }, durationWeeks: 10,
    description: 'Light, aggressive stud pattern. +2 pace, +1 agility for 10 weeks.',
  },
  {
    id: 'boots-control', name: 'Control Boots', kind: 'equipment', slot: 'boots', price: 45,
    boosts: { firstTouch: 2, passing: 1 }, durationWeeks: 10,
    description: 'Textured upper for grip on the ball. +2 first touch, +1 passing for 10 weeks.',
  },
  {
    id: 'boots-strike', name: 'Strike Boots', kind: 'equipment', slot: 'boots', price: 55,
    boosts: { finishing: 2, composure: 1 }, durationWeeks: 10, minAge: 15,
    description: 'Built for hitting through the ball. +2 finishing, +1 composure for 10 weeks.',
  },
  {
    id: 'boots-elite', name: 'Elite Signature Boots', kind: 'equipment', slot: 'boots', price: 120,
    boosts: { pace: 2, finishing: 2, dribbling: 2 }, durationWeeks: 14, minAge: 16,
    description: 'The ones off the posters. +2 pace, finishing and dribbling for 14 weeks.',
  },
  {
    id: 'shinpads-pro', name: 'Carbon Shinpads', kind: 'equipment', slot: 'shinpads', price: 30,
    boosts: { strength: 2 }, durationWeeks: 12,
    description: 'Take a kick and get up. +2 strength for 12 weeks.',
  },
  {
    id: 'kit-compression', name: 'Compression Base Layer', kind: 'equipment', slot: 'kit', price: 35,
    boosts: { stamina: 2 }, durationWeeks: 12,
    description: 'Keeps the legs going late on. +2 stamina for 12 weeks.',
  },
  {
    id: 'kit-lucky', name: 'Lucky Shirt', kind: 'equipment', slot: 'kit', price: 18,
    boosts: { composure: 1, concentration: 1 }, durationWeeks: 10,
    description: "You know it's nonsense. It still works. +1 composure, +1 concentration for 10 weeks.",
  },
  {
    id: 'boots-custom', name: 'Custom-Fit Boots', kind: 'equipment', slot: 'boots', price: 340,
    boosts: { pace: 2, finishing: 2, firstTouch: 2, agility: 1 }, durationWeeks: 20, minAge: 16,
    description: 'Moulded to your feet at the club. +2 pace, finishing and first touch, +1 agility for 20 weeks.',
  },
  {
    id: 'kit-recovery-suit', name: 'Compression Recovery Suit', kind: 'equipment', slot: 'kit', price: 280,
    boosts: { stamina: 3, strength: 1 }, durationWeeks: 20, minAge: 16,
    description: 'What the first team wear after matches. +3 stamina, +1 strength for 20 weeks.',
  },
  {
    id: 'shinpads-carbon-pro', name: 'Pro Carbon Guards', kind: 'equipment', slot: 'shinpads', price: 190,
    boosts: { strength: 2, concentration: 1 }, durationWeeks: 20, minAge: 16,
    description: 'Barely there, take anything. +2 strength, +1 concentration for 20 weeks.',
  },
  {
    id: 'gloves-basic', name: 'Match Gloves', kind: 'equipment', slot: 'gloves', price: 25,
    boosts: { handling: 2 }, durationWeeks: 10, gkOnly: true,
    description: 'Fresh latex, proper grip. +2 handling for 10 weeks.',
  },
  {
    id: 'gloves-elite', name: 'Elite Keeper Gloves', kind: 'equipment', slot: 'gloves', price: 70,
    boosts: { handling: 2, reflexes: 2 }, durationWeeks: 12, gkOnly: true, minAge: 15,
    description: 'What the pros wear. +2 handling, +2 reflexes for 12 weeks.',
  },
]

export function shopFor(player: Player): ShopItem[] {
  const isGK = player.position === 'GK'
  const age = player.careerClock.ageYears
  return SHOP_ITEMS.filter((i) => {
    if (i.gkOnly && !isGK) return false
    if (i.outfieldOnly && isGK) return false
    if (i.minAge && age < i.minAge) return false
    return true
  })
}

export function itemById(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.id === id)
}

export interface OwnedEquipment {
  itemId: string
  weeksRemaining: number
  /** V4: physical condition is visible separately from the old expiry timer. */
  condition?: number
}

export type Consumables = Record<string, number>

export function equipmentBoosts(equipment: OwnedEquipment[] | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  for (const owned of equipment ?? []) {
    if (owned.weeksRemaining <= 0) continue
    const item = itemById(owned.itemId)
    if (!item?.boosts) continue
    for (const [attr, v] of Object.entries(item.boosts)) out[attr] = (out[attr] ?? 0) + v
  }
  return out
}

export function effectiveValues(player: Player): Record<string, number> {
  const base = player.attributes.values as Record<string, number>
  const boosts = equipmentBoosts(player.equipment)
  if (Object.keys(boosts).length === 0) return base
  const out: Record<string, number> = { ...base }
  for (const [attr, v] of Object.entries(boosts)) {
    if (out[attr] === undefined) continue
    out[attr] = Math.min(player.potential, out[attr] + v)
  }
  return out
}

export function ageEquipment(equipment: OwnedEquipment[] | undefined): { equipment: OwnedEquipment[]; expired: string[] } {
  const expired: string[] = []
  const next: OwnedEquipment[] = []
  for (const owned of equipment ?? []) {
    const item = itemById(owned.itemId)
    const weeksRemaining = owned.weeksRemaining - 1
    const weeklyWear = 100 / Math.max(1, item?.durationWeeks ?? owned.weeksRemaining)
    const condition = Math.max(0, Math.round((owned.condition ?? Math.min(100, owned.weeksRemaining * weeklyWear)) - weeklyWear))
    if (weeksRemaining <= 0 || condition <= 0) expired.push(owned.itemId)
    else next.push({ ...owned, weeksRemaining, condition })
  }
  return { equipment: next, expired }
}

// V3.1: a 14-year-old gets roughly £18/month before relationship modifiers.
export function monthlyAllowance(player: Player): number {
  const age = player.careerClock.ageYears
  const base = 10 + Math.max(0, age - 13) * 8
  const parent = (player.relationships ?? []).find((r) => !r.ended && r.kind === 'parent')
  const bond = parent?.bond ?? 0
  const bondMod = 1 + Math.max(-0.3, Math.min(0.3, bond / 333))
  return Math.round(base * bondMod)
}

export const ALLOWANCE_INTERVAL_WEEKS = 4

export function allowanceDue(player: Player): boolean {
  const now = player.totalWeeksElapsed ?? 0
  const last = player.lastAllowanceWeek ?? -ALLOWANCE_INTERVAL_WEEKS
  return now - last >= ALLOWANCE_INTERVAL_WEEKS
}

export interface WeeklyReward {
  day: number
  money?: number
  itemId?: string
  count?: number
  label: string
}

export const REWARD_CYCLE: WeeklyReward[] = [
  { day: 1, money: 2, label: '£2' },
  { day: 2, itemId: 'energy-drink', count: 1, label: '1 Energy Drink' },
  { day: 3, money: 3, label: '£3' },
  { day: 4, itemId: 'energy-drink', count: 1, label: '1 Energy Drink' },
  { day: 5, money: 5, label: '£5' },
  { day: 6, itemId: 'recovery-shake', count: 1, label: '1 Recovery Shake' },
  { day: 7, money: 8, itemId: 'energy-drink', count: 2, label: '£8 + 2 Energy Drinks' },
]

export function rewardForStreak(streak: number): WeeklyReward {
  return REWARD_CYCLE[Math.min(streak, REWARD_CYCLE.length - 1)]
}

export interface OddJob {
  id: string
  label: string
  pay: number
  energyCost: number
  description: string
  minAge?: number
}

export const ODD_JOBS: OddJob[] = [
  { id: 'carwash', label: 'Wash cars on the street', pay: 12, energyCost: 16, description: 'A Saturday morning with a bucket and sponge.' },
  { id: 'paper-round', label: 'Paper round', pay: 15, energyCost: 20, description: 'Early starts all week, but steady money.' },
  { id: 'stacking', label: 'Shelf-stacking shift', pay: 28, energyCost: 34, description: 'A proper shift at the local shop. Long one.', minAge: 15 },
  { id: 'coaching', label: 'Help coach the under-9s', pay: 20, energyCost: 26, description: 'Cones, bibs and thirty small children.', minAge: 15 },
  { id: 'refereeing', label: 'Referee a junior match', pay: 25, energyCost: 32, description: 'Nobody thanks a referee, but it pays.', minAge: 16 },
  { id: 'gardening', label: "Neighbour's garden", pay: 18, energyCost: 24, description: 'Heavy work, cash in hand.' },
]

export function canWorkThisWeek(player: Player): boolean {
  const now = player.totalWeeksElapsed ?? 0
  return (player.lastJobWeek ?? -1) < now
}

export function availableJobs(player: Player): OddJob[] {
  const age = player.careerClock.ageYears
  return ODD_JOBS.filter((j) => !j.minAge || age >= j.minAge)
}

export function randomJob(player: Player): OddJob {
  const jobs = availableJobs(player)
  return jobs[Math.floor(rand() * jobs.length)]
}

export function formatMoney(amount: number): string {
  return `£${Math.round(amount)}`
}

export const LIVING_COST_SHARE = 0.42

export function weeklyLivingCost(player: Player): number {
  if (!player.contract) return 0
  return Math.round(player.contract.terms.weeklyWage * LIVING_COST_SHARE)
}
