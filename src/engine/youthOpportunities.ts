import type { Player } from '../types/player'
import { initYouthPathway } from './pathway'

export function currentPerformance(player: Player, ids: string[]) {
  const records = Object.values(player.competitionCareer?.current ?? {}).filter(r => ids.includes(r.competitionId))
  const appearances = records.reduce((sum, r) => sum + r.appearances, 0)
  const average = appearances ? records.reduce((sum, r) => sum + r.ratingTotal, 0) / appearances : 0
  return { appearances, average }
}

/** Private scouting ledger: every appearance counts, with larger stages carrying
 * more weight. Selection still considers form, ability and fitness separately. */
export function representativePoints(player: Player): number {
  const weights: Record<string, number> = { schoolLeague: 1, schoolReserveLeague: .65, schoolCup: 1.45,
    schoolDevelopment: .55, schoolDevelopmentLeague: .45, sundayLeague: .8,
    octoberDevelopment: .7, nationalChampionship: 1.8, youthShowcase: 1.2 }
  return Math.round(Object.values(player.competitionCareer?.current ?? {}).reduce((total, row) => {
    const weight = weights[row.competitionId] ?? 0
    return total + weight * (row.appearances * 4 + Math.max(0, row.ratingTotal - row.appearances * 5.5) * 3 + row.goals * 2 + row.assists * 1.5)
  }, 0))
}

export function representativeEvidence(player: Player, level: 'regional' | 'national') {
  const record = currentPerformance(player, level === 'regional'
    ? ['schoolLeague', 'schoolReserveLeague', 'schoolCup']
    : ['schoolLeague', 'schoolReserveLeague', 'schoolCup', 'schoolDevelopment', 'schoolDevelopmentLeague', 'sundayLeague', 'octoberDevelopment', 'nationalChampionship'])
  const points = representativePoints(player)
  const eligible = level === 'regional'
    ? record.appearances >= 10 && record.average >= 6.5 && points >= 85
    : record.appearances >= 12 && record.average >= 6.6 && points >= 115 && player.pathway?.regionalSelection === 'selected'
  return { ...record, points, eligible, reason: eligible ? 'The season-long scouting record meets the selection standard.'
    : level === 'regional' ? 'Build ten school appearances and sustained form for the regional shortlist.'
      : 'National scouts weigh your local, regional and championship performances; a trophy is not required.' }
}

export function updateSundayRecruitment(player: Player, rating: number): Player {
  const pathway = player.pathway ?? initYouthPathway(player)
  if (player.grassrootsPath !== 'school' || pathway.sundayStatus === 'registered') return player
  const record = currentPerformance(player, ['schoolLeague', 'schoolReserveLeague', 'schoolCup'])
  // A match can add at most eight interest points. Goals are already reflected
  // in the position-aware rating, so a hat-trick cannot be counted twice.
  const delta = rating >= 7.5 ? 8 : rating >= 6.8 ? 5 : rating >= 6 ? 1 : -3
  const sundayInterest = Math.max(0, Math.min(100, pathway.sundayInterest + delta))
  const sundayStatus = record.appearances >= 10 && record.average >= 6.8 && sundayInterest >= 70 ? 'squad-offer'
    : record.appearances >= 6 && record.average >= 6.6 && sundayInterest >= 45 ? 'training-invite'
    : record.appearances >= 4 && sundayInterest >= 20 ? 'watched' : 'undiscovered'
  return { ...player, pathway: { ...pathway, sundayInterest, sundayStatus } }
}

export function repairSundayInvitation(player: Player): Player {
  const pathway = player.pathway
  if (!pathway || pathway.sundayStatus === 'registered' || player.grassrootsPath !== 'school') return player
  const record = currentPerformance(player, ['schoolLeague', 'schoolReserveLeague', 'schoolCup'])
  const premature = pathway.sundayStatus === 'squad-offer' && (record.appearances < 10 || record.average < 6.8)
    || pathway.sundayStatus === 'training-invite' && (record.appearances < 6 || record.average < 6.6)
  return premature ? { ...player, pathway: { ...pathway, sundayStatus: record.appearances >= 4 ? 'watched' : 'undiscovered', sundayInterest: Math.min(pathway.sundayInterest, 40) },
    inbox: (player.inbox ?? []).filter(item => item.title !== 'SUNDAY CLUB INVITE') } : player
}
