import { useEffect, useState } from 'react'
import { listSaves, legacyRouteAssessment, type SaveGame, type SaveSlotId } from '../engine/save'

interface Props {
  onBack: () => void
  onLoad: (slot: SaveSlotId, routeChoice?:'school'|'grassroots') => void
}

export default function LoadCareerScreen({ onBack, onLoad }: Props) {
  const [saves, setSaves] = useState<(SaveGame | undefined)[] | null>(null)
  const [migration,setMigration]=useState<SaveSlotId|null>(null)

  useEffect(() => { listSaves().then(setSaves) }, [])

  return (
    <main className="min-h-screen bg-ks-black text-ks-ink px-5 py-6">
      <div className="max-w-xl mx-auto">
        <button type="button" onClick={onBack} className="min-h-12 min-w-12 px-4 rounded-xl border border-ks-border bg-white/[0.03] font-semibold">← Back</button>
        <div className="mt-8 mb-6">
          <div className="text-[11px] uppercase tracking-[0.24em] text-ks-gold">Your journeys</div>
          <h1 className="text-4xl font-black mt-2">Load Career</h1>
          <p className="text-ks-muted mt-2">Choose the career you want to continue.</p>
        </div>

        {!saves ? <div className="text-ks-muted">Checking saves…</div> : (
          <div className="space-y-3">
            {[0, 1, 2].map((slot) => {
              const save = saves[slot]
              if (!save) {
                return <div key={slot} className="rounded-2xl border border-ks-border/60 p-5 opacity-50"><div className="text-xs text-ks-muted">SLOT {slot + 1}</div><div className="mt-1">Empty slot</div></div>
              }
              const p = save.player
              return (
                <button key={slot} type="button" onClick={async()=>{const s=slot as SaveSlotId;const a=await legacyRouteAssessment(s);if(a?.needsRouteChoice)setMigration(s);else onLoad(s)}} className="w-full text-left rounded-2xl border border-ks-border bg-white/[0.025] p-5 active:scale-[0.99]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-ks-gold tracking-widest">SLOT {slot + 1}</div>
                      <div className="text-xl font-black mt-1">{p.name}</div>
                      <div className="text-sm text-ks-muted mt-1">Age {p.careerClock.ageYears} · {p.position} · {p.careerClock.phase.replaceAll('-', ' ')}</div>
                    </div>
                    <span className="text-ks-gold text-xl">›</span>
                  </div>
                  <div className="text-[11px] text-ks-muted mt-4">Saved {new Date(save.savedAt).toLocaleString()}</div>
                </button>
              )
            })}
          </div>
        )}
      </div>
      {migration!==null&&<div className="fixed inset-0 bg-black/90 z-50 flex items-end"><div className="w-full rounded-t-3xl border border-ks-border bg-[#0f0f0d] p-6"><div className="text-ks-gold text-xs tracking-widest">V5 CAREER MIGRATION</div><h2 className="text-2xl font-black mt-2">Choose your pathway</h2><p className="text-sm text-ks-muted mt-2">This save comes from the old dual-route career. V5 separates the paths permanently. Choose which career this save should continue as.</p><div className="grid grid-cols-2 gap-3 mt-5"><button className="rounded-xl bg-ks-gold text-black p-4 font-black" onClick={()=>onLoad(migration,'school')}>SCHOOL</button><button className="rounded-xl border border-ks-gold text-ks-gold p-4 font-black" onClick={()=>onLoad(migration,'grassroots')}>GRASSROOTS</button></div><button className="w-full mt-3 text-ks-muted p-3" onClick={()=>setMigration(null)}>Cancel</button></div></div>}
    </main>
  )
}
