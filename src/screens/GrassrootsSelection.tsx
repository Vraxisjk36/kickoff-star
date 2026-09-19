import { useState } from 'react'
import type { School } from '../engine/schools'

export interface GrassrootsClubChoice extends School { clubId:string }

export const GRASSROOTS_STARTER_CLUBS: GrassrootsClubChoice[] = [
  { id:'grassroots-northside', clubId:'grassroots-northside', name:'Northside Athletic', blurb:'A competitive local club with a strong coaching setup and tougher selection.', strengths:['Strong coaching','Competitive squad'], trialDifficulty:1.12, scoutExposure:1.15, squadPlaceOdds:.96 },
  { id:'grassroots-central', clubId:'grassroots-central', name:'Central City Juniors', blurb:'A balanced community club where development and match minutes carry equal weight.', strengths:['Balanced route','Good minutes'], trialDifficulty:1, scoutExposure:1, squadPlaceOdds:1 },
  { id:'grassroots-united', clubId:'grassroots-united', name:'Township United', blurb:'A development-first club with more opportunity to earn a shirt and grow through games.', strengths:['More opportunity','Development focus'], trialDifficulty:.9, scoutExposure:.82, squadPlaceOdds:1.1 },
]

export default function GrassrootsSelection({onChoose}:{onChoose:(club:GrassrootsClubChoice)=>void}){
 const [selected,setSelected]=useState<GrassrootsClubChoice|null>(null)
 return <div className="relative min-h-screen w-full bg-ks-black flex flex-col px-5 py-8">
  <div className="absolute inset-0" style={{background:'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(212,175,55,.07), transparent 60%),linear-gradient(180deg,#0a0a09,#050504)'}}/>
  <div className="relative z-10 max-w-md mx-auto w-full flex flex-col flex-1">
   <div className="font-display tracking-widest text-[11px] text-ks-gold uppercase mb-2">choose your grassroots club</div>
   <h1 className="font-display text-ks-ink text-2xl tracking-wide mb-1">Earn your shirt.</h1>
   <p className="text-ks-muted text-xs mb-6">Your choice sets the trial difficulty and exposure. Every club begins in Division 3.</p>
   <div className="flex flex-col gap-3 flex-1">{GRASSROOTS_STARTER_CLUBS.map(club=><button key={club.id} onClick={()=>setSelected(club)} className={`text-left rounded-2xl border px-5 py-4 ${selected?.id===club.id?'border-ks-gold bg-ks-gold/10':'border-ks-border bg-[#0f0f0d]'}`}>
    <div className="font-display tracking-wide text-ks-ink text-lg mb-1">{club.name}</div><p className="text-[12px] text-ks-muted leading-snug mb-3">{club.blurb}</p>
    <div className="text-[10px] text-ks-gold tracking-wide">{club.strengths.join(' · ')}</div>
   </button>)}</div>
   <button disabled={!selected} onClick={()=>selected&&onChoose(selected)} className="mt-5 w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm disabled:opacity-25">{selected?`trial at ${selected.name.toLowerCase()}`:'select a club'}</button>
  </div>
 </div>
}
