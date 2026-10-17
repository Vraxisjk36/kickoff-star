import { assessProDeal } from './proClubFinance'
import { isInPeriod } from './proCalendar'
import { proCalendarProfile, proRoll } from './proWorldFactory'
import { completeProTransfer } from './proTransfers'
import { nextShirtNumber } from './proLifecycle'
import { createProContract } from './proContracts'
import type { IsoDate, ProWorldState } from './proWorld'

/** Provisional game windows. Authoritative league editions replace these later. */
export function registrationOpen(associationId: string, date: IsoDate): boolean {
  const year = Number(date.slice(0, 4))
  return [year - 1, year].some(startYear => isInPeriod(date, proCalendarProfile(associationId, startYear).registrationPeriods))
}
export interface MarketMove { clubId: string; annualWage: number; fee: number; loanRisk: 'low' | 'high' }
export function findMarketMoves(world: ProWorldState, playerId: string, reputation: number): MarketMove[] {
  const player = world.players[playerId]
  if (!player?.clubId) return []
  const seller = world.clubs[player.clubId]
  const fee = Math.max(0, player.annualWage * 2)
  if (!registrationOpen(seller.associationId, world.currentDate)) return []
  const candidates = Object.values(world.clubs).filter(club => club.id !== seller.id &&
    registrationOpen(club.associationId, world.currentDate) &&
    club.reputation >= seller.reputation - 5 && club.reputation <= seller.reputation + Math.max(2, Math.floor(reputation / 10)))
    .sort((a, b) => Number(b.associationId === seller.associationId) - Number(a.associationId === seller.associationId) ||
      proRoll(world.seed, `${playerId}:${a.id}:interest-order`) - proRoll(world.seed, `${playerId}:${b.id}:interest-order`))
  const moves: MarketMove[] = []
  for (const club of candidates) {
    const wage = Math.max(1, Math.floor(Math.min(club.finances.topPlayerAnnualWage * .55,
      (club.finances.annualSquadCostLimit - club.finances.committedAnnualWages - club.finances.committedAnnualBonuses -
        club.finances.committedAnnualTransferCosts - club.finances.committedAnnualAgentFees - club.finances.reservedAnnualSquadCosts) * .65)))
    const deal = { annualWage: wage, probableAnnualBonuses: Math.floor(wage / 65) * 45, annualTransferCost: 0,
      annualAgentFee: 0, upfrontTransferPayment: fee, signingBonus: Math.floor(wage * .08), role: 'rotation' as const }
    if (assessProDeal(club.finances, deal).affordable && proRoll(world.seed, `${playerId}:${club.id}:${world.currentDate}:interest`) < .45) {
      const offer = { clubId: club.id, annualWage: wage, fee, loanRisk: club.reputation > seller.reputation ? 'high' as const : 'low' as const }
      if (moves.length < 3) moves.push(offer)
      else if (club.associationId !== seller.associationId && !moves.some(move => world.clubs[move.clubId].associationId !== seller.associationId)) moves[2] = offer
    }
    if (moves.length === 3 && moves.some(move => world.clubs[move.clubId].associationId !== seller.associationId)) break
  }
  return moves.slice(0, 3)
}
export function signMarketMove(world: ProWorldState, playerId: string, move: MarketMove, annualWage = move.annualWage): ProWorldState {
  const player = world.players[playerId]
  const buyer = world.clubs[move.clubId]
  if (!player?.clubId || !buyer || !registrationOpen(buyer.associationId, world.currentDate) ||
      !registrationOpen(world.clubs[player.clubId].associationId, world.currentDate)) throw new Error('Registration period closed')
  const contract = createProContract(world, playerId, buyer.id, world.currentDate, annualWage, 'rotation', 'family', move.loanRisk)
  const deal = { annualWage, probableAnnualBonuses: contract.appearanceBonus * 30 + contract.goalBonus * 5, annualTransferCost: 0,
    annualAgentFee: 0, upfrontTransferPayment: move.fee, signingBonus: Math.floor(annualWage * .08), role: 'rotation' as const }
  const result = completeProTransfer(world, playerId, buyer.id, deal, world.currentDate)
  if (!result.ok) throw new Error(`Transfer rejected: ${result.reasons.join(', ')}`)
  return result.world
}
export function startProLoan(world: ProWorldState, playerId: string, borrowingClubId: string, ends: IsoDate): {
  world: ProWorldState; loan: { parentClubId: string; borrowingClubId: string; ends: IsoDate; originalWage: number }
} {
  const player = world.players[playerId]
  const borrower = world.clubs[borrowingClubId]
  if (!player?.clubId || !borrower || player.clubId === borrowingClubId || ends <= world.currentDate ||
      !registrationOpen(borrower.associationId, world.currentDate)) throw new Error('Loan unavailable')
  const share = Math.floor(player.annualWage * .5)
  const affordable = assessProDeal(borrower.finances, { annualWage: share, probableAnnualBonuses: 0,
    annualTransferCost: 0, annualAgentFee: 0, upfrontTransferPayment: 0, signingBonus: 0, role: 'rotation' }).affordable
  if (!affordable) throw new Error('Borrowing club cannot afford the loan')
  const next = structuredClone(world)
  const moved = next.players[playerId]
  const parentClubId = moved.clubId!
  next.clubs[parentClubId].finances.committedAnnualWages -= share
  next.clubs[borrowingClubId].finances.committedAnnualWages += share
  next.loans[playerId] = { parentClubId, borrowingClubId, ends, originalWage: player.annualWage }
  moved.clubId = borrowingClubId
  moved.shirtNumber = nextShirtNumber(Object.values(next.players), borrowingClubId,
    25 + Math.floor(proRoll(next.seed, `${playerId}:${borrowingClubId}:shirt`) * 60))
  next.recentEvents.push({ id: `event-loan-${playerId}-${world.currentDate}`, date: world.currentDate, kind: 'transfer',
    subjectIds: [playerId, parentClubId, borrowingClubId], details: { action: 'loan', ends } })
  return { world: next, loan: { parentClubId, borrowingClubId, ends, originalWage: player.annualWage } }
}
export function returnProLoan(world: ProWorldState, playerId: string, loan: {
  parentClubId: string; borrowingClubId: string; ends: IsoDate; originalWage: number
}): ProWorldState {
  const next = structuredClone(world)
  const player = next.players[playerId]
  if (!player || player.clubId !== loan.borrowingClubId || next.currentDate < loan.ends) throw new Error('Loan return unavailable')
  const share = Math.floor(loan.originalWage * .5)
  next.clubs[loan.borrowingClubId].finances.committedAnnualWages -= share
  next.clubs[loan.parentClubId].finances.committedAnnualWages += share
  delete next.loans[playerId]
  player.clubId = loan.parentClubId
  player.shirtNumber = nextShirtNumber(Object.values(next.players), loan.parentClubId,
    25 + Math.floor(proRoll(next.seed, `${playerId}:${loan.parentClubId}:return-shirt`) * 60))
  next.recentEvents.push({ id: `event-loan-return-${playerId}-${next.currentDate}`, date: next.currentDate, kind: 'transfer',
    subjectIds: [playerId, loan.parentClubId], details: { action: 'loan-return' } })
  return next
}
