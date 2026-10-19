import { NATIONS } from './nations'
import type { SeniorInternationalRecord } from './proInternational'
import { internationalCycle } from './proInternationalTournament'

export interface SeniorNationRanking {
  nationId: string
  place: number
  points: number
  initialPoints: number
  change: number
  played: number
}

/** Fictional national-team rating index, deliberately not an official FIFA ranking.
 * All nations have a seeded strength. Only actual completed user-controlled
 * senior internationals modify ratings; skipped duty does not count.
 * This reconstruction is deterministic and save-compatible without new state.
 */
export function seniorNationRankings(records: readonly SeniorInternationalRecord[] = [],
  throughSeason = Number.POSITIVE_INFINITY, throughWeek = Number.POSITIVE_INFINITY): SeniorNationRanking[] {
  const rows=new Map(NATIONS.map(nation=>[nation.id,{
    nationId:nation.id,place:0,points:800+nation.strength*110,
    initialPoints:800+nation.strength*110,change:0,played:0,
  }]))
  const chronological=[...records].filter(record=>record.minutes>0 &&
    (record.season<throughSeason ||
      record.season===throughSeason && record.week<=throughWeek) &&
    Number.isFinite(record.scored)&&Number.isFinite(record.conceded) &&
    record.scored>=0 && record.conceded>=0)
    .sort((a,b)=>a.season-b.season||a.week-b.week||a.id.localeCompare(b.id))
  const applied=new Set<string>()
  for(const game of chronological){
    const home=rows.get(game.nationId),away=rows.get(game.opponentId)
    if(!home||!away||home===away)continue
    const unique=`${game.season}:${game.week}:${[game.nationId,game.opponentId].sort().join(':')}`
    if(applied.has(unique))continue
    applied.add(unique)
    const homeExpectation=1/(1+Math.pow(10,(away.points-home.points)/400))
    const result=game.scored>game.conceded?1:game.scored===game.conceded?.5:0
    const weight=game.competition==='final'?36:
      game.competition==='semifinal'||game.competition==='finals-group'?30:
      game.competition==='qualifier'?24:game.competition==='continental'?22:12
    const margin=Math.min(1.6,1+Math.abs(game.scored-game.conceded)*.1)
    const delta=Math.round(weight*margin*(result-homeExpectation)*10)/10
    home.points+=delta
    away.points-=delta
    home.played++
    away.played++
  }
  return [...rows.values()].map(row=>({
    ...row,points:Math.round(row.points*10)/10,
    change:Math.round((row.points-row.initialPoints)*10)/10,
  })).sort((a,b)=>b.points-a.points||a.nationId.localeCompare(b.nationId))
    .map((row,index)=>({...row,place:index+1}))
}

export interface SeniorNationalHonours {
  titleCycles: number[]
  finals: number
  semifinalAppearances: number
  internationalGoals: number
  internationalCaps: number
}
export function seniorNationalHonours(nationId:string,
  records:readonly SeniorInternationalRecord[],
  championships: (nationId:string,cycle:number,records:readonly SeniorInternationalRecord[])=>
    {championId?:string,semifinalists:string[],finalistsMatch:string[]}):SeniorNationalHonours {
  const cycles=[...new Set(records.filter(r=>r.nationId===nationId &&
    ['qualifier','finals-group','semifinal','final','third-place'].includes(r.competition))
    .map(record=>internationalCycle(record.season)))]
  const titleCycles:number[]=[]
  let finals=0,semifinalAppearances=0
  for(const cycle of cycles){
    const progress=championships(nationId,cycle,records)
    if(!records.some(r=>r.season>=cycle+3&&r.season<=cycle+3&&r.week>=25))continue
    if(progress.semifinalists.includes(nationId))semifinalAppearances++
    if(progress.finalistsMatch.includes(nationId))finals++
    if(progress.championId===nationId &&
      records.some(r=>r.nationId===nationId&&r.season===cycle+3&&
        r.competition==='final'&&r.minutes>0))titleCycles.push(cycle)
  }
  const games=records.filter(r=>r.nationId===nationId&&r.minutes>0)
  return {titleCycles,finals,semifinalAppearances,
    internationalGoals:games.reduce((n,r)=>n+r.goals,0),
    internationalCaps:games.length}
}
