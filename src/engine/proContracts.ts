import type { IsoDate, ProWorldState } from './proWorld'
import { assessProDeal } from './proClubFinance'
import { proRoll } from './proWorldFactory'

export type ProAgentId = 'family' | 'local' | 'established'
export const PRO_AGENTS: { id: ProAgentId; name: string; feeBps: number; description: string }[] = [
  { id: 'family', name: 'Family representative', feeBps: 0, description: 'No representation fee; limited negotiating power.' },
  { id: 'local', name: 'Local agent', feeBps: 350, description: '3.5% of gross wages in game.' },
  { id: 'established', name: 'Established agency', feeBps: 600, description: '6% of gross wages in game; stronger counters.' },
]
export interface ProContract {
  id: string; clubId: string; playerId: string; signed: IsoDate; expires: IsoDate
  annualWage: number; appearanceBonus: number; goalBonus: number; assistBonus: number; signingBonus: number
  releaseClause: number | null; role: 'prospect' | 'rotation' | 'starter' | 'star'; agentId: ProAgentId
  loanRisk: 'low' | 'high'; currency: string
}
export interface ProTalks {
  clubId: string; opened: IsoDate; ready: IsoDate; annualWage: number; countered: boolean
  status: 'pending' | 'ready' | 'rejected'
  transferFee?: number
  loanRisk?: 'low' | 'high'
}
export interface ProLedgerLine {
  id: string; date: IsoDate; clubId: string; currency: string
  gross: number; bonus: number; estimatedWithholding: number; agentFee: number; housing: number; net: number
  note: string
}
export interface ProResidence { associationId: string; city: string; monthlyRent: number; hotelUntil: IsoDate | null }
const shift = (date: IsoDate, days: number): IsoDate => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
/** Game economy coefficients only. Not actual rates, tax advice or legal eligibility. */
const GAME_WITHHOLDING: Record<string, number> = { eng: 21, sco: 21, rsa: 20, usa: 19, bra: 20, fra: 24, ger: 23, esp: 22, ita: 22, jpn: 19, nga: 18 }
export function gameWithholdingBps(associationId: string): number { return (GAME_WITHHOLDING[associationId] ?? 20) * 100 }
export function startProTalks(world: ProWorldState, clubId: string, date: IsoDate, annualWage: number): ProTalks {
  const club = world.clubs[clubId]
  if (!club || date !== world.currentDate) throw new Error('Invalid offer date or club')
  return { clubId, opened: date, ready: shift(date, 2 + Math.floor(proRoll(world.seed, `${clubId}:${date}:talks`) * 3)),
    annualWage, countered: false, status: 'pending' }
}
export function progressProTalks(talks: ProTalks | null, date: IsoDate): ProTalks | null {
  return talks?.status === 'pending' && date >= talks.ready ? { ...talks, status: 'ready' } : talks
}
export function counterProTalks(world: ProWorldState, talks: ProTalks, date: IsoDate, agentId: ProAgentId): ProTalks {
  if (talks.status !== 'ready' || talks.countered) throw new Error('Counteroffer unavailable')
  const club = world.clubs[talks.clubId]
  const multiplier = agentId === 'established' ? 1.08 : agentId === 'local' ? 1.05 : 1.02
  const wage = Math.floor(talks.annualWage * multiplier)
  const deal = { annualWage: wage, probableAnnualBonuses: 0, annualTransferCost: 0, annualAgentFee: 0,
    upfrontTransferPayment: 0, signingBonus: 0, role: 'prospect' as const }
  if (!club || !assessProDeal(club.finances, deal).affordable) return { ...talks, status: 'rejected', countered: true }
  return { ...talks, annualWage: wage, ready: shift(date, 2), countered: true, status: 'pending' }
}
export function createProContract(world: ProWorldState, playerId: string, clubId: string, date: IsoDate,
  annualWage: number, role: ProContract['role'], agentId: ProAgentId, loanRisk: ProContract['loanRisk']): ProContract {
  const club = world.clubs[clubId]
  if (!club) throw new Error('Club unavailable')
  const years = 2 + Math.floor(proRoll(world.seed, `${playerId}:${clubId}:years`) * 3)
  const expires = `${Number(date.slice(0, 4)) + years}-${date.slice(5)}`
  const bonusUnit = Math.floor(annualWage / (role === 'prospect' ? 85 : 65))
  return { id: `contract-${playerId}-${date}`, playerId, clubId, signed: date, expires,
    annualWage, appearanceBonus: bonusUnit, goalBonus: bonusUnit * 3, assistBonus: bonusUnit * 2,
    signingBonus: Math.floor(annualWage * .08), releaseClause: role === 'prospect' ? null : annualWage * 6,
    role, agentId, loanRisk, currency: world.associations[club.associationId].currency }
}
export function settleProMonth(contract: ProContract, world: ProWorldState, date: IsoDate,
  bonus: number, residence: ProResidence | null): ProLedgerLine {
  const club = world.clubs[contract.clubId]
  const monthStart = `${date.slice(0, 7)}-01`
  const activeStart = contract.signed > monthStart ? contract.signed : monthStart
  const daysInMonth = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).getUTCDate()
  const activeDays = Math.max(0, Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${activeStart}T00:00:00Z`)) / 86400000) + 1)
  const gross = Math.floor(contract.annualWage / 12 * activeDays / daysInMonth)
  const estimatedWithholding = Math.floor((gross + bonus) * gameWithholdingBps(club.associationId) / 10_000)
  const agentFee = Math.floor((gross + bonus) * PRO_AGENTS.find(agent => agent.id === contract.agentId)!.feeBps / 10_000)
  const hotelEnd = residence?.hotelUntil && residence.hotelUntil < date ? residence.hotelUntil : date
  const hotelDays = residence?.hotelUntil && hotelEnd >= activeStart
    ? Math.min(activeDays, Math.floor((Date.parse(`${hotelEnd}T00:00:00Z`) - Date.parse(`${activeStart}T00:00:00Z`)) / 86400000) + 1) : 0
  const housing = residence?.associationId === club.associationId
    ? Math.floor(residence.monthlyRent * (activeDays + hotelDays * .5) / daysInMonth) : 0
  return { id: `ledger-${contract.id}-${date}`, date, clubId: club.id, currency: contract.currency,
    gross, bonus, estimatedWithholding, agentFee, housing, net: gross + bonus - estimatedWithholding - agentFee - housing,
    note: 'Fictional game estimate, not a tax calculation.' }
}
export function moveResidence(world: ProWorldState, clubId: string, date: IsoDate): ProResidence {
  const club = world.clubs[clubId]
  return { associationId: club.associationId, city: club.homeCity,
    monthlyRent: Math.max(5000, Math.floor(club.finances.topPlayerAnnualWage / 120)), hotelUntil: shift(date, 21) }
}
