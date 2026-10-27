import type { Player } from '../types/player'
export type SponsorCategory='sportswear'|'boots'|'technology'|'automotive'|'fashion'|'watches'|'nutrition'|'travel'|'finance'|'gaming'
export interface SponsorBrand {id:string;name:string;category:SponsorCategory;tier:1|2|3|4|5;minPopularity:number}
export interface SponsorOffer {id:string;brandId:string;years:number;weeklyPay:number;signingBonus:number;expiresSeason:number;expiresWeek:number;shoeDeal:boolean}
export interface SponsorContract extends SponsorOffer {signedSeason:number;signedWeek:number;weeksPaid:number}
export interface SponsorState {offers:SponsorOffer[];contracts:SponsorContract[];history:SponsorContract[];lastGenerated?:string}
const brands:[string,SponsorCategory][]=[
 ['Mike Athletics','sportswear'],['Adibas','sportswear'],['Puma Ridge','sportswear'],['Under Armoury','sportswear'],['New Balance Point','sportswear'],['Reebex','sportswear'],['Fila Nova','sportswear'],
 ['Swoosh Elite','boots'],['Three Stripes Football','boots'],['Panther Boots','boots'],['Umbra Football','boots'],['Velocity Cleats','boots'],['StrikeForge','boots'],['PitchCraft','boots'],
 ['Pear Technologies','technology'],['Samsun Electronics','technology'],['Sonix','technology'],['Microsoft','technology'],['Huawei Mobile','technology'],['OnePulse','technology'],['NovaVision','technology'],
 ['Merceda Motors','automotive'],['Bavarian Motor Works','automotive'],['Audix','automotive'],['Porscha','automotive'],['Ferrarix','automotive'],['Lamboro','automotive'],['Toyoda','automotive'],
 ['Louis Vellon','fashion'],['Guccio','fashion'],['Balenciara','fashion'],['Versano','fashion'],['Pradelle','fashion'],['Armani Club','fashion'],['Zara Peak','fashion'],
 ['Rolexion','watches'],['Audemar Royale','watches'],['Patek Phillipson','watches'],['OmegaTime','watches'],['Tag Heurix','watches'],['Cartiera','watches'],['Tissora','watches'],
 ['PowerBull','nutrition'],['Monster Fuel','nutrition'],['GatorRush','nutrition'],['PrimeMotion','nutrition'],['BodyFuel','nutrition'],['HydroSport','nutrition'],['FuelFit','nutrition'],
 ['Emirate Sky','travel'],['Qatarion Airways','travel'],['LuftStar','travel'],['DeltaWing','travel'],['Air Francex','travel'],['SkyLink','travel'],['FlyGlobal','travel'],
 ['VisaNova','finance'],['MasterCred','finance'],['American Expressive','finance'],['PayPalace','finance'],['Revolute','finance'],['Monzo Plus','finance'],['StripeWave','finance'],
 ['PlayStationix','gaming'],['Xboxon','gaming'],['Nintenda','gaming'],['EA Sportiva','gaming'],['Razerion','gaming'],['Logitech Grit','gaming'],['EpicPlay','gaming']
]
export const SPONSOR_BRANDS:readonly SponsorBrand[]=brands.map(([name,category],i)=>({id:'sponsor-'+String(i+1),name,category,tier:Math.min(5,1+Math.floor((i%7)/1.5)) as 1|2|3|4|5,minPopularity:[8,18,30,44,62][Math.min(4,Math.floor((i%7)/1.5))]}))
export const emptySponsorState=():SponsorState=>({offers:[],contracts:[],history:[]})
export const sponsorCareerAppearances=(player:Player)=>player.career?.appearances??(player.proCareer?.seasonRecords??[]).reduce((sum,r)=>sum+r.appearances,0)+(player.seasonAppearances??0)
export function sponsorPopularity(player:Player):number{
 const matches=sponsorCareerAppearances(player)
 const avg=(player.matchRatings??[]).length?(player.matchRatings??[]).reduce((a,b)=>a+b,0)/(player.matchRatings??[]).length:6
 const goals=player.career?.goals??player.seasonGoals??0
 const seasons=player.proCareer?.seasonRecords??[]
 return Math.max(0,Math.min(100,Math.round((player.reputation??15)*.52+Math.min(28,matches/12)+Math.max(0,avg-6)*8+Math.min(12,goals/15)+seasons.filter(s=>s.leagueChampion).length*4)))
}
function hash(s:string){let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0}
function stamp(season:number,week:number){return season*100+week}
export function sponsorWeek(state:SponsorState|undefined,player:Player,season:number,week:number):{state:SponsorState;pay:number}{
 const current=state??emptySponsorState(),now=stamp(season,week)
 const active=current.contracts.filter(c=>now<stamp(c.signedSeason+c.years,c.signedWeek))
 const expired=current.contracts.filter(c=>!active.includes(c))
 const pay=active.reduce((sum,c)=>sum+c.weeklyPay,0)
 const contracts=active.map(c=>({...c,weeksPaid:c.weeksPaid+1}))
 const offers=current.offers.filter(o=>now<=stamp(o.expiresSeason,o.expiresWeek)&&!contracts.some(c=>c.brandId===o.brandId))
 const cycle=`${season}:${Math.floor((week-1)/4)}`
 if(current.lastGenerated===cycle)return {state:{...current,offers,contracts,history:[...current.history,...expired]},pay}
 const popularity=sponsorPopularity(player),matches=sponsorCareerAppearances(player)
 const candidates=SPONSOR_BRANDS.filter(b=>popularity>=b.minPopularity&&!contracts.some(c=>c.brandId===b.id)&&!offers.some(o=>o.brandId===b.id)&&
   (b.category!=='boots'||(matches>=200&&popularity>=70)) &&
   !contracts.some(c=>c.shoeDeal&&b.category==='boots') &&
   !contracts.some(c=>SPONSOR_BRANDS.find(bd=>bd.id===c.brandId)?.category===b.category))
 const ranked=candidates.map(b=>({b,roll:hash(`${player.id}:${cycle}:${b.id}`)})).sort((a,b)=>a.roll-b.roll)
 const chance=hash(`${player.id}:${cycle}:chance`)%100
 const count=chance<Math.min(85,15+popularity)?(popularity>=70?2:1):0
 const fresh=ranked.slice(0,count).map(({b})=>{
   const years=Math.min(5,Math.max(1,1+Math.floor((popularity-b.minPopularity)/17)))
   const weeklyPay=Math.round((150+b.tier*b.tier*280+popularity*popularity*1.2)*(b.category==='boots'?2.8:1)/50)*50
   return {id:`${cycle}:${b.id}`,brandId:b.id,years,weeklyPay,signingBonus:weeklyPay*(3+b.tier*2),expiresSeason:season,expiresWeek:week+3,shoeDeal:b.category==='boots'}
 })
 return {state:{offers:[...offers,...fresh],contracts,history:[...current.history,...expired],lastGenerated:cycle},pay}
}
export function acceptSponsor(state:SponsorState|undefined,offerId:string,season:number,week:number):{state:SponsorState;bonus:number;error?:string}{
 const current=state??emptySponsorState(),offer=current.offers.find(o=>o.id===offerId)
 if(!offer||stamp(season,week)>stamp(offer.expiresSeason,offer.expiresWeek))return {state:current,bonus:0,error:'Offer expired'}
 const category=SPONSOR_BRANDS.find(b=>b.id===offer.brandId)?.category
 if(current.contracts.some(c=>c.brandId===offer.brandId||SPONSOR_BRANDS.find(b=>b.id===c.brandId)?.category===category))
   return {state:current,bonus:0,error:'Conflicting exclusive contract'}
 const contract={...offer,signedSeason:season,signedWeek:week,weeksPaid:0}
 return {state:{...current,offers:current.offers.filter(o=>o.id!==offerId&&SPONSOR_BRANDS.find(b=>b.id===o.brandId)?.category!==category),contracts:[...current.contracts,contract]},bonus:offer.signingBonus}
}
