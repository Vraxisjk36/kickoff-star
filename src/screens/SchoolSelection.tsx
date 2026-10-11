import { useState } from 'react'
import { schoolsForRegion, type School } from '../engine/schools'
import { useCareerStore } from '../store/careerStore'
import { useLanguage } from '../i18n'

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
  const french = useLanguage() === 'fr'
  const [selected, setSelected] = useState<School | null>(null)
  const regionId = useCareerStore(s => s.player?.regionId)
  const schools = schoolsForRegion(regionId)

  return (
    <div className="relative min-h-screen w-full bg-ks-black flex flex-col px-5 py-8">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(212,175,55,0.07), transparent 60%), linear-gradient(180deg,#0a0a09,#050504)' }} />

      <div className="relative z-10 max-w-md mx-auto w-full flex flex-col flex-1">
        <div className="font-display tracking-widest text-[11px] text-ks-gold uppercase mb-2">{french ? 'choisis ton école' : 'choose your school'}</div>
        <h1 className="font-display text-ks-ink text-2xl tracking-wide mb-1">{french ? 'Où vas-tu te faire un nom ?' : 'Where will you make your name?'}</h1>
        <p className="text-ks-muted text-xs mb-6">{french ? 'Chaque école change la difficulté des détections et le nombre de recruteurs présents.' : 'Each school changes how hard the trials are and how many scouts watch you.'}</p>

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
              <p className="text-[12px] text-ks-muted mb-3 leading-snug">{french ? ({ westview: 'Un programme d’élite. Difficile d’intégrer l’équipe, mais les recruteurs sont toujours là.', greenwood: 'Un programme équilibré. De bonnes chances de rejoindre l’équipe et une visibilité correcte.', riverside: 'Une école en plein développement. Une place presque assurée, mais moins de recruteurs.' }[school.id.split('-').at(-1) ?? ''] ?? school.blurb) : school.blurb}</p>
              <div className="flex flex-col gap-1.5">
                <DiffMeter label={french ? 'difficulté' : 'difficulty'} value={school.trialDifficulty} max={1.25} />
                <DiffMeter label={french ? 'recruteurs' : 'scouts'} value={school.scoutExposure} />
                <DiffMeter label={french ? 'chances' : 'squad odds'} value={school.squadPlaceOdds} max={1.3} />
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={() => selected && onChoose(selected)}
          disabled={!selected}
          className="mt-5 w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm disabled:opacity-25 shadow-[0_0_25px_rgba(212,175,55,0.2)]"
        >
          {selected ? (french ? `rejoindre ${selected.name}` : `enrol at ${selected.name.toLowerCase()}`) : (french ? 'choisir une école' : 'select a school')}
        </button>
      </div>
    </div>
  )
}
