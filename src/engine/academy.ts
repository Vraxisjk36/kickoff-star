import { rand } from './rng'
import { generateTeam, type Team } from './teams'
import { sortStandings, attributeGoals, resetTeamScorers, rescaleTeamToRange, type LeagueStanding, type Fixture, type Division, type DivisionTier } from './league'
import { generateRoundRobin } from './competitions'
import { academyClub } from './academyClubs'

// ============================================================================
// Two-tier domestic academy league. Cup worlds are built in the career store;
// the league here carries the same country identities through promotion.
// ============================================================================

export type AcademyTier = 1 | 2 // 1 = U18 Premier League, 2 = Professional Development League

export interface AcademyWorld {
  divisions: Record<AcademyTier, Division>
  playerDivision: AcademyTier
  playerTeamId: string
}

const TIER_PRESTIGE_RANGE: Record<AcademyTier, [number, number]> = {
  1: [7, 10],
  2: [5, 7],
}

function initStanding(team: Team): LeagueStanding {
  return { teamId: team.id, teamName: team.name, teamShort: team.short, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }
}

// Phase 17: delegates to the shared generic round-robin generator instead of
// a second bespoke copy of the same circle-method math.
function generateFixtures(teams: Team[], legs: 1 | 2 = 1): Fixture[] {
  return generateRoundRobin(teams.map((t) => t.id), legs).map((f) => ({
    id: f.id,
    week: f.round,
    homeTeamId: f.homeTeamId,
    awayTeamId: f.awayTeamId,
    played: f.played,
    homeGoals: f.homeGoals,
    awayGoals: f.awayGoals,
  }))
}

function initTier(tier: AcademyTier, playerTeam?: Team, countryId?: string, usedNames: string[] = []): Division {
  const [lo, hi] = TIER_PRESTIGE_RANGE[tier]
  const teams: Team[] = []
  if (playerTeam) teams.push(playerTeam)
  while (teams.length < 12) {
    const prestige = lo + Math.floor(rand() * (hi - lo + 1))
    const team = countryId ? academyClub(countryId, prestige, [...usedNames, ...teams.map(t => t.name)]) : generateTeam(prestige)
    teams.push(team)
  }
  return { tier: tier as unknown as DivisionTier, teams, standings: teams.map(initStanding), fixtures: generateFixtures(teams, 2) }
}

// Player enters at tier 2 (Professional Development League) — a fresh academy signing
// has to earn their way into the first team's U18 Premier League squad.
export function initAcademyWorld(academyClubName: string, prestige: number, countryId?: string): AcademyWorld {
  const academyTeam: Team = { ...generateTeam(prestige), name: academyClubName, short: academyClubName.slice(0, 3).toUpperCase(), countryId }
  const tier2 = initTier(2, academyTeam, countryId)
  const tier1 = initTier(1, undefined, countryId, tier2.teams.map(t => t.name))
  return { divisions: { 1: tier1, 2: tier2 }, playerDivision: 2, playerTeamId: academyTeam.id }
}

function updateStandingsFromResult(standings: LeagueStanding[], homeId: string, awayId: string, hg: number, ag: number): LeagueStanding[] {
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

export function recordAcademyMatchResult(world: AcademyWorld, opponentId: string, playerScored: number, opponentScored: number, playerWasHome: boolean, personalGoals = 0): AcademyWorld {
  const division = world.divisions[world.playerDivision]
  const homeId = playerWasHome ? world.playerTeamId : opponentId
  const awayId = playerWasHome ? opponentId : world.playerTeamId
  const hg = playerWasHome ? playerScored : opponentScored
  const ag = playerWasHome ? opponentScored : playerScored
  const fixtures = division.fixtures.map((f) =>
    !f.played && f.homeTeamId === homeId && f.awayTeamId === awayId ? { ...f, played: true, homeGoals: hg, awayGoals: ag } : f
  )
  const standings = updateStandingsFromResult(division.standings, homeId, awayId, hg, ag)
  const teams = division.teams.map(t => t.id === world.playerTeamId ? attributeGoals(t, Math.max(0, playerScored - personalGoals)) : t.id === opponentId ? attributeGoals(t, opponentScored) : t)
  return { ...world, divisions: { ...world.divisions, [world.playerDivision]: { ...division, fixtures, standings, teams } } }
}

function simpleScore(attack: number, defense: number): number {
  const expected = Math.max(0.2, (attack - defense) / 40 + 1.3)
  let goals = 0
  let p = rand() * expected * 1.8
  while (p > 1) { goals++; p -= 1 }
  if (rand() < (p % 1)) goals++
  return Math.min(goals, 7)
}

// Explicit round-index sim, same design fix as the Grassroots league (Phase 8 audit) —
// a player-missed fixture must never stall the rest of the tier's simulation.
// includePlayerTeam: sim the player's own fixture too — used when the player
// missed their matchday (injury), so the season never carries a permanently
// unplayed fixture. Sims all rounds <= round (self-heals any backlog).
export function batchSimAcademyRound(division: Division, round: number, playerTeamId: string, includePlayerTeam = false): Division {
  const teamById = new Map(division.teams.map((t) => [t.id, t]))
  let standings = division.standings
  const fixtures = division.fixtures.map((f) => {
    if (f.played || f.week > round) return f
    if (!includePlayerTeam && (f.homeTeamId === playerTeamId || f.awayTeamId === playerTeamId)) return f
    const home = teamById.get(f.homeTeamId)
    const away = teamById.get(f.awayTeamId)
    if (!home || !away) return f
    const hg = simpleScore(home.ratings.attack, away.ratings.defense)
    const ag = simpleScore(away.ratings.attack, home.ratings.defense)
    standings = updateStandingsFromResult(standings, f.homeTeamId, f.awayTeamId, hg, ag)
    teamById.set(home.id, attributeGoals(home, hg))
    teamById.set(away.id, attributeGoals(away, ag))
    return { ...f, played: true, homeGoals: hg, awayGoals: ag }
  })
  return { ...division, teams: division.teams.map((t) => teamById.get(t.id) ?? t), fixtures, standings }
}

// Promotion to U18 Premier League (top 3 of PDL get promoted — smaller pool than Grassroots
// since academy squads are more talent-concentrated).
/** Builds an academy tier from an explicit team list — fresh standings/fixtures for a new season, real identities carried forward. */
function buildTierFromTeams(tier: AcademyTier, teams: Team[]): Division {
  return { tier: tier as unknown as DivisionTier, teams: teams.map(resetTeamScorers), standings: teams.map(initStanding), fixtures: generateFixtures(teams, 2) }
}

// P68 — same real gap fixed in league.ts: every academy team other than the
// player's own got wiped and regenerated from scratch each season. Real fix:
// both tiers' actual teams persist and move by real result.
// Team counts balance: Tier1 (12): 9 survive + 3 promoted = 12.
// Tier2 (12): 9 survive (12 - 3 promoted out) + 3 relegated in = 12.
// There was previously NO relegation rule at all (promotion-only, which only
// ever worked because every other team was discarded anyway) — added a
// symmetric bottom-3 relegation from tier 1, the natural counterpart to the
// existing top-3 promotion, since real persistence needs both directions to
// keep tier sizes from growing unbounded.
export function applyAcademyPromotion(world: AcademyWorld): AcademyWorld {
  const sorted1 = sortStandings(world.divisions[1].standings)
  const sorted2 = sortStandings(world.divisions[2].standings)

  const teamById = new Map<string, Team>()
  for (const div of Object.values(world.divisions)) for (const t of div.teams) teamById.set(t.id, t)
  const teamOf = (s: LeagueStanding) => teamById.get(s.teamId)!

  const tier1Survivors = sorted1.slice(0, -3).map(teamOf)
  const tier1Relegated = sorted1.slice(-3).map(teamOf)
  const tier2Promoted = sorted2.slice(0, 3).map(teamOf)
  const tier2Survivors = sorted2.slice(3).map(teamOf)

  const promotedTo1 = tier2Promoted.map((t) => rescaleTeamToRange(t, TIER_PRESTIGE_RANGE[1]))
  const relegatedTo2 = tier1Relegated.map((t) => rescaleTeamToRange(t, TIER_PRESTIGE_RANGE[2]))

  const newTier1Teams = [...tier1Survivors, ...promotedTo1]
  const newTier2Teams = [...tier2Survivors, ...relegatedTo2]

  const newDivision: AcademyTier = newTier1Teams.some((t) => t.id === world.playerTeamId) ? 1 : 2

  return {
    divisions: {
      1: buildTierFromTeams(1, newTier1Teams),
      2: buildTierFromTeams(2, newTier2Teams),
    },
    playerDivision: newDivision,
    playerTeamId: world.playerTeamId,
  }
}

export function academyDivisionLabel(tier: AcademyTier): string {
  return tier === 1 ? 'U18 Premier League' : 'Professional Development League'
}
