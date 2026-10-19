import type { ProWorldState } from './proWorld'
import type { Player } from '../types/player'
import { getNation } from './nations'

export interface NationalSquadMember {
  id: string
  name: string
  position: string
  overall: number
  clubId: string | null
  source: 'world' | 'generated' | 'career'
}
export interface NationalSquadSelection {
  nationId: string
  season: number
  week: number
  members: NationalSquadMember[]
  captainId: string
  playerSelected: boolean
}
const SHAPE = ['GK','GK','GK','CB','CB','CB','CB','LB','RB','DM','DM',
  'CM','CM','CM','AM','AM','LW','RW','LW','RW','ST','ST','ST']
const FIRST = ['Alex','Jordan','Sam','Morgan','Taylor','Chris','Ari','Leo','Kai','Robin',
  'Noah','Dani','Eli','Max','Nico','Pat','Riley','Jamie','Theo','Mika','Andre','Luca','Sasha']
const LAST = ['Mokoena','Silva','Morgan','Diallo','Costa','Meyer','Lopez','Fernandes',
  'Bennett','Rossi','Khan','Ndlovu','Mendes','Santos','Parker','Diallo','Smith','Okafor',
  'Hernandez','Dlamini','Nielsen','Moreira','Martin']
function hash(input: string): number {
  let h = 2166136261
  for (const char of input) h = Math.imul(h ^ char.charCodeAt(0),16777619)
  return h >>> 0
}
function group(position: string | null | undefined): string {
  const p=(position ?? 'CM').toUpperCase()
  if (p.includes('GK')) return 'GK'
  if (['CB','LB','RB','LWB','RWB','DF'].some(token=>p.includes(token))) return 'DF'
  if (['DM','CM','AM','MF'].some(token=>p.includes(token))) return 'MF'
  return 'FW'
}
function eligibleWorldPlayers(world: ProWorldState | undefined, nationId: string): NationalSquadMember[] {
  if (!world) return []
  return Object.values(world.players).filter(player =>
    player.nationalityIds.includes(nationId) && !player.careerEndingInjury &&
    (!player.injuredUntil || player.injuredUntil <= world.currentDate))
    .map(player=>({id:player.id,name:player.name,position:player.position,overall:player.overall,
      clubId:player.clubId,source:'world' as const}))
    .sort((a,b)=>b.overall-a.overall || a.id.localeCompare(b.id))
}
function synthetic(nationId: string, position: string, slot: number): NationalSquadMember {
  const n=getNation(nationId)
  const seed=hash(`${nationId}:national-player:${position}:${slot}`)
  return {id:`national-${nationId}-${position}-${slot}`,
    name:`${FIRST[seed%FIRST.length]} ${LAST[(seed>>>8)%LAST.length]}`,
    position,overall:Math.max(43,Math.min(90, n.strength*9+seed%16-8)),
    clubId:null,source:'generated'}
}
/** Stable federation squad for one national window. Select 23 players by
 * position; in a small simulated country fill missing roles from its own
 * fictional domestic pool. Never select an injured, foreign or duplicate ID.
 */
export function selectSeniorNationalSquad(nationId:string, season:number, week:number,
  world?:ProWorldState, careerPlayer?:Player, calledUp=false):NationalSquadSelection {
  const pool=eligibleWorldPlayers(world,nationId)
  const members: NationalSquadMember[]=[]
  const used=new Set<string>()
  for(let slot=0;slot<SHAPE.length;slot++) {
    const position=SHAPE[slot],role=group(position)
    const candidate=pool.find(item=>!used.has(item.id) && group(item.position)===role)
    const selected=candidate ?? synthetic(nationId,position,slot)
    if(used.has(selected.id))throw Error('Duplicate national squad identity')
    members.push(selected)
    used.add(selected.id)
  }
  let playerSelected=false
  if(calledUp && careerPlayer?.nationality===nationId && careerPlayer.turnedPro &&
    !careerPlayer.injury?.weeksRemaining) {
    const playerPosition=careerPlayer.position ?? 'CM'
    const role=group(playerPosition)
    const idx=members.findLastIndex(member=>group(member.position)===role)
    if(idx>=0){
      const id=`career-${careerPlayer.id}`
      const existing=members.findIndex(member=>member.id===id)
      if(existing>=0)members.splice(existing,1,synthetic(nationId,SHAPE[existing],existing))
      members[idx]={id,name:careerPlayer.name,position:playerPosition,
        overall:Math.max(35,Math.min(99,Math.round((careerPlayer.reputation ?? 55)*.55+40))),
        clubId:world?.players[id]?.clubId ?? null,source:'career'}
      playerSelected=true
    }
  }
  if(members.length!==23 || new Set(members.map(member=>member.id)).size!==23)
    throw Error('Invalid 23-player national squad')
  const captain=members.filter(member=>group(member.position)!=='GK')
    .sort((a,b)=>b.overall-a.overall || a.id.localeCompare(b.id))[0]
  return {nationId,season,week,members,captainId:captain.id,playerSelected}
}
