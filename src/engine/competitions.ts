import { rand } from './rng'
// Phase 17 — generic fixture generators shared by every competition type
// (Sunday League, School Cup, Sunday Cup, Academy leagues/cups, internationals).
// Previously each competition (just the one league) had its own bespoke
// round-robin generator baked into league.ts. This file is the single source
// of fixture-shape math so P18-24 can add new competitions without re-deriving
// round-robin/group/knockout logic each time.

export interface GenericFixture {
  id: string
  round: number // 1-based round index WITHIN this competition, not a calendar week
  homeTeamId: string
  awayTeamId: string
  played: boolean
  homeGoals: number | null
  awayGoals: number | null
  /** Shootout winner; goals remain the score at full time. */
  winnerTeamId?: string
}

function id() { return crypto.randomUUID() }

function emptyFixture(round: number, home: string, away: string): GenericFixture {
  return { id: id(), round, homeTeamId: home, awayTeamId: away, played: false, homeGoals: null, awayGoals: null }
}

// Round-robin via the circle method. legs=1 is single round-robin (n-1 rounds),
// legs=2 is home+away double round-robin (2n-2 rounds) — the second leg simply
// re-runs the same pairing schedule with home/away flipped, offset by the
// number of rounds in one leg so round indices stay unique and sequential.
export function generateRoundRobin(teamIds: string[], legs: 1 | 2 = 1): GenericFixture[] {
  const ids = [...teamIds]
  if (ids.length % 2 !== 0) ids.push('BYE')
  const roundsPerLeg = ids.length - 1
  const half = ids.length / 2
  const fixtures: GenericFixture[] = []

  const buildLeg = (roundOffset: number, flipped: boolean) => {
    let arr = [...ids]
    for (let round = 0; round < roundsPerLeg; round++) {
      for (let i = 0; i < half; i++) {
        const home = arr[i]
        const away = arr[arr.length - 1 - i]
        if (home !== 'BYE' && away !== 'BYE') {
          // alternate home/away within a leg like the original generator, then
          // flip everything for the second leg so it's a true reverse fixture
          let h = round % 2 === 0 ? home : away
          let a = round % 2 === 0 ? away : home
          if (flipped) [h, a] = [a, h]
          fixtures.push(emptyFixture(roundOffset + round + 1, h, a))
        }
      }
      arr = [arr[0], arr[arr.length - 1], ...arr.slice(1, arr.length - 1)]
    }
  }

  buildLeg(0, false)
  if (legs === 2) buildLeg(roundsPerLeg, true)
  return fixtures
}

export function roundRobinRoundCount(teamCount: number, legs: 1 | 2 = 1): number {
  const n = teamCount % 2 === 0 ? teamCount : teamCount + 1
  return (n - 1) * legs
}

// Group stage: split teams into groups of `groupSize`, single round-robin within
// each group. Returns fixtures with round indices local to the group stage
// (1..groupSize-1), plus the group assignment so standings can be tracked per-group.
export interface GroupAssignment {
  groupId: string
  teamIds: string[]
}

export function makeGroups(teamIds: string[], groupSize: number): GroupAssignment[] {
  const shuffled = [...teamIds].sort(() => rand() - 0.5)
  const groups: GroupAssignment[] = []
  for (let i = 0; i < shuffled.length; i += groupSize) {
    groups.push({ groupId: `G${groups.length + 1}`, teamIds: shuffled.slice(i, i + groupSize) })
  }
  return groups
}

export function generateGroupFixtures(groups: GroupAssignment[]): Record<string, GenericFixture[]> {
  const out: Record<string, GenericFixture[]> = {}
  for (const g of groups) out[g.groupId] = generateRoundRobin(g.teamIds, 1)
  return out
}

// Knockout: pairs teams for a single round. If the team count is odd, the last
// team gets a bye (auto-advances, represented as a fixture with awayTeamId 'BYE').
export function generateKnockoutRound(teamIds: string[], round: number): GenericFixture[] {
  const shuffled = [...teamIds].sort(() => rand() - 0.5)
  const fixtures: GenericFixture[] = []
  for (let i = 0; i < shuffled.length; i += 2) {
    if (i + 1 < shuffled.length) {
      fixtures.push(emptyFixture(round, shuffled[i], shuffled[i + 1]))
    } else {
      // bye — auto-advance, recorded as a played walkover so downstream code
      // (winners-of-round lookups) doesn't need a separate bye concept
      fixtures.push({ ...emptyFixture(round, shuffled[i], 'BYE'), played: true, homeGoals: 1, awayGoals: 0 })
    }
  }
  return fixtures
}

export function knockoutWinners(fixtures: GenericFixture[]): string[] {
  return fixtures
    .filter((f) => f.played && f.homeGoals !== null && f.awayGoals !== null)
    .map((f) => f.winnerTeamId ?? (f.homeGoals! >= f.awayGoals! ? f.homeTeamId : f.awayTeamId))
}
