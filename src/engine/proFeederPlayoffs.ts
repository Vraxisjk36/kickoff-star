import { proRoll } from './proWorldFactory'
import type { IsoDate, ProFixture, ProStandingRow, ProWorldState } from './proWorld'

const day = 86_400_000
const add = (date: IsoDate, days: number): IsoDate => new Date(Date.parse(`${date}T00:00:00Z`) + days * day).toISOString().slice(0, 10)
const order = (rows: ProStandingRow[]) => [...rows].sort((a, b) => b.points - a.points ||
  (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || a.clubId.localeCompare(b.clubId))
const fresh = (id: string): ProStandingRow => ({ clubId: id, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 })

/** Deterministic, archived feeder matches. Dates are fixed from the league final. */
export function feederQualification(world: ProWorldState, country: string, lastDate: IsoDate):
  { promotedIds: string[]; fixtures: ProFixture[]; readyDate: IsoDate } {
  const year = world.competitions[`second-${country}`].seasonId
  const fixtures: ProFixture[] = []
  let round = 0
  const play = (homeId: string, awayId: string): string => {
    const id = `fixture-promotion-${country}-2-${year}-${round}-${fixtures.length + 1}`
    const edge = (world.clubs[homeId].reputation - world.clubs[awayId].reputation) * .04
    const homeGoals = Math.max(0, Math.min(5, Math.floor(1.7 + edge + (proRoll(world.seed, `${id}:h`) - .5) * 3.5)))
    const awayGoals = Math.max(0, Math.min(5, Math.floor(1.4 - edge + (proRoll(world.seed, `${id}:a`) - .5) * 3.5)))
    fixtures.push({ id, competitionId: `promotion-${country}-2`, kickoffDate: add(lastDate, 4 + round * 5),
      homeId, awayId, result: { homeGoals, awayGoals } })
    if (homeGoals !== awayGoals) return homeGoals > awayGoals ? homeId : awayId
    return proRoll(world.seed, `${id}:penalties`) < .5 ? homeId : awayId
  }
  const bracket = (teams: string[], finalists = 1): string[] => {
    let current = [...teams]
    while (current.length > finalists) {
      round++
      const next: string[] = []
      for (let index = 0; index < current.length / 2; index++)
        next.push(play(current[index], current[current.length - index - 1]))
      current = next
    }
    return current
  }
  const phase = (teams: string[]): ProStandingRow[] => {
    const table = new Map(teams.map(id => [id, fresh(id)]))
    for (let leg = 0; leg < 2; leg++) for (let matchRound = 0; matchRound < teams.length - 1; matchRound++) {
      round = leg * (teams.length - 1) + matchRound + 1
      const rotating = [...teams]
      for (let turn = 0; turn < matchRound; turn++) rotating.splice(1, 0, rotating.pop()!)
      for (let pair = 0; pair < teams.length / 2; pair++) {
        const homeId = rotating[leg ? rotating.length - pair - 1 : pair]
        const awayId = rotating[leg ? pair : rotating.length - pair - 1]
        play(homeId, awayId)
        const result = fixtures.at(-1)!.result!
        const home = table.get(homeId)!, away = table.get(awayId)!
        home.played++; away.played++
        home.goalsFor += result.homeGoals; home.goalsAgainst += result.awayGoals
        away.goalsFor += result.awayGoals; away.goalsAgainst += result.homeGoals
        if (result.homeGoals > result.awayGoals) { home.won++; away.lost++; home.points += 3 }
        else if (result.homeGoals < result.awayGoals) { away.won++; home.lost++; away.points += 3 }
        else { home.drawn++; away.drawn++; home.points++; away.points++ }
      }
    }
    return order([...table.values()])
  }
  let promotedIds: string[]
  if (country === 'bra') {
    const ranked = order(world.standings['third-bra']).slice(0, 8).map(row => row.clubId)
    const groups = [[ranked[0], ranked[3], ranked[4], ranked[7]], [ranked[1], ranked[2], ranked[5], ranked[6]]]
    promotedIds = groups.flatMap(teams => phase(teams).slice(0, 2).map(row => row.clubId))
  } else if (country === 'esp') {
    const groups = [1, 2].map(index => order(world.standings[`third-esp-${index}`]))
    promotedIds = groups.map(rows => rows[0].clubId)
    for (const rows of groups) promotedIds.push(...bracket(rows.slice(1, 5).map(row => row.clubId)))
  } else if (country === 'ita') {
    const groups = [1, 2, 3].map(index => order(world.standings[`third-ita-${index}`]))
    promotedIds = groups.map(rows => rows[0].clubId)
    const candidates = groups.flatMap(rows => rows.slice(1, 5)).sort((a, b) => b.points / b.played - a.points / a.played || a.clubId.localeCompare(b.clubId))
      .slice(0, 8).map(row => row.clubId)
    promotedIds.push(...bracket(candidates))
  } else if (country === 'por') {
    const groups = [1, 2].map(index => order(world.standings[`third-por-${index}`]).slice(0, 4))
    promotedIds = phase(groups.flat().map(row => row.clubId)).slice(0, 2).map(row => row.clubId)
  } else {
    const provincial = Array.from({ length: 9 }, (_, index) => order(world.standings[`third-rsa-${index + 1}`])[0])
      .sort((a, b) => b.points / b.played - a.points / a.played || a.clubId.localeCompare(b.clubId)).map(row => row.clubId)
    round++
    const playIn = play(provincial[7], provincial[8])
    promotedIds = bracket([...provincial.slice(0, 7), playIn], 2)
  }
  return { promotedIds, fixtures, readyDate: add(lastDate, 5 + round * 5) }
}
