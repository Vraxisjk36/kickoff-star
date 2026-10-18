import assert from 'node:assert/strict'
import { createProWorld } from '../src/engine/proWorldFactory'
import { advanceProWorldTo } from '../src/engine/proWorldSimulation'
import { VERIFIED_PRO_RULES } from '../src/engine/proRulebook'
import { PRO_PYRAMID_FLOORS } from '../src/engine/proLeagueRegistry'

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
    if (id === 'top-sco') for (const clubId of comp.entrantIds) {
      const home = fixtures.filter(f => f.homeId === clubId).length
      const away = fixtures.filter(f => f.awayId === clubId).length
      assert.ok(home >= 16 && home <= 17 && away >= 16 && away <= 17,
        `Scotland: pre-split fixtures imbalanced for ${clubId}: ${home} home, ${away} away`)
    }
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

const cupSnapshot = advanceProWorldTo(initial, '2027-02-01')
const faCup = cupSnapshot.competitions['cup-eng']
const eflCup = cupSnapshot.competitions['league-cup-eng']
assert.ok(faCup && eflCup, 'English domestic cups missing')
const nationalLeagueMembers = new Set(cupSnapshot.competitions['fifth-eng'].entrantIds)
assert.ok(nationalLeagueMembers.size === 24)
assert.ok([...nationalLeagueMembers].every(id => faCup.entrantIds.includes(id)),
  'English FA Cup must contain National League entrants')
assert.ok([...nationalLeagueMembers].every(id => !eflCup.entrantIds.includes(id)),
  'English EFL Cup must exclude National League entrants')

for (let group = 1; group <= 5; group++) {
  const id = `fourth-ger-${group}`
  const comp = initial.competitions[id]
  assert.ok(comp, `Germany: Regionalliga group ${group} missing`)
  assert.equal(comp.entrantIds.length, 18)
  assert.equal(comp.format.scheduledRounds, 34)
  const fixtures = Object.values(initial.fixtures).filter(f => f.competitionId === id)
  assert.equal(fixtures.length, 306, `Germany: group ${group} fixture count`)
  const members = new Set(comp.entrantIds)
  const opponents = new Map<string, Set<string>>()
  for (const fixture of fixtures) {
    assert.ok(members.has(fixture.homeId) && members.has(fixture.awayId))
    const pair = [fixture.homeId, fixture.awayId].sort().join(':')
    const seen = opponents.get(pair) ?? new Set<string>()
    assert.ok(!seen.has(fixture.homeId), `Germany: group ${group} repeated home pairing`)
    seen.add(fixture.homeId)
    opponents.set(pair, seen)
  }
  assert.equal(opponents.size, 153, `Germany: group ${group} pairings`)
  for (const seen of opponents.values()) assert.equal(seen.size, 2)
  assert.deepEqual(first.competitions[id].entrantIds, resumed.competitions[id].entrantIds,
    `Germany: group ${group} nondeterministic entrants`)
}
const regionHistory = first.promotionHistory?.find(h => h.associationId === 'ger-3')
assert.ok(regionHistory, 'Germany: regional fourth-tier exchange missing')
assert.equal(regionHistory.promotedIds.length, 4)
assert.equal(regionHistory.relegatedIds.length, 4)
assert.equal(regionHistory.fixtures.length, 2, 'Germany: Regionalliga playoff requires two legs')
assert.ok(regionHistory.fixtures.every(f => !!f.result))
assert.ok(regionHistory.promotedIds.every(id => first.competitions['third-ger'].entrantIds.includes(id)))
assert.ok(regionHistory.relegatedIds.every(id =>
  Array.from({ length: 5 }, (_, i) => first.competitions[`fourth-ger-${i + 1}`].entrantIds)
    .some(members => members.includes(id))))
console.log('German Regionalliga five-group regression passed')

for (let group = 1; group <= 2; group++) {
  const id = `fifth-sco-${group}`
  const competition = initial.competitions[id]
  assert.ok(competition, `Scotland: missing Highland/Lowland group ${group}`)
  assert.equal(competition.entrantIds.length, 18)
  assert.equal(competition.format.scheduledRounds, 34)
  const fixtures = Object.values(initial.fixtures).filter(f => f.competitionId === id)
  assert.equal(fixtures.length, 306, `Scotland: invalid regional fixtures ${group}`)
  const scheduled = new Set<string>(), pairs = new Map<string, Set<string>>()
  for (const game of fixtures) {
    for (const club of [game.homeId, game.awayId]) {
      const key = `${club}:${game.kickoffDate}`
      assert.ok(!scheduled.has(key), `Scotland regional double booking ${key}`)
      scheduled.add(key)
    }
    const pair = [game.homeId, game.awayId].sort().join(':')
    const homes = pairs.get(pair) ?? new Set<string>()
    assert.ok(!homes.has(game.homeId), `Scotland repeated regional home fixture ${pair}`)
    homes.add(game.homeId)
    pairs.set(pair, homes)
  }
  assert.equal(pairs.size, 153)
  for (const homes of pairs.values()) assert.equal(homes.size, 2)
  assert.deepEqual(first.competitions[id].entrantIds, resumed.competitions[id].entrantIds,
    `Scotland regional tier save/resume changed group ${group}`)
}
const highlandLowlandHistory = first.promotionHistory?.find(h => h.associationId === 'sco-4')
assert.ok(highlandLowlandHistory, 'Scotland: fourth/fifth promotion history missing')
assert.equal(highlandLowlandHistory.fixtures.length, 4)
assert.ok(highlandLowlandHistory.fixtures.every(f => !!f.result))
assert.equal(highlandLowlandHistory.promotedIds.length, highlandLowlandHistory.relegatedIds.length)
assert.ok(highlandLowlandHistory.promotedIds.length <= 1)
if (highlandLowlandHistory.promotedIds.length) {
  assert.ok(first.competitions['fourth-sco'].entrantIds.includes(highlandLowlandHistory.promotedIds[0]))
  assert.ok(['fifth-sco-1', 'fifth-sco-2'].some(id =>
    first.competitions[id].entrantIds.includes(highlandLowlandHistory.relegatedIds[0])))
}
console.log('Highland and Lowland fifth-tier regression passed')

const dutchThird = initial.competitions['third-ned']
assert.ok(dutchThird, 'Netherlands: Tweede Divisie missing')
assert.equal(dutchThird.entrantIds.length, 18)
assert.equal(dutchThird.format.scheduledRounds, 34)
assert.equal(Object.values(initial.fixtures).filter(f => f.competitionId === 'third-ned').length, 306)
assert.deepEqual(first.competitions['third-ned'].entrantIds, resumed.competitions['third-ned'].entrantIds,
  'Netherlands: Tweede Divisie save/resume drift')
for (let group = 1; group <= 3; group++) {
  const id = `fourth-fra-${group}`
  const comp = initial.competitions[id]
  assert.ok(comp, `France: missing National 2 group ${group}`)
  assert.equal(comp.entrantIds.length, 16)
  assert.equal(comp.format.scheduledRounds, 30)
  const fixtures = Object.values(initial.fixtures).filter(f => f.competitionId === id)
  assert.equal(fixtures.length, 240)
  const clubs = new Set(comp.entrantIds)
  const visits = new Map<string, Set<string>>()
  for (const fixture of fixtures) {
    assert.ok(clubs.has(fixture.homeId) && clubs.has(fixture.awayId))
    const key = [fixture.homeId, fixture.awayId].sort().join(':')
    const homes = visits.get(key) ?? new Set<string>()
    assert.ok(!homes.has(fixture.homeId), `France: repeated home pairing ${key}`)
    homes.add(fixture.homeId)
    visits.set(key, homes)
  }
  assert.equal(visits.size, 120)
  for (const homes of visits.values()) assert.equal(homes.size, 2)
  assert.deepEqual(first.competitions[id].entrantIds, resumed.competitions[id].entrantIds,
    `France: National 2 regional save/resume drift ${group}`)
}
const franceNationalTwo = first.promotionHistory?.find(h => h.associationId === 'fra-3')
assert.ok(franceNationalTwo, 'France: National 2 promotion history missing')
assert.equal(franceNationalTwo.promotedIds.length, 3)
assert.equal(franceNationalTwo.relegatedIds.length, 3)
assert.ok(franceNationalTwo.promotedIds.every(id => first.competitions['third-fra'].entrantIds.includes(id)))
assert.ok(franceNationalTwo.relegatedIds.every(id => ['fourth-fra-1','fourth-fra-2','fourth-fra-3']
  .some(group => first.competitions[group].entrantIds.includes(id))))
console.log('French National 2 and Dutch Tweede Divisie audit passed')

const regionalFourthCases = [
  { country: 'esp', groups: 5, clubs: 18, promotions: 10 },
  { country: 'ita', groups: 9, clubs: 18, promotions: 9 },
  { country: 'por', groups: 4, clubs: 14, promotions: 4 },
  { country: 'rsa', groups: 9, clubs: 12, promotions: 9 },
  { country: 'bra', groups: 8, clubs: 8, promotions: 4 },
] as const
for (const { country, groups, clubs, promotions } of regionalFourthCases) {
  const regionalIds = Array.from({ length: groups }, (_, group) => `fourth-${country}-${group + 1}`)
  const regionalEntrants = new Set<string>()
  for (const id of regionalIds) {
    const competition = initial.competitions[id]
    assert.ok(competition, `${country}: missing fourth-tier regional group ${id}`)
    assert.equal(competition.entrantIds.length, clubs)
    assert.equal(competition.format.scheduledRounds, (clubs - 1) * 2)
    const fixtures = Object.values(initial.fixtures).filter(f => f.competitionId === id)
    assert.equal(fixtures.length, clubs * (clubs - 1), `${id}: expected home-and-away fixtures`)
    const home = new Set<string>(), occupied = new Set<string>()
    for (const fixture of fixtures) {
      assert.ok(competition.entrantIds.includes(fixture.homeId) &&
        competition.entrantIds.includes(fixture.awayId), `${id}: outsider fixture`)
      const key = `${fixture.homeId}:${fixture.awayId}`
      assert.ok(!home.has(key), `${id}: repeated home-and-away pairing ${key}`)
      home.add(key)
      for (const club of [fixture.homeId, fixture.awayId]) {
        const busy = `${club}:${fixture.kickoffDate}`
        assert.ok(!occupied.has(busy), `${id}: club double-booked ${busy}`)
        occupied.add(busy)
      }
    }
    for (const club of competition.entrantIds) {
      assert.ok(!regionalEntrants.has(club), `${country}: club appears in multiple regions`)
      regionalEntrants.add(club)
    }
    assert.deepEqual(first.competitions[id].entrantIds, resumed.competitions[id].entrantIds,
      `${id}: fourth-tier entrant save-resume drift`)
  }
  const history = first.promotionHistory?.find(h => h.associationId === `${country}-3`)
  assert.ok(history, `${country}: missing third/fourth relegation exchange`)
  assert.equal(history.promotedIds.length, promotions)
  assert.equal(history.relegatedIds.length, promotions)
  assert.equal(new Set(history.promotedIds).size, promotions)
  assert.equal(new Set(history.relegatedIds).size, promotions)
  const thirdIds = country === 'bra' ? ['third-bra'] :
    Array.from({ length: country === 'rsa' ? 9 : country === 'ita' ? 3 : 2 },
      (_, index) => `third-${country}-${index + 1}`)
  assert.ok(history.promotedIds.every(club => thirdIds.some(id =>
    first.competitions[id].entrantIds.includes(club))), `${country}: promoted fourth-tier side absent from third`)
  assert.ok(history.relegatedIds.every(club => regionalIds.some(id =>
    first.competitions[id].entrantIds.includes(club))), `${country}: demoted third-tier side absent from fourth`)
  if (country === 'bra') {
    assert.equal(history.fixtures.length, 8, 'Brazil Série D needs four two-legged playoff ties')
    assert.ok(history.fixtures.every(f => !!f.result))
  }
}
console.log('All grouped fourth-tier fixture and promotion exchange audits passed')

for (const country of countries) {
  const floor = PRO_PYRAMID_FLOORS[country]
  assert.ok(floor >= 3 && floor <= 5, `${country}: missing frozen bottom tier`)
  const allClubs = Object.values(first.clubs).filter(club => club.associationId === country)
  assert.ok(allClubs.every(club => !!club.tier && club.tier <= floor),
    `${country}: club fell below the frozen pyramid`)
  assert.equal(allClubs.length, Object.values(initial.clubs).filter(club =>
    club.associationId === country).length, `${country}: clubs lost at pyramid floor`)
  const floorCompetitions = Object.values(first.competitions).filter(comp =>
    comp.associationId === country && comp.kind === 'league' &&
    comp.id.startsWith(`${['top','second','third','fourth','fifth'][floor - 1]}-`))
  assert.ok(floorCompetitions.length >= 1, `${country}: bottom division missing`)
  const bottomClubs = new Set(floorCompetitions.flatMap(comp => comp.entrantIds))
  assert.ok(bottomClubs.size > 0, `${country}: no clubs in frozen floor`)
  assert.ok([...bottomClubs].every(id => first.clubs[id].tier === floor),
    `${country}: incorrect bottom-tier membership`)
}
console.log('All ten hard-stop pyramid floors retained clubs and active lowest leagues')

for (const [country, fixtures] of [['esp', 20], ['por', 24], ['ita', 0], ['rsa', 0]] as const) {
  const history = first.promotionHistory?.find(h => h.associationId === `${country}-3`)
  assert.ok(history, `${country}: missing fourth-tier promotion archive`)
  assert.equal(history.fixtures.length, fixtures, `${country}: wrong authentic promotion phase fixture count`)
  assert.ok(history.fixtures.every(f => !!f.result), `${country}: unfinished regional qualification tie`)
}
for (const id of Object.keys(first.clubs)) {
  const club = first.clubs[id]
  if (club.associationId in PRO_PYRAMID_FLOORS &&
      club.homeRegion && club.homeRegionCount) {
    assert.ok(club.homeRegion >= 1 && club.homeRegion <= club.homeRegionCount,
      `Invalid permanent geographic region for ${id}`)
  }
}
