import type { Player } from '../types/player'
import CareerRecord from '../components/CareerRecord'

export default function CareerEnd({ player, onMenu }: { player: Player; onMenu: () => void }) {
  return (
    <div className="relative min-h-screen w-full bg-ks-black flex flex-col justify-center px-5 py-8">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 20%, rgba(212,175,55,0.06), transparent 60%), linear-gradient(180deg,#0a0a09,#050504)' }} />
      <div className="relative z-10 max-w-md mx-auto w-full text-center">
        <div className="font-display tracking-widest text-[11px] text-ks-muted uppercase mb-3">career over</div>
        <h1 className="font-display text-ks-ink text-3xl tracking-wide mb-3">The Dream Fades</h1>
        <p className="text-ks-muted text-sm leading-relaxed mb-8 px-2">
          You reached 20 without signing a professional contract. The window has closed on this journey — but every footballer's story is different. Time to start again and write a new one.
        </p>

        <CareerRecord player={player} />

        <button onClick={onMenu} className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm shadow-[0_0_25px_rgba(212,175,55,0.3)]">
          back to menu
        </button>
      </div>
    </div>
  )
}
