import { rand } from './rng'
import { academyProfiles, academyTeam, EUROPEAN_ACADEMY_COUNTRIES } from './academyClubs'
import { generateKnockoutRound, generateRoundRobin, type GenericFixture } from './competitions'
import { initCupById, type CupWorld, type ContinentalQualifier } from './cup'
import { capturePlayedFixtures, type MatchRecord } from './matchLedger'
import type { LeagueStanding } from './league'
import type { Team } from './teams'

export const CONTINENTAL_QUALIFIER_WEEKS = [6, 9, 12, 15, 18, 21]
const row = (team: Team): LeagueStanding => ({ teamId: team.id, teamName: team.name, teamShort: team.short,
  played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 })
function score(attack: number, defense: number): number {
  const chance = Math.max(.2, 1.2 + (attack - defense) / 35)
  return Math.min(6, Math.floor(chance * rand() * 1.8 + (rand() < .25 ? 1 : 0)))
}
function pair(ids: string[], round: number): GenericFixture[] { return generateKnockoutRound(ids, round) }
const reverse = (fixtures: GenericFixture[], round: number): GenericFixture[] => fixtures.map(f => ({ ...f, id: crypto.randomUUID(), round, homeTeamId: f.awayTeamId,
  awayTeamId: f.homeTeamId, played: false, homeGoals: null, awayGoals: null, winnerTeamId: undefined }))

/** Fictional club identities from actual club inspirations; all entrants persist in the save. */
export function initContinentalQualifier(playerTeam: Team, route: 'senior' | 'domestic'): CupWorld {
  const candidates = EUROPEAN_ACADEMY_COUNTRIES.flatMap(country => academyProfiles(country).map(profile => academyTeam(country, profile)))
    .filter(team => team.academyClubKey !== playerTeam.academyClubKey)
    .sort((a, b) => b.prestige - a.prestige || a.name.localeCompare(b.name))
  const senior = candidates.slice(0, route === 'senior' ? 35 : 36)
  if (route === 'senior') senior.push(playerTeam)
  const selected = new Set(senior.map(team => team.academyClubKey))
  const domestic = candidates.filter(team => !selected.has(team.academyClubKey)).slice(0, route === 'domestic' ? 79 : 80)
  if (route === 'domestic') domestic.push(playerTeam)
  const teams = [...senior, ...domestic]
  const rounds = route === 'senior'
    ? Array.from({ length: 6 }, (_, index) => generateRoundRobin(senior.map(t => t.id)).filter(f => f.round === index + 1))
    : [pair(domestic.map(t => t.id), 1)]
  if (route === 'domestic') rounds.push(reverse(rounds[0], 2))
  const qualifier: ContinentalQualifier = { route, round: 0, rounds, standings: senior.map(row), advancing: [],
    seniorTeamIds: senior.map(t => t.id), domesticTeamIds: domestic.map(t => t.id) }
  return { competitionId: 'academyChampionsCup', label: 'Academy Champions Cup', playerTeamId: playerTeam.id,
    stage: 'qualifying', groups: [], groupFixtures: {}, groupStandings: {}, knockoutRounds: [], currentKnockoutRound: 0,
    playerEliminated: false, playerWonCup: false, teams, continentalRoute: route, qualifier, matchRecords: [] }
}

export function recordQualifierPlayerResult(world: CupWorld, opponentId: string, goals: number, conceded: number, home: boolean, season: number, week: number, playerMatch: MatchRecord): CupWorld {
  const q = world.qualifier
  if (!q || world.stage !== 'qualifying') return world
  const fixtures = q.rounds[q.round].map(f => f.played || !(f.homeTeamId === (home ? world.playerTeamId : opponentId) && f.awayTeamId === (home ? opponentId : world.playerTeamId))
    ? f : { ...f, played: true, homeGoals: home ? goals : conceded, awayGoals: home ? conceded : goals })
  return { ...world, qualifier: { ...q, rounds: q.rounds.map((round, i) => i === q.round ? fixtures : round) },
    matchRecords: capturePlayedFixtures(world.matchRecords ?? [], fixtures, world.teams, world.competitionId, season, week, playerMatch) }
}

function tieWinners(first: GenericFixture[], second: GenericFixture[], teams: Team[]): string[] {
  const byId = new Map(teams.map(t => [t.id, t]))
  return first.map((f, index) => {
    const returnLeg = second[index]
    const homeAggregate = (f.homeGoals ?? 0) + (returnLeg.awayGoals ?? 0)
    const awayAggregate = (f.awayGoals ?? 0) + (returnLeg.homeGoals ?? 0)
    if (homeAggregate !== awayAggregate) return homeAggregate > awayAggregate ? f.homeTeamId : f.awayTeamId
    const home = byId.get(f.homeTeamId)!, away = byId.get(f.awayTeamId)!
    return rand() < .5 + (home.ratings.midfield - away.ratings.midfield) / 180 ? home.id : away.id
  })
}
function standings(standing: LeagueStanding[], f: GenericFixture): LeagueStanding[] {
  const hg = f.homeGoals ?? 0, ag = f.awayGoals ?? 0
  return standing.map(s => {
    if (s.teamId !== f.homeTeamId && s.teamId !== f.awayTeamId) return s
    const own = s.teamId === f.homeTeamId ? hg : ag, against = s.teamId === f.homeTeamId ? ag : hg
    return { ...s, played: s.played + 1, won: s.won + Number(own > against), drawn: s.drawn + Number(own === against),
      lost: s.lost + Number(own < against), goalsFor: s.goalsFor + own, goalsAgainst: s.goalsAgainst + against,
      points: s.points + (own > against ? 3 : own === against ? 1 : 0) }
  })
}
export function advanceQualifierWeek(world: CupWorld, season: number, week: number, background = false): CupWorld {
  const q = world.qualifier
  if (world.stage !== 'qualifying' || !q || CONTINENTAL_QUALIFIER_WEEKS[q.round] !== week) return world
  const teams = new Map(world.teams.map(t => [t.id, t]))
  const played = q.rounds[q.round].map(f => {
    if (f.played) return f
    const home = teams.get(f.homeTeamId)!, away = teams.get(f.awayTeamId)!
    return { ...f, played: true, homeGoals: score(home.ratings.attack, away.ratings.defense), awayGoals: score(away.ratings.attack, home.ratings.defense) }
  })
  const rounds = q.rounds.map((r, i) => i === q.round ? played : r)
  const updatedStandings = q.route === 'senior' ? played.reduce(standings, q.standings) : q.standings
  const records = capturePlayedFixtures(world.matchRecords ?? [], played, world.teams, world.competitionId, season, week)
  let advancing = q.advancing
  if (q.route === 'domestic' && q.round % 2 === 1) {
    advancing = tieWinners(rounds[q.round - 1], played, world.teams)
    if (q.round < 5) {
      const next = pair(advancing, q.round + 2)
      rounds.push(next, reverse(next, q.round + 3))
    }
  }
  if (q.round < 5) return { ...world, qualifier: { ...q, rounds, round: q.round + 1, standings: updatedStandings, advancing }, matchRecords: records }
  // Both routes share the 22 + 10 draw. The other route plays its complete
  // qualification calendar in the background rather than teleporting entrants.
  const seniorIds = q.route === 'senior' ? [...updatedStandings].sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)).slice(0, 22).map(s => s.teamId) : []
  const qualified = q.route === 'senior' ? seniorIds : advancing
  if (background) return { ...world, stage: 'complete', qualifier: { ...q, rounds, round: 6, standings: updatedStandings, advancing: qualified }, matchRecords: records }
  const otherRoute = q.route === 'senior' ? 'domestic' : 'senior'
  const otherTeamIds = otherRoute === 'senior' ? q.seniorTeamIds : q.domesticTeamIds
  const otherRounds = otherRoute === 'senior'
    ? Array.from({ length: 6 }, (_, index) => generateRoundRobin(otherTeamIds).filter(f => f.round === index + 1))
    : [pair(otherTeamIds, 1)]
  if (otherRoute === 'domestic') otherRounds.push(reverse(otherRounds[0], 2))
  const otherQualifier: ContinentalQualifier = { ...q, route: otherRoute, round: 0, rounds: otherRounds, advancing: [],
    standings: q.seniorTeamIds.map(id => row(teams.get(id)!)) }
  const other: CupWorld = { ...world, playerTeamId: otherTeamIds[0], qualifier: otherQualifier, matchRecords: [] }
  let simulated = other
  for (const date of CONTINENTAL_QUALIFIER_WEEKS) simulated = advanceQualifierWeek(simulated, season, date, true)
  const ownQualified = qualified.map(id => teams.get(id)!).filter(Boolean)
  const opposite = (simulated.qualifier?.advancing ?? []).map(id => teams.get(id)!).filter(Boolean)
  const field = [...ownQualified, ...opposite]
  const playerQualified = ownQualified.some(t => t.id === world.playerTeamId)
  // Keep a full 32-team bracket even if the player went out in qualifying.
  const knockout = initCupById('academyChampionsCup', field[0] ?? world.teams[0], field.slice(1))
  return { ...knockout, playerTeamId: world.playerTeamId, playerEliminated: !playerQualified, continentalRoute: q.route,
    qualifier: { ...q, rounds, round: 6, standings: updatedStandings, advancing: qualified }, matchRecords: [...records, ...(simulated.matchRecords ?? [])] }
}
