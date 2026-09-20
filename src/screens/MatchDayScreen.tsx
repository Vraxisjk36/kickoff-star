import { useEffect, useState } from 'react'
import type { Player } from '../types/player'
import type { Team } from '../engine/teams'
import { teamOverall } from '../engine/teams'
import { bandSpec, matchSharpnessFrom } from '../engine/energy'
import { TeamCrest } from '../components/ui'
import Avatar from '../components/Avatar'
import { venueForTeam } from '../engine/venues'

// Phase 16: matches used to begin with no ceremony at all — you tapped "continue"
// on the hub and were suddenly at 0'. This is the walk-out: who you're playing,
// what shape you're in, what's riding on it.

function formOf(player: Player): { letters: string[]; avg: number | null } {
  const r = (player.matchRatings ?? []).slice(-5)
  if (r.length === 0) return { letters: [], avg: null }
  return {
    letters: r.map((x) => (x >= 7.5 ? 'A' : x >= 6.8 ? 'B' : x >= 6.0 ? 'C' : 'D')),
    avg: r.reduce((a, b) => a + b, 0) / r.length,
  }
}

export default function MatchDayScreen({ player, playerTeam, opponent, isHome, onKickOff, competitionLabel }: {
  player: Player
  playerTeam: Team
  opponent: Team
  isHome: boolean
  competitionLabel?: string
  onKickOff: () => void
}) {
  const [entered, setEntered] = useState(false)
  const [walkout, setWalkout] = useState(false)
  useEffect(() => { const t = window.setTimeout(() => setEntered(true), 40); return () => window.clearTimeout(t) }, [])

  const form = formOf(player)
  const spec = bandSpec(player.fitness.stamina)
  const sharpness = matchSharpnessFrom(player.fitness.stamina)
  const gap = teamOverall(playerTeam) - teamOverall(opponent)
  const captaincy=player.captaincy?.role ?? 'none'
  const armband=captaincy==='captain'?'Captain · wearing the armband':captaincy==='vice-captain'?'Vice-Captain':''
  const billing = gap >= 6 ? 'You should be winning this.'
    : gap <= -6 ? 'They\'re the better side on paper.'
    : 'There\'s very little between these two.'
  const venue=venueForTeam(isHome?playerTeam:opponent)
  const opponentSquad=player.worldSquads?.[opponent.id]??[]
  const isRegional=competitionLabel?.toLowerCase().includes('regional');const isNational=competitionLabel?.toLowerCase().includes('national')||competitionLabel?.toLowerCase().includes('international')

  return (
    <div className="relative min-h-screen w-full bg-ks-black flex flex-col justify-center px-5 py-8">
      <div className="matchday-lights absolute inset-0"/><div className="matchday-crowd absolute inset-x-0 bottom-0 h-[34%]"/><div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 70% 45% at 50% 30%, rgba(212,175,55,0.10), transparent 62%), linear-gradient(180deg,#0a0a09,#050504)',
      }} />

{walkout && <div className="walkout-curtain"><span>THE PLAYERS ARE OUT</span><b>{playerTeam.short} · {opponent.short}</b></div>}
      <div className={`relative z-10 max-w-md mx-auto w-full transition-all duration-700 ${
        entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      }`}>
        <div className="matchday-kicker">KICKOFF STAR · MATCHDAY</div>{(isRegional||isNational)&&<div className={`showpiece-ribbon ${isNational?'national':'regional'}`}><i>★</i><span>{isNational?'NATIONAL STAGE':'REGIONAL STAGE'}</span><i>★</i></div>}<div className="text-center font-display tracking-[0.3em] text-[10px] text-ks-gold uppercase mb-6">{competitionLabel ?? 'matchday'}</div>

        {/* the fixture */}
        <div className="fixture-stage flex items-center justify-center gap-4 mb-3">
          <div className="flex-1 flex flex-col items-center gap-2">
            <TeamCrest primary={playerTeam.primaryColor} secondary={playerTeam.secondaryColor} short={playerTeam.short} />
            <span className="font-display text-ks-ink text-xs tracking-wide text-center leading-tight">{playerTeam.name}</span>
            <span className="text-[9px] text-ks-muted">strength {teamOverall(playerTeam)}</span>
          </div>
          <div className="versus-mark"><span>VS</span><small>{isHome?'HOME':'AWAY'}</small></div>
          <div className="flex-1 flex flex-col items-center gap-2">
            <TeamCrest primary={opponent.primaryColor} secondary={opponent.secondaryColor} short={opponent.short} />
            <span className="font-display text-ks-ink text-xs tracking-wide text-center leading-tight">{opponent.name}</span>
            <span className="text-[9px] text-ks-muted">strength {teamOverall(opponent)}</span>
          </div>
        </div>

        <div className="text-center text-[10px] text-ks-muted uppercase tracking-widest mb-1">
          {isHome ? 'home' : 'away'}
        </div>
        <p className="text-center text-ks-muted text-[12px] mb-2">{billing}</p>
        <div className="text-center text-[9px] text-ks-muted uppercase tracking-widest mb-5">{venue.name} · {venue.surface} · cap {venue.capacity.toLocaleString()}</div>
        {opponentSquad.length>0&&<div className="rounded-xl border border-ks-border bg-[#0f0f0d] px-3 py-3 mb-3"><div className="font-display text-[9px] text-ks-gold tracking-widest uppercase mb-2">opposition squad</div><div className="grid grid-cols-2 gap-x-3 gap-y-1">{opponentSquad.slice(0,16).map(p=><div key={p.id} className="text-[10px] text-ks-muted flex justify-between"><span>{p.name}</span><span>{p.position} · {p.quality}</span></div>)}</div></div>}

        {/* your state going in */}
        <div className="rounded-xl border border-ks-border bg-[#0f0f0d] px-4 py-3.5 mb-3">
          <div className="flex items-center gap-2 mb-2.5">
            <Avatar id={player.avatarId ?? 0} size={30} />
            <div className="font-display tracking-widest text-[9px] text-ks-muted uppercase flex-1">how you're going in</div>
            {/* P29: being dropped now actually costs you minutes, so the team
                sheet has to say so before kickoff. */}
            <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-md border ${
              player.squadRole === 'starting-xi'
                ? 'text-green-500 border-green-500/40 bg-green-500/5'
                : player.squadRole === 'bench'
                ? 'text-orange-400 border-orange-400/40 bg-orange-400/5'
                : 'text-red-500 border-red-500/40 bg-red-500/5'
            }`}>
              {player.squadRole === 'starting-xi' ? 'starting' : player.squadRole === 'bench' ? 'on the bench' : 'reserves'}
            </span>
          </div>

          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-ks-muted">condition</span>
            <span className={`text-[11px] ${spec.colorClass}`}>
              {spec.label} · sharpness {sharpness}
            </span>
          </div>

          {armband && (
            <div className="flex items-center justify-between mb-2 rounded-lg border border-ks-gold/30 bg-ks-gold/5 px-2 py-1.5">
              <span className="text-[11px] text-ks-muted">leadership</span>
              <span className="text-[11px] text-ks-gold font-display tracking-wide">{captaincy==='captain'?'© ':''}{armband}</span>
            </div>
          )}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-ks-muted">role</span>
            <span className="text-[11px] text-ks-ink capitalize">{player.squadRole ?? 'TBD'}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-ks-muted">recent form</span>
            {form.letters.length === 0 ? (
              <span className="text-[11px] text-ks-muted">no matches yet</span>
            ) : (
              <span className="flex items-center gap-1">
                {form.letters.map((l, i) => (
                  <span key={i} className={`w-4 h-4 rounded-sm text-[9px] font-display flex items-center justify-center ${
                    l === 'A' ? 'bg-green-500/20 text-green-500' :
                    l === 'B' ? 'bg-ks-gold/20 text-ks-gold' :
                    l === 'C' ? 'bg-ks-border text-ks-muted' : 'bg-red-500/20 text-red-500'
                  }`}>{l}</span>
                ))}
              </span>
            )}
          </div>
        </div>

        {sharpness < 60 && (
          <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-2 mb-3">
            <p className="text-[11px] text-orange-400 leading-relaxed">
              {player.fitness.stamina < 50 ? 'Below 50% energy: you are limited to a substitute appearance. Below 30%, you cannot play.' : "You are short of match sharpness and will tire quickly."}
            </p>
          </div>
        )}

        <button
          onClick={() => { if (walkout) return; setWalkout(true); window.setTimeout(onKickOff, 900) }}
          disabled={walkout}
          className="matchday-walkout disabled:opacity-60 disabled:pointer-events-none w-full bg-ks-gold text-ks-black font-display tracking-widest rounded-xl py-4 text-sm uppercase active:scale-[0.99]"
        >
          {walkout ? 'walking out…' : 'walk out'}
        </button>
      </div>
    </div>
  )
}
