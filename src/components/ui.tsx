// Shared presentational primitives. Extracted in Phase 10 so every tab screen
// reuses one visual language instead of each re-declaring its own Panel/Bar.
import { useState } from 'react'

// P65 — small gold line-icon system, replacing emoji glyphs (which render
// inconsistently across Android OEM keyboards/fonts — Samsung vs Pixel vs
// OnePlus all draw the same emoji differently, undercutting the "designed"
// look). Icons are already gold, matching the accent color, so no tint/filter
// needed. Sized to sit inline with the existing [9-11px] label text.
export function Icon({ src, size = 12, className = '' }: { src: string; size?: number; className?: string }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={`inline-block shrink-0 object-contain align-middle ${className}`}
    />
  )
}

// P54 — collapsible section, most content behind a tap instead of always-open.
export function Section({ title, children, defaultOpen = false, action }: { title: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; action?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="ks-section rounded-lg border border-ks-border bg-[#0f0f0d] overflow-hidden">
      <div className="w-full flex items-center justify-between px-3 py-3">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 flex-1 text-left">
          <span className="font-display tracking-widest text-[10px] text-ks-muted uppercase">{title}</span>
          <span className={`text-ks-gold text-xs transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
        </button>
        {action}
      </div>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  )
}

export function Panel({ title, action, children, className = '' }: {
  title: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`ks-panel rounded-lg border border-ks-border bg-[#0f0f0d] overflow-hidden ${className}`}>
      <div className="ks-panel__heading px-3 py-2 border-b border-ks-border/60 flex items-center justify-between gap-2">
        <span className="font-display tracking-widest text-[10px] text-ks-muted uppercase">{title}</span>
        {action}
      </div>
      <div className="ks-panel__body px-3 py-2.5">{children}</div>
    </div>
  )
}

export function Bar({ value, max = 20 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)))
  const color = pct >= 60 ? 'bg-green-500' : pct >= 40 ? 'bg-ks-gold' : 'bg-orange-500'
  return (
    <div className="h-1.5 rounded-full bg-[#2a2a27] flex-1 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// P58 — reference video (Gemini-generated, built from our own real game
// content — "Joel Kazadi," "@GRASSROOTS_SCOUT" etc, just reskinned):
// segmented ticks instead of a smooth bar for CA/potential-style progress —
// reads more like a game meter, less like a loading bar.
export function TickBar({ value, max = 20, segments = 16 }: { value: number; max?: number; segments?: number }) {
  const filled = Math.round(Math.max(0, Math.min(1, value / max)) * segments)
  return (
    <div className="flex gap-[3px] flex-1">
      {Array.from({ length: segments }).map((_, i) => (
        <div key={i} className={`h-2.5 flex-1 rounded-sm ${i < filled ? 'bg-green-500' : 'bg-[#2a2a27]'}`} />
      ))}
    </div>
  )
}

export function OvrRing({ value, size = 'md' }: { value: number; size?: 'md' | 'lg' }) {
  const pct = Math.min(100, Math.round((value / 99) * 100))
  const outer = size === 'lg' ? 'w-20 h-20' : 'w-14 h-14'
  const inner = size === 'lg' ? 'w-16 h-16' : 'w-11 h-11'
  const num = size === 'lg' ? 'text-xl' : 'text-sm'
  return (
    <div
      className={`${outer} rounded-full flex items-center justify-center relative shrink-0`}
      style={{ background: `conic-gradient(#d4af37 ${pct}%, #2a2a27 0)` }}
    >
      <div className={`${inner} rounded-full bg-[#0a0a09] flex flex-col items-center justify-center`}>
        <span className={`font-display text-ks-ink ${num} leading-none`}>{value}</span>
        <span className="text-[7px] text-ks-muted tracking-wider">CA</span>
      </div>
    </div>
  )
}

// P58 — reference video: physical/mental shown as two side-by-side vertical
// bar-chart panels instead of stacked horizontal rows — a genuinely
// different, quicker-to-scan visual language for a "compare at a glance" view.
export function VerticalBarChart({ attrs, values, labels = {} }: {
  attrs: string[]
  values: Record<string, number>
  labels?: Record<string, string>
}) {
  const max = 20
  return (
    <div className="flex items-end gap-2.5 h-24 pt-2">
      {attrs.map((attr) => {
        const v = values[attr] ?? 0
        const pct = Math.max(4, Math.round((v / max) * 100))
        const color = pct >= 60 ? 'bg-green-500' : pct >= 40 ? 'bg-ks-gold' : 'bg-orange-500'
        return (
          <div key={attr} className="flex-1 flex flex-col items-center gap-1 h-full">
            <span className="text-[10px] text-ks-ink font-display mt-auto">{Math.round(v)}</span>
            <div className="w-full flex-1 flex items-end">
              <div className={`w-full rounded-t-sm ${color}`} style={{ height: `${pct}%` }} />
            </div>
            <span className="text-[8px] text-ks-muted capitalize truncate w-full text-center">{labels[attr] ?? attr}</span>
          </div>
        )
      })}
    </div>
  )
}

// P60 — reference: a radar/hexagon chart showing a player's attribute
// "shape" at a glance (well-rounded vs a one-dimensional specialist) —
// something we had no visualization for at all, only bars.
export function RadarChart({ points, size = 280 }: { points: { label: string; value: number; max?: number }[]; size?: number }) {
  const n = points.length
  const cx = size / 2, cy = size / 2, r = size * 0.34
  const angleFor = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2
  const coordFor = (i: number, frac: number) => {
    const a = angleFor(i)
    return { x: cx + Math.cos(a) * r * frac, y: cy + Math.sin(a) * r * frac }
  }
  const valuePoints = points.map((p, i) => coordFor(i, Math.max(0, Math.min(1, p.value / (p.max ?? 20)))))
  const polyPath = valuePoints.map((c) => `${c.x},${c.y}`).join(' ')
  const rings = [0.25, 0.5, 0.75, 1]

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto">
      {rings.map((frac) => (
        <polygon
          key={frac}
          points={Array.from({ length: n }).map((_, i) => { const c = coordFor(i, frac); return `${c.x},${c.y}` }).join(' ')}
          fill="none" stroke="#2a2a27" strokeWidth="1"
        />
      ))}
      {Array.from({ length: n }).map((_, i) => {
        const c = coordFor(i, 1)
        return <line key={i} x1={cx} y1={cy} x2={c.x} y2={c.y} stroke="#2a2a27" strokeWidth="1" />
      })}
      <polygon points={polyPath} fill="rgba(212,175,55,0.18)" stroke="#d4af37" strokeWidth="2" />
      {valuePoints.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r="3" fill="#d4af37" />)}
      {points.map((p, i) => {
        const c = coordFor(i, 1.24)
        return (
          <text key={i} x={c.x} y={c.y} fill="#e8e6df" fontSize={size * 0.038} textAnchor="middle" dominantBaseline="middle" fontFamily="var(--font-display)">
            {p.label} {Math.round(p.value)}
          </text>
        )
      })}
    </svg>
  )
}

export function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-ks-muted">{label}</span>
      <span className="text-ks-ink">{value}</span>
    </div>
  )
}

// P54 — Joel provided 64 real illustrated club crests. Teams are
// procedurally generated each career (random names/colours), not a fixed
// roster, so there's no natural 1:1 id to hang a crest on the way avatars
// had. Instead: hash the team's own short code into a stable index across
// the 64 crests — same team always gets the same crest for the whole
// career, different teams spread across the full set. import.meta.glob
// (not 64 manual import lines) still goes through Vite's normal asset
// pipeline — correctly bundled, hashed, and path-rewritten for itch.io,
// exactly like every individually-imported asset.
const CREST_MODULES = import.meta.glob('../assets/crests/crest-*.jpg', { eager: true, import: 'default' }) as Record<string, string>
const CRESTS: string[] = Object.keys(CREST_MODULES)
  .sort((a, b) => {
    const na = parseInt(a.match(/crest-(\d+)/)?.[1] ?? '0', 10)
    const nb = parseInt(b.match(/crest-(\d+)/)?.[1] ?? '0', 10)
    return na - nb
  })
  .map((k) => CREST_MODULES[k])

function crestForTeam(short: string): string {
  let hash = 0
  for (let i = 0; i < short.length; i++) hash = (hash * 31 + short.charCodeAt(i)) >>> 0
  return CRESTS[hash % CRESTS.length]
}

export function TeamCrest({ primary, secondary, short, size = 'md' }: {
  primary: string; secondary: string; short: string; size?: 'sm' | 'md'
}) {
  const dim = size === 'sm' ? 'w-6 h-6' : 'w-9 h-9'
  return (
    <img
      src={crestForTeam(short)}
      alt={short}
      className={`${dim} rounded-full object-cover shrink-0 border-2`}
      style={{ borderColor: primary, boxShadow: `0 0 0 1px ${secondary}` }}
    />
  )
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-ks-muted leading-relaxed">{children}</p>
}
