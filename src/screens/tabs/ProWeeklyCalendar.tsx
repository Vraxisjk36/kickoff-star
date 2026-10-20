import { useState } from 'react'
import type { ProCareerState } from '../../engine/proCareer'
import { proWeekSchedule, PRO_WEEKDAYS } from '../../engine/proWeeklySchedule'
import { professionalSeasonWeeks, proRound } from '../../engine/proCareer'
interface Props {
  pro: ProCareerState
  opponent?: string
  matchKind?: 'league'|'domestic-cup'|'europe'|'international'|'final'
  onTrain: () => void
}
/** Shared school-game visual language; each day is a real career action.
 * Month/year drawers show the recurring match and training structure.
 */
export default function ProWeeklyCalendar({pro,opponent,matchKind='league',onTrain}:Props){
  const [view,setView]=useState<'week'|'month'|'season'>('week')
  const days=proWeekSchedule(pro,opponent,matchKind)
  const current=pro.day??0
  const selected=days[current]
  const formatWeek=(week:number)=>`Week ${week}`
  const weeks=professionalSeasonWeeks(pro)
  const starts=pro.date?Date.parse(`${pro.date}T00:00:00Z`):Date.UTC(2026,7,1)+(pro.week-1)*7*86400000
  const actualMonth=new Date(starts).getUTCMonth()
  const baseDate=starts-(pro.week-1)*7*86400000
  const weeksOnView=Array.from({length:weeks},(_,n)=>n+1)
    .filter(week=>view==='season'||new Date(baseDate+(week-1)*7*86400000).getUTCMonth()===actualMonth)
  const division=pro.world.divisions[1]
  const maxRounds=Math.max(0,...division.fixtures.map(f=>f.week))
  const nextLeagueMatch=(week:number)=>{
    const round=proRound(week,division.teams.length,maxRounds)
    if(round===null)return null
    const fixture=division.fixtures.find(f=>f.week===round&&
      (f.homeTeamId===pro.world.playerTeamId||f.awayTeamId===pro.world.playerTeamId))
    if(!fixture)return null
    const home=fixture.homeTeamId===pro.world.playerTeamId
    const opponentId=home?fixture.awayTeamId:fixture.homeTeamId
    return {home,name:division.teams.find(t=>t.id===opponentId)?.name??'Opponent'}
  }
  return <div className="rounded-xl border border-ks-gold/30 overflow-hidden bg-[#101510]">
    <div className="px-4 py-3 flex items-center justify-between gap-2 bg-gradient-to-r from-[#1d210f] to-[#101510]">
      <div><div className="font-display text-xs tracking-widest text-ks-gold">YOUR FOOTBALL CALENDAR</div>
        <div className="text-xs text-ks-muted mt-1">Season {pro.season} · Week {pro.week} · {PRO_WEEKDAYS[current]}</div></div>
      <div className="text-ks-gold font-display text-lg">{current+1}/7</div>
    </div>
    <nav className="flex gap-1 px-3 py-2 border-b border-ks-border" aria-label="Football calendar range">
      {(['week','month','season'] as const).map(option=><button key={option} onClick={()=>setView(option)}
        className={`flex-1 py-2 rounded-lg text-[10px] font-display uppercase ${view===option?'bg-ks-gold text-ks-black':'text-ks-muted'}`}>{option==='season'?'year':option}</button>)}
    </nav>
    {view==='week' ? <>
      <div className="grid grid-cols-7 gap-1 p-2.5">
        {days.map(day=><div key={day.day} className={`rounded-lg border min-w-0 text-center py-2 ${day.day===current?'border-ks-gold bg-ks-gold/15':'border-ks-border/50'}`}>
          <div className="text-[9px] text-ks-muted">{day.label}</div>
          <div className={`text-sm mt-1 ${day.kind==='match'?'text-ks-gold':day.kind==='training'?'text-green-400':'text-ks-muted'}`}>{day.kind==='match'?'⚽':day.kind==='training'?'◆':'○'}</div>
          {day.completed&&<span className="text-green-400 text-[9px]">✓</span>}
        </div>)}
      </div>
      <div className="px-3 pb-4 flex items-center gap-3">
        <div className="flex-1"><div className="text-ks-gold text-xs font-display">{selected.title}</div>
          <p className="text-[10px] text-ks-muted mt-1">{selected.kind==='training'?'Play the original drills, then allocate earned attribute XP.':selected.kind==='match'?'Your scheduled matchday is here.':selected.kind==='recovery'?'Recover energy for the next session.':'Prepare for the next football week.'}</p></div>
        {selected.kind==='training'&&!selected.completed&&pro.freeAgentSinceWeek===undefined&&
          <button onClick={onTrain} className="rounded-lg bg-ks-gold px-3 py-2.5 text-[11px] font-display text-ks-black">TRAIN →</button>}
      </div>
    </> : <div className="max-h-60 overflow-y-auto p-3 grid grid-cols-2 gap-2">
      {weeksOnView.map(week=><div key={week} className={`rounded-lg border p-2 ${week===pro.week?'border-ks-gold bg-ks-gold/10':'border-ks-border/60'}`}>
        <span className="text-xs text-ks-ink">{formatWeek(week)}</span>
        <div className="text-[10px] text-ks-muted mt-1">{new Date(baseDate+(week-1)*7*86400000).toLocaleDateString('en-GB',{month:'short',timeZone:'UTC'})}</div>
        {nextLeagueMatch(week) ? <div className="text-[10px] text-ks-gold mt-1">SAT · {nextLeagueMatch(week)!.home?'HOME':'AWAY'} · {nextLeagueMatch(week)!.name}</div>
          : <div className="text-[10px] text-ks-muted mt-1">Training · Recovery</div>}
      </div>)}
      </div>}
  </div>
}
