import { useEffect, useState } from 'react'
import { haptics } from '../engine/haptics'
export type CelebrationKind='player-goal'|'player-assist'|'team-goal'|'concede'
interface Props{kind:CelebrationKind;scorerName?:string;homeShort:string;awayShort:string;homeScore:number;awayScore:number;minute:number;avatarId?:number;onDone:()=>void;playerRating?:number;ratingDelta?:number}
export default function GoalCelebration({kind,scorerName,homeShort,awayShort,homeScore,awayScore,minute,onDone,playerRating,ratingDelta}:Props){
 const [out,setOut]=useState(false)
 useEffect(()=>{kind==='concede'?haptics.fail():haptics.goal();const a=setTimeout(()=>setOut(true),1500),b=setTimeout(onDone,1800);return()=>{clearTimeout(a);clearTimeout(b)}},[])
 const good=kind!=='concede', accent=good?'#d4af37':'#e0483e'
 return <div className="fixed inset-0 z-[70] pointer-events-none transition-opacity duration-300" style={{opacity:out?0:1,background:'rgba(0,0,0,.68)'}}>
  <div className="absolute inset-0 flex items-center justify-center px-6">
   <div className="w-full max-w-md text-center">
    <div className="text-[10px] uppercase tracking-[.42em] mb-2" style={{color:accent}}>match moment</div>
    <div className="font-display text-6xl leading-none tracking-tight" style={{color:accent,textShadow:`0 0 32px ${accent}66`}}>{kind==='player-assist'?'ASSIST':kind==='concede'?'CONCEDED':'GOAL'}</div>
    {scorerName&&<div className="mt-2 text-sm text-ks-ink">{scorerName}</div>}
    <div className="text-[11px] text-ks-muted mt-1">{minute}'</div>
    <div className="mt-5 rounded-2xl border border-white/15 bg-[#090a07]/95 px-6 py-5 flex items-center justify-center gap-5 shadow-2xl">
      <span className="font-display text-sm text-ks-ink">{homeShort}</span><b className="font-display text-4xl" style={{color:accent}}>{homeScore}–{awayScore}</b><span className="font-display text-sm text-ks-ink">{awayShort}</span>
    </div>
    {playerRating!==undefined&&kind==='player-goal'&&<div className="mt-3 text-[10px] tracking-widest text-ks-muted">LIVE RATING <b className="text-ks-gold ml-2">{playerRating.toFixed(1)}</b>{ratingDelta&&ratingDelta>0?<span className="text-emerald-400 ml-2">+{ratingDelta.toFixed(1)}</span>:null}</div>}
   </div>
  </div>
 </div>
}