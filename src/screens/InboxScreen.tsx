import type { StoryMoment } from '../engine/presentation'

const KIND_LABEL: Record<StoryMoment['kind'], string> = {
  selection: 'Selection', squad: 'Squad', qualification: 'Competition', elimination: 'Competition', champion: 'Honours',
  invitation: 'Opportunity', promotion: 'Career', relegation: 'Career', milestone: 'Career',
}

export default function InboxScreen({ items, onRead, onClose }: { items: StoryMoment[]; onRead: (id: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-ks-black overflow-y-auto">
      <div className="sticky top-0 z-10 bg-ks-black/95 backdrop-blur border-b border-ks-border px-4 py-3 flex items-center justify-between">
        <div>
          <div className="font-display tracking-widest text-[10px] text-ks-gold uppercase">inbox</div>
          <div className="text-[10px] text-ks-muted">Your career story, in order</div>
        </div>
        <button onClick={onClose} className="rounded-md border border-ks-border px-3 py-1.5 text-[10px] text-ks-muted uppercase">close</button>
      </div>
      <div className="max-w-md mx-auto px-3 py-4 flex flex-col gap-2">
        {items.length === 0 && <div className="text-center text-[11px] text-ks-muted py-16">Your first selection announcement will appear here.</div>}
        {[...items].reverse().map((item) => (
          <button key={item.id} onClick={() => onRead(item.id)} className={`rounded-xl border px-3 py-3 text-left ${item.read ? 'border-ks-border bg-[#0f0f0d]' : 'border-ks-gold/60 bg-ks-gold/8'}`}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className={`text-[9px] uppercase tracking-widest ${item.read ? 'text-ks-muted' : 'text-ks-gold'}`}>{KIND_LABEL[item.kind]}</span>
              <span className="text-[9px] text-ks-muted">season {item.season} · wk {item.week}</span>
            </div>
            <div className="font-display text-sm text-ks-ink leading-snug">{item.title}</div>
            <p className="text-[10px] text-ks-muted leading-relaxed mt-1">{item.body}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
