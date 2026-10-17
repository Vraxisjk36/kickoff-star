import { useCareerStore } from '../store/careerStore'
import { proTrialClubs } from '../engine/proCareer'
import { TeamCrest } from '../components/ui'

const WEEKS = [
  { title: 'THE OPEN SESSION', text: 'The coaches have never seen you play. Your first impression decides whether you stay in the conversation.', choices: [
    { label: 'Play the safe pass', detail: 'Keep the ball moving and show discipline', points: 2 },
    { label: 'Take on your marker', detail: 'Show your ceiling, but risk losing possession', points: 1 },
    { label: 'Press every loose ball', detail: 'Work rate catches the coaches’ eye', points: 3 },
  ] },
  { title: 'THE CLOSED-DOOR FRIENDLY', text: 'You have one half to show you can handle senior football.', choices: [
    { label: 'Find pockets of space', detail: 'Good movement makes everyone better', points: 3 },
    { label: 'Demand the ball', detail: 'A statement, if you can back it up', points: 2 },
    { label: 'Stay in your shape', detail: 'Earn trust before taking risks', points: 1 },
  ] },
  { title: 'FINAL ASSESSMENT', text: 'The last session is about attitude as much as ability. Four clubs are watching.', choices: [
    { label: 'Lead the small-sided game', detail: 'Take responsibility for the group', points: 3 },
    { label: 'Listen, then execute', detail: 'Prove you can take instruction', points: 2 },
    { label: 'Go for the spectacular', detail: 'One moment could change everything', points: 1 },
  ] },
]

export default function ProTrialScreen({ onComplete, onExitToMenu }: { onComplete: () => void; onExitToMenu: () => void }) {
  const player = useCareerStore(s => s.player)
  const completeWeek = useCareerStore(s => s.completeProTrialWeek)
  const signClub = useCareerStore(s => s.signOpeningProClub)
  if (!player?.proTrial) return null
  const trial = player.proTrial
  const scene = WEEKS[trial.week]
  return <div className="relative min-h-screen bg-ks-black px-5 py-8"><div className="max-w-md mx-auto"><div className="flex justify-between text-ks-gold font-display tracking-widest text-xs"><span>KICKOFF STAR · PRO TRIAL</span><button onClick={onExitToMenu}>☰ MENU</button></div>
    {scene ? <><div className="mt-12 text-ks-muted tracking-[.2em] text-xs">WEEK {trial.week + 1} / 3</div><h1 className="font-display text-ks-ink text-4xl mt-3">{scene.title}</h1><p className="text-ks-muted leading-relaxed my-8">{scene.text}</p><div className="flex flex-col gap-3">{scene.choices.map(choice => <button key={choice.label} onClick={() => completeWeek(choice.points)} className="text-left rounded-xl border border-ks-border p-5 bg-[#11100d] hover:border-ks-gold"><b className="block font-display text-ks-gold">{choice.label}</b><span className="text-ks-muted text-xs">{choice.detail}</span></button>)}</div></>
    : <><div className="mt-10 text-ks-gold tracking-[.2em] text-xs">THE OFFERS</div><h1 className="font-display text-ks-ink text-4xl mt-3">FOUR CLUBS. YOUR CALL.</h1><p className="text-ks-muted text-sm leading-relaxed my-6">Your three weeks of work earned {trial.points} assessment points. These clubs can offer a first-team contract; the stronger side may have a harder path into the XI.</p><div className="flex flex-col gap-3">{proTrialClubs(trial.points).map((club, index) => <button key={index} onClick={() => { signClub(club.name, club.prestige); onComplete() }} className="text-left rounded-xl border border-ks-border p-4 bg-[#11100d] hover:border-ks-gold flex items-center gap-3"><TeamCrest primary={club.primaryColor} secondary={club.secondaryColor} short={club.short} size="sm"/><span className="flex-1"><b className="block text-ks-ink font-display">{club.name}</b><small className="text-ks-muted">{index === 3 ? 'Stronger squad · tougher selection' : 'First-team opportunity'} · prestige {club.prestige}</small></span><span className="text-ks-gold">→</span></button>)}</div></>}
  </div></div>
}
