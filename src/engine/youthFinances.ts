// V4 Youth World — financial choices for a youth player.
// `player.money` remains the compatibility balance used by the existing UI;
// this state adds the explainable ledger and support systems around it.
import { rand } from './rng'

export type FamilySupportTier = 'limited' | 'stable' | 'strong'
export type FinanceCategory = 'allowance' | 'job' | 'reward' | 'transport' | 'food' | 'equipment' | 'training' | 'recovery' | 'club-support' | 'family-support' | 'wage' | 'prize' | 'sponsorship' | 'family-gift' | 'living-cost' | 'agent-fee' | 'other'

export interface FinanceTransaction {
  id: string
  week: number
  amount: number // positive income/support, negative expense
  category: FinanceCategory
  description: string
  coveredBy?: 'player' | 'family' | 'school' | 'club' | 'academy' | 'sponsor'
}

export interface ClubSupport {
  transport: number
  equipment: number
  meals: number
  medical: number
}

export interface SponsorshipRecord {
  id: string
  sponsorName: string
  kind: 'equipment-voucher' | 'travel-support' | 'local-partner'
  value: number
  weekAwarded: number
}

export interface YouthFinanceState {
  currency: 'GBP'
  familySupport: FamilySupportTier
  clubSupport: ClubSupport
  transactions: FinanceTransaction[]
  sponsorships: SponsorshipRecord[]
}

export function defaultClubSupport(phase: 'grassroots-trials' | 'grassroots-season' | 'academy'): ClubSupport {
  if (phase === 'academy') return { transport: 100, equipment: 100, meals: 100, medical: 100 }
  if (phase === 'grassroots-season') return { transport: 45, equipment: 20, meals: 35, medical: 15 }
  return { transport: 10, equipment: 0, meals: 0, medical: 0 }
}

export function initYouthFinance(phase: 'grassroots-trials' | 'grassroots-season' | 'academy', familySupport: FamilySupportTier = 'stable'): YouthFinanceState {
  return { currency: 'GBP', familySupport, clubSupport: defaultClubSupport(phase), transactions: [], sponsorships: [] }
}

export function postTransaction(state: YouthFinanceState | undefined, phase: 'grassroots-trials' | 'grassroots-season' | 'academy', transaction: Omit<FinanceTransaction, 'id'>): YouthFinanceState {
  const base = state ?? initYouthFinance(phase)
  const entry: FinanceTransaction = { ...transaction, id: crypto.randomUUID() }
  return { ...base, transactions: [...base.transactions, entry].slice(-120) }
}

export interface TransportOption {
  id: 'bus' | 'taxi' | 'lift' | 'ride-share'
  name: string
  cost: number
  energyCost: number
  reliability: 'low' | 'medium' | 'high'
}

export const TRANSPORT_OPTIONS: TransportOption[] = [
  { id: 'bus', name: 'Bus', cost: 2, energyCost: 3, reliability: 'medium' },
  { id: 'taxi', name: 'Taxi', cost: 7, energyCost: 2, reliability: 'high' },
  { id: 'lift', name: 'Lift', cost: 0, energyCost: 1, reliability: 'low' },
  { id: 'ride-share', name: 'Ride-share', cost: 12, energyCost: 1, reliability: 'high' },
]

export interface FootballOpportunity {
  id: string
  title: string
  travelCost: number
  accommodationCovered: boolean
  mealsCovered: boolean
}

export type FundingChoice = 'savings' | 'family' | 'coach' | 'club' | 'decline'

export interface FundingResolution {
  canAttend: boolean
  playerCost: number
  coveredBy?: FinanceTransaction['coveredBy']
  reason: string
}

const FAMILY_COVER_CHANCE: Record<FamilySupportTier, number> = { limited: 0.35, stable: 0.7, strong: 1 }

export function resolveOpportunityFunding(input: { opportunity: FootballOpportunity; choice: FundingChoice; balance: number; finances: YouthFinanceState; roll?: number }): FundingResolution {
  const { opportunity, choice, balance, finances } = input
  const roll = input.roll ?? rand()
  if (choice === 'decline') return { canAttend: false, playerCost: 0, reason: 'Opportunity declined.' }
  if (choice === 'savings') return balance >= opportunity.travelCost
    ? { canAttend: true, playerCost: opportunity.travelCost, coveredBy: 'player', reason: 'Travel paid from savings.' }
    : { canAttend: false, playerCost: 0, reason: 'Not enough savings.' }
  if (choice === 'family') {
    const covered = roll <= FAMILY_COVER_CHANCE[finances.familySupport]
    return covered ? { canAttend: true, playerCost: 0, coveredBy: 'family', reason: 'Family found a way to cover the trip.' } : { canAttend: false, playerCost: 0, reason: 'Family cannot cover this trip.' }
  }
  const support = choice === 'club' ? finances.clubSupport.transport : Math.round(finances.clubSupport.transport * 0.75)
  const covered = roll <= support / 100
  return covered
    ? { canAttend: true, playerCost: 0, coveredBy: choice === 'club' ? 'club' : 'school', reason: choice === 'club' ? 'The club approved travel support.' : 'The coach arranged assistance.' }
    : { canAttend: false, playerCost: 0, reason: 'No support funding was available this time.' }
}

export type BootCondition = 'new' | 'good' | 'worn' | 'poor'

export function bootCondition(percent: number): BootCondition {
  if (percent >= 85) return 'new'
  if (percent >= 50) return 'good'
  if (percent >= 20) return 'worn'
  return 'poor'
}

export function bootRiskModifier(percent: number): { discomfort: number; blisterChance: number; injuryRisk: number; confidence: number } {
  const condition = bootCondition(percent)
  if (condition === 'poor') return { discomfort: 0.3, blisterChance: 0.12, injuryRisk: 0.05, confidence: -0.3 }
  if (condition === 'worn') return { discomfort: 0.12, blisterChance: 0.05, injuryRisk: 0.02, confidence: -0.1 }
  return { discomfort: 0, blisterChance: 0, injuryRisk: 0, confidence: 0 }
}

export function sponsorshipEligible(input: { age: number; reputation: number; nationalAppearances: number; awards: number }): boolean {
  return input.age >= 15 && input.reputation >= 35 && (input.nationalAppearances >= 2 || input.awards >= 1)
}
