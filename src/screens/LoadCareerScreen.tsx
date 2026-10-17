import { useEffect, useState } from 'react'
import { listSaves, type SaveGame, type SaveSlotId } from '../engine/save'
import { useTranslate, useLanguage } from '../i18n'

interface Props {
  onBack: () => void
  onLoad: (slot: SaveSlotId) => void
}

export default function LoadCareerScreen({ onBack, onLoad }: Props) {
  const t = useTranslate()
  const language = useLanguage()
  const [saves, setSaves] = useState<(SaveGame | undefined)[] | null>(null)

  useEffect(() => { listSaves().then(setSaves) }, [])

  return (
    <main className="min-h-screen bg-ks-black text-ks-ink px-5 py-6">
      <div className="max-w-xl mx-auto">
        <button type="button" onClick={onBack} className="min-h-12 min-w-12 px-4 rounded-xl border border-ks-border bg-white/[0.03] font-semibold">← {t('Back')}</button>
        <div className="mt-8 mb-6">
          <div className="text-[11px] uppercase tracking-[0.24em] text-ks-gold">{t('Your journeys')}</div>
          <h1 className="text-4xl font-black mt-2">{t('Load Career')}</h1>
          <p className="text-ks-muted mt-2">{t('Choose the career you want to continue.')}</p>
        </div>

        {!saves ? <div className="text-ks-muted">{t('Checking saves…')}</div> : (
          <div className="space-y-3">
            {[0, 1, 2].map((slot) => {
              const save = saves[slot]
              if (!save) {
                return <div key={slot} className="rounded-2xl border border-ks-border/60 p-5 opacity-50"><div className="text-xs text-ks-muted">{t('SLOT')} {slot + 1}</div><div className="mt-1">{t('Empty slot')}</div></div>
              }
              const p = save.player
              return (
                <button key={slot} type="button" onClick={() => onLoad(slot as SaveSlotId)} className="w-full text-left rounded-2xl border border-ks-border bg-white/[0.025] p-5 active:scale-[0.99]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-ks-gold tracking-widest">{t('SLOT')} {slot + 1}</div>
                      <div className="text-xl font-black mt-1">{p.name}</div>
                      <div className="text-sm text-ks-muted mt-1">{t('Age')} {p.careerClock.ageYears} · {p.position} · {p.careerClock.phase.replaceAll('-', ' ')}</div>
                    </div>
                    <span className="text-ks-gold text-xl">›</span>
                  </div>
                  <div className="text-[11px] text-ks-muted mt-4">{t('Saved')} {new Date(save.savedAt).toLocaleString(language)}</div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
