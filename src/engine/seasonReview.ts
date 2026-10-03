// ============================================================================
// PHASE 33 — SEASON REVIEW
//
// Playing a full career surfaced this: a season simply ENDED. Stats reset,
// promotion applied, cups redrew, a year of your life passed — and the player
// was shown nothing at all. In a career game the end-of-season review is one
// of the most satisfying beats there is, and it was missing entirely.
//
// This builds the review from state the game already has, so it costs nothing
// to maintain and can't drift out of sync with the actual season.
// ============================================================================
import type { Player } from '../types/player'
import type { LeagueWorld } from './league'
import type { AcademyWorld } from './academy'
import type { CupWorlds } from './save'
import { divisionLabel, sortStandings } from './league'
import { academyDivisionLabel } from './academy'

export interface SeasonReview {
  seasonNumber: number
  clubName: string
  competitionLabel: string
  finishPosition: number | null
  teamsInDivision: number
  promoted: boolean
  relegated: boolean
  appearances: number
  goals: number
  assists: number
  averageRating: number
  bestRating: number
  cupResults: { label: string; outcome: string }[]
  /** The single line that sums the year up. */
  verdict: string
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
}

export function buildSeasonReview(
  player: Player,
  world: LeagueWorld | AcademyWorld | null,
  cups: CupWorlds,
  isAcademy: boolean,
  seasonNumber: number,
  seasonStats: { appearances: number; goals: number; assists: number; ratings: number[] },
): SeasonReview {
  const division = world ? (world.divisions as Record<number, import('./league').Division>)[world.playerDivision] : null
  const standings = division ? sortStandings(division.standings) : []
  const idx = world ? standings.findIndex((s) => s.teamId === world.playerTeamId) : -1
  const finishPosition = idx >= 0 ? idx + 1 : null
  const teamsInDivision = standings.length

  const ratings = seasonStats.ratings
  const averageRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
  const bestRating = ratings.length ? Math.max(...ratings) : 0

  const cupResults = Object.values(cups)
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .map((c) => ({
      label: c.label,
      outcome: c.playerWonCup ? 'WINNERS' : c.playerEliminated ? 'knocked out' : c.stage === 'complete' ? 'finished' : 'still going',
    }))

  const promoted = finishPosition !== null && finishPosition <= 2 && (world?.playerDivision ?? 1) > 1
  const relegated = finishPosition !== null && teamsInDivision > 0 && finishPosition > teamsInDivision - 2

  // Grade the player's own year, not the team's.
  const perGame = seasonStats.appearances > 0 ? (seasonStats.goals + seasonStats.assists) / seasonStats.appearances : 0
  let grade: SeasonReview['grade'] = 'C'
  if (averageRating >= 7.5 || perGame >= 0.8) grade = 'A'
  else if (averageRating >= 6.9 || perGame >= 0.5) grade = 'B'
  else if (averageRating >= 6.2) grade = 'C'
  else if (averageRating >= 5.5) grade = 'D'
  else grade = 'F'
  if (seasonStats.appearances < 5) grade = seasonStats.appearances === 0 ? 'F' : 'D'

  const verdict = verdictFor(grade, seasonStats, promoted, relegated, cupResults)

  return {
    seasonNumber,
    clubName: player.academyClubName ?? 'your club',
    competitionLabel: world
      ? isAcademy ? academyDivisionLabel(world.playerDivision as 1 | 2, player.academyCountryId) : divisionLabel(world.playerDivision as 1 | 2 | 3)
      : 'the season',
    finishPosition,
    teamsInDivision,
    promoted,
    relegated,
    appearances: seasonStats.appearances,
    goals: seasonStats.goals,
    assists: seasonStats.assists,
    averageRating: Math.round(averageRating * 10) / 10,
    bestRating: Math.round(bestRating * 10) / 10,
    cupResults,
    verdict,
    grade,
  }
}

function verdictFor(
  grade: SeasonReview['grade'],
  stats: { appearances: number; goals: number; assists: number },
  promoted: boolean,
  relegated: boolean,
  cups: { label: string; outcome: string }[],
): string {
  const wonSomething = cups.some((c) => c.outcome === 'WINNERS')
  if (wonSomething && grade <= 'B') return 'Silverware, and you were part of it. Seasons like this are why you play.'
  if (promoted && grade <= 'B') return 'Promoted, and you were one of the reasons why. A proper year.'
  if (relegated) return 'Relegated. However you dress it up, that sits with you all summer.'
  if (stats.appearances === 0) return 'A season that never got going. Not one minute of league football.'
  if (stats.appearances < 8) return 'You barely featured. Whatever comes next has to start with playing.'

  switch (grade) {
    case 'A': return 'Your best year yet. People have started saying your name without being prompted.'
    case 'B': return 'A good season. Solid, dependable, and you finished it stronger than you started.'
    case 'C': return 'A season that happened. Not bad, not memorable. Next year needs to mean more.'
    case 'D': return 'Hard going. There were weeks you did not want to turn up, and it showed.'
    case 'F': return 'A year to forget. The only good thing about it is that it is over.'
  }
}
