// ============================================================================
// PHASE 36 — GLORY
//
// Requested from the reference screenshots: a trophy cabinet split into
// Personal / Club / National glory, tracking season-end AWARDS with career
// counts (League MVP x1, Golden Boot x2, etc) — distinct from the achievements
// system (career milestones like "first goal") and from the season review
// (a one-off card for a single year). Glory is the cumulative record.
//
// Decided at season end, from data the game already has:
//   PERSONAL — decided from the player's own season (rating, goals, assists,
//   team success). No award is free: each has a real bar to clear.
//   CLUB — decided from the season review's own finish position + cup results.
//   NATIONAL — decided from the international campaign completing with the
//   trophy won.
//
// Same discipline as achievements.ts: this OBSERVES and grants nothing to
// attributes/trust/reputation. A trophy is a record of what happened, not a
// lever on what happens next.
// ============================================================================
import type { Player } from '../types/player'
import type { SeasonReview } from './seasonReview'
import type { SyntheticScorer } from './headlines'

export type PersonalGloryKey = 'leagueMVP' | 'bestXI' | 'goldenBoot' | 'topAssister'
export type ClubGloryKey = 'leagueTitle' | 'cupWinner'
export type NationalGloryKey = 'internationalTrophy'

export const PERSONAL_GLORY_LABEL: Record<PersonalGloryKey, string> = {
  leagueMVP: 'League MVP',
  bestXI: 'League: Best XI',
  goldenBoot: 'League: Golden Boot',
  topAssister: 'League: Top Assister',
}
export const CLUB_GLORY_LABEL: Record<ClubGloryKey, string> = {
  leagueTitle: 'League Title',
  cupWinner: 'Cup Winner',
}
export const NATIONAL_GLORY_LABEL: Record<NationalGloryKey, string> = {
  internationalTrophy: 'International Trophy',
}

export type GloryCounts<K extends string> = Partial<Record<K, number>>

/**
 * Which personal awards did this season earn? Bars are deliberately real —
 * these should be rare enough that unlocking one feels like something, not a
 * participation trophy for finishing the season.
 */
export function computeSeasonAwards(
  review: SeasonReview,
  rival: SyntheticScorer | undefined,
  leagueLeaders?: { playerGoals: number; playerAssists: number; rivalGoals: number; rivalAssists: number },
): PersonalGloryKey[] {
  const won: PersonalGloryKey[] = []

  // Best XI: a genuinely strong, substantial season.
  if (review.appearances >= 15 && review.averageRating >= 7.2) won.push('bestXI')

  // Golden Boot: outscored the division's tracked rival striker by season end.
  if (leagueLeaders ? leagueLeaders.playerGoals > 0 && leagueLeaders.playerGoals > leagueLeaders.rivalGoals
    : rival && review.goals > rival.goals) won.push('goldenBoot')

  // Top Assister: a real creative season — matches the kind of tally a
  // division's best creator would actually put up, not a generous freebie.
  if (leagueLeaders ? leagueLeaders.playerAssists > 0 && leagueLeaders.playerAssists > leagueLeaders.rivalAssists
    : review.assists >= 10 && review.appearances >= 15) won.push('topAssister')

  // League MVP: the headline award — grade A season AND team success (won
  // the league or a cup, or was promoted). The individual alone isn't enough;
  // an MVP season is one where your form actually mattered to the table.
  if (review.grade === 'A' && (review.finishPosition === 1 || review.promoted || review.cupResults.some((c) => c.outcome === 'WINNERS'))) {
    won.push('leagueMVP')
  }

  return won
}

/** Club glory from the same season review — the team's own year. */
export function computeClubAwards(review: SeasonReview): ClubGloryKey[] {
  const won: ClubGloryKey[] = []
  if (review.finishPosition === 1) won.push('leagueTitle')
  if (review.cupResults.some((c) => c.outcome === 'WINNERS')) won.push('cupWinner')
  return won
}

export function addGlory<K extends string>(counts: GloryCounts<K> | undefined, keys: K[]): GloryCounts<K> {
  const next: GloryCounts<K> = { ...counts }
  for (const k of keys) next[k] = (next[k] ?? 0) + 1
  return next
}

export function totalGlory(player: Player): number {
  const sum = (c: Record<string, number> | undefined) => Object.values(c ?? {}).reduce((a, b) => a + b, 0)
  return sum(player.personalGlory) + sum(player.clubGlory) + sum(player.nationalGlory)
}
