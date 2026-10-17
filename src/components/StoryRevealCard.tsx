import { useEffect, useState } from 'react'
import type { StoryMoment } from '../engine/presentation'
import { storyTone } from '../engine/presentation'
import { sfx } from '../engine/audio'
import AnimatedNumber from './AnimatedNumber'

const TONE = {
  gold: { border: 'border-ks-gold', text: 'text-ks-gold', glow: 'rgba(212,175,55,0.22)', symbol: '★' },
  good: { border: 'border-green-500/60', text: 'text-green-400', glow: 'rgba(34,197,94,0.18)', symbol: '✓' },
  bad: { border: 'border-red-500/60', text: 'text-red-400', glow: 'rgba(239,68,68,0.17)', symbol: '×' },
  neutral: { border: 'border-ks-border', text: 'text-ks-ink', glow: 'rgba(255,255,255,0.08)', symbol: '•' },
}

export default function StoryRevealCard({ moment, onDismiss }: { moment: StoryMoment; onDismiss: () => void }) {
  const [entered, setEntered] = useState(false)
  const tone = TONE[storyTone(moment.kind)]
  useEffect(() => {
    const timer = window.setTimeout(() => setEntered(true), 40)
    if (storyTone(moment.kind) !== 'bad') sfx.achievement()
    return () => window.clearTimeout(timer)
  }, [moment.id, moment.kind])

  return (
    <div className={`fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center px-5 story-ceremony story-ceremony-${moment.ceremony??'standard'}`}>
      {moment.ceremony==='trophy'&&<div className="ceremony-confetti" aria-hidden="true">{Array.from({length:18},(_,i)=><i key={i} style={{'--i':i} as React.CSSProperties}/>)}</div>}
      {(moment.ceremony==='selection'||moment.ceremony==='callup')&&<div className="selection-lights" aria-hidden="true"><i/><i/><i/></div>}
      <div className={`w-full max-w-sm transition-all duration-500 ${entered ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-5 scale-95'}`}>
        <div className="text-center mb-5">
          <div className="font-display tracking-[0.32em] text-[9px] text-ks-muted uppercase">{moment.eyebrow}</div>
          <div className={`mx-auto mt-4 w-20 h-20 rounded-full border ${tone.border} flex items-center justify-center font-display text-4xl ${tone.text}`} style={{ boxShadow: `0 0 45px ${tone.glow}` }}>
            {tone.symbol}
          </div>
        </div>
        <div className={`rounded-2xl border ${tone.border} bg-gradient-to-b from-[#171710] to-[#0b0b09] px-5 py-5 text-center`} style={{ boxShadow: `0 18px 60px ${tone.glow}` }}>
          <h2 className={`font-display text-2xl tracking-wide leading-tight ${tone.text}`}>{moment.title}</h2>
          <p className="text-sm text-ks-ink leading-relaxed mt-3">{moment.body}</p>
          {!!moment.metrics?.length&&<div className="selection-tally">{moment.metrics.map((m,i)=><div key={`${m.label}-${i}`} style={{animationDelay:`${280+i*180}ms`}}><span>{m.label}</span><b className={m.tone==='bad'?'text-red-400':m.tone==='good'?'text-green-400':'text-ks-gold'}><AnimatedNumber from={0} to={m.value} duration={900+i*140}/>{m.suffix??''}</b></div>)}</div>}
          {moment.detail && <p className="text-[11px] text-ks-muted leading-relaxed mt-3 pt-3 border-t border-ks-border/60">{moment.detail}</p>}
          <button onClick={onDismiss} className="mt-5 w-full rounded-xl bg-ks-gold text-ks-black py-3 font-display tracking-widest text-[11px] uppercase">
            continue →
          </button>
        </div>
      </div>
    </div>
  )
}
