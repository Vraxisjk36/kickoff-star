import type { Position } from '../types/attributes'

export interface PlayerMatchStats {
  goals: number
  assists: number
  shots: number
  shotsOnTarget: number
  keyPasses: number
  passesAttempted: number
  passesCompleted: number
  progressivePasses: number
  chancesCreated: number
  dribblesAttempted: number
  dribblesCompleted: number
  progressiveRuns: number
  touches: number
  tacklesAttempted: number
  tacklesWon: number
  interceptions: number
  recoveries: number
  clearances: number
  blocks: number
  headersWon: number
  duelsWon: number
  duelsAttempted: number
  saves: number
  shotsFaced: number
  goalsConceded: number
  penaltySaves: number
  highDifficultySaves: number
  distributionCompleted: number
  distributionAttempted: number
}

export function emptyMatchStats(): PlayerMatchStats {
  return {
    goals:0, assists:0, shots:0, shotsOnTarget:0, keyPasses:0,
    passesAttempted:0, passesCompleted:0, progressivePasses:0, chancesCreated:0,
    dribblesAttempted:0, dribblesCompleted:0, progressiveRuns:0, touches:0,
    tacklesAttempted:0, tacklesWon:0, interceptions:0, recoveries:0,
    clearances:0, blocks:0, headersWon:0, duelsWon:0, duelsAttempted:0,
    saves:0, shotsFaced:0, goalsConceded:0, penaltySaves:0, highDifficultySaves:0,
    distributionCompleted:0, distributionAttempted:0,
  }
}

export interface MatchStatContext {
  position: Position
  /** Live player attributes; absent for legacy callers and neutral audit fixtures. */
  attributes?: Record<string, number>
  minutes: number
  teamPossession: number // 0..1
  teamGoals: number
  goalsConceded: number
  rating: number
  decisionQuality: number // 0..1: quality of surfaced decisions
  executionQuality: number // 0..1: execution of surfaced actions
  seed?: number
}

function clamp(v:number,lo:number,hi:number){ return Math.max(lo,Math.min(hi,v)) }
function seeded(seed:number){ let s=seed>>>0; return ()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296} }
function jitter(base:number,rng:()=>number,spread=.18){ return Math.max(0,Math.round(base*(1-spread+rng()*spread*2))) }
function roundedSuccesses(attempts:number, chance:number, rng:()=>number){
  const expected=attempts*chance, whole=Math.floor(expected)
  return Math.min(attempts,whole+(rng()<expected-whole?1:0))
}

/**
 * Builds the off-ball/background statistical layer. The player only sees a few
 * authored key moments, but plays many ordinary actions during the other ~85
 * minutes. Those actions are inferred from position, minutes, possession,
 * match context and the quality shown in the player's actual decisions.
 *
 * Key-moment stats should be added on top of this baseline by the playable
 * engine so goals/shots/saves always remain tied to real events.
 */
export function simulateBackgroundStats(ctx:MatchStatContext): PlayerMatchStats {
  const s=emptyMatchStats(), rng=seeded(ctx.seed ?? 3202601)
  const mins=clamp(ctx.minutes,0,120), m=mins/90, poss=clamp(ctx.teamPossession,.25,.75)
  const q=clamp(.42 + ctx.decisionQuality*.34 + ctx.executionQuality*.18 + (ctx.rating-6)*.035,.28,.94)
  // Attribute effects stay modest. The authored moments decide goals/saves;
  // these modifiers give ordinary off-ball actions their own skill signal.
  const skill=(...keys:string[])=>keys.reduce((sum,key)=>sum+(ctx.attributes?.[key] ?? 8),0)/keys.length
  const delta=(...keys:string[])=>clamp((skill(...keys)-8)/12,-.55,.75)
  const passing=ctx.position==='GK'?delta('distribution'):delta('passing','vision')
  const dribbling=delta('dribbling','agility')
  const defending=delta('tackling','positioning')
  const profiles:Record<Position,{passes:number,touches:number,dribbles:number,runs:number,tackles:number,ints:number,rec:number,clear:number,blocks:number,duels:number}> = {
    GK:{passes:28,touches:38,dribbles:.1,runs:0,tackles:0,ints:0,rec:4,clear:0,blocks:0,duels:0},
    CB:{passes:46,touches:59,dribbles:.5,runs:.5,tackles:2.0,ints:1.5,rec:6,clear:4.2,blocks:1.0,duels:6},
    FB:{passes:42,touches:61,dribbles:2.2,runs:4.5,tackles:2.3,ints:1.2,rec:6,clear:2.2,blocks:.6,duels:7},
    CM:{passes:56,touches:72,dribbles:2.1,runs:3.5,tackles:1.8,ints:1.0,rec:7,clear:.5,blocks:.3,duels:7},
    WM:{passes:38,touches:62,dribbles:4.3,runs:6.5,tackles:1.4,ints:.7,rec:5,clear:.4,blocks:.2,duels:8},
    WG:{passes:31,touches:58,dribbles:6.2,runs:8.0,tackles:1.0,ints:.5,rec:4,clear:.3,blocks:.2,duels:8},
    ST:{passes:22,touches:43,dribbles:3.2,runs:9.0,tackles:.4,ints:.2,rec:2,clear:.5,blocks:.1,duels:9},
  }
  const p=profiles[ctx.position]
  const possessionFactor=.72+poss*.56
  s.touches=jitter(p.touches*m*possessionFactor,rng)
  s.passesAttempted=jitter(p.passes*m*possessionFactor,rng)
  const passBase=ctx.position==='GK'||ctx.position==='CB'?.88:ctx.position==='CM'?.84:ctx.position==='ST'?.72:.78
  const passPct=clamp(passBase+(q-.6)*.14+passing*.085,.52,.97)
  s.passesCompleted=Math.min(s.passesAttempted,Math.round(s.passesAttempted*passPct))
  s.progressivePasses=jitter(s.passesCompleted*(ctx.position==='CM'?.16:ctx.position==='WM'?.14:ctx.position==='WG'?.11:.09),rng,.28)
  s.dribblesAttempted=jitter(p.dribbles*m*(.75+poss*.5),rng,.28)
  s.dribblesCompleted=roundedSuccesses(s.dribblesAttempted,clamp(.42+q*.30+dribbling*.12,.32,.82),rng)
  s.progressiveRuns=jitter(p.runs*m*(.72+poss*.55),rng,.28)
  s.tacklesAttempted=jitter(p.tackles*m*(1.15-poss*.3),rng,.28)
  s.tacklesWon=roundedSuccesses(s.tacklesAttempted,clamp(.46+q*.27+defending*.11,.38,.82),rng)
  s.interceptions=jitter(p.ints*m*(1.2-poss*.35)*(0.85+q*.25)*(1+delta('positioning','concentration')*.24),rng,.3)
  s.recoveries=jitter(p.rec*m*(1.12-poss*.22),rng,.25)
  s.clearances=jitter(p.clear*m*(1.22-poss*.4)*(1+Math.max(0,ctx.goalsConceded-1)*.05),rng,.3)
  s.blocks=jitter(p.blocks*m*(1.18-poss*.3),rng,.35)
  s.duelsAttempted=jitter(p.duels*m,rng,.25)
  s.duelsWon=Math.min(s.duelsAttempted,Math.round(s.duelsAttempted*clamp(.43+q*.25,.44,.72)))
  s.keyPasses=jitter((ctx.position==='CM'?1.5:ctx.position==='WM'?1.35:ctx.position==='WG'?1.4:.35)*m*(.75+q*.5)*(1+passing*.27),rng,.35)
  s.chancesCreated=Math.max(s.keyPasses,jitter(s.keyPasses*(.9+rng()*.45),rng,.2))
  if(ctx.position==='GK'){
    s.distributionAttempted=s.passesAttempted
    s.distributionCompleted=s.passesCompleted
  }
  return s
}

export function mergeMatchStats(background:PlayerMatchStats, eventStats:PlayerMatchStats):PlayerMatchStats {
  const out=emptyMatchStats()
  for(const key of Object.keys(out) as (keyof PlayerMatchStats)[]) out[key]=(background[key]??0)+(eventStats[key]??0)
  // These are outcome/context totals, not additive background actions.
  out.goalsConceded=eventStats.goalsConceded
  out.shotsFaced=eventStats.shotsFaced
  return out
}

export function savePercentage(stats: PlayerMatchStats): number | null {
  if (stats.shotsFaced <= 0) return null
  return Math.round((stats.saves / stats.shotsFaced) * 100)
}
export function passPercentage(stats:PlayerMatchStats):number|null {
  return stats.passesAttempted ? Math.round(stats.passesCompleted/stats.passesAttempted*100) : null
}
export function dribblePercentage(stats:PlayerMatchStats):number|null {
  return stats.dribblesAttempted ? Math.round(stats.dribblesCompleted/stats.dribblesAttempted*100) : null
}
export function tacklePercentage(stats:PlayerMatchStats):number|null {
  return stats.tacklesAttempted ? Math.round(stats.tacklesWon/stats.tacklesAttempted*100) : null
}
export function cleanSheet(stats: PlayerMatchStats, position: Position): boolean { return position === 'GK' && stats.goalsConceded === 0 }
export function distributionPercentage(stats: PlayerMatchStats): number | null {
  return stats.distributionAttempted ? Math.round(stats.distributionCompleted/stats.distributionAttempted*100) : null
}

export function defensiveContextAdjustment(position: Position, goalsConceded: number, stats: PlayerMatchStats): number {
  if (position === 'GK') {
    const savePct = savePercentage(stats); let adjustment = 0
    if (goalsConceded >= 3) adjustment -= Math.min(1.35, (goalsConceded - 2) * 0.22)
    if (savePct !== null && stats.shotsFaced >= 4) {
      if (savePct >= 85) adjustment += 0.45
      else if (savePct >= 75) adjustment += 0.20
      else if (savePct < 55) adjustment -= 0.35
    }
    adjustment += Math.min(0.6, stats.highDifficultySaves * 0.12)
    adjustment += Math.min(0.5, stats.penaltySaves * 0.5)
    return adjustment
  }
  if (position === 'CB' || position === 'FB') {
    if (goalsConceded <= 1) return 0.12
    if (goalsConceded >= 5) return -Math.min(0.9, (goalsConceded - 3) * 0.18)
  }
  return 0
}
