import { assessProDeal, type ProposedProDeal } from './proClubFinance'
import type { IsoDate, ProWorldState } from './proWorld'

export type ProTransferOutcome =
  | { ok: true; world: ProWorldState }
  | { ok: false; reasons: string[] }

/** Atomic signed transfer. Negotiation, visas, and registration checks come later. */
export function completeProTransfer(source: ProWorldState, playerId: string, targetClubId: string,
  deal: ProposedProDeal, date: IsoDate): ProTransferOutcome {
  const player = source.players[playerId]
  const buyer = source.clubs[targetClubId]
  if (!player || !buyer) return { ok: false, reasons: ['missing_player_or_club'] }
  if (date !== source.currentDate) return { ok: false, reasons: ['world_date_mismatch'] }
  if (player.clubId === targetClubId) return { ok: false, reasons: ['already_at_club'] }
  if (player.clubId && Object.values(source.players).filter(candidate => candidate.clubId === player.clubId).length <= 18)
    return { ok: false, reasons: ['seller_squad_too_small'] }
  const check = assessProDeal(buyer.finances, deal)
  if (!check.affordable) return { ok: false, reasons: check.reasons }
  const world = structuredClone(source)
  const moving = world.players[playerId]
  const destination = world.clubs[targetClubId]
  const seller = moving.clubId ? world.clubs[moving.clubId] : undefined
  if (seller) {
    seller.finances.cash += deal.upfrontTransferPayment
    seller.finances.committedAnnualWages -= moving.annualWage
    if (seller.finances.topPlayerAnnualWage === moving.annualWage) seller.finances.topPlayerAnnualWage =
      Math.max(0, ...Object.values(world.players).filter(candidate => candidate.clubId === seller.id && candidate.id !== moving.id)
        .map(candidate => candidate.annualWage))
  }
  destination.finances.cash -= deal.upfrontTransferPayment + deal.signingBonus
  destination.finances.committedAnnualWages += deal.annualWage
  destination.finances.committedAnnualBonuses += deal.probableAnnualBonuses
  destination.finances.committedAnnualTransferCosts += deal.annualTransferCost
  destination.finances.committedAnnualAgentFees += deal.annualAgentFee
  destination.finances.topPlayerAnnualWage = Math.max(destination.finances.topPlayerAnnualWage, deal.annualWage)
  const oldClubId = moving.clubId
  moving.clubId = targetClubId
  moving.annualWage = deal.annualWage
  const used = new Set(Object.values(world.players).filter(candidate => candidate.clubId === targetClubId && candidate.id !== playerId)
    .map(candidate => candidate.shirtNumber))
  moving.shirtNumber = Array.from({ length: 99 }, (_, i) => i + 1).find(number => !used.has(number)) ?? 100
  world.recentEvents = [...world.recentEvents, { id: `event-transfer-${playerId}-${date}-${targetClubId}`,
    date, kind: 'transfer' as const, subjectIds: [playerId, targetClubId, ...(oldClubId ? [oldClubId] : [])],
    details: { fee: deal.upfrontTransferPayment, annualWage: deal.annualWage } }].slice(-240)
  return { ok: true, world }
}
