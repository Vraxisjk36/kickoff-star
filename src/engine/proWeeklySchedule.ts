import type { ProCareerState } from './proCareer'
import { proFixture } from './proCareer'
export const PRO_WEEKDAYS=['MON','TUE','WED','THU','FRI','SAT','SUN'] as const
export function proMatchDay(state:ProCareerState,competition:'league'|'domestic-cup'|'europe'|'international'|'final'='league'):number {
  if(competition==='final')return 5
  if(competition==='europe')return state.week%3+1 // Tue/Wed/Thu
  if(competition==='domestic-cup')return 2
  if(competition==='international')return 3
  return 5
}
export function proTrainingAvailable(day:number,matchDay:number):boolean {
  return day>=0&&day<=4&&day!==matchDay&&Math.abs(day-matchDay)>1
}
export interface ProDaySchedule {day:number;label:string;kind:'training'|'match'|'recovery'|'rest';title:string;completed:boolean}
export function proWeekSchedule(state:ProCareerState,opponent?:string,kind:'league'|'domestic-cup'|'europe'|'international'|'final'='league'):ProDaySchedule[]{
  const matchDay=proMatchDay(state,kind)
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
