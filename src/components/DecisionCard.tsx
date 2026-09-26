import { useState } from 'react'
import type { Decision, DecisionOption, DecisionResult } from '../types/decision'
import { resolveDecision } from '../types/decision'

interface DecisionCardProps {
  decision: Decision
  onResolved: (result: DecisionResult) => void
}

const CONTEXT_LABEL: Record<string, string> = {
  match: 'matchday',
  training: 'training',
  trial: 'trial',
  gk: 'in goal',
  event: 'moment',
}

export default function DecisionCard({ decision, onResolved }: DecisionCardProps) {
  const [phase, setPhase] = useState<'choosing' | 'revealed'>('choosing')
  const [result, setResult] = useState<DecisionResult | null>(null)

  const handleChoose = (option: DecisionOption) => {
    if (phase === 'revealed') return
    const res = resolveDecision(option)
    setResult(res)
    setPhase('revealed')
  }

  const handleContinue = () => {
    if (result) onResolved(result)
  }

  return (
    <div className="relative min-h-screen w-full bg-ks-black flex flex-col justify-center px-5 py-8">
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 60% 40% at 50% 30%, rgba(212,175,55,0.06), transparent 60%), linear-gradient(180deg,#0a0a09,#050504)',
      }} />

      <div className="relative z-10 max-w-md mx-auto w-full">
        {/* context chip */}
        <div className="flex items-center justify-between mb-4">
          <span className="font-display tracking-widest text-[11px] text-ks-gold uppercase">
            {CONTEXT_LABEL[decision.context] ?? decision.context}
          </span>
          {decision.meta && <span className="text-[11px] text-ks-muted">{decision.meta}</span>}
        </div>

        {/* situation */}
        <div className="rounded-2xl border border-ks-border bg-[#0f0f0d] px-5 py-5 mb-4">
          <p className="text-ks-ink text-base leading-relaxed">{decision.situation}</p>
        </div>

        {/* options or outcome */}
        {phase === 'choosing' ? (
          <div className="flex flex-col gap-2.5">
            {(decision.context === 'training' || decision.context === 'trial') && <p className="text-[11px] text-ks-muted">Pick the approach that suits your attributes. Each attempt has a chance to work; a failed roll does not mean your answer was wrong.</p>}
            {decision.options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleChoose(option)}
                className="text-left rounded-xl border border-ks-border bg-[#0f0f0d] px-5 py-4 hover:border-ks-gold hover:bg-ks-gold/5 transition-colors"
              >
                <div className="font-display tracking-wide text-ks-gold text-sm uppercase">{option.label}</div>
                {option.hint && <div className="text-[12px] text-ks-muted mt-0.5">{option.hint}</div>}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className={`rounded-2xl border px-5 py-5 ${
              result?.success ? 'border-green-500/50 bg-green-500/5' : 'border-orange-500/40 bg-orange-500/5'
            }`}>
              <div className={`font-display tracking-widest text-xs uppercase mb-2 ${
                result?.success ? 'text-green-500' : 'text-orange-400'
              }`}>
                {result?.success ? 'it comes off' : 'it doesn\'t come off'}
              </div>
              <p className="text-ks-ink text-base leading-relaxed">
                {result?.effect.narrative ?? (result?.success ? 'Well played.' : 'Not this time.')}
              </p>
              {(result?.effect.confidence || result?.effect.energy) && (
                <div className="flex gap-4 mt-3 text-[12px]">
                  {result?.effect.confidence != null && result.effect.confidence !== 0 && (
                    <span className={result.effect.confidence > 0 ? 'text-green-500' : 'text-orange-400'}>
                      confidence {result.effect.confidence > 0 ? '+' : ''}{result.effect.confidence}
                    </span>
                  )}
                  {result?.effect.energy != null && result.effect.energy !== 0 && (
                    <span className="text-ks-muted">energy {result.effect.energy > 0 ? '+' : ''}{result.effect.energy}</span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={handleContinue}
              className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm"
            >
              continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
