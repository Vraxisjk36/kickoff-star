import type { Player } from '../types/player'
import type { Team } from './teams'
import { teamOverall } from './teams'
import type { SquadPlayer, SquadPosition } from './squad'
import { FIRST_NAMES, LAST_NAMES } from './squad'

const SHAPE: { position: SquadPosition; role: 'starter' | 'bench' }[] = [
  { position: 'GK', role: 'starter' }, { position: 'FB', role: 'starter' }, { position: 'CB', role: 'starter' },
  { position: 'CB', role: 'starter' }, { position: 'FB', role: 'starter' }, { position: 'CM', role: 'starter' },
  { position: 'CM', role: 'starter' }, { position: 'CM', role: 'starter' }, { position: 'WNG', role: 'starter' },
  { position: 'ST', role: 'starter' }, { position: 'WNG', role: 'starter' },
  { position: 'GK', role: 'bench' }, { position: 'CB', role: 'bench' }, { position: 'CM', role: 'bench' }, { position: 'ST', role: 'bench' },
]

function hash(value: string): number {
  let result = 2166136261
  for (const letter of value) result = Math.imul(result ^ letter.charCodeAt(0), 16777619)
  return result >>> 0
}

/** A stable representative squad; club teammates never appear in national kit. */
export function representativeSquad(team: Team): SquadPlayer[] {
  const seed = hash(team.id)
  return SHAPE.map((slot, index) => ({
    id: `${team.id}-representative-${index}`,
    name: `${FIRST_NAMES[(seed + index * 7) % FIRST_NAMES.length]} ${LAST_NAMES[(seed + index * 11) % LAST_NAMES.length]}`,
    position: slot.position, squadRole: slot.role, quality: teamOverall(team),
    seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0, careerAppearances: 0,
  }))
}

export type TeamSheetEntry = { name: string; position: string; number: number; isPlayer: boolean }
const SHIRT_NUMBERS: Record<SquadPosition, number[]> = {
  GK: [1], FB: [2, 3], CB: [4, 5], CM: [6, 8, 10], WNG: [7, 11], ST: [9],
}

export function matchTeamSheet(player: Player): { starters: TeamSheetEntry[]; bench: TeamSheetEntry[] } {
  const squad = player.squad ?? []
  const starters = squad.filter(member => member.squadRole === 'starter')
  const bench = squad.filter(member => member.squadRole === 'bench')
  const playerStarts = player.squadRole === 'starting-xi'
  if (playerStarts && starters.length >= 11) {
    const samePosition = (member: SquadPlayer) => member.position === player.position ||
      (member.position === 'WNG' && (player.position === 'WG' || player.position === 'WM'))
    const replacement = [...starters].filter(samePosition).sort((a, b) => a.quality - b.quality)[0]
      ?? [...starters].sort((a, b) => a.quality - b.quality)[0]
    starters.splice(starters.findIndex(member => member.id === replacement.id), 1)
    bench.unshift(replacement)
  }
  const entries = [...starters.map(member => ({ name: member.name, position: member.position, isPlayer: false })),
    ...(playerStarts ? [{ name: player.name, position: player.position, isPlayer: true }] : [])]
  const used = new Set<number>()
  const numberedStarters = entries.map(entry => {
    const position = entry.position === 'WG' || entry.position === 'WM' ? 'WNG' : entry.position as SquadPosition
    const preferred = SHIRT_NUMBERS[position] ?? [12]
    const number = preferred.find(candidate => !used.has(candidate)) ?? Array.from({ length: 11 }, (_, i) => i + 1).find(candidate => !used.has(candidate)) ?? 12
    used.add(number)
    return { ...entry, number }
  }).sort((a, b) => a.number - b.number)
  const numberedBench = [...bench.map(member => ({ name: member.name, position: member.position, isPlayer: false })),
    ...(!playerStarts ? [{ name: player.name, position: player.position, isPlayer: true }] : [])]
    .map((entry, index) => ({ ...entry, number: 12 + index }))
  return { starters: numberedStarters, bench: numberedBench }
}

export function matchVenue(home: Team, competitionId: string, academy = false): string {
  if (competitionId === 'international') return `${home.name} National Stadium`
  if (competitionId === 'nationalChampionship') return `${home.name} Representative Ground`
  if (academy || competitionId.startsWith('academy')) return `${home.name} Academy Park`
  if (competitionId.startsWith('school') || competitionId === 'youthShowcase') return `${home.name} School Ground`
  return `${home.name} Community Ground`
}
