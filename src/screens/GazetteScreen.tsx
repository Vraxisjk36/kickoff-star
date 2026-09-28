import type { GazetteIssue } from '../engine/gazette'
import { useEffect, useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import { presentGazetteIssue } from '../engine/gazette'

const INTERVIEW_QUESTIONS = [
  { prompt: 'How would you describe your season so far?', options: ['I am proud of the progress, but there is more to do.', 'The results speak, and I want to keep this run going.', 'I am learning something from every match.'] },
  { prompt: 'What has made the biggest difference in training?', options: ['Repetition and attention to the small details.', 'Listening to the coaches and trying new things.', 'My teammates push me every session.'] },
  { prompt: 'Who deserves credit for your form?', options: ['The whole team creates these chances.', 'My family has kept me grounded.', 'The coaches believed in me early.'] },
  { prompt: 'How do you handle expectations?', options: ['I focus on the next action, not the noise.', 'Pressure is a privilege if you prepare properly.', 'I lean on the people around me.'] },
  { prompt: 'What matters in the next competition?', options: ['Playing well together and earning each result.', 'Taking the opportunities when they come.', 'Showing we can compete with strong sides.'] },
  { prompt: 'Where do you hope this journey leads?', options: ['First I want to earn my place every week.', 'An academy opportunity would mean a lot.', 'I dream of playing professionally one day.'] },
]

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
  const [openStory, setOpenStory] = useState<number | null>(null)
  const [interviewAnswers, setInterviewAnswers] = useState<string[] | null>(null)
  const player = useCareerStore(state => state.player)
  const league = useCareerStore(state => state.league)
  const displayed = player ? presentGazetteIssue(selected, player, league?.kind === 'school' ? league.divisions[league.playerDivision] : null) : selected
  const publishInterview = useCareerStore(state => state.publishGazetteInterview)
  useEffect(() => { if (selected.id === issue.id && selected.articles.length !== issue.articles.length) setSelected(issue) }, [issue, selected])
  const eligible = player && selected.id === issue.id && player.gazetteInterviewSeason !== issue.seasonYear &&
    (player.seasonGoals >= 5 || player.seasonAssists >= 5 || player.matchRatings.slice(-3).length === 3 && player.matchRatings.slice(-3).every(rating => rating >= 7.5))
  const feature = displayed.articles[0]
  return (
    <div className="fixed inset-0 z-40 bg-[#0b0a08] overflow-y-auto text-[#f3eddb]">
      <div className="max-w-xl mx-auto min-h-full flex flex-col pb-8">
        <div className="px-5 pt-7 pb-5 border-b-4 border-double border-ks-gold/80 bg-[radial-gradient(circle_at_top,rgba(212,175,55,.13),transparent_70%)]">
          <div className="flex items-center justify-between">
            <span className="font-display tracking-[0.2em] text-[10px] text-ks-gold">THE WEEKLY FOOTBALL RECORD</span>
            <button onClick={openStory === null ? onClose : () => setOpenStory(null)} className="rounded-full border border-ks-border px-3 py-1 text-xs text-ks-ink">{openStory === null ? 'close ✕' : '← issue'}</button>
          </div>
          <h1 className="font-display text-4xl tracking-wide text-ks-gold mt-5 leading-none">THE GAZETTE</h1>
          <div className="mt-3 flex items-center justify-between border-y border-ks-gold/40 py-2 text-[10px] tracking-[.18em] uppercase text-ks-muted"><span>Season {selected.seasonYear} · Week {selected.weekNumber}</span><span>{displayed.articles.length} stories</span></div>
          <p className="font-display text-lg text-white mt-4 leading-tight">{displayed.masthead}</p>
        </div>

        <div className="px-5 pt-4"><label className="text-[10px] uppercase text-ks-gold tracking-widest" htmlFor="gazette-archive">Browse the archive</label>
          <select id="gazette-archive" className="w-full mt-2 bg-[#181713] border border-ks-border text-ks-ink rounded-lg p-3 text-xs" value={selected.id}
            onChange={event => { setSelected(issues.find(entry => entry.id === event.target.value) ?? issue); setOpenStory(null) }}>
            {[...issues].reverse().map(entry => <option key={entry.id} value={entry.id}>Season {entry.seasonYear} · week {entry.weekNumber} · {player ? presentGazetteIssue(entry, player, league?.kind === 'school' ? league.divisions[league.playerDivision] : null).masthead : entry.masthead}</option>)}
          </select></div>

        <div className="flex-1 px-5 py-5 space-y-5">
          {eligible && openStory === null && <section className="border border-ks-gold/60 bg-ks-gold/5 p-4">
            {interviewAnswers === null ? <><p className="text-[10px] tracking-widest text-ks-gold">INVITATION · PLAYER TO WATCH</p>
              <h2 className="font-display text-xl mt-2">The Gazette wants your story, {player.name}.</h2>
              <p className="text-sm text-ks-muted mt-2">Your recorded performances caught the sports desk’s attention. Answer six questions and we’ll publish your words in this issue.</p>
              <button className="mt-4 bg-ks-gold text-ks-black px-4 py-2 rounded-lg font-display text-xs" onClick={() => setInterviewAnswers([])}>TAKE THE INTERVIEW →</button></>
              : <><p className="text-[10px] tracking-widest text-ks-gold">QUESTION {interviewAnswers.length + 1} / 6</p>
                <h2 className="font-display text-xl mt-2">{INTERVIEW_QUESTIONS[interviewAnswers.length].prompt}</h2>
                <div className="space-y-2 mt-4">{INTERVIEW_QUESTIONS[interviewAnswers.length].options.map(answer => <button key={answer}
                  className="block w-full text-left border border-ks-border rounded-lg px-3 py-3 text-sm text-ks-ink" onClick={() => {
                    const next = [...interviewAnswers, answer]
                    if (next.length === 6) { publishInterview(next); setInterviewAnswers(null); setOpenStory(0) }
                    else setInterviewAnswers(next)
                  }}>{answer}</button>)}</div></>}
          </section>}
          {openStory !== null ? <article className="border-t-2 border-ks-gold pt-5">
            <span className="text-[10px] font-display tracking-[.2em] text-ks-gold">{KIND_LABEL[displayed.articles[openStory]?.kind] ?? 'THE GAZETTE'}</span>
            <h2 className="mt-3 font-display text-3xl leading-tight">{displayed.articles[openStory]?.headline}</h2>
            <p className="mt-3 text-xs text-ks-gold/80">{displayed.articles[openStory]?.byline ?? 'The Gazette sports desk'} · Season {selected.seasonYear}, week {selected.weekNumber}</p>
            {(displayed.articles[openStory]?.detail ?? displayed.articles[openStory]?.body ?? '').split('\n\n').map((paragraph, index) =>
              <p key={index} className="mt-5 text-[15px] leading-7 text-[#ded6c6]">{paragraph}</p>)}
            {displayed.articles[openStory]?.quote && <blockquote className="my-6 border-l-2 border-ks-gold pl-4 italic text-ks-gold">“{displayed.articles[openStory]?.quote}”</blockquote>}
            <button className="mt-8 border-t border-ks-border w-full py-4 text-left text-sm text-ks-gold" onClick={() => setOpenStory(null)}>← Back to all stories</button>
          </article> : <>
          {feature && <button onClick={() => setOpenStory(0)} className="w-full text-left border-y-2 border-ks-gold/65 py-6">
            <span className="text-[10px] font-display tracking-[.2em] text-ks-gold">LEAD STORY · {KIND_LABEL[feature.kind] ?? feature.kind}</span>
            <h2 className="font-display text-2xl leading-tight mt-3">{feature.headline}</h2>
            <p className="mt-3 text-sm leading-6 text-[#bfb6a5] line-clamp-3">{feature.body}</p>
            <span className="block mt-4 text-xs font-display text-ks-gold tracking-widest">READ THE FULL STORY →</span>
          </button>}
          {selected.schoolRanking && <section className="rounded-xl border border-ks-gold/50 bg-[#171407] p-3">
            <h2 className="font-display text-ks-gold tracking-wider text-sm">WORLD SCHOOL POWER TABLE · WEEK {selected.schoolRanking.week}</h2>
            <p className="text-[10px] text-ks-muted mt-1">Completed league results · season cumulative</p>
            {selected.schoolRanking.rows.slice(0, 5).map((row, i) => <div key={row.teamId} className="flex items-center gap-2 border-t border-ks-border/50 py-2 text-xs">
              <b className="text-ks-gold w-5">{i + 1}</b><span className="flex-1 text-ks-ink">{row.name}<small className="block text-ks-muted">{row.countryId.toUpperCase()} · {row.points} league pts · {row.played} played · {row.previousRank ? `was #${row.previousRank}` : 'new'}</small></span><b className="text-ks-gold">{row.score}</b>
            </div>)}
          </section>}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1">
          {displayed.articles.slice(1).map((article, i) => (
            <button key={i} onClick={() => setOpenStory(i + 1)} className="text-left border-b border-ks-border/60 py-5 last:border-0">
              <span className="font-display tracking-widest text-[9px] text-ks-gold/80 uppercase">{KIND_LABEL[article.kind] ?? article.kind}</span>
              <h2 className="font-display text-lg tracking-wide text-white mt-2 leading-tight">{article.headline}</h2>
              <p className="text-sm text-ks-muted mt-2 leading-relaxed line-clamp-3">{article.body}</p>
              <span className="inline-block text-[10px] text-ks-gold mt-3 tracking-widest">READ STORY →</span>
            </button>
          ))}
          </div>
          </>}
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
