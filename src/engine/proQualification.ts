import type { ProWorldState } from './proWorld'

/** Qualification is resolved using *completed* domestic seasons, never a live
 * midseason table when a prior completed edition exists. These are gameplay
 * allocations inspired by confederation qualification pathways; actual UEFA
 * coefficients and changing federation access lists are not simulated.
 */
export interface ContinentalBerths { champions: string[]; secondary: string[]; third: string[] }
type Rule = { champions: number; secondary: number; third: number; cup: boolean; leagueCup?: boolean }

/** Ten interactive destinations in the upcoming release. */
export const PLAYABLE_CONTINENTAL_RULES: Readonly<Record<string, Rule>> = {
  eng: { champions: 4, secondary: 2, third: 1, cup: true, leagueCup: true },
  esp: { champions: 4, secondary: 2, third: 1, cup: true },
  ger: { champions: 4, secondary: 2, third: 1, cup: true },
  fra: { champions: 3, secondary: 2, third: 1, cup: true },
  ita: { champions: 4, secondary: 2, third: 1, cup: true },
  ned: { champions: 2, secondary: 2, third: 1, cup: true },
  por: { champions: 2, secondary: 1, third: 1, cup: true },
  sco: { champions: 1, secondary: 1, third: 1, cup: true },
  bra: { champions: 6, secondary: 6, third: 0, cup: true },
  rsa: { champions: 2, secondary: 2, third: 0, cup: true },
}
function completedTable(world: ProWorldState, country: string, year: number) {
  const history = world.seasonHistory.filter(r => r.competitionId === `top-${country}` &&
    Number(r.seasonId) < year && r.table.length)
    .sort((a, b) => b.seasonId.localeCompare(a.seasonId))
  return history[0]?.table ?? world.standings[`top-${country}`] ?? []
}
export function rankedDomesticClubs(world: ProWorldState, country: string, year: number): string[] {
  return [...completedTable(world, country, year)].sort((a, b) =>
    b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) ||
    b.goalsFor - a.goalsFor || a.clubId.localeCompare(b.clubId)).map(r => r.clubId)
}
function cupWinner(world: ProWorldState, competitionId: string, year: number): string | undefined {
  return world.championHistory.filter(r => r.competitionId === competitionId &&
    Number(r.seasonId) < year).sort((a, b) => b.seasonId.localeCompare(a.seasonId))[0]?.championId
}
/** The same club cannot enter two continental competitions in a season.
 * A cup winner already qualified to a higher tier passes the spot to the
 * next unqualified domestic finisher rather than receiving a duplicate berth.
 */
export function domesticContinentalBerths(world: ProWorldState, country: string,
  year: number): ContinentalBerths {
  const league = rankedDomesticClubs(world, country, year)
  const rule = PLAYABLE_CONTINENTAL_RULES[country] ??
    { champions: 1, secondary: 1, third: 0, cup: false }
  const chosen = new Set<string>()
  const result: ContinentalBerths = { champions: [], secondary: [], third: [] }
  const take = (tier: keyof ContinentalBerths, candidate?: string): void => {
    const club = candidate && league.includes(candidate) && !chosen.has(candidate)
      ? candidate : league.find(id => !chosen.has(id))
    if (club) { chosen.add(club); result[tier].push(club) }
  }
  for (let i = 0; i < rule.champions; i++) take('champions', league[i])
  // Cup winners get the highest available non-champions berth.
  if (rule.cup && rule.secondary) take('secondary', cupWinner(world, `cup-${country}`, year))
  for (let i = result.secondary.length; i < rule.secondary; i++) take('secondary')
  if (rule.leagueCup && rule.third) take('third', cupWinner(world, `league-cup-${country}`, year))
  while (result.third.length < rule.third) take('third')
  return result
}
/** Compatibility exports retained for existing callers and tests. */
export function englandBerths(world: ProWorldState): ContinentalBerths {
  return domesticContinentalBerths(world, 'eng', Number(world.currentDate.slice(0, 4)))
}
export function southAfricaBerths(world: ProWorldState): ContinentalBerths {
  return domesticContinentalBerths(world, 'rsa', Number(world.currentDate.slice(0, 4)))
}
