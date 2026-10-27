import assert from 'node:assert/strict'
import { initSchoolLeagueWorld, batchSimDivisionRound, resetSchoolLeagueSeason, recordPlayerMatchResult, regionalCupField, sortStandings } from '../src/engine/league'
import { divisionTopScorers } from '../src/engine/leagueScorers'
import { leagueAwardLeaders, playerTotals } from '../src/engine/matchLedger'
import { initCupById, batchSimCupStage, advanceCupStage, captureCupMatches } from '../src/engine/cup'
import { initInternationalWorld, batchSimQualifyingRound, batchSimFinalsRound, recordNationResult, advanceInternationalStage, nationFixture, captureInternationalMatches } from '../src/engine/international'
import { SCHOOL_SEASON_SCHEDULE, INTERNATIONAL_QUALIFIER_WEEKS, INTERNATIONAL_FINALS_WEEKS, competitionForWeek, generateWeek, alignMatchDays, alignSchoolPostseason } from '../src/engine/calendar'
import { generateGazetteIssue } from '../src/engine/gazette'
import { schoolsForRegion } from '../src/engine/schools'
import { regionsFor } from '../src/engine/regions'
import type { Player } from '../src/types/player'

const region = regionsFor('rsa')[0]
const school = schoolsForRegion(region.id)[0]
let world = initSchoolLeagueWorld(school.name, region.id)
assert.deepEqual(SCHOOL_SEASON_SCHEDULE.schoolFriendlies, [4, 5, 29])
assert.equal(SCHOOL_SEASON_SCHEDULE.schoolLeague.length, 18)
assert.equal(new Set(SCHOOL_SEASON_SCHEDULE.schoolLeague).size, 18)
assert.equal(SCHOOL_SEASON_SCHEDULE.schoolCup.length, 5)
assert.equal(SCHOOL_SEASON_SCHEDULE.schoolDevelopment.length, 5)
assert.equal(SCHOOL_SEASON_SCHEDULE.nationalChampionship.length, 4)
assert.equal(INTERNATIONAL_QUALIFIER_WEEKS.length, 5)
assert.equal(INTERNATIONAL_FINALS_WEEKS.length, 3)
for (const week of [1, 2, 3, 30, 31, 36]) assert.equal(competitionForWeek(week, 'grassroots-season'), null)
assert.equal(competitionForWeek(29, 'grassroots-season')?.competitionId, 'schoolFriendlies')
const week28 = { currentWeek: generateWeek(28, 1, 'grassroots-season', false, 'school'), history: [] }
assert.equal(week28.currentWeek.events.filter(e => e.type === 'match').length, 1)
assert.equal(alignSchoolPostseason(week28, 'grassroots-season', 'school', true).currentWeek.events.filter(e => e.type === 'match' && e.day === 'thu').length, 1)
assert.equal(alignSchoolPostseason(week28, 'grassroots-season', 'school', false).currentWeek.events.filter(e => e.type === 'match').length, 0)
const doubleDuty = generateWeek(37, 1, 'grassroots-season', true, 'school')
assert.equal(doubleDuty.events.find(event => event.title === 'international duty')?.day, 'wed')
assert.equal(doubleDuty.events.find(event => event.title === 'matchday')?.day, 'sat')
assert.equal(alignMatchDays({ currentWeek: doubleDuty, history: [] }, 'grassroots-season', 'school', false).currentWeek.events.find(event => event.title === 'matchday')?.day, 'sat')

const playedWorld = initSchoolLeagueWorld(school.name, region.id)
const opponent = playedWorld.divisions[1].fixtures.find(f => f.homeTeamId === playedWorld.playerTeamId || f.awayTeamId === playedWorld.playerTeamId)!
const atHome = opponent.homeTeamId === playedWorld.playerTeamId
const rivalId = atHome ? opponent.awayTeamId : opponent.homeTeamId
const playerLine = { playerId: 'audit-user', name: 'Audit Player', position: 'ST', teamId: playedWorld.playerTeamId,
  minutes: 90, started: true, rating: 8, goals: 2, assists: 0, saves: 0, tackles: 0, interceptions: 0, keyPasses: 0, yellowCards: 0, redCards: 0 }
const played = recordPlayerMatchResult(playedWorld, rivalId, 3, 1, atHome, 2, playerLine, 1, 6)
const saved = played.divisions[1].matchRecords![0]
assert.equal(playerTotals([saved], playerLine.playerId, 'schoolLeague', 1).goals, 2)
assert.equal(saved.lines.filter(line => line.teamId === playedWorld.playerTeamId).reduce((n, line) => n + line.goals, 0), 3)
const issue = generateGazetteIssue(7, 1, { id: playerLine.playerId, name: playerLine.name, matchRatings: [8] } as Player,
  [], [], null, null, played.divisions[1], playerLine.playerId, 6)
assert.ok(issue.articles.filter(article => article.kind === 'league').every(article => !article.body.includes('Audit Player')))

for (let round = 1; round <= 18; round++) {
  const week = SCHOOL_SEASON_SCHEDULE.schoolLeague[round - 1]
  for (const tier of [1, 2, 3] as const) {
    world.divisions[tier] = batchSimDivisionRound(world.divisions[tier], round, world.playerTeamId, true, 'schoolLeague', 1, week)
  }
}
for (const division of Object.values(world.divisions)) {
  assert.equal(division.fixtures.filter(f => f.played).length, 90)
  assert.equal(division.matchRecords?.length, 90)
  assert.ok(division.standings.every(row => row.played === 18))
  for (const record of division.matchRecords ?? []) {
    assert.equal(record.lines.filter(line => line.teamId === record.homeTeamId).reduce((n, line) => n + line.goals, 0), record.homeGoals)
    assert.equal(record.lines.filter(line => line.teamId === record.awayTeamId).reduce((n, line) => n + line.goals, 0), record.awayGoals)
  }
}
const division = world.divisions[1]
const user = { id: 'audit-user', leagueGoals: [] } as unknown as Player
const leaders = divisionTopScorers(division, user, world.playerTeamId, 'schoolLeague')
assert.equal(leaders[0]?.goals, Math.max(...division.teams.flatMap(team => team.notablePlayers.map(named => named.seasonGoals))))
const top = leaders[0]
assert.equal(playerTotals(division.matchRecords ?? [], top.id).goals, top.goals)
assert.equal(leagueAwardLeaders(division.matchRecords ?? [], top.id).playerGoals, top.goals)
const field = regionalCupField(world)
assert.equal(field.length, 16)
assert.equal(new Set(field.map(team => team.id)).size, 16)
for (const district of Object.values(world.divisions)) for (const row of sortStandings(district.standings).slice(0, 3)) {
  assert.ok(field.some(team => team.id === row.teamId), 'district top three qualify for regional cup')
}
world = resetSchoolLeagueSeason(world)
assert.equal(world.matchHistory?.length, 270)
assert.equal(world.divisions[1].matchRecords?.length, 0)

const playerTeam = world.divisions[1].teams[0]
for (const [id, rounds] of [['schoolCup', 5], ['schoolDevelopment', 5], ['nationalChampionship', 4]] as const) {
  let cup = initCupById(id, playerTeam, Object.values(world.divisions).flatMap(d => d.teams))
  for (let round = 1; round <= rounds; round++) {
    cup = batchSimCupStage(cup, round, true)
    cup = advanceCupStage(captureCupMatches(cup, 1, id === 'nationalChampionship' ? 31 + round : 23 + round))
  }
  assert.equal(cup.stage, 'complete', `${id} should finish within its scheduled window`)
  assert.equal(cup.matchRecords?.length, id === 'schoolCup' ? 27 : 15, `${id} saves every real match result`)
  if (id === 'schoolCup') {
    const issue = generateGazetteIssue(25, 1, { id: playerLine.playerId, name: playerLine.name, matchRatings: [] } as Player,
      [], [], null, null, null, playerLine.playerId, 24, cup.matchRecords ?? [])
    const report = issue.articles.find(article => article.kind === 'league')
    assert.ok(report && (cup.matchRecords ?? []).some(record => record.week === 24 &&
      report.body.includes(`${record.homeGoals}–${record.awayGoals}`)), 'cup newspaper score comes from the saved match')
  }
  for (const record of cup.matchRecords ?? []) {
    assert.equal(record.lines.filter(line => line.teamId === record.homeTeamId).reduce((n, line) => n + line.goals, 0), record.homeGoals)
    assert.equal(record.lines.filter(line => line.teamId === record.awayTeamId).reduce((n, line) => n + line.goals, 0), record.awayGoals)
  }
}

let international = initInternationalWorld('South Africa', 'rsa')
const byId = new Map(international.qualifyingGroup.teams.map(team => [team.id, team]))
for (let round = 1; round <= 5; round++) {
  international = batchSimQualifyingRound(international, round, byId)
  const own = nationFixture(international)
  if (own?.round === round) international = recordNationResult(international,
    own.homeTeamId === international.nationTeamId ? own.awayTeamId : own.homeTeamId, 3, 0, own.homeTeamId === international.nationTeamId)
  international = advanceInternationalStage(captureInternationalMatches(international, 1, 36 + round))
}
assert.equal(international.qualifyingGroup.fixtures.filter(f => f.played).length, 10)
assert.equal(international.stage, 'finals')
for (let round = 1; round <= 3; round++) {
  international = batchSimFinalsRound(international)
  const own = nationFixture(international)
  if (own) international = recordNationResult(international,
    own.homeTeamId === international.nationTeamId ? own.awayTeamId : own.homeTeamId, 2, 0, own.homeTeamId === international.nationTeamId)
  international = advanceInternationalStage(captureInternationalMatches(international, 1, 41 + round))
}
assert.equal(international.stage, 'complete')
assert.equal(international.matchRecords?.length, 17)
console.log('Season ledger: 44-week slots, 18 home/away games, 270 recorded fixtures, cup and international advancement passed')
