import { useEffect, useRef, useState } from 'react'
import { listSaves, type SaveGame, type SaveSlotId } from '../engine/save'
import { exportCareer, importCareer } from '../engine/saveTransfer'
import { useCareerStore } from '../store/careerStore'
import { useTranslate, useLanguage } from '../i18n'

interface Props {
  onBack: () => void
  onLoad: (slot: SaveSlotId) => void
}

export default function LoadCareerScreen({ onBack, onLoad }: Props) {
  const t = useTranslate()
  const language = useLanguage()
  const [saves, setSaves] = useState<(SaveGame | undefined)[] | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const saveCurrent = useCareerStore(s => s.saveCurrent)
  const activeSlot = useCareerStore(s => s.activeSlot)

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

        <div className="rounded-2xl border border-ks-gold/40 p-4 mb-5">
          <h2 className="font-bold text-ks-gold">{t('Move your career to another device')}</h2>
          <p className="text-sm text-ks-muted mt-1">{t('Export a slot below, send the backup file to your other device, then import it here.')}</p>
          <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" aria-label={t('Choose career backup')} onChange={async event => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file || busy) return
            const empty = saves?.findIndex(s => !s) ?? -1
            const chosen = empty >= 0 ? empty : Number(window.prompt(t('All slots are full. Enter the slot number to replace (1–3), or cancel.'), '')) - 1
            if (!Number.isInteger(chosen) || chosen < 0 || chosen > 2) return
            if (saves?.[chosen] && !window.confirm(t(`Replace slot ${chosen + 1}? Its current career will be lost unless you export it first.`))) return
            setBusy(true); setMessage('')
            try {
              if (activeSlot === chosen) await saveCurrent()
              await importCareer(file, chosen as SaveSlotId)
              setSaves(await listSaves())
              setMessage(t(`Career imported into slot ${chosen + 1}. You can load it now.`))
            } catch (error) { setMessage(error instanceof Error ? error.message : t('Import failed.')) }
            finally { setBusy(false) }
          }} />
          <button type="button" disabled={busy || !saves} onClick={() => fileInput.current?.click()} className="mt-3 rounded-xl border border-ks-gold text-ks-gold min-h-11 px-4 font-semibold disabled:opacity-40">{t('Import career backup')}</button>
          {message && <p role="status" className="mt-3 text-sm text-ks-ink">{message}</p>}
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
                <div key={slot} className="rounded-2xl border border-ks-border bg-white/[0.025] p-5">
                <button type="button" onClick={() => onLoad(slot as SaveSlotId)} className="w-full text-left active:scale-[0.99]">
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
                <button type="button" disabled={busy} onClick={async () => {
                  setBusy(true); setMessage('')
                  try { if (activeSlot === slot) await saveCurrent(); await exportCareer(slot as SaveSlotId) }
                  catch (error) { setMessage(error instanceof Error ? error.message : t('Export failed.')) }
                  finally { setBusy(false) }
                }} className="mt-4 min-h-11 px-3 rounded-lg border border-ks-gold text-ks-gold text-sm disabled:opacity-40">{t('Export backup ↗')}</button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
