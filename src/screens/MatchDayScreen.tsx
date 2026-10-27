import { useEffect, useState } from 'react'
import type { Player } from '../types/player'
import type { Team } from '../engine/teams'
import { teamOverall } from '../engine/teams'
import { bandSpec, matchSharpnessFrom } from '../engine/energy'
import { TeamCrest } from '../components/ui'
import Avatar from '../components/Avatar'
import { matchTeamSheet, matchVenue } from '../engine/matchPresentation'
import { remainingToday, rewardedAdsAvailable, watchRewardedAd } from '../engine/ads'
import { useCareerStore } from '../store/careerStore'

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

export default function MatchDayScreen({ player, playerTeam, opponent, isHome, onKickOff, onSitOut, matchKey, competitionLabel, competitionId }: {
  player: Player
  playerTeam: Team
  opponent: Team
  isHome: boolean
  competitionLabel?: string
  competitionId: string
  matchKey: string
  onSitOut: () => void
  onKickOff: () => void
}) {
  const [entered, setEntered] = useState(false)
  const [walkout, setWalkout] = useState(false)
  const [lineupExpanded, setLineupExpanded] = useState(false)
  const [adBusy, setAdBusy] = useState(false)
  const [adError, setAdError] = useState('')
  const restoreEnergyFromAd = useCareerStore(s => s.restoreEnergyFromAd)
  const adKey = `ks-prematch-energy:${matchKey}`
  const [usedPreMatchAd, setUsedPreMatchAd] = useState(() => {
    try { return localStorage.getItem(adKey) === '1' } catch { return false }
  })
  const canOfferEnergy = rewardedAdsAvailable() && player.fitness.stamina < 50 && !usedPreMatchAd && remainingToday('energy') > 0
  async function recoverBeforeMatch() {
    if (adBusy || walkout || !canOfferEnergy) return
    setAdBusy(true)
    setAdError('')
    try {
      const reward = await watchRewardedAd('energy')
      if (reward) {
        try { localStorage.setItem(adKey, '1') } catch { /* current screen still tracks it */ }
        setUsedPreMatchAd(true)
        restoreEnergyFromAd(15)
      } else setAdError('No ad was completed. You can keep playing or try again later.')
    } finally { setAdBusy(false) }
  }
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
  const isRegional=competitionLabel?.toLowerCase().includes('regional');const isNational=competitionLabel?.toLowerCase().includes('national')||competitionLabel?.toLowerCase().includes('international')
  const isContinental=competitionId==='academyChampionsCup'||/champions|europa|conference|continental|union-/i.test(competitionId??'')
  const isCup=/cup|trophy|final|knockout|invitational/i.test((competitionId??'')+' '+(competitionLabel??''))
  const showpieceTheme=isContinental?'continental':isNational?'international':isCup?'cup':'league'
  const sheet = matchTeamSheet(player)
  const venue = matchVenue(isHome ? playerTeam : opponent, competitionId, player.careerClock.phase === 'academy')

  return (
    <div className="matchday-stage relative min-h-screen w-full bg-ks-black flex flex-col justify-start px-4 sm:px-5 py-6 sm:py-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))] overflow-y-auto">
      <div className="matchday-lights absolute inset-0"/><div className="matchday-pitch-lines" aria-hidden="true"><i/><i/><i/></div><div className="matchday-crowd absolute inset-x-0 bottom-0 h-[34%]"/><div className="absolute inset-0" style={{
        background: showpieceTheme==='continental' ? 'radial-gradient(ellipse 85% 60% at 50% 24%, rgba(42,101,207,.38), transparent 70%),linear-gradient(180deg,#09142c,#050711)' : showpieceTheme==='international' ? 'radial-gradient(ellipse 85% 60% at 50% 24%, rgba(42,146,105,.32), transparent 70%),linear-gradient(180deg,#071b18,#050907)' : showpieceTheme==='cup' ? 'radial-gradient(ellipse 85% 60% at 50% 24%, rgba(162,72,145,.28), transparent 70%),linear-gradient(180deg,#211020,#080609)' : 'radial-gradient(ellipse 70% 45% at 50% 30%, rgba(212,175,55,0.10), transparent 62%), linear-gradient(180deg,#0a0a09,#050504)',
      }} />

{walkout && <div className="walkout-curtain"><span>THE PLAYERS ARE OUT</span><b>{playerTeam.name} · {opponent.name}</b></div>}
      <div className={`relative z-10 max-w-md mx-auto w-full transition-all duration-700 ${
        entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      }`}>
        <div className="matchday-kicker">KICKOFF STAR · {showpieceTheme==='continental'?'EUROPEAN NIGHT':showpieceTheme==='international'?'INTERNATIONAL STAGE':showpieceTheme==='cup'?'CUP NIGHT':'MATCHDAY'}</div>{(isRegional||isNational||isContinental)&&<div className={`showpiece-ribbon ${isNational||isContinental?'national':'regional'}`}><i>★</i><span>{isContinental?'CONTINENTAL STAGE':isNational?'NATIONAL STAGE':'REGIONAL STAGE'}</span><i>★</i></div>}<div className="text-center font-display tracking-[0.3em] text-[10px] text-ks-gold uppercase mb-6">{competitionLabel ?? 'matchday'}</div>

        {/* the fixture */}
        <div className="fixture-stage flex items-center justify-center gap-3 sm:gap-4 mb-3 rounded-2xl border border-ks-gold/20 bg-[#0b100c]/80 px-2 py-5 shadow-[0_18px_50px_rgba(0,0,0,.45)]">
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
          {venue} · {isHome ? 'home' : 'away'}
        </div>
        <p className="text-center text-ks-muted text-[12px] mb-7">{billing}</p>
        {player.weeklyFocus?.week === (player.totalWeeksElapsed ?? 0) &&
          <p className="text-center text-[10px] text-ks-gold mb-3">YOUR WEEK: {player.weeklyFocus.kind === 'film' ? 'FILM STUDY' : player.weeklyFocus.kind === 'shift' ? 'COMMUNITY SHIFT' : 'RECOVERY'}</p>}

        <button type="button" onClick={() => setLineupExpanded(value => !value)} aria-expanded={lineupExpanded} aria-controls="matchday-team-sheet" className="w-full flex items-center justify-between gap-3 rounded-xl border border-ks-gold/30 bg-gradient-to-r from-[#211e10] to-[#10150e] px-4 py-3 mb-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ks-gold">
          <span><span className="block text-[10px] font-display tracking-[.14em] text-ks-gold">TEAM SHEET</span><span className="block text-xs text-ks-ink mt-1">{playerTeam.name} · Starting XI & bench</span></span>
          <span className="text-ks-gold text-xs font-display shrink-0">{lineupExpanded ? 'HIDE −' : 'VIEW +'}</span>
        </button>
        {lineupExpanded && <section id="matchday-team-sheet" className="rounded-xl border border-ks-border bg-[#0f0f0d] px-3 py-3 mb-3" aria-label="Pre-match team sheet">
          <div className="flex items-center justify-between mb-2"><h2 className="font-display tracking-widest text-[10px] text-ks-gold uppercase">team sheet</h2><span className="text-[9px] text-ks-muted">{playerTeam.name} · starting XI</span></div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {sheet.starters.map(member => <div key={`${member.number}-${member.name}`} className={`flex items-center gap-1.5 min-w-0 text-[10px] ${member.isPlayer ? 'text-ks-gold' : 'text-ks-ink'}`}>
              <b className="w-5 shrink-0 text-right">{member.number}</b><span className="truncate">{member.name}</span><small className="ml-auto text-ks-muted">{member.position}</small>
            </div>)}
          </div>
          <div className="border-t border-ks-border/60 mt-2 pt-2"><span className="text-[9px] uppercase tracking-widest text-ks-muted">bench</span>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">{sheet.bench.map(member => <span key={`${member.number}-${member.name}`} className={`text-[9px] ${member.isPlayer ? 'text-ks-gold' : 'text-ks-muted'}`}>{member.number} {member.name} · {member.position}</span>)}</div>
          </div>
          {(opponent.notablePlayers?.length ?? 0) > 0 && <div className="border-t border-ks-border/60 mt-2 pt-2"><span className="text-[9px] uppercase tracking-widest text-ks-muted">{opponent.name} players to watch</span>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">{opponent.notablePlayers.map(member => <span key={`${member.name}-${member.position}`} className="text-[9px] text-ks-muted">{member.name} · {member.position}</span>)}</div>
          </div>}
        </section>}

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

        {canOfferEnergy && <div className="rounded-xl border border-ks-gold/50 bg-[#1d1b11] p-3 mb-3">
          <div className="flex items-center justify-between gap-3"><div><p className="font-display text-xs text-ks-gold">PRE-MATCH RECOVERY</p><p className="text-[11px] text-ks-muted mt-1">Watch one ad for +15 energy. Energy drinks are still available in your kit.</p></div><span className="font-display text-ks-gold">+15</span></div>
          <button type="button" disabled={adBusy || walkout} onClick={() => void recoverBeforeMatch()} className="w-full mt-3 rounded-lg border border-ks-gold py-2.5 text-xs font-display text-ks-gold disabled:opacity-50">{adBusy ? 'LOADING AD…' : 'WATCH AD · +15 ENERGY'}</button>
        </div>}
        {adError && <p role="status" className="text-xs text-orange-300 mb-3">{adError}</p>}
        {player.fitness.stamina < 30 && <p className="text-xs text-orange-300 mb-3">You need at least 30% energy to play this match. Recover or sit out.</p>}

        <button
          onClick={() => { if (walkout) return; setWalkout(true); window.setTimeout(onKickOff, 900) }}
          disabled={walkout || adBusy || player.fitness.stamina < 30}
          className="matchday-walkout disabled:opacity-60 disabled:pointer-events-none w-full bg-gradient-to-r from-[#d4af37] to-[#f3d979] text-[#12170e] font-display tracking-widest rounded-xl py-4 min-h-12 text-sm uppercase shadow-[0_10px_32px_rgba(212,175,55,.2)] active:scale-[0.98] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ks-gold"
        >
          {walkout ? 'walking out…' : 'walk out'}
        </button>
        {player.fitness.stamina < 30 && <button type="button" onClick={onSitOut} className="w-full py-3 mt-2 text-xs text-ks-muted">SIT OUT THIS MATCH</button>}
      </div>
    </div>
  )
}
