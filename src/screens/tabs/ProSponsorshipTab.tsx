import { useState } from 'react'
import type { Player } from '../../types/player'
import { useCareerStore } from '../../store/careerStore'
import { SPONSOR_BRANDS, sponsorPopularity, sponsorCareerAppearances } from '../../engine/proSponsorship'
const cash=(n:number)=>'£'+n.toLocaleString('en-GB')
export default function ProSponsorshipTab({player}:{player:Player}){
 const sign=useCareerStore(s=>s.signSponsor)
 const [message,setMessage]=useState('')
 const [section,setSection]=useState<'offers'|'contracts'>('offers')
 const pro=player.proCareer!
 const sponsorships=pro.sponsorships
 const popularity=sponsorPopularity(player),matches=sponsorCareerAppearances(player)
 const brand=(id:string)=>SPONSOR_BRANDS.find(b=>b.id===id)
 return <section className="mt-3 rounded-2xl border border-ks-gold/30 bg-gradient-to-b from-[#1d2115] to-[#0e120e] p-3 shadow-[0_12px_35px_rgba(0,0,0,.3)]">
   <p className="font-display text-ks-gold tracking-widest text-sm">SPONSORSHIPS & ENDORSEMENTS</p>
   <p className="text-[10px] text-ks-muted mt-1">70 fictional companies · offers based on career success, reputation and performances</p>
   <div className="grid grid-cols-3 gap-2 my-3 text-center">
    <div className="border border-ks-border rounded-lg p-2"><p className="text-ks-gold font-display text-lg">{popularity}</p><p className="text-[10px] text-ks-muted">Popularity</p></div>
    <div className="border border-ks-border rounded-lg p-2"><p className="text-ks-gold font-display text-lg">{matches}</p><p className="text-[10px] text-ks-muted">Career matches</p></div>
    <div className="border border-ks-border rounded-lg p-2"><p className="text-ks-gold font-display text-lg">{sponsorships?.contracts.length??0}</p><p className="text-[10px] text-ks-muted">Active deals</p></div>
   </div>
   <nav aria-label="Sponsorship sections" className="grid grid-cols-2 gap-1 rounded-xl border border-ks-border bg-black/25 p-1 mb-3">
     <button type="button" onClick={()=>setSection('offers')} aria-current={section==='offers'?'page':undefined} className={`min-h-11 rounded-lg text-xs font-display ${section==='offers'?'bg-ks-gold text-ks-black':'text-ks-muted'}`}>OFFERS ({sponsorships?.offers?.length??0})</button>
     <button type="button" onClick={()=>setSection('contracts')} aria-current={section==='contracts'?'page':undefined} className={`min-h-11 rounded-lg text-xs font-display ${section==='contracts'?'bg-ks-gold text-ks-black':'text-ks-muted'}`}>MY DEALS ({sponsorships?.contracts?.length??0})</button>
   </nav>
   {message&&<p role="status" className="text-xs text-ks-gold mb-3">{message}</p>
   {section==='offers' && <>
   <p className="text-xs font-display text-ks-ink mb-2">CONTRACT OFFERS</p>
   {(sponsorships?.offers??[]).map(o=><div key={o.id} className="border border-ks-border rounded-lg p-3 mb-2">
     <div className="flex justify-between gap-2"><div><p className="font-display text-ks-gold text-sm">{brand(o.brandId)?.name??'Brand'}</p><p className="text-[10px] text-ks-muted">{brand(o.brandId)?.category.toUpperCase()} · TIER {brand(o.brandId)?.tier}{o.shoeDeal?' · SIGNATURE BOOT DEAL':''}</p></div><span className="text-xs text-ks-ink">{o.years} YEAR{o.years>1?'S':''}</span></div>
     <p className="text-xs text-ks-ink mt-2">{cash(o.weeklyPay)}/week · {cash(o.signingBonus)} signing bonus</p>
     <p className="text-[10px] text-ks-muted mt-1">Expires season {o.expiresSeason}, week {o.expiresWeek}</p>
     <button className="w-full mt-2 rounded-md bg-ks-gold text-ks-black font-display text-xs py-2" onClick={()=>{const r=sign(o.id);setMessage(r.ok?'Sponsorship signed — signing bonus received':r.reason??'Unable to sign');if(r.ok)setSection('contracts')}}>SIGN ENDORSEMENT</button>
   </div>)}
   {!sponsorships?.offers.length&&<p className="text-xs text-ks-muted mb-3">No live offers. Brands scout players periodically as their popularity grows.</p>}
   </>}
   {section==='contracts' && <>
   <p className="text-xs font-display text-ks-ink mt-4 mb-2">ACTIVE CONTRACTS</p>
   {(sponsorships?.contracts??[]).map(c=><div key={c.id} className="border border-ks-border rounded-lg p-3 mb-2">
    <p className="font-display text-ks-gold text-xs">{brand(c.brandId)?.name??'Brand'} {c.shoeDeal?'· BOOT DEAL':''}</p>
    <p className="text-xs text-ks-ink mt-1">{cash(c.weeklyPay)}/week · {c.years} year term</p>
    <p className="text-[10px] text-ks-muted mt-1">Signed season {c.signedSeason}, week {c.signedWeek} · {c.weeksPaid} payments</p>
   </div>)}
   {!sponsorships?.contracts.length&&<p className="text-xs text-ks-muted">No sponsorship contracts signed yet.</p>}
   </>}
   <div className="border-t border-ks-border mt-3 pt-3"><p className="font-display text-xs text-ks-gold">SIGNATURE FOOTBALL BOOTS</p>
     <p className="text-[11px] text-ks-muted mt-1">{matches>=200&&popularity>=70?'You qualify for elite boot sponsorship consideration.':'Requires 200+ career appearances and 70+ popularity. Premium boot deals remain exclusive to established stars.'}</p>
   </div>
 </section>
}
