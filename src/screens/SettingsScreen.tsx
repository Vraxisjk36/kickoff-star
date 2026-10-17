import { useEffect, useState } from 'react'
import { musicEnabled, setMusicEnabled, currentTrack, skipTrack } from '../engine/music'
import LanguagePicker from '../components/LanguagePicker'
import { useTranslate } from '../i18n'
import { effectsEnabled, setEffectsEnabled } from '../engine/audio'
import { hapticsEnabled, setHapticsEnabled } from '../engine/haptics'
import { deleteLocalGameData } from '../engine/saveTransfer'

interface Props { onBack: () => void }

const REDUCED_MOTION_KEY = 'kickoff-star-reduced-motion'
const LOW_POWER_KEY = 'kickoff-star-low-power'

export default function SettingsScreen({ onBack }: Props) {
  const t = useTranslate()
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem(REDUCED_MOTION_KEY) === '1')
  const [lowPower, setLowPower] = useState(() => localStorage.getItem(LOW_POWER_KEY) === '1')
  const [musicOn, setMusicOn] = useState(musicEnabled)
  const [track, setTrack] = useState(currentTrack)
  const [soundsOn, setSoundsOn] = useState(effectsEnabled)
  const [hapticsOn, setHapticsOn] = useState(hapticsEnabled)
  const [deleteStatus, setDeleteStatus] = useState('')

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reducedMotion)
    localStorage.setItem(REDUCED_MOTION_KEY, reducedMotion ? '1' : '0')
  }, [reducedMotion])

  useEffect(() => {
    document.documentElement.classList.toggle('low-power', lowPower)
    localStorage.setItem(LOW_POWER_KEY, lowPower ? '1' : '0')
  }, [lowPower])

  return (
    <main className="min-h-screen bg-ks-black text-ks-ink px-5 py-6">
      <div className="max-w-xl mx-auto">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('Back')}
          className="min-h-12 min-w-12 px-4 rounded-xl border border-ks-border bg-white/[0.03] text-ks-ink font-semibold active:scale-[0.98]"
        >
          ← {t('Back')}
        </button>

        <div className="mt-8 mb-6">
          <div className="text-[11px] uppercase tracking-[0.24em] text-ks-gold">Kickoff Star</div>
          <h1 className="text-4xl font-black mt-2">{t('Settings')}</h1>
          <p className="text-ks-muted mt-2">{t('Tune the game for your device and play style.')}</p>
        </div>

        <LanguagePicker />
        <section className="rounded-2xl border border-ks-border bg-white/[0.025] p-5">
          <div className="flex items-center justify-between gap-4 pb-5 border-b border-ks-border">
            <div>
              <h2 className="font-bold">{t('Menu music')}</h2>
              <p className="text-sm text-ks-muted mt-1">{t('Five original Kickoff Star tracks play in sequence. Match sounds have their own mute control.')}</p>
            </div>
            <button type="button" role="switch" aria-checked={musicOn} onClick={() => { const next = !musicOn; setMusicOn(next); setMusicEnabled(next) }} className={`min-w-16 min-h-11 rounded-full border px-2 font-bold ${musicOn ? 'bg-ks-gold text-ks-black border-ks-gold' : 'border-ks-border text-ks-muted'}`}>
              {t(musicOn ? 'ON' : 'OFF')}
            </button>
          </div>
          <button type="button" onClick={() => setTrack(skipTrack())} className="w-full min-h-12 flex items-center justify-between text-left border-b border-ks-border py-3 text-sm"><span className="capitalize text-ks-ink">♫ {track}</span><span className="text-ks-gold font-display tracking-wider">{t('NEXT TRACK →')}</span></button>
          <div className="flex items-center justify-between gap-4 py-5 border-b border-ks-border">
            <div><h2 className="font-bold">{t('Sound effects')}</h2><p className="text-sm text-ks-muted mt-1">{t('Match and menu sounds. You can also mute them during a match.')}</p></div>
            <button type="button" role="switch" aria-checked={soundsOn} onClick={() => { const next = !soundsOn; setSoundsOn(next); setEffectsEnabled(next) }} className={`min-w-16 min-h-11 rounded-full border px-2 font-bold ${soundsOn ? 'bg-ks-gold text-ks-black border-ks-gold' : 'border-ks-border text-ks-muted'}`}>{t(soundsOn ? 'ON' : 'OFF')}</button>
          </div>
          <div className="flex items-center justify-between gap-4 py-5 border-b border-ks-border">
            <div><h2 className="font-bold">{t('Vibration')}</h2><p className="text-sm text-ks-muted mt-1">{t('Feel goals and important match moments on supported devices.')}</p></div>
            <button type="button" role="switch" aria-checked={hapticsOn} onClick={() => { const next = !hapticsOn; setHapticsOn(next); setHapticsEnabled(next) }} className={`min-w-16 min-h-11 rounded-full border px-2 font-bold ${hapticsOn ? 'bg-ks-gold text-ks-black border-ks-gold' : 'border-ks-border text-ks-muted'}`}>{t(hapticsOn ? 'ON' : 'OFF')}</button>
          </div>
          <div className="flex items-center justify-between gap-4 pt-5">
            <div>
              <h2 className="font-bold">{t('Reduced motion')}</h2>
              <p className="text-sm text-ks-muted mt-1">{t('Minimises menu and match animations. Useful on slower phones or if motion is distracting.')}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={reducedMotion}
              onClick={() => setReducedMotion((v) => !v)}
              className={`min-w-16 min-h-11 rounded-full border px-2 font-bold ${reducedMotion ? 'bg-ks-gold text-ks-black border-ks-gold' : 'border-ks-border text-ks-muted'}`}
            >
              {t(reducedMotion ? 'ON' : 'OFF')}
            </button>
          </div>
          <div className="border-t border-ks-border mt-5 pt-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-bold">{t('Performance mode')}</h2>
              <p className="text-sm text-ks-muted mt-1">{t('Cuts expensive glow, blur and decorative effects while keeping the football animations and gameplay intact.')}</p>
            </div>
            <button type="button" role="switch" aria-checked={lowPower} onClick={() => setLowPower(v => !v)} className={`min-w-16 min-h-11 rounded-full border px-2 font-bold ${lowPower ? 'bg-ks-gold text-ks-black border-ks-gold' : 'border-ks-border text-ks-muted'}`}>
              {t(lowPower ? 'ON' : 'OFF')}
            </button>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-ks-border bg-white/[0.025] p-5">
          <h2 className="font-bold">{t('Your data')}</h2>
          <p className="text-sm text-ks-muted mt-1">{t('Export and import careers from Load Career on the main menu. Keep the backup file somewhere safe.')}</p>
          <button type="button" onClick={async () => {
            if (!window.confirm(t('Delete all three careers and local preferences from this device? This cannot be undone.'))) return
            try { await deleteLocalGameData(); window.location.reload() }
            catch { setDeleteStatus(t('Could not delete your data. Please try again.')) }
          }} className="mt-4 min-h-11 rounded-xl border border-red-500/60 px-4 text-red-300 font-semibold">{t('Delete local data')}</button>
          {deleteStatus && <p role="alert" className="text-sm text-red-300 mt-3">{deleteStatus}</p>}
        </section>

        <p className="text-xs text-ks-muted mt-6 leading-relaxed">{t('Your career saves remain stored locally on this device. Settings are also saved locally.')}</p>
        <a
          href="https://vraxisjk36.github.io/kickoff-star/privacy-policy.html"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-ks-gold underline underline-offset-4"
        >
          {t('Privacy policy ↗')}
        </a>
      </div>
    </main>
  )
}
