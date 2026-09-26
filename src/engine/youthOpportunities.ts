import type { Player } from '../types/player'
import { initYouthPathway } from './pathway'

export function currentPerformance(player: Player, ids: string[]) {
  const records = Object.values(player.competitionCareer?.current ?? {}).filter(r => ids.includes(r.competitionId))
  const appearances = records.reduce((sum, r) => sum + r.appearances, 0)
  const average = appearances ? records.reduce((sum, r) => sum + r.ratingTotal, 0) / appearances : 0
  return { appearances, average }
}

export function representativeEvidence(player: Player, level: 'regional' | 'national') {
  const record = currentPerformance(player, level === 'regional'
    ? ['schoolLeague', 'schoolReserveLeague', 'schoolCup'] : ['nationalChampionship'])
  const minimum = level === 'regional' ? 10 : 3
  const requiredRating = level === 'regional' ? 6.7 : 7
  const regionalFinalist = level === 'regional' && player.competitionCareer?.qualifications.some(q =>
    q.competitionId === 'schoolCup' && q.qualifiedFor === 'nationalChampionship' &&
    q.season === player.competitionCareer?.current.schoolCup?.season) &&
    (player.competitionCareer?.current.schoolCup?.appearances ?? 0) >= 3
  const finalist = level === 'national' && player.competitionCareer?.qualifications.some(q =>
    q.competitionId === 'nationalChampionship' && q.qualifiedFor === 'international' &&
    q.season === player.competitionCareer?.current.nationalChampionship?.season)
  const eligible = record.appearances >= minimum && (level === 'national' && player.regionId ? finalist : record.average >= requiredRating || regionalFinalist)
    && (level === 'regional' || player.pathway?.regionalSelection === 'selected')
  return { ...record, eligible, reason: eligible ? 'Sustained performances meet the selection standard.'
    : level === 'national' && player.regionId ? 'Your regional XI must reach the national final, and you need three championship appearances.'
      : `Requires ${minimum} ${level === 'regional' ? 'school league/cup' : 'National Schools Championship'} appearances averaging ${requiredRating.toFixed(1)}.` }
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
