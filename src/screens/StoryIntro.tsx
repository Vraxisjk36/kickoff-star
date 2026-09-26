import { useState, useEffect } from 'react'
import type { Player } from '../types/player'
import Avatar from '../components/Avatar'
import { getNation } from '../engine/nations'
import { useCareerStore } from '../store/careerStore'

// P65 — Joel: "a story thingy after onboarding, explain the entire game."
// A player who's just built a character has no idea yet that there's a real
// arc here — a clock, a ladder, a destination. This is that context, told
// once, briefly, before the first trial. Personalized with the real player
// just created, not generic copy, and every number in here is the real one
// (14 → 6 years → academy → pro), not made up for the pitch.

interface Slide {
  eyebrow: string
  title: string
  body: (p: Player) => string
}

const SLIDES: Slide[] = [
  {
    eyebrow: 'your story starts here',
    title: 'welcome, {name}',
    body: (p) => `Age ${p.careerClock.ageYears}. ${getNation(p.nationality).name}. A ${p.position === 'ST' ? 'striker' : p.position === 'GK' ? 'goalkeeper' : 'footballer'} with a shot at something real — if you can make it count.`,
  },
  {
    eyebrow: 'the goal',
    title: 'six years to make it',
    body: () => `You have until you're 20 to go from a trial nobody's heard of to a professional contract. That's the whole game. Everything you do between now and then either moves you closer or wastes the clock.`,
  },
  {
    eyebrow: 'the path',
    title: 'grassroots → academy → pro',
    body: () => `Build your career in school and Sunday football. Academy scouts start watching at 16, with the first invitations possible in October of your third year. Survive the academy, and a professional deal is the reward waiting at the end.`,
  },
  {
    eyebrow: 'getting noticed',
    title: 'build a record worth watching',
    body: () => `Your early seasons build the record academy scouts review from age 16. They look for sustained performances in your position, then watch you repeatedly. A few goals cannot skip the pathway.`,
  },
  {
    eyebrow: 'beyond the league',
    title: 'cups, and a shirt for your country',
    body: () => `Cup competitions run alongside your league season — knockout football, real underdog runs, silverware that isn't tied to your table position. Play well enough for long enough, and international recognition becomes a real possibility, not a fantasy.`,
  },
]

export default function StoryIntro({ onComplete }: { onComplete: () => void }) {
  const [i, setI] = useState(0)
  const player = useCareerStore((s) => s.player)
  useEffect(() => {
    if (!player) onComplete()
  }, [player, onComplete])
  if (!player) return null

  const slide = SLIDES[i]
  const isLast = i === SLIDES.length - 1

  return (
    <div className="relative min-h-screen w-full bg-ks-black flex flex-col px-5 py-8">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 20%, rgba(212,175,55,0.08), transparent 60%), linear-gradient(180deg,#0a0a09,#050504)' }} />
      <div className="relative z-10 flex-1 flex flex-col max-w-md mx-auto w-full">
        {/* progress dots */}
        <div className="flex gap-1.5 justify-center mb-8 mt-2">
          {SLIDES.map((_, idx) => (
            <div key={idx} className={`h-1 rounded-full transition-all ${idx === i ? 'w-6 bg-ks-gold' : 'w-1.5 bg-ks-border'}`} />
          ))}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
          {i === 0 && <Avatar id={player.avatarId ?? 0} size={72} className="mb-1" />}
          <div className="font-display tracking-[0.3em] text-[10px] text-ks-gold uppercase">{slide.eyebrow}</div>
          <h1 className="font-display text-ks-ink text-2xl tracking-wide leading-tight">
            {slide.title.replace('{name}', player.name)}
          </h1>
          <p className="text-ks-muted text-[13px] leading-relaxed max-w-xs">{slide.body(player)}</p>
        </div>

        <div className="flex flex-col gap-2.5 mt-8">
          <button
            onClick={() => (isLast ? onComplete() : setI(i + 1))}
            className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm shadow-[0_0_25px_rgba(212,175,55,0.25)]"
          >
            {isLast ? "let's go →" : 'continue'}
          </button>
          {!isLast && (
            <button onClick={onComplete} className="w-full text-center text-[11px] text-ks-muted underline underline-offset-2">
              skip
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
