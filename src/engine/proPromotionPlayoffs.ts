import { proRoll } from './proWorldFactory'
import type { IsoDate, ProFixture, ProPromotionPlayoff, ProStandingRow, ProWorldState } from './proWorld'

const addDays = (date: IsoDate, days: number): IsoDate => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
const ranking = (rows: ProStandingRow[]) => [...rows].sort((a, b) => b.points - a.points ||
  b.goalsFor - b.goalsAgainst - a.goalsFor + a.goalsAgainst || b.goalsFor - a.goalsFor || a.clubId.localeCompare(b.clubId))
function createFixture(world: ProWorldState, playoff: ProPromotionPlayoff, round: string, index: number,
  homeId: string, awayId: string, desired: IsoDate, occupied: Map<IsoDate, Set<string>>): void {
  const id = `fixture-promotion-${playoff.associationId}-${playoff.seasonId}-${round}-${index}`
  let kickoffDate = desired
  // Existing domestic/continental fixtures are respected; the draw stays in the save.
  for (let attempt = 0; attempt < 30; attempt++) {
    if (![homeId, awayId].some(clubId => occupied.get(kickoffDate)?.has(clubId))) break
    kickoffDate = addDays(kickoffDate, 1)
  }
  world.fixtures[id] = { id, competitionId: `promotion-${playoff.associationId}`, kickoffDate, homeId, awayId }
  const busy = occupied.get(kickoffDate) ?? new Set<string>()
  busy.add(homeId); busy.add(awayId); occupied.set(kickoffDate, busy)
  playoff.fixtureIds.push(id)
}
function play(world: ProWorldState, fixture: ProFixture, targetDate: IsoDate): void {
  if (fixture.result || fixture.kickoffDate >= targetDate) return
  const home = world.clubs[fixture.homeId]
  const away = world.clubs[fixture.awayId]
  const edge = (home.reputation - away.reputation) * .035
  fixture.result = {
    homeGoals: Math.max(0, Math.floor(1.4 + edge + proRoll(world.seed, `${fixture.id}:home`) * 2.7 - .7)),
    awayGoals: Math.max(0, Math.floor(1.3 - edge + proRoll(world.seed, `${fixture.id}:away`) * 2.7 - .7)),
  }
}
function winner(world: ProWorldState, fixtures: ProFixture[], higherId: string, higherAdvancesOnTie = false): string {
  const goals = new Map<string, number>()
  for (const fixture of fixtures) {
    goals.set(fixture.homeId, (goals.get(fixture.homeId) ?? 0) + fixture.result!.homeGoals)
    goals.set(fixture.awayId, (goals.get(fixture.awayId) ?? 0) + fixture.result!.awayGoals)
  }
  const otherId = fixtures[0].homeId === higherId ? fixtures[0].awayId : fixtures[0].homeId
  return (goals.get(higherId) ?? 0) === (goals.get(otherId) ?? 0)
    ? (higherAdvancesOnTie || proRoll(world.seed, `${fixtures[0].id}:penalties`) < .5 ? higherId : otherId)
    : (goals.get(higherId) ?? 0) > (goals.get(otherId) ?? 0) ? higherId : otherId
}
const fixturesFor = (world: ProWorldState, state: ProPromotionPlayoff, round: string) =>
  state.fixtureIds.map(id => world.fixtures[id]).filter(fixture => fixture.id.includes(`-${round}-`))
const allPlayed = (fixtures: ProFixture[]) => fixtures.every(fixture => !!fixture.result)

/** Advance the saved playoff bracket to a date, returning null until the decisive result exists. */
export function advancePromotionPlayoff(world: ProWorldState, associationId: 'eng' | 'rsa' | 'esp' | 'ger' | 'fra' | 'sco', seasonId: string,
  lastLeagueDate: IsoDate, targetDate: IsoDate, topRows: ProStandingRow[], lowerRows: ProStandingRow[]): string | null {
  world.promotionPlayoffs ??= {}
  const id = `promotion-${associationId}`
  const top = ranking(topRows)
  const lower = ranking(lowerRows)
  const occupied = new Map<IsoDate, Set<string>>()
  for (const fixture of Object.values(world.fixtures)) {
    const busy = occupied.get(fixture.kickoffDate) ?? new Set<string>()
    busy.add(fixture.homeId); busy.add(fixture.awayId); occupied.set(fixture.kickoffDate, busy)
  }
  let state = world.promotionPlayoffs[id]
  if (!state || state.seasonId !== seasonId) {
    state = { associationId, seasonId, stage: associationId === 'eng' ? Number(seasonId) < 2026 ? 'semifinal' : 'eliminator'
      : associationId === 'rsa' ? 'mini-league' : associationId === 'esp' ? 'semifinal'
        : associationId === 'fra' || associationId === 'sco' ? 'eliminator' : 'final', fixtureIds: [],
      ...(associationId === 'rsa' ? { topFifteenthId: top.at(-2)!.clubId, directPromotedId: lower[0].clubId } : {}) }
    world.promotionPlayoffs[id] = state
    if (associationId === 'eng') {
      if (Number(seasonId) < 2026) {
        [[lower[2].clubId, lower[5].clubId], [lower[3].clubId, lower[4].clubId]].forEach(([seed, opponent], index) => {
          createFixture(world, state!, 'semifinal', index * 2, opponent, seed, addDays(lastLeagueDate, 4), occupied)
          createFixture(world, state!, 'semifinal', index * 2 + 1, seed, opponent, addDays(lastLeagueDate, 8), occupied)
        })
      } else {
        createFixture(world, state, 'eliminator', 0, lower[4].clubId, lower[7].clubId, addDays(lastLeagueDate, 4), occupied)
        createFixture(world, state, 'eliminator', 1, lower[5].clubId, lower[6].clubId, addDays(lastLeagueDate, 5), occupied)
      }
    } else if (associationId === 'rsa') {
      const [a, b, c] = [top.at(-2)!.clubId, lower[1].clubId, lower[2].clubId]
      const pairs: [string, string][] = [[c, b], [a, c], [b, a], [b, c], [c, a], [a, b]]
      pairs.forEach(([home, away], index) => createFixture(world, state!, 'mini-league', index, home, away,
        addDays(lastLeagueDate, 4 + index * 4), occupied))
    } else if (associationId === 'esp') {
      [[lower[2].clubId, lower[5].clubId], [lower[3].clubId, lower[4].clubId]].forEach(([seed, opponent], index) => {
        createFixture(world, state!, 'semifinal', index * 2, opponent, seed, addDays(lastLeagueDate, 4), occupied)
        createFixture(world, state!, 'semifinal', index * 2 + 1, seed, opponent, addDays(lastLeagueDate, 8), occupied)
      })
    } else if (associationId === 'ger') {
      createFixture(world, state, 'final', 0, lower[2].clubId, top.at(-3)!.clubId, addDays(lastLeagueDate, 5), occupied)
      createFixture(world, state, 'final', 1, top.at(-3)!.clubId, lower[2].clubId, addDays(lastLeagueDate, 9), occupied)
    } else if (associationId === 'fra') {
      createFixture(world, state, 'eliminator', 0, lower[3].clubId, lower[4].clubId, addDays(lastLeagueDate, 4), occupied)
    } else {
      createFixture(world, state, 'eliminator', 0, lower[3].clubId, lower[2].clubId, addDays(lastLeagueDate, 4), occupied)
      createFixture(world, state, 'eliminator', 1, lower[2].clubId, lower[3].clubId, addDays(lastLeagueDate, 8), occupied)
    }
  }
  for (let step = 0; step < 4; step++) {
    const current = fixturesFor(world, state, state.stage)
    for (const fixture of current) play(world, fixture, targetDate)
    if (!allPlayed(current)) return null
    if (state.stage === 'mini-league') {
      const rows = [state.topFifteenthId!, lower[1].clubId, lower[2].clubId].map(clubId => ({
        clubId, points: 0, goalsFor: 0, goalsAgainst: 0, played: 0, won: 0, drawn: 0, lost: 0,
      }))
      for (const fixture of current) {
        const h = rows.find(row => row.clubId === fixture.homeId)!, a = rows.find(row => row.clubId === fixture.awayId)!
        const { homeGoals, awayGoals } = fixture.result!
        h.goalsFor += homeGoals; h.goalsAgainst += awayGoals; a.goalsFor += awayGoals; a.goalsAgainst += homeGoals
        if (homeGoals > awayGoals) h.points += 3
        else if (awayGoals > homeGoals) a.points += 3
        else { h.points++; a.points++ }
      }
      state.winnerId = ranking(rows)[0].clubId
      state.stage = 'completed'
    } else if (state.stage === 'eliminator') {
      if (associationId === 'sco') {
        const challenger = winner(world, current, lower[2].clubId)
        createFixture(world, state, 'semifinal', 0, challenger, lower[1].clubId, addDays(lastLeagueDate, 12), occupied)
        createFixture(world, state, 'semifinal', 1, lower[1].clubId, challenger, addDays(lastLeagueDate, 16), occupied)
      } else if (associationId === 'fra') {
        createFixture(world, state, 'semifinal', 0, lower[2].clubId,
          winner(world, current, lower[3].clubId), addDays(lastLeagueDate, 8), occupied)
      } else {
        const survivors = current.map((fixture, index) => winner(world, [fixture], lower[4 + index].clubId))
        const low = survivors.sort((a, b) => lower.findIndex(row => row.clubId === a) - lower.findIndex(row => row.clubId === b))
        const matchups: [string, string][] = [[lower[2].clubId, low[1]], [lower[3].clubId, low[0]]]
        matchups.forEach(([seed, opponent], index) => {
          createFixture(world, state!, 'semifinal', index * 2, opponent, seed, addDays(lastLeagueDate, 10), occupied)
          createFixture(world, state!, 'semifinal', index * 2 + 1, seed, opponent, addDays(lastLeagueDate, 14), occupied)
        })
      }
      state.stage = 'semifinal'
    } else if (state.stage === 'semifinal') {
      if (associationId === 'fra' || associationId === 'sco') {
        const challenger = winner(world, current, associationId === 'fra' ? lower[2].clubId : lower[1].clubId)
        const incumbent = top.at(associationId === 'sco' ? -2 : -3)!.clubId
        createFixture(world, state, 'final', 0, challenger, incumbent, addDays(lastLeagueDate, associationId === 'sco' ? 20 : 13), occupied)
        createFixture(world, state, 'final', 1, incumbent, challenger, addDays(lastLeagueDate, associationId === 'sco' ? 24 : 17), occupied)
      } else {
        const finalists = [0, 1].map(index => winner(world, current.slice(index * 2, index * 2 + 2), lower[2 + index].clubId, associationId === 'esp'))
        const seeded = associationId === 'esp' ? finalists.sort((a, b) => lower.findIndex(row => row.clubId === a) - lower.findIndex(row => row.clubId === b)) : finalists
        createFixture(world, state, 'final', 0, associationId === 'esp' ? seeded[1] : seeded[0],
          associationId === 'esp' ? seeded[0] : seeded[1], addDays(lastLeagueDate, 20), occupied)
        if (associationId === 'esp') createFixture(world, state, 'final', 1, seeded[0], seeded[1], addDays(lastLeagueDate, 24), occupied)
      }
      state.stage = 'final'
    } else if (state.stage === 'final') {
      state.winnerId = winner(world, current,
        associationId === 'esp' ? current.at(-1)!.homeId : current[0].homeId, associationId === 'esp')
      state.stage = 'completed'
    } else break
    if (state.stage === 'completed') return state.winnerId!
  }
  return state.stage === 'completed' ? state.winnerId! : null
}
