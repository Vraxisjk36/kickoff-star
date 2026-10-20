import { VERIFIED_PRO_RULES } from '../engine/proRulebook'
import type { ProCareerState } from '../engine/proCareer'
import { proCompetitionName } from '../engine/proTournaments'
import { PRO_CAREER_DESTINATIONS } from '../engine/proCareer'

export default function ProSeasonCeremony({pro,clubName,kind,onContinue}:{
  pro:ProCareerState;clubName:string;kind:'preseason'|'kickoff';onContinue:()=>void
}){
  const association=pro.associationId??'eng'
  const rules=VERIFIED_PRO_RULES[association as keyof typeof VERIFIED_PRO_RULES]
  const size=pro.world.divisions[1].teams.length
  const competitionName=pro.activeCompetitionId ? proCompetitionName(pro.activeCompetitionId) :
    `${PRO_CAREER_DESTINATIONS.find(c=>c.id===association)?.name??'Professional'} First Division`
  const format=rules&&rules.topFlightClubs===size ? rules : null
  const continental=association==='eng' ? 'The highest finishers compete for continental places; finishing fifth or sixth may offer a secondary route.'
    : association==='rsa'?'The highest eligible South African clubs can enter continental club competitions.'
      :'High finishes may qualify your club for continental tournaments, depending on federation allocations and domestic cup winners.'
  return <div className="min-h-screen bg-[#070a09] text-ks-ink px-5 py-8">
    <div className="max-w-md mx-auto">
      <div className="text-ks-gold tracking-[.22em] uppercase text-xs">KICKOFF STAR · SEASON {pro.season}</div>
      <div className="rounded-2xl overflow-hidden border border-ks-gold/35 mt-8 bg-gradient-to-br from-[#343018] via-[#181d16] to-[#090e0d]">
        <div className="p-6 relative">
          <div className="absolute top-5 right-6 text-6xl opacity-30">{kind==='preseason'?'⚽':'🏆'}</div>
          <div className="text-ks-gold uppercase tracking-[.25em] text-xs">{kind==='preseason'?'PRESEASON · TRAINING CAMP':'THE OPENING CEREMONY'}</div>
          <h1 className="font-display text-4xl leading-tight mt-5">{kind==='preseason'?'A NEW CHAPTER.':'THE LEAGUE BEGINS.'}</h1>
          <p className="text-ks-muted text-sm mt-3">{clubName}</p>
          <div className="grid grid-cols-3 mt-6 border-t border-ks-gold/30 pt-4 gap-2">
            <div><div className="text-ks-gold text-2xl font-display">{size}</div><small className="uppercase text-[9px] text-ks-muted">Clubs</small></div>
            <div><div className="text-ks-gold text-2xl font-display">{size>=2?(size-1)*2:0}</div><small className="uppercase text-[9px] text-ks-muted">League matches</small></div>
            <div><div className="text-ks-gold text-2xl font-display">{pro.season}</div><small className="uppercase text-[9px] text-ks-muted">Season</small></div>
          </div>
        </div>
      </div>
      {kind==='preseason'?<div className="mt-6 space-y-3">
        <h2 className="text-xl font-display">FIRST, EARN YOUR PLACE.</h2>
        <p className="text-ks-muted text-sm leading-relaxed">The first three weeks are preseason. Work on your fitness, complete interactive training drills, spend your earned XP and build coach trust before competitive football begins.</p>
        <div className="grid grid-cols-3 gap-2">{['WEEK 1 · FITNESS','WEEK 2 · TECHNIQUE','WEEK 3 · MATCH SHARPNESS'].map(item=><div key={item} className="rounded-lg border border-ks-gold/20 bg-[#161a12] p-2 text-center text-[10px] text-ks-gold">{item}</div>)}</div>
        <p className="text-ks-muted text-xs">Week 4 brings the league briefing and opening ceremony. The first league match is scheduled from Week 5.</p>
      </div>:<div className="mt-6 space-y-4">
        <h2 className="font-display text-xl">{competitionName}</h2>
        <p className="text-ks-muted text-sm">{size} clubs face each other at home and away. A win earns three points, a draw one, and a defeat zero. The club finishing first becomes league champion.</p>
        <div className="rounded-xl border border-ks-gold/30 bg-[#141910] p-4">
          <div className="text-ks-gold font-display text-sm">THE TITLE & CONTINENTAL RACE</div>
          <p className="text-ks-muted mt-2 text-xs">1st place: league title. {continental} Cup results, registration and eligibility can change which teams earn those berths.</p>
        </div>
        <div className="rounded-xl border border-red-700/30 bg-[#190f0e] p-4">
          <div className="text-red-300 font-display text-sm">THE RELEGATION BATTLE</div>
          <p className="text-ks-muted mt-2 text-xs">{format? `Bottom ${format.directRelegation} clubs go down automatically${format.relegationPlayoff ? `; one additional club faces a promotion/relegation play-off`:''}.`:'Relegation and play-off places depend on this division’s competition format.'}</p>
        </div>
        <p className="text-[11px] text-ks-muted">These are the game's fictional tournament rules; continental qualification remains subject to the competition engine's actual berth calculations.</p>
      </div>}
      <button onClick={onContinue} className="w-full rounded-xl bg-ks-gold py-4 text-ks-black font-display tracking-wide mt-8">{kind==='preseason'?'ENTER PRESEASON →':'BEGIN THE LEAGUE SEASON →'}</button>
    </div>
  </div>
}
