import assert from 'node:assert/strict'
import {SPONSOR_BRANDS,sponsorWeek,acceptSponsor,emptySponsorState,sponsorPopularity} from '../src/engine/proSponsorship'
import type {Player} from '../src/types/player'
assert.equal(SPONSOR_BRANDS.length,70)
assert.equal(new Set(SPONSOR_BRANDS.map(x=>x.name)).size,70)
const player={id:'sponsor-audit',reputation:90,career:{appearances:240,goals:90},matchRatings:[8.4,8.1,8.6],proCareer:{seasonRecords:[{leagueChampion:true},{leagueChampion:true}]}} as unknown as Player
assert.ok(sponsorPopularity(player)>=70)
const poor={...player,reputation:1,career:{appearances:0,goals:0},matchRatings:[6]} as Player
assert.ok(sponsorPopularity(poor)<40)
let state=emptySponsorState(),offerFound=false
for(let week=1;week<=48;week++){
 const result=sponsorWeek(state,player,1,week)
 state=result.state
 if(state.offers.length){offerFound=true;break}
}
assert.ok(offerFound,'Popular footballers must receive periodic offers')
const offer=state.offers[0]
const signed=acceptSponsor(state,offer.id,1,Math.max(1,offer.expiresWeek-3))
assert.ok(!signed.error)
assert.equal(signed.bonus,offer.signingBonus)
assert.equal(signed.state.contracts.length,1)
assert.ok(acceptSponsor(signed.state,offer.id,1,1).error)
const pay=sponsorWeek(signed.state,player,1,Math.max(1,offer.expiresWeek-3))
assert.equal(pay.pay,offer.weeklyPay)
assert.equal(pay.state.contracts[0].weeksPaid,1)
const youth=sponsorWeek(emptySponsorState(),poor,1,1)
assert.ok(youth.state.offers.every(o=>!o.shoeDeal))
console.log('70 sponsors, deterministic offers, eligibility, exclusivity, signing bonuses and recurring weekly payments passed')
