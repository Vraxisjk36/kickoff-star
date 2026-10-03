import type { Player } from '../types/player'
import { computeCurrentAbility, toOvr } from '../engine/rating'

export default function CareerRecord({ player }: { player: Player }) {
  const career = player.career
  const honours = [player.personalGlory, player.clubGlory, player.nationalGlory]
    .reduce((total, cabinet) => total + Object.values(cabinet ?? {}).reduce((sum, count) => sum + count, 0), 0)
  const record = [
    { label: 'final OVR', value: toOvr(computeCurrentAbility(player)) },
    { label: 'appearances', value: career?.appearances ?? player.seasonAppearances ?? 0 },
    { label: 'goals', value: career?.goals ?? player.seasonGoals ?? 0 },
    { label: 'assists', value: career?.assists ?? player.seasonAssists ?? 0 },
    { label: 'best match', value: career?.bestRating ? career.bestRating.toFixed(1) : '—' },
    { label: 'honours', value: honours },
  ]
  return <section className="rounded-2xl border border-ks-border bg-[#0f0f0d] px-5 py-5 mb-8" aria-label="Career record">
    <h2 className="font-display tracking-widest text-[10px] text-ks-muted uppercase mb-4">career record</h2>
    <div className="grid grid-cols-3 gap-x-2 gap-y-5">
      {record.map(({ label, value }, index) => <div key={label}>
        <div className={`font-display text-xl ${index === 0 ? 'text-ks-gold' : 'text-ks-ink'}`}>{value}</div>
        <div className="text-[9px] text-ks-muted uppercase">{label}</div>
      </div>)}
    </div>
  </section>
}
