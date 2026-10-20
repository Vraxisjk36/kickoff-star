import type { ProSeasonRecord,ProCareerState } from './proCareer'
import { PRO_INTERACTIVE_COUNTRIES } from './proLeagueRegistry'
import { proCompetitionName } from './proTournaments'
export interface LeagueRecord { associationId:string;competitionId:string;kind:'career-goals'|'season-goals'|'season-assists';holder:string;mark:number;current:number;broken:boolean }
export interface PlayerAward {id:string;title:string;recipient:string;won:boolean;reason:string}
const historical:Record<string,{career:number;season:number;assists:number;holder:string}>={
  eng:{career:262,season:37,assists:21,holder:'Arthur North'},
  esp:{career:475,season:51,assists:22,holder:'Mateo del Sol'},
  ger:{career:366,season:42,assists:20,holder:'Klaus Brenner'},
  fra:{career:301,season:43,assists:21,holder:'Jean Morel'},
  ita:{career:275,season:37,assists:19,holder:'Marco Rinaldi'},
  ned:{career:315,season:42,assists:22,holder:'Jasper van Dijk'},
  por:{career:291,season:35,assists:20,holder:'Tiago Almeida'},
  bra:{career:284,season:32,assists:20,holder:'Rafael Batista'},
  rsa:{career:130,season:27,assists:19,holder:'Themba Dube'},
  sco:{career:259,season:37,assists:18,holder:'Alistair Reid'},
}
export function proLeagueRecords(associationId:string,competitionId:string,
  records:readonly ProSeasonRecord[],current?:ProCareerState):LeagueRecord[]{
  const baseline=historical[associationId]??{career:175,season:30,assists:19,holder:'M. Legend'}
  const tier=competitionId.startsWith('top-')?1:2
  const factor=tier===1?1:.65
  const matching=records.filter(r=>(r.competitionId??`top-${r.associationId}`)===competitionId)
  const goals=matching.reduce((sum,r)=>sum+(r.leagueGoals??r.goals),0)+
    (current?.activeCompetitionId===competitionId?(current.seasonLeagueGoals??0):0)
  const seasonGoals=Math.max(0,...matching.map(r=>r.leagueGoals??r.goals),
    current?.activeCompetitionId===competitionId?(current.seasonLeagueGoals??0):0)
  const seasonAssists=Math.max(0,...matching.map(r=>r.leagueAssists??r.assists),
    current?.activeCompetitionId===competitionId?(current.seasonLeagueAssists??0):0)
  return [
    {kind:'career-goals' as const,holder:baseline.holder,mark:Math.round(baseline.career*factor),current:goals},
    {kind:'season-goals' as const,holder:baseline.holder,mark:Math.round(baseline.season*factor),current:seasonGoals},
    {kind:'season-assists' as const,holder:baseline.holder,mark:Math.round(baseline.assists*factor),current:seasonAssists},
  ].map(item=>({...item,associationId,competitionId,broken:item.current>item.mark}))
}
export function worldPlayerAwards(season:ProSeasonRecord,pro:ProCareerState):PlayerAward[]{
  const seed=(season.season*71+season.associationId.split('').reduce((s,c)=>s+c.charCodeAt(0),0))
  const npc=['Luca Valenti','Yanis Laurent','Diego Castillo','Mikkel Holm','Andre Moreira','Gabriel Ferreira','Tariq Mensah','Leon Weiss']
  const competitor=(i:number)=>npc[(seed+i*3)%npc.length]
  const humanLeague=season.leagueGoals??season.goals
  const humanAssists=season.leagueAssists??season.assists
  const form=season.goals*2+season.assists+Math.min(30,season.appearances)
  const worldThreshold=100+seed%18
  const bestThreshold=95+seed%21
  const leagueBest=humanLeague*2+humanAssists+season.appearances+
    (season.leagueChampion?15:0)
  const eligible=season.appearances>=12 && season.leaguePosition>0
  const awards=[
    {id:'golden-player',title:'World Golden Footballer',won:eligible&&form>=worldThreshold,
      reason:'A worldwide season-performance trophy, inspired by leading football honours',recipient:competitor(0)},
    {id:'world-best',title:'World Best Player',won:eligible&&form>=bestThreshold,
      reason:'Outstanding senior campaign across club and international football',recipient:competitor(1)},
    {id:'league-player',title:`${proCompetitionName(season.competitionId??`top-${season.associationId}`)} · Player of the Season`,
      won:eligible&&leagueBest>=77+seed%16,
      reason:'Season influence, goals, assists, minutes and club results',recipient:competitor(2)},
    {id:'golden-boot',title:'League Golden Boot',won:eligible&&humanLeague>=22+seed%9,
      reason:'Leading division goalscorer',recipient:competitor(3)},
    {id:'playmaker',title:'League Playmaker Award',won:eligible&&humanAssists>=13+seed%5,
      reason:'Most influential assists in domestic league football',recipient:competitor(4)},
  ]
  return awards.map(a=>({...a,recipient:a.won?'YOUR PLAYER':a.recipient}))
}
export function allPlayableRecordCatalog():string[]{
  return PRO_INTERACTIVE_COUNTRIES.flatMap(country=>[`top-${country}`,`second-${country}`])
}
