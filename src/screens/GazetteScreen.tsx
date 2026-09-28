import type { GazetteIssue } from '../engine/gazette'
import { useState } from 'react'

// Phase 25: the weekly newspaper reader. Deliberately reads like a paper, not
// a settings list — masthead up top, articles as columns, kind-tagged so a
// transfer story looks visually distinct from a match recap.
const KIND_LABEL: Record<string, string> = {
  transfer: 'TRANSFER NEWS',
  spotlight: 'PLAYER SPOTLIGHT',
  preview: 'MATCH PREVIEW',
  injury: 'MEDICAL ROOM',
  recap: 'MATCH REPORT',
  league: 'LOCAL LEAGUE',
  filler: 'AROUND THE CLUB',
  world: 'WORLD SCHOOLS',
  awards: 'AWARDS NIGHT',
}

export default function GazetteScreen({ issue, issues = [issue], onClose }: { issue: GazetteIssue; issues?: GazetteIssue[]; onClose: () => void }) {
  const [selected, setSelected] = useState(issue)
  return (
    <div className="fixed inset-0 z-40 bg-ks-black overflow-y-auto">
      <div className="max-w-md mx-auto min-h-full flex flex-col">
        <div className="px-4 pt-6 pb-4 border-b-2 border-ks-gold">
          <div className="flex items-center justify-between">
            <span className="font-display tracking-[0.2em] text-[10px] text-ks-muted">WEEK {selected.weekNumber} · SEASON {selected.seasonYear}</span>
            <button onClick={onClose} className="text-ks-muted text-xs">close ✕</button>
          </div>
          <h1 className="font-display text-2xl tracking-wide text-ks-gold mt-2 leading-tight">THE GAZETTE</h1>
          <p className="font-display text-sm text-white/90 mt-1 leading-snug">{selected.masthead}</p>
        </div>

        <div className="px-4 pt-3"><label className="text-[10px] uppercase text-ks-muted tracking-widest" htmlFor="gazette-archive">Issue archive</label>
          <select id="gazette-archive" className="w-full mt-1 bg-[#181713] border border-ks-border text-ks-ink rounded-lg p-2 text-xs" value={selected.id}
            onChange={event => setSelected(issues.find(entry => entry.id === event.target.value) ?? issue)}>
            {[...issues].reverse().map(entry => <option key={entry.id} value={entry.id}>Season {entry.seasonYear} · week {entry.weekNumber} · {entry.masthead}</option>)}
          </select></div>

        <div className="flex-1 px-4 py-4 space-y-4">
          {selected.ranking && <section className="rounded-xl border border-ks-gold/50 bg-[#171407] p-3">
            <h2 className="font-display text-ks-gold tracking-wider text-sm">{selected.ranking.scope === 'academy' ? 'ACADEMY LEAGUE FIVE' : 'WORLD SCHOOLS FIVE'} · WEEK {selected.ranking.week}</h2>
            <p className="text-[10px] text-ks-muted mt-1">Season points · ranking closes after week 32</p>
            {selected.ranking.rows.map((row, i) => <div key={row.id} className="flex items-center gap-2 border-t border-ks-border/50 py-2 text-xs">
              <b className="text-ks-gold w-5">{i + 1}</b><span className="flex-1 text-ks-ink">{row.name}<small className="block text-ks-muted">{row.school} · {row.countryId.toUpperCase()} · {row.goals}G {row.assists}A · {row.monthGoals}G this month</small></span>
              <b className="text-ks-gold">{row.points}</b></div>)}
          </section>}
          {selected.scorers?.length ? <details className="border border-ks-border rounded-lg p-3"><summary className="font-display text-xs text-ks-gold">WORLD SCHOOL SCORERS · RECORDED RESULTS</summary>
            {selected.scorers.map((row, i) => <p className="text-xs text-ks-muted py-1" key={row.id}>{i + 1}. {row.name} · {row.goals} goals · {row.appearances} matches</p>)}
          </details> : null}
          {selected.awards && <section className="rounded-xl border border-ks-gold/50 p-3"><h2 className="font-display text-ks-gold text-sm">{selected.awards.scope === 'academy' ? 'ACADEMY AWARDS' : 'WORLD SCHOOLS AWARDS'} · {selected.awards.season}</h2>
            {selected.awards.winners.map(entry => <p className="text-xs text-ks-ink py-1" key={entry.name}>{entry.name}: <b className="text-ks-gold">{entry.winnerName}</b> · {entry.value}</p>)}
            <h3 className="font-display text-ks-gold text-xs mt-3">TEAM OF THE YEAR</h3><p className="text-xs text-ks-muted">{selected.awards.teamOfYear.map(row => `${row.name} (${row.position})`).join(' · ')}</p>
            <h3 className="font-display text-ks-gold text-xs mt-3">REGIONAL AWARDS</h3>{selected.awards.regional.map(entry => <p className="text-xs text-ks-muted" key={entry.name}>{entry.name}: {entry.winnerName}</p>)}
            <h3 className="font-display text-ks-gold text-xs mt-3">LOCAL AWARDS</h3>{selected.awards.local.map(entry => <p className="text-xs text-ks-muted" key={entry.name}>{entry.name}: {entry.winnerName}</p>)}
          </section>}
          {selected.articles.map((article, i) => (
            <div key={i} className="border-b border-ks-border/60 pb-4 last:border-0">
              <span className="font-display tracking-widest text-[9px] text-ks-gold/80 uppercase">{KIND_LABEL[article.kind] ?? article.kind}</span>
              <h2 className="font-display text-base tracking-wide text-white mt-1">{article.headline}</h2>
              <p className="text-sm text-ks-muted mt-1 leading-relaxed">{article.body}</p>
            </div>
          ))}
        </div>

        <div className="px-4 pb-6">
          <button
            onClick={onClose}
            className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3 text-sm"
          >
            back to the club →
          </button>
        </div>
      </div>
    </div>
  )
}
