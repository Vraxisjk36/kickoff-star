import { proRoll } from './proWorldFactory'
import { promotionEligible } from './proRegionalRules'
import type { IsoDate, ProFixture, ProStandingRow, ProWorldState } from './proWorld'
const add = (date: IsoDate, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
const rank = (rows: ProStandingRow[]) => [...rows].sort((a, b) => b.points - a.points ||
  (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) ||
  b.goalsFor - a.goalsFor || a.clubId.localeCompare(b.clubId))

/** Six promotion places from sixteen groups of six and two-legged knockout rounds.
 * This is a compact simulated format, not a complete reproduction of CBF qualifiers.
 */
export function brazilSerieDQualification(world: ProWorldState, lastDate: IsoDate):
  { promotedIds: string[]; fixtures: ProFixture[]; readyDate: IsoDate } {
  const year = world.competitions['third-bra'].seasonId
  const groups = Array.from({length:16},(_,i)=>{
    const rows=world.standings[`fourth-bra-${i+1}`]
    if(rows?.length!==6) throw new Error('Invalid Brazilian regional group')
    const eligible=rank(rows).filter(row=>promotionEligible(world,row.clubId,3)).slice(0,4)
    if(eligible.length!==4) throw new Error('Insufficient licensed Série D clubs')
    return eligible.map(row=>row.clubId)
  })
  const starters=[
    ...groups.map(g=>g[0]),...groups.map(g=>g[1]),
    ...groups.map(g=>g[2]),...groups.map((_,i)=>groups[(16-i)%16][3]),
  ]
  const fixtures:ProFixture[]=[]
  const contest=(a:string,b:string,round:number,index:number)=>{
    const matches=[[a,b],[b,a]].map(([homeId,awayId],leg)=>{
      const id=`fixture-serie-d-${year}-${round}-${index}-${leg}`
      const edge=(world.clubs[homeId].reputation-world.clubs[awayId].reputation)*.035
      const result={homeGoals:Math.max(0,Math.floor(1.55+edge+(proRoll(world.seed,`${id}:h`)-.5)*3.4)),
        awayGoals:Math.max(0,Math.floor(1.35-edge+(proRoll(world.seed,`${id}:a`)-.5)*3.4))}
      fixtures.push({id,competitionId:'promotion-bra-3',kickoffDate:add(lastDate,4+round*10+leg*5),
        homeId,awayId,result})
      return result
    })
    const ga=matches[0].homeGoals+matches[1].awayGoals
    const gb=matches[0].awayGoals+matches[1].homeGoals
    const winner=ga===gb?(proRoll(world.seed,`${year}:${round}:${index}:pens`)<.5?a:b):ga>gb?a:b
    return {winner,loser:winner===a?b:a}
  }
  let current=starters, semifinalists:string[]=[],quarterLosers:string[]=[]
  for(let round=0;round<6;round++){
    const outcomes=Array.from({length:current.length/2},(_,i)=>contest(current[i],current[current.length-1-i],round,i))
    current=outcomes.map(x=>x.winner)
    if(round===3){semifinalists=[...current];quarterLosers=outcomes.map(x=>x.loser)}
  }
  const extras=[contest(quarterLosers[0],quarterLosers[3],4,50),
    contest(quarterLosers[1],quarterLosers[2],4,51)]
  const promotedIds=[...semifinalists,...extras.map(x=>x.winner)]
  if(promotedIds.length!==6||new Set(promotedIds).size!==6||fixtures.length!==130)
    throw new Error('Invalid Brazil Série D qualification')
  return {promotedIds,fixtures,readyDate:add(lastDate,62)}
}
