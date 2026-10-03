import assert from 'node:assert/strict'
import type { Player } from '../src/types/player'
import type { MatchRecord } from '../src/engine/matchLedger'
import { advanceWorldSchools, publishSchoolsRanking, schoolsLeaders, schoolsAwards, academyLeaders, academySeasonAwards, schoolStarsForSeason } from '../src/engine/worldSchools'
import { generateGazetteIssue } from '../src/engine/gazette'
import { competitionPrestige, scoutingPrestigeMultiplier } from '../src/engine/competitionCareer'
import { initScoutingState, updateReputation } from '../src/engine/scouting'

assert.equal(competitionPrestige('schoolLeague', 'eng'), 31)
assert.equal(competitionPrestige('schoolLeague', 'rsa'), 20)
assert.ok(competitionPrestige('academyLeague', 'eng') > competitionPrestige('academyLeague', 'rsa'))
assert.equal(competitionPrestige('international', 'eng'), competitionPrestige('international', 'rsa'))
const performance = { rating: 8.2, position: 'ST', goals: 1, assists: 0, tackles: 0, interceptions: 0, headers: 0, keyPasses: 0, saves: 0, cleanSheet: false }
const gain = (country: string) => updateReputation(initScoutingState(), { ...performance, competitionPrestigeMultiplier: scoutingPrestigeMultiplier('schoolLeague', country) }).reputation
assert.ok(gain('eng') > gain('rsa'))

const player = { id: 'you', name: 'Test Forward', nationality: 'rsa', regionId: 'rsa-gauteng', schoolId: 'school-test', position: 'ST',
  careerClock: { phase: 'grassroots-season', ageYears: 16 }, matchLedger: [], matchRatings: [] } as unknown as Player
let world = advanceWorldSchools(undefined, 1, 8)
world = publishSchoolsRanking(world, player, 8)
assert.equal(world.rankings.length, 1)
const first = world.rankings[0]
assert.equal(first.rows.length, 5)
assert.ok(first.rows.every(row => row.appearances > 0))
const jordan = schoolsLeaders(world, player, 8).find(row => row.id === 'eng-baxter')!
assert.equal(jordan.goals, world.matches.filter(row => row.starId === jordan.id && row.week <= 8).reduce((sum, match) => sum + match.goals, 0))
assert.equal(jordan.monthGoals, world.matches.filter(row => row.starId === jordan.id && row.week > 4 && row.week <= 8).reduce((sum, match) => sum + match.goals, 0))
world = publishSchoolsRanking(advanceWorldSchools(world, 1, 12), player, 12)
assert.equal(world.rankings.length, 2)
assert.ok(world.rankings[1].rows.some(row => row.previousRank !== undefined))
const row = world.rankings[1].rows[0]
const issue = generateGazetteIssue(13, 1, player, [], [], null, null, null, player.id, 12, [], world.rankings[1], schoolsLeaders(world, player, 12))
assert.ok(issue.articles.some(article => article.kind === 'world' && article.detail?.includes(`${row.goals} goals`)))
world = publishSchoolsRanking(advanceWorldSchools(world, 1, 32), player, 32)
assert.equal(publishSchoolsRanking(world, player, 36).rankings.length, 3)

const match: MatchRecord = { id: 'local-1', competitionId: 'schoolLeague', season: 1, week: 6, homeTeamId: 'home', awayTeamId: 'away',
  homeTeamName: 'Home High', awayTeamName: 'Away High', homeGoals: 2, awayGoals: 0, lines: [
    { playerId: 'you', name: 'Test Forward', position: 'ST', teamId: 'home', minutes: 90, started: true, rating: 8, goals: 2, assists: 0, saves: 0, tackles: 0, interceptions: 0, keyPasses: 0, yellowCards: 0, redCards: 0 },
    { playerId: 'keeper', name: 'Test Keeper', position: 'GK', teamId: 'home', minutes: 90, started: true, rating: 7, goals: 0, assists: 0, saves: 3, tackles: 0, interceptions: 0, keyPasses: 0, yellowCards: 0, redCards: 0 },
  ] }
const three = [6, 7, 8].map((week, index) => ({ ...match, id: `local-${index}`, week }))
const awarded = schoolsAwards(advanceWorldSchools(world, 1, 44), { ...player, matchLedger: three }, three, three.map(record => ({ ...record, competitionId: 'schoolCup' })))
assert.equal(awarded.scope, 'world-schools')
assert.equal(awarded.teamOfYear.length, 11)
assert.equal(awarded.local.find(entry => entry.name === 'Local Top Scorer')?.winnerId, 'you')
assert.equal(awarded.local.find(entry => entry.name === 'Local Top Scorer')?.value, '6 goals')
assert.equal(awarded.regional.find(entry => entry.name === 'Regional Top Scorer')?.winnerId, 'you')
assert.notEqual(schoolStarsForSeason(3)[0].name, schoolStarsForSeason(1)[0].name)
assert.ok(schoolStarsForSeason(3).every(star => star.age <= 18))
const academyRecords = three.map(record => ({ ...record, competitionId: 'academyLeague' }))
assert.equal(academyLeaders(academyRecords, 1, 8, 'eng').find(entry => entry.id === 'you')?.goals, 6)
assert.equal(academySeasonAwards(academyRecords, [], 1, 'eng').winners.find(entry => entry.name === 'Academy Top Scorer')?.winnerId, 'you')
console.log('Country prestige, scouting gains, recorded world rankings, Gazette claims, school and academy awards passed.')
