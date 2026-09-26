import { rand } from './rng'
import type { CalendarState, CalendarWeek, DayOfWeek, CalendarEvent } from '../types/calendar'
import { allMatchWeeks, competitionRoundForWeek, type CompetitionRoundSpec } from './season'

const DAY_ORDER: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

// Season length. Bumped from 34 (Phase 8's 9-fixture season) to fit the full
// multi-competition calendar: 22 reserved league slots + cup football. School
// leagues use 18 fixtures; any spare slots naturally become training weeks.
// + Sunday Cup (KO) + 2 school friendlies, per the locked 30+ matches/season spec.
export const SEASON_WEEKS = 44
export const OCTOBER_DEVELOPMENT_WEEKS = [36, 37, 38, 39] as const
export const OCTOBER_DEVELOPMENT_TITLE = 'October development fixture'

function id() { return crypto.randomUUID() }

export function nextUnresolvedEvent(state: CalendarState): CalendarEvent | null {
  for (const day of DAY_ORDER) {
    const event = state.currentWeek.events.find(e => e.day === day && !e.resolved)
    if (event) return event
  }
  return null
}

export function markResolved(state: CalendarState, eventId: string): CalendarState {
  return {
    ...state,
    currentWeek: {
      ...state.currentWeek,
      events: state.currentWeek.events.map((e) => (e.id === eventId ? { ...e, resolved: true } : e)),
    },
  }
}

// Phase 17: match weeks are now derived from the generic season scheduler
// instead of a hand-picked set. This is the ONE registry of which
// competitions produce a matchday this season — P18-24 add entries here
// (Sunday Cup, School Cup, Academy cups, internationals) and the scheduler
// automatically seats them into free weeks with zero collisions.
//
// Right now only the Sunday League is registered, so behaviour is unchanged
// from the old hardcoded set (9 rounds spread across 34 weeks) — this is
// the plumbing for later phases, not a rules change on its own.
export const COMPETITION_SPECS: CompetitionRoundSpec[] = [
  { id: 'schoolFriendlies', rounds: 2 },
  { id: 'schoolLeague', rounds: 18 },
  { id: 'schoolCup', rounds: 8 }, // fifth through eighth slots retain legacy group draws
  { id: 'schoolDevelopment', rounds: 5 },
  { id: 'nationalChampionship', rounds: 5 }, // fifth slot keeps in-progress legacy group draws playable
  { id: 'sundayCup', rounds: 4 }, // pure knockout, field 16 -> 4 rounds — grassroots only
  // Phase 21: Academy gets the same cup depth as grassroots, per the locked
  // product strategy ("same depth applied to academy competitions"). These
  // slots sit unused during the grassroots phase and vice versa for the
  // grassroots-only ones above — phases never run concurrently so nothing
  // collides, it's just some slots are a no-op depending on which phase.
  { id: 'academyLeagueCup', rounds: 5 }, // U18 PL Cup equivalent — group + knockout
  { id: 'academyKnockoutCup', rounds: 4 }, // FA Youth Cup equivalent — pure knockout
]

// V4 career-year structure. Weeks 1-3 are onboarding trials and therefore
// intentionally contain no season fixture. Weeks 4-5 are the two pre-season
// friendlies. The existing V4 league/cup engines remain authoritative; this
// registry only decides WHEN their rounds are played.
export const SCHOOL_SEASON_SCHEDULE: Record<string, number[]> = {
  schoolFriendlies: [4, 5],
  schoolLeague: Array.from({ length: 18 }, (_, i) => i + 6), // W6-W23
  schoolCup: Array.from({ length: 8 }, (_, i) => i + 24),   // new knockout W24-W27; legacy draws through W31
  schoolDevelopment: Array.from({ length: 5 }, (_, i) => i + 24), // W24-W28
  nationalChampionship: Array.from({ length: 5 }, (_, i) => i + 32), // new knockout W32-W35; W36 supports legacy draws
  youthShowcase: [37],
}
export const SUNDAY_SEASON_SCHEDULE: Record<string, number[]> = {
  schoolLeague: Array.from({ length: 22 }, (_, i) => i + 6), // routed to Sunday League, W6-W27
  // The 22 league Sundays occupy W6-W27. Keep the first cup round at W30
  // for in-progress saves, then use free Sundays for the remaining ties.
  sundayCup: [30, 31, 33, 35], // final before the under-16 October league opens
  youthShowcase: [38],
}
export const ACADEMY_SEASON_SCHEDULE: Record<string, number[]> = {
  schoolLeague: Array.from({ length: 22 }, (_, i) => i + 1),
  academyLeagueCup: [24, 27, 30, 33, 36],
  academyKnockoutCup: [38, 40, 42, 44],
}
export const SEASON_SCHEDULE = SCHOOL_SEASON_SCHEDULE

// Kept as a Set export for backward compatibility with existing call sites
// (careerStore, FixturesTab) — now the UNION of every registered competition's
// match weeks, not just the league's.
export const MATCH_WEEKS = allMatchWeeks(SEASON_SCHEDULE)

// Which competition (and which round within it) is being played on a given
// calendar week — the piece careerStore needs once more than one competition
// can produce a matchday in the same season.
export function scheduleFor(phase: CareerPhase, grassrootsPath: GrassrootsPath = 'school') { return phase === 'academy' ? ACADEMY_SEASON_SCHEDULE : grassrootsPath === 'sunday' ? SUNDAY_SEASON_SCHEDULE : SCHOOL_SEASON_SCHEDULE }
export function competitionForWeek(weekNumber: number, phase: CareerPhase = 'grassroots-season', grassrootsPath: GrassrootsPath = 'school') {
  return competitionRoundForWeek(scheduleFor(phase, grassrootsPath), weekNumber)
}

// Which competitions actually RUN in each career phase. The scheduler seats
// all of them (phases share the same calendar shape), but during grassroots
// the academy cups are dormant and vice versa. A week whose competition is
// dormant for the current phase is NOT a matchday for the player — it renders
// as extra training instead (fixes the Phase 25 audit's "20 dead matchdays").
export type CareerPhase = 'grassroots-trials' | 'grassroots-season' | 'academy'
export type GrassrootsPath = 'school' | 'sunday'
const SCHOOL_ACTIVE = new Set(['schoolLeague','schoolCup','schoolDevelopment','schoolFriendlies','nationalChampionship','youthShowcase'])
const SUNDAY_ACTIVE = new Set(['sundayLeague', 'sundayCup', 'youthShowcase'])
const ACADEMY_ACTIVE = new Set(['sundayLeague', 'academyLeagueCup', 'academyKnockoutCup'])

export function isCompetitionActive(competitionId: string, phase: CareerPhase, grassrootsPath: GrassrootsPath = 'school'): boolean {
  const set = phase === 'academy' ? ACADEMY_ACTIVE : grassrootsPath === 'sunday' ? SUNDAY_ACTIVE : SCHOOL_ACTIVE
  return set.has(competitionId)
}

// The competition producing the player's Saturday match this week, or null
// (dormant competition or no fixture week at all).
export function activeCompetitionForWeek(weekNumber: number, phase: CareerPhase, grassrootsPath: GrassrootsPath = 'school', schoolDevelopment = false): { competitionId: string; round: number } | null {
  // The five development fixtures share Regional Cup weeks. The league table
  // decides which one the school enters; the saved cup world carries that choice.
  if (phase !== 'academy' && grassrootsPath === 'school' && schoolDevelopment) {
    const round = SCHOOL_SEASON_SCHEDULE.schoolDevelopment.indexOf(weekNumber)
    if (round !== -1) return { competitionId: 'schoolDevelopment', round: round + 1 }
  }
  const comp = competitionForWeek(weekNumber, phase, grassrootsPath)
  if (!comp) return null
  const routed = comp.competitionId === 'schoolLeague' && (phase === 'academy' || grassrootsPath === 'sunday')
    ? { ...comp, competitionId: 'sundayLeague' }
    : comp
  return isCompetitionActive(routed.competitionId, phase, grassrootsPath) ? routed : null
}

// Midweek international windows (Wednesdays, like real life) so international
// duty never collides with the packed Saturday club calendar. Four qualifier
// rounds spread through the season, then a three-round finals bracket
// (QF/SF/F) in the run-in.
export const INTERNATIONAL_QUALIFIER_WEEKS = [38,39,40,41]
export const INTERNATIONAL_FINALS_WEEKS = [42,43,44]
export function internationalRoundForWeek(weekNumber: number): { stage: 'qualifiers' | 'finals'; round: number } | null {
  const q = INTERNATIONAL_QUALIFIER_WEEKS.indexOf(weekNumber)
  if (q !== -1) return { stage: 'qualifiers', round: q + 1 }
  const f = INTERNATIONAL_FINALS_WEEKS.indexOf(weekNumber)
  if (f !== -1) return { stage: 'finals', round: f + 1 }
  return null
}

export function generateWeek(weekNumber: number, seasonYear: number, phase: CareerPhase = 'grassroots-season', hasInternationalDuty = false, grassrootsPath: GrassrootsPath = 'school', playsSundayFootball = false): CalendarWeek {
  void playsSundayFootball // Retained for callers and saved route compatibility.
  // International duty takes over the Wednesday slot on window weeks —
  // midweek internationals, so club Saturdays are untouched.
  const internationalWeek = hasInternationalDuty && internationalRoundForWeek(weekNumber) !== null
  const events: CalendarEvent[] = [
    { id: id(), day: 'mon', type: 'training', title: 'finishing training', resolved: false },
    internationalWeek
      ? { id: id(), day: 'wed', type: 'match', title: 'international duty', resolved: false }
      : { id: id(), day: 'wed', type: 'training', title: 'tactical training', resolved: false },
    { id: id(), day: 'fri', type: 'school', title: 'off the pitch', resolved: false },
  ]
  // Phase 15: Tue and Thu were completely empty every single week — the calendar
  // only ever had 5 of 7 days doing anything. Using one of them for a second life
  // event on roughly half of weeks is free density with no rebalancing.
  if (weekNumber > 1 && rand() < 0.45) {
    events.push({ id: id(), day: 'tue', type: 'school', title: 'off the pitch', resolved: false })
  }

  // P32 — STREET GAMES. Player feedback: "it can sometimes get boring waiting
  // an entire week to play a match". Thursday was the last completely dead day
  // in the week, so it becomes the mid-week football slot: either a kickabout
  // that turns up (street) or the coach running a small-sided game instead of
  // a drill session. Never on a week you already have midweek international
  // duty — two midweek games is too much on a 15-year-old's legs.
  const schoolMatch = phase !== 'academy' && grassrootsPath === 'school' && activeCompetitionForWeek(weekNumber, phase, grassrootsPath) !== null
  if (weekNumber > 2 && !internationalWeek && !schoolMatch) {
    const roll = rand()
    if (roll < 0.34) {
      events.push({ id: id(), day: 'thu', type: 'street', title: 'a game down the park', resolved: false })
    } else if (roll < 0.5) {
      events.push({ id: id(), day: 'thu', type: 'street', title: 'small-sided session', resolved: false })
    }
  }
  if (activeCompetitionForWeek(weekNumber, phase, grassrootsPath) !== null) {
    events.push({ id: id(), day: phase === 'academy' ? 'sat' : grassrootsPath === 'school' ? 'thu' : 'sun', type: 'match', title: 'matchday', resolved: false })
  } else {
    events.push({ id: id(), day: 'sat', type: 'training', title: 'extra training', resolved: false })
  }
  if (schoolMatch || events.some(e => e.day === 'sun' && e.type === 'match')) events.push({ id: id(), day: 'sat', type: 'rest', title: 'match recovery', resolved: false })
  // A youth career has one active route. School players no longer receive a second Sunday fixture.
  if (!events.some(e => e.day === 'sun')) events.push({ id: id(), day: 'sun', type: 'rest', title: 'rest day', resolved: false })
  return { weekNumber, seasonYear, events }
}

/** Preserve event IDs/completion when updating an in-flight saved week. */
export function alignMatchDays(state: CalendarState, phase: CareerPhase, path: GrassrootsPath, registered: boolean): CalendarState {
  if (phase === 'academy') return state
  let events = state.currentWeek.events.map(event => {
    if (event.type !== 'match' || event.title === 'international duty' || event.title === OCTOBER_DEVELOPMENT_TITLE) return event
    const sunday = event.title === 'Sunday community fixture' || event.title === 'Sunday league fixture'
    return { ...event, day: (sunday || path === 'sunday' ? 'sun' : 'thu') as DayOfWeek, title: sunday ? 'Sunday league fixture' : event.title }
  })
  const hasThursdayMatch = events.some(e => e.type === 'match' && e.day === 'thu')
  if (hasThursdayMatch) events = events.filter(e => e.day !== 'thu' || e.type !== 'street' || e.resolved)
  // `registered` is retained in the signature for old saves/callers, but V4 now
  // keeps School and Grassroots exclusive instead of injecting a side Sunday match.
  void registered
  if (!events.some(e => e.day === 'sat')) events.push({ id: id(), day: 'sat', type: 'rest', title: 'match recovery', resolved: false })
  events = events.filter(e => !(e.day === 'sun' && e.type === 'rest' && !e.resolved && events.some(m => m.day === 'sun' && m.type === 'match')))
  return { ...state, currentWeek: { ...state.currentWeek, events } }
}

/** Add the four October games to a live or loaded week without replacing V4 fixtures. */
export function alignOctoberDevelopment(state: CalendarState, age: number, phase: CareerPhase, path: GrassrootsPath, showcaseInvited: boolean): CalendarState {
  const week = state.currentWeek.weekNumber
  const eligible = phase !== 'academy' && age >= 14 && age <= 15 && !showcaseInvited && OCTOBER_DEVELOPMENT_WEEKS.includes(week as typeof OCTOBER_DEVELOPMENT_WEEKS[number])
  if (!eligible) return state
  const day: DayOfWeek = path === 'school' ? 'sat' : 'sun'
  let events = state.currentWeek.events.filter(e => {
    // Young players cannot enter the 16+ showcase occupying this week.
    if (activeCompetitionForWeek(week, phase, path)?.competitionId === 'youthShowcase' && e.type === 'match' && e.title === 'matchday') return false
    if (path === 'school' && e.day === 'thu' && e.type === 'street' && !e.resolved) return false
    return !(e.day === day && (e.type === 'rest' || e.type === 'training') && !e.resolved)
  })
  if (!events.some(e => e.title === OCTOBER_DEVELOPMENT_TITLE)) {
    events = [...events, { id: id(), day, type: 'match', title: OCTOBER_DEVELOPMENT_TITLE, resolved: false }]
  }
  return { ...state, currentWeek: { ...state.currentWeek, events } }
}

export interface WeekAdvanceResult {
  calendar: CalendarState
  seasonEnded: boolean
  newAge: number
  reachedAgeCap: boolean
}

// Advance the week, handling season rollover and age increment.
// Age ticks each season (player ages ~1 year per season). Age cap = 20 (fail check upstream).
export function advanceWeek(state: CalendarState, currentAge: number, phase: CareerPhase = 'grassroots-season', hasInternationalDuty = false, grassrootsPath: GrassrootsPath = 'school', playsSundayFootball = false): WeekAdvanceResult {
  const isSeasonEnd = state.currentWeek.weekNumber >= SEASON_WEEKS
  const nextWeekNum = isSeasonEnd ? 1 : state.currentWeek.weekNumber + 1
  const nextSeason = isSeasonEnd ? state.currentWeek.seasonYear + 1 : state.currentWeek.seasonYear
  const newAge = isSeasonEnd ? currentAge + 1 : currentAge

  return {
    calendar: {
      currentWeek: generateWeek(nextWeekNum, nextSeason, phase, hasInternationalDuty, grassrootsPath, playsSundayFootball),
      history: [...state.history, state.currentWeek].slice(-6),
    },
    seasonEnded: isSeasonEnd,
    newAge,
    reachedAgeCap: newAge >= 20,
  }
}

// NOTE: restRecovery() lived here until Phase 11. Rest recovery is now owned entirely by
// engine/energy.ts (baseRecovery + recoveryFor) so there is exactly ONE recovery curve in
// the codebase. Leaving a second one here would guarantee they drift apart.
