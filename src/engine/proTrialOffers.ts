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
  squadRole:'Development prospect'|'Rotation prospect'|'First-team candidate'
}
/** Exactly four *total* career offers, never four per country.
 * A 60-OVR academy graduate should expect lower-flight football in strong
 * countries or a weaker first flight abroad, not Europe's top clubs.
 * Exceptional nine-assessment trials unlock at most one bottom-tier top
 * division candidate. The match engine and pay still use full OVR.
 */
export function seniorTrialOffers(points:number,ovr:number,careerSeed=''):SeniorTrialOffer[]{
  const score=Math.max(0,Math.min(9,Math.floor(points)))
  const ability=Math.max(35,Math.min(90,Math.round(ovr)))
  const standout=score>=7 && ability>=57
  const strong=['eng','esp','ger','ita','fra','ned','por','sco'] as const
  const smaller=['rsa','sco','por','ned'] as const
  const identity=[...careerSeed].reduce((hash,char)=>((hash*31+char.charCodeAt(0))>>>0),17)
  const seed=(score*7+ability*3+identity)%37
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
  // Club strength is NOT a minimum player rating. A promising youngster
  // may sign for a stronger side on a development contract, not as a starter.
  // Keep first-team expectations realistic and exclude elite (80+) clubs.
  const allowed=candidates.map(item=>{
    const size=item.tier===1?plannedClubCount(item.country):LOWER_DIVISIONS[item.country]?.clubs??18
    const overall=proRatingTarget(item.country,item.tier,item.rank,size)
    const club=proWorldClubIdentity(item.country,item.tier,item.rank)
    return {...item,overall,name:club.name}
  }).filter(item=>item.overall<80 &&
    (standout || item.tier===2 || !['eng','esp','ger','ita','fra'].includes(item.country)))
  const unique=new Set<string>()
  const selected:SeniorTrialOffer[]=[]
  const roleFor=(overall:number):SeniorTrialOffer['squadRole']=>{
    const gap=overall-ability
    return gap>=9 || score<=2?'Development prospect':
      gap>=3 || score<6?'Rotation prospect':'First-team candidate'
  }
  const addFrom=(pool:typeof allowed,count:number)=>{
    for(const candidate of pool){
      if(count<=0)break
      const key=`${candidate.country}:${candidate.tier}:${candidate.rank}`
      if(unique.has(key))continue
      if(selected.some(item=>item.associationId===candidate.country))continue
      unique.add(key)
      const squadRole=roleFor(candidate.overall)
      selected.push({id:key,associationId:candidate.country,tier:candidate.tier,
        rank:candidate.rank,name:candidate.name,overall:candidate.overall,
        prestige:Math.max(3,Math.min(8,Math.round(candidate.overall/12))),
        squadRole,reason:`${candidate.label} · ${squadRole}`})
      count--
    }
  }
  const major=(item:typeof allowed[number])=>['eng','esp','ger','ita','fra'].includes(item.country)
  addFrom(allowed.filter(item=>item.tier===2&&major(item)),2)
  addFrom(allowed.filter(item=>item.tier===1&&!major(item)),standout?1:2)
  if(standout)addFrom(allowed.filter(item=>item.tier===1&&major(item)),1)
  if(selected.length<4)addFrom(allowed.filter(item=>item.tier===2),4-selected.length)
  if(selected.length<4)addFrom(allowed.filter(item=>item.tier===1&&!major(item)),4-selected.length)
  // Expand across actual league identities, not fabricated clubs or
  // artificially reduced squad OVR. Retain one club per association.
  if(selected.length<4){
    const fallback:typeof allowed=[]
    for(const country of [...strong,'rsa'] as const){
      for(const tier of [2,1] as const){
        if(tier===1&&!standout&&major({country,tier,rank:0,label:'',overall:0,name:''}))continue
        const size=tier===1?plannedClubCount(country):LOWER_DIVISIONS[country]?.clubs??18
        for(let rank=0;rank<size;rank++){
          const overall=proRatingTarget(country,tier,rank,size)
          if(overall>=80)continue
          const club=proWorldClubIdentity(country,tier,rank)
          fallback.push({country,tier,rank,label:'Scouted development pathway',overall,name:club.name})
        }
      }
    }
    fallback.sort((a,b)=>{
      const ga=Math.abs(a.overall-ability),gb=Math.abs(b.overall-ability)
      return ga-gb || ((a.rank+seed)%19)-((b.rank+seed)%19)
    })
    addFrom(fallback,4-selected.length)
  }
  if(selected.length!==4)throw new Error('Senior scouting failed to supply four realistic offers')
  return selected
}
