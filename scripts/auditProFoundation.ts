import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { set } from 'idb-keyval'
import { validateProLeaguePlan, PRO_LEAGUE_PLAN } from '../src/engine/proLeagueRegistry'
import { assessProDeal, type ProClubFinances } from '../src/engine/proClubFinance'
import { createEmptyProWorld } from '../src/engine/proWorld'
import { isInPeriod, scheduleProActivity, seasonEndYear, validateCalendarProfile } from '../src/engine/proCalendar'
import { readSave, writeSave, SAVE_SCHEMA_VERSION, EMPTY_CUPS, type SaveGame } from '../src/engine/save'
import { NATIONS } from '../src/engine/nations'

assert.deepEqual(validateProLeaguePlan(), [])
assert.ok(NATIONS.every(nation => PRO_LEAGUE_PLAN.some(league => league.associationId === nation.id)), 'V20 nation IDs must survive pro migration')
assert.deepEqual(Object.fromEntries(['uefa', 'caf', 'conmebol', 'concacaf', 'afc', 'ofc'].map(confed =>
  [confed, PRO_LEAGUE_PLAN.filter(league => league.confederation === confed).length])),
{ uefa: 20, caf: 18, conmebol: 10, concacaf: 11, afc: 14, ofc: 2 })

const club: ProClubFinances = {
  clubId: 'club-1', currency: 'GBP', annualRevenue: 100_000_000, cash: 10_000_000,
  annualSquadCostLimit: 25_000_000, committedAnnualWages: 19_000_000,
  committedAnnualBonuses: 1_000_000, committedAnnualTransferCosts: 1_000_000,
  committedAnnualAgentFees: 200_000, reservedAnnualSquadCosts: 1_000_000,
  committedTransferPayments: 2_000_000, topPlayerAnnualWage: 2_000_000,
  roleWageMultiplier: { prospect: .2, rotation: .6, starter: 1, star: 1.5 },
}
const offer = { annualWage: 200_000, probableAnnualBonuses: 50_000, annualTransferCost: 0,
  annualAgentFee: 10_000, upfrontTransferPayment: 0, signingBonus: 30_000, role: 'prospect' as const }
assert.equal(assessProDeal(club, offer).affordable, true)
assert.deepEqual(assessProDeal(club, { ...offer, annualWage: 15_600_000 }).reasons.sort(), ['squad_budget', 'wage_hierarchy'])
assert.ok(assessProDeal(club, { ...offer, upfrontTransferPayment: 9_000_000 }).reasons.includes('cash'))
assert.ok(assessProDeal({ ...club, cash: -1 }, offer).reasons.includes('invalid_finances'))

const spain = { id: 'esp-sample', startMonth: 8, endMonth: 5,
  breaks: [{ start: '2026-12-22', end: '2027-01-03' }],
  registrationPeriods: [{ start: '2026-07-01', end: '2026-08-31' }] }
assert.deepEqual(validateCalendarProfile(spain), [])
assert.equal(seasonEndYear(spain, 2026), 2027)
assert.equal(isInPeriod('2026-12-25', spain.breaks), true)
assert.equal(validateCalendarProfile({ ...spain, breaks: [{ start: '2026-02-30', end: '2026-03-01' }] }).length, 1)
const train = { id: 'training', date: '2026-08-12', slots: ['morning'] as const, kind: 'training' as const,
  title: 'Training', required: true }
const first = scheduleProActivity([], { ...train, slots: [...train.slots] })
assert.equal(first.accepted, true)
if (!first.accepted) throw new Error('Expected accepted training')
assert.deepEqual(scheduleProActivity(first.activities, { ...train, id: 'media', kind: 'media', slots: ['afternoon'] }),
  { accepted: true, activities: [...first.activities, { ...train, id: 'media', kind: 'media', slots: ['afternoon'] }] })
assert.deepEqual(scheduleProActivity(first.activities, { ...train, id: 'match', kind: 'match', slots: ['morning', 'afternoon'] }),
  { accepted: false, conflictingIds: ['training'] })
assert.throws(() => createEmptyProWorld('2026-02-30'))

// Read a V20 save directly from disk, then ensure the new boundary does not
// turn the career pro, replace its player, or overwrite its youth calendar.
const oldSave = { schemaVersion: 8, slotId: 0, savedAt: '2026-10-17T00:00:00.000Z',
  player: { id: 'existing-youth', name: 'Test', careerClock: { phase: 'academy', ageYears: 17, grassrootsSeason: null } },
  calendar: { currentWeek: { weekNumber: 39, seasonYear: 2, events: [] }, history: [] },
  league: null, academyLeague: null, cups: { ...EMPTY_CUPS }, international: null, pendingTraining: null }
await set('kickoff-star-save-0', oldSave)
const migrated = await readSave(0)
assert.equal(migrated?.schemaVersion, SAVE_SCHEMA_VERSION)
assert.equal(migrated?.proWorld, null)
assert.deepEqual(migrated?.player, oldSave.player)
assert.deepEqual(migrated?.calendar, oldSave.calendar)
await writeSave(migrated as SaveGame)
assert.equal((await readSave(0))?.calendar.currentWeek.weekNumber, 39)
await set('kickoff-star-save-1', { ...oldSave, slotId: 1, schemaVersion: 999 })
await assert.rejects(readSave(1), /newer version/)
console.log('Pro foundation: roster, affordability, dates, activity conflicts, V20 migration passed')
