import assert from 'node:assert/strict'
import { beginProTrial, type ProCareerState } from '../src/engine/proCareer'
import { createProWorld } from '../src/engine/proWorldFactory'
import { advanceProMedia, answerSponsor, launchSignatureBoot, PRO_SPONSORS, proposeSponsor, signatureBootEligible } from '../src/engine/proMedia'
const world = createProWorld(2026, '2026-01-01')
const club = Object.values(world.clubs)[0]
const player = Object.values(world.players).find(item => item.clubId === club.id)!
const base: ProCareerState = { ...beginProTrial('2026-01-01'), stage: 'signed', playerId: player.id, clubId: club.id,
  appearances: 35, reputation: 75, followers: 20000, contract: { currency: 'USD' } as ProCareerState['contract'] }
assert.equal(PRO_SPONSORS.length, 60)
assert.equal(new Set(PRO_SPONSORS.map(item => item.id)).size, 60)
const offer = proposeSponsor(world, base)!
assert.ok(offer && offer.years >= 2 && offer.years <= 5)
const accepted = answerSponsor({ ...base, sponsorOffers: [offer] }, offer.id, true)
assert.equal(accepted.sponsorDeals?.[0].status, 'active')
assert.throws(() => answerSponsor(accepted, offer.id, true))
const month = advanceProMedia(world, accepted, '2026-02-01', true, true, false)
assert.ok((month.followers ?? 0) > base.followers!)
assert.ok((month.wallets?.USD ?? 0) > 0)
const resumed = advanceProMedia(structuredClone(world), structuredClone(accepted), '2026-02-01', true, true, false)
assert.deepEqual(month, resumed)
assert.equal(signatureBootEligible(base), false)
const bootSponsor = PRO_SPONSORS.find(item => item.category === 'Boots')!
const star = { ...base, appearances: 130, reputation: 90, followers: 150000,
  sponsorDeals: [{ ...offer, sponsorId: bootSponsor.id, status: 'active' as const }] }
assert.equal(signatureBootEligible(star), true)
assert.equal(launchSignatureBoot(star, 'The Comet').signatureBoot?.name, 'The Comet')
assert.throws(() => launchSignatureBoot(star, 'x'))
console.log('Pro Phase 5: sponsor eligibility, 60 profiles, terms, payouts, audience, signature boots and resume passed')
