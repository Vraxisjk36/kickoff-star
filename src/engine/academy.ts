import { rand } from './rng'
import { generateTeam, type Team } from './teams'
import { attributeGoals, fixtureRecord, resetTeamScorers, type LeagueStanding, type Fixture, type Division, type DivisionTier } from './league'
import type { MatchLine, MatchRecord } from './matchLedger'
import { generateRoundRobin } from './competitions'
import { academyClub, academyProfileFor, academyProfiles, academyTeam, academyRatings } from './academyClubs'
import type { Player } from '../types/player'

// Age squads of one academy. England and Spain have distinct calendars;
// the remaining countries use a generic youth-development abstraction.

// These slots are age squads of the same club, not a promotion/relegation pyramid.
export type AcademyTier = 1 | 2

export interface AcademyWorld {
  divisions: Record<AcademyTier, Division>
  playerDivision: AcademyTier
  playerTeamId: string
  countryId?: string
  matchHistory?: MatchRecord[]
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

function initTier(tier: AcademyTier, playerTeam?: Team, countryId?: string): Division {
  const [lo, hi] = TIER_PRESTIGE_RANGE[tier]
  const teams: Team[] = []
  if (playerTeam) teams.push(playerTeam)
  const target = countryId === 'esp' ? 16 : 12
  if (countryId) {
    for (const profile of academyProfiles(countryId)) {
      if (teams.length >= target) break
      if (!teams.some(team => team.name === profile.name)) teams.push(academyTeam(countryId, profile, tier === 1 ? 'older' : 'younger'))
    }
  }
  while (teams.length < target) {
    const prestige = lo + Math.floor(rand() * (hi - lo + 1))
    teams.push(countryId ? academyClub(countryId, prestige, teams.map(team => team.name)) : generateTeam(prestige))
  }
  return { tier: tier as unknown as DivisionTier, teams, standings: teams.map(initStanding), fixtures: generateFixtures(teams, 2) }
}

// Both age groups belong to the signed club. A player's promotion changes
// squads; it never relegates an entire academy because of one season's table.
export function initAcademyWorld(academyClubName: string, prestige: number, countryId?: string): AcademyWorld {
  const profile = countryId ? academyProfileFor(countryId, academyClubName) : undefined
  const academyTeam: Team = profile && countryId ? academyTeamFor(profile, countryId, 'younger')
    : { ...generateTeam(prestige), name: academyClubName, short: academyClubName.slice(0, 3).toUpperCase(), countryId,
      ratings: countryId ? academyRatings(countryId, prestige) : generateTeam(prestige).ratings, academyRatingVersion: countryId ? 2 : undefined }
  const tier2 = initTier(2, academyTeam, countryId)
  const olderSquad = { ...academyTeam, id: crypto.randomUUID(), ratings: countryId ? academyRatings(countryId, academyTeam.prestige, 'older') : academyTeam.ratings }
  const tier1 = initTier(1, olderSquad, countryId)
  return { divisions: { 1: tier1, 2: tier2 }, playerDivision: 2, playerTeamId: academyTeam.id, countryId }
}

function academyTeamFor(profile: NonNullable<ReturnType<typeof academyProfileFor>>, countryId: string, ageGroup: 'younger' | 'older') {
  return academyTeam(countryId, profile, ageGroup)
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

export function recordAcademyMatchResult(world: AcademyWorld, opponentId: string, playerScored: number, opponentScored: number, playerWasHome: boolean, personalGoals = 0, playerLine?: MatchLine, season = 1, calendarWeek = 0): AcademyWorld {
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
  const fixture = division.fixtures.find(f => !f.played && f.homeTeamId === homeId && f.awayTeamId === awayId)
  const matchRecords = fixture ? [...(division.matchRecords ?? []), fixtureRecord(fixture, division.teams, teams, hg, ag, 'academyLeague', season, calendarWeek, playerLine)] : division.matchRecords
  return { ...world, divisions: { ...world.divisions, [world.playerDivision]: { ...division, fixtures, standings, teams, matchRecords } } }
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
export function batchSimAcademyRound(division: Division, round: number, playerTeamId: string, includePlayerTeam = false, season = 1, week = 0): Division {
  const teamById = new Map(division.teams.map((t) => [t.id, t]))
  let standings = division.standings
  const matchRecords = [...(division.matchRecords ?? [])]
  const fixtures = division.fixtures.map((f) => {
    if (f.played || f.week > round) return f
    if (!includePlayerTeam && (f.homeTeamId === playerTeamId || f.awayTeamId === playerTeamId)) return f
    const home = teamById.get(f.homeTeamId)
    const away = teamById.get(f.awayTeamId)
    if (!home || !away) return f
    const hg = simpleScore(home.ratings.attack, away.ratings.defense)
    const ag = simpleScore(away.ratings.attack, home.ratings.defense)
    standings = updateStandingsFromResult(standings, f.homeTeamId, f.awayTeamId, hg, ag)
    const creditedHome = attributeGoals(home, hg), creditedAway = attributeGoals(away, ag)
    teamById.set(home.id, creditedHome)
    teamById.set(away.id, creditedAway)
    matchRecords.push(fixtureRecord(f, [home, away], [creditedHome, creditedAway], hg, ag, 'academyLeague', season, week || f.week))
    return { ...f, played: true, homeGoals: hg, awayGoals: ag }
  })
  return { ...division, teams: division.teams.map((t) => teamById.get(t.id) ?? t), fixtures, standings, matchRecords }
}

/** Builds an academy tier from an explicit team list — fresh standings/fixtures for a new season, real identities carried forward. */
function buildTierFromTeams(tier: AcademyTier, teams: Team[]): Division {
  return { tier: tier as unknown as DivisionTier, teams: teams.map(resetTeamScorers), standings: teams.map(initStanding), fixtures: generateFixtures(teams, 2) }
}

export function applyAcademyPromotion(world: AcademyWorld, player?: Player): AcademyWorld {
  const matchHistory = [...(world.matchHistory ?? []), ...Object.values(world.divisions).flatMap(division => division.matchRecords ?? [])]
  const current = world.divisions[world.playerDivision].teams.find(t => t.id === world.playerTeamId)
  const otherTier: AcademyTier = world.playerDivision === 1 ? 2 : 1
  // A pre-migration save may not yet have the signed club in both age groups.
  const existingCounterpart = world.divisions[otherTier].teams.find(t => t.name === current?.name)
  const counterpart = existingCounterpart ?? (current ? { ...current, id: crypto.randomUUID() } : undefined)
  const appearances = player?.seasonAppearances ?? 0
  const ratings = player?.seasonRatings ?? []
  const average = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
  const ageNextSeason = (player?.careerClock.ageYears ?? 16) + 1
  const countryId = world.countryId ?? player?.academyCountryId ?? current?.countryId
  const ageOut = ageNextSeason >= (countryId === 'esp' ? 17 : 18)
  const earned = appearances >= 8 && average >= 6.4
  const newDivision: AcademyTier = world.playerDivision === 1 || counterpart && (earned || ageOut) ? 1 : 2
  const newSquad = (tier: AcademyTier): Team[] => {
    const teams = otherTier === tier && counterpart && !existingCounterpart
      ? [...world.divisions[tier].teams.slice(0, -1), counterpart] : [...world.divisions[tier].teams]
    const target = countryId === 'esp' ? 16 : 12
    while (teams.length < target) teams.push(academyClub(countryId ?? 'eng', TIER_PRESTIGE_RANGE[tier][0], teams.map(t => t.name)))
    return teams
  }
  return {
    divisions: {
      1: buildTierFromTeams(1, newSquad(1)),
      2: buildTierFromTeams(2, newSquad(2)),
    },
    playerDivision: newDivision,
    playerTeamId: newDivision !== world.playerDivision && counterpart ? counterpart.id : world.playerTeamId,
    countryId,
    matchHistory,
  }
}

export function academyDivisionLabel(tier: AcademyTier, countryId?: string): string {
  if (countryId === 'esp') return tier === 1 ? 'División de Honor Juvenil · U19' : 'Academy U17 Development'
  if (countryId === 'eng') return tier === 1 ? 'Premier League 2 · U21' : 'U18 Premier League'
  return tier === 1 ? 'U21 Development League' : 'U18 Academy League'
}
