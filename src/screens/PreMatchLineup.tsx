import type { Player } from '../types/player'
import type { Team } from '../engine/teams'
import type { SquadPlayer } from '../engine/squad'
import Avatar from '../components/Avatar'
import { TeamCrest } from '../components/ui'

const posOrder:Record<string,number>={GK:0,CB:1,FB:2,CM:3,WM:4,WNG:4,WG:4,ST:5}
export default function PreMatchLineup({player,team,opponent,isHome,onContinue}:{player:Player;team:Team;opponent:Team;isHome:boolean;onContinue:()=>void}){
 const mates=[...(player.squad??[])].sort((a,b)=>(posOrder[a.position]??9)-(posOrder[b.position]??9)||b.quality-a.quality)
 const starters=mates.filter(p=>p.squadRole==='starter').slice(0,10)
 const bench=mates.filter(p=>p.squadRole!=='starter').slice(0,7)
 const userStarts=player.squadRole==='starting-xi'
 const xi=[...starters.map(p=>({id:p.id,name:p.name,position:p.position,quality:p.quality,user:false})),...(userStarts?[{id:'user',name:player.name,position:player.position,quality:Math.round(Object.values(player.attributes.values).reduce((a,b)=>a+b,0)/Object.values(player.attributes.values).length),user:true}]:[])].slice(0,11)
 return <div className="min-h-[100dvh] bg-ks-black text-ks-ink px-5 py-6 overflow-y-auto">
  <div className="max-w-md mx-auto">
   <div className="text-center text-[8px] tracking-[.35em] text-ks-gold uppercase">official team sheet</div>
   <div className="flex items-center justify-center gap-4 my-4"><TeamCrest primary={team.primaryColor} secondary={team.secondaryColor} short={team.short}/><div className="text-center"><div className="font-display text-xl">{team.short} <span className="text-ks-gold">vs</span> {opponent.short}</div><div className="text-[9px] text-ks-muted uppercase tracking-widest">{isHome?'home':'away'} · starting lineup</div></div><TeamCrest primary={opponent.primaryColor} secondary={opponent.secondaryColor} short={opponent.short}/></div>
   <div className="rounded-2xl border border-ks-border bg-[#0d160e] p-3 mb-3">
    <div className="font-display text-[9px] tracking-[.25em] text-ks-gold mb-2">STARTING XI</div>
    <div className="grid grid-cols-2 gap-1.5">{xi.map((p,i)=><div key={p.id} className={`flex items-center gap-2 rounded-lg border px-2 py-2 ${p.user?'border-ks-gold bg-ks-gold/10':'border-white/10 bg-black/25'}`}>{p.user?<Avatar id={player.avatarId??0} size={26}/>:<span className="w-6 text-center font-display text-[9px] text-ks-muted">{i+1}</span>}<div className="min-w-0 flex-1"><div className={`text-[10px] truncate ${p.user?'text-ks-gold font-bold':'text-ks-ink'}`}>{p.name}</div><div className="text-[8px] text-ks-muted">{p.position} · {p.quality}</div></div></div>)}</div>
   </div>
   <div className="rounded-xl border border-ks-border bg-[#0f0f0d] p-3 mb-4"><div className="font-display text-[9px] tracking-[.25em] text-ks-muted mb-2">BENCH</div><div className="flex flex-wrap gap-1.5">{!userStarts&&<span className="border border-ks-gold/50 bg-ks-gold/10 text-ks-gold rounded-md px-2 py-1 text-[9px]">{player.position} · {player.name}</span>}{bench.map(p=><span key={p.id} className="border border-white/10 rounded-md px-2 py-1 text-[9px] text-ks-muted">{p.position} · {p.name}</span>)}</div></div>
   <button onClick={onContinue} className="w-full bg-ks-gold text-ks-black font-display tracking-widest rounded-xl py-4 text-sm uppercase">continue to matchday</button>
  </div>
 </div>
}
