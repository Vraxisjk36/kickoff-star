import assert from 'node:assert/strict'
import { createProWorld } from '../src/engine/proWorldFactory'
import { advanceProWorldTo } from '../src/engine/proWorldSimulation'
import { PRO_LEAGUE_PLAN } from '../src/engine/proLeagueRegistry'
import { advanceProDay, beginProTrial } from '../src/engine/proCareer'
import { nationalCallupFixture } from '../src/engine/proTournaments'

const initial = createProWorld(87, '2026-01-01')
const draw = advanceProWorldTo(initial, '2026-09-01')
assert.equal(Object.values(draw.competitions).filter(comp => comp.kind === 'domestic-cup').length, 93)
assert.equal(Object.values(draw.competitions).filter(comp => comp.kind === 'continental-club').length, 13)
assert.equal(Object.values(draw.competitions).filter(comp => comp.kind === 'national-team').length, 3)
assert.equal(draw.competitions['world-national'].entrantIds.length, 48)
assert.equal(draw.competitions['continental-uefa'].entrantIds.length, 36)
assert.equal(draw.competitions['union-uefa'].entrantIds.length, 36)
assert.equal(draw.competitions['conference-uefa'].entrantIds.length, 36)
assert.equal(draw.competitions['nations-uefa'].entrantIds.length, 55)
assert.equal(draw.competitions['continental-caf'].entrantIds.length, 16)
assert.equal(draw.competitions['continental-conmebol'].entrantIds.length, 32)
assert.equal(draw.competitions['continental-afc'].entrantIds.length, 24)
assert.equal(Object.values(draw.fixtures).filter(item => item.competitionId === 'continental-uefa').length, 144)
assert.equal(Object.values(draw.fixtures).filter(item => item.competitionId === 'continental-caf').length, 48)
assert.equal(Object.values(draw.fixtures).filter(item => item.competitionId === 'conference-uefa').length, 108)
assert.equal(Object.values(draw.fixtures).filter(item => item.competitionId === 'continental-conmebol').length, 96)
for (const competition of Object.values(draw.competitions).filter(comp => comp.kind === 'continental-club')) {
  assert.equal(new Set(competition.entrantIds).size, competition.entrantIds.length, `duplicate qualifier for ${competition.id}`)
  for (const entrant of competition.entrantIds) assert.equal(draw.associations[draw.clubs[entrant].associationId].confederation,
    competition.id.split('-')[1], `wrong confederation in ${competition.id}`)
}
for (const group of ['uefa', 'caf', 'conmebol', 'concacaf', 'afc', 'ofc']) {
  const a = draw.competitions[`continental-${group}`].entrantIds
  const b = draw.competitions[`union-${group}`].entrantIds
  assert.ok(b.every(id => !a.includes(id)), `club in both ${group} tiers`)
  assert.ok(!draw.competitions[`national-${group}`], 'national championship started outside its edition year')
}
assert.equal(Object.values(draw.associations).filter(item => item.confederation === 'caf').length, 54)
assert.ok(draw.competitions['conference-uefa'].entrantIds.every(id => !draw.competitions['continental-uefa'].entrantIds.includes(id) &&
  !draw.competitions['union-uefa'].entrantIds.includes(id)))
assert.equal(PRO_LEAGUE_PLAN.length, 75)
const games = Object.values(draw.fixtures)
const dates = new Set<string>()
const clubDates = new Map<string, string[]>()
for (const fixture of games) {
  for (const id of [fixture.homeId, fixture.awayId]) {
    const key = `${fixture.kickoffDate}:${id}`
    assert.ok(!dates.has(key), `same-day fixture collision: ${key}`)
    dates.add(key)
    if (draw.clubs[id]) clubDates.set(id, [...(clubDates.get(id) ?? []), fixture.kickoffDate])
  }
}
for (const [id, fixtures] of clubDates) {
  fixtures.sort()
  for (let index = 1; index < fixtures.length; index++)
    assert.ok((Date.parse(fixtures[index]) - Date.parse(fixtures[index - 1])) / 86400000 >= 3,
      `insufficient rest for ${id}: ${fixtures[index - 1]} and ${fixtures[index]}`)
}
const full = advanceProWorldTo(draw, '2028-08-01')
assert.equal(full.competitions['world-club'].entrantIds.length, 32)
assert.ok(full.championHistory.some(item => item.competitionId === 'world-national' && item.seasonId === '2026'))
assert.ok(full.championHistory.some(item => item.competitionId === 'world-club' && item.seasonId === '2027'))
for (const type of ['cup-', 'league-cup-', 'super-cup-', 'continental-', 'union-', 'national-', 'conference-']) {
  const expected = ({ 'cup-': 75, 'league-cup-': 5, 'super-cup-': 13, 'conference-': 1, 'national-': 3 } as Record<string, number>)[type] ?? 6
  assert.equal(full.championHistory.filter(item => item.competitionId.startsWith(type) && item.seasonId === '2027').length,
    expected, `all 2027 ${type} titles should be awarded`)
}
assert.ok(full.championHistory.every(item => item.championId in full.clubs || item.championId in full.associations))
assert.ok(full.recentEvents.every(event => event.date <= full.currentDate))
assert.ok(JSON.stringify(full).length < 32 * 1024 * 1024)
const stepped = advanceProWorldTo(advanceProWorldTo(initial, '2026-05-01'), '2026-09-01')
assert.deepEqual(draw.competitions['continental-uefa'].entrantIds, stepped.competitions['continental-uefa'].entrantIds,
  'save resume changed qualification')
assert.deepEqual(draw.championHistory, stepped.championHistory, 'save resume changed title results')
let international = advanceProWorldTo(initial, '2026-06-01')
const nationalFixture = Object.values(international.fixtures).find(item => item.competitionId === 'world-national' &&
  Object.values(international.players).some(player => player.nationalityIds.includes(item.homeId) && player.clubId))!
const nation = nationalFixture.homeId
international = advanceProWorldTo(international, nationalFixture.kickoffDate)
const selected = Object.values(international.players).find(item => item.nationalityIds.includes(nation) && item.clubId &&
  (!item.injuredUntil || item.injuredUntil < nationalFixture.kickoffDate))!
selected.overall = 99
const callup = nationalCallupFixture(international, selected.id, nation, nationalFixture.kickoffDate)
assert.ok(callup, 'a top eligible player should receive an international call-up')
const internationalCareer = { ...beginProTrial(nationalFixture.kickoffDate), stage: 'signed' as const,
  clubId: selected.clubId, playerId: selected.id, trust: 70, energy: 90 }
const appearance = advanceProDay(international, internationalCareer, 'rest', nation).career
assert.equal(appearance.nationalCaps, 1)
assert.equal(appearance.appearances, 0, 'a national cap is separate from club appearances')
assert.equal(appearance.days.at(-1)?.matchIds.includes(nationalFixture.id), true)
console.log('Pro Phase 4: domestic/continental/national tournaments, calendars, titles and resumability passed')
