import { proRoll } from './proWorldFactory'
import { promotionEligible } from './proRegionalRules'
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
  const bracket = (teams: string[], finalists = 1, twoLegged = false): string[] => {
    if (teams.length < finalists || teams.length % finalists !== 0 ||
        new Set(teams).size !== teams.length)
      throw new Error(`Invalid ${country} feeder playoff bracket`)
    let current = [...teams]
    while (current.length > finalists) {
      round++
      const ties: Array<[string, string]> = []
      for (let index = 0; index < current.length / 2; index++)
        ties.push([current[index], current[current.length - index - 1]])
      const firstLeg = ties.map(([home, away]) => {
        play(home, away)
        return fixtures.at(-1)!.result!
      })
      if (twoLegged) round++
      const next = ties.map(([home, away], index) => {
        if (!twoLegged) {
          const score = firstLeg[index]
          if (score.homeGoals !== score.awayGoals)
            return score.homeGoals > score.awayGoals ? home : away
          return proRoll(world.seed, `feeder-${country}-${year}-${round}-${home}-${away}-pens`) < .5 ? home : away
        }
        play(away, home)
        const secondLeg = fixtures.at(-1)!.result!
        const homeAggregate = firstLeg[index].homeGoals + secondLeg.awayGoals
        const awayAggregate = firstLeg[index].awayGoals + secondLeg.homeGoals
        if (homeAggregate !== awayAggregate) return homeAggregate > awayAggregate ? home : away
        return proRoll(world.seed, `feeder-${country}-${year}-${round}-${home}-${away}-pens`) < .5 ? home : away
      })
      current = next
    }
    return current
  }
  const phase = (teams: string[]): ProStandingRow[] => {
    if (teams.length < 2 || teams.length % 2 !== 0 || new Set(teams).size !== teams.length)
      throw new Error('Feeder group requires distinct, even-numbered entrants')
    const table = new Map(teams.map(id => [id, fresh(id)]))
    // Circle-method schedule: each pair meets once per leg, with the second
    // leg reversing venues. Unlike rotating the same input for each round,
    // this guarantees no duplicate pairings or clubs playing twice in a round.
    const rotation = [...teams]
    const firstLeg: Array<Array<[string, string]>> = []
    for (let matchRound = 0; matchRound < teams.length - 1; matchRound++) {
      const games: Array<[string, string]> = []
      for (let pair = 0; pair < teams.length / 2; pair++) {
        const a = rotation[pair], b = rotation[rotation.length - 1 - pair]
        games.push((matchRound + pair) % 2 === 0 ? [a, b] : [b, a])
      }
      firstLeg.push(games)
      rotation.splice(1, 0, rotation.pop()!)
    }
    for (let leg = 0; leg < 2; leg++) for (let matchRound = 0; matchRound < firstLeg.length; matchRound++) {
      round++
      for (const [a, b] of firstLeg[matchRound]) {
        const homeId = leg === 0 ? a : b
        const awayId = leg === 0 ? b : a
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
    for (const rows of groups) promotedIds.push(...bracket(rows.slice(1, 5).map(row => row.clubId), 1, true))
  } else if (country === 'ita') {
    const groups = [1, 2, 3].map(index => order(world.standings[`third-ita-${index}`]))
    promotedIds = groups.map(rows => rows[0].clubId)
    const candidates = groups.flatMap(rows => rows.slice(1, 5)).sort((a, b) => b.points / b.played - a.points / a.played || a.clubId.localeCompare(b.clubId))
      .slice(0, 8).map(row => row.clubId)
    promotedIds.push(...bracket(candidates, 1, true))
  } else if (country === 'por') {
    const groups = [1, 2].map(index => order(world.standings[`third-por-${index}`]).slice(0, 4))
    promotedIds = phase(groups.flat().map(row => row.clubId)).slice(0, 2).map(row => row.clubId)
  } else {
    // SAFA ABC Motsepe national qualifiers: nine province champions in
    // three round-robin groups of three. Group winners plus the best runner-up
    // contest single-match semifinals; both finalists win promotion.
    const provincial = Array.from({ length: 9 }, (_, index) => {
      const rows = order(world.standings[`third-rsa-${index + 1}`])
      const eligible = rows.find(row => promotionEligible(world, row.clubId, 2))
      if (!eligible) throw new Error('Unlicensed South African provincial representatives')
      return eligible.clubId
    })
    const winners: ProStandingRow[] = [], runners: ProStandingRow[] = []
    for (let group = 0; group < 3; group++) {
      const teams = provincial.slice(group * 3, group * 3 + 3)
      const table = new Map(teams.map(id => [id, fresh(id)]))
      for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) {
        round++
        play(teams[a], teams[b])
        const result = fixtures.at(-1)!.result!
        const home = table.get(teams[a])!, away = table.get(teams[b])!
        home.played++; away.played++
        home.goalsFor += result.homeGoals; home.goalsAgainst += result.awayGoals
        away.goalsFor += result.awayGoals; away.goalsAgainst += result.homeGoals
        if (result.homeGoals > result.awayGoals) { home.won++; away.lost++; home.points += 3 }
        else if (result.homeGoals < result.awayGoals) { away.won++; home.lost++; away.points += 3 }
        else { home.drawn++; away.drawn++; home.points++; away.points++ }
      }
      const ranked = order([...table.values()])
      winners.push(ranked[0])
      runners.push(ranked[1])
    }
    const bestRunner = order(runners)[0].clubId
    round++
    const semifinalA = play(winners[0].clubId, bestRunner)
    const semifinalB = play(winners[1].clubId, winners[2].clubId)
    promotedIds = [semifinalA, semifinalB]
    round++
    play(semifinalA, semifinalB)

  }
  return { promotedIds, fixtures, readyDate: add(lastDate, 5 + round * 5) }
}
