import { useState } from 'react'
import { AGENTS } from '../engine/agents'
import { useCareerStore } from '../store/careerStore'

// P30 — you need representation before you can open academy talks. Presented
// like the onboarding archetype pick: three options, real trade-offs, one
// choice you live with.
export default function AgentSelect({ onDone }: { onDone: () => void }) {
  const [picked, setPicked] = useState<string | null>(null)
  const signAgent = useCareerStore((s) => s.signAgent)

  return (
    <div className="min-h-screen bg-ks-black px-5 py-8 max-w-md mx-auto w-full flex flex-col">
      <div className="font-display tracking-[0.3em] text-[10px] text-ks-gold uppercase mb-2">representation</div>
      <h1 className="font-display text-ks-ink text-2xl tracking-wide mb-1">who speaks for you?</h1>
      <p className="text-ks-muted text-xs mb-6 leading-relaxed">
        Clubs are interested. Before anyone sits down at a table, you need someone in your corner.
        This is a one-time decision and it follows you for the rest of your career.
      </p>

      <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto pb-4">
        {AGENTS.map((a) => {
          const isPicked = picked === a.id
          return (
            <button
              key={a.id}
              onClick={() => setPicked(a.id)}
              className={`text-left rounded-xl border px-4 py-3.5 transition-all ${
                isPicked ? 'border-ks-gold bg-ks-gold/10 shadow-[0_0_24px_rgba(212,175,55,0.15)]' : 'border-ks-border bg-[#0f0f0d]'
              }`}
            >
              <div className="flex items-baseline justify-between mb-0.5">
                <span className={`font-display tracking-wide text-base ${isPicked ? 'text-ks-gold' : 'text-ks-ink'}`}>{a.name}</span>
                <span className={`font-display text-sm ${a.commission === 0 ? 'text-green-500' : 'text-ks-muted'}`}>
                  {a.commission === 0 ? 'no fee' : `${a.commission}%`}
                </span>
              </div>
              <p className="text-[10px] text-ks-muted leading-relaxed mb-2.5">{a.tagline}</p>

              <div className="flex flex-col gap-0.5 mb-1.5">
                {a.pros.map((pro) => (
                  <div key={pro} className="text-[10px] text-green-500 leading-snug">+ {pro}</div>
                ))}
                {a.cons.map((con) => (
                  <div key={con} className="text-[10px] text-orange-400/90 leading-snug">− {con}</div>
                ))}
              </div>

              {/* the underlying numbers, so the trade-off is legible */}
              <div className="flex gap-3 mt-2 pt-2 border-t border-ks-border/60">
                <Stat label="negotiating" value={a.negotiation} />
                <Stat label="reliability" value={1 - a.blunderChance} />
                <Stat label="contacts" value={Math.min(1, a.interestMultiplier - 0.5)} />
              </div>
            </button>
          )
        })}
      </div>

      <button
        disabled={!picked}
        onClick={() => { if (picked) { signAgent(picked); onDone() } }}
        className={`w-full rounded-xl py-4 font-display tracking-widest text-sm uppercase transition-all ${
          picked ? 'bg-ks-gold text-ks-black shadow-[0_0_28px_rgba(212,175,55,0.3)]' : 'border border-ks-border text-ks-muted/40'
        }`}
        style={{ marginBottom: 'var(--safe-bottom)' }}
      >
        sign with them
      </button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(1, value))
  return (
    <div className="flex-1">
      <div className="text-[8px] text-ks-muted uppercase tracking-wider mb-0.5">{label}</div>
      <div className="h-1 rounded-full bg-[#2a2a27] overflow-hidden">
        <div className="h-full rounded-full bg-ks-gold" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  )
}
