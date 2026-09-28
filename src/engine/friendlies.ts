import type { Division } from './league'
import type { Team } from './teams'

/** Pair schools by locality where possible; every school has one reciprocal rival. */
export function schoolRival(division: Division, playerTeamId: string): Team | undefined {
  const remaining = [...division.teams].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  const pairs: [Team, Team][] = []
  const locality = (name: string) => name.replace(/\s+(High|Secondary|School|Academy|College|Technical High)$/i, '').trim().split(/\s+/)[0]
  while (remaining.length >= 2) {
    const first = remaining.shift()!
    const match = remaining.findIndex(team => locality(team.name) === locality(first.name))
    const second = remaining.splice(match < 0 ? 0 : match, 1)[0]
    pairs.push([first, second])
  }
  const pair = pairs.find(([a, b]) => a.id === playerTeamId || b.id === playerTeamId)
  return pair?.[0].id === playerTeamId ? pair[1] : pair?.[0]
}

/** A stable preseason opponent lets the fixture list and matchday agree. */
export function friendlyOpponent(division: Division, playerTeamId: string, week: number, season: number): Team | undefined {
  if (week === 29) return schoolRival(division, playerTeamId)
  const others = division.teams.filter(team => team.id !== playerTeamId)
  if (!others.length) return undefined
  return others[((season - 1) * 2 + week - 4) % others.length]
}
