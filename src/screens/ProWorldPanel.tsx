import { useState } from 'react'
import type { ProWorldState } from '../engine/proWorld'
import { LOWER_DIVISIONS, PRO_LEAGUE_PLAN } from '../engine/proLeagueRegistry'
import { proCompetitionName } from '../engine/proTournaments'

const CONFEDERATIONS = ['uefa','caf','conmebol','concacaf','afc','ofc'] as const
function PromotionSummary({ world, associationId }: { world: ProWorldState; associationId: string }) {
  const latest = world.promotionHistory?.filter(item => item.associationId === associationId).at(-1)
  const live = world.promotionPlayoffs?.[`promotion-${associationId}`]
  if (!latest && !live) return null
  return <div className="mt-3"><p className="text-ks-gold">PROMOTION RACE</p>
    {live && <p className="text-ks-muted mt-1">{live.seasonId} · {live.stage.replace('-', ' ')} in progress</p>}
    {latest && <p className="text-ks-muted mt-1">{latest.seasonId} · {latest.promotedIds.map(id => world.clubs[id]?.name ?? id).join(', ')} promoted · {latest.fixtures.length} playoff matches</p>}
  </div>
}
function FeederSummary({ world, associationId }: { world: ProWorldState; associationId: string }) {
  const levels = ['third', 'fourth'].map(level => world.competitions[`${level}-${associationId}`]).filter(Boolean)
  if (!levels.length) return null
  return <div className="mt-3 space-y-2">{levels.map(comp => {
    const rows = [...(world.standings[comp.id] ?? [])].sort((a, b) => b.points - a.points ||
      (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst))
    const boundary = `${associationId}-${comp.id.startsWith('third-') ? 2 : 3}`
    const movement = world.promotionHistory?.filter(item => item.associationId === boundary).at(-1)
    return <div key={comp.id} className="rounded-lg border border-ks-border/50 p-2">
      <p className="text-ks-gold">{proCompetitionName(comp.id)} · {comp.entrantIds.length} clubs · {comp.format.scheduledRounds} rounds</p>
      <p className="text-ks-muted mt-1">Leader: {world.clubs[rows[0]?.clubId]?.name ?? '—'} · {rows[0]?.points ?? 0} pts</p>
      {movement && <p className="text-ks-muted mt-1">{movement.seasonId}: {movement.promotedIds.map(id => world.clubs[id]?.name ?? id).join(', ')} promoted</p>}
    </div>
  })}</div>
}
export default function ProWorldPanel({ world, playableAssociation = 'eng' }: { world: ProWorldState; playableAssociation?: string }) {
  const [confederation, setConfederation] = useState<typeof CONFEDERATIONS[number]>('uefa')
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null)
  const leagues = PRO_LEAGUE_PLAN.filter(league => league.confederation === confederation && league.associationId !== playableAssociation)
  const competitions = Object.values(world.competitions).filter(comp => comp.id.includes(confederation) && comp.kind !== 'league')
  const champions = world.championHistory.filter(row => row.competitionId.includes(confederation)).slice(-5).reverse()
  return <div className="rounded-xl border border-ks-border bg-[#10100d] p-4 text-ks-ink">
    <p className="font-display text-ks-gold tracking-widest text-xs">WORLD FOOTBALL</p><p className="text-ks-muted text-xs mt-2">A wider simulated football world across six confederations. Your playable club table is above; scores, titles, squads and new generations progress here with your career.</p>
    <div className="flex gap-1 overflow-x-auto mt-4 pb-1">{CONFEDERATIONS.map(item => <button key={item} onClick={() => setConfederation(item)} className={`px-2.5 py-2 rounded-md uppercase text-[10px] shrink-0 ${item === confederation ? 'bg-ks-gold text-ks-black' : 'bg-white/5 text-ks-muted'}`}>{item}</button>)}</div>
    <h3 className="font-display text-ks-gold text-sm mt-5">DOMESTIC LEAGUES</h3>
    {leagues.map(league => { const comp = world.competitions[league.id]; const rows = [...(world.standings[league.id] ?? [])].sort((a,b) => b.points-a.points || (b.goalsFor-b.goalsAgainst)-(a.goalsFor-a.goalsAgainst)); const leader = world.clubs[rows[0]?.clubId]; const open = selectedLeague === league.associationId; const second = world.competitions[`second-${league.associationId}`]; const lowerRows = [...(world.standings[second?.id] ?? [])].sort((a,b) => b.points-a.points || (b.goalsFor-b.goalsAgainst)-(a.goalsFor-a.goalsAgainst)); const titles = world.championHistory.filter(record => [league.id, second?.id, `third-${league.associationId}`, `fourth-${league.associationId}`, `cup-${league.associationId}`, `league-cup-${league.associationId}`].includes(record.competitionId)).slice(-12).reverse(); return <div key={league.id} className="py-2 border-b border-ks-border/35 text-xs"><button type="button" onClick={() => setSelectedLeague(open ? null : league.associationId)} className="w-full text-left"><div className="flex justify-between gap-2"><span>{league.associationName} {second ? '⌄' : ''}</span><span className="text-ks-muted">{comp?.seasonId ?? '—'}</span></div><p className="text-ks-gold mt-0.5">{leader?.name ?? 'Season pending'} · {rows[0]?.points ?? 0} pts</p></button>{open && <div className="mt-3 border-l-2 border-ks-gold/40 pl-3"><p className="text-ks-muted">Top flight · {comp?.entrantIds.length ?? 0} clubs · {comp?.format.scheduledRounds ?? 0} rounds</p>{second && <><p className="text-ks-gold mt-2">Second division · {second.entrantIds.length} clubs · {second.format.scheduledRounds} rounds</p><p className="text-ks-muted">Leader: {world.clubs[lowerRows[0]?.clubId]?.name ?? '—'} · {lowerRows[0]?.points ?? 0} pts · {LOWER_DIVISIONS[league.associationId]?.promoted ?? 0} promotion places</p></>}<FeederSummary world={world} associationId={league.associationId} /><PromotionSummary world={world} associationId={league.associationId} /><p className="text-ks-gold mt-3">TROPHY HISTORY</p>{titles.length ? titles.map(record => <p key={`${record.competitionId}-${record.seasonId}`} className="mt-1 text-ks-muted">{record.seasonId} · {proCompetitionName(record.competitionId)} · {world.clubs[record.championId]?.name ?? record.championId}</p>) : <p className="text-ks-muted mt-1">No completed editions yet.</p>}</div>}</div> })}
    <h3 className="font-display text-ks-gold text-sm mt-6">CUPS & NATIONAL TEAMS</h3>
    {competitions.slice(0, 12).map(comp => <div key={comp.id} className="flex justify-between gap-2 py-2 border-b border-ks-border/35 text-xs"><span>{proCompetitionName(comp.id)}</span><span className="text-ks-muted">{comp.entrantIds.length} entrants</span></div>)}
    <h3 className="font-display text-ks-gold text-sm mt-6">RECENT CHAMPIONS</h3>
    {champions.length ? champions.map(row => <div key={`${row.competitionId}:${row.seasonId}`} className="flex justify-between gap-2 py-2 border-b border-ks-border/35 text-xs"><span>{proCompetitionName(row.competitionId)}</span><span className="text-ks-gold">{world.clubs[row.championId]?.name ?? row.championId}</span></div>) : <p className="text-ks-muted text-xs mt-2">The first trophies will be awarded at the end of their competitions.</p>}
  </div>
}
