interface Props { onBack: () => void }
import { useTranslate } from '../i18n'

const tips = [
  ['Energy', 'Normal play should be sustainable. Rest before you are completely drained; recovery items are for emergencies, not mandatory progression.'],
  ['Matches', 'Choices are judged by situation and your attributes. A sensible decision can still fail through execution or football randomness.'],
  ['Training', 'Higher intensity gives more development but costs more energy and carries more risk.'],
  ['Selection', 'Form, coach trust and development all matter. Being benched is a setback, not the end of your career.'],
]

export default function HelpScreen({ onBack }: Props) {
  const t = useTranslate()
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
          <div className="text-[11px] uppercase tracking-[0.24em] text-ks-gold">{t('Need a hand?')}</div>
          <h1 className="text-4xl font-black mt-2">{t('How to Play')}</h1>
          <p className="text-ks-muted mt-2">{t('Your goal in Phase 1 is simple: survive the youth game, improve, get noticed and earn your first professional contract.')}</p>
        </div>

        <div className="space-y-3 stagger-children">
          {tips.map(([title, body]) => (
            <section key={title} className="rounded-2xl border border-ks-border bg-white/[0.025] p-5">
              <h2 className="font-black text-ks-gold">{t(title)}</h2>
              <p className="text-sm text-ks-muted mt-2 leading-relaxed">{t(body)}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
