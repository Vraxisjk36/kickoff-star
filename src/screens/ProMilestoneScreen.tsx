import type { ProMilestone } from '../engine/proMilestones'
export default function ProMilestoneScreen({event,playerName,onContinue}:{event:ProMilestone;playerName?:string;onContinue:()=>void}){
  return <main className="min-h-screen bg-[#080d09] text-ks-ink px-5 py-8">
    <div className="max-w-md mx-auto">
      <div className="text-ks-gold font-display uppercase text-xs tracking-[.25em]">KICKOFF STAR · CAREER MOMENT</div>
      <div className="relative overflow-hidden rounded-3xl border border-ks-gold/30 bg-gradient-to-br from-[#34351b] via-[#172418] to-[#0d110f] mt-8 p-6">
        <div className="text-6xl opacity-30 absolute right-5 top-5">{event.kind==='ceremony'?'🏆':event.kind==='transfer'?'✍':'⚽'}</div>
        <div className="font-display text-xs tracking-[.2em] text-ks-gold mt-8">{event.eyebrow}</div>
        <h1 className="font-display text-4xl text-ks-ink leading-tight mt-5 max-w-[85%]">{event.title}</h1>
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
      <button onClick={onContinue} className="w-full mt-6 bg-ks-gold text-ks-black font-display rounded-xl py-4">CONTINUE MY CAREER →</button>
    </div>
  </main>
}
