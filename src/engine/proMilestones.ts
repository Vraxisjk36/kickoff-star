import type { ProCareerState, ProSeasonRecord } from './proCareer'
import type { ProFixture } from './proWorld'
import { proCompetitionName } from './proTournaments'
import { getNation } from './nations'
import { registrationOpen } from './proMovement'
import { worldPlayerAwards, proLeagueRecords, type PlayerAward } from './proHonours'

export interface ProMilestone {
  id:string;kind:'competition'|'transfer'|'ceremony'|'record'
  eyebrow:string;title:string;description:string;detail:string
  winners?:PlayerAward[]
}
const awardCeremony=(season:ProSeasonRecord):ProMilestone=>({
  id:`awards:${season.season}`,kind:'ceremony',
  eyebrow:`SEASON ${season.season} · AWARDS NIGHT`,title:'THE FOOTBALL HONOURS',
  winners:worldPlayerAwards(season),
  description:`The season has ended. ${season.clubName} finished ${season.leaguePosition || 'unranked'} of ${season.clubs}. The game's world and league football prizes will now be presented.`,
  detail:`Your campaign: ${season.appearances} appearances · ${season.goals} goals · ${season.assists} assists. Trophies are based on league achievements and deterministic fictional rival contenders; none is automatically given to the player.`,
})
export function nextProMilestone(state:ProCareerState,cup?:ProFixture|null):ProMilestone|null {
  const seen=new Set(state.seenMilestones??[])
  const previous=state.seasonRecords?.find(r=>r.season===state.season-1)
  if(previous && state.week===1){
    const candidate=awardCeremony(previous)
    if(!seen.has(candidate.id))return candidate
  }
  if(state.activeCompetitionId){
    const records=proLeagueRecords(state.associationId??'eng',state.activeCompetitionId,
      state.seasonRecords??[],state)
    const achievement=records.find(item=>item.broken &&
      !seen.has(`record:${state.activeCompetitionId}:${item.kind}`))
    if(achievement){
      const name=achievement.kind==='career-goals'?'Career goals':
        achievement.kind==='season-goals'?'Single-season goals':'Single-season assists'
      return {id:`record:${state.activeCompetitionId}:${achievement.kind}`,
        kind:'record',eyebrow:'HISTORY HAS BEEN MADE',title:'A NEW LEAGUE RECORD!',
        description:`You have set a new ${name.toLowerCase()} record in ${proCompetitionName(achievement.competitionId)}.`,
        detail:`Your mark: ${achievement.current}. Previous benchmark: ${achievement.holder} (${achievement.mark}). Future opponents will remember your name.`}
    }
  }
  const country=state.associationId??'eng'
  if(state.date && registrationOpen(country,state.date)){
    const month=Number(state.date.slice(5,7))
    const window=(month<=2?'winter':'summer')
    const id=`transfer:${country}:${state.date.slice(0,4)}:${window}`
    if(!seen.has(id))return {id,kind:'transfer',eyebrow:'TRANSFER WINDOW OPEN',
      title:'THE MARKET IS LIVE.',
      description:'Clubs can negotiate contracts, loans and transfer agreements while registrations are open.',
      detail:'Visit CLUB → TRANSFER DESK to explore offers, negotiations, wage budgets and squad competition. Signing rules vary by destination and contract status.'}
  }
  if(cup && state.backgroundWorld){
    const competition=state.backgroundWorld.competitions[cup.competitionId]
    const id=`competition:${cup.competitionId}:${competition?.seasonId??state.season}`
    if(!seen.has(id)){
      const name=proCompetitionName(cup.competitionId)
      const format=competition?.tournament?.stage==='groups'?'Group stage and knockout rounds':
        competition?.tournament?.stage==='league-phase'?'League phase, then knockouts':'Knockout ties'
      return {id,kind:'competition',eyebrow:'NEW COMPETITION BEGINS',title:name,
        description:`${format}. Every result affects qualification or elimination. League and cup commitments can overlap in the calendar.`,
        detail:'Winners progress toward the trophy; qualification to future continental tournaments depends on domestic position, cup winners and federation rules.'}
    }
  }
  const pending=state.international?.pending
  if(pending){
    const id=`competition:international:${pending.competition}:${Math.floor((pending.season-1)/2)}`
    if(!seen.has(id))return {id,kind:'competition',eyebrow:'INTERNATIONAL DUTY',
      title:pending.competition==='continental'?'REGIONAL NATIONS SERIES':'INTERNATIONAL CHAMPIONSHIP',
      description:`You have been called to represent ${getNation(pending.nationId).name}. Your first match is against ${getNation(pending.opponentId).name}.`,
      detail:pending.competition==='qualifier'?'Qualifying results determine which nations reach the eight-team finals.':
        pending.competition==='continental'?'Regional competition points determine the confederation series champion.':
          'Progression follows the group-stage or knockout rules displayed in your League → International screen.'}
  }
  return null
}
