import { rand } from './rng'
// Phase 19 — generic cup engine. Handles BOTH shapes the spec calls for:
//   - group stage -> knockout (School Cup, Academy cups): guaranteed matches
//     via the group, then a bracket for whoever tops their group.
//   - pure knockout (Sunday Cup): groupSize=0 skips straight to the bracket.
// One engine, parameterized, so P20/P21 don't need a third copy of this.
import { generateTeam, type Team } from './teams'
import {
  makeGroups,
  generateGroupFixtures,
  generateKnockoutRound,
  knockoutWinners,
  type GenericFixture,
  type GroupAssignment,
} from './competitions'
import type { LeagueStanding } from './league'

export type CupStage = 'group' | 'knockout' | 'complete'

export interface CupWorld {
  competitionId: string
  label: string
  playerTeamId: string
  stage: CupStage
  // group stage (empty arrays if this cup has no group stage)
  groups: GroupAssignment[]
  groupFixtures: Record<string, GenericFixture[]>
  groupStandings: Record<string, LeagueStanding[]>
  // knockout stage — one array of fixtures per round, rounds played in order
  knockoutRounds: GenericFixture[][]
  currentKnockoutRound: number
  playerEliminated: boolean
  playerWonCup: boolean
  teams: Team[]
  qualifiersPerGroup?: number
}

/** Keep an in-progress cup's displayed identities aligned with its source
 * league after a save migration. Results and brackets remain untouched. */
export function syncCupTeamIdentities(world: CupWorld, sourceTeams: Team[]): CupWorld {
  const byId = new Map(sourceTeams.map((team) => [team.id, team]))
  const syncStanding = (standing: LeagueStanding): LeagueStanding => {
    const team = byId.get(standing.teamId)
    return team ? { ...standing, teamName: team.name, teamShort: team.short } : standing
  }
  return {
    ...world,
    teams: world.teams.map((team) => byId.get(team.id) ?? team),
    groupStandings: Object.fromEntries(Object.entries(world.groupStandings).map(([group, standings]) => [group, standings.map(syncStanding)])),
  }
}

function standingFor(team: Team): LeagueStanding {
  return { teamId: team.id, teamName: team.name, teamShort: team.short, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }
}

function applyResultToStandings(standings: LeagueStanding[], homeId: string, awayId: string, hg: number, ag: number): LeagueStanding[] {
  return standings.map((s) => {
    if (s.teamId === homeId) {
      const won = hg > ag, drawn = hg === ag, lost = hg < ag
      return { ...s, played: s.played + 1, won: s.won + (won ? 1 : 0), drawn: s.drawn + (drawn ? 1 : 0), lost: s.lost + (lost ? 1 : 0), goalsFor: s.goalsFor + hg, goalsAgainst: s.goalsAgainst + ag, points: s.points + (won ? 3 : drawn ? 1 : 0) }
    }
    if (s.teamId === awayId) {
      const won = ag > hg, drawn = ag === hg, lost = ag < hg
      return { ...s, played: s.played + 1, won: s.won + (won ? 1 : 0), drawn: s.drawn + (drawn ? 1 : 0), lost: s.lost + (lost ? 1 : 0), goalsFor: s.goalsFor + ag, goalsAgainst: s.goalsAgainst + hg, points: s.points + (won ? 3 : drawn ? 1 : 0) }
    }
    return s
  })
}

function sortGroup(standings: LeagueStanding[]): LeagueStanding[] {
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdA = a.goalsFor - a.goalsAgainst, gdB = b.goalsFor - b.goalsAgainst
    if (gdB !== gdA) return gdB - gdA
    return b.goalsFor - a.goalsFor
  })
}

export interface CupConfig {
  competitionId: string
  label: string
  groupSize: number // 0 = no group stage, straight to knockout
  fieldSize: number // total teams competing, including the player's team
  prestigeRange: [number, number]
  // P63 — Joel: "a div 3 team should be able to play a div 1 team in the
  // cup." Cup opponents used to be entirely fresh, disconnected
  // `generateTeam()` calls — never real league teams at all, so no division
  // mixing was ever actually possible. When a real pool is supplied (drawn
  // from across every division in the actual league/academy world), it's
  // used instead — real teams, real cross-division draws. Falls back to
  // generation only if the pool is missing or too small, so this never
  // breaks a cup that doesn't have a league world to draw from yet.
  realTeamPool?: Team[]
  qualifiersPerGroup?: number
}

export function initCupWorld(config: CupConfig, playerTeam: Team): CupWorld {
  const others: Team[] = []
  const pool = (config.realTeamPool ?? []).filter((t) => t.id !== playerTeam.id)
  if (pool.length >= config.fieldSize - 1) {
    // Shuffle and take what's needed — real teams from potentially any
    // division, which is the whole point.
    const shuffled = [...pool].sort(() => rand() - 0.5)
    others.push(...shuffled.slice(0, config.fieldSize - 1))
  } else {
    while (others.length < config.fieldSize - 1) {
      others.push(generateTeam(config.prestigeRange[0] + Math.floor(rand() * (config.prestigeRange[1] - config.prestigeRange[0] + 1))))
    }
  }
  const teams = [playerTeam, ...others]

  if (config.groupSize > 0) {
    // Build the player's own group first (groupSize-1 others + the player),
    // then chunk the REMAINING teams into groups of groupSize. Splitting all
    // of `others` into groups of (groupSize-1) before adding the player back
    // was wrong — it made every group one short except the player's, which
    // got the +1 prepend that should only ever apply to their own group.
    const playerGroupOthers = others.slice(0, config.groupSize - 1)
    const restOthers = others.slice(config.groupSize - 1)
    const restGroups = makeGroups(restOthers.map((t) => t.id), config.groupSize)
    const groups: GroupAssignment[] = [
      { groupId: 'G1', teamIds: [playerTeam.id, ...playerGroupOthers.map((t) => t.id)] },
      ...restGroups.map((g, i) => ({ groupId: `G${i + 2}`, teamIds: g.teamIds })),
    ]
    const groupFixtures = generateGroupFixtures(groups)
    const groupStandings: Record<string, LeagueStanding[]> = {}
    for (const g of groups) groupStandings[g.groupId] = g.teamIds.map((id) => standingFor(teams.find((t) => t.id === id)!))
    return {
      competitionId: config.competitionId,
      label: config.label,
      playerTeamId: playerTeam.id,
      stage: 'group',
      groups,
      groupFixtures,
      groupStandings,
      knockoutRounds: [],
      currentKnockoutRound: 0,
      playerEliminated: false,
      playerWonCup: false,
      teams,
      qualifiersPerGroup: config.qualifiersPerGroup ?? 1,
    }
  }

  // pure knockout — round 1 pairs everyone immediately
  const round1 = generateKnockoutRound(teams.map((t) => t.id), 1)
  return {
    competitionId: config.competitionId,
    label: config.label,
    playerTeamId: playerTeam.id,
    stage: 'knockout',
    groups: [],
    groupFixtures: {},
    groupStandings: {},
    knockoutRounds: [round1],
    currentKnockoutRound: 1,
    playerEliminated: false,
    playerWonCup: false,
    teams,
    qualifiersPerGroup: 1,
  }
}

function playerGroupId(world: CupWorld): string | undefined {
  return world.groups.find((g) => g.teamIds.includes(world.playerTeamId))?.groupId
}

// Record the PLAYER's own match (played through the real match engine),
// whichever stage the cup is currently in.
// shootoutWonByPlayer: only consulted when a KNOCKOUT tie ends level — cup
// draws are settled by a penalty shootout (rolled by the caller so the UI can
// narrate it), never by silently eliminating the player as the old code did.
export function recordCupPlayerResult(world: CupWorld, opponentId: string, playerScored: number, opponentScored: number, playerWasHome: boolean, shootoutWonByPlayer?: boolean): CupWorld {
  const homeId = playerWasHome ? world.playerTeamId : opponentId
  const awayId = playerWasHome ? opponentId : world.playerTeamId
  const hg = playerWasHome ? playerScored : opponentScored
  const ag = playerWasHome ? opponentScored : playerScored

  if (world.stage === 'group') {
    const gid = playerGroupId(world)
    if (!gid) return world
    const fixtures = world.groupFixtures[gid].map((f) =>
      !f.played && f.homeTeamId === homeId && f.awayTeamId === awayId ? { ...f, played: true, homeGoals: hg, awayGoals: ag } : f
    )
    const standings = applyResultToStandings(world.groupStandings[gid], homeId, awayId, hg, ag)
    return { ...world, groupFixtures: { ...world.groupFixtures, [gid]: fixtures }, groupStandings: { ...world.groupStandings, [gid]: standings } }
  }

  // knockout — player's fixture is somewhere in the current round
  const round = world.knockoutRounds[world.currentKnockoutRound - 1]
  const updatedRound = round.map((f) =>
    !f.played && f.homeTeamId === homeId && f.awayTeamId === awayId ? { ...f, played: true, homeGoals: hg, awayGoals: ag } : f
  )
  const drew = hg === ag
  const eliminated = drew ? !(shootoutWonByPlayer ?? false) : (playerWasHome ? hg < ag : ag < hg)
  const rounds = [...world.knockoutRounds]
  // A drawn tie must produce a winner for knockoutWinners() (which advances
  // whoever has >= goals at home). Nudge the recorded score by the shootout
  // outcome so bracket math and the player's fate always agree — the previous
  // version marked the player eliminated on ANY draw while the bracket
  // advanced the home side, which could advance an "eliminated" player's team.
  rounds[world.currentKnockoutRound - 1] = updatedRound.map((f) => {
    if (f.homeTeamId !== homeId || f.awayTeamId !== awayId || !drew) return f
    const playerWinsShootout = shootoutWonByPlayer ?? false
    const homeWins = playerWasHome ? playerWinsShootout : !playerWinsShootout
    return homeWins ? f : { ...f, awayGoals: (f.awayGoals ?? 0) + 1 }
  })
  return { ...world, knockoutRounds: rounds, playerEliminated: world.playerEliminated || eliminated }
}

// Sim every OTHER fixture in the current stage (group round `round`, or the
// current knockout round). Mirrors league.ts's batchSimDivisionRound pattern.
function simpleScore(attack: number, defense: number): number {
  const expected = Math.max(0.2, (attack - defense) / 40 + 1.3)
  let goals = 0
  let p = rand() * expected * 1.8
  while (p > 1) { goals++; p -= 1 }
  if (rand() < (p % 1)) goals++
  return Math.min(goals, 7)
}

// Sim every unplayed fixture up to AND INCLUDING `round`, optionally the
// player's own too (used when the player is injured/eliminated so the cup
// never stalls waiting on a fixture that will never be played manually).
// Simming "through" rather than exactly-at also self-heals cups added to an
// old save mid-season, where earlier rounds' calendar weeks already passed.
export function batchSimCupStage(world: CupWorld, round: number, includePlayerTeam = false): CupWorld {
  const teamById = new Map(world.teams.map((t) => [t.id, t]))

  if (world.stage === 'group') {
    const groupFixtures = { ...world.groupFixtures }
    const groupStandings = { ...world.groupStandings }
    for (const g of world.groups) {
      let standings = groupStandings[g.groupId]
      groupFixtures[g.groupId] = groupFixtures[g.groupId].map((f) => {
        if (f.played || f.round > round) return f
        if (!includePlayerTeam && (f.homeTeamId === world.playerTeamId || f.awayTeamId === world.playerTeamId)) return f
        const home = teamById.get(f.homeTeamId), away = teamById.get(f.awayTeamId)
        if (!home || !away) return f
        const hg = simpleScore(home.ratings.attack, away.ratings.defense)
        const ag = simpleScore(away.ratings.attack, home.ratings.defense)
        standings = applyResultToStandings(standings, f.homeTeamId, f.awayTeamId, hg, ag)
        return { ...f, played: true, homeGoals: hg, awayGoals: ag }
      })
      groupStandings[g.groupId] = standings
    }
    return { ...world, groupFixtures, groupStandings }
  }

  if (world.stage === 'knockout') {
    const currentRound = world.knockoutRounds[world.currentKnockoutRound - 1]
    const updated = currentRound.map((f) => {
      if (f.played) return f
      if (!includePlayerTeam && (f.homeTeamId === world.playerTeamId || f.awayTeamId === world.playerTeamId)) return f
      const home = teamById.get(f.homeTeamId), away = teamById.get(f.awayTeamId)
      if (!home || !away) return f
      let hg = simpleScore(home.ratings.attack, away.ratings.defense)
      let ag = simpleScore(away.ratings.attack, home.ratings.defense)
      // Knockout ties can't end level: settle on "penalties" with a rating-
      // weighted coin, expressed as a +1 so knockoutWinners() reads it.
      if (hg === ag) {
        const homeEdge = 0.5 + (home.ratings.midfield - away.ratings.midfield) / 200
        if (rand() < homeEdge) hg += 1
        else ag += 1
      }
      return { ...f, played: true, homeGoals: hg, awayGoals: ag }
    })
    const rounds = [...world.knockoutRounds]
    rounds[world.currentKnockoutRound - 1] = updated
    return { ...world, knockoutRounds: rounds }
  }

  return world
}

// Move from group stage to knockout once every group's fixtures are done, or
// advance to the next knockout round once the current one is fully played.
// If the player was eliminated (group: didn't top their group; knockout:
// lost), they're marked out but the cup world still exists so the rest of
// the field (rivals worth tracking later) finishes out the competition.
export function advanceCupStage(world: CupWorld): CupWorld {
  if (world.stage === 'group') {
    const done = world.groups.every((g) => world.groupFixtures[g.groupId].every((f) => f.played))
    if (!done) return world
    const winners = world.groups.flatMap((g) => sortGroup(world.groupStandings[g.groupId]).slice(0, world.qualifiersPerGroup ?? 1).map((s) => s.teamId))
    const playerTopped = winners.includes(world.playerTeamId)
    const round1 = generateKnockoutRound(winners, 1)
    return {
      ...world,
      stage: 'knockout',
      knockoutRounds: [round1],
      currentKnockoutRound: 1,
      playerEliminated: world.playerEliminated || !playerTopped,
    }
  }

  if (world.stage === 'knockout') {
    const currentRound = world.knockoutRounds[world.currentKnockoutRound - 1]
    if (!currentRound.every((f) => f.played)) return world
    const winners = knockoutWinners(currentRound)
    if (winners.length <= 1) {
      return { ...world, stage: 'complete', playerWonCup: winners[0] === world.playerTeamId && !world.playerEliminated }
    }
    const nextRound = generateKnockoutRound(winners, world.currentKnockoutRound + 1)
    return { ...world, knockoutRounds: [...world.knockoutRounds, nextRound], currentKnockoutRound: world.currentKnockoutRound + 1 }
  }

  return world
}

// Find the player's fixture for the CURRENT stage, if it hasn't been played —
// used to know who they're facing next / whether they have a cup match this week.
export function playerCupFixture(world: CupWorld): GenericFixture | null {
  if (world.stage === 'group') {
    const gid = playerGroupId(world)
    if (!gid) return null
    return world.groupFixtures[gid].find((f) => !f.played && (f.homeTeamId === world.playerTeamId || f.awayTeamId === world.playerTeamId)) ?? null
  }
  if (world.stage === 'knockout' && !world.playerEliminated) {
    const round = world.knockoutRounds[world.currentKnockoutRound - 1]
    return round.find((f) => !f.played && (f.homeTeamId === world.playerTeamId || f.awayTeamId === world.playerTeamId)) ?? null
  }
  return null
}


// The four club cup competitions, keyed by their COMPETITION_SPECS ids.
// Field sizes chosen so round counts match the scheduler's reserved weeks:
// group cups = 3 group rounds (groups of 4) + semi + final (16 -> 4 winners);
// pure knockouts = 16 -> 4 rounds.
export const CUP_CONFIGS: Record<string, Omit<CupConfig, 'competitionId' | 'label'> & { label: string }> = {
  schoolCup: { label: 'Regional Schools Cup', groupSize: 6, fieldSize: 24, prestigeRange: [2, 6], qualifiersPerGroup: 2 },
  nationalChampionship: { label: 'National Schools Championship', groupSize: 4, fieldSize: 8, prestigeRange: [5, 8], qualifiersPerGroup: 2 },
  sundayCup: { label: 'Grassroots Cup', groupSize: 0, fieldSize: 16, prestigeRange: [2, 6] },
  schoolDevelopment: { label: 'Schools Development Competition', groupSize: 6, fieldSize: 6, prestigeRange: [2, 5], qualifiersPerGroup: 1 },
  octoberLeague: { label: 'October Development League', groupSize: 5, fieldSize: 5, prestigeRange: [3, 7], qualifiersPerGroup: 1 },
  youthFestival: { label: 'Three-Day Youth Festival', groupSize: 4, fieldSize: 4, prestigeRange: [3, 7], qualifiersPerGroup: 1 },
  academyLeagueCup: { label: 'U18 Premier Cup', groupSize: 4, fieldSize: 16, prestigeRange: [5, 8] },
  academyKnockoutCup: { label: 'Youth Cup', groupSize: 0, fieldSize: 16, prestigeRange: [5, 8] },
}

export function initCupById(competitionId: string, playerTeam: Team, realTeamPool?: Team[]): CupWorld {
  const cfg = CUP_CONFIGS[competitionId]
  return initCupWorld({ competitionId, label: cfg.label, groupSize: cfg.groupSize, fieldSize: cfg.fieldSize, prestigeRange: cfg.prestigeRange, qualifiersPerGroup: cfg.qualifiersPerGroup, realTeamPool }, playerTeam)
}
