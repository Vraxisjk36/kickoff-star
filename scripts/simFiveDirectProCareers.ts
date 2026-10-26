// Five DIRECT-PRO retirement simulations using the production pro career engine.
// Synthetic match decisions are seeded; transfers/cups are NOT fabricated.
import { reseed, rand } from '../src/engine/rng'
import { createProCareer, proFixture, resolveProMatch, advanceProWeek } from '../src/engine/proCareer'
import { attachProWorld, pendingProCup, resolveProCup, advanceLivingWorld, generateMarketOffers, finalizeProMove } from '../src/engine/proIntegration'
import { worldPlayerAwards } from '../src/engine/proHonours'
import { seniorTrialOffers } from '../src/engine/proTrialOffers'
import type { Player } from '../src/types/player'
import { toOvr, computeCurrentAbility } from '../src/engine/rating'

const configs = [
  {name:'Alex',pos:'ST',seed:101,points:9,ovr:67},
  {name:'Sam',pos:'GK',seed:202,points:5,ovr:61},
  {name:'Jordan',pos:'CM',seed:303,points:2,ovr:57},
  {name:'Casey',pos:'CB',seed:404,points:7,ovr:64},
  {name:'Morgan',pos:'WG',seed:505,points:0,ovr:55},
] as const
for(const cfg of configs.filter((_,i)=>process.env.SIM_INDEX===undefined || i===Number(process.env.SIM_INDEX))){
  reseed(cfg.seed)
  const offers=seniorTrialOffers(cfg.points,cfg.ovr,'direct-pro-'+cfg.seed)
  const offer=offers[0]
  const attrs:Record<string,number>={}
  for(const k of cfg.pos==='GK'?['reflexes','handling','gkPositioning','distribution','pace','strength','stamina','agility','vision','composure','positioning','concentration']:['passing','shooting','dribbling','tackling','pace','strength','stamina','agility','vision','composure','positioning','concentration']) attrs[k]=Math.max(1,Math.round(cfg.ovr/5))
  let player={
    id:'sim-'+cfg.seed,name:cfg.name,surname:'Pro',position:cfg.pos,nationality:'eng',
    attributes:{kind:cfg.pos==='GK'?'goalkeeper':'outfield',values:attrs},
    careerClock:{ageYears:18,phase:'pro'},potential:17,fitness:{stamina:100},
    squadRole:'starting-xi',reputation:20,coachTrust:60,
    seasonAppearances:0,seasonGoals:0,seasonAssists:0,
    totalWeeksElapsed:0,careerEarnings:0,money:0,
    contract:{clubName:offer.name,signedWeek:0,expiresWeek:2000,terms:{weeklyWage:1200,years:20,signingBonus:0,appearanceFee:0,goalBonus:0}},
  } as unknown as Player
  let career=attachProWorld(createProCareer(offer.name,5,offer.associationId,offer.tier),player)
  let apps=0,goals=0,assists=0,peak=toOvr(computeCurrentAbility(player)),weeks=0
  const clubs=[offer.name]
  let lastTransferSeason=0
  const seasonResults:unknown[]=[]
  const awards:string[]=[]
  const cups:Record<string,number>={}
  let cupApps=0,cupGoals=0,cupAssists=0,transferAttempts=0,completedTransfers=0
  while(!career.retired && weeks<1400){
    // Conclude negotiated offers after their required waiting period.
    if(career.talks){const moved=finalizeProMove(career,player);if(moved){career=moved.state;player=moved.player;completedTransfers++;lastTransferSeason=career.season;clubs.push(player.contract?.clubName??'Unknown')}}
    if(career.week<=3 && career.season%3===0 && career.season-lastTransferSeason>=3 && !career.talks){
      const offers=generateMarketOffers(career,player)
      const candidates=offers.filter(o=>!clubs.slice(-3).includes(career.backgroundWorld?.clubs[o.worldClubId]?.name??''))
      if(candidates.length){transferAttempts++;career={...career,talks:{offer:candidates[0],readyWeek:(player.totalWeeksElapsed??0)+2,countered:false}}}
    }
    // Cup matches use the actual tournament fixture and resolution engine.
    for(let cupIndex=0;cupIndex<3;cupIndex++){
      const cup=pendingProCup(career);if(!cup)break
      const g=cfg.pos==='GK'?0:rand()<(cfg.pos==='ST'?.30:.09)?1:0,a=rand()<(cfg.pos==='GK'?.005:.16)?1:0
      const scored=g+(rand()<.6?1:0),conceded=rand()<.5?1:0
      const result=resolveProCup(career,player,cup.id,{scored,conceded,goals:g,assists:a,rating:6.7+g,energy:85,minutes:90,yellowCards:0,redCarded:false})
      if(!result)throw Error('Cup resolution failed: '+cup.id)
      career=result.state;cupApps++;cupGoals+=g;cupAssists+=a
      cups[cup.competitionId]=(cups[cup.competitionId]??0)+1
    }
    // Do not manufacture a perfect-availability career: occasional injuries, rotation and late-career rest.
    const fixture=proFixture(career)
    const availability=rand() < (player.careerClock.ageYears>=34?.74:.88)
    if(fixture && availability){
      const home=fixture.homeTeamId===career.world.playerTeamId
      const opponent=career.world.divisions[1].teams.find(t=>t.id===(home?fixture.awayTeamId:fixture.homeTeamId))
      if(!opponent)throw Error('Missing opponent')
      const g=cfg.pos==='ST'?(rand()<.31?1:0):cfg.pos==='WG'?(rand()<.17?1:0):cfg.pos==='CM'?(rand()<.1?1:0):cfg.pos==='CB'?(rand()<.025?1:0):0
      const a=rand()<(cfg.pos==='GK'?.004:cfg.pos==='CM'?.26:cfg.pos==='WG'?.24:cfg.pos==='ST'?.15:.05)?1:0
      const scored=g+(rand()<.48?1:0),conceded=rand()<.6?1:0
      career=resolveProMatch(career,player,{opponent,home,scored,conceded,goals:g,assists:a,rating:6.5+g*.9+a*.5,energy:80,minutes:90,yellowCards:0,redCarded:false}).state
      apps++;goals+=g;assists+=a
      player={...player,seasonAppearances:(player.seasonAppearances??0)+1,seasonGoals:(player.seasonGoals??0)+g,seasonAssists:(player.seasonAssists??0)+a}
    }
    const prevSeason=career.season
    const previous=career
    const advanced=advanceProWeek(career,player)
    const lived=advanceLivingWorld(previous,advanced.state,advanced.player)
    career=lived.state;player=lived.player;weeks++
    peak=Math.max(peak,toOvr(computeCurrentAbility(player)))
    if(career.season!==prevSeason){
      const season=career.seasonRecords?.at(-1)
      if(season){seasonResults.push(season);for(const award of worldPlayerAwards(season))if(award.won)awards.push('Season '+season.season+': '+award.title)}
    }
  }
  console.log('DIRECT_PRO_CAREER_JSON:'+JSON.stringify({
    name:cfg.name,position:cfg.pos,seed:cfg.seed,startingOverall:cfg.ovr,
    actualEngineOverall:toOvr(computeCurrentAbility(player)),peakOverall:peak,
    retired:!!career.retired,retirementAge:player.careerClock.ageYears,
    seasons:career.seasonRecords?.length??0,appearances:apps,goals,assists,
    grossEarnings:player.careerEarnings,money:player.money,
    clubs,transferAttempts,completedTransfers,cupAppearances:cupApps,cupGoals,cupAssists,cupCompetitions:cups,individualAwards:awards,leagueTitles:career.seasonRecords?.filter(s=>s.leagueChampion).length??0,
    seasonResults,limitation:'Real transfer, tournament and awards functions with seeded synthetic match decisions; cup fixture participation is not the same as verified cup trophy wins'
  }))
  if(!career.retired)process.exitCode=1
}
