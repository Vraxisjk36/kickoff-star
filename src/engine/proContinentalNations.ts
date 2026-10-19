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
export interface ContinentalPair {homeId:string;awayId:string}
export function continentalRound(nationId:string,season:number,week:number):ContinentalPair[] {
  const index=CONTINENTAL_WINDOWS.indexOf(week as typeof CONTINENTAL_WINDOWS[number])
  const participants=continentalNations(nationId)
  if(index<0||participants.length<2)return []
  const entrants=participants.length%2===0?[...participants]:[...participants,'BYE']
  const absoluteRound=(season-continentalCycle(season))*3+index
  const round=absoluteRound%(entrants.length-1)
  const rotation=[entrants[0],...entrants.slice(1+round),...entrants.slice(1,1+round)]
  const pairs:ContinentalPair[]=[]
  for(let i=0;i<rotation.length/2;i++){
    const a=rotation[i],b=rotation[rotation.length-i-1]
    if(a==='BYE'||b==='BYE')continue
    const flip=(absoluteRound+i)%2===1
    pairs.push({homeId:flip?b:a,awayId:flip?a:b})
  }
  return pairs
}
export function continentalOpponent(nationId:string,season:number,week:number):string|null {
  const pair=continentalRound(nationId,season,week)
    .find(p=>p.homeId===nationId||p.awayId===nationId)
  return pair ? pair.homeId===nationId ? pair.awayId : pair.homeId : null
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
      for(const pair of continentalRound(nationId,year,window)){
        const {homeId,awayId}=pair
        const record=records.find(r=>r.minutes>0&&r.season===year&&r.week===window&&
          r.competition==='continental'&&
          ((r.nationId===homeId&&r.opponentId===awayId&&r.home)||
          (r.nationId===awayId&&r.opponentId===homeId&&!r.home)))
        const [homeGoals,awayGoals]=record
          ? record.home?[record.scored,record.conceded]:[record.conceded,record.scored]
          : simulatedGoals(homeId,awayId,year,window)
        const home=rows.get(homeId)!,away=rows.get(awayId)!
        home.played++;away.played++
        home.goalsFor+=homeGoals;home.goalsAgainst+=awayGoals
        away.goalsFor+=awayGoals;away.goalsAgainst+=homeGoals
        if(homeGoals>awayGoals){home.won++;away.lost++;home.points+=3}
        else if(homeGoals<awayGoals){away.won++;home.lost++;away.points+=3}
        else {home.drawn++;away.drawn++;home.points++;away.points++}
      }
    }
  const table=[...rows.values()].sort((a,b)=>b.points-a.points||
    (b.goalsFor-b.goalsAgainst)-(a.goalsFor-a.goalsAgainst)||
    b.goalsFor-a.goalsFor||a.nationId.localeCompare(b.nationId))
  const completed=season>=cycle+1&&week>=32
  return {confederation,name:REGION_LABELS[confederation],cycle,season,participants,table,
    championId:completed?table[0]?.nationId:undefined}
}
