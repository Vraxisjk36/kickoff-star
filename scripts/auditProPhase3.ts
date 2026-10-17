import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { createProWorld } from '../src/engine/proWorldFactory'
import { advanceProWorldTo } from '../src/engine/proWorldSimulation'
import { growOrDecline, peakAge, rollMatchInjury, shouldRetire } from '../src/engine/proLifecycle'
import { advanceProDay, beginYouthProOffers, chooseProAgent, openProTalks, requestProCounter, signProOffer,
  availableProLoans, acceptProLoan, retireProCareer, availableProTransfers, openTransferTalks, completeProMove } from '../src/engine/proCareer'
import { gameWithholdingBps, settleProMonth } from '../src/engine/proContracts'
import { registrationOpen, returnProLoan } from '../src/engine/proMovement'
import { get, set } from 'idb-keyval'
import { readSave, SAVE_SCHEMA_VERSION } from '../src/engine/save'

const world = createProWorld(81, '2026-07-01')
assert.equal(peakAge('ST'), 26)
assert.equal(peakAge('GK'), 31)
const veteran = Object.values(world.players).find(player => player.clubId === 'club-eng-01')!
veteran.overall = 88
veteran.birthDate = '1986-06-15'
veteran.shirtNumber = 88
const veteranId = veteran.id
const beforeClub = Object.values(world.players).filter(player => player.clubId === veteran.clubId)
const next = advanceProWorldTo(world, '2027-07-01')
assert.ok(!next.players[veteranId], '41-year-old should retire')
const afterClub = Object.values(next.players).filter(player => player.clubId === veteran.clubId)
assert.equal(afterClub.length, beforeClub.length)
const arrival = afterClub.find(player => !beforeClub.some(old => old.id === player.id))!
assert.ok(arrival && arrival.overall !== 88, 'incoming player copied retired 88 rating')
assert.notEqual(arrival.shirtNumber, 88, 'incoming player inherited shirt 88')
assert.equal(arrival.position, veteran.position, 'successor must fill the vacant playing position')
assert.equal(next.retirementCount, next.academyGraduateCount + next.transferIntakeCount)
assert.ok(next.retirementHistory.some(record => record.id === veteranId && record.finalOverall === 88))
const late = { ...veteran, overall: 75, potential: 80, birthDate: '1990-06-15' }
growOrDecline(late, 2030, 81)
assert.ok(late.overall <= 75)
assert.equal(shouldRetire({ ...veteran, birthDate: '2000-06-15' }, 2027, 81), false)
assert.equal(registrationOpen('eng', '2026-07-01'), false)
assert.equal(registrationOpen('eng', '2026-08-15'), true)
assert.equal(registrationOpen('eng', '2027-01-15'), true)
assert.ok(gameWithholdingBps('rsa') > 0)

let career = chooseProAgent(beginYouthProOffers(world, world.currentDate, 'eng', 70), 'local')
career = openProTalks(world, career, career.offers[3].clubId)
assert.equal(career.talks?.status, 'pending')
assert.throws(() => signProOffer(world, career, career.talks!.clubId,
  { id: 'tester', name: 'Tester', nationalityId: 'eng', position: 'ST', overall: 50, age: 18 }))
let live = world
while (career.talks?.status === 'pending') { const result = advanceProDay(live, career, 'rest', 'eng'); live = result.world; career = result.career }
assert.equal(career.talks?.status, 'ready')
career = requestProCounter(live, career)
while (career.talks?.status === 'pending') { const result = advanceProDay(live, career, 'rest', 'eng'); live = result.world; career = result.career }
assert.equal(career.talks?.status, 'ready')
const signed = signProOffer(live, career, career.talks!.clubId,
  { id: 'tester', name: 'Tester', nationalityId: 'eng', position: 'ST', overall: 50, age: 18 }, career.agentId!)
live = signed.world; career = signed.career
assert.ok(career.contract && career.contract.appearanceBonus > 0 && career.contract.goalBonus > career.contract.appearanceBonus)
assert.equal(career.contract!.agentId, 'local')
assert.ok(career.residence?.hotelUntil)
const line = settleProMonth(career.contract!, live, '2026-07-31', 2000, career.residence!)
assert.equal(line.net, line.gross + line.bonus - line.estimatedWithholding - line.agentFee - line.housing)
assert.equal(line.currency, live.associations[live.clubs[career.clubId!].associationId].currency)
assert.ok(line.gross < Math.floor(career.contract!.annualWage / 12), 'first month must be prorated after midmonth signing')
const legacyWorld = { ...live, loans: undefined, retirementHistory: undefined, transferIntakeCount: undefined }
const legacyCareer = { ...career, wallets: undefined, ledger: undefined, residence: undefined }
await set('kickoff-star-save-1', { schemaVersion: SAVE_SCHEMA_VERSION, slotId: 1, savedAt: new Date().toISOString(),
  player: { id: 'legacy-pro' }, calendar: { currentWeek: { events: [] } }, cups: {}, proWorld: legacyWorld, proCareer: legacyCareer })
assert.equal((await readSave(1))?.proWorld?.loans && Object.keys((await readSave(1))!.proWorld!.loans).length, 0)
assert.deepEqual((await readSave(1))?.proCareer?.wallets, {})
assert.ok(await get('kickoff-star-save-1'))
const moneyBefore = career.balance
while (career.date <= '2026-08-15') {
  if (career.pendingEvent) { const { resolveProOpportunity } = await import('../src/engine/proCareer'); career = resolveProOpportunity(career, 0) }
  const result = advanceProDay(live, career, 'recover', 'eng'); live = result.world; career = result.career
}
assert.ok(career.ledger?.length && career.balance !== moneyBefore)
assert.equal(career.wallets?.GBP, career.balance)
const injuryPlayer = live.players[career.playerId!]
// Deterministic repeated exposures eventually produce a record; a previous
// hamstring remains visible after recovery and raises later simulated risk.
for (let day = 0; day < 2000 && !injuryPlayer.injuryHistory?.length; day++) {
  const date = new Date(Date.UTC(2027, 0, day + 1)).toISOString().slice(0, 10)
  rollMatchInjury(live, injuryPlayer, date, 20)
}
assert.ok(injuryPlayer.injuryHistory?.length && injuryPlayer.injuredUntil)
assert.throws(() => advanceProDay(live, { ...career, injuryUntil: career.date }, 'train', 'eng'),
  'training during recovery must be blocked in the engine')
const loans = availableProLoans(live, career)
assert.ok(loans.length, 'mid club should have a possible loan destination')
const soon = new Date(Date.parse(`${career.date}T00:00:00Z`) + 9 * 86400000).toISOString().slice(0, 10)
assert.equal(acceptProLoan(live, { ...career, contract: { ...career.contract!, expires: soon } }, loans[0]).career.loan?.ends,
  soon, 'a loan must not outlive the parent contract')
{
  const borrowed = acceptProLoan(live, career, loans[0])
  assert.equal(borrowed.world.players[career.playerId!].clubId, loans[0])
  assert.equal(borrowed.world.loans[career.playerId!].parentClubId, career.clubId)
  const atEnd = advanceProWorldTo(borrowed.world, borrowed.career.loan!.ends)
  const returned = returnProLoan(atEnd, career.playerId!, borrowed.career.loan!)
  assert.equal(returned.players[career.playerId!].clubId, career.clubId)
  assert.equal(returned.loans[career.playerId!], undefined)
}
const transferOffers = availableProTransfers(live, career)
assert.ok(transferOffers.length, 'open registration period should produce interest')
career = openTransferTalks(live, career, transferOffers[0].clubId)
while (career.talks?.status === 'pending') {
  if (career.pendingEvent) { const { resolveProOpportunity } = await import('../src/engine/proCareer'); career = resolveProOpportunity(career, 0) }
  const result = advanceProDay(live, career, 'rest', 'eng'); live = result.world; career = result.career
}
const moved = completeProMove(live, career)
assert.equal(moved.world.players[career.playerId!].clubId, transferOffers[0].clubId)
assert.equal(moved.career.clubId, transferOffers[0].clubId)
assert.equal(moved.career.contract?.clubId, transferOffers[0].clubId)
assert.equal(moved.career.residence?.city, moved.world.clubs[transferOffers[0].clubId].homeCity)
live = moved.world; career = moved.career
const expiryEve = new Date(Date.parse(`${career.contract!.expires}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)
live = advanceProWorldTo(live, expiryEve)
career = { ...career, date: expiryEve, talks: null, pendingEvent: null }
const expired = advanceProDay(live, career, 'rest', 'eng')
live = expired.world; career = expired.career
assert.equal(career.stage, 'offers', 'expired contract must open renewal')
assert.equal(career.ledger?.at(-1)?.date, expiryEve, 'final partial month must be paid on expiry')
assert.ok(career.offers.some(offer => offer.clubId === career.clubId))
career = openProTalks(live, career, career.clubId!)
while (career.talks?.status === 'pending') {
  const result = advanceProDay(live, career, 'rest', 'eng'); live = result.world; career = result.career
}
const renewed = signProOffer(live, career, career.clubId!,
  { id: 'tester', name: 'Tester', nationalityId: 'eng', position: 'ST', overall: 50, age: 20 }, career.agentId!)
assert.equal(renewed.world.players[career.playerId!].clubId, career.clubId)
assert.equal(renewed.career.stage, 'signed')
live = renewed.world; career = renewed.career
const retired = retireProCareer(live, career)
assert.equal(retired.career.stage, 'retired')
assert.equal(retired.world.players[career.playerId!].retirementChoice, true)
assert.throws(() => advanceProDay(retired.world, retired.career, 'train', 'eng'))
console.log(`Pro Phase 3: age curves, market succession, injuries, dated talks, contract, ledger, loans and retirement passed`)
