import type { Division } from './league'
import type { Team } from './teams'

/** A stable preseason opponent lets the fixture list and matchday agree. */
export function friendlyOpponent(division: Division, playerTeamId: string, week: number, season: number): Team | undefined {
  const others = division.teams.filter(team => team.id !== playerTeamId)
  if (!others.length) return undefined
  return others[((season - 1) * 2 + week - 4) % others.length]
}
