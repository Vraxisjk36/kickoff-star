import { proRatingTarget } from './proRatings'
import { plannedClubCount, proWorldClubIdentity } from './proWorldFactory'
import { LOWER_DIVISIONS } from './proLeagueRegistry'

export interface SeniorTrialOffer {
  id:string
  associationId:string
  tier:1|2
  rank:number
  name:string
  overall:number
  prestige:number
  reason:string
}
/** Exactly four *total* career offers, never four per country.
 * A 60-OVR academy graduate should expect lower-flight football in strong
 * countries or a weaker first flight abroad, not Europe's top clubs.
 * Exceptional nine-assessment trials unlock at most one bottom-tier top
 * division candidate. The match engine and pay still use full OVR.
 */
export function seniorTrialOffers(points:number,ovr:number):SeniorTrialOffer[]{
  const score=Math.max(0,Math.min(9,Math.floor(points)))
  const ability=Math.max(35,Math.min(90,Math.round(ovr)))
  const standout=score>=7 && ability>=57
  const strong=['eng','esp','ger','ita','fra','ned','por','sco'] as const
  const smaller=['rsa','sco','bra','por','ned'] as const
  const seed=(score*7+ability*3)%37
  const candidates:Array<{country:string;tier:1|2;rank:number;label:string}>=[]
  for(let n=0;n<18;n++){
    const country=strong[(n+seed)%strong.length]
    const size=LOWER_DIVISIONS[country]?.clubs??18
    candidates.push({country,tier:2,rank:Math.min(size-1,4+(n*3+seed)%(Math.max(1,size-5))),
      label:'Second division opportunity'})
  }
  for(let n=0;n<14;n++){
    const country=smaller[(n+seed)%smaller.length]
    const size=plannedClubCount(country)
    candidates.push({country,tier:1,rank:Math.max(1,size-1-(n*2+seed)%Math.min(7,size-1)),
      label:'First division opportunity'})
  }
  if(standout)for(const country of ['eng','esp','ger','ita','fra']){
    const size=plannedClubCount(country)
    candidates.push({country,tier:1,rank:size-1, label:'Exceptional trial · relegation-battle club'})
  }
  const maxRating=standout?Math.min(79,ability+14):Math.min(76,ability+10)
  const allowed=candidates.map(item=>{
    const size=item.tier===1?plannedClubCount(item.country):LOWER_DIVISIONS[item.country]?.clubs??18
    const overall=proRatingTarget(item.country,item.tier,item.rank,size)
    const club=proWorldClubIdentity(item.country,item.tier,item.rank)
    return {...item,overall,name:club.name}
  }).filter(item=>item.overall<80 && item.overall<=maxRating &&
    (standout || item.tier===2 || !['eng','esp','ger','ita','fra'].includes(item.country)))
  const unique=new Set<string>()
  const selected:SeniorTrialOffer[]=[]
  const addFrom=(pool:typeof allowed,count:number)=>{
    for(const candidate of pool){
      if(count<=0)break
      const key=`${candidate.country}:${candidate.tier}:${candidate.rank}`
      if(unique.has(key))continue
      if(selected.some(item=>item.associationId===candidate.country))continue
      unique.add(key)
      selected.push({id:key,associationId:candidate.country,tier:candidate.tier,
        rank:candidate.rank,name:candidate.name,overall:candidate.overall,
        prestige:Math.max(3,Math.min(8,Math.round(candidate.overall/12))),
        reason:candidate.label})
      count--
    }
  }
  const major=(item:typeof allowed[number])=>['eng','esp','ger','ita','fra'].includes(item.country)
  addFrom(allowed.filter(item=>item.tier===2&&major(item)),2)
  addFrom(allowed.filter(item=>item.tier===1&&!major(item)),standout?1:2)
  if(standout)addFrom(allowed.filter(item=>item.tier===1&&major(item)),1)
  if(selected.length<4)addFrom(allowed.filter(item=>item.tier===2),4-selected.length)
  if(selected.length<4)addFrom(allowed.filter(item=>item.tier===1&&!major(item)),4-selected.length)
  if(selected.length!==4)throw new Error('Senior scouting failed to supply four affordable offers')
  return selected
}
