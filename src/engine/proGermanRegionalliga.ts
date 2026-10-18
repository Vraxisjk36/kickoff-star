import { proRoll } from './proWorldFactory'
import type { IsoDate, ProFixture, ProStandingRow, ProWorldState } from './proWorld'

const add = (date: IsoDate, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
const ordered = (rows: ProStandingRow[]) => [...rows].sort((a, b) => b.points - a.points ||
  (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) ||
  b.goalsFor - a.goalsFor || a.clubId.localeCompare(b.clubId))

/** Regionalliga: three direct champions plus a two-legged tie between remaining champions.
 * Direct-promotion regions rotate by season, so no one region is permanently excluded.
 */
export function germanRegionalQualification(world: ProWorldState, lastDate: IsoDate):
  { promotedIds: string[]; fixtures: ProFixture[]; readyDate: IsoDate } {
  const year = Number(world.competitions['third-ger'].seasonId)
  const winners = Array.from({ length: 5 }, (_, group) => {
    const standings = world.standings[`fourth-ger-${group + 1}`]
    if (!standings || standings.length !== 18) throw new Error('Incomplete German Regionalliga groups')
    return ordered(standings)[0].clubId
  })
  const rotation = year % 5
  const direct = [0, 1, 2].map(offset => winners[(rotation + offset) % 5])
  const a = winners[(rotation + 3) % 5], b = winners[(rotation + 4) % 5]
  const id = `promotion-ger-regionalliga-${year}`
  const goals = (home: string, away: string, leg: number) => {
    const edge = (world.clubs[home].reputation - world.clubs[away].reputation) * .035
    return {
      homeGoals: Math.max(0, Math.floor(1.6 + edge + (proRoll(world.seed, `${id}:${leg}:h`) - .5) * 3.4)),
      awayGoals: Math.max(0, Math.floor(1.4 - edge + (proRoll(world.seed, `${id}:${leg}:a`) - .5) * 3.4)),
    }
  }
  const first = goals(a, b, 1), second = goals(b, a, 2)
  const fixtures: ProFixture[] = [
    { id: `${id}-1`, competitionId: 'promotion-ger-3', kickoffDate: add(lastDate, 5),
      homeId: a, awayId: b, result: first },
    { id: `${id}-2`, competitionId: 'promotion-ger-3', kickoffDate: add(lastDate, 10),
      homeId: b, awayId: a, result: second },
  ]
  const totalA = first.homeGoals + second.awayGoals
  const totalB = first.awayGoals + second.homeGoals
  const winner = totalA !== totalB ? totalA > totalB ? a : b :
    proRoll(world.seed, `${id}:penalties`) < .5 ? a : b
  const promotedIds = [...direct, winner]
  if (new Set(promotedIds).size !== 4) throw new Error('Duplicate Regionalliga promotion')
  return { promotedIds, fixtures, readyDate: add(lastDate, 12) }
}
