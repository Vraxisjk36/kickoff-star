import type { Player } from '../types/player'
import { computeCurrentAbility, toOvr } from './rating'
import type { Team } from './teams'

/** FC-style rating *bands*, not data copied from a licensed game.
 * Ratings describe senior first teams, not 14-year-old school sides.
 */
const TOP_FLIGHT_BASE: Readonly<Record<string,number>>={
  eng:79,esp:78,ger:78,ita:78,fra:76,por:74,ned:74,sco:70,
  bra:73,arg:72,usa:70,mex:71,rsa:67,mar:67,egy:66,nga:63,
  jpn:70,kor:68,sau:72,bel:73,tur:73,
}
const confedFallback:Readonly<Record<string,number>>={
  uefa:70,conmebol:68,concacaf:63,caf:60,afc:62,ofc:54
}
export function proRatingTarget(country:string,tier:number,rank:number,clubs:number,
  confederation='uefa'):number {
  const base=TOP_FLIGHT_BASE[country]??confedFallback[confederation]??64
  const position=clubs>1?rank/(clubs-1):.5
  // Top European clubs 84-87; typical PL side 76-82. Lower divisions
  // drop ~10 points per tier so a youth graduate does not dominate instantly.
  const elite=country==='eng'||country==='esp'||country==='ger'||country==='ita'?5:3
  const peak=base+elite
  const floor=base-5
  return Math.max(34,Math.min(89,Math.round(peak-(peak-floor)*position-(tier-1)*10)))
}
const SENIOR_NATION_TARGETS:Readonly<Record<string,number>>={
  eng:84,esp:86,fra:85,arg:86,bra:85,por:83,ger:83,ned:82,ita:83,
  bel:81,sco:76,mar:78,sen:77,nga:76,gha:72,rsa:70,
  usa:76,mex:76,jpn:78,kor:76,aus:73,tur:77,aut:77,sui:78,
}
export function seniorNationalTeamRating(nation:string):number {
  return SENIOR_NATION_TARGETS[nation]??72
}
export function calibrateSeniorTeam(team:Team,target:number):Team {
  const o=Math.round(target)
  return {...team,prestige:Math.max(1,Math.round(o/10)),
    ratings:{attack:Math.min(95,Math.max(25,o+1)),midfield:Math.min(95,Math.max(25,o)),
      defense:Math.min(95,Math.max(25,o-1))}}
}
/** The 1–20 school attribute system remains the single source of truth.
 * Joining a professional squad moves a genuine graduate onto the adult
 * playing scale, while retaining attribute strengths and weaknesses.
 */
export function prepareProGraduate(player:Player):Player {
  if(toOvr(computeCurrentAbility(player))>=60)return player
  const values=player.attributes.values as Record<string,number>
  const gap=Math.max(0,Math.ceil((60-toOvr(computeCurrentAbility(player)))/3.95))
  const normalized=Object.fromEntries(Object.entries(values).map(([key,value])=>
    [key,Math.max(1,Math.min(20,value+gap))]))
  const potential=Math.max(player.potential,Math.min(20,Math.max(...Object.values(normalized))+3))
  return {...player,potential,attributes:{...player.attributes,values:normalized} as Player['attributes']}
}
