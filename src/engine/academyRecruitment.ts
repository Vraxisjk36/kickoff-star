import type { Player } from '../types/player'
import type { CalendarState } from '../types/calendar'
import { SEASON_WEEKS } from './calendar'
import { competitionDefinition } from './competitionCareer'
import { initYouthPathway } from './pathway'
import { addStoryMoment, createStoryMoment } from './presentation'
import { computeCurrentAbility, toOvr } from './rating'

export function academyTrialBase(player: Player): number {
  const ratings = player.matchRatings.slice(-5)
  const form = ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 6
  return Math.max(10, Math.min(45, Math.round((toOvr(computeCurrentAbility(player)) - 30) * 1.25 + (form - 5) * 5)))
}

export const ACADEMY_MIN_AGE = 16
export const ACADEMY_FIRST_SEASON = 3
export const ACADEMY_WINDOW_START = 36 // October in the game's 44-week year.
export const ACADEMY_WINDOW_END = 39
export const MIN_SCOUT_VISITS = 6

export function recruitmentDate(player: Player, calendar?: CalendarState | null) {
  return {
    season: calendar?.currentWeek.seasonYear ?? Math.floor((player.totalWeeksElapsed ?? 0) / SEASON_WEEKS) + 1,
    week: calendar?.currentWeek.weekNumber ?? (player.totalWeeksElapsed ?? 0) % SEASON_WEEKS + 1,
  }
}

export function academyEntryOpen(player: Player, calendar?: CalendarState | null) {
  const { season, week } = recruitmentDate(player, calendar)
  return player.careerClock.phase === 'grassroots-season' && player.careerClock.ageYears >= ACADEMY_MIN_AGE
    && (season > ACADEMY_FIRST_SEASON || season === ACADEMY_FIRST_SEASON && week >= ACADEMY_WINDOW_START)
}

// Read the durable competition archive, never extrapolate two years from the
// rolling ten-match form array. Ratings already assess each playing position.
export function academyRecruitmentReport(player: Player, calendar?: CalendarState | null) {
  const { season, week } = recruitmentDate(player, calendar)
  const seasons = new Map<number, { appearances: number; ratingTotal: number }>()
  const records = [...(player.competitionCareer?.history ?? []), ...Object.values(player.competitionCareer?.current ?? {})]
  for (const record of records) {
    const def = competitionDefinition(record.competitionId)
    if (record.season < season - 2 || record.season > season || def.format === 'selection' || record.appearances <= 0) continue
    const prev = seasons.get(record.season) ?? { appearances: 0, ratingTotal: 0 }
    seasons.set(record.season, { appearances: prev.appearances + record.appearances, ratingTotal: prev.ratingTotal + record.ratingTotal })
  }
  const rows = [season - 2, season - 1, season].map(year => {
    const s = seasons.get(year) ?? { appearances: 0, ratingTotal: 0 }
    return { season: year, appearances: s.appearances, average: s.appearances ? s.ratingTotal / s.appearances : 0 }
  })
  const appearances = rows.reduce((sum, row) => sum + row.appearances, 0)
  const average = appearances ? rows.reduce((sum, row) => sum + row.average * row.appearances, 0) / appearances : 0
  const recent = (player.matchRatings ?? []).slice(-10)
  const recentAverage = recent.length ? recent.reduce((sum, r) => sum + r, 0) / recent.length : 0
  const completedSeasons = rows.slice(0, 2).filter(row => row.appearances >= 10).length
  const reasons: string[] = []
  if (player.careerClock.ageYears < ACADEMY_MIN_AGE) reasons.push('Academy scouting starts at age 16.')
  if (season < ACADEMY_FIRST_SEASON) reasons.push('The first academy invitation window is October of your third year.')
  if (completedSeasons < 2) reasons.push('Build a record of at least 10 appearances in each of the previous two seasons.')
  if (rows[2].appearances < 8 || appearances < 30) reasons.push('Play at least 8 matches this season and 30 across the three-season review.')
  if (rows.slice(0, 2).some(row => row.average < 6.3) || average < 6.6) reasons.push('Scouts need sustained performances: 6.3 in each previous season and 6.6 across the full record.')
  if (rows[2].average < 6.6 || recent.length < 5 || recentAverage < 6.5) reasons.push('Maintain 6.6 this season and 6.5 over your recent matches.')
  const recordReady = reasons.length === 0 && player.careerClock.phase === 'grassroots-season'
  const windowOpen = week >= ACADEMY_WINDOW_START && week <= ACADEMY_WINDOW_END
  if (!windowOpen) reasons.push('Academy invitations are reviewed in October.')
  return { season, week, rows, appearances, average, recentAverage, completedSeasons, recordReady, windowOpen,
    canInvite: recordReady && windowOpen && academyEntryOpen(player, calendar), reasons }
}

export function canPlayYouthShowcase(player: Player, calendar: CalendarState) {
  return academyEntryOpen(player, calendar) && player.pathway?.showcaseInvited === true
    && player.pathway.showcaseSeason === calendar.currentWeek.seasonYear
}

// Called on the weekly clock as well as after matches: an eliminated school
// player must still receive the October review without needing a cup fixture.
export function reviewAcademyShowcase(player: Player, calendar: CalendarState): Player {
  if (player.careerClock.phase === 'academy') return player
  const report = academyRecruitmentReport(player, calendar)
  const showcaseWeek = player.grassrootsPath === 'sunday' ? 38 : 37
  const pathway = player.pathway ?? initYouthPathway(player)
  if (!report.canInvite || report.week > showcaseWeek || pathway.showcaseSeason === report.season) return player
  const story = createStoryMoment({ kind: 'invitation', eyebrow: 'October Youth Showcase', title: 'SHOWCASE INVITATION',
    body: 'Your record across the previous two seasons and this year has earned an academy scouting showcase.',
    detail: `${report.appearances} appearances · ${report.average.toFixed(2)} average rating · recent form ${report.recentAverage.toFixed(2)}. Clubs still need repeated observations before a trial invitation; a scholarship requires a successful trial and contract talks.`,
    season: report.season, week: report.week, ceremony: 'callup',
    metrics: [{ label: 'Matches reviewed', value: report.appearances }, { label: 'Career review rating', value: Number(report.average.toFixed(2)), suffix: '/10' }],
  })
  return { ...player, pathway: { ...pathway, showcaseInvited: true, showcaseSeason: report.season }, inbox: addStoryMoment(player.inbox, story) }
}

// Repair pending legacy shortcuts; never undo a move the player has already
// completed or change their results, age, attributes, or community registration.
export function migrateAcademyRecruitment(player: Player, calendar: CalendarState): Player {
  if (player.careerClock.phase === 'academy') return player
  const pathway = player.pathway ?? initYouthPathway(player)
  const legacy = pathway.recruitmentVersion !== 1
  const report = academyRecruitmentReport(player, calendar)
  const validEntry = academyEntryOpen(player, calendar)
  const removeOffers = !validEntry || legacy && !report.recordReady
  const removedIds = new Set((player.contractOffers ?? []).filter(o => removeOffers && o.kind === 'academy').map(o => o.clubId))
  const validShowcase = validEntry && (legacy ? report.canInvite : pathway.showcaseSeason === report.season)
  return { ...player,
    scoutWatchers: player.careerClock.ageYears < ACADEMY_MIN_AGE || legacy ? [] : player.scoutWatchers,
    contractOffers: (player.contractOffers ?? []).filter(o => !(removeOffers && o.kind === 'academy')),
    negotiation: removeOffers && player.negotiation?.kind === 'academy' ? null : player.negotiation,
    pathway: { ...pathway, recruitmentVersion: 1, showcaseInvited: validShowcase && pathway.showcaseInvited,
      showcaseSeason: validShowcase && pathway.showcaseInvited ? report.season : undefined,
      ...(removeOffers ? { academyTrialStatus: 'none' as const, academyTrialClubId: undefined } : {}) },
    inbox: (player.inbox ?? []).filter(item => !(legacy && (
      item.title === 'SHOWCASE INVITATION' && !validShowcase
      || item.eyebrow === 'Academy invitation' && removedIds.size > 0))),
  }
}

export function academyTrialAvailable(player: Player, offerId: string, calendar?: CalendarState | null) {
  const offer = (player.contractOffers ?? []).find(o => o.id === offerId && o.kind === 'academy')
  return academyEntryOpen(player, calendar) && !!offer && (player.totalWeeksElapsed ?? 0) - offer.weekOffered < offer.expiresInWeeks
}
