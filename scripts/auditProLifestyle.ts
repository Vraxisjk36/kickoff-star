import assert from 'node:assert/strict'
import { LUXURY_CATALOG, weeklyLuxuryListings, purchaseLuxuryAsset, luxuryNetWorth, luxuryWeeklyUpkeep } from '../src/engine/proLifestyle'
import type { LuxuryKind } from '../src/engine/proLifestyle'
for(const [kind,count,weekly] of [['house',70,7],['car',40,6],['plane',20,4],['boat',20,4]] as [LuxuryKind,number,number][]){
 const catalog=LUXURY_CATALOG.filter(x=>x.kind===kind)
 assert.equal(catalog.length,count)
 assert.equal(new Set(catalog.map(x=>x.name)).size,count)
 assert.ok(catalog.every(x=>x.price>0&&x.upkeepWeekly>=0))
 assert.ok(catalog[0].price<catalog[count-1].price)
 const current=weeklyLuxuryListings(kind,3,12,'player-one')
 assert.equal(current.length,weekly)
 assert.deepEqual(current,weeklyLuxuryListings(kind,3,12,'player-one'))
 assert.equal(new Set(current.map(x=>x.id)).size,weekly)
 const next=weeklyLuxuryListings(kind,3,13,'player-one')
 assert.notDeepEqual(current,next,'Listings must rotate weekly')
 const item=current[0]
 assert.equal(purchaseLuxuryAsset(item.price-1,[],item.id,3,12,'player-one').error,'Insufficient funds')
 const purchased=purchaseLuxuryAsset(item.price+500,[],item.id,3,12,'player-one')
 assert.equal(purchased.money,500)
 assert.equal(purchased.assets.length,1)
 assert.equal(luxuryNetWorth(purchased.assets),item.price)
 assert.equal(luxuryWeeklyUpkeep(purchased.assets),item.upkeepWeekly)
 assert.equal(purchaseLuxuryAsset(1e9,purchased.assets,item.id,3,12,'player-one').error,'Already owned')
 assert.ok(!weeklyLuxuryListings(kind,3,12,'player-one',purchased.assets).some(x=>x.id===item.id))
 const hidden=catalog.find(x=>!current.some(y=>y.id===x.id))!
 assert.equal(purchaseLuxuryAsset(1e9,[],hidden.id,3,12,'player-one').error,'Listing is no longer available')
}
assert.equal(LUXURY_CATALOG.length,150)
console.log('Lifestyle: 70 houses, 40 named cars, 20 aircraft, 20 boats; weekly rotations, pricing, ownership and purchase safeguards passed')
