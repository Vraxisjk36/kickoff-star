import { useState } from 'react'
import { type School } from '../engine/schools'
import { localSchoolChoices } from '../engine/youthWorldDatabase'
import { useCareerStore } from '../store/careerStore'

function DiffMeter({ label, value, max = 1.4 }: { label: string; value: number; max?: number }) {
  const pct = Math.round((value / max) * 100)
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-ks-muted w-16">{label}</span>
      <div className="h-1 rounded-full bg-[#2a2a27] flex-1 overflow-hidden">
        <div className="h-full rounded-full bg-ks-gold" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function SchoolSelection({ onChoose }: { onChoose: (school: School) => void }) {
  const [selected, setSelected] = useState<School | null>(null)
  const nationality=useCareerStore(s=>s.player?.nationality??'eng')
  const schools:School[]=localSchoolChoices(nationality).map((s,i)=>({id:s.id,name:s.name,blurb:i<3?'High-exposure local programme. Competition for places is serious.':'A local programme with a genuine route into regional selection.',strengths:['Local league','Regional pathway','Persistent squad'],trialDifficulty:0.94+(i%5)*0.04,scoutExposure:0.8+(i%4)*0.12,squadPlaceOdds:1.08-(i%4)*0.04}))

  return (
    <div className="relative min-h-screen w-full bg-ks-black flex flex-col px-5 py-8">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(212,175,55,0.07), transparent 60%), linear-gradient(180deg,#0a0a09,#050504)' }} />

      <div className="relative z-10 max-w-md mx-auto w-full flex flex-col flex-1">
        <div className="font-display tracking-widest text-[11px] text-ks-gold uppercase mb-2">choose your school</div>
        <h1 className="font-display text-ks-ink text-2xl tracking-wide mb-1">Where will you make your name?</h1>
        <p className="text-ks-muted text-xs mb-6">Each school changes how hard the trials are and how many scouts watch you.</p>

        <div className="flex flex-col gap-3 flex-1">
          {schools.map((school) => (
            <button
              key={school.id}
              onClick={() => setSelected(school)}
              className={`text-left rounded-2xl border px-5 py-4 transition-all ${
                selected?.id === school.id ? 'border-ks-gold bg-ks-gold/10' : 'border-ks-border bg-[#0f0f0d]'
              }`}
            >
              <div className="font-display tracking-wide text-ks-ink text-lg mb-1">{school.name}</div>
              <p className="text-[12px] text-ks-muted mb-3 leading-snug">{school.blurb}</p>
              <div className="flex flex-col gap-1.5">
                <DiffMeter label="difficulty" value={school.trialDifficulty} max={1.25} />
                <DiffMeter label="scouts" value={school.scoutExposure} />
                <DiffMeter label="squad odds" value={school.squadPlaceOdds} max={1.3} />
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={() => selected && onChoose(selected)}
          disabled={!selected}
          className="mt-5 w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm disabled:opacity-25 shadow-[0_0_25px_rgba(212,175,55,0.2)]"
        >
          {selected ? `enrol at ${selected.name.toLowerCase()}` : 'select a school'}
        </button>
      </div>
    </div>
  )
}
