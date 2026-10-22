import type { IsoDate } from './proWorld'

export type DaySlot = 'morning' | 'afternoon' | 'evening'
export type ProActivityType = 'training' | 'match' | 'travel' | 'recovery' | 'media' | 'sponsor' | 'personal'
export interface ProActivity {
  id: string
  date: IsoDate
  slots: DaySlot[]
  kind: ProActivityType
  required: boolean
  title: string
}

export interface SeasonCalendarProfile {
  id: string
  /** Calendar months; the start year is the year in which the season opens. */
  startMonth: number
  endMonth: number
  /** Inclusive rest intervals, expressed as calendar dates for the given season. */
  breaks: Array<{ start: IsoDate; end: IsoDate }>
  registrationPeriods: Array<{ start: IsoDate; end: IsoDate }>
}

export function seasonEndYear(profile: SeasonCalendarProfile, startYear: number): number {
  return startYear + (profile.endMonth < profile.startMonth ? 1 : 0)
}

function validDate(date: IsoDate): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date
}

export function validateCalendarProfile(profile: SeasonCalendarProfile): string[] {
  const errors: string[] = []
  if (!Number.isInteger(profile.startMonth) || profile.startMonth < 1 || profile.startMonth > 12 ||
      !Number.isInteger(profile.endMonth) || profile.endMonth < 1 || profile.endMonth > 12)
    errors.push('invalid season months')
  for (const range of [...profile.breaks, ...profile.registrationPeriods])
    if (!validDate(range.start) || !validDate(range.end) || range.start > range.end) errors.push('invalid date range')
  return errors
}

export function isInPeriod(date: IsoDate, periods: SeasonCalendarProfile['breaks']): boolean {
  return periods.some(period => date >= period.start && date <= period.end)
}

/** Deterministic scheduling; caller can offer a different slot on conflict. */
export function scheduleProActivity(existing: ProActivity[], activity: ProActivity):
  { accepted: true; activities: ProActivity[] } | { accepted: false; conflictingIds: string[] } {
  if (!validDate(activity.date) || !activity.slots.length || new Set(activity.slots).size !== activity.slots.length ||
      activity.slots.some(slot => !['morning', 'afternoon', 'evening'].includes(slot)) ||
      existing.some(item => item.id === activity.id)) throw new Error('Invalid or duplicate pro activity')
  const conflictingIds = existing.filter(item => item.date === activity.date &&
    item.slots.some(slot => activity.slots.includes(slot))).map(item => item.id)
  return conflictingIds.length ? { accepted: false, conflictingIds } : { accepted: true, activities: [...existing, activity] }
}

export type ClubSeasonPhase = 'off-season' | 'pre-season' | 'regular-season' | 'international-duty'
export function clubSeasonPhase(date: IsoDate, calledUp = false): ClubSeasonPhase {
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  if (calledUp && (month === 6 || month === 7)) return 'international-duty'
  if (month === 7) return 'pre-season'
  if (month === 6 || (month === 5 && day >= 25)) return 'off-season'
  return 'regular-season'
}
