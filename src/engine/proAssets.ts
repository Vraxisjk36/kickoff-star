import type { ProCareerState } from './proCareer'
import type { ProResidence } from './proContracts'

export type AssetCategory = 'homes' | 'cars' | 'planes' | 'helicopters' | 'islands' | 'boats' | 'art' | 'boots' | 'hotels' | 'businesses'
export type AssetPayment = 'cash' | 'finance'
export interface AssetDefinition {
  id: string; category: AssetCategory; name: string; description: string; price: number; upkeep: number
  feature: string; location?: string; helipad?: boolean; garage?: boolean; hangar?: boolean; marina?: boolean; yieldRate?: number; bonus?: number
}
export interface OwnedAsset {
  id: string; acquired: string; paid: number; condition: number; debt: number; monthlyPayment: number
  remainingMonths: number; missedPayments: number; active?: boolean; primary?: boolean
}
export interface AssetStatement { date: string; amount: number; description: string }
const groups: { category: AssetCategory; count: number; prefix: string[]; noun: string[]; base: number; growth: number; upkeep: number; visible: number }[] = [
  { category: 'homes', count: 100, prefix: ['Willowbank', 'Copperfield', 'Cedar Gate', 'Rosemere', 'Harbour View', 'Northlight', 'Glasshouse', 'Kingfisher', 'Stonehaven', 'Amber Court'], noun: ['Apartment', 'Townhouse', 'Penthouse', 'Villa', 'Manor', 'Ranch', 'Estate', 'Mews', 'Loft', 'Residence'], base: 12000000, growth: 1.105, upkeep: .002, visible: 9 },
  { category: 'cars', count: 100, prefix: ['Aster', 'Veylan', 'Orion', 'Ravenna', 'Kairo', 'Solace', 'Vesper', 'Ardent', 'Meridian', 'Noble'], noun: ['Sprint', 'Tourer', 'GT', 'Cross', 'Electric', 'Sport', 'Coupe', 'Roadster', 'Grand', 'Track'], base: 900000, growth: 1.09, upkeep: .008, visible: 12 },
  { category: 'planes', count: 40, prefix: ['Aquila', 'Boreal', 'Celeste', 'Altair', 'Cirrus', 'Peregrine', 'Nimbus', 'Sirocco', 'Avalon', 'Argent'], noun: ['Lightjet', 'Executive', 'Range', 'Continental'], base: 200000000, growth: 1.13, upkeep: .018, visible: 6 },
  { category: 'helicopters', count: 20, prefix: ['Skylark', 'Osprey', 'Halcyon', 'Kestrel', 'Aerial'], noun: ['Scout', 'Twin', 'Executive', 'Grand'], base: 35000000, growth: 1.12, upkeep: .016, visible: 4 },
  { category: 'islands', count: 20, prefix: ['Azure', 'Crescent', 'Northwind', 'Pearl', 'Sapphire'], noun: ['Cay', 'Atoll', 'Isle', 'Retreat'], base: 600000000, growth: 1.12, upkeep: .006, visible: 3 },
  { category: 'boats', count: 50, prefix: ['Mariner', 'Tidal', 'Seabright', 'Bluewater', 'Pelagic', 'Solstice', 'Drift', 'Calypso', 'Waypoint', 'Oceanus'], noun: ['Dayboat', 'Sloop', 'Cruiser', 'Yacht', 'Explorer'], base: 7000000, growth: 1.14, upkeep: .014, visible: 8 },
  { category: 'art', count: 40, prefix: ['The Last', 'After', 'Study of', 'A View of', 'Before', 'Portrait of', 'Light on', 'Echoes of', 'The Quiet', 'Beneath'], noun: ['Summer', 'Rain', 'The Harbour', 'Home', 'The Pitch', 'Midnight', 'The City', 'The Coast', 'Winter', 'Tomorrow'], base: 800000, growth: 1.12, upkeep: .001, visible: 6 },
  { category: 'boots', count: 20, prefix: ['Striker', 'Tempo', 'Pace', 'Control', 'Apex'], noun: ['V1', 'V2', 'Elite', 'Pro'], base: 20000, growth: 1.18, upkeep: 0, visible: 5 },
  { category: 'hotels', count: 20, prefix: ['The Meridian', 'The Beaumont', 'The Crescent', 'The Langford', 'The Haven'], noun: ['Suites', 'Hotel', 'Retreat', 'House'], base: 85000000, growth: 1.14, upkeep: .009, visible: 4 },
  { category: 'businesses', count: 30, prefix: ['Greenline', 'Northstar', 'First Eleven', 'Verde', 'Crown', 'Summit', 'Origins', 'Union', 'Luma', 'Harbour'], noun: ['Fitness', 'Coffee', 'Studios'], base: 3500000, growth: 1.16, upkeep: .01, visible: 6 },
]
const story = { homes: ['A private garden and quiet recovery space.', 'A city address with room for family.', 'A secluded retreat for a demanding season.'], cars: ['Built for the daily training commute.', 'A touring cabin with long-distance comfort.', 'A track-inspired machine for days off.'], planes: ['A cabin designed for extended travel.', 'Long range travel with a compact crew.', 'A quiet executive layout.'], helicopters: ['Short city-to-city hops.', 'A compact rotorcraft for quick travel.', 'An executive cabin above the traffic.'], islands: ['A private shoreline and protected landing.', 'A remote retreat with room to develop.', 'An untouched coastal hideaway.'], boats: ['Made for weekend coastal passages.', 'Open deck space and sheltered cabins.', 'A long-range vessel for time away.'], art: ['An original piece with a quiet football reference.', 'A one-off work from an independent artist.', 'A gallery piece with bold colour.'], boots: ['A lightweight fit for quick touches.', 'A structured upper for close control.', 'Match footwear built for comfort.'], hotels: ['A hospitality operation with seasonal occupancy.', 'A small hotel with a dedicated staff.', 'An established property with renovation potential.'], businesses: ['A local operation with room to grow.', 'A team of staff and a loyal customer base.', 'A venture where monthly performance can vary.'] } as const
const locations = ['London', 'Cape Town', 'Madrid', 'Paris', 'Lisbon', 'São Paulo', 'Lagos', 'Tokyo', 'New York', 'Milan']
export const ASSET_CATALOG: AssetDefinition[] = groups.flatMap(group => Array.from({ length: group.count }, (_, index) => {
  const tier = Math.floor(index / group.prefix.length)
  const price = Math.round(group.base * group.growth ** index)
  const location = ['homes', 'hotels', 'islands'].includes(group.category) ? locations[index % locations.length] : undefined
  const name = `${group.prefix[index % group.prefix.length]} ${group.noun[tier % group.noun.length]}${group.category === 'art' ? ` · ${['M. Vale', 'A. Dlamini', 'E. Moreau', 'R. Silva'][index % 4]}` : ''}`
  const feature = group.category === 'homes' ? `${2 + tier % 7} bedrooms · ${90 + tier * 35} m²${tier >= 5 ? ' · helipad' : ''}`
    : group.category === 'cars' ? `${110 + tier * 35} kW · ${2 + tier % 5} seats · ${index % 3 === 0 ? 'electric' : 'petrol'}`
    : group.category === 'planes' ? `${4 + tier * 2} seats · ${1200 + tier * 900} km range`
    : group.category === 'helicopters' ? `${3 + tier * 2} seats · ${350 + tier * 120} km range`
    : group.category === 'boats' ? `${6 + tier * 3} berths · ${8 + tier * 3} m length`
    : group.category === 'islands' ? `${2 + tier * 4} hectares · private jetty`
    : group.category === 'art' ? `${['oil on canvas', 'mixed media', 'watercolour', 'sculpture'][tier % 4]} · edition of one`
    : group.category === 'boots' ? `${['finishing', 'first touch', 'acceleration', 'stability'][tier % 4]} fit · ${200 + tier * 25} g`
    : `${group.category === 'hotels' ? 18 + tier * 12 + ' rooms' : 3 + tier * 5 + ' staff'} · ${['established', 'growing', 'renovated'][tier % 3]}`
  return { id: `${group.category}-${index + 1}`, category: group.category, name, location,
    description: `${location ? `${location} · ` : ''}${feature}. ${story[group.category][index % 3]} ${['Private sale', 'Agent listing', 'Owner listing'][index % 3]}.`, feature,
    price, upkeep: Math.round(price * group.upkeep), helipad: group.category === 'homes' && tier >= 5, garage: group.category === 'homes' && tier >= 2,
    hangar: group.category === 'homes' && tier >= 7, marina: group.category === 'islands' || group.category === 'homes' && tier >= 8,
    yieldRate: ['hotels', 'businesses'].includes(group.category) ? .014 + (index % 4) * .002 : undefined,
    bonus: group.category === 'boots' ? .03 + (tier % 3) * .02 : undefined }
}))
export const assetById = (id: string): AssetDefinition | undefined => {
  const [base, encodedCity] = id.split('@')
  const item = ASSET_CATALOG.find(entry => entry.id === base)
  return item && encodedCity && item.category === 'homes'
    ? { ...item, id, location: decodeURIComponent(encodedCity), name: `${item.name} · ${decodeURIComponent(encodedCity)}`, description: `${decodeURIComponent(encodedCity)} · ${item.feature}. ${story.homes[(Number(base.split('-')[1]) - 1) % 3]}` } : item
}
const hash = (value: string) => { let h = 2166136261; for (const char of value) h = Math.imul(h ^ char.charCodeAt(0), 16777619); return h >>> 0 }
const week = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / (7 * 86400000))
export function assetListings(career: ProCareerState, category: AssetCategory): AssetDefinition[] {
  const group = groups.find(item => item.category === category)!
  const owned = new Set((career.assets ?? []).map(item => item.id))
  const city = career.residence?.city
  const candidates = ASSET_CATALOG.filter(item => item.category === category)
    .sort((a, b) => hash(`${week(career.date)}:${category}:${a.id}`) - hash(`${week(career.date)}:${category}:${b.id}`))
  // Three of each week's homes are local to the current club. The city forms
  // part of their permanent ID, so a transfer never moves an owned home.
  return candidates.map((item, index) => category === 'homes' && city && index < 3
    ? assetById(`${item.id}@${encodeURIComponent(city)}`)! : item)
    .filter(item => !owned.has(item.id)).slice(0, group.visible)
}
export function assetFacilities(career: ProCareerState): string[] {
  const owned = (career.assets ?? []).map(asset => assetById(asset.id)).filter((item): item is AssetDefinition => !!item)
  return ['garage', 'hangar', 'helipad', 'marina'].filter(facility => owned.some(item => !!item[facility as keyof AssetDefinition]))
}
// Fixed fictional game exchange units per USD. Never shown as a live financial quote.
const units: Record<string, number> = { USD: 1, EUR: .91, GBP: .78, ZAR: 18.5, BRL: 5.1, NGN: 1400, INR: 84, JPY: 148, KRW: 1350, CNY: 7.2, MXN: 17.2, CAD: 1.36, AUD: 1.52, CHF: .88, AED: 3.67, SAR: 3.75, TRY: 34, SEK: 10.5, NOK: 10.8, DKK: 6.8, PLN: 4, CZK: 23, HUF: 360, RUB: 92, ARS: 1000, CLP: 940, COP: 4200, PEN: 3.7, UYU: 40, EGP: 49, MAD: 10, TND: 3.1, GHS: 15, KES: 130, TZS: 2600, UGX: 3700, IDR: 15500, THB: 35, VND: 25000, MYR: 4.5, SGD: 1.35, NZD: 1.65, ILS: 3.7, QAR: 3.64, KWD: .31, BHD: .38 }
export function gameCurrencyUnits(code: string): number { return units[code] ?? 1 }
export function assetPriceInCurrency(usdMinor: number, code: string): number { return Math.round(usdMinor * gameCurrencyUnits(code)) }
const activeCurrency = (career: ProCareerState) => career.contract?.currency ?? 'USD'
const statement = (career: ProCareerState, amount: number, description: string): AssetStatement[] =>
  [...(career.assetStatements ?? []), { date: career.date, amount, description }].slice(-60)
function charge(career: ProCareerState, amountUsd: number): { wallets: Record<string, number>; spent: number } {
  const currency = activeCurrency(career)
  const wallets = { ...(career.wallets ?? {}) }
  let due = assetPriceInCurrency(amountUsd, currency)
  if ((wallets[currency] ?? 0) < due) {
    for (const [code, balance] of Object.entries(wallets)) {
      if (code === currency || balance <= 0 || due <= (wallets[currency] ?? 0)) continue
      const shortfall = due - (wallets[currency] ?? 0)
      const exchanged = Math.min(balance, Math.ceil(shortfall / gameCurrencyUnits(currency) * gameCurrencyUnits(code) / .98))
      wallets[code] -= exchanged
      wallets[currency] = (wallets[currency] ?? 0) + Math.floor(exchanged / gameCurrencyUnits(code) * gameCurrencyUnits(currency) * .98)
    }
  }
  if ((wallets[currency] ?? 0) < due) throw new Error('Insufficient funds across your wallets')
  wallets[currency] -= due
  return { wallets, spent: due }
}
function updateWallet(career: ProCareerState, wallets: Record<string, number>): ProCareerState {
  return { ...career, wallets, balance: wallets[activeCurrency(career)] ?? 0 }
}
export function buyProAsset(career: ProCareerState, id: string, method: AssetPayment): ProCareerState {
  if (career.stage !== 'signed') throw new Error('Assets are available after signing a professional contract')
  const item = assetListings(career, assetById(id)?.category ?? 'homes').find(entry => entry.id === id)
  if (!item) throw new Error('This listing is no longer available')
  if (item.category === 'helicopters' && !assetFacilities(career).includes('helipad'))
    throw new Error('Own a home with a helipad before buying a helicopter')
  if (method === 'finance' && ['boots', 'art', 'islands'].includes(item.category)) throw new Error('Finance is unavailable for this listing')
  const months = method === 'finance' ? item.category === 'homes' ? 240 : ['hotels', 'businesses'].includes(item.category) ? 120 : 48 : 0
  const deposit = months ? Math.round(item.price * .3) : item.price
  const debt = item.price - deposit
  const monthlyPayment = months ? paymentFor(debt, months) : 0
  const wageUsd = (career.contract?.annualWage ?? 0) / gameCurrencyUnits(activeCurrency(career)) / 12
  const commitments = (career.assets ?? []).reduce((sum, owned) => sum + owned.monthlyPayment, 0)
  if (months && monthlyPayment + commitments > Math.max(wageUsd * .38, 200000)) throw new Error('Monthly repayments exceed your contract affordability limit')
  const { wallets, spent } = charge(career, deposit)
  const owned: OwnedAsset = { id, acquired: career.date, paid: item.price, condition: 100, debt, monthlyPayment, remainingMonths: months, missedPayments: 0,
    primary: false, active: item.category === 'boots' && !(career.assets ?? []).some(asset => asset.active && assetById(asset.id)?.category === 'boots') }
  return { ...updateWallet(career, wallets), assets: [...(career.assets ?? []), owned],
    assetStatements: statement(career, -spent, `${method === 'finance' ? 'Deposit' : 'Purchase'} · ${item.name} (${activeCurrency(career)})`) }
}
const interest = .006
function paymentFor(debt: number, months: number): number {
  return months ? Math.ceil(debt * interest / (1 - (1 + interest) ** -months)) : 0
}
export function assetSaleQuote(career: ProCareerState, id: string): { market: number; debt: number; proceeds: number } {
  const owned = (career.assets ?? []).find(item => item.id === id)
  const item = assetById(id)
  if (!owned || !item) throw new Error('Asset not owned')
  const age = Math.max(0, (Date.parse(`${career.date}T00:00:00Z`) - Date.parse(`${owned.acquired}T00:00:00Z`)) / 31557600000)
  const market = Math.round(owned.paid * (['homes', 'art', 'islands'].includes(item.category) ? 1 + Math.min(age, 15) * .012 : Math.max(.24, 1 - age * .095)) * owned.condition / 100 * .94)
  return { market, debt: owned.debt, proceeds: market - owned.debt }
}
export function sellProAsset(career: ProCareerState, id: string): ProCareerState {
  const item = assetById(id)
  const quote = assetSaleQuote(career, id)
  if (quote.proceeds < 0) throw new Error('Sale would not cover the outstanding loan; pay it down first')
  const currency = activeCurrency(career)
  const wallets = { ...(career.wallets ?? {}), [currency]: (career.wallets?.[currency] ?? 0) + assetPriceInCurrency(quote.proceeds, currency) }
  const wasPrimary = career.assets!.find(asset => asset.id === id)?.primary
  const residence = career.residence && wasPrimary
    ? { ...career.residence, monthlyRent: Math.max(5000, Math.round(quote.market * .004 * gameCurrencyUnits(currency))) } : career.residence
  return { ...updateWallet(career, wallets), residence, assets: career.assets!.filter(asset => asset.id !== id),
    assetStatements: statement(career, assetPriceInCurrency(quote.proceeds, currency), `Sale · ${item!.name} · loan cleared (${currency})`) }
}
export function payOffProAsset(career: ProCareerState, id: string): ProCareerState {
  const owned = career.assets?.find(asset => asset.id === id)
  if (!owned?.debt) throw new Error('No outstanding loan')
  const { wallets, spent } = charge(career, owned.debt)
  return { ...updateWallet(career, wallets), assets: career.assets!.map(asset => asset.id === id
    ? { ...asset, debt: 0, monthlyPayment: 0, remainingMonths: 0, missedPayments: 0 } : asset),
    assetStatements: statement(career, -spent, `Loan paid off · ${assetById(id)?.name} (${activeCurrency(career)})`) }
}
export function refinanceProAsset(career: ProCareerState, id: string): ProCareerState {
  const owned = career.assets?.find(asset => asset.id === id)
  if (!owned?.debt || owned.missedPayments || owned.remainingMonths < 12) throw new Error('This loan is not eligible for refinancing')
  const wageUsd = (career.contract?.annualWage ?? 0) / gameCurrencyUnits(activeCurrency(career)) / 12
  const months = Math.min(240, owned.remainingMonths + 24)
  const monthlyPayment = paymentFor(owned.debt, months)
  const otherPayments = (career.assets ?? []).filter(asset => asset.id !== id).reduce((sum, asset) => sum + asset.monthlyPayment, 0)
  if (monthlyPayment + otherPayments > Math.max(wageUsd * .38, 200000)) throw new Error('New repayment exceeds your affordability limit')
  const fee = Math.ceil(owned.debt * .01)
  const { wallets, spent } = charge(career, fee)
  return { ...updateWallet(career, wallets), assets: career.assets!.map(asset => asset.id === id ? { ...asset, monthlyPayment, remainingMonths: months } : asset),
    assetStatements: statement(career, -spent, `Refinancing fee · ${assetById(id)?.name} · ${months} months (${activeCurrency(career)})`) }
}
export function equipProAsset(career: ProCareerState, id: string): ProCareerState {
  const item = assetById(id)
  if (!(career.assets ?? []).some(asset => asset.id === id) || !item) throw new Error('Asset not owned')
  if (item.category === 'homes') {
    if (item.location !== career.residence?.city) throw new Error('This home is in another city; your current club still needs local housing')
    return { ...career, residence: { ...career.residence!, monthlyRent: 0, hotelUntil: null },
      assets: career.assets!.map(asset => ({ ...asset, primary: asset.id === id })) }
  }
  if (item.category !== 'boots') throw new Error('This asset has no active equipment setting')
  return { ...career, assets: career.assets!.map(asset => ({ ...asset, active: asset.id === id && asset.condition >= 15 })) }
}
export function settleAssetMonth(career: ProCareerState, date: string): ProCareerState {
  if (!career.assets?.length || career.assetSettledMonth === date.slice(0, 7)) return career
  const currency = activeCurrency(career)
  let wallets = { ...(career.wallets ?? {}) }
  const entries: AssetStatement[] = []
  const facilities = assetFacilities(career)
  const retained: OwnedAsset[] = []
  let deficiency = career.assetDeficiency ?? 0
  for (const owned of career.assets) {
    const item = assetById(owned.id)
    if (!item) continue
    const roll = hash(`${date.slice(0, 7)}:${item.id}`) % 100
    // Occupancy and sales can slump. Some ventures lose money even before debt.
    const outcome = roll < 18 ? .25 : roll < 35 ? .55 : roll < 80 ? 1 : 1.35
    const income = item.yieldRate ? Math.round(item.price * item.yieldRate * outcome) : 0
    const storage = item.category === 'planes' && !facilities.includes('hangar') ? Math.round(item.price * .002)
      : item.category === 'boats' && !facilities.includes('marina') ? Math.round(item.price * .001)
        : item.category === 'cars' && !facilities.includes('garage') ? Math.round(item.price * .0005) : 0
    const cost = item.upkeep + storage + (owned.debt ? owned.monthlyPayment : 0)
    const net = assetPriceInCurrency(income - cost, currency)
    let missedPayments = owned.missedPayments
    let debt = owned.debt
    let remainingMonths = owned.remainingMonths
    if (net < 0) {
      try {
        const charged = charge({ ...career, wallets }, cost - income)
        wallets = charged.wallets
      } catch {
        missedPayments++
        debt += Math.round(debt * interest)
        entries.push({ date, amount: 0, description: `Missed payment ${missedPayments}/3 · ${item.name} · ${currency}` })
      }
    } else wallets[currency] = (wallets[currency] ?? 0) + net
    if (missedPayments === owned.missedPayments) {
      missedPayments = 0
      if (debt) {
        const interestDue = Math.round(debt * interest)
        debt = Math.max(0, debt + interestDue - owned.monthlyPayment)
        remainingMonths = debt ? Math.max(1, remainingMonths - 1) : 0
      }
      entries.push({ date, amount: net, description: `${item.name} · ${income ? outcome < .6 ? 'slow month' : outcome > 1 ? 'strong month' : 'steady month' : 'ownership'} · income ${assetPriceInCurrency(income, currency)} · costs ${assetPriceInCurrency(cost, currency)} ${currency}` })
    }
    if (missedPayments >= 3) {
      const recovery = Math.round(assetSaleQuote({ ...career, assets: [owned], date }, owned.id).market * .75)
      deficiency += Math.max(0, debt - recovery)
      entries.push({ date, amount: 0, description: `Repossessed after three missed months · ${item.name}${debt > recovery ? ' · outstanding balance remains' : ''}` })
      if (owned.primary && career.residence) career = { ...career, residence: { ...career.residence, monthlyRent: Math.max(5000, Math.round(item.price * .004 * gameCurrencyUnits(currency))) } }
      continue
    }
    retained.push({ ...owned, debt, remainingMonths, missedPayments,
      monthlyPayment: debt ? owned.monthlyPayment : 0,
      condition: Math.max(25, owned.condition - (['cars', 'boats', 'planes', 'helicopters'].includes(item.category) ? 1 : 0)) })
  }
  if (deficiency && (wallets[currency] ?? 0) > 0) {
    const payment = Math.min(wallets[currency], assetPriceInCurrency(deficiency, currency))
    wallets[currency] -= payment
    deficiency = Math.max(0, deficiency - Math.floor(payment / gameCurrencyUnits(currency)))
    entries.push({ date, amount: -payment, description: `Outstanding repossession balance · ${currency}` })
  }
  return { ...updateWallet(career, wallets), assets: retained, assetDeficiency: deficiency,
    assetSettledMonth: date.slice(0, 7), assetStatements: [...(career.assetStatements ?? []), ...entries].slice(-60) }
}
export function relocateProAssets(career: ProCareerState, residence: ProResidence): Pick<ProCareerState, 'assets' | 'residence'> {
  const activeHome = career.assets?.find(asset => asset.primary && assetById(asset.id)?.location === residence.city)
  return { assets: career.assets?.map(asset => ({ ...asset, primary: asset.id === activeHome?.id })),
    residence: activeHome ? { ...residence, monthlyRent: 0, hotelUntil: null } : residence }
}
export function wearProBoot(career: ProCareerState): ProCareerState {
  return { ...career, assets: career.assets?.map(asset => asset.active && assetById(asset.id)?.category === 'boots'
    ? { ...asset, condition: Math.max(0, asset.condition - 1), active: asset.condition > 1 } : asset) }
}
export function activeBootBonus(career: ProCareerState): number {
  const boot = career.assets?.find(asset => asset.active && asset.condition >= 15 && assetById(asset.id)?.category === 'boots')
  return boot ? assetById(boot.id)?.bonus ?? 0 : 0
}
