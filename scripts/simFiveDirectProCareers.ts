// Five DIRECT-PRO retirement simulations using the production pro career engine.
// Synthetic match decisions are seeded; transfers/cups are NOT fabricated.
import { reseed, rand } from '../src/engine/rng'
import { createProCareer, proFixture, resolveProMatch, advanceProWeek } from '../src/engine/proCareer'
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
for(const cfg of configs){
  reseed(cfg.seed)
  const offers=seniorTrialOffers(cfg.points,cfg.ovr,'direct-pro-'+cfg.seed)
  const offer=offers[0]
  const attrs:Record<string,number>={}
  for(const k of cfg.pos==='GK'?['reflexes','handling','gkPositioning','distribution','pace','strength','stamina','agility','vision','composure','positioning','concentration']:['passing','shooting','dribbling','tackling','pace','strength','stamina','agility','vision','composure','positioning','concentration']) attrs[k]=Math.max(1,Math.round(cfg.ovr/5))
  let player={
    id:'sim-'+cfg.seed,name:cfg.name,surname:'Pro',position:cfg.pos,nationality:'eng',
    attributes:{kind:cfg.pos==='GK'?'goalkeeper':'outfield',values:attrs},
    careerClock:{ageYears:18,phase:'pro'},fitness:{stamina:100},
    squadRole:'starting-xi',reputation:20,coachTrust:60,
    seasonAppearances:0,seasonGoals:0,seasonAssists:0,
    totalWeeksElapsed:0,careerEarnings:0,money:0,
    contract:{expiresWeek:2000,terms:{weeklyWage:1200}},
  } as unknown as Player
  let career=createProCareer(offer.name,5,offer.associationId,offer.tier)
  let apps=0,goals=0,assists=0,peak=toOvr(computeCurrentAbility(player)),weeks=0
  const clubs=[offer.name]
  const seasonResults:unknown[]=[]
  while(!career.retired && weeks<1400){
    const fixture=proFixture(career)
    if(fixture){
      const home=fixture.homeTeamId===career.world.playerTeamId
      const opponent=career.world.divisions[1].teams.find(t=>t.id===(home?fixture.awayTeamId:fixture.homeTeamId))
      if(!opponent)throw Error('Missing opponent')
      const g=cfg.pos==='ST'?(rand()<.31?1:0):cfg.pos==='WG'?(rand()<.17?1:0):cfg.pos==='CM'?(rand()<.1?1:0):cfg.pos==='CB'?(rand()<.025?1:0):0
      const a=rand()<(cfg.pos==='CM'?.26:cfg.pos==='WG'?.24:cfg.pos==='ST'?.15:.05)?1:0
      const scored=g+(rand()<.48?1:0),conceded=rand()<.6?1:0
      career=resolveProMatch(career,player,{opponent,home,scored,conceded,goals:g,assists:a,rating:6.5+g*.9+a*.5,energy:80,minutes:90,yellowCards:0,redCarded:false}).state
      apps++;goals+=g;assists+=a
      player={...player,seasonAppearances:(player.seasonAppearances??0)+1,seasonGoals:(player.seasonGoals??0)+g,seasonAssists:(player.seasonAssists??0)+a}
    }
    const prevSeason=career.season
    const advanced=advanceProWeek(career,player)
    career=advanced.state;player=advanced.player;weeks++
    peak=Math.max(peak,toOvr(computeCurrentAbility(player)))
    if(career.season!==prevSeason)seasonResults.push(career.seasonRecords?.at(-1))
  }
  console.log('DIRECT_PRO_CAREER_JSON:'+JSON.stringify({
    name:cfg.name,position:cfg.pos,seed:cfg.seed,startingOverall:cfg.ovr,
    actualEngineOverall:toOvr(computeCurrentAbility(player)),peakOverall:peak,
    retired:!!career.retired,retirementAge:player.careerClock.ageYears,
    seasons:career.seasonRecords?.length??0,appearances:apps,goals,assists,
    grossEarnings:player.careerEarnings,money:player.money,
    clubs,transfers:0,leagueTitles:career.seasonRecords?.filter(s=>s.leagueChampion).length??0,
    seasonResults,limitation:'Production pro-season engine and simulated match outcomes; no automated transfer, domestic cup or individual award simulation in this harness'
  }))
  if(!career.retired)process.exitCode=1
}
