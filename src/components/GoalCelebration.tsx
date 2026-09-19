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
  }, [])

  const isGood = kind !== 'concede'
  const accent = isGood ? '#d4af37' : '#e0483e'

    return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden transition-opacity duration-200" style={{background:isGood?'radial-gradient(circle at 50% 45%,rgba(212,175,55,.18),rgba(0,0,0,.96) 58%)':'radial-gradient(circle at 50% 45%,rgba(224,72,62,.13),rgba(0,0,0,.96) 58%)',opacity:phase==='out'?0:1}}>
      {phase==='impact'&&<div className="fixed inset-0 bg-white" style={{animation:'goalflash .28s ease-out forwards'}}/>}
      {isGood&&<div className="absolute w-[72vw] h-[72vw] max-w-[340px] max-h-[340px] rounded-full border border-ks-gold/20" style={{animation:'goalRay 1.2s ease-out forwards'}}/>}
      <div className="relative z-10 w-full max-w-sm px-6 text-center" style={{transform:phase==='flight'?'scale(.82)':'scale(1)',opacity:phase==='flight'?0:1,transition:'transform .32s cubic-bezier(.2,1.4,.4,1),opacity .2s'}}>
        <div className="text-[9px] font-display tracking-[.38em] uppercase mb-5" style={{color:accent}}>{kind==='concede'?'OPPOSITION SCORE':'MATCH MOMENT'}</div>
        {avatarId!==undefined&&isGood&&<div className="mx-auto mb-4 w-[76px] h-[76px] rounded-full border border-ks-gold/40 bg-black/60 flex items-center justify-center shadow-[0_0_35px_rgba(212,175,55,.2)]"><Avatar id={avatarId} size={66}/></div>}
        <div className={`font-display font-black uppercase leading-[.85] ${kind==='player-goal'?'text-[72px]':'text-5xl'}`} style={{color:accent,textShadow:`0 0 32px ${accent}55`}}>{KIND_LABEL[kind]}</div>
        {scorerName&&<div className="font-display text-lg text-ks-ink mt-5 tracking-wide">{scorerName}</div>}
        <div className="text-[10px] text-ks-muted tracking-[.24em] mt-1">{minute}'</div>
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/50 px-5 py-4 backdrop-blur">
          <div className="flex items-center justify-center gap-5"><span className="font-display text-xs text-ks-ink">{homeShort}</span><b className="font-display text-3xl text-ks-gold tabular-nums">{homeScore}–{awayScore}</b><span className="font-display text-xs text-ks-ink">{awayShort}</span></div>
          {kind==='player-goal'&&playerRating!==undefined&&<div className="mt-3 pt-3 border-t border-white/10 flex justify-center items-center gap-3"><span className="text-[8px] tracking-[.2em] text-ks-muted">LIVE RATING</span><b className="font-display text-lg text-ks-ink">{playerRating.toFixed(1)}</b>{ratingDelta!==undefined&&ratingDelta>0&&<span className="text-[10px] text-ks-gold">+{ratingDelta.toFixed(1)}</span>}</div>}
        </div>
        <div className="mt-5 text-[8px] tracking-[.3em] text-ks-muted">KICKOFF STAR</div>
      </div>
    </div>
  )
}
