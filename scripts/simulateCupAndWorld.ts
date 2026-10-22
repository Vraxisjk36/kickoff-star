import assert from 'node:assert/strict'
import { reseed, rand } from '../src/engine/rng'
import { NATIONS } from '../src/engine/nations'
import { academyProfiles, academyTeam } from '../src/engine/academyClubs'
import { initContinentalQualifier, advanceQualifierWeek, recordQualifierPlayerResult, CONTINENTAL_QUALIFIER_WEEKS } from '../src/engine/continentalQualifier'
import { playerCupFixture, batchSimCupStage, advanceCupStage, captureCupMatches } from '../src/engine/cup'
import { advanceWorldLeagues, worldLeagueChampions, worldLeagueLeaders } from '../src/engine/worldLeagues'
import { advanceWorldSchools, publishSchoolsRanking, schoolsAwards } from '../src/engine/worldSchools'
import { generateGazetteIssue } from '../src/engine/gazette'
import type { Player } from '../src/types/player'
import type { MatchRecord } from '../src/engine/matchLedger'

const failures: string[] = []
const checks = { cup: 0, world: 0, ranking: 0, gazette: 0, award: 0 }
const cupOutcomes = { senior: { entrants: 100, manualMatches: 0, qualified: 0, champions: 0 }, domestic: { entrants: 100, manualMatches: 0, qualified: 0, champions: 0 } }
function check(condition: unknown, description: string, group: keyof typeof checks) {
  checks[group]++
  if (!condition) failures.push(description)
}
function safe(run: () => void, label: string) { try { run() } catch (error) { failures.push(`${label}: ${String(error)}`) } }

for (const route of ['senior', 'domestic'] as const) for (let n = 0; n < 100; n++) safe(() => {
  reseed(7000 + n * 83 + (route === 'domestic' ? 1 : 0))
  const country = ['eng', 'esp', 'fra', 'ger', 'ita', 'por', 'ned', 'bel', 'sco', 'aut', 'sui', 'tur'][n % 12]
  const team = academyTeam(country, academyProfiles(country)[n % academyProfiles(country).length])
  let world = initContinentalQualifier(team, route)
  const own = cupOutcomes[route]
  for (const week of CONTINENTAL_QUALIFIER_WEEKS) {
    const fixture = playerCupFixture(world)
    if (fixture) {
      const home = fixture.homeTeamId === team.id
      const opponentId = home ? fixture.awayTeamId : fixture.homeTeamId
      const scored = Math.floor(rand() * 4), conceded = Math.floor(rand() * 4)
      const record: MatchRecord = { id: fixture.id, competitionId: 'academyChampionsCup', season: 2, week,
        homeTeamId: fixture.homeTeamId, awayTeamId: fixture.awayTeamId,
        homeTeamName: world.teams.find(t => t.id === fixture.homeTeamId)!.name,
        awayTeamName: world.teams.find(t => t.id === fixture.awayTeamId)!.name,
        homeGoals: home ? scored : conceded, awayGoals: home ? conceded : scored, lines: [] }
      world = recordQualifierPlayerResult(world, opponentId, scored, conceded, home, 2, week, record)
      own.manualMatches++
      check(!!world.qualifier?.rounds[world.qualifier.round]?.find(f => f.id === fixture.id && f.played), `${route} #${n} W${week} manual result missing`, 'cup')
    }
    world = advanceQualifierWeek(world, 2, week)
    if (route === 'senior') check(world.qualifier?.standings.every(row => row.played === world.qualifier?.round), `${route} #${n} W${week} table played count`, 'cup')
    else if (week % 6 === 3) { // second legs on weeks 9, 15, 21
      const q = world.qualifier!
      check(q.advancing.length === 80 / 2 ** ((week - 9) / 6 + 1), `${route} #${n} W${week} aggregate qualifiers`, 'cup')
      const legIndex = ((week - 9) / 6) * 2
      q.rounds[legIndex].forEach((first, i) => {
        const second = q.rounds[legIndex + 1][i]
        const homeAggregate = (first.homeGoals ?? 0) + (second.awayGoals ?? 0)
        const awayAggregate = (first.awayGoals ?? 0) + (second.homeGoals ?? 0)
        if (homeAggregate !== awayAggregate) check(q.advancing[i] === (homeAggregate > awayAggregate ? first.homeTeamId : first.awayTeamId),
          `${route} #${n} W${week} wrong aggregate winner in tie ${i}`, 'cup')
      })
    }
  }
  check(world.stage === 'knockout' && world.teams.length === 32 && world.knockoutRounds[0].length === 16,
    `${route} #${n} bad knockout draw`, 'cup')
  check(new Set(world.teams.map(t => t.academyClubKey)).size === 32, `${route} #${n} duplicate knockout club`, 'cup')
  check(world.matchRecords?.length === 248 && new Set(world.matchRecords.map(r => r.id)).size === 248, `${route} #${n} incomplete qualifying ledger`, 'cup')
  check(world.qualifier!.rounds.flat().filter(f => f.played).every(f => world.matchRecords?.some(record => record.id === f.id && record.homeGoals === f.homeGoals && record.awayGoals === f.awayGoals)), `${route} #${n} wrong saved score`, 'cup')
  if (!world.playerEliminated) own.qualified++
  for (let round = 1; round <= 5; round++) {
    world = batchSimCupStage(world, round, true)
    world = captureCupMatches(world, 2, [25, 28, 34, 39, 43][round - 1])
    world = advanceCupStage(world)
  }
  check(world.stage === 'complete' && world.matchRecords?.length === 279, `${route} #${n} knockout failed to finish`, 'cup')
  if (world.playerWonCup) own.champions++
}, `${route} #${n}`)

const worldOutcomes = { seasons: 50, countries: NATIONS.length, fixtures: 0, players: 0, rankingIssues: 0, awards: 0 }
let world = undefined as ReturnType<typeof advanceWorldLeagues> | undefined
const player = { id: 'world-audit-user', name: 'World Audit', nationality: 'eng', regionId: 'eng-london', schoolId: 'audit', position: 'ST',
  careerClock: { phase: 'grassroots-season', ageYears: 16 }, matchLedger: [], matchRatings: [] } as unknown as Player
for (let season = 1; season <= 50; season++) safe(() => {
  reseed(40000 + season * 79)
  let rankings = advanceWorldSchools(undefined, season, 1, true)
  for (let week = 6; week <= 23; week++) {
    world = advanceWorldLeagues(world, season, week)
    if ([8, 12, 16, 20].includes(week)) {
      const rows = worldLeagueLeaders(world, week)
      rankings = publishSchoolsRanking(rankings, player, week, rows)
      const ranking = rankings.rankings.at(-1)!
      check(ranking.rows.length === 5 && ranking.rows[0].id === rows[0].id, `Y${season} W${week} ranking order`, 'ranking')
      const leader = ranking.rows[0]
      const savedGoals = Object.values(world.divisions).flatMap(d => d.matchRecords ?? []).filter(r => r.week <= week)
        .flatMap(r => r.lines).filter(line => line.playerId === leader.id).reduce((sum, line) => sum + line.goals, 0)
      check(leader.goals === savedGoals, `Y${season} W${week} ranking goals`, 'ranking')
      const issue = generateGazetteIssue(week + 1, season, player, [], [], null, null, null, player.id, week, [], ranking, rows.slice().sort((a,b) => b.goals - a.goals).slice(0,10))
      check(issue.articles.some(article => article.kind === 'world' && article.body.includes(`${leader.goals} goals`) && article.body.includes(`${leader.points} season points`)), `Y${season} W${week} Gazette mismatch`, 'gazette')
      worldOutcomes.rankingIssues++
    }
  }
  world = worldLeagueChampions(world!)
  const records = Object.values(world.divisions).flatMap(d => d.matchRecords ?? [])
  worldOutcomes.fixtures += records.length
  check(records.length === NATIONS.length * 90, `Y${season} fixture count`, 'world')
  check(new Set(records.map(record => record.id)).size === records.length, `Y${season} duplicate fixture IDs`, 'world')
  for (const [country, division] of Object.entries(world.divisions)) {
    check(division.fixtures.every(f => f.played) && division.standings.every(row => row.played === 18), `Y${season} ${country} incomplete table`, 'world')
    const byTeam = new Map(division.standings.map(row => [row.teamId, { played: 0, gf: 0, ga: 0, points: 0, goals: 0 }]))
    for (const record of division.matchRecords ?? []) {
      for (const [id, scored, conceded] of [[record.homeTeamId, record.homeGoals, record.awayGoals], [record.awayTeamId, record.awayGoals, record.homeGoals]] as const) {
        const row = byTeam.get(id)!
        row.played++; row.gf += scored; row.ga += conceded; row.points += scored > conceded ? 3 : scored === conceded ? 1 : 0
        const lines = record.lines.filter(line => line.teamId === id)
        check(lines.reduce((sum, line) => sum + line.goals, 0) === scored, `Y${season} ${country} missing goal credits`, 'world')
        row.goals += lines.reduce((sum, line) => sum + line.goals, 0)
      }
    }
    for (const standing of division.standings) {
      const totals = byTeam.get(standing.teamId)!
      check(standing.played === totals.played && standing.goalsFor === totals.gf && standing.goalsAgainst === totals.ga && standing.points === totals.points && totals.goals === totals.gf,
        `Y${season} ${country} table disagrees with ledger`, 'world')
    }
  }
  const rows = worldLeagueLeaders(world, 23)
  const award = schoolsAwards(rankings, player, [], [], rows)
  const boot = [...rows].sort((a,b) => b.goals - a.goals || a.id.localeCompare(b.id))[0]
  check(award.winners.find(a => a.name === 'Golden Boot')?.winnerId === boot.id, `Y${season} Golden Boot disagrees`, 'award')
  check(award.winners[0]?.winnerId === rows[0]?.id, `Y${season} World Player disagrees`, 'award')
  check(world.champions.filter(champion => champion.season === season).length === NATIONS.length, `Y${season} missing champions`, 'award')
  worldOutcomes.players += rows.length
  worldOutcomes.awards++
}, `world Y${season}`)

console.log(JSON.stringify({ cupOutcomes, worldOutcomes, checks, failures: failures.slice(0, 30), failureCount: failures.length }, null, 2))
if (failures.length) process.exitCode = 1
