import type { Player } from '../types/player'
import CareerRecord from '../components/CareerRecord'

export default function CareerEnd({ player, onMenu }: { player: Player; onMenu: () => void }) {
  const retired = !!player.proCareer?.retired
  const career = player.career
  const proSeasons = player.proCareer?.seasonRecords ?? []
  const leagueTitles = proSeasons.filter(season => season.leagueChampion).length
  const national = player.proCareer?.international
  return (
    <div className="relative min-h-screen w-full bg-ks-black flex flex-col justify-center px-5 py-8">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 20%, rgba(212,175,55,0.06), transparent 60%), linear-gradient(180deg,#0a0a09,#050504)' }} />
      <div className="relative z-10 max-w-md mx-auto w-full text-center">
        <div className="font-display tracking-widest text-[11px] text-ks-muted uppercase mb-3">{retired ? 'your legacy' : 'career over'}</div>
        <h1 className="font-display text-ks-ink text-3xl tracking-wide mb-3">{retired ? 'Hall of Fame' : 'The Dream Fades'}</h1>
        <p className="text-ks-muted text-sm leading-relaxed mb-8 px-2">
          {retired ? `After ${player.proCareer?.season ?? 1} professional seasons, ${player.name} retires at age ${player.careerClock.ageYears}. Every appearance, goal and trophy is part of your legacy.` : 'Your pathway ended without a professional contract. Your school and academy appearances, performances and honours are recorded below.'}
        </p>

        {retired && <div className="grid grid-cols-3 gap-2 mb-6 text-center"><div className="border border-ks-border rounded-lg py-4"><b className="block text-ks-gold text-xl">{career?.appearances ?? 0}</b><small className="text-ks-muted">APPS</small></div><div className="border border-ks-border rounded-lg py-4"><b className="block text-ks-gold text-xl">{career?.goals ?? 0}</b><small className="text-ks-muted">GOALS</small></div><div className="border border-ks-border rounded-lg py-4"><b className="block text-ks-gold text-xl">{career?.assists ?? 0}</b><small className="text-ks-muted">ASSISTS</small></div></div>}
        {retired && <div className="mb-6 text-left"><div className="text-ks-gold font-display text-lg mb-3">{leagueTitles} LEAGUE TITLE{leagueTitles === 1 ? '' : 'S'}</div><div className="max-h-52 overflow-y-auto">{[...proSeasons].reverse().map(season => <div key={season.season} className="flex justify-between gap-3 border-b border-ks-border/50 py-2 text-xs"><span className="text-ks-ink">{season.season} · {season.clubName} ({season.associationId.toUpperCase()})</span><span className="shrink-0 text-ks-gold">#{season.leaguePosition}/{season.clubs}{season.leagueChampion ? ' 🏆' : ''}</span></div>)}</div></div>}
        {retired && national && <div className="mb-6 border border-ks-border rounded-xl p-4 text-left"><h2 className="text-ks-gold font-display mb-2">INTERNATIONAL LEGACY</h2><div className="grid grid-cols-3 gap-2 text-center text-xs"><div><b className="block text-ks-ink text-xl">{national.caps}</b>CAPS</div><div><b className="block text-ks-ink text-xl">{national.goals}</b>GOALS</div><div><b className="block text-ks-ink text-xl">{national.assists}</b>ASSISTS</div></div></div>}
        <CareerRecord player={player} />

        <button onClick={onMenu} className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm shadow-[0_0_25px_rgba(212,175,55,0.3)]">
          back to menu
        </button>
      </div>
    </div>
  )
}
