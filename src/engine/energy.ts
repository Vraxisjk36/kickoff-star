import type { Player } from '../types/player'

// ============================================================================
// ENERGY SYSTEM
//
// V3.1 balance pass: normal career play must be sustainable without buying
// consumables or watching rewarded ads. Energy still matters, but training,
// matches and rest should form a recoverable loop rather than a downward spiral.
// ============================================================================

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

export type EnergyBand = 'fresh' | 'sharp' | 'tired' | 'drained'

export interface BandSpec {
  band: EnergyBand
  label: string
  min: number
  /** Multiplier applied to training attribute growth. */
  growthMod: number
  /** Base chance of picking up a training-ground injury in a session. */
  injuryBase: number
  colorClass: string
  barClass: string
}

export const BANDS: BandSpec[] = [
  { band: 'fresh',   label: 'fresh',   min: 80, growthMod: 1.05, injuryBase: 0.000, colorClass: 'text-green-500',  barClass: 'bg-green-500' },
  { band: 'sharp',   label: 'sharp',   min: 60, growthMod: 1.00, injuryBase: 0.004, colorClass: 'text-ks-gold',    barClass: 'bg-ks-gold' },
  { band: 'tired',   label: 'tired',   min: 35, growthMod: 0.88, injuryBase: 0.018, colorClass: 'text-orange-500', barClass: 'bg-orange-500' },
  { band: 'drained', label: 'drained', min: 0,  growthMod: 0.70, injuryBase: 0.045, colorClass: 'text-red-500',    barClass: 'bg-red-500' },
]

export function bandSpec(stamina: number): BandSpec {
  return BANDS.find((b) => stamina >= b.min) ?? BANDS[BANDS.length - 1]
}

export function energyBand(stamina: number): EnergyBand { return bandSpec(stamina).band }
export function energyLabel(stamina: number): string { return bandSpec(stamina).label }

export function trainingGrowthModifier(stamina: number): number {
  return bandSpec(stamina).growthMod
}

export const MATCH_SHARPNESS_FLOOR = 20
export function matchSharpnessFrom(stamina: number): number {
  return clamp(stamina, MATCH_SHARPNESS_FLOOR, 100)
}

export type TrainingIntensity = 'light' | 'normal' | 'intense'

export interface IntensitySpec {
  id: TrainingIntensity
  label: string
  blurb: string
  energyMod: number
  growthByBand: Record<EnergyBand, number>
  injuryMod: number
  trustDelta: number
}

// V3.1: the old 0.55 / 1.0 / 1.7 energy multipliers meant a five-drill intense
// session could burn ~43 energy and a normal one ~25. Players were reaching
// matchday already empty. These values preserve the trade-off while keeping a
// sensible week playable without mandatory shop items or ads.
export const INTENSITIES: IntensitySpec[] = [
  {
    id: 'light', label: 'light',
    blurb: 'Save the legs for matchday. Lower growth, very manageable energy cost.',
    energyMod: 0.45, injuryMod: 0.45, trustDelta: -1,
    growthByBand: { fresh: 0.78, sharp: 0.78, tired: 0.80, drained: 0.80 },
  },
  {
    id: 'normal', label: 'normal',
    blurb: 'The sustainable default. Solid gains without emptying the tank.',
    energyMod: 0.70, injuryMod: 1.0, trustDelta: 0,
    growthByBand: { fresh: 1.0, sharp: 1.0, tired: 1.0, drained: 0.95 },
  },
  {
    id: 'intense', label: 'intense',
    blurb: 'Push hard for extra gains while fresh. Expensive when tired and not meant for every session.',
    energyMod: 1.15, injuryMod: 1.8, trustDelta: 1,
    growthByBand: { fresh: 1.25, sharp: 1.15, tired: 0.90, drained: 0.55 },
  },
]

export function intensitySpec(id: TrainingIntensity): IntensitySpec {
  return INTENSITIES.find((i) => i.id === id) ?? INTENSITIES[1]
}

export function intensityGrowthModifier(id: TrainingIntensity, stamina: number): number {
  return intensitySpec(id).growthByBand[bandSpec(stamina).band]
}

export function effectiveGrowthModifier(id: TrainingIntensity, stamina: number): number {
  return trainingGrowthModifier(stamina) * intensityGrowthModifier(id, stamina)
}

export function trainingInjuryChance(player: Player, intensity: TrainingIntensity): number {
  const base = bandSpec(player.fitness.stamina).injuryBase
  const historyFactor = 1 + (player.recentInjuryCount ?? 0) * 0.4
  return clamp(base * intensitySpec(intensity).injuryMod * historyFactor, 0, 0.12)
}

export type RestChoice = 'full-rest' | 'recovery' | 'extra-session' | 'switch-off'

export interface RestOption {
  id: RestChoice
  label: string
  blurb: string
  recoveryMod: number
  energyCost: number
  confidenceDelta: number
  trustDelta: number
  injuryHistoryRelief: number
}

export const REST_OPTIONS: RestOption[] = [
  {
    id: 'full-rest', label: 'full rest',
    blurb: 'Feet up. The best choice when the tank is low.',
    recoveryMod: 1.0, energyCost: 0, confidenceDelta: 0, trustDelta: 0, injuryHistoryRelief: 0,
  },
  {
    id: 'recovery', label: 'recovery work',
    blurb: 'Physio, stretching and recovery work. Strong energy return and helps old knocks settle.',
    recoveryMod: 0.82, energyCost: 0, confidenceDelta: 0, trustDelta: 0, injuryHistoryRelief: 1,
  },
  {
    id: 'extra-session', label: 'extra session',
    blurb: 'Do more on your day off. The coach notices, but you sacrifice recovery.',
    recoveryMod: 0.45, energyCost: 5, confidenceDelta: 1, trustDelta: 1, injuryHistoryRelief: 0,
  },
  {
    id: 'switch-off', label: 'switch off',
    blurb: 'Get away from football for a bit. Good for confidence and still gives useful recovery.',
    recoveryMod: 0.65, energyCost: 0, confidenceDelta: 2, trustDelta: 0, injuryHistoryRelief: 0,
  },
]

export function restOption(id: RestChoice): RestOption {
  return REST_OPTIONS.find((o) => o.id === id) ?? REST_OPTIONS[0]
}

// Rest helps without erasing the cost of a match in a single weekend. The
// missing-energy component still protects an exhausted player from a spiral.
export function baseRecovery(player: Player): number {
  const missing = 100 - player.fitness.stamina
  return Math.round(missing * 0.22) + 9
}

export function recoveryFor(player: Player, choice: RestChoice): number {
  return Math.round(baseRecovery(player) * restOption(choice).recoveryMod)
}

export function netEnergyFor(player: Player, choice: RestChoice): number {
  const opt = restOption(choice)
  const after = clamp(player.fitness.stamina - opt.energyCost + recoveryFor(player, choice), 0, 100)
  return after - player.fitness.stamina
}

export interface EnergyEffect {
  label: string
  value: string
  tone: 'good' | 'neutral' | 'bad'
}

export function describeEffects(player: Player): EnergyEffect[] {
  const stamina = player.fitness.stamina
  const spec = bandSpec(stamina)
  const growthPct = Math.round((spec.growthMod - 1) * 100)
  const sharpness = matchSharpnessFrom(stamina)
  const injuryPct = trainingInjuryChance(player, 'normal') * 100

  return [
    {
      label: 'training growth',
      value: growthPct === 0 ? 'normal' : `${growthPct > 0 ? '+' : ''}${growthPct}%`,
      tone: growthPct > 0 ? 'good' : growthPct < 0 ? 'bad' : 'neutral',
    },
    {
      label: 'match sharpness',
      value: `starts at ${sharpness}`,
      tone: sharpness >= 80 ? 'good' : sharpness >= 60 ? 'neutral' : 'bad',
    },
    {
      label: 'training injury risk',
      value: injuryPct < 0.5 ? 'negligible' : `${injuryPct.toFixed(1)}% per session`,
      tone: injuryPct < 0.5 ? 'good' : injuryPct < 2.5 ? 'neutral' : 'bad',
    },
  ]
}
