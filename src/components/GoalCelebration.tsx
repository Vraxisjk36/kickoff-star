import { useEffect, useState } from 'react'
import Avatar from './Avatar'
import { haptics } from '../engine/haptics'

// P47 — Joel: "when someone scores it's almost impossible to tell they did."
// A goal was rendering as a slightly-bigger feed line and a 0.4s number pop —
// the single biggest scoring moment in football, given the same visual
// weight as a throw-in. This is the fix: a real full-screen takeover, the
// same shape every football game uses for this exact moment — flash, big
// type, a beat, then back to the match. Auto-dismisses; the match clock is
// already paused by the caller for the same duration this is on screen.

export type CelebrationKind = 'player-goal' | 'player-assist' | 'team-goal' | 'concede'

interface CelebrationProps {
  kind: CelebrationKind
  scorerName?: string
  homeShort: string
  awayShort: string
  homeScore: number
  awayScore: number
  minute: number
  avatarId?: number
  onDone: () => void
  playerRating?: number
  ratingDelta?: number
}

const DURATION_MS = 3900

const KIND_LABEL: Record<CelebrationKind, string> = {
  'player-goal': 'GOAL!',
  'player-assist': 'ASSIST!',
  'team-goal': 'GOAL',
  concede: 'CONCEDED',
}

export default function GoalCelebration({ kind, scorerName, homeShort, awayShort, homeScore, awayScore, minute, avatarId, onDone, playerRating, ratingDelta }: CelebrationProps) {
  const [phase, setPhase] = useState<'flight' | 'impact' | 'hold' | 'out'>('flight')

  useEffect(() => {
    if (kind === 'concede') haptics.fail()
    else haptics.goal()
    const t0 = window.setTimeout(() => setPhase('impact'), 430)
    const t1 = window.setTimeout(() => setPhase('hold'), 720)
    const t2 = window.setTimeout(() => setPhase('out'), DURATION_MS - 320)
    const t3 = window.setTimeout(onDone, DURATION_MS)
    return () => { window.clearTimeout(t0); window.clearTimeout(t1); window.clearTimeout(t2); window.clearTimeout(t3) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isGood = kind !== 'concede'
  const accent = isGood ? '#d4af37' : '#e0483e'

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center transition-opacity duration-200"
      style={{
        background: isGood
          ? 'radial-gradient(ellipse at center, #3a3013 0%, #090805 54%, #000 78%)'
          : 'radial-gradient(ellipse at center, #35100d 0%, #090504 54%, #000 78%)',
        opacity: phase === 'out' ? 0 : 1,
      }}
    >
      {isGood && phase==='flight' && <div className="goal-flight"><div className="goal-net"/><div className="goal-ball">⚽</div></div>}
      {isGood && phase==='impact' && <div className="goal-shockwave"/>}
      {isGood && Array.from({length:18}).map((_,i)=><span key={i} className="fixed left-1/2 top-1/2 w-1.5 h-5 bg-ks-gold z-0" style={{'--dx':`${Math.cos(i/18*Math.PI*2)*(120+i*5)}px`,'--dy':`${Math.sin(i/18*Math.PI*2)*(160+i*4)}px`,animation:`particleFly ${1.1+(i%4)*.15}s ease-out ${.12+(i%5)*.03}s forwards`,transform:`rotate(${i*20}deg)`} as React.CSSProperties}/>)}
      {isGood && <div className="fixed left-1/2 top-1/2 w-[85vw] h-[85vw] border border-ks-gold/30 rounded-full" style={{animation:'goalRay 1.2s ease-out forwards'}} />}
      {/* flash frame — a single bright pulse right on impact */}
      {phase === 'impact' && (
        <div className="fixed inset-0 bg-white" style={{ animation: 'goalflash 0.35s ease-out forwards' }} />
      )}

      <div
        className="w-full flex flex-col items-center gap-3"
        style={{
          transform: phase === 'flight' ? 'scale(0.7)' : 'scale(1)',
          opacity: phase === 'flight' ? 0 : 1,
          transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease-out',
        }}
      >
        {avatarId !== undefined && isGood && <div className="goal-player"><Avatar id={avatarId} size={82} /><div className="goal-player-rays"/></div>}

        {/* P58 — reference video: the GOAL label runs edge-to-edge, letters
            deliberately cropped at the sides on your own goal — the biggest
            moment gets the most visceral typography, not a neatly
            contained label like everything else on screen. */}
        <div
          className={`font-display font-black tracking-[0.1em] uppercase leading-none w-full text-center px-2 ${kind === 'player-goal' ? 'text-8xl' : 'text-6xl'}`}
          style={{ color: accent, textShadow: `0 0 40px ${accent}88`, whiteSpace: 'nowrap', animation: kind === 'player-goal' && phase === 'hold' ? 'goalImpact .7s cubic-bezier(.16,1,.3,1)' : undefined }}
        >
          {KIND_LABEL[kind]}
        </div>

        {scorerName && (
          <div className="text-ks-ink text-lg font-display tracking-wide">{scorerName}</div>
        )}
        <div className="text-ks-muted text-[11px] uppercase tracking-[0.2em]">{minute}' · KICKOFF STAR</div>

        {kind==='player-goal' && playerRating !== undefined && <div className="goal-rating"><span>PLAYER RATING</span><b>{playerRating.toFixed(1)}</b>{ratingDelta !== undefined && ratingDelta>0 && <i>+{ratingDelta.toFixed(1)}</i>}</div>}
        <div className="flex items-center gap-4 mt-2 border-t border-white/10 pt-4">
          <span className="font-display text-ks-ink text-base tracking-wide">{homeShort}</span>
          <span className="font-display text-3xl tracking-widest" style={{ color: accent }}>{homeScore}–{awayScore}</span>
          <span className="font-display text-ks-ink text-base tracking-wide">{awayShort}</span>
        </div>
      </div>
    </div>
  )
}
