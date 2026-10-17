import assert from 'node:assert/strict'
import { createProWorld, plannedClubCount } from '../src/engine/proWorldFactory'
import { advanceProWorldTo } from '../src/engine/proWorldSimulation'
import { englandBerths, southAfricaBerths } from '../src/engine/proQualification'
import { VERIFIED_PRO_RULES } from '../src/engine/proRulebook'

const world = createProWorld(17, '2026-08-01')
for (const [id, profile] of Object.entries(VERIFIED_PRO_RULES)) {
  assert.equal(plannedClubCount(id), profile.topFlightClubs)
  const competition = world.competitions[`top-${id}`]
  assert.equal(competition.entrantIds.length, profile.topFlightClubs)
  assert.equal(competition.format.scheduledRounds, profile.topFlightMatches)
  const fixtures = Object.values(world.fixtures).filter(f => f.competitionId === competition.id)
  assert.equal(fixtures.length, profile.topFlightClubs * profile.topFlightMatches / 2)
  for (const clubId of competition.entrantIds) {
    const home = fixtures.filter(f => f.homeId === clubId).length
    const away = fixtures.filter(f => f.awayId === clubId).length
    assert.equal(home, profile.topFlightMatches / 2)
    assert.equal(away, profile.topFlightMatches / 2)
  }
}

// A cup winner already in Europe passes the berth to the next available club.
const eng = world.competitions['top-eng'].entrantIds
world.standings['top-eng'] = eng.map((clubId, index) => ({ clubId, played: 38, won: 20 - index, drawn: 0, lost: 18 + index,
  goalsFor: 50 - index, goalsAgainst: 10 + index, points: 90 - index }))
world.championHistory.push({ competitionId: 'cup-eng', seasonId: '2026', championId: eng[0] },
  { competitionId: 'league-cup-eng', seasonId: '2026', championId: eng[4] })
const england = englandBerths(world)
assert.deepEqual(england.champions, eng.slice(0, 4))
assert.deepEqual(england.secondary, [eng[4], eng[5]])
assert.deepEqual(england.third, [eng[6]])

const rsa = world.competitions['top-rsa'].entrantIds
world.standings['top-rsa'] = rsa.map((clubId, index) => ({ clubId, played: 30, won: 15 - index, drawn: 0, lost: 15 + index,
  goalsFor: 40 - index, goalsAgainst: 10 + index, points: 70 - index }))
world.championHistory.push({ competitionId: 'cup-rsa', seasonId: '2026', championId: rsa[0] })
const southAfrica = southAfricaBerths(world)
assert.deepEqual(southAfrica.champions, rsa.slice(0, 2))
assert.deepEqual(southAfrica.secondary, [rsa[2], rsa[3]])

const next = advanceProWorldTo(createProWorld(17, '2026-08-01'), '2027-09-02')
assert.equal(next.competitions['mtn8-rsa'].entrantIds.length, 8)
assert.equal(next.competitions['league-cup-rsa'].entrantIds.length, 16)
assert.equal(next.competitions['continental-uefa'].entrantIds.length, 36)
assert.equal(next.competitions['continental-caf'].entrantIds.length, 16)
assert.equal(new Set(next.competitions['continental-uefa'].entrantIds).size, 36)
assert.equal(new Set(next.competitions['union-caf'].entrantIds).size, 16)
console.log('2026/27 England and South Africa formats, cups and domestic qualification routing passed')
