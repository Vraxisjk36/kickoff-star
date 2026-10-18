import { proRoll } from './proWorldFactory'
import type { IsoDate, ProFixture, ProStandingRow, ProWorldState } from './proWorld'
const add = (date: IsoDate, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
const ordered = (rows: ProStandingRow[]) => [...rows].sort((a, b) => b.points - a.points ||
  b.goalsFor - b.goalsAgainst - a.goalsFor + a.goalsAgainst ||
  b.goalsFor - a.goalsFor || a.clubId.localeCompare(b.clubId))

/** Highland v Lowland, then winner v League Two's bottom club, all home-and-away.
 * The incumbent can survive; no forced promotion takes place if it wins the tie.
 */
export function scottishRegionalQualification(world: ProWorldState, lastDate: IsoDate):
  { promotedIds: string[]; relegatedIds: string[]; fixtures: ProFixture[]; readyDate: IsoDate } {
  const highland = world.standings['fifth-sco-1'], lowland = world.standings['fifth-sco-2']
  if (highland?.length !== 18 || lowland?.length !== 18)
    throw new Error('Scottish fifth-tier regional groups incomplete')
  const season = world.competitions['fourth-sco'].seasonId
  const incumbent = ordered(world.standings['fourth-sco']).at(-1)?.clubId
  if (!incumbent) throw new Error('Scottish League Two standings unavailable')
  const fixtures: ProFixture[] = []
  const tie = (a: string, b: string, round: number): string => {
    const results = [[a, b], [b, a]].map(([homeId, awayId], leg) => {
      const id = `fixture-sco-regional-${season}-${round}-${leg}`
      const edge = (world.clubs[homeId].reputation - world.clubs[awayId].reputation) * .035
      const result = {
        homeGoals: Math.max(0, Math.floor(1.5 + edge + (proRoll(world.seed, `${id}:h`) - .5) * 3.4)),
        awayGoals: Math.max(0, Math.floor(1.35 - edge + (proRoll(world.seed, `${id}:a`) - .5) * 3.4)),
      }
      fixtures.push({ id, competitionId: 'promotion-sco-4', kickoffDate: add(lastDate, 4 + round * 12 + leg * 5),
        homeId, awayId, result })
      return result
    })
    const goalsA = results[0].homeGoals + results[1].awayGoals
    const goalsB = results[0].awayGoals + results[1].homeGoals
    return goalsA !== goalsB ? goalsA > goalsB ? a : b :
      proRoll(world.seed, `sco-regional-${season}-${round}-pens`) < .5 ? a : b
  }
  const challenger = tie(ordered(highland)[0].clubId, ordered(lowland)[0].clubId, 0)
  const winner = tie(challenger, incumbent, 1)
  return {
    promotedIds: winner === incumbent ? [] : [winner],
    relegatedIds: winner === incumbent ? [] : [incumbent],
    fixtures,
    readyDate: add(lastDate, 27),
  }
}
