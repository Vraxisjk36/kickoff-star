import { useRef, useState } from 'react'
import { xpCostForLevel, type AttributeKey } from '../engine/xp'
import AnimatedNumber from './AnimatedNumber'
import { haptics } from '../engine/haptics'
import { watchRewardedAd, remainingToday, rewardedAdsAvailable } from '../engine/ads'

// P49 — Joel: "I made 800 points... my shooting is 40, it requires 1200 to
// get to 41, I can still allocate and there's a bar that increases, once you
// get to the next level the number shines and the bar starts over." This is
// that screen. The bar IS the fractional part of the attribute's own value —
// attributes are already stored as decimals (8.2, 9.4...), so there's no
// separate progress-tracking needed, the number already carries it.
//
// Tapping spends a CHUNK (currently 1/8th of what's left in the pool) rather
// than the whole thing at once — gives roughly 8 taps per pool, which reads
// as a deliberate, tactile action instead of one instant dump. Leaving with
// XP still unspent auto-allocates the remainder evenly across whatever
// attributes were on offer, per Joel's "unspent needs to be auto" rule.

const ATTR_LABEL: Record<string, string> = {
  passing: 'Passing', shooting: 'Shooting', dribbling: 'Dribbling', tackling: 'Tackling',
  pace: 'Pace', strength: 'Strength', stamina: 'Stamina', agility: 'Agility',
  vision: 'Vision', composure: 'Composure', positioning: 'Positioning', concentration: 'Concentration',
  reflexes: 'Reflexes', handling: 'Handling', gkPositioning: 'Positioning', distribution: 'Distribution',
}

interface AllocationScreenProps {
  title: string
  subtitle: string
  totalXp: number
  attrs: AttributeKey[]
  values: Record<string, number>
  potential: number
  onSpend: (attr: string, amount: number) => { newLevel: number; xpUsed: number; leftover: number; levelsCrossed: number } | null
  onDone: () => void
}

export default function AllocationScreen({ title, subtitle, totalXp, attrs, values, potential, onSpend, onDone }: AllocationScreenProps) {
  // P53 — real bug, caught via a playtester's screen recording: rapid
  // tapping made the "XP left" counter jump erratically (e.g. 800 -> 752 ->
  // 612 -> 292 -> 108 -> 396). Root cause: `remaining` was plain React
  // state, read into a `chunk` value at render time. Fast repeated taps can
  // fire multiple times before React re-renders between them — every one of
  // those taps read the SAME stale `remaining`, computed its own chunk from
  // it, and spent independently, so the local counter and the store's real
  // spent total drifted apart with nothing coordinating them. A ref doesn't
  // have this problem: it's read and written synchronously, so tap N+1
  // always sees exactly what tap N actually did, even if no render has
  // happened yet. State still exists purely to trigger the re-render that
  // shows the ref's current value on screen.
  const remainingRef = useRef(totalXp)
  // P54 — real bug: chunk used to be remaining/8, recomputed fresh from
  // whatever was LEFT after every tap. That's geometric decay, not 8 equal
  // taps — tap 1 spends 1/8 of the total, tap 2 spends 1/8 of what's left
  // (not 1/8 of the total), and so on forever without ever truly finishing.
  // That's why it actually took 20+ taps in practice. Fixed per spec: split
  // the ORIGINAL pool into a fixed number of equal chunks up front, so it's
  // genuinely done in that many taps.
  const CHUNK_COUNT = 5
  const chunkSize = Math.max(1, Math.round(totalXp / CHUNK_COUNT))
  const [remaining, setRemaining] = useState(totalXp)
  const [adBoostUsed, setAdBoostUsed] = useState(false)
  const [display, setDisplay] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const a of attrs) init[a] = values[a] ?? 8
    return init
  })
  const [flash, setFlash] = useState<string | null>(null)
  const [popup, setPopup] = useState<{ attr: string; key: number } | null>(null)

  const tap = (attr: string) => {
    if (remainingRef.current <= 0) return
    const chunk = Math.min(chunkSize, remainingRef.current)
    const spend = Math.min(chunk, remainingRef.current)
    const result = onSpend(attr, spend)
    if (!result) return
    remainingRef.current = Math.max(0, remainingRef.current - (result.xpUsed || spend))
    setRemaining(remainingRef.current)
    setDisplay((d) => ({ ...d, [attr]: result.newLevel }))
    // P53 — Joel/reviewer: "add visual juice — pulse, floating +1, haptics."
    setPopup({ attr, key: Date.now() })
    window.setTimeout(() => setPopup(null), 550)
    if (result.levelsCrossed > 0) {
      haptics.hit()
    } else {
      haptics.tap()
    }
    if (result.levelsCrossed > 0) {
      setFlash(attr)
      window.setTimeout(() => setFlash(null), 700)
    }
  }

  const finish = () => {
    if (remainingRef.current > 0 && attrs.length > 0) {
      const share = remainingRef.current / attrs.length
      for (const a of attrs) onSpend(a, share)
    }
    onDone()
  }

  return (
    <div className="relative min-h-screen w-full bg-ks-black flex flex-col justify-center px-5 py-8">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 25%, rgba(212,175,55,0.08), transparent 60%), linear-gradient(180deg,#0a0a09,#050504)' }} />
      <div className="relative z-10 max-w-md mx-auto w-full">
        <div className="text-center mb-2">
          <div className="font-display tracking-widest text-[11px] text-ks-gold uppercase mb-1">{title}</div>
          <p className="text-[11px] text-ks-muted">{subtitle}</p>
        </div>
        <div className="text-center mb-6">
          <span className="font-display text-4xl text-ks-ink"><AnimatedNumber from={totalXp} to={remaining} duration={400} /></span>
          <span className="text-ks-muted text-xs uppercase tracking-widest ml-1.5">xp left</span>
          {/* P64 — a small bonus for watching a rewarded ad, shown once per
              screen visit. Added straight to the remaining pool and spent
              through the normal tap loop below, not a separate mechanic. */}
          {rewardedAdsAvailable() && !adBoostUsed && remainingToday('xp') > 0 && (
            <button
              onClick={async () => {
                const reward = await watchRewardedAd('xp')
                if (reward) {
                  const bonus = 150
                  remainingRef.current += bonus
                  setRemaining(remainingRef.current)
                  setAdBoostUsed(true)
                }
              }}
              className="block mx-auto mt-2 rounded-lg border border-ks-border bg-[#0f0f0d] px-3 py-1.5 text-[10px] font-display uppercase tracking-widest text-ks-muted"
            >
              watch ad for +150 xp
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2 mb-6">
          {attrs.map((a) => {
            const level = display[a] ?? 8
            const whole = Math.floor(level)
            const frac = level - whole
            const nextCost = xpCostForLevel(whole)
            const atCeiling = level >= potential - 1
            return (
              <button
                key={a}
                onClick={() => tap(a)}
                disabled={remaining <= 0 || atCeiling}
                className="relative text-left rounded-xl border border-ks-border bg-[#0f0f0d] px-4 py-3 disabled:opacity-40 active:scale-[0.99] transition-transform"
              >
                {popup && popup.attr === a && (
                  <span
                    key={popup.key}
                    className="absolute right-4 top-1 text-green-400 text-xs font-display pointer-events-none"
                    style={{ animation: 'floatup 0.55s ease-out forwards' }}
                  >
                    spent
                  </span>
                )}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] text-ks-ink">{ATTR_LABEL[a] ?? a}</span>
                  <span className={`font-display text-lg tabular-nums transition-transform ${flash === a ? 'text-green-400 scale-125' : 'text-ks-gold'}`} style={flash === a ? { textShadow: '0 0 14px rgba(74,222,128,0.7)' } : undefined}>
                    {whole}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[#2a2a27] overflow-hidden">
                  <div className="h-full bg-ks-gold rounded-full transition-all duration-300" style={{ width: `${atCeiling ? 100 : frac * 100}%` }} />
                </div>
                {!atCeiling && <div className="text-[10px] text-ks-muted mt-1">{nextCost} xp to level {whole + 1}</div>}
                {atCeiling && <div className="text-[10px] text-ks-muted mt-1">at your current ceiling</div>}
              </button>
            )
          })}
        </div>

        <button onClick={finish} className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm shadow-[0_0_25px_rgba(212,175,55,0.3)]">
          {remaining > 0 ? 'done — spread the rest' : 'continue'}
        </button>
      </div>
    </div>
  )
}
