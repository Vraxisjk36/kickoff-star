import assert from 'node:assert/strict'
import { advanceWorldLeagues, publishSchoolPowerRanking, simulateSchoolRivalries } from '../src/engine/worldLeagues'
import { schoolRival } from '../src/engine/friendlies'
import { generateGazetteIssue } from '../src/engine/gazette'
import { SCHOOL_SEASON_SCHEDULE } from '../src/engine/calendar'
import type { Player } from '../src/types/player'

let world = advanceWorldLeagues(undefined, 1, 8, 'rsa', true)
for (const division of Object.values(world.divisions)) for (const team of division.teams) {
  const rival = schoolRival(division, team.id)
  assert(rival && rival.id !== team.id)
  assert.equal(schoolRival(division, rival.id)?.id, team.id)
}
world = publishSchoolPowerRanking(world, 8)
assert.equal(world.schoolRankings?.[0]?.rows.length, Object.values(world.divisions).reduce((sum, division) => sum + division.teams.length, 0))
const first = world.schoolRankings![0]
world = advanceWorldLeagues(world, 1, 12, 'rsa', true)
world = publishSchoolPowerRanking(world, 12)
assert.equal(world.schoolRankings?.length, 2)
assert(world.schoolRankings![1].rows.some(row => row.previousRank !== undefined))
const player = { id: 'audit', name: 'Sam Player', position: 'ST', careerClock: { phase: 'grassroots-season' } } as Player
const issue = generateGazetteIssue(13, 1, player, [], [], null, null, null, player.id, 12,
  [], undefined, undefined, undefined, undefined, undefined, world)
const feature = issue.articles.find(article => article.headline.startsWith('GAME OF THE WEEK:'))
assert.equal(feature?.detail?.split('\n\n').length, 4)
assert(issue.schoolRanking?.rows.length)
const match = Object.values(world.divisions).flatMap(division => division.matchRecords ?? []).find(record =>
  feature?.headline.includes(`${record.homeTeamName.toUpperCase()} ${record.homeGoals}–${record.awayGoals} ${record.awayTeamName.toUpperCase()}`))
assert(match)
for (const line of match.lines.filter(line => line.goals > 0)) assert(feature!.detail!.includes(line.name))
world = advanceWorldLeagues(world, 1, 29, 'rsa', true)
assert.equal(world.rivalryRecords?.length, Object.values(world.divisions).length * 5)
const replay = advanceWorldLeagues(world, 1, 29, 'rsa', true)
assert.equal(replay.rivalryRecords?.length, world.rivalryRecords?.length)
const local = Object.values(world.divisions)[0]
const localDerbies = simulateSchoolRivalries([], local, 1, local.teams[0].id)
assert.equal(localDerbies.length, 4)
assert(localDerbies.every(record => record.homeTeamId !== local.teams[0].id && record.awayTeamId !== local.teams[0].id))
assert.deepEqual(SCHOOL_SEASON_SCHEDULE.schoolFriendlies, [4, 5, 29])
console.log('Rival pairs, monthly movement, four-paragraph recorded match report, and one annual derby per world school passed.')
