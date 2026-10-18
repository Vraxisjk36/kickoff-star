import { proRoll } from './proWorldFactory'
import type { IsoDate, ProFixture, ProStandingRow, ProWorldState } from './proWorld'

const add = (date: IsoDate, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
const rank = (rows: ProStandingRow[]) => [...rows].sort((a,b) => b.points-a.points ||
  (b.goalsFor-b.goalsAgainst)-(a.goalsFor-a.goalsAgainst) || b.goalsFor-a.goalsFor || a.clubId.localeCompare(b.clubId))

/** A club cannot rise if it is a reserve of a side in the destination tier
 * or failed licensing. Older saves default to independent, licensed clubs.
 * Never infer reserve status from a fictional club's spelling.
 */
export function promotionEligible(world: ProWorldState, clubId: string, destination: number): boolean {
  const club = world.clubs[clubId]
  if (!club || club.licenseEligible === false) return false
  if (!club.parentClubId) return true
  const parent = world.clubs[club.parentClubId]
  return !!parent && parent.associationId === club.associationId && (parent.tier ?? 1) < destination
}

function fixture(world: ProWorldState, country: string, year: string,
  label: string, date: IsoDate, homeId: string, awayId: string): ProFixture {
  const id = `fixture-regional-${country}-${year}-${label}`
  const edge = (world.clubs[homeId].reputation-world.clubs[awayId].reputation)*.034
  return {id, competitionId: `promotion-${country}-3`, kickoffDate: date, homeId, awayId,
    result: {
      homeGoals: Math.max(0,Math.floor(1.7+edge+(proRoll(world.seed,`${id}:home`)-.5)*3.3)),
      awayGoals: Math.max(0,Math.floor(1.35-edge+(proRoll(world.seed,`${id}:away`)-.5)*3.3)),
    }}
}

function tie(world: ProWorldState, country: string, year: string, label: string,
  start: IsoDate, home: string, away: string, fixtures: ProFixture[]): string {
  const first = fixture(world,country,year,`${label}-1`,start,home,away)
  const second = fixture(world,country,year,`${label}-2`,add(start,5),away,home)
  fixtures.push(first,second)
  const a = first.result!.homeGoals+second.result!.awayGoals
  const b = first.result!.awayGoals+second.result!.homeGoals
  return a === b ? (proRoll(world.seed,`${first.id}:penalties`) < .5 ? home : away) :
    a > b ? home : away
}

/** RFEF Segunda Federación: five champions promoted directly; positions
 * 2–5 enter a two-round, two-leg playoff for five further promotion spots.
 */
export function spanishSegundaFederacion(world: ProWorldState, lastDate: IsoDate):
  {promotedIds: string[]; fixtures: ProFixture[]; readyDate: IsoDate} {
  const year = world.competitions['third-esp-1'].seasonId
  const fixtures: ProFixture[] = [], promotedIds: string[] = []
  for (let group=1;group<=5;group++) {
    const rows = rank(world.standings[`fourth-esp-${group}`])
    if(rows.length!==18) throw new Error('Missing Spanish Segunda Federación group')
    const direct = rows.find(r => promotionEligible(world,r.clubId,3))
    if(!direct) throw new Error('No eligible Spanish group champion')
    promotedIds.push(direct.clubId)
    const candidates = rows.filter(r=>r.clubId!==direct.clubId && promotionEligible(world,r.clubId,3)).slice(0,4)
    if(candidates.length!==4) throw new Error('Insufficient Spanish playoff-eligible clubs')
    const semiA = tie(world,'esp',year,`g${group}-semi-a`,add(lastDate,4),
      candidates[3].clubId,candidates[0].clubId,fixtures)
    const semiB = tie(world,'esp',year,`g${group}-semi-b`,add(lastDate,4),
      candidates[2].clubId,candidates[1].clubId,fixtures)
    promotedIds.push(tie(world,'esp',year,`g${group}-final`,add(lastDate,16),semiB,semiA,fixtures))
  }
  return {promotedIds,fixtures,readyDate:add(lastDate,27)}
}

/** Italy: nine Serie D champions are directly eligible for Serie C.
 * Serie D's post-season play-offs do not confer nine additional automatic berths.
 */
export function italianSerieD(world: ProWorldState):
  {promotedIds: string[]; fixtures: ProFixture[]; readyDate: IsoDate} {
  const promotedIds = Array.from({length:9},(_,i)=>{
    const rows=rank(world.standings[`fourth-ita-${i+1}`])
    if(rows.length!==18) throw new Error('Missing Italian Serie D group')
    const eligible=rows.find(r=>promotionEligible(world,r.clubId,3))
    if(!eligible) throw new Error('No licensed Italian Serie D promotion candidate')
    return eligible.clubId
  })
  return {promotedIds,fixtures:[],readyDate:'0000-01-01'}
}

/** FPF 2026/27 Campeonato de Portugal: four series of 14, top two per
 * series enter two geographical pools of four. Top two of each pool go up.
 */
export function portugueseCampeonato(world: ProWorldState, lastDate: IsoDate):
  {promotedIds: string[]; fixtures: ProFixture[]; readyDate: IsoDate} {
  const year=world.competitions['third-por-1'].seasonId
  const fixtures:ProFixture[]=[]
  const entries=Array.from({length:4},(_,g)=>{
    const rows=rank(world.standings[`fourth-por-${g+1}`])
    if(rows.length!==14) throw new Error('Missing Portuguese Campeonato group')
    const eligible=rows.filter(r=>promotionEligible(world,r.clubId,3)).slice(0,2)
    if(eligible.length!==2) throw new Error('Missing Portuguese promotion candidates')
    return eligible.map(r=>r.clubId)
  })
  const promotedIds:string[]=[]
  for(let pool=0;pool<2;pool++){
    const teams=[...entries[pool*2],...entries[pool*2+1]]
    const scores=new Map(teams.map(id=>[id,{clubId:id,played:0,won:0,drawn:0,lost:0,goalsFor:0,goalsAgainst:0,points:0} as ProStandingRow]))
    let round=0
    for(let a=0;a<teams.length;a++)for(let b=a+1;b<teams.length;b++)for(let leg=0;leg<2;leg++){
      const home=teams[leg?b:a],away=teams[leg?a:b]
      const game=fixture(world,'por',year,`pool${pool}-${a}-${b}-${leg}`,add(lastDate,5+round*2),home,away)
      fixtures.push(game)
      const h=scores.get(home)!,v=scores.get(away)!,r=game.result!
      h.played++;v.played++
      h.goalsFor+=r.homeGoals;h.goalsAgainst+=r.awayGoals
      v.goalsFor+=r.awayGoals;v.goalsAgainst+=r.homeGoals
      if(r.homeGoals>r.awayGoals){h.won++;v.lost++;h.points+=3}
      else if(r.homeGoals<r.awayGoals){v.won++;h.lost++;v.points+=3}
      else {h.drawn++;v.drawn++;h.points++;v.points++}
      round++
    }
    promotedIds.push(...rank([...scores.values()]).slice(0,2).map(r=>r.clubId))
  }
  return {promotedIds,fixtures,readyDate:add(lastDate,32)}
}

/** Provincial champions advance to ABC Motsepe national promotion playoffs.
 * At this 4th-to-3rd modeled boundary we preserve nine regional exchange
 * slots; do not confuse them with the separate two national 3rd-to-2nd berths.
 */
export function southAfricaProvincial(world: ProWorldState):
  {promotedIds: string[]; fixtures: ProFixture[]; readyDate: IsoDate} {
  const promotedIds=Array.from({length:9},(_,i)=>{
    const rows=rank(world.standings[`fourth-rsa-${i+1}`])
    if(rows.length!==12) throw new Error('Missing South African province')
    const eligible=rows.find(r=>promotionEligible(world,r.clubId,3))
    if(!eligible) throw new Error('No eligible provincial champion')
    return eligible.clubId
  })
  return {promotedIds,fixtures:[],readyDate:'0000-01-01'}
}
