/** Money is stored in minor currency units; all figures share a club's currency. */
export type Money = number

export interface ProClubFinances {
  clubId: string
  currency: string
  annualRevenue: Money
  /** Original revenue used to avoid unbounded financial collapse in distant leagues. */
  baselineAnnualRevenue?: Money
  cash: Money
  debt?: Money
  annualSquadCostLimit: Money
  committedAnnualWages: Money
  committedAnnualBonuses: Money
  committedAnnualTransferCosts: Money
  committedAnnualAgentFees: Money
  reservedAnnualSquadCosts: Money
  committedTransferPayments: Money
  /** Highest existing annual player wage, excluding bonuses. */
  topPlayerAnnualWage: Money
  /** Share of the existing top wage the board permits for this role. */
  roleWageMultiplier: Record<'prospect' | 'rotation' | 'starter' | 'star', number>
}

export interface ProposedProDeal {
  annualWage: Money
  probableAnnualBonuses: Money
  annualTransferCost: Money
  annualAgentFee: Money
  upfrontTransferPayment: Money
  signingBonus: Money
  role: keyof ProClubFinances['roleWageMultiplier']
}

export type DealAssessment = {
  affordable: boolean
  reasons: Array<'squad_budget' | 'cash' | 'wage_hierarchy' | 'invalid_finances'>
  annualHeadroom: Money
  cashHeadroom: Money
  roleWageCeiling: Money
}

/** Evaluate every commitment before an AI club is allowed to submit an offer. */
export function assessProDeal(club: ProClubFinances, deal: ProposedProDeal): DealAssessment {
  const amounts = [
    club.annualRevenue, club.cash, club.annualSquadCostLimit,
    club.committedAnnualWages, club.committedAnnualBonuses,
    club.committedAnnualTransferCosts, club.committedAnnualAgentFees,
    club.reservedAnnualSquadCosts, club.committedTransferPayments,
    club.topPlayerAnnualWage, deal.annualWage, deal.probableAnnualBonuses,
    deal.annualTransferCost, deal.annualAgentFee,
    deal.upfrontTransferPayment, deal.signingBonus,
  ]
  const multiplier = club.roleWageMultiplier[deal.role]
  const valid = amounts.every(value => Number.isSafeInteger(value) && value >= 0)
    && Number.isFinite(multiplier) && multiplier >= 0
  const annualHeadroom = club.annualSquadCostLimit
    - club.committedAnnualWages - club.committedAnnualBonuses
    - club.committedAnnualTransferCosts - club.committedAnnualAgentFees
    - club.reservedAnnualSquadCosts
  const cashHeadroom = club.cash - club.committedTransferPayments
  const roleWageCeiling = Math.floor(club.topPlayerAnnualWage * multiplier)
  const reasons: DealAssessment['reasons'] = []
  if (!valid) reasons.push('invalid_finances')
  if (deal.annualWage + deal.probableAnnualBonuses + deal.annualTransferCost + deal.annualAgentFee > annualHeadroom) reasons.push('squad_budget')
  if (deal.upfrontTransferPayment + deal.signingBonus > cashHeadroom) reasons.push('cash')
  if (deal.annualWage > roleWageCeiling) reasons.push('wage_hierarchy')
  return { affordable: reasons.length === 0, reasons, annualHeadroom, cashHeadroom, roleWageCeiling }
}
