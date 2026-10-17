import type { SeasonReview } from '../engine/seasonReview'
import { sfx } from '../engine/audio'
import { useEffect } from 'react'

// P33 — the end-of-season beat. A season used to pass in complete silence.
const GRADE_COLOR: Record<SeasonReview['grade'], string> = {
  A: 'text-green-500', B: 'text-green-400', C: 'text-ks-gold', D: 'text-orange-400', F: 'text-red-500',
}

export default function SeasonReviewCard({ review, onDismiss }: { review: SeasonReview; onDismiss: () => void }) {
  useEffect(() => { if (review.grade === 'A' || review.grade === 'B') sfx.achievement() }, [review.grade])

  return (
    <div className="fixed inset-0 z-50 bg-ks-black/97 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center px-5 py-8">
        <div className="max-w-md w-full">
          <div className="font-display tracking-[0.3em] text-[10px] text-ks-gold uppercase text-center mb-1">
            season {review.seasonNumber} review
          </div>
          <div className="text-[11px] text-ks-muted text-center mb-5">{review.competitionLabel}</div>

          <div className="rounded-2xl border border-ks-border bg-gradient-to-b from-[#15140f] to-[#0d0d0b] px-5 py-5 mb-3">
            <div className="flex items-center justify-center gap-5 mb-4">
              <div className="text-center">
                <div className={`font-display text-5xl leading-none ${GRADE_COLOR[review.grade]}`}>{review.grade}</div>
                <div className="text-[9px] text-ks-muted uppercase tracking-widest mt-1">your season</div>
              </div>
              {review.finishPosition && (
                <div className="text-center border-l border-ks-border pl-5">
                  <div className="font-display text-3xl text-ks-ink leading-none">
                    {review.finishPosition}
                    <span className="text-sm text-ks-muted">
                      {review.finishPosition === 1 ? 'st' : review.finishPosition === 2 ? 'nd' : review.finishPosition === 3 ? 'rd' : 'th'}
                    </span>
                  </div>
                  <div className="text-[9px] text-ks-muted uppercase tracking-widest mt-1">of {review.teamsInDivision}</div>
                </div>
              )}
            </div>

            {(review.promoted || review.relegated) && (
              <div className={`text-center font-display tracking-widest text-[11px] uppercase mb-3 ${review.promoted ? 'text-green-500' : 'text-red-500'}`}>
                {review.promoted ? '▲ promoted' : '▼ relegated'}
              </div>
            )}

            <div className="grid grid-cols-4 gap-2 mb-4">
              <Stat label="apps" value={review.appearances} />
              <Stat label="goals" value={review.goals} />
              <Stat label="assists" value={review.assists} />
              <Stat label="avg" value={review.averageRating || '—'} />
            </div>

            {review.cupResults.length > 0 && (
              <div className="border-t border-ks-border/60 pt-3 mb-3">
                <div className="text-[9px] text-ks-muted uppercase tracking-widest mb-1.5">cups</div>
                <div className="flex flex-col gap-1">
                  {review.cupResults.map((c) => (
                    <div key={c.label} className="flex items-center justify-between">
                      <span className="text-[11px] text-ks-ink">{c.label}</span>
                      <span className={`text-[9px] uppercase tracking-wider ${c.outcome === 'WINNERS' ? 'text-ks-gold' : 'text-ks-muted'}`}>
                        {c.outcome}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-sm text-ks-ink leading-relaxed text-center border-t border-ks-border/60 pt-3">
              {review.verdict}
            </p>
          </div>

          <button
            onClick={onDismiss}
            className="w-full bg-ks-gold text-ks-black font-display tracking-widest rounded-xl py-3.5 text-sm uppercase"
          >
            on to next season →
          </button>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-center">
      <div className="font-display text-ks-ink text-lg leading-none">{value}</div>
      <div className="text-[8px] text-ks-muted uppercase tracking-widest mt-0.5">{label}</div>
    </div>
  )
}
