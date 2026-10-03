import { getRegion, regionalSchoolNames } from './regions'

// Locked spec: school choice has REAL mechanical differences, not flavor.
// Differences: trial difficulty (harder = higher bar to make XI), scout exposure
// (how much reputation/scouting the school attracts), and squad-place odds.

export interface School {
  id: string
  name: string
  blurb: string
  strengths: string[]
  // mechanical knobs:
  // MECHANICAL KNOBS.
  // Phase 14 balance fix: trialDifficulty and squadPlaceOdds COMPOUND multiplicatively
  // in decideSquadRole (effective = performance / difficulty * odds). The original
  // values punished Westview on both axes at once, which made its combined bar
  // 1.25/0.75 = 1.67x Greenwood's. Simulation showed that put Starting XI at a required
  // performance of 1.20 — literally impossible, since performance is capped at 1.0 —
  // and even its bench threshold (0.80) sat above the p90 of a maxed-attribute player
  // playing optimally (0.77). The "powerhouse" school was a pure trap with no upside.
  // Spread is now deliberately narrow; scoutExposure carries the real trade-off.
  trialDifficulty: number // 0.9 (easy) .. 1.15 (hard) — scales the bar to impress
  scoutExposure: number // 0.7 .. 1.4 — multiplies scouting attention later
  squadPlaceOdds: number // 0.95 .. 1.1 — baseline modifier for making the XI
}

export const SCHOOLS: School[] = [
  {
    id: 'westview',
    name: 'Westview High',
    blurb: 'A powerhouse program. Hard to break into, but the scouts are always watching.',
    strengths: ['Elite coaching', 'Heavy scout attention', 'Strong squad'],
    trialDifficulty: 1.15,
    scoutExposure: 1.4,
    squadPlaceOdds: 0.95,
  },
  {
    id: 'greenwood',
    name: 'Greenwood High',
    blurb: 'A balanced program. A fair shot at the squad and decent exposure.',
    strengths: ['Balanced program', 'Fair squad odds', 'Average facilities'],
    trialDifficulty: 1.0,
    scoutExposure: 1.0,
    squadPlaceOdds: 1.0,
  },
  {
    id: 'riverside',
    name: 'Riverside High',
    blurb: 'A developing program. Almost guaranteed a squad place, but fewer scouts come.',
    strengths: ['Easy squad place', 'Room to shine', 'Fewer scouts'],
    trialDifficulty: 0.9,
    scoutExposure: 0.7,
    squadPlaceOdds: 1.1,
  },
]

export function getSchool(id: string): School | undefined {
  const legacy = SCHOOLS.find((s) => s.id === id)
  if (legacy) return legacy
  const regionId = id.replace(/-(westview|greenwood|riverside)$/, '')
  return schoolsForRegion(regionId).find(s => s.id === id)
}

export function schoolsForRegion(regionId: string | null | undefined): School[] {
  const region = getRegion(regionId)
  if (!region) return SCHOOLS
  const names = regionalSchoolNames(region.id)
  return SCHOOLS.map((school, index) => ({ ...school, id: `${region.id}-${school.id}`, name: names[index] }))
}
