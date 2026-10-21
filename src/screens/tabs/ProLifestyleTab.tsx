import { useState } from 'react'
import type { Player } from '../../types/player'
import { useCareerStore } from '../../store/careerStore'
import { weeklyLuxuryListings, luxuryNetWorth, luxuryWeeklyUpkeep, type LuxuryKind } from '../../engine/proLifestyle'

const KINDS: {id:LuxuryKind;label:string;icon:string}[] = [
  {id:'house',label:'Homes',icon:'⌂'},{id:'car',label:'Cars',icon:'◈'},
  {id:'plane',label:'Aircraft',icon:'✈'},{id:'boat',label:'Boats',icon:'⚓'},
]
const cash=(n:number)=>'£'+n.toLocaleString('en-GB')
export default function ProLifestyleTab({player}:{player:Player}){
  const pro=player.proCareer!
  const buy=useCareerStore(s=>s.buyLuxuryAsset)
  const [category,setCategory]=useState<LuxuryKind>('house')
  const [view,setView]=useState<'market'|'assets'>('market')
  const [message,setMessage]=useState('')
  const assets=pro.luxuryAssets??[]
  const listings=weeklyLuxuryListings(category,pro.season,pro.week,player.id,assets)
  const owned=assets.filter(item=>item.kind===category)
  return <section className="rounded-xl border border-ks-border bg-[#10100f] p-3 mt-3 mb-4">
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
      {KINDS.map(kind=><button key={kind.id} onClick={()=>{setCategory(kind.id);setMessage('')}} className={`rounded-lg border py-2 text-[10px] ${category===kind.id?'border-ks-gold text-ks-gold':'border-ks-border text-ks-muted'}`}>{kind.icon} {kind.label}</button>)}
    </div>
    <div className="grid grid-cols-2 gap-2 mb-3">
      <button onClick={()=>setView('market')} className={`rounded-md py-2 text-xs ${view==='market'?'bg-ks-gold text-ks-black':'border border-ks-border text-ks-muted'}`}>Weekly market</button>
      <button onClick={()=>setView('assets')} className={`rounded-md py-2 text-xs ${view==='assets'?'bg-ks-gold text-ks-black':'border border-ks-border text-ks-muted'}`}>My assets ({assets.length})</button>
    </div>
    {message&&<p role="status" className="text-xs text-ks-gold mb-3">{message}</p>}
    {view==='market'?<div className="space-y-2">
      <p className="text-[10px] text-ks-muted">{listings.length} available this week. The market refreshes on the next game week.</p>
      {listings.map(item=><div key={item.id} className="rounded-lg border border-ks-border p-3">
        <p className="font-display text-ks-ink text-xs">{item.name}</p>
        <p className="text-[10px] text-ks-muted mt-1">{item.location} · Est. upkeep {cash(item.upkeepWeekly)}/week</p>
        <div className="flex justify-between items-center mt-2 gap-2">
          <strong className="text-ks-gold text-sm">{cash(item.price)}</strong>
          <button disabled={(player.money??0)<item.price} onClick={()=>{const r=buy(item.id);setMessage(r.ok?`Purchased ${item.name} — added to My assets`:(r.reason??'Purchase unavailable'))}}
            className="bg-ks-gold text-ks-black rounded-md px-3 py-2 text-[10px] font-display disabled:opacity-40">BUY</button>
        </div>
      </div>)}
      {!listings.length&&<p className="text-xs text-ks-muted">You own every listing in this category.</p>}
    </div>:<div className="space-y-2">
      {owned.map(item=><div key={item.id} className="rounded-lg border border-ks-border p-3">
        <p className="text-xs text-ks-ink">{item.name}</p>
        <p className="text-[10px] text-ks-muted mt-1">{item.location} · Purchased season {item.purchasedSeason}, week {item.purchasedWeek}</p>
        <p className="text-ks-gold text-xs mt-1">{cash(item.price)}</p>
      </div>)}
      {!owned.length&&<p className="text-xs text-ks-muted">No {category==='house'?'properties':category==='plane'?'aircraft':category==='boat'?'boats':'cars'} owned yet.</p>}
    </div>}
    <p className="text-[10px] text-ks-muted mt-3">Maintenance is an estimated ownership cost. Your purchase price is deducted immediately.</p>
  </section>
}
