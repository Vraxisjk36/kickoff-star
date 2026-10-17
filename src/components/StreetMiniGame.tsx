import { useState, useEffect, useRef } from 'react'
import { sfx } from '../engine/audio'

// ============================================================================
// PHASE 32 — STREET MINI-GAMES
//
// Every street-game chance is a mini-game, and these are deliberately FASTER
// than the training ones. Training is about repetition and getting it right;
// street football is about instinct. Shorter windows, fewer reps, one shot.
//
// Same contract as the training mini-games: return a 0-1 quality score, which
// the street engine turns into a goal or a miss.
// ============================================================================

export type StreetGameKind = 'placement' | 'nutmeg' | 'firsttime'

export default function StreetMiniGame({ kind, prompt, onComplete }: {
  kind: StreetGameKind
  prompt: string
  onComplete: (quality: number) => void
}) {
  const [started, setStarted] = useState(false)
  if (!started) {
    const guide = {
      placement: { icon: '◎', title: 'Pick your corner', body: 'The goalkeeper moves across the line. Choose a target away from them to finish.', tip: 'The bigger the gap from the keeper, the better the shot.' },
      nutmeg: { icon: '◇', title: 'Wait for the commit', body: 'The defender is closing you down. Tap only when they are close enough to open their legs.', tip: 'Too early is obvious; too late and you lose the ball.' },
      firsttime: { icon: '◉', title: 'Meet it first time', body: 'The ball drops toward the strike zone. Hit it while it is travelling through the green band.', tip: 'Clean timing matters more than tapping quickly.' },
    }[kind]
    return (
      <div className="minigame-preview">
        <div className="minigame-steps"><b>1</b><span>READ</span><i/><b>2</b><span>PLAY</span><i/><b>3</b><span>RESULT</span></div>
        <div className="minigame-preview-icon">{guide.icon}</div>
        <div className="text-[9px] uppercase tracking-[.24em] text-ks-gold">street challenge · how to play</div>
        <h2>{guide.title}</h2>
        <p>{guide.body}</p>
        <div className="minigame-tip"><span>STREET TIP</span>{guide.tip}</div>
        <button onClick={() => setStarted(true)}>I'm ready →</button>
      </div>
    )
  }
  if (kind === 'placement') return <Placement prompt={prompt} onComplete={onComplete} />
  if (kind === 'nutmeg') return <Nutmeg prompt={prompt} onComplete={onComplete} />
  return <FirstTime prompt={prompt} onComplete={onComplete} />
}

// oxlint-disable-next-line react/only-export-components -- kind selector belongs with the renderer
export function streetGameKindFor(chanceIndex: number): StreetGameKind {
  return (['placement', 'nutmeg', 'firsttime'] as const)[chanceIndex % 3]
}

function Frame({ prompt, hint, children }: { prompt: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-ks-gold/40 bg-ks-gold/5 px-4 py-3">
        <p className="text-ks-ink text-sm leading-relaxed">{prompt}</p>
      </div>
      <div className="text-[10px] text-ks-muted uppercase tracking-widest text-center">{hint}</div>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PLACEMENT — a keeper slides across the goal. Shoot into the gap.
// ---------------------------------------------------------------------------
function Placement({ prompt, onComplete }: { prompt: string; onComplete: (q: number) => void }) {
  const [keeperX, setKeeperX] = useState(50)
  const dir = useRef(1)
  const posRef = useRef(50)
  const done = useRef(false)

  useEffect(() => {
    const t = window.setInterval(() => {
      posRef.current += dir.current * 4.5
      if (posRef.current > 78) { posRef.current = 78; dir.current = -1 }
      if (posRef.current < 22) { posRef.current = 22; dir.current = 1 }
      setKeeperX(posRef.current)
    }, 28)
    return () => window.clearInterval(t)
  }, [])

  const shoot = (targetX: number) => {
    if (done.current) return
    done.current = true
    const gap = Math.abs(targetX - posRef.current)
    // quality rises with distance from the keeper, capped
    const quality = Math.max(0, Math.min(1, (gap - 4) / 30))
    if (quality >= 0.55) sfx.goal(); else sfx.miss()
    window.setTimeout(() => onComplete(quality), 260)
  }

  return (
    <Frame prompt={prompt} hint="pick your corner">
      <div className="relative h-28 rounded-lg border-2 border-ks-border bg-[#0d140d] overflow-hidden">
        {/* goal frame */}
        <div className="absolute inset-x-4 top-2 bottom-8 border-2 border-white/25 rounded-sm" />
        {/* keeper */}
        <div
          className="absolute bottom-8 w-10 h-12 rounded bg-ks-gold/80 shadow-[0_0_14px_rgba(212,175,55,0.5)] transition-none"
          style={{ left: `${keeperX}%`, transform: 'translateX(-50%)' }}
        />
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[18, 38, 62, 82].map((x, i) => (
          <button
            key={i}
            onClick={() => shoot(x)}
            className="rounded-lg border border-ks-border bg-[#14140f] py-3 text-[10px] font-display uppercase tracking-widest text-ks-ink active:border-ks-gold"
          >
            {['far left', 'left', 'right', 'far right'][i]}
          </button>
        ))}
      </div>
    </Frame>
  )
}

// ---------------------------------------------------------------------------
// NUTMEG — a defender closes you down. Go at the right instant.
// ---------------------------------------------------------------------------
function Nutmeg({ prompt, onComplete }: { prompt: string; onComplete: (q: number) => void }) {
  const [dist, setDist] = useState(100)
  const distRef = useRef(100)
  const done = useRef(false)

  useEffect(() => {
    const t = window.setInterval(() => {
      distRef.current -= 2.4
      setDist(distRef.current)
      if (distRef.current <= 0 && !done.current) {
        done.current = true
        window.clearInterval(t)
        sfx.miss()
        onComplete(0)
      }
    }, 24)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const go = () => {
    if (done.current) return
    done.current = true
    // the sweet spot is when he's committed — close, but not on top of you
    const d = distRef.current
    const quality = d > 55 ? 0.15 : d > 38 ? 0.5 : d > 14 ? 1 : d > 6 ? 0.6 : 0.2
    if (quality >= 0.55) sfx.perfect(); else sfx.miss()
    window.setTimeout(() => onComplete(quality), 240)
  }

  return (
    <Frame prompt={prompt} hint="wait for him to commit">
      <div className="relative h-24 rounded-lg border-2 border-ks-border bg-[#0d140d] overflow-hidden">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-10 rounded bg-ks-gold" />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-8 h-10 rounded bg-red-500/80"
          style={{ left: `${12 + dist * 0.72}%` }}
        />
        {/* the window where a nutmeg works */}
        <div className="absolute inset-y-0 border-x border-green-500/30 bg-green-500/5" style={{ left: '22%', width: '18%' }} />
      </div>
      <button
        onClick={go}
        className="w-full rounded-xl bg-ks-gold text-ks-black py-4 font-display tracking-widest text-sm uppercase active:scale-[0.99]"
      >
        take him on
      </button>
    </Frame>
  )
}

// ---------------------------------------------------------------------------
// FIRST-TIME — the ball is dropping. One tap, exact moment.
// ---------------------------------------------------------------------------
function FirstTime({ prompt, onComplete }: { prompt: string; onComplete: (q: number) => void }) {
  const [y, setY] = useState(0)
  const yRef = useRef(0)
  const done = useRef(false)

  useEffect(() => {
    const t = window.setInterval(() => {
      yRef.current += 3.2
      setY(yRef.current)
      if (yRef.current >= 118 && !done.current) {
        done.current = true
        window.clearInterval(t)
        sfx.miss()
        onComplete(0)
      }
    }, 22)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const strike = () => {
    if (done.current) return
    done.current = true
    // perfect contact is when the ball is in the strike zone (78-92)
    const v = yRef.current
    const quality = v >= 78 && v <= 92 ? 1 : v >= 68 && v < 78 ? 0.6 : v > 92 && v <= 102 ? 0.55 : v >= 55 ? 0.3 : 0.1
    if (quality >= 0.55) sfx.perfect(); else sfx.miss()
    window.setTimeout(() => onComplete(quality), 240)
  }

  return (
    <Frame prompt={prompt} hint="strike it clean">
      <div className="relative h-32 rounded-lg border-2 border-ks-border bg-[#0d140d] overflow-hidden">
        {/* strike zone */}
        <div className="absolute inset-x-0 border-y border-green-500/40 bg-green-500/10" style={{ top: '66%', height: '12%' }} />
        <div
          className="absolute left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.7)]"
          style={{ top: `${y}%` }}
        />
      </div>
      <button
        onClick={strike}
        className="w-full rounded-xl bg-ks-gold text-ks-black py-4 font-display tracking-widest text-sm uppercase active:scale-[0.99]"
      >
        hit it
      </button>
    </Frame>
  )
}
