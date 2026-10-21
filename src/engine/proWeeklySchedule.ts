import type { ProCareerState } from './proCareer'
import { proFixture } from './proCareer'
export const PRO_WEEKDAYS=['MON','TUE','WED','THU','FRI','SAT','SUN'] as const
export function mondayFrom(date:string):string {
  const stamp=Date.parse(`${date}T00:00:00Z`)
  if(!Number.isFinite(stamp))return date
  const weekday=(new Date(stamp).getUTCDay()+6)%7
  return new Date(stamp-weekday*86400000).toISOString().slice(0,10)
}
export function proMatchDay(state:ProCareerState,competition:'league'|'domestic-cup'|'europe'|'international'|'final'='league',
  kickoffDate?:string):number {
  if(kickoffDate && state.date) {
    const base=Date.parse(`${mondayFrom(state.date)}T00:00:00Z`)
    const played=Date.parse(`${kickoffDate}T00:00:00Z`)
    const offset=Math.round((played-base)/86400000)
    if(offset>=0&&offset<=6)return offset
  }
  if(competition==='final')return 5
  if(competition==='europe')return state.week%3+1 // Tue/Wed/Thu fallback when no dated fixture
  if(competition==='domestic-cup')return 2
  if(competition==='international')return 3
  return 5
}
export function proTrainingAvailable(day:number,matchDay:number):boolean {
  return day>=0&&day<=4&&day!==matchDay&&Math.abs(day-matchDay)>1
}
export interface ProDaySchedule {day:number;label:string;kind:'training'|'match'|'recovery'|'rest';title:string;completed:boolean}
export function proWeekSchedule(state:ProCareerState,opponent?:string,kind:'league'|'domestic-cup'|'europe'|'international'|'final'='league',kickoffDate?:string):ProDaySchedule[]{
  const matchDay=proMatchDay(state,kind,kickoffDate)
  const hasMatch=!!opponent || !!proFixture(state)
  return PRO_WEEKDAYS.map((label,day)=>{
    const match=hasMatch&&day===matchDay
    const training=proTrainingAvailable(day,hasMatch?matchDay:6)
    const completed=day<(state.day??0)||(training&&(state.trainedDays??[]).includes(day))||
      (match&&state.resolvedWeek===state.week)
    return {day,label,kind:match?'match':training?'training':day===6?'rest':'recovery',
      title:match ? opponent? `Matchday · ${opponent}`:'League matchday'
        :training?'First-team training':day===6?'Rest and preparation':'Recovery and team duties',
      completed}
  })
}

export function proCalendarDate(state:ProCareerState,day=state.day??0):string {
  const base=state.date&&Number.isFinite(Date.parse(state.date+'T00:00:00Z'))
    ?Date.parse(mondayFrom(state.date)+'T00:00:00Z')
    :Date.UTC(2026,6,13)+(state.week-1)*7*86400000
  return new Date(base+day*86400000).toISOString().slice(0,10)
}
export function proCalendarLabel(state:ProCareerState,day=state.day??0):string {
  return new Date(proCalendarDate(state,day)+'T00:00:00Z').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})
}
