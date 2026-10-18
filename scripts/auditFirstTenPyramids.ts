import assert from 'node:assert/strict'
import { createProWorld } from '../src/engine/proWorldFactory'
import { advanceProWorldTo } from '../src/engine/proWorldSimulation'
import { VERIFIED_PRO_RULES } from '../src/engine/proRulebook'

/** First-ten regression gate: division identities, league fixtures, season movement. */
const countries = ['eng','esp','ger','fra','ita','ned','por','bra','rsa','sco'] as const
const initial = createProWorld(20261018, '2026-08-01')
const first = advanceProWorldTo(initial, '2027-10-01')
const resumed = advanceProWorldTo(advanceProWorldTo(initial, '2027-02-01'), '2027-10-01')
for (const country of countries) {
  const rules = VERIFIED_PRO_RULES[country]
  const top = initial.competitions[`top-${country}`]
  const second = initial.competitions[`second-${country}`]
  assert.ok(top && second, `${country}: missing top/second tier`)
  assert.equal(top.entrantIds.length, rules.topFlightClubs)
  assert.equal(second.entrantIds.length, rules.lowerTierClubs)
  assert.equal(top.format.scheduledRounds, rules.topFlightMatches)
  assert.equal(second.format.scheduledRounds, rules.lowerTierMatches)
  for (const tier of ['top','second'] as const) {
    const id = `${tier}-${country}`
    const comp = initial.competitions[id]
    const fixtures = Object.values(initial.fixtures).filter(f => f.competitionId === id)
    const played = new Map(comp.entrantIds.map(id => [id, 0]))
    const dates = new Set<string>()
    for (const f of fixtures) {
      assert.ok(f.homeId !== f.awayId && played.has(f.homeId) && played.has(f.awayId), `${id}: invalid pairing`)
      for (const club of [f.homeId,f.awayId]) {
        const key = `${club}:${f.kickoffDate}`
        assert.ok(!dates.has(key), `${id}: duplicate club date ${key}`)
        dates.add(key)
        played.set(club, played.get(club)! + 1)
      }
    }
    const regularRounds = id === 'top-sco' ? 33 : comp.format.scheduledRounds
    for (const count of played.values()) assert.equal(count, regularRounds, `${id}: wrong match count`)
    assert.deepEqual(first.competitions[id].entrantIds, resumed.competitions[id].entrantIds, `${id}: save/resume changed entrants`)
    assert.deepEqual(first.standings[id], resumed.standings[id], `${id}: save/resume changed standings`)
    assert.ok(first.championHistory.some(h => h.competitionId === id), `${id}: missing season champion`)
  }
  const movement = first.promotionHistory?.find(h => h.associationId === country)
  assert.ok(movement, `${country}: missing top-flight promotion/relegation history`)
  assert.equal(movement.promotedIds.length, movement.relegatedIds.length, `${country}: unbalanced movement`)
  assert.equal(new Set(movement.promotedIds).size, movement.promotedIds.length, `${country}: duplicate promoted club`)
  assert.equal(new Set(movement.relegatedIds).size, movement.relegatedIds.length, `${country}: duplicate relegated club`)
  assert.ok(movement.fixtures.every(f => !!f.result), `${country}: unfinished promotion playoff`)
  assert.ok(movement.promotedIds.every(id => first.competitions[`top-${country}`].entrantIds.includes(id)), `${country}: promoted club missing from top tier`)
  assert.ok(movement.relegatedIds.every(id => first.competitions[`second-${country}`].entrantIds.includes(id)), `${country}: relegated club missing from second tier`)
}
console.log('First-ten top/second pyramid regression passed')

const brazilFeeder = first.promotionHistory?.find(h => h.associationId === 'bra-2')
assert.ok(brazilFeeder, 'Brazil Série C promotion missing')
assert.equal(brazilFeeder.promotedIds.length, 4)
assert.ok(brazilFeeder.fixtures.length >= 12, 'Brazil Série C final-group fixtures missing')
assert.ok(brazilFeeder.fixtures.every(f => !!f.result), 'Brazil Série C final-group result missing')
assert.ok(brazilFeeder.promotedIds.every(id => first.competitions['second-bra'].entrantIds.includes(id)),
  'Brazil Série C winner missing from next Série B')

for (const [country, expectedTeams, expectedGames] of [['bra', 8, 24], ['por', 8, 56]] as const) {
  const history = first.promotionHistory?.find(h => h.associationId === `${country}-2`)
  assert.ok(history, `${country}: missing feeder history`)
  // Brazil: two groups of four, double round robin (12 games each).
  // Portugal: one eight-team final phase, double round robin (56 games).
  assert.equal(history.fixtures.length, expectedGames, `${country}: wrong feeder fixture count`)
  const entrants = new Set(history.fixtures.flatMap(f => [f.homeId, f.awayId]))
  assert.equal(entrants.size, expectedTeams, `${country}: feeder entrants`)
  const occupied = new Set<string>()
  const pairings = new Map<string, { home: string; away: string }[]>()
  for (const fixture of history.fixtures) {
    for (const id of [fixture.homeId, fixture.awayId]) {
      const key = `${fixture.kickoffDate}:${id}`
      assert.ok(!occupied.has(key), `${country}: feeder club double booked ${key}`)
      occupied.add(key)
    }
    const pair = [fixture.homeId, fixture.awayId].sort().join(':')
    pairings.set(pair, [...(pairings.get(pair) ?? []), { home: fixture.homeId, away: fixture.awayId }])
  }
  for (const games of pairings.values()) {
    assert.equal(games.length, 2, `${country}: feeder teams must meet twice`)
    assert.equal(games[0].home, games[1].away, `${country}: feeder return leg must reverse venue`)
  }
}

for (const [country, expectedMatches] of [['esp', 12], ['ita', 14]] as const) {
  const history = first.promotionHistory?.find(h => h.associationId === `${country}-2`)
  assert.ok(history, `${country}: missing third-tier playoff history`)
  assert.equal(history.fixtures.length, expectedMatches, `${country}: wrong two-leg playoff fixture count`)
  const occupied = new Set<string>()
  const pairings = new Map<string, typeof history.fixtures>()
  for (const fixture of history.fixtures) {
    assert.ok(fixture.result, `${country}: unfinished playoff fixture`)
    for (const id of [fixture.homeId, fixture.awayId]) {
      const key = `${fixture.kickoffDate}:${id}`
      assert.ok(!occupied.has(key), `${country}: double-booked playoff club ${key}`)
      occupied.add(key)
    }
    const key = [fixture.homeId, fixture.awayId].sort().join(':')
    pairings.set(key, [...(pairings.get(key) ?? []), fixture])
  }
  for (const games of pairings.values()) {
    assert.equal(games.length, 2, `${country}: playoff tie must have two legs`)
    assert.equal(games[0].homeId, games[1].awayId, `${country}: playoff return leg must reverse venue`)
  }
}

const scottishSplitWorld = advanceProWorldTo(initial, '2027-05-15')
const splitFixtures = Object.values(scottishSplitWorld.fixtures).filter(f =>
  f.competitionId === 'top-sco' && f.id.includes('-split-'))
assert.equal(splitFixtures.length, 30, 'Scotland: split must schedule 30 matches')
const splitClubs = new Map<string, Set<string>>()
const splitDates = new Set<string>()
for (const fixture of splitFixtures) {
  for (const [club, opponent] of [[fixture.homeId, fixture.awayId], [fixture.awayId, fixture.homeId]]) {
    const opponents = splitClubs.get(club) ?? new Set<string>()
    assert.ok(!opponents.has(opponent), `Scotland: duplicate split opponent ${club} / ${opponent}`)
    opponents.add(opponent)
    splitClubs.set(club, opponents)
    const dateKey = `${club}:${fixture.kickoffDate}`
    assert.ok(!splitDates.has(dateKey), `Scotland: club double booked on split date ${dateKey}`)
    splitDates.add(dateKey)
  }
}
assert.equal(splitClubs.size, 12, 'Scotland: split must include all 12 clubs')
for (const opponents of splitClubs.values())
  assert.equal(opponents.size, 5, 'Scotland: each club must meet five distinct split opponents')

const fifth = initial.competitions['fifth-eng']
assert.ok(fifth, 'England: missing National League')
assert.equal(fifth.entrantIds.length, 24, 'England: National League needs 24 clubs')
assert.equal(fifth.format.scheduledRounds, 46)
const fifthFixtures = Object.values(initial.fixtures).filter(f => f.competitionId === 'fifth-eng')
assert.equal(fifthFixtures.length, 24 * 46 / 2, 'England: incorrect National League fixtures')
const fifthPairs = new Map<string, typeof fifthFixtures>()
const fifthOccupied = new Set<string>()
for (const fixture of fifthFixtures) {
  for (const club of [fixture.homeId, fixture.awayId]) {
    const key = `${club}:${fixture.kickoffDate}`
    assert.ok(!fifthOccupied.has(key), `England fifth tier double-booked ${key}`)
    fifthOccupied.add(key)
  }
  const key = [fixture.homeId, fixture.awayId].sort().join(':')
  fifthPairs.set(key, [...(fifthPairs.get(key) ?? []), fixture])
}
assert.equal(fifthPairs.size, 276, 'England National League requires every opponent pairing')
for (const ties of fifthPairs.values()) {
  assert.equal(ties.length, 2)
  assert.equal(ties[0].homeId, ties[1].awayId, 'England National League return fixtures')
}
const fifthHistory = first.promotionHistory?.find(h => h.associationId === 'eng-4')
assert.ok(fifthHistory, 'England: National League promotion missing')
assert.equal(fifthHistory.promotedIds.length, 2)
assert.equal(fifthHistory.relegatedIds.length, 2)
assert.equal(fifthHistory.fixtures.length, 5, 'England: playoff needs five games')
assert.ok(fifthHistory.fixtures.every(f => !!f.result))
assert.ok(fifthHistory.promotedIds.every(id => first.competitions['fourth-eng'].entrantIds.includes(id)))
assert.ok(fifthHistory.relegatedIds.every(id => first.competitions['fifth-eng'].entrantIds.includes(id)))
assert.deepEqual(first.competitions['fifth-eng'].entrantIds, resumed.competitions['fifth-eng'].entrantIds,
  'England: fifth-tier save/resume changed entrants')
assert.deepEqual(first.standings['fifth-eng'], resumed.standings['fifth-eng'],
  'England: fifth-tier save/resume changed standings')
console.log('English fifth-tier and cross-pyramid regression passed')

const faCup = first.competitions['cup-eng']
const eflCup = first.competitions['league-cup-eng']
assert.ok(faCup && eflCup, 'English domestic cups missing')
const nationalLeagueMembers = new Set(first.competitions['fifth-eng'].entrantIds)
assert.ok(nationalLeagueMembers.size === 24)
assert.ok([...nationalLeagueMembers].every(id => faCup.entrantIds.includes(id)),
  'English FA Cup must contain National League entrants')
assert.ok([...nationalLeagueMembers].every(id => !eflCup.entrantIds.includes(id)),
  'English EFL Cup must exclude National League entrants')
