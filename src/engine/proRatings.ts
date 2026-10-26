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
/** Initial first-team strength by stable club identity (not league position).
 * Fictional gameplay targets, not copied EA SPORTS FC database ratings.
 * Subsequent seasons remain governed by simulated form and development.
 */
const FEATURED_CLUB_STRENGTH: Readonly<Record<string,readonly number[]>> = {
  eng: [88,88,88,84,82,79,82,83,77,80,76,78,77,77,77,73,75,72,76,72],
  esp: [89,88,85,82,81,80,79,79,77,79,76,76,75,76,76,73,76,74,72,72],
}
/** Club heritage is distinct from present-day squad quality.
 * Indexed by original club identity so promotions do not alter history.
 */
const FEATURED_CLUB_HERITAGE: Readonly<Record<string,Readonly<Record<number,number>>>> = {
  eng: {0:91,1:91,2:96,3:89,4:94,5:87,6:85,7:84},
  esp: {0:98,1:97,2:90,3:85,4:83},
}
export function proClubReputationTarget(country:string,tier:number,rank:number,squadStrength:number):number {
  const heritage=tier===1?FEATURED_CLUB_HERITAGE[country]?.[rank]:undefined
  return Math.max(35,Math.min(99,heritage??squadStrength))
}
export function proRatingTarget(country:string,tier:number,rank:number,clubs:number,
  confederation='uefa'):number {
  if (tier === 1 && FEATURED_CLUB_STRENGTH[country]?.[rank] !== undefined)
    return FEATURED_CLUB_STRENGTH[country][rank]
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
export function prepareProGraduate(player:Player, trialPoints=4):Player {
  const original=toOvr(computeCurrentAbility(player))
  // Strong school/academy careers and senior trial performance earn higher
  // entry ratings. Do not normalize every graduate to exactly 60 OVR.
  const score=Math.max(0,Math.min(9,trialPoints))
  // A first professional contract starts on the senior scale. Preserve
  // variation (60–66), but never strand a youth-scale player at 29 OVR.
  const target=Math.max(60,Math.min(66,Math.round(60+score*.55+Math.max(-2,Math.min(2,(original-50)*.1)))))
  if(original>=target)return player
  const values=player.attributes.values as Record<string,number>
  const originalValues={...values}
  // Recalculate actual positional OVR, rather than assuming a fixed
  // attribute-to-OVR conversion that fails for low-rated graduates.
  for(let increment=1;increment<=19;increment++){
    const normalized=Object.fromEntries(Object.entries(originalValues).map(([key,value])=>
      [key,Math.max(1,Math.min(20,value+increment))]))
    const potential=Math.max(player.potential,Math.min(20,Math.max(...Object.values(normalized))+3))
    const candidate={...player,potential,attributes:{...player.attributes,values:normalized} as Player['attributes']}
    if(toOvr(computeCurrentAbility(candidate))>=target || increment===19)return candidate
  }
  return player
}
