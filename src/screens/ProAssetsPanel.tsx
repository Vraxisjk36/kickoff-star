import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import { assetById, assetFacilities, assetListings, assetPriceInCurrency, assetSaleQuote, type AssetCategory } from '../engine/proAssets'

const silhouettes: Record<AssetCategory, string> = {
  homes: 'M3 18V9l9-6 9 6v9h-6v-6H9v6H3z', cars: 'M4 15l2-6h12l2 6M3 15h18v4H3v-4zm4 4v2m10-2v2',
  planes: 'M2 13l8-2 2-8 2 8 8 2-8 2-2 6-2-6-8-2z', helicopters: 'M3 6h18M12 6v4m-5 4h10l3 4H7l-3-4zm3 4-2 3m12-3 2 3',
  islands: 'M2 18c5-3 15-3 20 0M7 16l5-9 5 9M12 7V3m-5 17h10', boats: 'M3 16h18l-3 5H6l-3-5zm9 0V3l7 11H7l5-11',
  art: 'M4 3h16v18H4V3zm3 14 4-5 3 3 3-5 2 7H7z', boots: 'M2 15l6-2 4 3 8 1v4H3l-1-6zm6-2V7m3 8V9',
  hotels: 'M4 21V4h16v17M8 8h2m4 0h2M8 12h2m4 0h2M9 21v-5h6v5', businesses: 'M3 21V8l9-5 9 5v13H3zm4-9h3m4 0h3M9 21v-5h6v5',
}
function AssetArtwork({ category, large = false }: { category: AssetCategory; large?: boolean }) {
  return <div aria-hidden="true" className={`relative overflow-hidden rounded-xl border border-ks-gold/20 bg-[radial-gradient(circle_at_70%_20%,#8c6b2670,transparent_55%),linear-gradient(140deg,#25291f,#0b1015)] ${large ? 'h-36' : 'h-20'} flex items-center justify-center`}>
    <div className="absolute w-48 h-48 rounded-full border border-ks-gold/15 -right-8 -top-16" />
    <div className="absolute w-32 h-32 rounded-full border border-ks-gold/15 -right-3 -top-8" />
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" className={`${large ? 'w-20 h-20' : 'w-12 h-12'} text-ks-gold drop-shadow-[0_0_18px_#b99a49]`}><path d={silhouettes[category]} /></svg>
    <span className="absolute bottom-2 left-3 text-[9px] uppercase tracking-[.25em] text-ks-gold/70">Kickoff Star · {category}</span>
  </div>
}
const categories: AssetCategory[] = ['homes', 'cars', 'planes', 'helicopters', 'islands', 'boats', 'art', 'boots', 'hotels', 'businesses']
export default function ProAssetsPanel() {
  const career = useCareerStore(state => state.proCareer)!
  const purchase = useCareerStore(state => state.purchaseProAsset)
  const sell = useCareerStore(state => state.sellOwnedProAsset)
  const activate = useCareerStore(state => state.activateProAsset)
  const payOff = useCareerStore(state => state.payOffOwnedProAsset)
  const refinance = useCareerStore(state => state.refinanceOwnedProAsset)
  const [category, setCategory] = useState<AssetCategory>('homes')
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const currency = career.contract?.currency ?? 'USD'
  const money = (usd: number) => `${currency} ${(assetPriceInCurrency(usd, currency) / 100).toLocaleString()}`
  const run = (task: () => void) => { try { task(); setError(''); setNotice('Portfolio updated.'); setSelected(null) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Transaction unavailable'); setNotice('') } }
  const listings = assetListings(career, category)
  const item = selected ? assetById(selected) : null
  const facilities = assetFacilities(career)
  return <section className="mt-8 rounded-3xl border border-ks-gold/40 bg-gradient-to-br from-[#201d15] to-[#0b100e] p-5">
    <div className="text-[10px] tracking-[.3em] text-ks-gold uppercase">The player's life</div>
    <h2 className="font-display text-3xl mt-2">Property & portfolio</h2>
    <p className="text-sm text-ks-muted mt-2">New listings each week. Prices and exchange units are fictional game values. Upkeep and repayments are charged monthly.</p>
    <div className="flex flex-wrap gap-2 mt-4">{["garage", "hangar", "helipad", "marina"].map(name => <span key={name} className={`text-[10px] uppercase tracking-widest rounded-full border px-3 py-2 ${facilities.includes(name) ? "border-ks-gold text-ks-gold" : "border-ks-border text-ks-muted"}`}>{name} {facilities.includes(name) ? "✓" : "—"}</span>)}</div>
    <div className="flex gap-2 overflow-x-auto py-4" aria-label="Asset categories">{categories.map(name => <button key={name} type="button" aria-pressed={category === name} onClick={() => { setCategory(name); setSelected(null) }} className={`shrink-0 rounded-full px-4 min-h-11 text-sm border capitalize ${category === name ? 'bg-ks-gold border-ks-gold text-ks-black' : 'border-ks-border'}`}>{name}</button>)}</div>
    {error && <p role="alert" className="text-red-300 text-sm mb-3">{error}</p>}{notice && <p role="status" className="text-ks-gold text-sm mb-3">{notice}</p>}
    <p className="text-xs text-ks-muted mb-3">{listings.length} {category} available this week · Wallet {currency} {((career.wallets?.[currency] ?? 0) / 100).toLocaleString()}</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{listings.map(listing => <button key={listing.id} type="button" onClick={() => { setSelected(listing.id); setError('') }} className={`rounded-2xl border p-3 text-left min-h-28 ${selected === listing.id ? 'border-ks-gold bg-ks-gold/10' : 'border-ks-border bg-white/[.03]'}`}><AssetArtwork category={listing.category} /><span className="block text-[10px] text-ks-gold uppercase tracking-widest mt-3">{listing.location ?? listing.category}</span><strong className="block mt-2 font-display text-lg">{listing.name}</strong><span className="block text-xs text-ks-muted mt-1">{listing.feature}</span><span className="block text-ks-gold text-sm mt-2">{money(listing.price)}</span></button>)}</div>
    {item && <div className="rounded-2xl border border-ks-gold/60 p-5 mt-4 bg-black/30"><AssetArtwork category={item.category} large /><h3 className="font-display text-2xl mt-4">{item.name}</h3><p className="text-sm text-ks-muted mt-2">{item.description}</p><p className="text-sm mt-3">Monthly upkeep {money(item.upkeep)}{item.yieldRate ? ` · Potential gross income varies around ${money(Math.round(item.price * item.yieldRate))} monthly` : ''}</p>{item.category === 'helicopters' && <p className="text-xs text-ks-gold mt-2">Requires an owned home with a helipad.</p>}
      <div className="flex flex-wrap gap-2 mt-4"><button className="rounded-xl bg-ks-gold text-ks-black px-4 min-h-11" onClick={() => run(() => purchase(item.id, 'cash'))}>Buy cash · {money(item.price)}</button>{!['art','boots','islands'].includes(item.category) && <button className="rounded-xl border border-ks-gold px-4 min-h-11" onClick={() => run(() => purchase(item.id, 'finance'))}>Finance · 30% down</button>}</div></div>}
    {!!career.assetDeficiency && <p className="mt-5 text-sm text-red-300">Outstanding repossession balance: {money(career.assetDeficiency)}. Future earnings will settle this first.</p>}
    {!!career.assets?.length && <div className="border-t border-ks-border mt-6 pt-5"><h3 className="font-display text-xl text-ks-gold">Owned assets · {career.assets.length}</h3><p className="text-xs text-ks-muted mt-1">Property stays in its city when you change clubs. Vehicles without a matching facility have monthly storage costs.</p>{career.assets.map(owned => { const asset = assetById(owned.id); if (!asset) return null; const quote = assetSaleQuote(career, asset.id); return <article key={owned.id} className="py-4 border-b border-ks-border"><div className="flex justify-between gap-3"><strong>{asset.name}</strong><span className="text-xs text-ks-muted">Condition {owned.condition}%{owned.primary ? " · primary home" : ""}{owned.active ? " · equipped" : ""}</span></div><p className="text-xs text-ks-muted mt-1">{asset.location ?? asset.feature} · upkeep {money(asset.upkeep)}/mo {owned.debt > 0 ? ` · debt ${money(owned.debt)} · payment ${money(owned.monthlyPayment)}/mo` : ''}{owned.missedPayments ? ` · missed ${owned.missedPayments}/3` : ''}</p><p className="text-xs text-ks-muted mt-1">Sale quote: {money(quote.market)} market − {money(quote.debt)} debt = {money(quote.proceeds)} to you</p><div className="flex flex-wrap gap-3 mt-2">{(asset.category === 'boots' || asset.category === 'homes') && <button className="text-xs text-ks-gold min-h-10" onClick={() => run(() => activate(asset.id))}>{asset.category === 'boots' ? owned.active ? 'Equipped' : 'Equip boots' : 'Move in'}</button>}<button className="text-xs text-ks-muted min-h-10" onClick={() => run(() => sell(asset.id))}>Sell asset</button>{owned.debt > 0 && <><button className="text-xs text-ks-gold min-h-10" onClick={() => run(() => payOff(asset.id))}>Pay off {money(owned.debt)}</button><button className="text-xs text-ks-gold min-h-10" onClick={() => run(() => refinance(asset.id))}>Refinance</button></>}</div></article> })}</div>}
    {!!career.assetStatements?.length && <details className="mt-5"><summary className="text-xs text-ks-gold cursor-pointer">Recent portfolio activity</summary>{career.assetStatements.slice(-8).reverse().map((entry, index) => <p key={`${entry.date}-${entry.description}-${index}`} className="text-xs text-ks-muted border-b border-ks-border py-2">{entry.date} · {entry.description} · {currency} {(entry.amount / 100).toLocaleString()}</p>)}</details>}
  </section>
}
