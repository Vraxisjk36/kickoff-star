import type { Position } from '../types/attributes'

export interface CompetitionPlayerStats {
  playerId:string;name:string;teamId:string;position:Position
  apps:number;starts:number;minutes:number;goals:number;assists:number;cleanSheets:number;saves:number
  tackles:number;keyPasses:number;ratingTotal:number;potm:number
}
export interface CompetitionStatBook {competitionId:string;players:Record<string,CompetitionPlayerStats>}
export interface MatchStatLine {
  playerId:string;name:string;teamId:string;position:Position;started:boolean;minutes:number;goals:number;assists:number
  cleanSheet:boolean;saves:number;tackles:number;keyPasses:number;rating:number;potm:boolean
}
export interface CompetitionAwards {
  goldenBoot:CompetitionPlayerStats|null;playmaker:CompetitionPlayerStats|null;goldenGlove:CompetitionPlayerStats|null
  playerOfCompetition:CompetitionPlayerStats|null
}

export function emptyStatBook(competitionId:string):CompetitionStatBook{return{competitionId,players:{}}}
export function recordCompetitionStats(book:CompetitionStatBook,lines:MatchStatLine[]):CompetitionStatBook{
  const players={...book.players}
  for(const l of lines){
    const p=players[l.playerId]??{playerId:l.playerId,name:l.name,teamId:l.teamId,position:l.position,apps:0,starts:0,minutes:0,goals:0,assists:0,cleanSheets:0,saves:0,tackles:0,keyPasses:0,ratingTotal:0,potm:0}
    players[l.playerId]={...p,apps:p.apps+1,starts:p.starts+(l.started?1:0),minutes:p.minutes+l.minutes,goals:p.goals+l.goals,assists:p.assists+l.assists,cleanSheets:p.cleanSheets+(l.cleanSheet?1:0),saves:p.saves+l.saves,tackles:p.tackles+l.tackles,keyPasses:p.keyPasses+l.keyPasses,ratingTotal:p.ratingTotal+l.rating,potm:p.potm+(l.potm?1:0)}
  }
  return{...book,players}
}
const avg=(p:CompetitionPlayerStats)=>p.apps?p.ratingTotal/p.apps:0
const sort=(ps:CompetitionPlayerStats[],fn:(a:CompetitionPlayerStats,b:CompetitionPlayerStats)=>number)=>[...ps].sort(fn)[0]??null
export function competitionAwards(book:CompetitionStatBook):CompetitionAwards{
  const ps=Object.values(book.players)
  return{
    goldenBoot:sort(ps,(a,b)=>b.goals-a.goals||b.assists-a.assists||avg(b)-avg(a)),
    playmaker:sort(ps,(a,b)=>b.assists-a.assists||b.keyPasses-a.keyPasses||avg(b)-avg(a)),
    goldenGlove:sort(ps.filter(p=>p.position==='GK'),(a,b)=>b.cleanSheets-a.cleanSheets||b.saves-a.saves||avg(b)-avg(a)),
    playerOfCompetition:sort(ps.filter(p=>p.apps>=2),(a,b)=>(avg(b)+b.potm*.18+b.goals*.035+b.assists*.03)-(avg(a)+a.potm*.18+a.goals*.035+a.assists*.03)),
  }
}
export function leaderboard(book:CompetitionStatBook,metric:'goals'|'assists'|'rating'|'cleanSheets',limit=10){
  const ps=Object.values(book.players)
  return [...ps].sort((a,b)=>metric==='rating'?avg(b)-avg(a):(b[metric] as number)-(a[metric] as number)||avg(b)-avg(a)).slice(0,limit)
}


function statHash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function statPick<T>(xs:T[],seed:string,offset=0):T|undefined{return xs.length?xs[(statHash(seed+'|'+offset)%xs.length)]:undefined}

/** Build deterministic NPC stat lines from an already-resolved fixture.
 * This never changes the scoreline; it attributes that scoreline to persistent players.
 */
export function npcLinesForResult(args:{fixtureId:string;homeTeamId:string;awayTeamId:string;homeGoals:number;awayGoals:number;homePlayers:{id:string;name:string;position:Position}[];awayPlayers:{id:string;name:string;position:Position}[]}):MatchStatLine[]{
 const out:MatchStatLine[]=[]
 const side=(teamId:string,players:typeof args.homePlayers,goals:number,conceded:number,salt:string)=>{
  const starters=players.slice(0,11),gk=starters.find(p=>p.position==='GK')
  for(const p of starters)out.push({playerId:p.id,name:p.name,teamId,position:p.position,started:true,minutes:90,goals:0,assists:0,cleanSheet:conceded===0,saves:p.position==='GK'?Math.max(0,Math.round(2+statHash(args.fixtureId+'|save|'+salt)%5-conceded*.35)):0,tackles:p.position==='CB'||p.position==='FB'?1+statHash(args.fixtureId+'|tk|'+p.id)%5:statHash(args.fixtureId+'|tk|'+p.id)%3,keyPasses:['CM','WM','WG'].includes(p.position)?statHash(args.fixtureId+'|kp|'+p.id)%4:statHash(args.fixtureId+'|kp|'+p.id)%2,rating:5.8, potm:false})
  const attackers=starters.filter(p=>p.position!=='GK')
  for(let i=0;i<goals;i++){const scorer=statPick(attackers,args.fixtureId+'|goal|'+salt,i);if(scorer){const l=out.find(x=>x.playerId===scorer.id)!;l.goals++;l.rating+=.55}const assister=statPick(attackers.filter(p=>p.id!==scorer?.id),args.fixtureId+'|assist|'+salt,i);if(assister&&statHash(args.fixtureId+'|hasassist|'+salt+'|'+i)%100<72){const l=out.find(x=>x.playerId===assister.id)!;l.assists++;l.rating+=.32}}
  if(gk&&conceded===0){const l=out.find(x=>x.playerId===gk.id)!;l.rating+=.35}
 }
 side(args.homeTeamId,args.homePlayers,args.homeGoals,args.awayGoals,'h');side(args.awayTeamId,args.awayPlayers,args.awayGoals,args.homeGoals,'a')
 const best=[...out].sort((a,b)=>b.rating-a.rating||b.goals-a.goals||b.assists-a.assists)[0];if(best)best.potm=true
 return out
}
