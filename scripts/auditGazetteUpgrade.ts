import assert from 'node:assert/strict'
import { advanceWorldLeagues } from '../src/engine/worldLeagues'
import { competitionOpening, generateGazetteIssue } from '../src/engine/gazette'
import type { Player } from '../src/types/player'

let world = advanceWorldLeagues(undefined, 1, 3, 'rsa', true)
assert.equal(world.divisions.eng.standings[0].played, 0)
world = advanceWorldLeagues(world, 1, 8, 'rsa', true)
assert.ok(world.divisions.eng.standings.every(row => row.played === 3), 'other countries play three rounds alongside the home league')
assert.equal(world.divisions.eng.matchRecords?.length, 15)
assert.ok(world.divisions.eng.matchRecords?.flatMap(record => record.lines).some(line => line.goals > 0), 'named scorers have recorded goals')
const replay = advanceWorldLeagues(world, 1, 8, 'rsa', true)
assert.equal(replay.divisions.eng.matchRecords?.length, 15, 'loading or catching up cannot duplicate fixtures')

const player = { id: 'audit', name: 'Joe Kazadi', position: 'ST', careerClock: { phase: 'grassroots-season' },
  gazetteHonours: [{ season: 1, competitionId: 'schoolLeague', winner: 'Pretoria High' }] } as Player
const first = competitionOpening(player, 6, 1, null)
assert.ok(first?.detail?.includes('No confirmed champion'), 'first year cannot invent historical winners')
const second = competitionOpening(player, 6, 2, null)
assert.ok(second?.detail?.includes('Season 1 — Pretoria High'), 'subsequent year names the recorded champion')
const issue = generateGazetteIssue(9, 1, player, [], [], null, null, null, player.id, 8,
  [], undefined, undefined, undefined, undefined, undefined, world)
assert.ok(issue.articles.some(article => article.headline.startsWith('GAME OF THE WEEK:') && article.detail?.split('\n\n').length === 4),
  'world fixtures produce a four-paragraph match report')
const openingIssue = generateGazetteIssue(4, 1, player, [], [], null, null, world.divisions.eng, player.id, 3,
  [], undefined, undefined, undefined, undefined, undefined, world)
assert.ok(openingIssue.articles.length >= 5, 'opening issue has a full season guide')
assert.ok(openingIssue.articles.some(article => article.body.includes('Joe Kazadi')), 'the player is named in the story')
console.log('Gazette upgrade: world catch-up, named goals, idempotence, honest champion history, and recorded long stories passed.')
