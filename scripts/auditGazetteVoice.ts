import assert from 'node:assert/strict'
import { advanceWorldLeagues } from '../src/engine/worldLeagues'
import { generateGazetteIssue, playerMatchArticle, presentGazetteIssue, type GazetteIssue } from '../src/engine/gazette'
import type { Player } from '../src/types/player'

const world = advanceWorldLeagues(undefined, 1, 14)
const records = Object.values(world.divisions).flatMap(division => division.matchRecords ?? [])
const fixture = records.find(record => record.lines.some(line => line.goals >= 3))!
assert(fixture, 'world simulation should produce a genuine hat-trick')
const scorer = fixture.lines.find(line => line.goals >= 3)!
const player = { id: scorer.playerId, name: scorer.name, position: scorer.position, matchLedger: [fixture], worldLeagues: world,
  careerClock: { phase: 'grassroots-season' }, matchRatings: [], seasonGoals: scorer.goals } as Player
const division = Object.values(world.divisions).find(entry => entry.teams.some(team => team.id === scorer.teamId))!
const article = playerMatchArticle(fixture, player, [fixture], division)!
assert.match(article.headline, /HAT-TRICK HERO/)
assert(article.body.includes(`${scorer.goals} goals in 1 appearances`) || article.body.includes(`${scorer.goals} goals in 1 appearance`))
assert.equal(article.detail?.split('\n\n').length, 4)
assert(!/saved match|season record|league tracker|stats will/.test(article.detail ?? ''))
const issue = generateGazetteIssue(fixture.week + 1, 1, player, [], [], null, null, division, player.id, fixture.week,
  [], undefined, undefined, undefined, undefined, undefined, world)
assert.equal(issue.masthead, article.headline)
assert.equal(issue.articles[0].headline, article.headline)
const old = { id: 'old', weekNumber: fixture.week + 1, seasonYear: 1, masthead: `${scorer.name.toUpperCase()} HITS TWO`,
  articles: [{ kind: 'world', headline: `${scorer.name.toUpperCase()} HITS TWO`, body: 'The result enters the season record.' },
    { kind: 'recap', headline: 'WIN AGAINST OPPONENT', body: 'Final score.' },
    { kind: 'preview', headline: 'ROUTINE FIXTURE AHEAD', body: 'the league continues against Camden High. Business as usual.' }] } as GazetteIssue
const upgraded = presentGazetteIssue(old, player, division)
assert.match(upgraded.masthead, /HAT-TRICK HERO/)
assert(upgraded.articles.some(entry => entry.headline === article.headline))
assert(upgraded.articles.some(entry => entry.headline === 'CAMDEN HIGH UP NEXT'))
console.log('Gazette voice: real hat-trick, four paragraphs, lead headline and old edition repair passed.')
