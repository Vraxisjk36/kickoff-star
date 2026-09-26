import type { Position } from '../types/attributes'
import type { PlayerMatchStats } from './matchStats'

const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v))

export interface RatingBreakdown {
  base:number
  decisions:number
  execution:number
  attacking:number
  defending:number
  background:number
  cleanSheet:number
  exceptional:number
  discipline:number
  total:number
}

export function calculatePlayerRating(args:{
  position:Position
  stats:PlayerMatchStats
  decisionQuality:number
  executionQuality:number
  ratedMoments:number
  minutes:number
  yellowCards?:number
  redCarded?:boolean
}):RatingBreakdown {
  const {position,stats}=args
  const minutes=Math.max(1,args.minutes)
  const scale=clamp(minutes/90,.25,1)
  const base=6

  // Calibrated to the measured ~5 playable moments per match. Average quality
  // is used so FB's higher moment frequency cannot farm rating.
  // A merely available option is not automatically a positive. The player
  // earns credit by consistently choosing near the best read for the exact
  // situation; middling choices sit close to neutral.
  const decisions=args.ratedMoments ? clamp((args.decisionQuality-.62)*1.45,-.85,.65) : 0
  const execution=args.ratedMoments ? clamp((args.executionQuality-.60)*1.0,-.45,.40) : 0

  let attacking=Math.min(1.20,stats.goals*.40)+Math.min(.75,stats.assists*.30)
  let defending=0
  let background=0
  let cleanSheet=0

  if(position==='ST'){
    background+=Math.min(.28,stats.shotsOnTarget*.055)+Math.min(.18,stats.keyPasses*.035)
  } else if(position==='WG'){
    background+=Math.min(.26,stats.dribblesCompleted*.035)+Math.min(.24,stats.keyPasses*.04)+Math.min(.16,stats.progressiveRuns*.012)
  } else if(position==='WM'){
    background+=Math.min(.30,stats.keyPasses*.045)+Math.min(.22,stats.progressivePasses*.018)+Math.min(.16,stats.dribblesCompleted*.025)
  } else if(position==='CM'){
    background+=Math.min(.34,stats.keyPasses*.05)+Math.min(.28,stats.progressivePasses*.018)+Math.min(.18,(stats.interceptions+stats.recoveries)*.018)
  } else if(position==='FB'){
    background+=Math.min(.22,stats.progressiveRuns*.025)+Math.min(.20,stats.keyPasses*.04)
    defending+=Math.min(.36,(stats.tacklesWon+stats.interceptions+stats.blocks)*.055)
  } else if(position==='CB'){
    background+=Math.min(.16,stats.progressivePasses*.016)
    defending+=Math.min(.58,(stats.tacklesWon+stats.interceptions+stats.blocks+stats.headersWon)*.06)+Math.min(.18,stats.clearances*.025)
  } else if(position==='GK'){
    defending+=Math.min(.70,stats.saves*.10)+Math.min(.45,stats.highDifficultySaves*.15)+Math.min(.45,stats.penaltySaves*.45)
    if(stats.shotsFaced>=3){
      const pct=stats.saves/Math.max(1,stats.shotsFaced)
      defending+=clamp((pct-.67)*.9,-.28,.22)
    }
    background+=Math.min(.18,stats.distributionCompleted*.006)
  }

  // Defensive clean-sheet bonus. Full credit requires meaningful minutes.
  if(stats.goalsConceded===0){
    const minuteFactor=clamp(minutes/75,0,1)
    if(position==='GK') cleanSheet=.30*minuteFactor
    else if(position==='CB') cleanSheet=.25*minuteFactor
    else if(position==='FB') cleanSheet=.20*minuteFactor
  }

  if((position==='GK'||position==='CB'||position==='FB')&&stats.goalsConceded>=3){
    defending-=Math.min(.65,(stats.goalsConceded-2)*.16)
  }

  // Rare 9+ route: only exceptional combinations qualify.
  let exceptional=0
  const direct=stats.goals+stats.assists
  if(stats.goals>=3) exceptional+=.55
  else if(stats.goals>=2&&direct>=3) exceptional+=.35
  else if(direct>=3) exceptional+=.22

  if(position==='GK'&&stats.saves>=7&&stats.goalsConceded===0) exceptional+=.45
  if((position==='CB'||position==='FB')&&stats.goalsConceded===0&&(stats.tacklesWon+stats.interceptions+stats.blocks+stats.headersWon)>=8){
    exceptional+=.85
  }
  exceptional=Math.min(.90,exceptional)*scale

  const discipline=-(args.redCarded?.55:0)-Math.min(.24,(args.yellowCards??0)*.12)

  background=clamp(background,-.25,.65)*scale
  attacking*=scale
  defending*=scale
  cleanSheet*=scale

  const total=Number(clamp(base+decisions+execution+attacking+defending+background+cleanSheet+exceptional+discipline,1,10).toFixed(1))
  return {base,decisions,execution,attacking,defending,background,cleanSheet,exceptional,discipline,total}
}
