import assert from 'node:assert/strict'
import { createProWorld, plannedClubCount } from '../src/engine/proWorldFactory'
import { advanceProWorldTo } from '../src/engine/proWorldSimulation'
import { englandBerths, southAfricaBerths } from '../src/engine/proQualification'
import { VERIFIED_PRO_RULES } from '../src/engine/proRulebook'
import { LOWER_DIVISIONS } from '../src/engine/proLeagueRegistry'

const world = createProWorld(17, '2026-08-01')
for (const [id, profile] of Object.entries(VERIFIED_PRO_RULES)) {
  assert.equal(plannedClubCount(id), profile.topFlightClubs)
  const competition = world.competitions[`top-${id}`]
  assert.equal(competition.entrantIds.length, profile.topFlightClubs)
  assert.equal(competition.format.scheduledRounds, profile.topFlightMatches)
  const fixtures = Object.values(world.fixtures).filter(f => f.competitionId === competition.id)
  const regularGames = id === 'sco' ? 33 : profile.topFlightMatches
  assert.equal(fixtures.length, profile.topFlightClubs * regularGames / 2)
  for (const clubId of competition.entrantIds) {
    const home = fixtures.filter(f => f.homeId === clubId).length
    const away = fixtures.filter(f => f.awayId === clubId).length
    assert.equal(home + away, regularGames)
    if (id === 'sco') {
      assert.ok(home === 16 || home === 17, 'Scottish pre-split home games must be 16 or 17')
      assert.ok(away === 16 || away === 17, 'Scottish pre-split away games must be 16 or 17')
    } else {
      assert.equal(home, regularGames / 2)
      assert.equal(away, regularGames / 2)
    }
  }
  const second = world.competitions[`second-${id}`]
  assert.equal(second.entrantIds.length, profile.lowerTierClubs)
  assert.equal(second.format.scheduledRounds, profile.lowerTierMatches)
  assert.equal(LOWER_DIVISIONS[id].clubs, profile.lowerTierClubs)
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
for (const id of Object.keys(LOWER_DIVISIONS)) {
  const top = next.competitions[`top-${id}`]
  const lower = next.competitions[`second-${id}`]
  assert.equal(new Set([...top.entrantIds, ...lower.entrantIds]).size, top.entrantIds.length + lower.entrantIds.length)
  assert.ok(next.championHistory.some(row => row.competitionId === `second-${id}`), `${id} lower title recorded`)
  const first = world.competitions[`top-${id}`].entrantIds
  assert.ok(top.entrantIds.some(clubId => !first.includes(clubId)), `${id} promotion took effect`)
}
assert.equal(next.seasonHistory.filter(record => record.competitionId === 'top-sco').at(-1)?.table[0].played, 38,
  'Scottish top flight has 33 games before the split and five after')
// Diagnose missing cup entrants against the current league membership, not old tables.
for (const [id, expected] of [['eng', 116], ['rsa', 149]] as const) {
  const cup = next.competitions[`cup-${id}`]
  const entrants = new Set(cup.entrantIds)
  const memberCompetitions = Object.values(next.competitions).filter(comp =>
    comp.associationId === id && /^(top|second|third|fourth|fifth)-/.test(comp.id))
  const members = new Map<string, string[]>()
  for (const comp of memberCompetitions) for (const clubId of comp.entrantIds) {
    members.set(clubId, [...(members.get(clubId) ?? []), comp.id])
  }
  const missing = [...members.entries()].filter(([clubId]) => !entrants.has(clubId))
    .map(([clubId, divisions]) => ({ clubId, divisions,
      tier: next.clubs[clubId]?.tier, clubName: next.clubs[clubId]?.name }))
  const duplicateMembership = [...members.entries()].filter(([, divisions]) => divisions.length > 1)
    .map(([clubId, divisions]) => ({ clubId, divisions }))
  console.log('Cup entrant diagnostic:', JSON.stringify({
    association: id, expected, actual: cup.entrantIds.length,
    uniqueEntrants: entrants.size, currentLeagueClubs: members.size,
    missingCount: missing.length, missing, duplicateMembership,
    cupEntrantsOutsideLeagues: cup.entrantIds.filter(clubId => !members.has(clubId)),
    competitionSizes: memberCompetitions.map(comp => ({ id: comp.id, clubs: comp.entrantIds.length })),
  }, null, 2))
}
// Every promoted top-flight side must be registered for its new domestic cup,
// even when last season's standings still refer to relegated clubs.
for (const id of Object.keys(LOWER_DIVISIONS)) {
  const currentTop = next.competitions[`top-${id}`].entrantIds
  const cup = new Set(next.competitions[`cup-${id}`].entrantIds)
  assert.equal(cup.size, next.competitions[`cup-${id}`].entrantIds.length,
    `${id} domestic cup contains duplicate entrants`)
  for (const clubId of currentTop)
    assert.ok(cup.has(clubId), `${id} top-flight club ${clubId} missing from domestic cup`)
}
assert.equal(next.competitions['cup-eng'].entrantIds.length, 116)
assert.equal(next.competitions['cup-rsa'].entrantIds.length, 149)
const legacy = createProWorld(31, '2026-08-01')
for (const [clubId, club] of Object.entries(legacy.clubs)) if (club.tier === 2) {
  delete legacy.clubs[clubId]
  for (const [playerId, player] of Object.entries(legacy.players)) if (player.clubId === clubId) delete legacy.players[playerId]
  for (const [prospectId, prospect] of Object.entries(legacy.academyProspects)) if (prospect.clubId === clubId) delete legacy.academyProspects[prospectId]
  delete legacy.managers[`manager-${clubId}`]
  delete legacy.stadiums[club.stadiumId]
}
for (const id of Object.keys(LOWER_DIVISIONS)) {
  delete legacy.competitions[`second-${id}`]
  delete legacy.standings[`second-${id}`]
}
for (const [fixtureId, fixture] of Object.entries(legacy.fixtures)) if (fixture.competitionId.startsWith('second-')) delete legacy.fixtures[fixtureId]
const savedTitle = { competitionId: 'cup-eng', seasonId: '2025', championId: legacy.competitions['top-eng'].entrantIds[0] }
legacy.championHistory.push(savedTitle)
const migrated = advanceProWorldTo(legacy, '2026-08-02')
assert.deepEqual(migrated.championHistory[0], savedTitle)
for (const [id, profile] of Object.entries(LOWER_DIVISIONS)) {
  assert.equal(migrated.competitions[`second-${id}`].entrantIds.length, profile.clubs)
  assert.equal(migrated.competitions[`top-${id}`].entrantIds.length, legacy.competitions[`top-${id}`].entrantIds.length)
}
assert.equal(next.competitions['mtn8-rsa'].entrantIds.length, 8)
assert.equal(next.competitions['league-cup-rsa'].entrantIds.length, 16)
// Preliminary entrants can exceed main-stage sizes; only their winners progress.
const european=next.competitions['continental-uefa']
const african=next.competitions['continental-caf']
assert.ok(european.entrantIds.length >= 36)
assert.ok(african.entrantIds.length >= 16)
assert.equal(new Set(european.entrantIds).size, european.entrantIds.length)
assert.equal(new Set(next.competitions['union-caf'].entrantIds).size,
  next.competitions['union-caf'].entrantIds.length)
assert.equal(european.tournament?.qualifyingTarget, 36)
assert.equal(african.tournament?.qualifyingTarget, 16)
console.log('2026/27 England and South Africa formats, cups and domestic qualification routing passed')
