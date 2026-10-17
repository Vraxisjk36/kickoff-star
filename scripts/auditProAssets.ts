import assert from 'node:assert/strict'
import { ASSET_CATALOG, activeBootBonus, assetListings, assetSaleQuote, buyProAsset, equipProAsset, payOffProAsset, refinanceProAsset, relocateProAssets, sellProAsset, settleAssetMonth, wearProBoot } from '../src/engine/proAssets'
import { beginProTrial } from '../src/engine/proCareer'

const counts = { homes: 100, cars: 100, planes: 40, helicopters: 20, islands: 20, boats: 50, art: 40, boots: 20, hotels: 20, businesses: 30 }
for (const [category, count] of Object.entries(counts)) assert.equal(ASSET_CATALOG.filter(item => item.category === category).length, count)
assert.equal(new Set(ASSET_CATALOG.map(item => item.id)).size, ASSET_CATALOG.length)
assert.equal(new Set(ASSET_CATALOG.map(item => item.name)).size, ASSET_CATALOG.length)
let career = { ...beginProTrial('2026-10-01'), stage: 'signed' as const, contract: { currency: 'USD', annualWage: 2000000000 }, wallets: { USD: 1000000000000 }, balance: 1000000000000 }
const first = assetListings(career, 'homes')
assert.equal(first.length, 9)
assert.deepEqual(first, assetListings(career, 'homes'))
assert.notDeepEqual(first.map(item => item.id), assetListings({ ...career, date: '2026-10-12' }, 'homes').map(item => item.id))
career = buyProAsset(career, first[0].id, 'cash')
assert.equal(career.assets?.length, 1)
assert(!assetListings(career, 'homes').some(item => item.id === first[0].id))
assert.throws(() => buyProAsset(career, first[0].id, 'cash'))
assert.throws(() => buyProAsset({ ...career, assets: [] }, assetListings(career, 'helicopters')[0].id, 'cash'), /helipad/)
const cashAfterHome = career.wallets!.USD
career = settleAssetMonth(career, '2026-10-31')
assert(career.wallets!.USD < cashAfterHome)
assert.equal(settleAssetMonth(career, '2026-10-31').wallets!.USD, career.wallets!.USD)
career = sellProAsset(career, first[0].id)
assert.equal(career.assets?.length, 0)
const boots = assetListings(career, 'boots')[0]
career = buyProAsset(career, boots.id, 'cash')
assert(activeBootBonus(career) > 0)
career = wearProBoot(career)
assert.equal(career.assets![0].condition, 99)
assert.throws(() => buyProAsset({ ...career, wallets: { USD: 0 } }, assetListings(career, 'planes')[0].id, 'cash'), /funds/)
const poor = { ...career, wallets: { USD: 1000000000000 }, contract: { ...career.contract, annualWage: 10000 } }
assert.throws(() => buyProAsset(poor, assetListings(poor, 'planes')[0].id, 'finance'), /affordability/)
assert.equal(JSON.parse(JSON.stringify(career)).assets.length, 1)
const local = { ...career, residence: { city: 'Johannesburg', associationId: 'rsa', monthlyRent: 180000, hotelUntil: null }, wallets: { ZAR: 10000000000000 }, contract: { ...career.contract, currency: 'ZAR', annualWage: 5000000000 } }
const localListing = assetListings(local, 'homes')[0]
assert.equal(localListing.location, 'Johannesburg')
const purchasedLocal = buyProAsset(local, localListing.id, 'cash')
const movedIn = equipProAsset(purchasedLocal, localListing.id)
assert.equal(movedIn.residence?.monthlyRent, 0)
assert.equal(movedIn.assets?.find(item => item.id === localListing.id)?.primary, true)
const transferred = relocateProAssets(movedIn, { city: 'Paris', associationId: 'fra', monthlyRent: 90000, hotelUntil: null })
assert.equal(transferred.assets!.find(item => item.id === localListing.id)?.primary, false)
assert.equal(transferred.residence?.monthlyRent, 90000)
const soldLocal = sellProAsset(movedIn, localListing.id)
assert(soldLocal.residence!.monthlyRent > 0)
const hotel = assetListings(career, 'hotels')[0]
const investor = buyProAsset({ ...career, wallets: { USD: 1000000000000 } }, hotel.id, 'cash')
const outcomes = Array.from({ length: 24 }, (_, index) => settleAssetMonth({ ...investor, assetSettledMonth: undefined }, `${2027 + Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}-28`).assetStatements!.at(-1)!.description)
assert(outcomes.some(text => text.includes('slow month')))
assert(outcomes.some(text => text.includes('strong month')))
const carListing = assetListings(career, 'cars')[0]
let financed = buyProAsset({ ...career, wallets: { USD: 1000000000000 } }, carListing.id, 'finance')
assert(financed.assets!.at(-1)!.debt > 0)
assert(assetSaleQuote(financed, carListing.id).proceeds < assetSaleQuote({ ...financed, assets: financed.assets!.map(item => item.id === carListing.id ? { ...item, debt: 0 } : item) }, carListing.id).proceeds)
const oldPayment = financed.assets!.at(-1)!.monthlyPayment
financed = refinanceProAsset(financed, carListing.id)
assert(financed.assets!.at(-1)!.monthlyPayment < oldPayment)
financed = payOffProAsset(financed, carListing.id)
assert.equal(financed.assets!.at(-1)!.debt, 0)
const noMoney = { ...buyProAsset({ ...career, wallets: { USD: 1000000000000 } }, carListing.id, 'finance'), wallets: { USD: 0 } }
let overdue = noMoney
for (const date of ['2026-11-30', '2026-12-31', '2027-01-31']) overdue = settleAssetMonth(overdue, date)
assert.equal(overdue.assets!.some(item => item.id === carListing.id), false)
assert(overdue.assetStatements!.some(item => item.description.includes('Repossessed')))
assert.equal(JSON.parse(JSON.stringify(overdue)).assets.length, 1)
console.log(`Pro asset audit passed: ${ASSET_CATALOG.length} unique items, rotating listings, ownership, upkeep, equipment and affordability.`)
