import { rand } from './rng'
import { generateTeam, generatePlayerTeam, type Team, type NotablePlayer, type NotablePosition } from './teams'
import { getRegion, regionalSchoolNames, regionalClubNames } from './regions'
import { generateRoundRobin } from './competitions'

// ============================================================================
// GRASSROOTS SEASON LOOP (Phase 8) — locked world scope:
// 3 divisions of 10 teams each, promotion/relegation, prestige gate per division.
// Fixtures are single round-robin (9 matches/team) to leave room for school/cups/
// training in a 34-week season, per the earlier build-order tradeoff discussion.
// ============================================================================

export type DivisionTier = 1 | 2 | 3 // 1 = top division

export interface LeagueStanding {
  teamId: string
  teamName: string
  teamShort: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  points: number
}

export interface Fixture {
  id: string
  week: number
  homeTeamId: string
  awayTeamId: string
  played: boolean
  homeGoals: number | null
  awayGoals: number | null
}

export interface Division {
  tier: DivisionTier
  teams: Team[]
  standings: LeagueStanding[]
  fixtures: Fixture[]
}

export interface LeagueWorld {
  divisions: Record<DivisionTier, Division>
  playerDivision: DivisionTier
  playerTeamId: string
  /** School and Sunday football are separate pathways, even though they share
   * the same standings/fixture engine. Optional only for legacy saves. */
  kind?: 'school' | 'sunday'
  regionId?: string
}

const SCHOOL_NAMES = [
  'Kingsway High', 'Northfield High', 'Riverside High', 'Hillcrest High', 'Westbrook High',
  'Fairview Secondary', 'Eastgate High', 'Oakridge School', 'Southdale High', 'Newlands Academy',
  'St Mark’s High', 'Queens Park School', 'Redwood Secondary', 'Portland High', 'Ashford School',
  'Greenfield High', 'Lakeside Secondary', 'Central High', 'Bridgewater School', 'St John’s College',
  'Meadowridge High', 'Parktown School', 'Waterford High', 'Cedar Grove School', 'Stonebridge High',
  'Brookfield Secondary', 'Westgate School', 'Northwood High', 'Valley View School', 'Rosebank High',
]

function schoolName(index: number): string { return SCHOOL_NAMES[index % SCHOOL_NAMES.length] }
function schoolShort(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 3).map((part) => part[0]).join('').toUpperCase().padEnd(3, 'H').slice(0, 3)
}

const DIVISION_PRESTIGE_RANGE: Record<DivisionTier, [number, number]> = {
  1: [5, 8],
  2: [3, 5],
  3: [1, 3],
}

function initStanding(team: Team): LeagueStanding {
  return { teamId: team.id, teamName: team.name, teamShort: team.short, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }
}

// Fixture generation now delegates to the shared generic round-robin generator
// (engine/competitions.ts) so every competition in the game uses the same
// circle-method math. legs=1 today (single round-robin, unchanged behaviour);
// P18 bumps this to legs=2 for the 12-team home-and-away Sunday League.
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

function initDivision(tier: DivisionTier, playerTeam?: Team, teamCount = 12, names: string[] | null = null, regionId?: string): Division {
  const [lo, hi] = DIVISION_PRESTIGE_RANGE[tier]
  const teams: Team[] = []
  if (playerTeam) teams.push(playerTeam)
  while (teams.length < teamCount) {
    const generated = generateTeam(lo + Math.floor(rand() * (hi - lo + 1)))
    if (names === null) teams.push(generated)
    else {
      const name = names[teams.length - (playerTeam ? 1 : 0)] ?? schoolName(teams.length)
      teams.push({ ...generated, name, short: schoolShort(name), regionId, countryId: getRegion(regionId)?.countryId })
    }
  }
  return { tier, teams, standings: teams.map(initStanding), fixtures: generateFixtures(teams, 2) }
}

// Player starts in Division 3 (lowest) per typical grassroots entry point.
export function initLeagueWorld(playerTeamName: string, regionId?: string): LeagueWorld {
  const region = getRegion(regionId)
  const names = region ? regionalClubNames(region.id).filter(name => name !== playerTeamName) : null
  const playerTeam = { ...generatePlayerTeam(playerTeamName, 2), ...(region ? { regionId: region.id, countryId: region.countryId } : {}) }
  const div3 = initDivision(3, playerTeam, 12, names?.slice(0, 11) ?? null, region?.id)
  const div2 = initDivision(2, undefined, 12, names?.slice(11, 23) ?? null, region?.id)
  const div1 = initDivision(1, undefined, 12, names?.slice(23, 35) ?? null, region?.id)
  return {
    divisions: { 1: div1, 2: div2, 3: div3 },
    playerDivision: 3,
    playerTeamId: playerTeam.id,
    kind: 'sunday',
    regionId: region?.id,
  }
}

/** Ten-school local divisions. Only the player's local division is surfaced;
 * the other districts exist so regional cup draws still have real schools. */
export function initSchoolLeagueWorld(playerSchoolName: string, regionId?: string): LeagueWorld {
  const region = getRegion(regionId)
  const playerTeam = { ...generatePlayerTeam(playerSchoolName, 3), ...(region ? { regionId: region.id, countryId: region.countryId } : {}) }
  const availableNames = (region ? regionalSchoolNames(region.id) : SCHOOL_NAMES).filter((name) => name !== playerSchoolName)
  const div1 = initDivision(1, playerTeam, 10, availableNames.slice(0, 9), region?.id)
  const div2 = initDivision(2, undefined, 10, availableNames.slice(9, 19), region?.id)
  const div3 = initDivision(3, undefined, 10, availableNames.slice(19, 29), region?.id)
  return { divisions: { 1: div1, 2: div2, 3: div3 }, playerDivision: 1, playerTeamId: playerTeam.id, kind: 'school', regionId: region?.id }
}

/** Convert an already-started mixed-path save without erasing results. IDs,
 * fixtures, ratings and standings stay intact; only competition identity and
 * school names are corrected. */
export function migrateToSchoolLeagueWorld(world: LeagueWorld, playerSchoolName: string, regionId?: string): LeagueWorld {
  if (world.kind === 'school') {
    const current = world.divisions[world.playerDivision].teams.find(team => team.id === world.playerTeamId)
    if (current?.name === playerSchoolName) return world // preserve saved regional identities and results
    const division = world.divisions[world.playerDivision]
    const teams = division.teams.map(team => team.id === world.playerTeamId ? { ...team, name: playerSchoolName, short: schoolShort(playerSchoolName) } : team)
    const standings = division.standings.map(row => row.teamId === world.playerTeamId ? { ...row, teamName: playerSchoolName, teamShort: schoolShort(playerSchoolName) } : row)
    return { ...world, divisions: { ...world.divisions, [world.playerDivision]: { ...division, teams, standings } } }
  }
  const region = getRegion(regionId)
  const availableNames = (region ? regionalSchoolNames(region.id) : SCHOOL_NAMES).filter((name) => name !== playerSchoolName)
  let schoolIndex = 0
  const divisions = {} as Record<DivisionTier, Division>
  for (const tier of [1, 2, 3] as const) {
    const division = world.divisions[tier]
    const names = new Map<string, { name: string; short: string }>()
    const teams = division.teams.map((team) => {
      const isPlayerTeam = team.id === world.playerTeamId
      const name = isPlayerTeam ? playerSchoolName : availableNames[schoolIndex++] ?? `District School ${schoolIndex}`
      const short = isPlayerTeam ? team.short : schoolShort(name)
      names.set(team.id, { name, short })
      return { ...team, name, short, ...(region ? { regionId: region.id, countryId: region.countryId } : {}) }
    })
    const standings = division.standings.map((standing) => {
      const identity = names.get(standing.teamId)
      return identity ? { ...standing, teamName: identity.name, teamShort: identity.short } : standing
    })
    divisions[tier] = { ...division, teams, standings }
  }
  return { ...world, divisions, kind: 'school', regionId: region?.id }
}

/** Start a fresh season without moving schools between artificial pyramid
 * tiers. Team ratings and identities persist; tables and fixtures reset. */
export function resetSchoolLeagueSeason(world: LeagueWorld): LeagueWorld {
  const divisions = {} as Record<DivisionTier, Division>
  for (const tier of [1, 2, 3] as const) {
    const division = world.divisions[tier]
    divisions[tier] = {
      ...division,
      teams: division.teams.map(resetTeamScorers),
      standings: division.teams.map(initStanding),
      fixtures: generateFixtures(division.teams, 2),
    }
  }
  return { ...world, divisions, kind: 'school' }
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

export function sortStandings(standings: LeagueStanding[]): LeagueStanding[] {
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdA = a.goalsFor - a.goalsAgainst, gdB = b.goalsFor - b.goalsAgainst
    if (gdB !== gdA) return gdB - gdA
    return b.goalsFor - a.goalsFor
  })
}

// Record the player's own match result into their division.
export function recordPlayerMatchResult(world: LeagueWorld, opponentId: string, playerScored: number, opponentScored: number, playerWasHome: boolean, personalGoals = 0): LeagueWorld {
  const division = world.divisions[world.playerDivision]
  const homeId = playerWasHome ? world.playerTeamId : opponentId
  const awayId = playerWasHome ? opponentId : world.playerTeamId
  const hg = playerWasHome ? playerScored : opponentScored
  const ag = playerWasHome ? opponentScored : playerScored

  const fixtures = division.fixtures.map((f) =>
    !f.played && f.homeTeamId === homeId && f.awayTeamId === awayId
      ? { ...f, played: true, homeGoals: hg, awayGoals: ag }
      : f
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

// Batch-sim a specific fixture round (Tier 2/3 NPC depth — lightweight), skipping any
// fixture involving the player's own team (that's simmed via the real match engine).
// Takes an explicit round number rather than inferring "lowest unplayed round" — this
// matters because if the player misses their own fixture (e.g. injured on a matchday),
// that single fixture staying unplayed must never block the REST of the division from
// progressing through later rounds; an inferred-minimum approach would stall forever.
// includePlayerTeam: sim the player's own fixture too — used when the player
// missed their matchday (injury), so the season never carries a permanently
// unplayed fixture. Sims all rounds <= round (self-heals any backlog).
// P64 — which notable player scored a given goal. Weighted toward the
// striker (most goals should come from the front), but not exclusively —
// a midfielder or even a defender chips in sometimes, same spirit as the
// existing assist-picking weights in squad.ts. GK never scores.
export const SCORER_WEIGHT: Record<NotablePosition, number> = { ST: 3, CM: 1.2, CB: 0.4, GK: 0 }
export function pickScorer(players: NotablePlayer[]): NotablePlayer {
  const weights = players.map((p) => SCORER_WEIGHT[p.position])
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = rand() * total
  for (let i = 0; i < players.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return players[i]
  }
  return players[players.length - 1]
}
export function attributeGoals(team: Team, goals: number): Team {
  if (goals === 0 || team.notablePlayers.length === 0) return team
  const players = team.notablePlayers.map((p) => ({ ...p }))
  for (let i = 0; i < goals; i++) {
    const scorer = pickScorer(players)
    scorer.seasonGoals += 1
  }
  return { ...team, notablePlayers: players }
}

export function batchSimDivisionRound(division: Division, round: number, playerTeamId: string, includePlayerTeam = false): Division {
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
    // Attribute each goal to a real notable player, keeping teamById in
    // sync so a team that plays (and scores) more than once in the same
    // round accumulates correctly rather than each fixture overwriting it.
    teamById.set(home.id, attributeGoals(home, hg))
    teamById.set(away.id, attributeGoals(away, ag))
    return { ...f, played: true, homeGoals: hg, awayGoals: ag }
  })
  return { ...division, teams: division.teams.map((t) => teamById.get(t.id) ?? t), fixtures, standings }
}

// End-of-season promotion/relegation. Top 2 promoted, bottom 2 relegated.
// Phase 18: zones re-derived for 12-team divisions (top 2 promoted, bottom 2
// relegated — positions 0/1 and 10/11 of a 12-team table, was 8/9 when this
// was written for 10 teams).
// P64 — the real current top scorer in a division, excluding the player's
// own team. Used to make the "Golden Boot rival" a genuine reflection of
// the simulated world (a real named player on a real, findable team) instead
// of a synthetic name drifting on its own random schedule.
export function topScorerInDivision(division: Division, excludeTeamId: string): { name: string; club: string; goals: number } | null {
  const candidates = division.teams
    .filter((t) => t.id !== excludeTeamId)
    .flatMap((t) => t.notablePlayers.map((p) => ({ name: p.name, club: t.name, goals: p.seasonGoals })))
    .filter((p) => p.goals > 0)
  if (candidates.length === 0) return null
  return candidates.sort((a, b) => b.goals - a.goals)[0]
}

/** Builds a division from an explicit team list (not randomly generated) — fresh standings and fixtures for a new season, real team identities carried forward. */
function buildDivisionFromTeams(tier: DivisionTier, teams: Team[]): Division {
  return { tier, teams: teams.map(resetTeamScorers), standings: teams.map(initStanding), fixtures: generateFixtures(teams, 2) }
}

export function resetTeamScorers(team: Team): Team {
  return { ...team, notablePlayers: team.notablePlayers.map(p => ({ ...p, seasonGoals: 0 })) }
}

// P68 — the real, long-flagged gap from P64/66: every team other than the
// player's own got fully regenerated from scratch each season, regardless
// of how it actually finished — so "promotion/relegation" only ever
// existed for the one team the player controlled. This is the real fix:
// every one of the 36 teams across all 3 divisions is tracked by its
// actual final standing and moves (or stays) accordingly, carrying its
// real identity (name/colours/notablePlayers) forward into the new season.
// Team counts verified to balance exactly at every tier:
//   Div1 (12): 10 survive + 2 promoted from Div2 = 12
//   Div2 (12): 8 survive + 2 relegated from Div1 + 2 promoted from Div3 = 12
//   Div3 (12): 10 survive + 2 relegated from Div2 = 12
// The player's own team is no longer special-cased — it's just one of the
// 36 teams being moved/rescaled by this same generalized logic, which also
// means the P66 rescale-on-promotion fix now applies uniformly rather than
// only when the SPECIFIC team that moved happened to be the player's.
export function applyPromotionRelegation(world: LeagueWorld): LeagueWorld {
  const sorted1 = sortStandings(world.divisions[1].standings)
  const sorted2 = sortStandings(world.divisions[2].standings)
  const sorted3 = sortStandings(world.divisions[3].standings)

  const teamById = new Map<string, Team>()
  for (const div of Object.values(world.divisions)) for (const t of div.teams) teamById.set(t.id, t)
  const teamOf = (s: LeagueStanding) => teamById.get(s.teamId)!

  const div1Survivors = sorted1.slice(0, -2).map(teamOf)
  const div1Relegated = sorted1.slice(-2).map(teamOf)

  const div2Promoted = sorted2.slice(0, 2).map(teamOf)
  const div2Survivors = sorted2.slice(2, -2).map(teamOf)
  const div2Relegated = sorted2.slice(-2).map(teamOf)

  const div3Promoted = sorted3.slice(0, 2).map(teamOf)
  const div3Survivors = sorted3.slice(2).map(teamOf)

  // Same rescale fix as P66 — a team that changed tier gets a rating that
  // genuinely fits its new level, not whatever it happened to roll at
  // whatever tier it started this journey in.
  const promotedTo1 = div2Promoted.map((t) => rescaleTeamToRange(t, DIVISION_PRESTIGE_RANGE[1]))
  const relegatedTo2 = div1Relegated.map((t) => rescaleTeamToRange(t, DIVISION_PRESTIGE_RANGE[2]))
  const promotedTo2 = div3Promoted.map((t) => rescaleTeamToRange(t, DIVISION_PRESTIGE_RANGE[2]))
  const relegatedTo3 = div2Relegated.map((t) => rescaleTeamToRange(t, DIVISION_PRESTIGE_RANGE[3]))

  const newDiv1Teams = [...div1Survivors, ...promotedTo1]
  const newDiv2Teams = [...div2Survivors, ...relegatedTo2, ...promotedTo2]
  const newDiv3Teams = [...div3Survivors, ...relegatedTo3]

  const newPlayerDivision: DivisionTier =
    newDiv1Teams.some((t) => t.id === world.playerTeamId) ? 1
    : newDiv2Teams.some((t) => t.id === world.playerTeamId) ? 2
    : 3

  return {
    divisions: {
      1: buildDivisionFromTeams(1, newDiv1Teams),
      2: buildDivisionFromTeams(2, newDiv2Teams),
      3: buildDivisionFromTeams(3, newDiv3Teams),
    },
    playerDivision: newPlayerDivision,
    playerTeamId: world.playerTeamId,
    kind: 'sunday',
  }
}

/** Re-rolls a team's ratings/prestige to a real value within the given prestige range, keeping identity (id/name/colors/notablePlayers) unchanged. Shared with academy.ts, which has its own different tier→prestige table. */
export function rescaleTeamToRange(team: Team, [lo, hi]: [number, number]): Team {
  const prestige = lo + Math.floor(rand() * (hi - lo + 1))
  const base = Math.min(90, Math.max(20, prestige * 9 + 15))
  const jitter = () => Math.round(base + (rand() - 0.5) * 20)
  const clampR = (v: number) => Math.min(95, Math.max(15, v))
  return {
    ...team,
    prestige,
    ratings: { attack: clampR(jitter()), midfield: clampR(jitter()), defense: clampR(jitter()) },
  }
}

export function divisionLabel(tier: DivisionTier): string {
  return tier === 1 ? 'Division 1' : tier === 2 ? 'Division 2' : 'Division 3'
}
