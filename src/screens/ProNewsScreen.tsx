import { useState } from 'react'
import type { ProNewsArticle } from '../engine/proNews'

export default function ProNewsScreen({ articles, onClose }: { articles: ProNewsArticle[]; onClose: () => void }) {
  const [section, setSection] = useState<'All' | ProNewsArticle['section']>('All')
  const [selected, setSelected] = useState<string | null>(null)
  const filtered = [...articles].reverse().filter(article => section === 'All' || article.section === section)
  const issue = filtered.find(article => article.id === selected)
  return <div className="fixed inset-0 z-40 bg-ks-black overflow-y-auto"><div className="max-w-md mx-auto px-5 py-6 pb-24">
    <div className="flex items-center justify-between text-ks-gold tracking-[.2em] text-xs"><span>KICKOFF STAR / PRESS</span><button onClick={onClose}>CLOSE ✕</button></div>
    <header className="border-y-2 border-ks-gold mt-8 py-5"><p className="text-ks-muted text-[10px] tracking-[.3em]">THE WORLD OF FOOTBALL</p><h1 className="font-display text-ks-gold text-5xl tracking-wide">THE GAZETTE</h1><p className="text-ks-muted text-xs mt-2">Your club · your country · the wider game</p></header>
    {issue ? <article className="mt-8"><button className="text-ks-gold text-xs" onClick={() => setSelected(null)}>← ALL STORIES</button><p className="text-ks-gold text-[10px] tracking-[.2em] mt-8">{issue.section.toUpperCase()} · SEASON {issue.season} / WEEK {issue.week}</p><h2 className="font-display text-ks-ink text-3xl leading-tight mt-3">{issue.headline}</h2><div className="h-[2px] bg-ks-gold mt-6"/>{issue.paragraphs.map((paragraph, index) => <p key={index} className="text-ks-ink leading-7 text-sm mt-6">{paragraph}</p>)}</article>
      : <><div className="flex gap-2 mt-6">{(['All','Club','Country','World'] as const).map(item => <button key={item} onClick={() => setSection(item)} className={`text-[10px] px-3 py-2 rounded-full border ${section === item ? 'bg-ks-gold text-ks-black border-ks-gold' : 'text-ks-muted border-ks-border'}`}>{item}</button>)}</div>
        {filtered.length ? filtered.map(article => <button key={article.id} className="block w-full text-left border-b border-ks-border py-6" onClick={() => setSelected(article.id)}><span className="text-ks-gold text-[10px] tracking-[.2em]">{article.section.toUpperCase()} · S{article.season} W{article.week}</span><h2 className="font-display text-ks-ink text-xl mt-2">{article.headline}</h2><p className="text-ks-muted text-xs leading-5 mt-2 line-clamp-2">{article.paragraphs[0]}</p><span className="text-ks-gold text-xs mt-3 block">READ STORY →</span></button>) : <p className="text-ks-muted text-sm mt-10">Your career is underway. The first stories arrive as fixtures, deals and titles are recorded.</p>}</>}
  </div></div>
}
