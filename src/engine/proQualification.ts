import type { ProWorldState } from './proWorld'

// These two association routes are based on the 2026/27 competition rules.
// The other associations retain their provisional simulation until each has
// an independently researched, versioned rules profile.
export interface ContinentalBerths { champions: string[]; secondary: string[]; third: string[] }
const order = (world: ProWorldState, id: string): string[] => {
  const latest = world.seasonHistory.filter(row => row.competitionId === `top-${id}`).at(-1)
  return [...(latest?.table ?? world.standings[`top-${id}`] ?? [])]
    .sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor)
    .map(row => row.clubId)
}
const winner = (world: ProWorldState, id: string) => world.championHistory.filter(row => row.competitionId === id).at(-1)?.championId
const nextUnused = (ranking: string[], used: Set<string>) => ranking.find(id => !used.has(id))

export function englandBerths(world: ProWorldState): ContinentalBerths {
  const ranking = order(world, 'eng')
  const champions = ranking.slice(0, 4)
  const used = new Set(champions)
  const secondary: string[] = []
  const third: string[] = []
  const place = (list: string[], candidate?: string) => {
    const selected = candidate && !used.has(candidate) ? candidate : nextUnused(ranking, used)
    if (selected) { list.push(selected); used.add(selected) }
  }
  place(secondary, ranking[4])
  // FA Cup and League Cup berths pass down to the next unqualified league club.
  place(secondary, winner(world, 'cup-eng'))
  place(third, winner(world, 'league-cup-eng'))
  return { champions, secondary, third }
}

export function southAfricaBerths(world: ProWorldState): ContinentalBerths {
  const ranking = order(world, 'rsa')
  const champions = ranking.slice(0, 2)
  const used = new Set(champions)
  const secondary: string[] = []
  const place = (candidate?: string) => {
    const selected = candidate && !used.has(candidate) ? candidate : nextUnused(ranking, used)
    if (selected) { secondary.push(selected); used.add(selected) }
  }
  place(winner(world, 'cup-rsa'))
  place(ranking[2])
  return { champions, secondary, third: [] }
}
