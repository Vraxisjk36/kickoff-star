import type { Player } from '../types/player'
import { energyBand } from '../engine/energy'

// P32 — the invite. Turning it down has to be a real option, so the cost is
// stated plainly: this is energy you might want for Saturday, and the injury
// risk is higher than a proper match.
export default function StreetInvite({ player, variant, onAccept, onDecline }: {
  player: Player
  variant: 'street' | 'small-sided'
  onAccept: () => void
  onDecline: () => void
}) {
  const isStreet = variant === 'street'
  const cost = isStreet ? 22 : 16
  const band = energyBand(player.fitness.stamina)
  const tired = player.fitness.stamina < 40
  // P33: there was no floor at all — you could take a 22-energy game on 5
  // energy and turn up to Saturday empty. Below the cost plus a small buffer
  // the invite is still shown (you should see what you're missing) but it
  // can't be accepted.
  const tooDrained = player.fitness.stamina < cost + 8

  return (
    <div className="min-h-screen bg-ks-black px-5 py-8 max-w-md mx-auto w-full flex flex-col justify-center">
      <div className="font-display tracking-[0.3em] text-[10px] text-ks-gold uppercase mb-2">thursday</div>
      <h1 className="font-display text-ks-ink text-2xl tracking-wide mb-3">
        {isStreet ? 'a game down the park' : 'small-sided session'}
      </h1>
      <p className="text-ks-ink text-sm leading-relaxed mb-4">
        {isStreet
          ? 'A group of lads have jumpers down on the far pitch, four a side. One of them shouts over to ask if you\u2019re playing.'
          : 'The coach binned the drills. Bibs, small pitch, six a side, first to five. Losers do the cones.'}
      </p>

      <div className="rounded-xl border border-ks-border bg-[#0f0f0d] px-4 py-3 mb-4">
        <Row label="costs" value={`${cost} energy`} />
        <Row label="your energy" value={`${Math.round(player.fitness.stamina)} · ${band}`} warn={tired} />
        <Row label="injury risk" value={isStreet ? 'much higher than a match' : 'higher than training'} warn />
        <Row label="affects" value="your skills and confidence only" />
      </div>
      <p className="text-[10px] text-ks-muted leading-relaxed mb-5">
        Nothing here counts towards the league, your appearances or the coach&apos;s team selection.
        It&apos;s football for the sake of it — and the sharpening is real.
      </p>

      <div className="flex flex-col gap-2" style={{ paddingBottom: 'var(--safe-bottom)' }}>
        <button
          onClick={onAccept}
          disabled={tooDrained}
          className={`w-full font-display tracking-widest rounded-xl py-4 text-sm uppercase transition-all ${
            tooDrained
              ? 'border border-ks-border text-ks-muted/40'
              : 'bg-ks-gold text-ks-black shadow-[0_0_25px_rgba(212,175,55,0.25)]'
          }`}
        >
          {tooDrained ? 'too drained to play' : isStreet ? "i'm playing" : 'get the bibs on'}
        </button>
        {tooDrained && (
          <p className="text-[10px] text-orange-400 text-center">
            You need {cost + 8} energy to take this on. Turning up to Saturday empty is not worth it.
          </p>
        )}
        <button
          onClick={onDecline}
          className="w-full border border-ks-border text-ks-muted font-display tracking-widest rounded-xl py-3 text-[11px] uppercase"
        >
          {tired ? 'not today — save the legs' : 'give it a miss'}
        </button>
      </div>
    </div>
  )
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[10px] text-ks-muted">{label}</span>
      <span className={`text-[11px] ${warn ? 'text-orange-400' : 'text-ks-ink'}`}>{value}</span>
    </div>
  )
}
