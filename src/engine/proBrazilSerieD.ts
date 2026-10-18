import { proRoll } from './proWorldFactory'
import type { IsoDate, ProFixture, ProStandingRow, ProWorldState } from './proWorld'
const add = (date: IsoDate, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
const rank = (rows: ProStandingRow[]) => [...rows].sort((a, b) => b.points - a.points ||
  (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) ||
  b.goalsFor - a.goalsFor || a.clubId.localeCompare(b.clubId))

/** Eight regional Série D group champions contest four promotion places.
 * This is a compact simulated format, not a complete reproduction of CBF qualifiers.
 */
export function brazilSerieDQualification(world: ProWorldState, lastDate: IsoDate):
  { promotedIds: string[]; fixtures: ProFixture[]; readyDate: IsoDate } {
  const year = world.competitions['third-bra'].seasonId
  const champions = Array.from({ length: 8 }, (_, i) => {
    const rows = world.standings[`fourth-bra-${i + 1}`]
    if (!rows || rows.length !== 8) throw new Error(`Incomplete Brazilian Série D group ${i + 1}`)
    return rank(rows)[0].clubId
  })
  const fixtures: ProFixture[] = []
  const promotedIds: string[] = []
  for (let i = 0; i < 4; i++) {
    const a = champions[i], b = champions[7 - i]
    const results = [[a, b], [b, a]].map(([homeId, awayId], leg) => {
      const id = `fixture-serie-d-promotion-${year}-${i}-${leg}`
      const edge = (world.clubs[homeId].reputation - world.clubs[awayId].reputation) * .035
      const result = {
        homeGoals: Math.max(0, Math.floor(1.5 + edge + (proRoll(world.seed, `${id}:h`) - .5) * 3.5)),
        awayGoals: Math.max(0, Math.floor(1.35 - edge + (proRoll(world.seed, `${id}:a`) - .5) * 3.5)),
      }
      fixtures.push({ id, competitionId: 'promotion-bra-3', kickoffDate: add(lastDate, 4 + leg * 5),
        homeId, awayId, result })
      return result
    })
    const goalsA = results[0].homeGoals + results[1].awayGoals
    const goalsB = results[0].awayGoals + results[1].homeGoals
    const winner = goalsA !== goalsB ? goalsA > goalsB ? a : b :
      proRoll(world.seed, `serie-d-${year}-${i}:penalties`) < .5 ? a : b
    promotedIds.push(winner)
  }
  if (new Set(promotedIds).size !== 4) throw new Error('Duplicate Brazilian Série D promoted side')
  return { promotedIds, fixtures, readyDate: add(lastDate, 12) }
}
