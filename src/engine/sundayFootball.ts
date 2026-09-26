import type { Player } from '../types/player'
import { initLeagueWorld, batchSimDivisionRound, type LeagueWorld } from './league'
import { generateTeam } from './teams'
import { generateSquad } from './squad'
import { regionalClubNames } from './regions'

export function sundayClub(world: LeagueWorld | undefined) {
  return world?.divisions[world.playerDivision].teams.find(team => team.id === world.playerTeamId)
}

export function simulateSundayThrough(world: LeagueWorld, week: number, includePlayer = true): LeagueWorld {
  const round = Math.min(22, Math.max(0, week))
  return { ...world, kind: 'sunday', divisions: {
    1: batchSimDivisionRound(world.divisions[1], round, world.playerTeamId, includePlayer),
    2: batchSimDivisionRound(world.divisions[2], round, world.playerTeamId, includePlayer),
    3: batchSimDivisionRound(world.divisions[3], round, world.playerTeamId, includePlayer),
  } }
}

/** The offer and the eventual registration refer to this same persisted club. */
export function ensureSundayClub(player: Player, week: number): Player {
  if (player.grassrootsPath !== 'school' || player.careerClock.phase === 'academy' || player.sundayLeague) return player
  if (!['training-invite', 'squad-offer', 'registered'].includes(player.pathway?.sundayStatus ?? '')) return player
  const name = (player.regionId ? regionalClubNames(player.regionId)[4] : undefined) ?? generateTeam(2).name
  const sundayLeague = simulateSundayThrough(initLeagueWorld(name, player.regionId), week - 1)
  return { ...player, sundayLeague, sundaySquad: generateSquad(sundayClub(sundayLeague)?.prestige ?? 2) }
}
