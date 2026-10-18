import { proRoll } from './proWorldFactory'
import type { IsoDate, ProFixture, ProWorldState, ProStandingRow } from './proWorld'

const add = (date: IsoDate, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
const rank = (rows: ProStandingRow[]) => [...rows].sort((a, b) => b.points - a.points ||
  b.goalsFor - b.goalsAgainst - a.goalsFor + a.goalsAgainst ||
  b.goalsFor - a.goalsFor || a.clubId.localeCompare(b.clubId))

/** English National League: champion automatic, places 2–7 contest the second promotion berth. */
export function nationalLeagueQualification(world: ProWorldState, lastLeagueDate: IsoDate):
  { promotedIds: string[]; fixtures: ProFixture[]; readyDate: IsoDate } {
  const table = rank(world.standings['fifth-eng'])
  if (table.length !== 24) throw new Error('English National League requires 24 clubs')
  const year = world.competitions['fifth-eng'].seasonId
  const fixtures: ProFixture[] = []
  const play = (homeId: string, awayId: string, round: number, match: number): string => {
    const id = `fixture-national-league-playoff-${year}-${round}-${match}`
    const edge = (world.clubs[homeId].reputation - world.clubs[awayId].reputation) * .035
    const homeGoals = Math.max(0, Math.floor(1.7 + edge + (proRoll(world.seed, `${id}:home`) - .5) * 3.2))
    const awayGoals = Math.max(0, Math.floor(1.4 - edge + (proRoll(world.seed, `${id}:away`) - .5) * 3.2))
    fixtures.push({ id, competitionId: 'promotion-eng-4', kickoffDate: add(lastLeagueDate, 4 + round * 5),
      homeId, awayId, result: { homeGoals, awayGoals } })
    if (homeGoals !== awayGoals) return homeGoals > awayGoals ? homeId : awayId
    return proRoll(world.seed, `${id}:pens`) < .5 ? homeId : awayId
  }
  const prelimA = play(table[3].clubId, table[6].clubId, 0, 0)
  const prelimB = play(table[4].clubId, table[5].clubId, 0, 1)
  const finalistA = play(table[1].clubId, prelimB, 1, 0)
  const finalistB = play(table[2].clubId, prelimA, 1, 1)
  const playoffWinner = play(finalistA, finalistB, 2, 0)
  const promotedIds = [table[0].clubId, playoffWinner]
  if (new Set(promotedIds).size !== 2) throw new Error('Duplicate National League promotion')
  return { promotedIds, fixtures, readyDate: add(lastLeagueDate, 20) }
}
