import { LANGUAGES, setLanguage, useLanguage, useTranslate } from '../i18n'

export default function LanguagePicker() {
  const language = useLanguage()
  const t = useTranslate()
  return (
    <section className="rounded-2xl border border-ks-border bg-white/[0.025] p-5 mb-4">
      <label htmlFor="game-language" className="font-bold block">{t('Language')}</label>
      <p className="text-sm text-ks-muted mt-1 mb-3">{t('Choose the language for the game interface.')}</p>
      <select id="game-language" value={language} onChange={(event) => setLanguage(event.target.value as typeof language)} className="w-full min-h-12 rounded-xl border border-ks-border bg-[#191915] text-ks-ink px-4">
        {LANGUAGES.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
      </select>
      {language !== 'en' && <p className="text-xs text-ks-muted mt-3">{t('Career events and Gazette stories are currently in English.')}</p>}
    </section>
  )
}
