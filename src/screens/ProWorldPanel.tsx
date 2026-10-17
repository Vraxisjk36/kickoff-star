import { useState } from 'react'
import { proCompetitionName } from '../engine/proTournaments'
import type { ProWorldState } from '../engine/proWorld'
import { useTranslate } from '../i18n'

export default function ProWorldPanel({ world, clubId, nationalityId }: {
  world: ProWorldState; clubId: string; nationalityId: string
}) {
  const t = useTranslate()
  const club = world.clubs[clubId]
  const association = world.associations[club.associationId]
  const [scope, setScope] = useState<'my' | 'region' | 'world'>('my')
  const localOptions = Object.values(world.competitions).filter(competition =>
    competition.id === `top-${club.associationId}` || competition.associationId === club.associationId ||
    competition.id === `nations-${association.confederation}` ||
    competition.id === 'world-club' && competition.entrantIds.includes(clubId) ||
    competition.id === 'world-national' && competition.entrantIds.includes(nationalityId) ||
    competition.id === `national-${world.associations[nationalityId]?.confederation}` ||
    competition.kind === 'continental-club' && (competition.entrantIds.includes(clubId) ||
      world.recentEvents.some(event => event.details.competitionId === competition.id && event.subjectIds.includes(clubId))))
  const options = scope === 'my' ? localOptions : scope === 'region'
    ? Object.values(world.competitions).filter(item => item.associationId === club.associationId ||
      item.id.endsWith(`-${association.confederation}`))
    : Object.values(world.competitions)
  const [selected, setSelected] = useState(`top-${club.associationId}`)
  const competition = options.find(item => item.id === selected) ?? options[0]
  if (!competition) return null
  const fixtures = Object.values(world.fixtures).filter(fixture => fixture.competitionId === competition.id &&
    fixture.kickoffDate >= world.currentDate).sort((a, b) => a.kickoffDate.localeCompare(b.kickoffDate)).slice(0, 5)
  const rows = [...(world.standings[competition.id] ?? [])].sort((a, b) => b.points - a.points ||
    (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor)
  const groups = competition.tournament?.stage === 'groups' ? competition.tournament.groupByEntrant : undefined
  const displayRows = groups ? [...rows].sort((a, b) => groups[a.clubId] - groups[b.clubId] ||
    b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)) : rows
  const champion = world.championHistory.filter(record => record.competitionId === competition.id).at(-1)
  const name = (id: string) => world.clubs[id]?.name ?? world.associations[id]?.name ?? id
  return <section className="mt-7 rounded-2xl border border-ks-gold/35 p-4 sm:p-5 bg-white/[.025]">
    <div className="text-[10px] uppercase tracking-[.22em] text-ks-gold">{t('Football world')} · {association.name}</div>
    <h2 className="font-display text-xl mt-2">{proCompetitionName(competition.id)}</h2>
    <div className="grid grid-cols-3 gap-1 mt-4" role="group" aria-label={t('Browse world')}>
      {(['my', 'region', 'world'] as const).map(item => <button type="button" key={item} aria-pressed={scope === item}
        onClick={() => { setScope(item); setSelected(`top-${club.associationId}`) }}
        className={`min-h-10 rounded-lg border text-xs ${scope === item ? 'border-ks-gold text-ks-gold' : 'border-ks-border text-ks-muted'}`}>
        {item === 'my' ? t('My competitions') : item === 'region' ? t('My region') : t('All leagues')}
      </button>)}
    </div>
    <label htmlFor="pro-competition" className="block text-xs text-ks-muted mt-4">{t('Competition')}</label>
    <select id="pro-competition" value={competition.id} onChange={event => setSelected(event.target.value)}
      className="mt-1 w-full min-h-11 rounded-lg border border-ks-border bg-[#10110e] text-ks-ink px-3">
      {options.map(item => <option key={item.id} value={item.id}>{proCompetitionName(item.id)} · {item.seasonId}</option>)}
    </select>
    {champion && <p className="text-xs text-ks-gold mt-3">{t('Last champion')}: {name(champion.championId)} ({champion.seasonId})</p>}
    {competition.kind === 'league' || competition.tournament?.stage !== 'knockout' ?
      <div className="mt-4 max-h-64 overflow-y-auto" aria-label={t('Standings')}>
        {displayRows.map((row, index) => <div key={row.clubId} className={`grid grid-cols-[2.7rem_1fr_2rem_2rem] gap-1 py-2 border-b border-ks-border/60 text-xs ${row.clubId === clubId || row.clubId === nationalityId ? 'text-ks-gold' : 'text-ks-muted'}`}>
          <span>{groups ? `${String.fromCharCode(65 + groups[row.clubId])}${displayRows.slice(0, index).filter(previous => groups[previous.clubId] === groups[row.clubId]).length + 1}` : index + 1}</span><span className="truncate">{name(row.clubId)}</span><span>{row.played}</span><strong>{row.points}</strong>
        </div>)}
      </div> : null}
    <h3 className="font-display text-sm text-ks-gold mt-5">{t('Upcoming matches')}</h3>
    {fixtures.length ? fixtures.map(fixture => <p key={fixture.id} className="text-xs border-b border-ks-border/60 py-2 text-ks-muted">
      {fixture.kickoffDate} · {name(fixture.homeId)} – {name(fixture.awayId)}
    </p>) : <p className="text-xs text-ks-muted mt-2">{competition.tournament?.completed ? t('Season complete') : t('Next round is being drawn')}</p>}
  </section>
}
