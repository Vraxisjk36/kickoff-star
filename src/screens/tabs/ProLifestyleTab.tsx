import { useState } from 'react'
import LuxuryAssetArt from './LuxuryAssetArt'
import type { Player } from '../../types/player'
import { useCareerStore } from '../../store/careerStore'
import { weeklyLuxuryListings, luxuryNetWorth, luxuryWeeklyUpkeep, type LuxuryKind, type LuxuryListing } from '../../engine/proLifestyle'

const KINDS: {id:LuxuryKind;label:string;icon:string}[] = [
  {id:'house',label:'Homes',icon:'⌂'},{id:'car',label:'Cars',icon:'◈'},
  {id:'plane',label:'Aircraft',icon:'✈'},{id:'boat',label:'Boats',icon:'⚓'},
]
const cash=(n:number)=>'£'+n.toLocaleString('en-GB')
export default function ProLifestyleTab({player}:{player:Player}){
  const pro=player.proCareer!
  const buy=useCareerStore(s=>s.buyLuxuryAsset)
  const [category,setCategory]=useState<LuxuryKind>('house')
  const [showAll,setShowAll]=useState(false)
  const [view,setView]=useState<'market'|'assets'>('market')
  const [message,setMessage]=useState('')
  const [selected,setSelected]=useState<LuxuryListing|null>(null)
  const assets=pro.luxuryAssets??[]
  const listings=weeklyLuxuryListings(category,pro.season,pro.week,player.id,assets)
  const owned=assets.filter(item=>item.kind===category)
  return <section className="rounded-2xl border border-ks-gold/20 bg-gradient-to-b from-[#171b14] to-[#0c0e0c] p-3 mb-4 shadow-[0_12px_32px_rgba(0,0,0,.25)]">
    <div className="flex justify-between items-center gap-2 mb-2">
      <div><p className="font-display text-ks-gold text-sm tracking-widest">LIFESTYLE & ASSETS</p>
      <p className="text-[10px] text-ks-muted">New listings each week · Season {pro.season}, Week {pro.week}</p></div>
      <span className="text-xs text-ks-gold font-display">{cash(player.money??0)}</span>
    </div>
    <div className="grid grid-cols-2 gap-2 rounded-lg border border-ks-border p-2 mb-3 text-[11px]">
      <div><span className="text-ks-muted">Asset value</span><p className="text-ks-gold">{cash(luxuryNetWorth(assets))}</p></div>
      <div><span className="text-ks-muted">Weekly maintenance</span><p className="text-ks-ink">{cash(luxuryWeeklyUpkeep(assets))}</p></div>
    </div>
    <div className="grid grid-cols-4 gap-1 mb-3">
      {KINDS.map(kind=><button key={kind.id} onClick={()=>{setCategory(kind.id);setMessage('');setShowAll(false)}} className={`rounded-lg border py-2 text-[10px] ${category===kind.id?'border-ks-gold text-ks-gold':'border-ks-border text-ks-muted'}`}>{kind.icon} {kind.label}</button>)}
    </div>
    <div className="grid grid-cols-2 gap-2 mb-3">
      <button onClick={()=>{setView('market');setShowAll(false)}} className={`rounded-md py-2 text-xs ${view==='market'?'bg-ks-gold text-ks-black':'border border-ks-border text-ks-muted'}`}>Weekly market</button>
      <button onClick={()=>{setView('assets');setShowAll(false)}} className={`rounded-md py-2 text-xs ${view==='assets'?'bg-ks-gold text-ks-black':'border border-ks-border text-ks-muted'}`}>My assets ({assets.length})</button>
    </div>
    {message&&<p role="status" className="text-xs text-ks-gold mb-3">{message}</p>}
    {view==='market'?<div className="grid grid-cols-2 gap-2">
      <p className="text-[10px] text-ks-muted">{listings.length} available this week. The market refreshes on the next game week.</p>
      {listings.slice(0,showAll?undefined:4).map(item=><div key={item.id} className="min-w-0 rounded-xl border border-ks-border/80 bg-black/25 p-2.5">
        <button className="block w-full text-left mb-2" onClick={()=>setSelected(item)} aria-label={`View details for ${item.name}`}><LuxuryAssetArt kind={item.kind} id={item.id}/></button>
        <p className="font-display text-ks-ink text-xs">{item.name}</p>
        <p className="text-[10px] text-ks-muted mt-1">{item.location} · Est. upkeep {cash(item.upkeepWeekly)}/week</p>
        <div className="flex flex-wrap justify-between items-center mt-2 gap-2">
          <strong className="text-ks-gold text-sm">{cash(item.price)}</strong>
          <button onClick={()=>setSelected(item)} className="border border-ks-border rounded-md px-2 py-2 text-[10px] text-ks-ink">DETAILS</button>
          <button disabled={(player.money??0)<item.price} onClick={()=>{const r=buy(item.id);setMessage(r.ok?`Purchased ${item.name} — added to My assets`:(r.reason??'Purchase unavailable'))}}
            className="bg-ks-gold text-ks-black rounded-md px-3 py-2 text-[10px] font-display disabled:opacity-40">BUY</button>
        </div>
      </div>)}
      {!listings.length&&<p className="text-xs text-ks-muted">You own every listing in this category.</p>}
    </div>:<div className="space-y-2">
      {owned.slice(0,showAll?undefined:4).map(item=><div key={item.id} className="rounded-lg border border-ks-border p-3">
        <LuxuryAssetArt kind={item.kind} id={item.id}/>
        <p className="text-xs text-ks-ink">{item.name}</p>
        <p className="text-[10px] text-ks-muted mt-1">{item.location} · Purchased season {item.purchasedSeason}, week {item.purchasedWeek}</p>
        <p className="text-ks-gold text-xs mt-1">{cash(item.price)}</p>
      </div>)}
      {!owned.length&&<p className="text-xs text-ks-muted">No {category==='house'?'properties':category==='plane'?'aircraft':category==='boat'?'boats':'cars'} owned yet.</p>}
    </div>}
    {!showAll && (view==='market'?listings.length:owned.length)>4 && <button onClick={()=>setShowAll(true)} className="w-full rounded-xl border border-ks-gold/30 bg-ks-gold/10 py-3 text-xs font-display text-ks-gold mt-3">EXPLORE ALL {view==='market'?listings.length:owned.length} {view==='market'?'LISTINGS':'ASSETS'} ↓</button>}
    {selected&&<div className="fixed inset-0 z-[90] bg-black/85 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={selected.name} onClick={()=>setSelected(null)}>
      <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-ks-gold/50 bg-[#111310] p-4 shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3"><span className="text-[10px] tracking-widest text-ks-gold">PRIVATE SHOWROOM</span><button aria-label="Close details" onClick={()=>setSelected(null)} className="text-ks-ink text-lg px-2">×</button></div>
        <LuxuryAssetArt kind={selected.kind} id={selected.id} large/>
        <h3 className="font-display text-ks-ink text-lg mt-3">{selected.name}</h3>
        <p className="text-xs text-ks-muted mt-1">{selected.location} · {selected.kind.toUpperCase()}</p>
        <p className="font-display text-ks-gold text-xl mt-3">{cash(selected.price)}</p>
        <div className="flex justify-between text-xs text-ks-muted border-t border-ks-border py-3 mt-3"><span>Estimated weekly upkeep</span><span>{cash(selected.upkeepWeekly)}</span></div>
        <div className="flex justify-between text-xs text-ks-muted border-t border-ks-border py-3"><span>Your available funds</span><span>{cash(player.money??0)}</span></div>
        <button disabled={(player.money??0)<selected.price || assets.some(asset=>asset.id===selected.id)}
          onClick={()=>{const r=buy(selected.id);setMessage(r.ok?`Purchased ${selected.name} — added to My assets`:(r.reason??'Purchase unavailable'));if(r.ok)setSelected(null)}}
          className="w-full rounded-lg bg-ks-gold text-ks-black font-display py-3 mt-3 disabled:opacity-40">
          {assets.some(asset=>asset.id===selected.id)?'ALREADY OWNED':(player.money??0)<selected.price?'INSUFFICIENT FUNDS':'PURCHASE ASSET'}
        </button>
      </div>
    </div>}
    <p className="text-[10px] text-ks-muted mt-3">Maintenance is an estimated ownership cost. Your purchase price is deducted immediately.</p>
  </section>
}
