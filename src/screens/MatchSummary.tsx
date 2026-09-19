import { useEffect, useRef, useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import { TeamCrest } from '../components/ui'
import type { RatingBreakdown } from '../engine/ratingSystemV32'
import { passPercentage, dribblePercentage, tacklePercentage, savePercentage, distributionPercentage, type PlayerMatchStats } from '../engine/matchStats'

interface MatchSummaryProps {
  rating: number
  goals: number
  assists: number
  won: boolean
  drew: boolean
  injury?: { severity: string; weeksOut: number; description: string } | null
  wasSubbed?: boolean
  /** P40: sent off — takes precedence over the plain "substituted" note. */
  redCarded?: boolean
  /** Set for drawn knockout ties settled on penalties. */
  shootout?: { won: boolean } | null
  playerStats: PlayerMatchStats
  ratingBreakdown?: RatingBreakdown
  minutesPlayed: number
  yellowCards: number
  onDone: () => void
}

function deltaText(value: number): string {
  if (Math.abs(value) < .005) return '±0.00'
  return `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}`
}

export default function MatchSummary({ rating, goals, assists, won, drew, injury, wasSubbed, redCarded, shootout, playerStats, ratingBreakdown, minutesPlayed, yellowCards, onDone }: MatchSummaryProps) {
  // P60 — reference: a "round results" list showing the rest of the
  // division's results, not just your own. The data already existed
  // (batch-sim computes every fixture in the round, not just yours) — it
  // was just never surfaced anywhere. Read directly from the store rather
  // than prop-drilling through Career.tsx's existing call site.
  const league = useCareerStore((s) => s.league)
  const academyLeague = useCareerStore((s) => s.academyLeague)
  const calendar = useCareerStore((s) => s.calendar)
  const player = useCareerStore((s) => s.player)
  const division = academyLeague
    ? academyLeague.divisions[academyLeague.playerDivision]
    : league
    ? league.divisions[league.playerDivision]
    : null
  const weekNumber = calendar?.currentWeek.weekNumber
  const roundFixtures = division && weekNumber
    ? division.fixtures.filter((f) => f.week === weekNumber && f.played && f.homeGoals !== null && f.awayGoals !== null)
    : []
  const teamById = new Map((division?.teams ?? []).map((t) => [t.id, t] as const))

  const ratingColor = rating >= 7.5 ? 'text-green-500' : rating >= 6.5 ? 'text-ks-gold' : rating >= 5 ? 'text-ks-ink' : 'text-orange-400'
  const resultText = shootout ? (shootout.won ? 'Win on pens' : 'Loss on pens') : won ? 'Win' : drew ? 'Draw' : 'Loss'
  const resultColor = shootout ? (shootout.won ? 'text-green-500' : 'text-red-500') : won ? 'text-green-500' : drew ? 'text-ks-muted' : 'text-red-500'
  const ratingRows = ratingBreakdown ? [
    { label: 'Decision quality', detail: 'Your choices in key moments', value: ratingBreakdown.decisions },
    { label: 'Execution', detail: 'Timing and technique in playable actions', value: ratingBreakdown.execution },
    { label: 'Goals & assists', detail: `${goals} goal${goals === 1 ? '' : 's'} · ${assists} assist${assists === 1 ? '' : 's'}`, value: ratingBreakdown.attacking },
    { label: 'Defensive work', detail: player?.position === 'GK' ? `${playerStats.saves} save${playerStats.saves === 1 ? '' : 's'} from ${playerStats.shotsFaced} faced` : `${playerStats.tacklesWon} tackles · ${playerStats.interceptions} interceptions · ${playerStats.blocks} blocks`, value: ratingBreakdown.defending },
    { label: 'All-round play', detail: `${playerStats.passesCompleted}/${playerStats.passesAttempted} passes · ${playerStats.keyPasses} key passes`, value: ratingBreakdown.background },
    { label: 'Clean sheet', detail: 'Position-weighted defensive bonus', value: ratingBreakdown.cleanSheet },
    { label: 'Exceptional display', detail: 'Rare elite-performance bonus', value: ratingBreakdown.exceptional },
    { label: 'Discipline', detail: `${yellowCards} yellow · ${redCarded ? '1 red' : 'no red'}`, value: ratingBreakdown.discipline },
  ].filter((row) => Math.abs(row.value) >= .005) : []
  const [revealedRows, setRevealedRows] = useState(0)
  const tallyTimerRef = useRef<number | null>(null)
  const tallyComplete = !ratingBreakdown || revealedRows >= ratingRows.length
  const runningRating = ratingBreakdown
    ? tallyComplete
      ? ratingBreakdown.total
      : Math.max(1, Math.min(10, ratingBreakdown.base + ratingRows.slice(0, revealedRows).reduce((sum, row) => sum + row.value, 0)))
    : rating

  useEffect(() => {
    if (!ratingBreakdown || ratingRows.length === 0) return
    setRevealedRows(0)
    let shown = 0
    const opening = window.setTimeout(() => {
      const ticker = window.setInterval(() => {
        shown += 1
        setRevealedRows(shown)
        if (shown >= ratingRows.length) window.clearInterval(ticker)
      }, 470)
      tallyTimerRef.current = ticker
    }, 650)
    return () => {
      window.clearTimeout(opening)
      if (tallyTimerRef.current !== null) window.clearInterval(tallyTimerRef.current)
    }
    // The breakdown belongs to this one completed match and is immutable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const evidence = player?.position === 'GK'
    ? [
        ['Saves', `${playerStats.saves}`],
        ['Save %', savePercentage(playerStats) === null ? '—' : `${savePercentage(playerStats)}%`],
        ['Distribution', distributionPercentage(playerStats) === null ? '—' : `${distributionPercentage(playerStats)}%`],
        ['Minutes', `${minutesPlayed}`],
      ]
    : [
        ['Passes', passPercentage(playerStats) === null ? '—' : `${passPercentage(playerStats)}%`],
        ['Key passes', `${playerStats.keyPasses}`],
        ['Dribbles', dribblePercentage(playerStats) === null ? '—' : `${dribblePercentage(playerStats)}%`],
        ['Tackles', tacklePercentage(playerStats) === null ? '—' : `${tacklePercentage(playerStats)}%`],
        ['Interceptions', `${playerStats.interceptions}`],
        ['Minutes', `${minutesPlayed}`],
      ]

  return (
    <div className="relative min-h-screen w-full bg-ks-black flex flex-col px-5 py-8 overflow-y-auto">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 25%, rgba(212,175,55,0.08), transparent 60%), linear-gradient(180deg,#0a0a09,#050504)' }} />
      <div className="relative z-10 max-w-md mx-auto w-full">
        <div className="text-center mb-6">
          <div className="font-display tracking-widest text-[11px] text-ks-muted uppercase mb-2">match summary</div>
          <div className={`font-display text-4xl tracking-wide ${resultColor}`}>{resultText}</div>
        </div>

        <div className={`rating-reveal-hero ${tallyComplete ? 'rating-reveal-complete' : ''}`}>
          <div className="rating-orbit" style={{ '--rating-progress': `${runningRating * 10}%` } as React.CSSProperties}>
            <div className="rating-orbit-core">
              <div className="font-display tracking-widest text-[8px] text-ks-muted uppercase">your rating</div>
              <div key={revealedRows} className={`font-display text-5xl tabular-nums rating-number-pop ${ratingColor}`}>{runningRating.toFixed(1)}</div>
              <div className="text-[8px] uppercase tracking-[.2em] text-ks-gold">out of 10</div>
            </div>
          </div>
          <div className="rating-tally-status">
            <span>{tallyComplete ? 'PERFORMANCE LOCKED' : 'TALLYING PERFORMANCE'}</span>
            <div>{Array.from({ length: Math.max(1, ratingRows.length) }).map((_, i) => <i key={i} className={i < revealedRows ? 'done' : ''} />)}</div>
          </div>
        </div>

        {ratingBreakdown && (
          <div className="rounded-2xl border border-ks-gold/30 bg-[#0f0f0d] px-4 py-4 mb-4">
            <div className="flex items-end justify-between border-b border-ks-border/60 pb-3 mb-2">
              <div>
                <div className="font-display tracking-widest text-[10px] text-ks-gold uppercase">how your rating was earned</div>
                <div className="text-[10px] text-ks-muted mt-1">Every contribution is shown—nothing hidden.</div>
              </div>
              <div className="text-right"><span className="text-[9px] text-ks-muted uppercase">baseline</span><div className="font-display text-lg text-ks-ink">{ratingBreakdown.base.toFixed(1)}</div></div>
            </div>
            <div className="divide-y divide-ks-border/40 min-h-[3rem]">
              {ratingRows.slice(0, revealedRows).map((row, index) => (
                <div key={row.label} className="flex items-center gap-3 py-2.5 rating-tally-row" style={{ animationDelay: `${index * 30}ms` }}>
                  <div className={`rating-tally-dot ${row.value > 0 ? 'positive' : 'negative'}`}>{row.value > 0 ? '↑' : '↓'}</div>
                  <div className="flex-1 min-w-0"><div className="text-[11px] text-ks-ink">{row.label}</div><div className="text-[9px] text-ks-muted truncate">{row.detail}</div></div>
                  <span className={`font-display text-sm tabular-nums ${row.value > 0 ? 'text-green-500' : 'text-red-400'}`}>{deltaText(row.value)}</span>
                </div>
              ))}
              {!tallyComplete && <div className="rating-scanning"><span/><span/><span/> analysing match data</div>}
            </div>
            <div className={`flex items-center justify-between border-t border-ks-gold/30 pt-3 mt-1 transition-opacity ${tallyComplete ? 'opacity-100' : 'opacity-25'}`}><span className="font-display text-[11px] tracking-wider text-ks-gold uppercase">final rating</span><span className="font-display text-2xl text-ks-gold">{tallyComplete ? ratingBreakdown.total.toFixed(1) : '—'}</span></div>
          </div>
        )}

        <div className={`mb-4 transition-all duration-500 ${tallyComplete ? 'opacity-100 translate-y-0' : 'opacity-25 translate-y-2'}`}>
          <div className="font-display tracking-widest text-[10px] text-ks-muted uppercase mb-2">performance evidence</div>
          <div className="grid grid-cols-3 gap-2">
            {evidence.map(([label, value]) => <div key={label} className="rounded-lg border border-ks-border bg-[#0f0f0d] px-2 py-2 text-center"><div className="font-display text-base text-ks-ink">{value}</div><div className="text-[8px] text-ks-muted uppercase tracking-wide">{label}</div></div>)}
          </div>
        </div>

        {redCarded && (
          <div className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4">
            <div className="font-display tracking-widest text-[10px] text-red-400 uppercase mb-1">sent off</div>
            <p className="text-ks-ink text-sm leading-relaxed">You were shown a red card and your side had to see out the rest of the match a man down.</p>
            <p className="text-[11px] text-ks-muted mt-1">You'll miss your next match through suspension.</p>
          </div>
        )}
        {injury && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/5 px-4 py-3 mb-4">
            <div className="font-display tracking-widest text-[10px] text-red-400 uppercase mb-1">injury</div>
            <p className="text-ks-ink text-sm leading-relaxed">{injury.description}</p>
            {injury.weeksOut > 0 && <p className="text-[11px] text-ks-muted mt-1">Out for approximately {injury.weeksOut} week{injury.weeksOut === 1 ? '' : 's'}.</p>}
          </div>
        )}
        {!injury && !redCarded && wasSubbed && (
          <div className="rounded-xl border border-ks-border bg-[#0f0f0d] px-4 py-3 mb-4">
            <p className="text-ks-muted text-sm">You were substituted before full-time.</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-xl border border-ks-border bg-[#0f0f0d] px-4 py-3 text-center">
            <div className="text-[10px] text-ks-muted uppercase tracking-wider mb-1">goals</div>
            <div className="font-display text-2xl text-ks-ink">{goals}</div>
          </div>
          <div className="rounded-xl border border-ks-border bg-[#0f0f0d] px-4 py-3 text-center">
            <div className="text-[10px] text-ks-muted uppercase tracking-wider mb-1">assists</div>
            <div className="font-display text-2xl text-ks-ink">{assists}</div>
          </div>
        </div>

        {roundFixtures.length > 0 && (
          <div className="mb-5">
            <div className="font-display tracking-widest text-[10px] text-ks-muted uppercase mb-2">round results</div>
            <div className="rounded-xl border border-ks-border bg-[#0f0f0d] divide-y divide-ks-border/50">
              {roundFixtures.map((f) => {
                const home = teamById.get(f.homeTeamId)
                const away = teamById.get(f.awayTeamId)
                if (!home || !away) return null
                return (
                  <div key={f.id} className="flex items-center gap-2 px-3 py-2.5">
                    <TeamCrest primary={home.primaryColor} secondary={home.secondaryColor} short={home.short} size="sm" />
                    <span className="text-[12px] text-ks-ink flex-1 truncate">{home.name}</span>
                    <span className="font-display text-ks-gold text-sm tabular-nums px-1">{f.homeGoals} : {f.awayGoals}</span>
                    <span className="text-[12px] text-ks-ink flex-1 truncate text-right">{away.name}</span>
                    <TeamCrest primary={away.primaryColor} secondary={away.secondaryColor} short={away.short} size="sm" />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <button onClick={() => {
          if (tallyComplete) onDone()
          else {
            if (tallyTimerRef.current !== null) window.clearInterval(tallyTimerRef.current)
            setRevealedRows(ratingRows.length)
          }
        }} className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm shadow-[0_0_25px_rgba(212,175,55,0.3)]">
          {tallyComplete ? 'continue' : 'show full breakdown'}
        </button>
      </div>
    </div>
  )
}
