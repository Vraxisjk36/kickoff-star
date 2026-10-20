import { NATIONS } from './nations'
import { CONTINENTAL_WINDOWS, continentalRound } from './proContinentalNations'
import { INTERNATIONAL_WINDOWS, internationalTournamentFixture } from './proInternationalTournament'
import { seniorNationRankings, type SeniorNationRanking } from './proNationalRankings'
import type { SeniorInternationalRecord } from './proInternational'

/** The ranking feed contains simulated results from every supported national
 * side, not only the player's country. All generated results are deterministic
 * for a given match ID. The human's real recorded match always wins.
 *
 * These are fictional national ratings, NOT official FIFA ranking points.
 */
function hash(input: string): number {
  let seed = 2166136261
  for (const ch of input) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619)
  return seed >>> 0
}
function goals(homeId: string, awayId: string, season: number, week: number): [number, number] {
  const home = NATIONS.find(n => n.id === homeId)!
  const away = NATIONS.find(n => n.id === awayId)!
  const edge = (home.strength - away.strength) * .23
  return [
    Math.max(0, Math.floor(1.35 + edge + (hash(`nation-world:${season}:${week}:${homeId}:H`) % 280) / 100 - 1.1)),
    Math.max(0, Math.floor(1.10 - edge + (hash(`nation-world:${season}:${week}:${awayId}:A`) % 280) / 100 - 1.1)),
  ]
}
type FixtureSpec = Pick<SeniorInternationalRecord,
  'season' | 'week' | 'nationId' | 'opponentId' | 'home' | 'competition'>

function matchId(spec: FixtureSpec): string {
  const a = spec.home ? spec.nationId : spec.opponentId
  const b = spec.home ? spec.opponentId : spec.nationId
  return `${spec.season}:${spec.week}:${a}:${b}`
}
function recordFor(spec: FixtureSpec, records: readonly SeniorInternationalRecord[]): SeniorInternationalRecord {
  const fixtureId = matchId(spec)
  const player = records.find(record => record.minutes > 0 &&
    record.season === spec.season && record.week === spec.week &&
    record.competition === spec.competition &&
    matchId(record) === fixtureId)
  if (player) return player
  const homeId = spec.home ? spec.nationId : spec.opponentId
  const awayId = spec.home ? spec.opponentId : spec.nationId
  const [scored, conceded] = goals(homeId, awayId, spec.season, spec.week)
  return {
    id: `nation-world-${fixtureId}`, season: spec.season, week: spec.week,
    nationId: homeId, opponentId: awayId, home: true, competition: spec.competition,
    scored, conceded, goals: 0, assists: 0, rating: 6.5, minutes: 90,
  }
}

/** Builds only elapsed national windows. At 20 seasons, the event list is
 * a few thousand compact matches, not saved with the player or rendered.
 * User-recorded results are accepted only for games already played.
 */
export function buildNationalWorldResults(
  season: number, week: number,
  records: readonly SeniorInternationalRecord[] = [],
): SeniorInternationalRecord[] {
  if (!Number.isInteger(season) || season < 1 || !Number.isInteger(week) || week < 1) return []
  const output: SeniorInternationalRecord[] = []
  const processed = new Set<string>()
  const supported = new Set(NATIONS.map(n => n.id))
  const ordered = [...records].filter(r => r.minutes > 0)
    .sort((a, b) => a.season - b.season || a.week - b.week || a.id.localeCompare(b.id))
  for (let year = 1; year <= Math.min(season, 20); year++) {
    for (const currentWeek of [...CONTINENTAL_WINDOWS, ...INTERNATIONAL_WINDOWS].sort((a,b) => a-b)) {
      if (year === season && currentWeek > week) continue
      // Include only previously played human matches when deriving qualification
      // and bracket membership. Prevent future saves from leaking backward.
      const past = ordered.filter(r => r.season < year ||
        (r.season === year && r.week < currentWeek))
      for (const nation of NATIONS) {
        if (CONTINENTAL_WINDOWS.includes(currentWeek as typeof CONTINENTAL_WINDOWS[number])) {
          for (const pair of continentalRound(nation.id, year, currentWeek)) {
            const spec: FixtureSpec = { season: year, week: currentWeek,
              nationId: pair.homeId, opponentId: pair.awayId,
              home: true, competition: 'continental' }
            const id = matchId(spec)
            if (processed.has(id)) continue
            processed.add(id)
            output.push(recordFor(spec, ordered))
          }
        } else {
          const national = internationalTournamentFixture(nation.id, year, currentWeek, past)
          if (!national || !supported.has(national.opponentId)) continue
          const spec: FixtureSpec = { season: year, week: currentWeek,
            nationId: nation.id, opponentId: national.opponentId,
            home: national.home, competition: national.competition }
          const id = matchId(spec)
          if (processed.has(id)) continue
          processed.add(id)
          output.push(recordFor(spec, ordered))
        }
      }
    }
  }
  return output
}
export function seniorWorldNationRankings(
  season: number, week: number,
  records: readonly SeniorInternationalRecord[] = [],
): SeniorNationRanking[] {
  return seniorNationRankings(buildNationalWorldResults(season, week, records), season, week)
}
