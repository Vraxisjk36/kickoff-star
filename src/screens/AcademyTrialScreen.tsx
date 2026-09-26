import { useState } from 'react'
import type { Player } from '../types/player'
import { academyTrialBase } from '../engine/academyRecruitment'
import AnimatedNumber from '../components/AnimatedNumber'

const STAGES = [
  { title: 'First touch circuit', brief: 'Receive across your body, protect the ball and play forward.', options: [['Keep it clean', 12], ['Play at match speed', 17], ['Try the spectacular', 8]] },
  { title: 'Position test', brief: 'The coach recreates the decisions your position makes under pressure.', options: [['Read the picture', 17], ['Trust instinct', 13], ['Force the moment', 7]] },
  { title: 'Trial match', brief: 'The bibs go on. This is about helping the team, not chasing a highlight reel.', options: [['Play for the team', 19], ['Demand the ball', 14], ['Stay safe', 10]] },
] as const

export default function AcademyTrialScreen({ player, clubName, clubId, onComplete }: {
  player: Player; clubName: string; clubId: string; onComplete: (points: number | null) => void
}) {
  const pathway = player.pathway
  const sameClub = pathway?.academyTrialClubId === clubId
  const session = sameClub ? pathway.academyTrialSessions ?? 0 : 0
  const alreadyPlayed = sameClub && pathway?.academyTrialLastWeek === (player.totalWeeksElapsed ?? 0)
  const base = sameClub ? pathway?.academyTrialBase ?? academyTrialBase(player) : academyTrialBase(player)
  const runningScore = base + (sameClub ? pathway?.academyTrialPoints ?? 0 : 0)
  const [phase, setPhase] = useState<'preview' | 'trial' | 'result'>('preview')
  const [chosen, setChosen] = useState(0)
  const score = Math.min(100, runningScore + chosen)
  const final = session === 2

  if (alreadyPlayed) return <div className="relative min-h-screen bg-ks-black flex items-center justify-center px-5"><div className="minigame-preview max-w-sm w-full">
    <h2>SESSION COMPLETE</h2><p>Your {session}/3 assessment is recorded. The next stage opens next week.</p>
    <button onClick={() => onComplete(null)}>return to career →</button>
  </div></div>

  if (phase === 'preview') return <div className="relative min-h-screen bg-ks-black flex items-center justify-center px-5"><div className="minigame-preview max-w-sm w-full">
    <div className="minigame-preview-icon">◎</div><div className="text-[7px] tracking-[.25em] text-ks-gold">{clubName.toUpperCase()}</div>
    <h2>ACADEMY TRIAL · {session + 1}/3</h2><p>One assessment per week. Your ability and form set the starting score; decisions add to it across the three weeks.</p>
    <div className="minigame-tip"><span>HOW IT WORKS</span>{STAGES[session].title}, then return next week. The final score must reach 62/100.</div>
    <button onClick={() => setPhase('trial')}>enter the training ground →</button>
  </div></div>

  if (phase === 'result') return <div className="academy-trial-stage min-h-screen flex items-center justify-center px-5"><div className={`academy-trial-result ${final && score < 62 ? 'failed' : 'passed'}`}>
    <small>{final ? 'ACADEMY DECISION' : `SESSION ${session + 1} COMPLETE`}</small>
    <div className="academy-score"><AnimatedNumber from={runningScore} to={score} duration={1400}/><i>/100</i></div>
    <h1>{final ? score >= 62 ? 'TRIAL PASSED' : 'NOT SELECTED' : 'BACK NEXT WEEK'}</h1>
    <p>{final ? score >= 62 ? `${clubName} want to begin scholarship talks.` : `${clubName} have passed this time. Your current team remains open.` : 'Your score is saved. The next assessment opens after the weekly calendar advances.'}</p>
    <div className="academy-threshold"><span style={{ width: `${score}%` }}/><i>PASS 62</i></div>
    <button onClick={() => onComplete(chosen)}>continue →</button>
  </div></div>

  const current = STAGES[session]
  return <div className="academy-trial-stage min-h-screen flex items-center justify-center px-5"><div className="academy-trial-card">
    <div className="academy-trial-progress"><span>ASSESSMENT {session + 1} OF 3</span><b>{clubName}</b></div>
    <div className="trial-cones"><i/><i/><i/><i/><i/></div><h1>{current.title}</h1><p>{current.brief}</p>
    <div className="flex flex-col gap-2 mt-5">{current.options.map(([label, points], index) => <button key={label} style={{ animationDelay: `${index * 90}ms` }} onClick={() => { setChosen(points); setPhase('result') }}><span>0{index + 1}</span><b>{label}</b><i>choose →</i></button>)}</div>
    <small className="block text-center mt-4">Ability base {base} · current score {runningScore}</small>
  </div></div>
}
