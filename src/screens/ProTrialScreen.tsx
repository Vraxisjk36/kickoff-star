import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import { proTrialClubs, PRO_CAREER_DESTINATIONS } from '../engine/proCareer'
import { TeamCrest } from '../components/ui'
import TrainingMiniGame, { type MiniGameKind } from '../components/TrainingMiniGame'
import { computeCurrentAbility, toOvr } from '../engine/rating'

const WEEKS:readonly {title:string;text:string;drill:MiniGameKind;label:string}[]=[
  {title:'THE OPEN SESSION',text:'First impressions count. Beat the press with an accurate rondo and show composure under the senior coaches.',drill:'rondo',label:'First touch & short passing'},
  {title:'THE CLOSED-DOOR FRIENDLY',text:'Six moving targets represent moments in a friendly. Pick your finish, keep your head and convert the chances.',drill:'targets',label:'Finishing and reactions'},
  {title:'FINAL ASSESSMENT',text:'The last week is an intense match-fitness test. Your rhythm and speed decide how the scouting report reads.',drill:'sprint',label:'Match fitness and intensity'},
]
export function seniorTrialPoints(quality:number,ability:number):number{
  return Math.max(0,Math.min(3,Math.round((Math.max(0,Math.min(1,quality))*.78+(ability/99)*.22)*3)))
}

export default function ProTrialScreen({ onComplete, onExitToMenu }: { onComplete: () => void; onExitToMenu: () => void }) {
  const [destination, setDestination] = useState('eng')
  const [phase,setPhase]=useState<'intro'|'drill'|'result'>('intro')
  const [earned,setEarned]=useState(0)
  const player = useCareerStore(s => s.player)
  const completeWeek = useCareerStore(s => s.completeProTrialWeek)
  const signClub = useCareerStore(s => s.signOpeningProClub)
  if (!player?.proTrial) return null
  const trial = player.proTrial
  const scene = WEEKS[trial.week]
  return <div className="relative min-h-screen bg-ks-black px-5 py-8"><div className="max-w-md mx-auto"><div className="flex justify-between text-ks-gold font-display tracking-widest text-xs"><span>KICKOFF STAR · PRO TRIAL</span><button onClick={onExitToMenu}>☰ MENU</button></div>
    {scene ? <><div className="mt-8 text-ks-gold tracking-[.2em] text-xs">WEEK {trial.week+1} / 3 · SENIOR TRIALS</div>
      <div className="mt-3 h-2 rounded-full overflow-hidden bg-ks-border"><div className="h-full bg-ks-gold" style={{width:`${trial.week/3*100}%`}}/></div>
      <h1 className="font-display text-ks-ink text-3xl mt-6">{scene.title}</h1><p className="text-ks-muted leading-relaxed my-5">{scene.text}</p>
      {phase==='intro' && <div className="space-y-4"><div className="rounded-xl border border-ks-gold/30 bg-[#17180e] p-4">
        <div className="text-xs text-ks-gold font-display">THREE WEEKS · THREE PLAYABLE ASSESSMENTS</div>
        <p className="text-ks-muted text-xs mt-2">Your timing and skill affect your assessment. Each week unlocks the next stage; complete all three to receive offers.</p>
        <div className="text-ks-ink text-sm mt-3">{scene.label}</div>
      </div><button onClick={()=>setPhase('drill')} className="bg-ks-gold rounded-xl w-full py-4 text-ks-black font-display">ENTER THE TRAINING GROUND →</button></div>}
      {phase==='drill' && <TrainingMiniGame key={trial.week} kind={scene.drill} label={scene.label}
        ceiling={.74} onComplete={quality=>{setEarned(seniorTrialPoints(quality,toOvr(computeCurrentAbility(player))));setPhase('result')}}/>}
      {phase==='result' && <div className="rounded-2xl border border-ks-gold/40 bg-[#15180e] p-5 mt-4 text-center">
        <div className="text-ks-gold text-xs tracking-widest">SCOUTING REPORT</div>
        <div className="text-ks-ink font-display text-5xl mt-4">+{earned}</div>
        <div className="text-ks-muted mt-2 text-sm">Assessment points · {trial.points+earned} total</div>
        <button onClick={()=>{completeWeek(earned);setPhase('intro')}} className="mt-5 w-full bg-ks-gold rounded-xl py-3.5 text-ks-black font-display">
          {trial.week===2?'VIEW YOUR CLUB OFFERS →':'ADVANCE TO NEXT TRIAL WEEK →'}</button>
      </div>}
    </>
    : <><div className="mt-10 text-ks-gold tracking-[.2em] text-xs">THE OFFERS</div><h1 className="font-display text-ks-ink text-4xl mt-3">FOUR CLUBS. YOUR CALL.</h1><p className="text-ks-muted text-sm leading-relaxed my-6">Your three weeks of work earned {trial.points} assessment points. These clubs can offer a first-team contract; the stronger side may have a harder path into the XI.</p><div className="grid grid-cols-2 gap-2 mb-5 max-h-48 overflow-y-auto">{PRO_CAREER_DESTINATIONS.map(country => <button key={country.id} onClick={() => setDestination(country.id)} className={`rounded-lg border p-2 text-xs font-display ${destination === country.id ? 'border-ks-gold text-ks-gold' : 'border-ks-border text-ks-muted'}`}>{country.name}</button>)}</div><div className="flex flex-col gap-3">{proTrialClubs(trial.points, destination).map((club, index) => <button key={index} onClick={() => { signClub(club.name, club.prestige, destination); onComplete() }} className="text-left rounded-xl border border-ks-border p-4 bg-[#11100d] hover:border-ks-gold flex items-center gap-3"><TeamCrest primary={club.primaryColor} secondary={club.secondaryColor} short={club.short} size="sm"/><span className="flex-1"><b className="block text-ks-ink font-display">{club.name}</b><small className="text-ks-muted">{index === 3 ? 'Stronger squad · tougher selection' : 'First-team opportunity'} · prestige {club.prestige}</small></span><span className="text-ks-gold">→</span></button>)}</div></>}
  </div></div>
}
