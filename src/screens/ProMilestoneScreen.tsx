import type { ProMilestone } from '../engine/proMilestones'
const momentVisual = (kind: ProMilestone['kind']) => {
  switch (kind) {
    case 'ceremony': return { icon: '🏆', label: 'THE HONOURS', glow: 'from-[#4a3911] via-[#1e2416] to-[#0a100d]' }
    case 'transfer': return { icon: '✍️', label: 'THE TRANSFER DESK', glow: 'from-[#1d3540] via-[#152721] to-[#0a100d]' }
    case 'record': return { icon: '⭐', label: 'THE RECORD BOOK', glow: 'from-[#453012] via-[#292018] to-[#0a100d]' }
    case 'retirement': return { icon: '🌅', label: 'THE FINAL WHISTLE', glow: 'from-[#47301e] via-[#272019] to-[#0a100d]' }
    default: return { icon: '⚽', label: 'THE BIG MOMENT', glow: 'from-[#34351b] via-[#172418] to-[#0a100d]' }
  }
}
export default function ProMilestoneScreen({event,playerName,onContinue}:{event:ProMilestone;playerName?:string;onContinue:()=>void}){
  const visual = momentVisual(event.kind)
  return <main className="min-h-screen bg-[#080d09] text-ks-ink px-5 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))]">
    <div className="max-w-md mx-auto animate-[fadeIn_.45s_ease-out]">
      <div className="text-ks-gold font-display uppercase text-xs tracking-[.25em]">KICKOFF STAR · CAREER MOMENT</div>
      <div className={`relative isolate overflow-hidden rounded-3xl border border-ks-gold/30 bg-gradient-to-br ${visual.glow} mt-8 p-6 shadow-[0_18px_65px_rgba(0,0,0,.5)]`}>
        <div className="text-6xl opacity-30 absolute right-5 top-5">{visual.icon}</div>
        <div className="font-display text-[10px] tracking-[.25em] text-ks-gold mt-8">{visual.label} · {event.eyebrow}</div>
        <h1 className="font-display text-3xl sm:text-4xl text-ks-ink leading-tight mt-5 max-w-[85%]">{event.title}</h1>
        <p className="mt-5 text-ks-muted text-sm leading-relaxed">{event.description}</p>
        <div className="mt-8 h-1 w-24 bg-ks-gold rounded-full"/>
      </div>
      {event.winners && <div className="mt-5 space-y-2">
        <div className="font-display tracking-[.17em] text-ks-gold text-xs">THE ANNUAL AWARD WINNERS</div>
        {event.winners.map((award,index)=><div key={award.id} className={`flex items-center gap-4 p-4 rounded-xl border ${award.won?'border-ks-gold/70 bg-gradient-to-r from-[#2b2711] to-[#101912]':'border-ks-border bg-[#101912]'}`}>
          <span className="text-2xl">{index===0?'🏆':index===1?'🌍':index===2?'⭐':index===3?'⚽':'🎯'}</span>
          <span className="flex-1 min-w-0"><span className="block text-ks-gold font-display text-xs">{award.title}</span>
            <strong className="block text-sm text-ks-ink mt-1">{award.won?playerName??'Your player':award.recipient}</strong>
            <small className="block text-ks-muted text-[10px] mt-1">{award.reason}</small></span>
          {award.won&&<span className="text-ks-gold font-display text-xs">WINNER!</span>}
        </div>)}
      </div>}
      <div className="mt-5 bg-[#101912] rounded-xl border border-ks-border p-4">
        <div className="text-ks-gold text-xs font-display">WHAT THIS MEANS FOR YOUR CAREER</div>
        <p className="text-ks-muted mt-3 text-sm leading-relaxed">{event.detail}</p>
      </div>
      <button onClick={onContinue} className="w-full mt-6 bg-gradient-to-r from-[#d4af37] to-[#f3da81] text-[#12170e] font-display rounded-xl py-4 min-h-12 shadow-[0_8px_25px_rgba(212,175,55,.2)] active:scale-[.98] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ks-gold">CONTINUE MY CAREER →</button>
    </div>
  </main>
}
