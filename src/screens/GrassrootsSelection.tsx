import { useState } from 'react'
import type { School } from '../engine/schools'
import { useCareerStore } from '../store/careerStore'
import { getRegion, regionalClubNames } from '../engine/regions'
export interface GrassrootsClubChoice extends School { clubId: string }
export const GRASSROOTS_STARTER_CLUBS: GrassrootsClubChoice[] = [
  { id:'grassroots-north', clubId:'grassroots-north', name:'Northside Athletic', blurb:'Competitive coaching and a demanding route into the first team.', strengths:['Competitive','Strong coaching'], trialDifficulty:1.12, scoutExposure:1.12, squadPlaceOdds:.96 },
  { id:'grassroots-central', clubId:'grassroots-central', name:'Central Juniors', blurb:'A balanced community club built around development and regular football.', strengths:['Balanced','Development'], trialDifficulty:1, scoutExposure:1, squadPlaceOdds:1 },
  { id:'grassroots-united', clubId:'grassroots-united', name:'Township United', blurb:'A development-first club with more room for young players to earn minutes.', strengths:['Opportunity','Match minutes'], trialDifficulty:.9, scoutExposure:.85, squadPlaceOdds:1.1 },
]
export function grassrootsClubsForRegion(regionId: string | null | undefined): GrassrootsClubChoice[] {
 const region = getRegion(regionId)
 if (!region) return GRASSROOTS_STARTER_CLUBS
 const names = regionalClubNames(region.id)
 return GRASSROOTS_STARTER_CLUBS.map((club, i) => ({ ...club, id: `${region.id}-${club.id}`, clubId: `${region.id}-${club.clubId}`, name: names[i] }))
}
export default function GrassrootsSelection({ onChoose }: { onChoose: (club: GrassrootsClubChoice) => void }) {
 const [selected,setSelected]=useState<GrassrootsClubChoice|null>(null)
 const regionId = useCareerStore(s => s.player?.regionId)
 const clubs = grassrootsClubsForRegion(regionId)
 return <div className="relative min-h-screen w-full bg-ks-black px-5 py-8"><div className="relative z-10 max-w-md mx-auto flex min-h-[85vh] flex-col">
  <div className="font-display tracking-widest text-[11px] text-ks-gold mb-2">GRASSROOTS ROUTE</div><h1 className="font-display text-ks-ink text-2xl tracking-wide mb-1">Choose your first club</h1>
  <p className="text-ks-muted text-xs mb-6">You still have to earn your place through the three-week V4 trial system.</p>
  <div className="flex flex-col gap-3 flex-1">{clubs.map(club=><button key={club.id} onClick={()=>setSelected(club)} className={`text-left rounded-2xl border px-5 py-4 ${selected?.id===club.id?'border-ks-gold bg-ks-gold/10':'border-ks-border bg-[#0f0f0d]'}`}><div className="font-display text-ks-ink text-lg mb-1">{club.name}</div><p className="text-[12px] text-ks-muted mb-3">{club.blurb}</p><div className="text-[10px] text-ks-gold">{club.strengths.join(' · ')}</div></button>)}</div>
  <button disabled={!selected} onClick={()=>selected&&onChoose(selected)} className="mt-5 w-full bg-ks-gold text-ks-black font-display rounded-xl py-3.5 disabled:opacity-25">{selected?`trial at ${selected.name.toLowerCase()}`:'select a club'}</button>
 </div></div>
}
