import assert from 'node:assert/strict'
import { advanceWorldLeagues } from '../src/engine/worldLeagues'
import { advanceWorldNews } from '../src/engine/worldNews'
import { generateGazetteIssue } from '../src/engine/gazette'
import type { Player } from '../src/types/player'

const player = { id: 'you', name: 'You', nationality: 'rsa', careerClock: { phase: 'grassroots-season', ageYears: 16 }, matchRatings: [] } as unknown as Player
let world = advanceWorldLeagues(undefined, 1, 1, 'rsa', true)
const storyArticles = []
const dates = new Set([9, 13, 18, 16, 20, 24, 27, 31, 37])
for (let week = 2; week <= 37; week++) {
  world = advanceWorldLeagues(world, 1, week, 'rsa', true)
  const before = structuredClone(world)
  const news = advanceWorldNews(world, week)
  world = news.world
  if (dates.has(week)) {
    assert.ok(news.article, `week ${week} has a news chapter`)
    assert.ok(!/\bYou\b/.test(news.article!.body), 'world story does not invent user involvement')
    const issue = generateGazetteIssue(week + 1, 1, player, [], [], null, null, null, player.id, week, [], undefined, undefined, undefined, undefined, news.article)
    assert.ok(issue.articles.some(article => article.headline === news.article!.headline))
    storyArticles.push(issue.articles[0])
    assert.equal(advanceWorldNews(world, week).article, undefined, 'story does not publish twice')
    if (week === 9 || week === 16) {
      const kind = week === 9 ? 'donation' : 'eligibility'
      const story = world.stories!.find(entry => entry.kind === kind)!
      const old = before.divisions[story.countryId].teams.find(team => team.id === story.teamId)!
      const current = world.divisions[story.countryId].teams.find(team => team.id === story.teamId)!
      assert.equal(current.ratings.attack - old.ratings.attack, week === 9 ? 2 : -2)
    }
  } else assert.equal(news.article, undefined)
}
assert.equal(storyArticles.length, 9)
assert.equal(world.stories?.length, 3)
assert.ok(world.stories?.every(story => story.issuedWeeks?.length === 3))
const sponsor = world.stories!.find(story => story.kind === 'sponsor')!
assert.ok(world.leagueNames?.[sponsor.countryId]?.includes(sponsor.sponsor!))
const next = advanceWorldLeagues(world, 2, 6, 'rsa', true)
assert.equal(next.leagueNames?.[sponsor.countryId], world.leagueNames?.[sponsor.countryId])
assert.ok(next.stories?.some(story => story.id === sponsor.id))
console.log('Gazette: three saved three-part world stories, real table claims, rating effects, sponsor name, idempotence, and season carry passed.')
