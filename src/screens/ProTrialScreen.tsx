import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import { seniorTrialPoints } from '../engine/proCareer'
import { seniorTrialOffers } from '../engine/proTrialOffers'
import type { SeniorTrialOffer } from '../engine/proTrialOffers'
import { prepareProGraduate } from '../engine/proRatings'
import TrainingMiniGame, { type MiniGameKind } from '../components/TrainingMiniGame'
import { computeCurrentAbility, toOvr } from '../engine/rating'

/** The school trial foundation: three assessed moments per week, immediate
 * coaching feedback and a final match-like showcase instead of one tap test. */
const TRIAL_DRILLS:readonly (readonly MiniGameKind[])[]=[
  ['rondo','sprint','targets'],['targets','rondo','sprint'],['sprint','targets','rondo'],
]
export function trialDrillsForWeek(week:number):readonly MiniGameKind[]{
  return TRIAL_DRILLS[week]??TRIAL_DRILLS[2]
}
const WEEKS:readonly {title:string;text:string;drill:MiniGameKind;label:string}[]=[
  {title:'THE OPEN SESSION',text:'First impressions count. Beat the press with an accurate rondo and show composure under the senior coaches.',drill:'rondo',label:'First touch & short passing'},
  {title:'THE CLOSED-DOOR FRIENDLY',text:'Six moving targets represent moments in a friendly. Pick your finish, keep your head and convert the chances.',drill:'targets',label:'Finishing and reactions'},
  {title:'FINAL ASSESSMENT',text:'The last week is an intense match-fitness test. Your rhythm and speed decide how the scouting report reads.',drill:'sprint',label:'Match fitness and intensity'},
]
export default function ProTrialScreen({ onComplete, onExitToMenu }: { onComplete: () => void; onExitToMenu: () => void }) {
  const [chosenOffer,setChosenOffer]=useState<SeniorTrialOffer|null>(null)
  const [phase,setPhase]=useState<'intro'|'drill'|'reaction'|'result'>('intro')
  const [earned,setEarned]=useState(0)
  const [drillIndex,setDrillIndex]=useState(0)
  const [drillScores,setDrillScores]=useState<number[]>([])
  const [lastQuality,setLastQuality]=useState(0)
  const player = useCareerStore(s => s.player)
  const completeWeek = useCareerStore(s => s.completeProTrialWeek)
  const signClub = useCareerStore(s => s.signOpeningProClub)
  if (!player?.proTrial) return null
  const trial = player.proTrial
  const miniGames:readonly MiniGameKind[] = trialDrillsForWeek(trial.week)
  const scene = WEEKS[trial.week]
  return <div className="relative min-h-screen bg-ks-black px-5 py-8"><div className="max-w-md mx-auto"><div className="flex justify-between text-ks-gold font-display tracking-widest text-xs"><span>KICKOFF STAR · PRO TRIAL</span><button onClick={onExitToMenu}>☰ MENU</button></div>
    {scene ? <><div className="mt-8 text-ks-gold tracking-[.2em] text-xs">WEEK {trial.week+1} / 3 · SENIOR TRIALS</div>
      <div className="mt-3 h-2 rounded-full overflow-hidden bg-ks-border"><div className="h-full bg-ks-gold" style={{width:`${trial.week/3*100}%`}}/></div>
      <h1 className="font-display text-ks-ink text-3xl mt-6">{scene.title}</h1><p className="text-ks-muted leading-relaxed my-5">{scene.text}</p>
      {phase==='intro' && <div className="space-y-4"><div className="rounded-xl border border-ks-gold/30 bg-[#17180e] p-4">
        <div className="text-xs text-ks-gold font-display">THREE WEEKS · NINE PLAYABLE ASSESSMENTS</div>
        <p className="text-ks-muted text-xs mt-2">Your timing and skill affect your assessment. Every week has three timed challenges and coaching reactions. Earn enough points across all nine to attract stronger clubs.</p>
        <div className="text-ks-ink text-sm mt-3">{scene.label}</div>
      </div><button onClick={()=>setPhase('drill')} className="bg-ks-gold rounded-xl w-full py-4 text-ks-black font-display">ENTER THE TRAINING GROUND →</button></div>}
      {phase==='drill' && <div>
        <div className="mb-3 text-ks-gold font-display text-xs tracking-widest">ASSESSMENT {drillIndex+1} / {miniGames.length} · {miniGames[drillIndex].toUpperCase()}</div>
        <TrainingMiniGame key={`${trial.week}:${drillIndex}`} kind={miniGames[drillIndex]}
          label={`${scene.label} · ${miniGames[drillIndex]}`}
          ceiling={Math.max(.46,.74-drillIndex*.07)} onComplete={quality=>{
            const next=[...drillScores,quality]
            setDrillScores(next)
            setLastQuality(quality)
            setEarned(seniorTrialPoints(next.reduce((sum,v)=>sum+v,0)/next.length,
              toOvr(computeCurrentAbility(player))))
            setPhase('reaction')
          }}/></div>}
      {phase==='reaction' && <div className="rounded-2xl border border-ks-gold/35 bg-[#141911] p-5 mt-4">
        <p className="text-xs tracking-widest text-ks-gold">COACH'S IMMEDIATE REACTION</p>
        <h3 className="font-display text-2xl text-ks-ink mt-3">{lastQuality>=.76?'EXCELLENT COMPOSURE.':lastQuality>=.49?'PROMISING. KEEP WORKING.':'YOU NEED TO RESPOND.'}</h3>
        <p className="text-ks-muted text-sm mt-3">Your timing and decision-making are being judged against the other trialists. {drillIndex===miniGames.length-1?'The final report is ready.':'There is another assessment to complete this week.'}</p>
        <div className="grid grid-cols-2 gap-2 mt-4 text-center text-xs"><div className="rounded-lg bg-[#252315] p-3"><b className="block text-ks-gold text-xl">{Math.round(lastQuality*100)}%</b>EXECUTION</div><div className="rounded-lg bg-[#252315] p-3"><b className="block text-ks-gold text-xl">{drillIndex+1}/{miniGames.length}</b>ASSESSMENTS</div></div>
        <button onClick={()=>{if(drillIndex+1<miniGames.length){setDrillIndex(drillIndex+1);setPhase('drill')}else setPhase('result')}}
          className="w-full rounded-xl bg-ks-gold text-ks-black font-display py-3 mt-5">
          {drillIndex+1===miniGames.length?'VIEW WEEKLY SCOUT REPORT →':'NEXT TRIAL CHALLENGE →'}
        </button>
      </div>}
      {phase==='result' && <div className="rounded-2xl border border-ks-gold/40 bg-[#15180e] p-5 mt-4 text-center">
        <div className="text-ks-gold text-xs tracking-widest">SCOUTING REPORT</div>
        <div className="text-ks-ink font-display text-5xl mt-4">+{earned}</div>
        <div className="text-ks-muted mt-2 text-sm">Assessment points · {trial.points+earned} total</div>
        <button onClick={()=>{completeWeek(earned);setPhase('intro');setDrillIndex(0);setDrillScores([]);setLastQuality(0)}} className="mt-5 w-full bg-ks-gold rounded-xl py-3.5 text-ks-black font-display">
          {trial.week===2?'VIEW YOUR CLUB OFFERS →':'ADVANCE TO NEXT TRIAL WEEK →'}</button>
      </div>}
    </>
    : chosenOffer ? <div className="mt-8 rounded-2xl border border-ks-gold/40 bg-[#171910] p-5">
      <div className="text-ks-gold font-display text-xs tracking-widest">OFFICIAL FIRST PROFESSIONAL CONTRACT</div>
      <h1 className="text-ks-ink font-display text-2xl mt-3">{chosenOffer.name}</h1>
      <p className="text-ks-muted text-xs mt-2">{chosenOffer.associationId.toUpperCase()} · {chosenOffer.tier===1?'First Division':'Second Division'} · {chosenOffer.overall} club OVR</p>
      {(()=>{
        const wage=350+chosenOffer.prestige*175+trial.points*45
        return <div className="grid grid-cols-2 gap-2 mt-5">
          {([['Contract length','2 YEARS'],['Weekly salary','£'+wage.toLocaleString()],['Signing bonus','£'+(wage*2).toLocaleString()],['Appearance fee','£'+Math.round(wage*.08).toLocaleString()],['Goal bonus','£'+Math.round(wage*.12).toLocaleString()],['Squad role',trial.points>=6?'STARTING XI':'ROTATION']] as const).map(([name,value])=><div key={name} className="rounded-lg bg-black/30 border border-ks-border/60 p-3"><div className="text-[10px] text-ks-muted">{name}</div><div className="text-ks-gold font-display text-sm mt-1">{value}</div></div>)}
        </div>
      })()}
      <p className="text-xs text-ks-muted mt-4">Review your salary and bonuses before committing. Signing starts your professional career and credits your signing bonus.</p>
      <button onClick={()=>{signClub(chosenOffer.name,chosenOffer.prestige,chosenOffer.associationId,chosenOffer.tier);onComplete()}} className="w-full bg-ks-gold text-ks-black rounded-xl font-display py-3.5 mt-5">ACCEPT & SIGN CONTRACT →</button>
      <button onClick={()=>setChosenOffer(null)} className="w-full border border-ks-border rounded-xl text-ks-ink py-3 mt-2 text-xs">← COMPARE OTHER OFFERS</button>
    </div> : <><div className="mt-10 text-ks-gold tracking-[.2em] text-xs">THE OFFERS · GLOBAL SCOUTING</div>
      <h1 className="font-display text-ks-ink text-4xl mt-3">FOUR CLUBS. YOUR CALL.</h1>
      <p className="text-ks-muted text-sm leading-relaxed my-5">Your nine assessments earned <strong className="text-ks-gold">{trial.points}/9</strong> scouting points. Four clubs across the entire world have invited you to join—NOT four clubs per country. Offers consider your ability and trial performance.</p>
      <div className="flex flex-col gap-3">
        {seniorTrialOffers(trial.points,toOvr(computeCurrentAbility(prepareProGraduate(player)))).map((offer,index)=><button key={offer.id}
          onClick={()=>setChosenOffer(offer)}
          className="text-left rounded-xl border border-ks-gold/20 p-4 bg-gradient-to-r from-[#191b13] to-[#11100d] hover:border-ks-gold flex items-center gap-3">
          <div className="text-ks-gold font-display text-xl w-6">{index+1}</div>
          <span className="flex-1 min-w-0">
            <strong className="block text-ks-ink font-display">{offer.name}</strong>
            <small className="block text-ks-muted mt-1">{offer.associationId.toUpperCase()} · {offer.tier===1?'First Division':'Second Division'} · {offer.overall} OVR</small>
            <small className="block text-ks-gold mt-1">{offer.reason}</small>
          </span><span className="text-ks-gold">→</span>
        </button>)}
      </div></>}
  </div></div>
}
