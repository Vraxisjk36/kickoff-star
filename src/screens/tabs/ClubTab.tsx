import type { Player } from '../../types/player'
import type { Division } from '../../engine/league'
import { sortStandings } from '../../engine/league'
import type { Team } from '../../engine/teams'
import { teamOverall } from '../../engine/teams'
import { Panel,Bar,StatRow,TeamCrest } from '../../components/ui'
import type { YouthWorld } from '../../types/youthWorld'
const ordinal=(n:number)=>`${n}${n===1?'st':n===2?'nd':n===3?'rd':'th'}`
export default function ClubTab({player,playerTeam,division,isAcademy,youthWorld}:{player:Player;playerTeam:Team;division:Division;isAcademy:boolean;youthWorld?:YouthWorld|null}){
 const school=!isAcademy&&(player.youthRoute==='school'||youthWorld?.pathway.route==='school')
 const grass=!isAcademy&&!school
 const youthComp=school?youthWorld?.competitionWorld.interSchools:grass?youthWorld?.competitionWorld.sundayLeague:null
 const youthTeamId=school?youthWorld?.selectedSchoolId:youthWorld?.pathway.sundayClubId
 const youthEntry=youthComp?.teams.find(t=>t.id===youthTeamId)
 const youthStanding=youthComp?.standings.find(s=>s.teamId===youthTeamId)
 const sortedYouth=youthComp?[...youthComp.standings].sort((a,b)=>b.points-a.points||b.goalDifference-a.goalDifference):[]
 const youthPos=youthStanding?sortedYouth.findIndex(s=>s.teamId===youthTeamId)+1:0
 const sorted=sortStandings(division.standings),legacyStanding=sorted.find(s=>s.teamId===playerTeam.id)
 const pos=school||grass?youthPos:sorted.findIndex(s=>s.teamId===playerTeam.id)+1
 const standing=school||grass?youthStanding:legacyStanding
 const title=school?'SCHOOL':isAcademy?'ACADEMY CLUB':'GRASSROOTS CLUB'
 const name=youthEntry?.name??playerTeam.name
 return <div className="flex flex-col gap-2.5">
  <section className="club-hero" style={{'--club-primary':playerTeam.primaryColor,'--club-secondary':playerTeam.secondaryColor} as React.CSSProperties}><div className="club-stand"/><small>{title}</small><div className="club-identity"><TeamCrest primary={playerTeam.primaryColor} secondary={playerTeam.secondaryColor} short={playerTeam.short}/><div><h2>{name}</h2><p>{pos>0?ordinal(pos):'—'} · {school?'INTER-SCHOOLS LEAGUE':grass?'GRASSROOTS LEAGUE':'ACADEMY FOOTBALL'}</p></div><div className="club-strength"><b>{youthEntry?.strength??teamOverall(playerTeam)}</b><span>TEAM OVR</span></div></div><div className="club-record"><div><span>PLAYED</span><b>{standing?.played??0}</b></div><div><span>W-D-L</span><b>{standing?.won??0}-{standing?.drawn??0}-{standing?.lost??0}</b></div><div><span>POINTS</span><b>{standing?.points??0}</b></div><div><span>GD</span><b>{school||grass?(youthStanding?.goalDifference??0):((legacyStanding?.goalsFor??0)-(legacyStanding?.goalsAgainst??0))}</b></div></div></section>
  <div className="home-section-label"><span>{school?'SCHOOL SQUAD':'SQUAD PROFILE'}</span><i/></div>
  <Panel title="💪 team strength"><div className="flex flex-col gap-1.5">{(['attack','midfield','defense'] as const).map(line=><div key={line} className="flex items-center gap-2"><span className="text-[10px] text-ks-muted capitalize w-16">{line}</span><Bar value={playerTeam.ratings[line]} max={99}/><span className="text-[10px] text-ks-ink w-6 text-right">{playerTeam.ratings[line]}</span></div>)}</div></Panel>
  {(school&&youthWorld?.selectedSchoolId&&youthWorld.schoolSquads[youthWorld.selectedSchoolId])&&<Panel title="👥 teammates"><div className="flex flex-col divide-y divide-white/5">{youthWorld.schoolSquads[youthWorld.selectedSchoolId].firstTeam.slice().sort((a,b)=>b.overall-a.overall).map((mate,i)=><div key={mate.id} className="flex items-center gap-3 py-2.5"><div className="w-7 text-[9px] text-ks-muted font-display">{mate.position}</div><div className="flex-1 min-w-0"><div className="text-[11px] text-ks-ink truncate">{mate.name}</div><div className="text-[8px] text-ks-muted uppercase tracking-wider">{mate.age} yrs · {mate.energy}% energy</div></div><div className="text-right"><b className="font-display text-sm text-ks-gold">{mate.overall}</b><div className="text-[7px] text-ks-muted">OVR</div></div><div className={`w-1.5 h-1.5 rounded-full ${i<11?'bg-green-500':i<18?'bg-ks-gold':'bg-white/20'}`}/></div>)}</div><div className="pt-2 text-[8px] text-ks-muted">● likely XI · gold rotation · grey depth</div></Panel>}
    <Panel title="your place"><div className="flex flex-col gap-1.5"><StatRow label="squad role" value={<span className="capitalize">{player.squadRole??'TBD'}</span>}/><StatRow label="competition" value={school?'Inter-Schools League':grass?'Grassroots League':'Academy'}/><StatRow label="position" value={pos>0?ordinal(pos):'—'}/></div></Panel>
  <Panel title="🗓️ your season"><div className="flex flex-col gap-1.5"><StatRow label="goals" value={player.seasonGoals??0}/><StatRow label="assists" value={player.seasonAssists??0}/><StatRow label="average rating" value={(player.matchRatings??[]).length?((player.matchRatings??[]).reduce((a,b)=>a+b,0)/(player.matchRatings??[]).length).toFixed(1):'—'}/></div></Panel>
 </div>
}
