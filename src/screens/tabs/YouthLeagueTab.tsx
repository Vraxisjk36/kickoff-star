import { useState } from 'react'
import type { YouthWorld, LeagueCompetitionState, CompetitionFixture } from '../../types/youthWorld'
const sorted=(s:LeagueCompetitionState)=>[...s.standings].sort((a,b)=>b.points-a.points||b.goalDifference-a.goalDifference||b.goalsFor-a.goalsFor)
export default function YouthLeagueTab({youthWorld,initialView='fixtures'}:{youthWorld:YouthWorld;initialView?:'fixtures'|'table'}){
 const [view,setView]=useState<'fixtures'|'table'|'stats'>(initialView)
 const school=youthWorld.pathway.route==='school'
 const comp=school?youthWorld.competitionWorld.interSchools:youthWorld.competitionWorld.sundayLeague
 const teamId=school?youthWorld.selectedSchoolId:youthWorld.pathway.sundayClubId
 if(!comp)return <div className="rounded-xl border border-ks-border bg-[#0f0f0d] p-5"><div className="text-ks-gold font-display tracking-widest text-xs">{school?'INTER-SCHOOLS':'GRASSROOTS LEAGUE'}</div><p className="text-ks-muted text-xs mt-2">Competition unlocks after your opening trials are complete.</p></div>
 const table=sorted(comp),own=table.find(x=>x.teamId===teamId),pos=own?table.findIndex(x=>x.teamId===teamId)+1:0,leader=table[0]

 const legacyDivision=(youthWorld as unknown as {legacyDivision?:never}).legacyDivision
 void legacyDivision
 const statPlayers=Object.values(youthWorld.competitionWorld.statBooks?.[comp.id]?.players??{})
 const avg=(p:typeof statPlayers[number])=>p.apps?p.ratingTotal/p.apps:0
 const goals=[...statPlayers].sort((a,b)=>b.goals-a.goals||b.assists-a.assists||avg(b)-avg(a)).slice(0,10)
 const assists=[...statPlayers].sort((a,b)=>b.assists-a.assists||b.goals-a.goals||avg(b)-avg(a)).slice(0,10)
 const ratings=[...statPlayers].filter(p=>p.apps>=2).sort((a,b)=>avg(b)-avg(a)||b.goals-a.goals).slice(0,10)
 const cleanSheets=[...statPlayers].filter(p=>p.position==='GK').sort((a,b)=>b.cleanSheets-a.cleanSheets||avg(b)-avg(a)).slice(0,10)
 const fixtures=comp.fixtures.filter(f=>!teamId||f.homeTeamId===teamId||f.awayTeamId===teamId)
 const names=new Map(comp.teams.map(t=>[t.id,t.name]))
 return <div className="flex flex-col gap-2.5">
  <div className="flex gap-1.5 p-1 rounded-xl bg-[#0f0f0d] border border-ks-border">{(['fixtures','table','stats'] as const).map(v=><button key={v} onClick={()=>setView(v)} className={`flex-1 rounded-lg py-2 font-display tracking-widest text-[10px] uppercase ${view===v?'bg-ks-gold text-ks-black':'text-ks-muted'}`}>{v}</button>)}</div>
  <section className="table-hero"><small>{school?'SCHOOL FOOTBALL':'GRASSROOTS FOOTBALL'} · COMPETITION CENTRE</small><h1>{school?'INTER-SCHOOLS LEAGUE':'GRASSROOTS LEAGUE'}</h1><div className="table-story"><div><span>YOUR POSITION</span><b>{pos||'—'}</b></div><div><span>POINTS</span><b>{own?.points??0}</b></div><div><span>LEADER</span><strong>{leader?names.get(leader.teamId):'—'}</strong></div><div><span>GAP</span><b>{own?Math.max(0,(leader?.points??0)-own.points):0}</b></div></div></section>
  {view==='table'?<div className="rounded-lg border border-ks-border bg-[#0f0f0d] overflow-hidden"><div className="grid grid-cols-[1.75rem_1fr_2rem_2rem_2rem] gap-1 px-3 py-2 text-[9px] text-ks-muted uppercase"><span>#</span><span>team</span><span>P</span><span>GD</span><span>PTS</span></div>{table.map((s,i)=><div key={s.teamId} className={`grid grid-cols-[1.75rem_1fr_2rem_2rem_2rem] gap-1 px-3 py-2 text-[11px] border-t border-ks-border/30 ${s.teamId===teamId?'bg-ks-gold/10 text-ks-gold':'text-ks-ink'}`}><span>{i+1}</span><span className="truncate">{names.get(s.teamId)}</span><span>{s.played}</span><span>{s.goalDifference>0?'+':''}{s.goalDifference}</span><b>{s.points}</b></div>)}</div>:view==='stats'?<div className="space-y-2">{statPlayers.length?[["TOP SCORERS",goals,"goals","G"],["TOP ASSISTS",assists,"assists","A"],["BEST RATINGS",ratings,"rating",""],["CLEAN SHEETS",cleanSheets,"cleanSheets","CS"]].map(([title,list,metric,suffix])=><div key={title as string} className="rounded-lg border border-ks-border bg-[#0f0f0d] p-3"><div className="font-display text-[10px] tracking-widest text-ks-gold mb-2">{title as string}</div>{(list as typeof statPlayers).map((p,i)=><div key={p.playerId} className="grid grid-cols-[1.2rem_1fr_3rem] py-1 text-[10px]"><span className="text-ks-muted">{i+1}</span><span className="text-ks-ink truncate">{p.name}</span><b className="text-ks-gold text-right">{metric==='rating'?avg(p).toFixed(2):`${p[metric as 'goals'|'assists'|'cleanSheets']}${suffix}`}</b></div>)}</div>):<div className="rounded-lg border border-ks-border bg-[#0f0f0d] p-4 text-[11px] text-ks-muted">Competition statistics populate from played V5 fixtures.</div>}</div>:<div className="rounded-lg border border-ks-border bg-[#0f0f0d] overflow-hidden">{fixtures.map((f:CompetitionFixture)=><div key={f.id} className="px-3 py-3 border-b border-ks-border/30 text-xs flex justify-between gap-2"><span className="text-ks-muted">R{f.round}</span><span className="flex-1 text-ks-ink">{names.get(f.homeTeamId)} <b>{f.played?`${f.homeGoals}–${f.awayGoals}`:'vs'}</b> {names.get(f.awayTeamId)}</span></div>)}</div>}
 </div>
}
