import { NATIONS } from './nations'
import type { SeniorInternationalRecord, SeniorInternationalFixture } from './proInternational'

export type TournamentStage = 'qualifier' | 'finals-group' | 'semifinal' | 'final' | 'third-place' | 'continental' | 'friendly'
export interface TournamentStanding {
  nationId: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  points: number
}
interface Pairing { homeId: string; awayId: string }
export interface TournamentProgress {
  cycle: number
  name: string
  qualifiers: TournamentStanding[]
  finalists: string[]
  qualified: boolean
  finalsGroup?: TournamentStanding[]
  semifinalists: string[]
  finalistsMatch: string[]
  championId?: string
}
export const INTERNATIONAL_WINDOWS = [12, 25, 37] as const
export const INTERNATIONAL_GROUPS = Array.from({ length: 6 }, (_, group) =>
  NATIONS.filter((_, index) => index % 6 === group).map(nation => nation.id))

export function internationalCycle(season: number): number {
  return Math.floor((Math.max(1, season) - 1) / 4) * 4 + 1
}
function roundRobin(four: readonly string[], round: number): Pairing[] {
  if (four.length !== 4) throw new Error('International draw requires four nations')
  // Fixed, balanced draw: each nation meets each other nation once per leg.
  const base: Array<Array<[number, number]>> = [
    [[0, 3], [1, 2]],
    [[0, 2], [3, 1]],
    [[0, 1], [2, 3]],
  ]
  const reverse = round >= 3
  return base[round % 3].map(([a, b]) => ({
    homeId: four[reverse ? b : a],
    awayId: four[reverse ? a : b],
  }))
}
function hash(value: string): number {
  let h = 2166136261
  for (const char of value) h = Math.imul(h ^ char.charCodeAt(0), 16777619)
  return h >>> 0
}
function simulate(pair: Pairing, cycle: number, stage: string, round: number): [number, number] {
  const homeStrength = NATIONS.find(n => n.id === pair.homeId)?.strength ?? 5
  const awayStrength = NATIONS.find(n => n.id === pair.awayId)?.strength ?? 5
  const edge = (homeStrength - awayStrength) * .16
  const home = Math.max(0, Math.floor(1.25 + edge + hash(`${cycle}:${stage}:${round}:${pair.homeId}:${pair.awayId}:h`) % 280 / 100 - 1.4))
  const away = Math.max(0, Math.floor(1.05 - edge + hash(`${cycle}:${stage}:${round}:${pair.homeId}:${pair.awayId}:a`) % 280 / 100 - 1.4))
  return [home, away]
}
function score(pair: Pairing, cycle: number, stage: string, round: number,
  records: readonly SeniorInternationalRecord[]): [number, number] {
  const season = cycle + (stage === 'qualifier' ? Math.floor(round / 3)
    : stage === 'finals-group' ? 2 : 3)
  const week = INTERNATIONAL_WINDOWS[stage === 'qualifier' ? round % 3
    : stage === 'finals-group' ? round : stage === 'semifinal' ? 0 : 1]
  const actual = records.find(record => record.season === season && record.week === week &&
    record.competition === stage &&
    ((record.nationId === pair.homeId && record.opponentId === pair.awayId && record.home) ||
     (record.nationId === pair.awayId && record.opponentId === pair.homeId && !record.home)))
  if (actual) return actual.home ? [actual.scored, actual.conceded] : [actual.conceded, actual.scored]
  return simulate(pair, cycle, stage, round)
}
function standings(entrants: readonly string[], games: Array<{ pair: Pairing; goals: [number, number] }>): TournamentStanding[] {
  const rows = new Map(entrants.map(nationId => [nationId, {
    nationId, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
  }]))
  for (const { pair, goals: [h, a] } of games) {
    const home = rows.get(pair.homeId), away = rows.get(pair.awayId)
    if (!home || !away) continue
    home.played++; away.played++
    home.goalsFor += h; home.goalsAgainst += a
    away.goalsFor += a; away.goalsAgainst += h
    if (h > a) { home.won++; away.lost++; home.points += 3 }
    else if (a > h) { away.won++; home.lost++; away.points += 3 }
    else { home.drawn++; away.drawn++; home.points++; away.points++ }
  }
  return [...rows.values()].sort((a, b) => b.points - a.points ||
    (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) ||
    b.goalsFor - a.goalsFor || a.nationId.localeCompare(b.nationId))
}
function winner(pair: Pairing, goals: [number, number], cycle: number): string {
  if (goals[0] !== goals[1]) return goals[0] > goals[1] ? pair.homeId : pair.awayId
  return hash(`${cycle}:penalties:${pair.homeId}:${pair.awayId}`) % 2 ? pair.homeId : pair.awayId
}
function qualifierTables(cycle: number, records: readonly SeniorInternationalRecord[]): TournamentStanding[][] {
  return INTERNATIONAL_GROUPS.map(group => standings(group,
    Array.from({ length: 6 }, (_, round) => roundRobin(group, round)
      .map(pair => ({ pair, goals: score(pair, cycle, 'qualifier', round, records) }))).flat()))
}
function finalists(cycle: number, records: readonly SeniorInternationalRecord[]): string[] {
  const groups = qualifierTables(cycle, records)
  const direct = groups.map(rows => rows[0].nationId)
  const runnerUps = groups.map(rows => rows[1]).sort((a, b) =>
    b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) ||
    b.goalsFor - a.goalsFor || a.nationId.localeCompare(b.nationId))
  return [...direct, runnerUps[0].nationId, runnerUps[1].nationId]
}
function finalGroups(cycle: number, records: readonly SeniorInternationalRecord[]): TournamentStanding[][] {
  const entries = finalists(cycle, records)
  const groups = [[entries[0], entries[2], entries[4], entries[6]],
    [entries[1], entries[3], entries[5], entries[7]]]
  return groups.map(group => standings(group,
    Array.from({ length: 3 }, (_, round) => roundRobin(group, round)
      .map(pair => ({ pair, goals: score(pair, cycle, 'finals-group', round, records) }))).flat()))
}
function semifinalPairs(cycle: number, records: readonly SeniorInternationalRecord[]): Pairing[] {
  const groups = finalGroups(cycle, records)
  return [{ homeId: groups[0][0].nationId, awayId: groups[1][1].nationId },
    { homeId: groups[1][0].nationId, awayId: groups[0][1].nationId }]
}
function medalPairs(cycle: number, records: readonly SeniorInternationalRecord[]): { final: Pairing; third: Pairing } {
  const semis = semifinalPairs(cycle, records)
  const results = semis.map((pair, index) => winner(pair, score(pair, cycle, 'semifinal', index, records), cycle))
  return {
    final: { homeId: results[0], awayId: results[1] },
    third: { homeId: semis[0].homeId === results[0] ? semis[0].awayId : semis[0].homeId,
      awayId: semis[1].homeId === results[1] ? semis[1].awayId : semis[1].homeId },
  }
}
export function internationalProgress(nationId: string, cycle: number,
  records: readonly SeniorInternationalRecord[] = []): TournamentProgress {
  const qualifiers = qualifierTables(cycle, records).find(group => group.some(row => row.nationId === nationId)) ?? []
  const entries = finalists(cycle, records)
  const groups = finalGroups(cycle, records)
  const semi = semifinalPairs(cycle, records)
  const medal = medalPairs(cycle, records)
  return {
    cycle, name: 'International Championship', qualifiers,
    finalists: entries, qualified: entries.includes(nationId),
    finalsGroup: groups.find(group => group.some(row => row.nationId === nationId)),
    semifinalists: semi.flatMap(pair => [pair.homeId, pair.awayId]),
    finalistsMatch: [medal.final.homeId, medal.final.awayId],
    championId: winner(medal.final, score(medal.final, cycle, 'final', 0, records), cycle),
  }
}
/** Current qualifying table only: never leak results of matches still in the future. */
export function visibleQualifyingTable(nationId: string, currentSeason: number, currentWeek: number,
  records: readonly SeniorInternationalRecord[] = []): TournamentStanding[] {
  const cycle = internationalCycle(currentSeason)
  const group = INTERNATIONAL_GROUPS.find(group => group.includes(nationId))
  if (!group) return []
  const games = Array.from({ length: 6 }, (_, round) => {
    const season = cycle + Math.floor(round / 3)
    const week = INTERNATIONAL_WINDOWS[round % 3]
    if (season > currentSeason || season === currentSeason && week > currentWeek) return []
    return roundRobin(group, round).map(pair => ({
      pair, goals: score(pair, cycle, 'qualifier', round, records),
    }))
  }).flat()
  return standings(group, games)
}

export function internationalTournamentFixture(nationId: string, season: number, week: number,
  records: readonly SeniorInternationalRecord[] = []):
  Pick<SeniorInternationalFixture, 'opponentId' | 'home' | 'competition'> | null {
  const index = INTERNATIONAL_WINDOWS.indexOf(week as typeof INTERNATIONAL_WINDOWS[number])
  if (index < 0) return null
  const cycle = internationalCycle(season)
  const year = season - cycle
  let stage: TournamentStage = 'friendly'
  let pair: Pairing | undefined
  if (year < 2) {
    stage = 'qualifier'
    const group = INTERNATIONAL_GROUPS.find(group => group.includes(nationId))
    pair = group && roundRobin(group, year * 3 + index).find(p => p.homeId === nationId || p.awayId === nationId)
  } else if (year === 2) {
    const progress = internationalProgress(nationId, cycle, records)
    if (progress.qualified) {
      stage = 'finals-group'
      const group = progress.finalsGroup?.map(row => row.nationId)
      // Standings are ranked, so recover the canonical seeded draw order.
      const entries = finalists(cycle, records)
      const seed = entries.indexOf(nationId) % 2
      const seeded = seed === 0 ? [entries[0], entries[2], entries[4], entries[6]]
        : [entries[1], entries[3], entries[5], entries[7]]
      pair = group && roundRobin(seeded, index).find(p => p.homeId === nationId || p.awayId === nationId)
    }
  } else if (year === 3 && index <= 1) {
    const semis = semifinalPairs(cycle, records)
    if (index === 0) {
      pair = semis.find(p => p.homeId === nationId || p.awayId === nationId)
      if (pair) stage = 'semifinal'
    } else {
      const medals = medalPairs(cycle, records)
      pair = [medals.final, medals.third].find(p => p.homeId === nationId || p.awayId === nationId)
      if (pair) stage = pair === medals.final ? 'final' : 'third-place'
    }
  }
  if (!pair) {
    const nation = NATIONS.find(item => item.id === nationId)
    const alternatives = NATIONS.filter(item => item.id !== nationId &&
      Math.abs(item.strength - (nation?.strength ?? 5)) <= 2)
    const opponent = alternatives[(season * 17 + week * 3 + nationId.charCodeAt(0)) % alternatives.length]
    return { opponentId: opponent.id, home: (season + week) % 2 === 0, competition: 'friendly' }
  }
  return { opponentId: pair.homeId === nationId ? pair.awayId : pair.homeId,
    home: pair.homeId === nationId, competition: stage }
}
