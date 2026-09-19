import { useEffect,useMemo,useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import { TeamCrest } from '../components/ui'

interface MatchSummaryProps{rating:number;goals:number;assists:number;won:boolean;drew:boolean;injury?:{severity:string;weeksOut:number;description:string}|null;wasSubbed?:boolean;redCarded?:boolean;shootout?:{won:boolean}|null;onDone:()=>void}
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v))
export default function MatchSummary({rating,goals,assists,won,drew,injury,wasSubbed,redCarded,shootout,onDone}:MatchSummaryProps){
 const league=useCareerStore(s=>s.league),academy=useCareerStore(s=>s.academyLeague),calendar=useCareerStore(s=>s.calendar),player=useCareerStore(s=>s.player)
 const division=academy?academy.divisions[academy.playerDivision]:league?league.divisions[league.playerDivision]:null,week=calendar?.currentWeek.weekNumber
 const roundFixtures=division&&week?division.fixtures.filter(f=>f.week===week&&f.played&&f.homeGoals!==null&&f.awayGoals!==null):[],teamById=new Map((division?.teams??[]).map(t=>[t.id,t] as const))
 const [phase,setPhase]=useState(0),[shown,setShown]=useState(5.8)
 const contributions=useMemo(()=>[
  {label:'BASE PERFORMANCE',value:5.8,delta:null},
  ...(goals?[{label:`${goals} GOAL${goals===1?'':'S'}`,value:0,delta:Math.min(1.8,goals*.55)}]:[]),
  ...(assists?[{label:`${assists} ASSIST${assists===1?'':'S'}`,value:0,delta:Math.min(1.1,assists*.35)}]:[]),
  {label:won?'MATCH RESULT · WIN':drew?'MATCH RESULT · DRAW':'MATCH RESULT · LOSS',value:0,delta:won?.18:drew?.05:-.08},
  ...(redCarded?[{label:'RED CARD',value:0,delta:-.65}]:[]),
 ],[goals,assists,won,drew,redCarded])
 useEffect(()=>{const timers:number[]=[];contributions.forEach((_,i)=>timers.push(window.setTimeout(()=>setPhase(i+1),500+i*430)));const reveal=500+contributions.length*430;timers.push(window.setTimeout(()=>{const from=shown,to=rating,start=performance.now(),dur=850;const tick=(now:number)=>{const p=clamp((now-start)/dur,0,1);setShown(from+(to-from)*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(tick)};requestAnimationFrame(tick)},reveal));return()=>timers.forEach(clearTimeout)},[])
 const result=shootout?(shootout.won?'WIN ON PENS':'LOSS ON PENS'):won?'WIN':drew?'DRAW':'LOSS'
 const grade=rating>=9?'WORLD CLASS':rating>=8?'OUTSTANDING':rating>=7?'STRONG':rating>=6.5?'SOLID':rating>=6?'QUIET':'TOUGH NIGHT'
 return <div className="relative min-h-[100dvh] bg-ks-black overflow-x-hidden px-5 pt-[max(34px,env(safe-area-inset-top))] pb-[max(28px,env(safe-area-inset-bottom))]">
  <div className="absolute inset-0 pointer-events-none" style={{background:'radial-gradient(circle at 50% 20%,rgba(212,175,55,.16),transparent 32%),linear-gradient(180deg,#0b0b09 0%,#050504 65%)'}}/>
  <main className="relative z-10 max-w-md mx-auto">
   <header className="flex justify-between items-end border-b border-white/10 pb-4"><div><div className="text-[9px] tracking-[.32em] text-ks-gold font-display">FULL TIME</div><h1 className="font-display text-3xl text-ks-ink mt-1">{result}</h1></div><div className="text-right"><div className="text-[9px] text-ks-muted tracking-widest">MATCHDAY</div><div className="text-xs text-ks-ink">WEEK {week??'—'}</div></div></header>
   <section className="py-7 text-center"><div className="text-[10px] tracking-[.28em] text-ks-muted font-display">PERFORMANCE RATING</div><div className="relative inline-flex items-baseline mt-1"><span className="font-display text-[92px] leading-none text-ks-gold tabular-nums">{shown.toFixed(1)}</span><span className="ml-2 text-[10px] tracking-widest text-ks-muted">/10</span></div><div className="font-display text-[11px] tracking-[.22em] text-ks-ink mt-2">{phase>=contributions.length?grade:'CALCULATING…'}</div>
    <div className="h-1.5 rounded-full bg-white/10 mt-5 overflow-hidden"><div className="h-full bg-ks-gold transition-all duration-700" style={{width:`${clamp(shown*10,0,100)}%`}}/></div>
   </section>
   <section className="rounded-2xl border border-white/10 bg-white/[.025] overflow-hidden mb-4"><div className="px-4 py-3 border-b border-white/10 text-[9px] tracking-[.25em] text-ks-muted font-display">RATING TALLY</div>{contributions.map((x,i)=><div key={x.label} className={`flex items-center justify-between px-4 py-3 border-b border-white/5 last:border-0 transition-all duration-300 ${phase>i?'opacity-100 translate-y-0':'opacity-20 translate-y-1'}`}><span className="text-[11px] text-ks-ink">{x.label}</span><b className={`font-display text-sm ${x.delta!==null&&x.delta<0?'text-red-400':'text-ks-gold'}`}>{x.delta===null?'5.8':`${x.delta>=0?'+':''}${x.delta.toFixed(2)}`}</b></div>)}</section>
   <div className="grid grid-cols-3 gap-2 mb-4">{[['GOALS',goals],['ASSISTS',assists],['APPS',1]].map(([l,v])=><div key={String(l)} className="rounded-xl border border-white/10 bg-white/[.025] p-3 text-center"><div className="text-[8px] tracking-widest text-ks-muted">{l}</div><div className="font-display text-xl text-ks-ink mt-1">{v}</div></div>)}</div>
   {(redCarded||injury||wasSubbed)&&<div className="rounded-xl border border-white/10 p-3 mb-4 text-xs text-ks-muted">{redCarded?'Sent off — suspension applies.':injury?`${injury.description}${injury.weeksOut? ` · approx. ${injury.weeksOut} week(s) out`:''}`:'Substituted before full-time.'}</div>}
   {roundFixtures.length>0&&<details className="rounded-xl border border-white/10 bg-white/[.02] mb-5"><summary className="p-3 text-[10px] tracking-widest text-ks-muted cursor-pointer">ROUND RESULTS</summary><div className="border-t border-white/10">{roundFixtures.map(f=>{const h=teamById.get(f.homeTeamId),a=teamById.get(f.awayTeamId);if(!h||!a)return null;return <div key={f.id} className="flex items-center gap-2 p-2.5 border-b border-white/5 last:border-0"><TeamCrest primary={h.primaryColor} secondary={h.secondaryColor} short={h.short} size="sm"/><span className="text-[10px] flex-1 truncate">{h.name}</span><b className="text-ks-gold text-xs">{f.homeGoals}–{f.awayGoals}</b><span className="text-[10px] flex-1 text-right truncate">{a.name}</span></div>})}</div></details>}
   <button onClick={onDone} className="w-full rounded-xl bg-ks-gold text-black py-4 font-display tracking-[.18em] text-sm uppercase">Continue career</button>
   {player&&<div className="text-center text-[8px] tracking-[.25em] text-ks-muted mt-4">{player.name.toUpperCase()} · KICKOFF STAR</div>}
  </main>
 </div>
}