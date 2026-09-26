import type { Player } from '../types/player'
import type { LeagueWorld, DivisionTier } from './league'
import { currentPerformance } from './youthOpportunities'

export interface SundayContract {
  clubId: string; clubName: string; division: DivisionTier; season: number; weeklyWage: number; lastPaidWeek?: number
}
export const SUNDAY_WAGE_RANGES: Record<DivisionTier, [number, number]> = { 3: [10, 15], 2: [20, 30], 1: [35, 50] }
export const SUNDAY_ENERGY_MULTIPLIERS: Record<DivisionTier, number> = { 3: 1, 2: 1.12, 1: 1.25 }
export function sundayWage(division: DivisionTier, average: number) {
  const [low, high] = SUNDAY_WAGE_RANGES[division]
  return Math.round(low + (high - low) * Math.max(0, Math.min(1, (average - 6) / 2)))
}
export function hasSundayContract(player: Player, season: number, world?: LeagueWorld | null) {
  return !!world && player.sundayContract?.season === season && player.sundayContract.clubId === world.playerTeamId
}

/** Exactly one batch: the first Division 3 approach, or the end-of-season
 * transfer week (week 1 of the new year, after promotions have been applied). */
export function openSundayContractWindow(player: Player, world: LeagueWorld, season: number, firstOffer = false, recordPlayer = player): Player {
  if (player.lastSundayOfferSeason === season || player.sundayContract?.season === season) return player
  const record = currentPerformance(recordPlayer, ['sundayLeague', 'sundayCup'])
  const schoolRecord = currentPerformance(recordPlayer, ['schoolLeague', 'schoolReserveLeague', 'schoolCup'])
  const first = firstOffer || !player.sundayContract
  if (first && player.grassrootsPath === 'school' && (schoolRecord.appearances < 10 || schoolRecord.average < 6.8)) return player
  const ownDivision: DivisionTier = first ? 3 : world.playerDivision
  const ownTeam = world.divisions[ownDivision].teams.find(t => t.id === world.playerTeamId) ?? world.divisions[ownDivision].teams[0]
  const candidates = [{ team: ownTeam, division: ownDivision, renewal: !first && ownTeam.id === player.sundayContract?.clubId }]
  if (!first && record.appearances >= 8 && record.average >= 6.8) {
    const target = (record.appearances >= 10 && record.average >= 7.2 && ownDivision > 1 ? ownDivision - 1 : ownDivision) as DivisionTier
    for (const team of world.divisions[target].teams.filter(t => t.id !== ownTeam.id).slice(0, 2)) candidates.push({ team, division: target, renewal: false })
  }
  const offers: Player['contractOffers'] = candidates.map(({ team, division, renewal }) => ({
    id: crypto.randomUUID(), kind: 'club', clubId: team.id, clubName: team.name, clubShort: team.short, prestige: team.prestige, ratings: team.ratings,
    divisionTier: division, weeklyWage: sundayWage(division, first ? schoolRecord.average : record.average),
    contractSeason: season, renewal, weekOffered: player.totalWeeksElapsed ?? 0, expiresInWeeks: first ? 3 : 1,
  }))
  return { ...player, lastSundayOfferSeason: season, contractOffers: [...player.contractOffers.filter(o => o.kind !== 'club'), ...offers] }
}

export function migrateSundayContracts(player: Player, world: LeagueWorld | null | undefined, season: number): Player {
  let sundayContract = player.sundayContract
  if (player.sundayContractsVersion !== 1 && !sundayContract && world && (player.grassrootsPath === 'sunday' || player.pathway?.sundayStatus === 'registered')) {
    const team = world.divisions[world.playerDivision].teams.find(t => t.id === world.playerTeamId)
    if (team) sundayContract = { clubId: team.id, clubName: team.name, division: world.playerDivision, season, weeklyWage: sundayWage(world.playerDivision, 6.5) }
  }
  return { ...player, sundayContractsVersion: 1, sundayContract,
    contractOffers: player.contractOffers.filter(o => o.kind !== 'club' || o.contractSeason === season && o.weeklyWage !== undefined) }
}
