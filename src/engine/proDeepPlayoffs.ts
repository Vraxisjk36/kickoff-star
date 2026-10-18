import { proRoll } from './proWorldFactory'
import type { IsoDate, ProFixture, ProPromotionPlayoff, ProStandingRow, ProWorldState } from './proWorld'

const addDays = (date: IsoDate, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
const rank = (rows: ProStandingRow[]) => [...rows].sort((a, b) => b.points - a.points ||
  b.goalsFor - b.goalsAgainst - a.goalsFor + a.goalsAgainst || b.goalsFor - a.goalsFor || a.clubId.localeCompare(b.clubId))

function fixture(world: ProWorldState, state: ProPromotionPlayoff, round: string, index: number,
  homeId: string, awayId: string, desired: IsoDate): void {
  let date = desired
  for (let n = 0; n < 30; n++) {
    if (!Object.values(world.fixtures).some(item => item.kickoffDate === date &&
      [homeId, awayId].some(id => item.homeId === id || item.awayId === id))) break
    date = addDays(date, 1)
  }
  const id = `fixture-promotion-${state.associationId}-${state.seasonId}-${round}-${index}`
  world.fixtures[id] = { id, competitionId: `promotion-${state.associationId}`, kickoffDate: date, homeId, awayId }
  state.fixtureIds.push(id)
}
function score(world: ProWorldState, game: ProFixture): void {
  if (game.result) return
  const edge = (world.clubs[game.homeId].reputation - world.clubs[game.awayId].reputation) * .035
  game.result = {
    homeGoals: Math.max(0, Math.floor(1.4 + edge + proRoll(world.seed, `${game.id}:home`) * 2.7 - .7)),
    awayGoals: Math.max(0, Math.floor(1.3 - edge + proRoll(world.seed, `${game.id}:away`) * 2.7 - .7)),
  }
}
function winner(world: ProWorldState, games: ProFixture[], seed: string): string {
  const opponent = games[0].homeId === seed ? games[0].awayId : games[0].homeId
  const goals = games.reduce((total, game) => {
    total[game.homeId] = (total[game.homeId] ?? 0) + game.result!.homeGoals
    total[game.awayId] = (total[game.awayId] ?? 0) + game.result!.awayGoals
    return total
  }, {} as Record<string, number>)
  return goals[seed] === goals[opponent] ? (proRoll(world.seed, `${games[0].id}:penalties`) < .5 ? seed : opponent)
    : goals[seed] > goals[opponent] ? seed : opponent
}

/** Saved EFL, SPFL and German third-tier promotion brackets. */
export function advanceDeepPlayoff(world: ProWorldState, associationId: 'eng' | 'ger' | 'sco', upperTier: 2 | 3,
  seasonId: string, lastLeagueDate: IsoDate, targetDate: IsoDate,
  upperRows: ProStandingRow[], lowerRows: ProStandingRow[]): string | null {
  const upper = rank(upperRows), lower = rank(lowerRows)
  const key = `promotion-${associationId}-${upperTier}`
  world.promotionPlayoffs ??= {}
  let state = world.promotionPlayoffs[key]
  if (!state || state.seasonId !== seasonId) {
    state = { associationId: `${associationId}-${upperTier}`, seasonId,
      stage: associationId === 'ger' ? 'final' : associationId === 'sco' ? 'eliminator' : 'semifinal', fixtureIds: [] }
    world.promotionPlayoffs[key] = state
    if (associationId === 'ger') {
      fixture(world, state, 'final', 0, lower[2].clubId, upper.at(-3)!.clubId, addDays(lastLeagueDate, 5))
      fixture(world, state, 'final', 1, upper.at(-3)!.clubId, lower[2].clubId, addDays(lastLeagueDate, 9))
    } else if (associationId === 'sco') {
      fixture(world, state, 'eliminator', 0, lower[3].clubId, lower[2].clubId, addDays(lastLeagueDate, 4))
      fixture(world, state, 'eliminator', 1, lower[2].clubId, lower[3].clubId, addDays(lastLeagueDate, 8))
    } else {
      const first = upperTier === 2 ? 2 : 3
      for (let i = 0; i < 2; i++) {
        const seed = lower[first + i].clubId, opponent = lower[first + 3 - i].clubId
        fixture(world, state, 'semifinal', i * 2, opponent, seed, addDays(lastLeagueDate, 4))
        fixture(world, state, 'semifinal', i * 2 + 1, seed, opponent, addDays(lastLeagueDate, 8))
      }
    }
  }
  for (let stage = 0; stage < 4; stage++) {
    if (state.stage === 'completed') return state.winnerId!
    const games = state.fixtureIds.map(id => world.fixtures[id]).filter(game => game.id.includes(`-${state.stage}-`))
    for (const game of games) if (!game.result && game.kickoffDate < targetDate) score(world, game)
    if (games.some(game => !game.result)) return null
    if (state.stage === 'eliminator') {
      const challenger = winner(world, games, lower[2].clubId)
      fixture(world, state, 'semifinal', 0, challenger, lower[1].clubId, addDays(lastLeagueDate, 12))
      fixture(world, state, 'semifinal', 1, lower[1].clubId, challenger, addDays(lastLeagueDate, 16))
      state.stage = 'semifinal'
    } else if (state.stage === 'semifinal') {
      if (associationId === 'sco') {
        const challenger = winner(world, games, lower[1].clubId)
        fixture(world, state, 'final', 0, challenger, upper.at(-2)!.clubId, addDays(lastLeagueDate, 20))
        fixture(world, state, 'final', 1, upper.at(-2)!.clubId, challenger, addDays(lastLeagueDate, 24))
      } else {
        const first = upperTier === 2 ? 2 : 3
        const finalists = [0, 1].map(i => winner(world, games.slice(i * 2, i * 2 + 2), lower[first + i].clubId))
        fixture(world, state, 'final', 0, finalists[0], finalists[1], addDays(lastLeagueDate, 14))
      }
      state.stage = 'final'
    } else {
      state.winnerId = winner(world, games, associationId === 'ger' ? upper.at(-3)!.clubId :
        associationId === 'sco' ? upper.at(-2)!.clubId : games[0].homeId)
      state.stage = 'completed'
      return state.winnerId
    }
  }
  return null
}
