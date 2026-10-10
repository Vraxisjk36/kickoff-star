import { LANGUAGES, setLanguage, useLanguage } from '../i18n'
import LogoBadge from '../components/LogoBadge'
import { useState } from 'react'
import { prepareTranslation, supportsLiveTranslation } from '../engine/liveTranslation'

export default function LanguageSelect({ onContinue }: { onContinue: () => void }) {
  const language = useLanguage()
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState('')
  async function continueToGame() {
    if (!supportsLiveTranslation() || language === 'en') { onContinue(); return }
    setPreparing(true)
    setError('')
    try { await prepareTranslation(language); onContinue() }
    catch { setError('The language pack could not be downloaded. Check your connection and try again, or choose English.') }
    finally { setPreparing(false) }
  }
  return (
    <main className="min-h-screen bg-ks-black text-ks-ink flex items-center justify-center px-5 py-8">
      <div className="w-full max-w-sm">
        <div className="w-20 mx-auto mb-7"><LogoBadge /></div>
        <div className="text-center text-ks-gold font-display tracking-[.2em] text-xs">KICKOFF STAR</div>
        <h1 className="text-center text-3xl font-display mt-3">Choose your language</h1>
        <p className="text-center text-ks-muted text-sm mt-2 mb-7">Elige tu idioma · Escolha seu idioma<br/>अपनी भाषा चुनें · Choisissez votre langue</p>
        <div className="grid gap-2">
          {LANGUAGES.map(({ code, name }) => (
            <button key={code} type="button" onClick={() => { setLanguage(code); setError('') }} disabled={preparing} aria-pressed={language === code}
              className={`min-h-14 rounded-xl px-5 flex items-center justify-between border text-left transition-colors ${language === code ? 'border-ks-gold bg-ks-gold/15 text-ks-gold' : 'border-ks-border bg-white/[.025] text-ks-ink'}`}>
              <span className="font-semibold">{name}</span><span aria-hidden="true">{language === code ? '●' : '○'}</span>
            </button>
          ))}
        </div>
        {language !== 'en' && supportsLiveTranslation() && <p className="text-xs text-ks-muted mt-4 text-center">The first use downloads an on-device language pack (about 30 MB). Translation works offline after that. Career text is automatically translated with Google Translate and may contain mistakes. <a className="text-ks-gold underline" href="https://translate.google.com/" target="_blank" rel="noopener noreferrer">Google Translate ↗</a></p>}
        {error && <p role="alert" className="text-sm text-red-400 mt-4">{error}</p>}
        <button type="button" onClick={continueToGame} disabled={preparing} className="mt-6 w-full min-h-14 rounded-xl bg-ks-gold text-ks-black font-display text-lg disabled:opacity-50">{preparing ? 'Downloading language pack…' : language === 'es' ? 'CONTINUAR' : language === 'pt-BR' ? 'CONTINUAR' : language === 'hi' ? 'आगे बढ़ें' : language === 'fr' ? 'CONTINUER' : 'CONTINUE'} →</button>
      </div>
    </main>
  )
}
