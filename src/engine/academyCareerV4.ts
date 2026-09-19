import type { Position } from '../types/attributes'
import type { AcademyClub } from '../types/youthWorld'

export type AcademySquadLevel='u17'|'u19'
export type AcademyCompetitionKind='academy-league'|'academy-cup'|'continental-youth'
export type AcademyRole='starter'|'rotation'|'bench'|'development'

export interface AcademyPlayer {
  id:string;name:string;age:number;position:Position;overall:number;potential:number
  energy:number;form:number;role:AcademyRole
}
export interface AcademySquad {
  clubId:string;level:AcademySquadLevel;players:AcademyPlayer[];captainId:string
}
export interface AcademyFixture {
  id:string;competition:AcademyCompetitionKind;round:number;week:number
  homeClubId:string;awayClubId:string;played:boolean;homeGoals?:number;awayGoals?:number
}
export interface AcademySeason {
  year:number;clubId:string;squadLevel:AcademySquadLevel;squad:AcademySquad
  fixtures:AcademyFixture[];leaguePoints:number;cupAlive:boolean;continentalAlive:boolean
  proPathwayScore:number;releaseRisk:number
}

const FIRST=['Liam','Musa','Jayden','Noah','Kabelo','Ethan','Neo','Marcus','Kofi','Sam','Leo','Mateo','Amir','Lucas','Tiago','Yusuf']
const LAST=['Mokoena','Jacobs','Smith','Dlamini','Nkosi','Williams','Naidoo','Clarke','Mensah','Silva','Santos','Martinez','Diallo','Rossi','Jansen','Costa']
const POS:Position[]=['GK','GK','CB','CB','CB','FB','FB','FB','CM','CM','CM','WM','WG','WG','ST','ST','ST','CM','CB','WG','ST','FB']

function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed:string){let x=hash(seed)||1;return()=>{x+=0x6D2B79F5;let t=x;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v))

export function buildAcademySquad(club:AcademyClub,year:number,level:AcademySquadLevel):AcademySquad{
  const r=rng(`${club.id}|${year}|${level}`)
  const base=level==='u19'?58:52
  const players=Array.from({length:23},(_,i):AcademyPlayer=>{
    const overall=clamp(Math.round(base+(club.prestige-80)*.18+(r()-.5)*14),38,74)
    return{id:`${club.id}-${level}-${year}-${i}`,name:`${FIRST[Math.floor(r()*FIRST.length)]} ${LAST[Math.floor(r()*LAST.length)]}`,age:level==='u19'?(r()<.5?17:18):(r()<.55?15:16),position:POS[i%POS.length],overall,potential:clamp(Math.round(overall+7+r()*17),50,88),energy:90+Math.round(r()*10),form:5.8+r()*1.3,role:i<11?'starter':i<16?'rotation':i<20?'bench':'development'}
  })
  return{clubId:club.id,level,players,captainId:players[8].id}
}

function leagueOpponents(club:AcademyClub,clubs:AcademyClub[]){
  const same=clubs.filter(c=>c.id!==club.id&&c.region===club.region)
  const fallback=clubs.filter(c=>c.id!==club.id)
  return [...same,...fallback.filter(c=>!same.some(s=>s.id===c.id))].slice(0,9)
}
function cupOpponents(club:AcademyClub,clubs:AcademyClub[]){
  const domestic=clubs.filter(c=>c.id!==club.id&&c.region===club.region)
  const fallback=clubs.filter(c=>c.id!==club.id)
  return (domestic.length?domestic:fallback).slice(0,4)
}
function continentalOpponents(club:AcademyClub,clubs:AcademyClub[]){
  const foreign=clubs.filter(c=>c.id!==club.id&&c.region!==club.region).sort((a,b)=>b.prestige-a.prestige)
  return foreign.slice(0,5)
}

export function buildAcademySeason(club:AcademyClub,clubs:AcademyClub[],year:number,playerAge:number):AcademySeason{
  const level:AcademySquadLevel=playerAge>=17?'u19':'u17'
  const opponents=leagueOpponents(club,clubs)
  const fixtures:AcademyFixture[]=[]
  let week=6
  opponents.forEach((opp,i)=>{
    fixtures.push({id:`al-${year}-${club.id}-h-${opp.id}`,competition:'academy-league',round:i+1,week:week++,homeClubId:club.id,awayClubId:opp.id,played:false})
    fixtures.push({id:`al-${year}-${club.id}-a-${opp.id}`,competition:'academy-league',round:i+1+opponents.length,week:week+9,homeClubId:opp.id,awayClubId:club.id,played:false})
  })
  const domestic=cupOpponents(club,clubs)
  ;[12,20,28,36].forEach((w,i)=>{const opp=domestic[i%domestic.length];if(opp)fixtures.push({id:`ac-${year}-${club.id}-${i}`,competition:'academy-cup',round:i+1,week:w,homeClubId:i%2?club.id:opp.id,awayClubId:i%2?opp.id:club.id,played:false})})
  const continental=continentalOpponents(club,clubs)
  ;[10,15,24,31,39].forEach((w,i)=>{const opp=continental[i%continental.length];if(opp)fixtures.push({id:`cy-${year}-${club.id}-${i}`,competition:'continental-youth',round:i+1,week:w,homeClubId:i%2?club.id:opp.id,awayClubId:i%2?opp.id:club.id,played:false})})
  return{year,clubId:club.id,squadLevel:level,squad:buildAcademySquad(club,year,level),fixtures:fixtures.sort((a,b)=>a.week-b.week),leaguePoints:0,cupAlive:true,continentalAlive:club.prestige>=86,proPathwayScore:0,releaseRisk:0}
}

export interface AcademyReviewInput {averageRating:number;minutes:number;training:number;discipline:number;energy:number;positionCompetition:number}
export function reviewAcademyRole(current:AcademyRole,input:AcademyReviewInput):{role:AcademyRole;proPathwayScore:number;releaseRisk:number}{
  const form=clamp((input.averageRating-5.5)/3,0,1), minutes=clamp(input.minutes/1200,0,1), training=clamp(input.training/100,0,1), discipline=clamp(input.discipline/100,0,1), competition=clamp(input.positionCompetition/100,0,1)
  const score=form*.40+minutes*.18+training*.17+discipline*.10+(1-competition)*.15
  const proPathwayScore=Math.round(score*100)
  const releaseRisk=Math.round(clamp((.48-score)*180+(input.energy<35?12:0),0,100))
  const role:AcademyRole=score>=.74?'starter':score>=.59?'rotation':score>=.44?'bench':'development'
  return{role:current==='starter'&&role==='rotation'&&score>.69?'starter':role,proPathwayScore,releaseRisk}
}

export function proContractEligible(season:AcademySeason,playerAge:number,overall:number):boolean{
  // No artificial OVR jump: strong pathway performance can earn a contract in
  // the 60s, while OVR alone never guarantees one.
  const ageLine=playerAge>=18?64:70
  const ovrLine=playerAge>=18?57:60
  return playerAge>=17&&overall>=ovrLine&&season.proPathwayScore>=ageLine&&season.releaseRisk<42
}
