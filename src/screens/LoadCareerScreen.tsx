import { useEffect, useState } from 'react'
import { listSaves, writeSave, type SaveGame, type SaveSlotId } from '../engine/save'

interface Props {
  onBack: () => void
  onLoad: (slot: SaveSlotId) => void
}

export default function LoadCareerScreen({ onBack, onLoad }: Props) {
  const [saves, setSaves] = useState<(SaveGame | undefined)[] | null>(null)
  const migrate=async(save:SaveGame,route:'school'|'grassroots')=>{
    const player={...save.player,youthRoute:route,grassrootsPath:route==='school'?'school':'sunday' as const,...(route==='school'?{sundayLeague:undefined,sundaySquad:undefined,sundayContract:undefined}:{schoolId:null})}
    const next={...save,player,league:route==='grassroots'?(save.player.sundayLeague??save.league):save.league,legacyRouteMigration:route,cups:{...save.cups,...(route==='school'?{sundayCup:null,youthFestival:null}:{schoolCup:null,schoolDevelopment:null,nationalChampionship:null})}}
    await writeSave(next);setSaves(await listSaves());onLoad(save.slotId)
  }

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
              if(save.legacyRouteMigration==='pending') return <div key={slot} className="rounded-2xl border border-ks-gold/50 bg-ks-gold/5 p-5"><div className="text-xs text-ks-gold tracking-widest">OLD DUAL-ROUTE SAVE</div><div className="font-black text-lg mt-1">{p.name}</div><p className="text-xs text-ks-muted mt-2">V5 uses one youth route. Choose which career history continues. Your player development and career totals stay intact.</p><div className="grid grid-cols-2 gap-2 mt-4"><button onClick={()=>migrate(save,'school')} className="rounded-xl bg-ks-gold text-ks-black py-3 font-bold">Keep School</button><button onClick={()=>migrate(save,'grassroots')} className="rounded-xl border border-ks-gold text-ks-gold py-3 font-bold">Keep Grassroots</button></div></div>
              return (
                <button key={slot} type="button" onClick={() => onLoad(slot as SaveSlotId)} className="w-full text-left rounded-2xl border border-ks-border bg-white/[0.025] p-5 active:scale-[0.99]">
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
    </main>
  )
}
