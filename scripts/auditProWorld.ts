import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { createProWorld, proCalendarProfile } from '../src/engine/proWorldFactory'
import { advanceProWorldTo } from '../src/engine/proWorldSimulation'
import { completeProTransfer } from '../src/engine/proTransfers'
import { assessProDeal } from '../src/engine/proClubFinance'
import { clubSeasonPhase, validateCalendarProfile } from '../src/engine/proCalendar'
import { readSave, writeSave, SAVE_SCHEMA_VERSION, EMPTY_CUPS } from '../src/engine/save'
import { PRO_DEEP_LEAGUE_PLAN, PRO_GROUPED_LEAGUE_PLAN, PRO_LEAGUE_PLAN, PRO_LOWER_LEAGUE_PLAN, validateProLeaguePlan } from '../src/engine/proLeagueRegistry'
import { PRO_SATELLITE_ASSOCIATIONS } from '../src/engine/proSatelliteRegistry'

const world = createProWorld(2051, '2026-01-01')
assert.equal(clubSeasonPhase('2026-06-15'), 'off-season')
assert.equal(clubSeasonPhase('2026-07-15'), 'pre-season')
assert.equal(clubSeasonPhase('2026-07-15', true), 'international-duty')
assert.equal(clubSeasonPhase('2026-08-15'), 'regular-season')
const playableNine = ['eng', 'esp', 'ger', 'fra', 'ita', 'ned', 'por', 'sco', 'rsa']
for (const association of playableNine) {
  const profile = proCalendarProfile(association, 2026)
  assert.equal(profile.startMonth, 8, `${association}: August league start`)
  assert.equal(profile.endMonth, 5, `${association}: May league finish`)
  assert.deepEqual(validateCalendarProfile(profile), [], `${association}: valid calendar`)
}

assert.deepEqual(validateProLeaguePlan(), [])
assert.equal(PRO_LEAGUE_PLAN.length, 100)
assert.equal(PRO_SATELLITE_ASSOCIATIONS.length, 118)
assert.equal(new Set([...PRO_LEAGUE_PLAN.map(item => item.associationId), ...PRO_SATELLITE_ASSOCIATIONS.map(item => item.id)]).size, 218)
assert.ok(Object.keys(world.associations).length >= 200)
assert.equal(Object.values(world.associations).filter(item => item.confederation === 'caf').length, 54)
assert.equal(Object.keys(world.competitions).length, 100 + PRO_LOWER_LEAGUE_PLAN.length + PRO_DEEP_LEAGUE_PLAN.length + PRO_GROUPED_LEAGUE_PLAN.length)
assert.ok(Object.keys(world.players).length > 25_000)
const initial = JSON.stringify(world)
assert.ok(initial.length < 32 * 1024 * 1024)

for (const competition of Object.values(world.competitions)) {
  const fixtures = Object.values(world.fixtures).filter(fixture => fixture.competitionId === competition.id)
  const n = competition.entrantIds.length
  assert.equal(fixtures.length, competition.id === 'top-sco' ? 198 : n * (n - 1) *
    (competition.associationId === 'sco' ? 2 : competition.id === 'third-bra' ? .5 : 1), `${competition.id} fixture count`)
  const pairs = new Set(fixtures.map(fixture => `${fixture.homeId}:${fixture.awayId}`))
  assert.equal(pairs.size, competition.id === 'top-sco' ? 132 : competition.associationId === 'sco' ? fixtures.length / 2 : fixtures.length,
    `${competition.id} repeated home/away tie`)
  const clubDates = new Set<string>()
  for (const fixture of fixtures) for (const id of [fixture.homeId, fixture.awayId]) {
    assert.ok(competition.entrantIds.includes(id), 'fixture references entrant')
    const key = `${fixture.kickoffDate}:${id}`
    assert.ok(!clubDates.has(key), `${competition.id} plays a club twice in one day`)
    clubDates.add(key)
  }
  const year = Number(competition.seasonId)
  assert.deepEqual(validateCalendarProfile(proCalendarProfile(competition.associationId!, year)), [])
}

const youthShell = { schemaVersion: SAVE_SCHEMA_VERSION, slotId: 0 as const, savedAt: '2026-01-01T00:00:00Z',
  player: { id: 'youth', name: 'Legacy', careerClock: { phase: 'academy', ageYears: 17, grassrootsSeason: null } },
  calendar: { currentWeek: { weekNumber: 1, seasonYear: 2, events: [] }, history: [] },
  league: null, academyLeague: null, cups: { ...EMPTY_CUPS }, international: null, pendingTraining: null }
await writeSave({ ...youthShell, player: youthShell.player as never, proWorld: world })
const restored = await readSave(0)
assert.equal(restored?.proWorld?.seed, 2051)
assert.equal(restored?.proWorld?.fixtures['fixture-top-eng-2025-1-1']?.competitionId, 'top-eng')
assert.equal(restored?.player.id, 'youth')
assert.equal(restored?.calendar.currentWeek.weekNumber, 1)

const england = Object.values(world.clubs).filter(club => club.associationId === 'eng')
const buyer = england[0]
const seller = england[1]
const player = Object.values(world.players).find(candidate => candidate.clubId === seller.id)!
const goodDeal = { annualWage: Math.floor(buyer.finances.topPlayerAnnualWage * .12),
  probableAnnualBonuses: 1000, annualTransferCost: 10_000, annualAgentFee: 1000,
  upfrontTransferPayment: 100_000, signingBonus: 1000, role: 'prospect' as const }
assert.equal(assessProDeal(buyer.finances, goodDeal).affordable, true)
const expensive = { ...goodDeal, annualWage: 100_000_000_000 }
assert.equal(completeProTransfer(world, player.id, buyer.id, expensive, world.currentDate).ok, false)
assert.equal(world.players[player.id].clubId, seller.id, 'rejected deal mutated world')
const signed = completeProTransfer(world, player.id, buyer.id, goodDeal, world.currentDate)
assert.equal(signed.ok, true)
if (!signed.ok) throw new Error('Expected signed transfer')
assert.equal(signed.world.players[player.id].clubId, buyer.id)
assert.equal(new Set(Object.values(signed.world.players).filter(candidate => candidate.clubId === buyer.id)
  .map(candidate => candidate.shirtNumber)).size, 25, 'new squad shirt numbers overlap')
assert.equal(signed.world.clubs[seller.id].finances.cash, seller.finances.cash + goodDeal.upfrontTransferPayment)
assert.equal(signed.world.clubs[buyer.id].finances.cash, buyer.finances.cash - goodDeal.upfrontTransferPayment - goodDeal.signingBonus)

const start = performance.now()
const firstSummer = advanceProWorldTo(world, '2026-07-15')
for (const country of playableNine) {
  const comp = firstSummer.competitions[`preseason-${country}`]
  assert.equal(comp?.seasonId, '2026', `${country}: July invitational created`)
  const games = Object.values(firstSummer.fixtures).filter(game => game.competitionId === `preseason-${country}`)
  assert.ok(games.length > 0 && games.every(game => game.kickoffDate.slice(5, 7) === '07'), `${country}: July tournament fixtures`)
}
const firstAutumn = advanceProWorldTo(firstSummer, '2026-11-15')
for (const country of playableNine) {
  const cup = firstAutumn.competitions[`cup-${country}`]
  assert.equal(cup?.seasonId, '2026', `${country}: domestic cup season`)
  const games = Object.values(firstAutumn.fixtures).filter(game => game.competitionId === `cup-${country}`)
  assert.ok(games.length > 0, `${country}: domestic cup fixtures`)
}
const tenYears = advanceProWorldTo(world, '2036-01-01')
const twentyYears = advanceProWorldTo(tenYears, '2046-01-01')
const elapsed = Math.round(performance.now() - start)
assert.equal(twentyYears.championHistory.filter(record => record.competitionId.startsWith('top-')).length,
  100 * 20 + 17, 'every league season archived; Brazil 2026 begins in January')
assert.ok(twentyYears.championHistory.filter(record => record.competitionId.startsWith('second-')).length >=
  PRO_LOWER_LEAGUE_PLAN.length * 20, 'every lower-division season archived')
assert.ok(twentyYears.championHistory.filter(record => record.competitionId.startsWith('third-') || record.competitionId.startsWith('fourth-')).length >=
  (PRO_DEEP_LEAGUE_PLAN.length + PRO_GROUPED_LEAGUE_PLAN.length) * 20, 'every feeder season archived')
assert.ok(twentyYears.seasonHistory.filter(row => /^(top|second|third|fourth)-/.test(row.competitionId)).length <=
  (100 + PRO_LOWER_LEAGUE_PLAN.length + PRO_DEEP_LEAGUE_PLAN.length + PRO_GROUPED_LEAGUE_PLAN.length) * 9)
assert.ok(twentyYears.recentEvents.length <= 240)
assert.equal(Object.values(twentyYears.players).filter(candidate => candidate.clubId).length,
  Object.keys(world.players).length, 'retirees were not replaced')
assert.ok(Object.values(twentyYears.players).filter(candidate => candidate.clubId === undefined).length === 0)
assert.ok(Object.values(twentyYears.clubs).every(club => Number.isFinite(club.finances.cash) && club.finances.cash >= 0 &&
  Number.isFinite(club.finances.debt) && club.finances.debt! >= 0 && club.finances.committedAnnualWages > 0), 'invalid club finances')
assert.ok(twentyYears.recentEvents.every(event => event.date <= twentyYears.currentDate), 'future news published early')
const bytes = JSON.stringify(twentyYears).length
assert.ok(bytes < 32 * 1024 * 1024, `20-year save exceeds import limit: ${bytes}`)
assert.equal(advanceProWorldTo(twentyYears, twentyYears.currentDate), twentyYears, 'same-day advance must be idempotent')
const direct = advanceProWorldTo(world, '2027-07-01')
const stepped = advanceProWorldTo(advanceProWorldTo(world, '2026-07-01'), '2027-07-01')
assert.deepEqual(direct.championHistory, stepped.championHistory, 'resuming changes champions')
assert.deepEqual(direct.standings, stepped.standings, 'resuming changes tables')
console.log(`Pro world: ${Object.keys(world.clubs).length} clubs, ${Object.keys(world.players).length} initial players, ${Object.keys(world.fixtures).length} fixtures; 20 years in ${elapsed}ms, ${(bytes / 1048576).toFixed(1)} MiB`)
