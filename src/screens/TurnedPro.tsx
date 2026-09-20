import type { Player } from '../types/player'

export default function TurnedPro({ player, onMenu }: { player: Player; onMenu: () => void }) {
  return (
    <div className="relative min-h-screen w-full bg-ks-black flex flex-col justify-center px-5 py-8">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 25%, rgba(212,175,55,0.15), transparent 60%), linear-gradient(180deg,#0a0a09,#050504)' }} />
      <div className="relative z-10 max-w-md mx-auto w-full text-center">
        <div className="font-display tracking-widest text-[11px] text-ks-gold uppercase mb-3">you made it</div>
        <h1 className="font-display text-ks-gold text-4xl tracking-wide mb-4">Professional</h1>
        <p className="text-ks-ink text-base leading-relaxed mb-2 px-2">
          You've signed for <span className="text-ks-gold font-display tracking-wide">{player.turnedPro?.clubName}</span>.
        </p>
        <p className="text-ks-muted text-sm leading-relaxed mb-10 px-2">
          At age {player.careerClock.ageYears}, the dream that started on a grassroots pitch is real. Kickoff Star's youth-career story ends here: you earned the professional contract.
        </p>
        <div className="grid grid-cols-3 gap-2 mb-8">
          <div className="rounded-xl border border-ks-border p-3"><b className="text-ks-gold">{player.career?.appearances??0}</b><div className="text-[9px] text-ks-muted uppercase">apps</div></div>
          <div className="rounded-xl border border-ks-border p-3"><b className="text-ks-gold">{player.career?.goals??0}</b><div className="text-[9px] text-ks-muted uppercase">goals</div></div>
          <div className="rounded-xl border border-ks-border p-3"><b className="text-ks-gold">{player.career?.assists??0}</b><div className="text-[9px] text-ks-muted uppercase">assists</div></div>
        </div>
        <button onClick={onMenu} className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm shadow-[0_0_25px_rgba(212,175,55,0.3)]">
          back to menu
        </button>
      </div>
    </div>
  )
}
