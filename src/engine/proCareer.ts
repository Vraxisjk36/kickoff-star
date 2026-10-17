import type { Player } from '../types/player'
import type { LeagueWorld, Division, Fixture } from './league'
import { batchSimDivisionRound, recordPlayerMatchResult, resetSchoolLeagueSeason } from './league'
import { generateTeam, type Team } from './teams'
import type { MatchLine, MatchRecord } from './matchLedger'
import { netWage } from './agents'

export interface ProCareerState {
  world: LeagueWorld
  season: number
  week: number
  welcomed: boolean
  trainedWeek?: number
  /** Matchday resolution is persisted before advancing so a reload cannot replay a result. */
  resolvedWeek?: number
}

const CLUB_NAMES = ['North London Athletic', 'South London Blue', 'Mersey Red', 'West Midlands United', 'Brighton Coast', 'Yorkshire White', 'Severn City', 'East London Iron', 'Tyne Albion', 'Lancashire Rovers']

export function proTrialClubs(points: number): Team[] {
  const base = points >= 5 ? 5 : points >= 3 ? 4 : 3
  return [0, 1, 2, 3].map((index) => {
    const team = generateTeam(Math.min(6, base + (index === 3 ? 1 : 0)))
    const name = CLUB_NAMES[(index * 2 + Math.min(2, Math.floor(points / 3))) % CLUB_NAMES.length]
    return { ...team, name, short: name.split(' ').map(part => part[0]).join('').slice(0, 3).toUpperCase() }
  })
}

export function createProCareer(clubName: string, prestige = 4): ProCareerState {
  const own = generateTeam(Math.max(3, Math.min(6, prestige)))
  own.name = clubName
  own.short = clubName.split(' ').map(part => part[0]).join('').slice(0, 3).toUpperCase()
  const others = CLUB_NAMES.filter(name => name !== clubName).slice(0, 9).map((name, index) => {
    const team = generateTeam(3 + index % 4)
    return { ...team, name, short: name.split(' ').map(part => part[0]).join('').slice(0, 3).toUpperCase() }
  })
  const teams = [own, ...others]
  // Circle method, twice through the schedule with home and away reversed.
  const rounds: Fixture[] = []
  const ids = teams.map(team => team.id)
  for (let round = 0; round < ids.length - 1; round++) {
    for (let i = 0; i < ids.length / 2; i++) {
      const a = ids[i], b = ids[ids.length - 1 - i]
      for (const leg of [0, 1]) {
        const homeTeamId = leg ? b : a, awayTeamId = leg ? a : b
        rounds.push({ id: `pro:${round}:${i}:${leg}`, week: round + 1 + leg * (ids.length - 1), homeTeamId, awayTeamId, played: false, homeGoals: null, awayGoals: null })
      }
    }
    ids.splice(1, 0, ids.pop()!)
  }
  const standings = teams.map(team => ({ teamId: team.id, teamName: team.name, teamShort: team.short, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }))
  const division: Division = { tier: 1, teams, standings, fixtures: rounds, matchRecords: [] }
  return { world: { divisions: { 1: division, 2: { ...division, teams: [], standings: [], fixtures: [], matchRecords: [] }, 3: { ...division, teams: [], standings: [], fixtures: [], matchRecords: [] } }, playerDivision: 1, playerTeamId: own.id, kind: 'pro' }, season: 1, week: 1, welcomed: false }
}

export function proRound(week: number): number | null {
  return week >= 4 && week <= 38 && (week - 4) % 2 === 0 ? (week - 4) / 2 + 1 : null
}

export function proFixture(state: ProCareerState): Fixture | undefined {
  const round = proRound(state.week)
  return round === null ? undefined : state.world.divisions[1].fixtures.find(fixture => fixture.week === round && !fixture.played && (fixture.homeTeamId === state.world.playerTeamId || fixture.awayTeamId === state.world.playerTeamId))
}

export function resolveProMatch(state: ProCareerState, player: Player, result: {
  opponent: Team; home: boolean; scored: number; conceded: number; goals: number; assists: number; rating: number; energy: number; minutes: number; yellowCards: number; redCarded: boolean; injury?: { severity: string; weeksOut: number; description: string } | null
}): { state: ProCareerState; record: MatchRecord } {
  const line: MatchLine = { playerId: player.id, name: player.name, position: player.position, teamId: state.world.playerTeamId,
    minutes: result.minutes, started: player.squadRole === 'starting-xi', rating: result.rating, goals: result.goals, assists: result.assists,
    saves: 0, tackles: 0, interceptions: 0, keyPasses: 0, yellowCards: result.yellowCards, redCards: result.redCarded ? 1 : 0 }
  const world = recordPlayerMatchResult(state.world, result.opponent.id, result.scored, result.conceded, result.home, result.goals, line, state.season, state.week)
  const record = world.divisions[1].matchRecords!.at(-1)!
  return { state: { ...state, world, resolvedWeek: state.week }, record: { ...record, competitionId: 'proLeague', season: state.season, week: state.week } }
}

export function advanceProWeek(state: ProCareerState, player: Player): { state: ProCareerState; player: Player } {
  const round = proRound(state.week)
  let world = state.world
  if (round !== null) {
    world = { ...world, divisions: { ...world.divisions, 1: batchSimDivisionRound(world.divisions[1], round, world.playerTeamId, true, 'proLeague', state.season, state.week) } }
  }
  const nextWeek = state.week + 1
  const seasonEnd = nextWeek > 44
  if (seasonEnd) world = resetSchoolLeagueSeason(world)
  world.kind = 'pro'
  const wage = player.contract?.terms.weeklyWage ?? 1200
  const pay = netWage(wage, player.agentId)
  const injury = player.injury && player.injury.weeksRemaining > 1 ? { ...player.injury, weeksRemaining: player.injury.weeksRemaining - 1 } : null
  return {
    state: { ...state, world, season: seasonEnd ? state.season + 1 : state.season, week: seasonEnd ? 1 : nextWeek, resolvedWeek: undefined, trainedWeek: undefined },
    player: { ...player, injury, suspensionMatches: Math.max(0, (player.suspensionMatches ?? 0) - (round !== null ? 1 : 0)), totalWeeksElapsed: (player.totalWeeksElapsed ?? 0) + 1, money: (player.money ?? 0) + pay,
      careerEarnings: (player.careerEarnings ?? 0) + wage, fitness: { stamina: Math.min(100, player.fitness.stamina + 18) },
      seasonAppearances: seasonEnd ? 0 : player.seasonAppearances, seasonGoals: seasonEnd ? 0 : player.seasonGoals, seasonAssists: seasonEnd ? 0 : player.seasonAssists,
      careerClock: seasonEnd ? { ...player.careerClock, ageYears: player.careerClock.ageYears + 1 } : player.careerClock },
  }
}
