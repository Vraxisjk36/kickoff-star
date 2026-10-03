import type { Player } from '../types/player'
import {
  bandSpec, describeEffects, BANDS, matchSharpnessFrom, MATCH_SHARPNESS_FLOOR,
} from '../engine/energy'

export function EnergyMeter({ stamina, showLabel = true }: { stamina: number; showLabel?: boolean }) {
  const spec = bandSpec(stamina)
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="relative h-2 rounded-full bg-[#2a2a27] flex-1 overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${spec.barClass}`}
          style={{ width: `${Math.max(0, Math.min(100, stamina))}%` }}
        />
        {/* match-ready marker: below this you walk onto the pitch already blunted */}
        <div className="absolute top-0 bottom-0 w-px bg-ks-ink/40" style={{ left: '60%' }} />
      </div>
      <span className={`font-display text-xs w-6 text-right ${spec.colorClass}`}>{Math.round(stamina)}</span>
      {showLabel && <span className={`text-[9px] uppercase tracking-wider w-12 ${spec.colorClass}`}>{spec.label}</span>}
    </div>
  )
}

const TONE_CLASS = { good: 'text-green-500', neutral: 'text-ks-ink', bad: 'text-orange-500' } as const

export default function EnergySheet({ player, onClose }: { player: Player; onClose: () => void }) {
  const stamina = player.fitness.stamina
  const spec = bandSpec(stamina)
  const effects = describeEffects(player)

  return (
    <div className="fixed inset-0 z-40 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative w-full max-w-md mx-auto bg-[#0f0f0d] border-t border-ks-border rounded-t-2xl px-4 pt-4"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 1rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-ks-border mx-auto mb-4" />

        <div className="flex items-baseline justify-between mb-1">
          <span className="font-display tracking-widest text-[10px] text-ks-muted uppercase">energy</span>
          <span className={`font-display text-2xl ${spec.colorClass}`}>{Math.round(stamina)}</span>
        </div>
        <EnergyMeter stamina={stamina} />

        <p className="text-[11px] text-ks-muted leading-relaxed mt-3 mb-4">
          Energy is your week-to-week freshness — not your fitness in a single match.
          Training burns it, rest days give it back, and whatever you have left on Saturday
          is what you start the match with.
        </p>

        <div className="font-display tracking-widest text-[10px] text-ks-muted uppercase mb-2">right now</div>
        <div className="flex flex-col gap-2 mb-4">
          {effects.map((e) => (
            <div key={e.label} className="flex items-center justify-between text-[11px]">
              <span className="text-ks-muted">{e.label}</span>
              <span className={TONE_CLASS[e.tone]}>{e.value}</span>
            </div>
          ))}
        </div>

        <div className="font-display tracking-widest text-[10px] text-ks-muted uppercase mb-2">the bands</div>
        <div className="flex flex-col gap-1.5 mb-4">
          {BANDS.map((b, i) => {
            const upper = i === 0 ? 100 : BANDS[i - 1].min - 1
            const isCurrent = b.band === spec.band
            const growthPct = Math.round((b.growthMod - 1) * 100)
            return (
              <div
                key={b.band}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 border ${
                  isCurrent ? 'border-ks-border bg-[#161613]' : 'border-transparent'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${b.barClass}`} />
                <span className={`text-[11px] capitalize flex-1 ${isCurrent ? b.colorClass : 'text-ks-muted'}`}>
                  {b.label}
                </span>
                <span className="text-[10px] text-ks-muted w-14 text-right">{b.min}–{upper}</span>
                <span className={`text-[10px] w-12 text-right ${growthPct < 0 ? 'text-orange-500' : growthPct > 0 ? 'text-green-500' : 'text-ks-muted'}`}>
                  {growthPct === 0 ? 'normal' : `${growthPct > 0 ? '+' : ''}${growthPct}%`}
                </span>
              </div>
            )
          })}
        </div>

        <p className="text-[10px] text-ks-muted leading-relaxed mb-4">
          Below {MATCH_SHARPNESS_FLOOR} energy your match sharpness bottoms out — you'll still play,
          but you'll start at {matchSharpnessFrom(0)} and tire fast. The marker on the bar is
          where you stop being properly match-ready.
        </p>

        <button
          onClick={onClose}
          className="w-full border border-ks-border text-ks-muted rounded-xl py-2.5 text-sm"
        >
          got it
        </button>
      </div>
    </div>
  )
}
