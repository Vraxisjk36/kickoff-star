import { useEffect, useState } from 'react'
import type { Headline } from '../engine/headlines'

// P35 — the deliberate opposite of the Gazette screen: this is a toast, not a
// destination. It appears over whatever the player is doing, can be read in a
// glance or tapped away, and never blocks the game. Auto-dismisses after a
// few seconds if left alone.
const TONE_STYLE: Record<Headline['tone'], { border: string; bg: string; tag: string; label: string }> = {
  breaking: { border: 'border-ks-gold', bg: 'bg-ks-gold/10', tag: 'text-ks-gold', label: 'BREAKING' },
  buildup: { border: 'border-orange-400/60', bg: 'bg-orange-400/10', tag: 'text-orange-400', label: 'COMING UP' },
  'talking-point': { border: 'border-ks-border', bg: 'bg-[#14140f]', tag: 'text-ks-muted', label: 'TALKING POINT' },
}

export default function HeadlineToast({ queue, onDismiss }: { queue: Headline[]; onDismiss: () => void }) {
  const headline = queue[0]
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!headline) return
    setVisible(false)
    const showTimer = window.setTimeout(() => setVisible(true), 30)
    const hideTimer = window.setTimeout(() => setVisible(false), 5200)
    const clearTimer = window.setTimeout(onDismiss, 5600)
    return () => { window.clearTimeout(showTimer); window.clearTimeout(hideTimer); window.clearTimeout(clearTimer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headline?.id])

  if (!headline) return null
  const style = TONE_STYLE[headline.tone]

  return (
    <div className="fixed top-0 inset-x-0 z-40 flex justify-center px-3 pt-3 pointer-events-none" style={{ paddingTop: 'max(0.75rem, var(--safe-top))' }}>
      <button
        onClick={() => { setVisible(false); window.setTimeout(onDismiss, 200) }}
        className={`pointer-events-auto max-w-md w-full rounded-xl border ${style.border} ${style.bg} backdrop-blur-sm px-3.5 py-3 text-left shadow-lg transition-all duration-300 ${
          visible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
        }`}
      >
        <div className={`font-display tracking-[0.2em] text-[9px] uppercase mb-1 ${style.tag}`}>{style.label}</div>
        <div className="font-display text-ks-ink text-sm tracking-wide mb-0.5 leading-snug">{headline.text}</div>
        <p className="text-[11px] text-ks-muted leading-snug">{headline.subtext}</p>
      </button>
    </div>
  )
}
