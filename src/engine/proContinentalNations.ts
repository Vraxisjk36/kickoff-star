import { NATIONS } from './nations'
import { PRO_LEAGUE_PLAN, type ProConfederation } from './proLeagueRegistry'
import type { SeniorInternationalRecord } from './proInternational'

export const CONTINENTAL_WINDOWS = [8,20,32] as const
export interface ContinentalTableRow {
  nationId: string; played: number; won: number; drawn: number; lost: number
  goalsFor: number; goalsAgainst: number; points: number
}
export interface ContinentalNationsProgress {
  confederation: ProConfederation
  name: string
  cycle: number
  season: number
  participants: string[]
  table: ContinentalTableRow[]
  championId?: string
}
const REGION_LABELS: Record<ProConfederation,string> = {
  uefa:'European Nations Series',caf:'African Nations Series',
  conmebol:'South American Nations Series',concacaf:'North American Nations Series',
  afc:'Asian Nations Series',ofc:'Oceania Nations Series',
}
export function confederationForNation(nationId:string):ProConfederation | null {
  return PRO_LEAGUE_PLAN.find(item=>item.associationId===nationId)?.confederation ?? null
}
export function continentalNations(nationId:string):string[] {
  const confederation=confederationForNation(nationId)
  return NATIONS.filter(n=>confederation && confederationForNation(n.id)===confederation)
    .map(n=>n.id).sort()
}
export function continentalCycle(season:number):number {
  return Math.floor((Math.max(1,season)-1)/2)*2+1
}
export function continentalOpponent(nationId:string,season:number,week:number):string|null {
  const index=CONTINENTAL_WINDOWS.indexOf(week as typeof CONTINENTAL_WINDOWS[number])
  const group=continentalNations(nationId),i=group.indexOf(nationId)
  if(index<0 || i<0 || group.length<2)return null
  const round=(season-continentalCycle(season))*3+index
  // Offset jumps are deterministic, including for 2- and 3-nation regions.
  const offset=1+round%(group.length-1)
  return group[(i+offset)%group.length]
}
function hash(value:string):number {
  let seed=2166136261
  for(const ch of value)seed=Math.imul(seed^ch.charCodeAt(0),16777619)
  return seed>>>0
}
function simulatedGoals(nationId:string,opponentId:string,season:number,week:number):[number,number] {
  const advantage=(NATIONS.find(n=>n.id===nationId)?.strength??5)-
    (NATIONS.find(n=>n.id===opponentId)?.strength??5)
  const g1=Math.max(0,Math.floor(1.4+advantage*.22+(hash(`cn:${season}:${week}:${nationId}`)%300)/100-1.5))
  const g2=Math.max(0,Math.floor(1.1-advantage*.22+(hash(`cn:${season}:${week}:${opponentId}`)%300)/100-1.5))
  return [g1,g2]
}
/** Six regional match windows over two years; each national fixture is saved
 * once. Table scores are simulated for NPCs but overridden by played games.
 */
export function continentalNationsProgress(nationId:string,season:number,week:number,
  records:readonly SeniorInternationalRecord[]=[]):ContinentalNationsProgress|null {
  const confederation=confederationForNation(nationId)
  if(!confederation)return null
  const participants=continentalNations(nationId)
  const cycle=continentalCycle(season)
  const rows=new Map(participants.map(id=>[id,{
    nationId:id,played:0,won:0,drawn:0,lost:0,goalsFor:0,goalsAgainst:0,points:0,
  } as ContinentalTableRow]))
  for(let year=cycle;year<=Math.min(season,cycle+1);year++)
    for(const window of CONTINENTAL_WINDOWS) {
      if(year===season && window>week)continue
      for(const id of participants){
        const opponentId=continentalOpponent(id,year,window)
        if(!opponentId)continue
        const record=records.find(r=>r.nationId===id&&r.season===year&&r.week===window&&
          r.opponentId===opponentId&&r.competition==='continental')
        const goals=record ? [record.scored,record.conceded] : simulatedGoals(id,opponentId,year,window)
        const row=rows.get(id)!
        row.played++;row.goalsFor+=goals[0];row.goalsAgainst+=goals[1]
        if(goals[0]>goals[1]){row.won++;row.points+=3}
        else if(goals[0]===goals[1]){row.drawn++;row.points++}
        else row.lost++
      }
    }
  const table=[...rows.values()].sort((a,b)=>b.points-a.points||
    (b.goalsFor-b.goalsAgainst)-(a.goalsFor-a.goalsAgainst)||
    b.goalsFor-a.goalsFor||a.nationId.localeCompare(b.nationId))
  const completed=season>cycle || season===cycle+1&&week>=32
  return {confederation,name:REGION_LABELS[confederation],cycle,season,participants,table,
    championId:completed?table[0]?.nationId:undefined}
}
