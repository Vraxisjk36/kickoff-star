import { useState } from 'react'
import { NATIONS } from '../../engine/nations'
import { sortStandings, type Division } from '../../engine/league'
import type { WorldLeagues } from '../../engine/worldLeagues'
import { schoolRival } from '../../engine/friendlies'

export default function WorldLeaguesTab({ world, homeCountryId, homeDivision }: { world?: WorldLeagues; homeCountryId?: string; homeDivision?: Division | null }) {
  const [country, setCountry] = useState(homeCountryId ?? 'eng')
  const division = country === homeCountryId && homeDivision ? homeDivision : world?.divisions[country]
  const nation = NATIONS.find(entry => entry.id === country)
  const results = [...(division?.fixtures ?? [])].filter(fixture => fixture.played).sort((a, b) => b.week - a.week).slice(0, 5)
  const upcoming = [...(division?.fixtures ?? [])].filter(fixture => !fixture.played).sort((a, b) => a.week - b.week).slice(0, 5)
  const name = (id: string) => division?.teams.find(team => team.id === id)?.name ?? 'School'
  const scorers = new Map<string, { name: string; team: string; goals: number; assists: number; matches: number }>()
  for (const match of division?.matchRecords ?? []) for (const line of match.lines) {
    const current = scorers.get(line.playerId)
    scorers.set(line.playerId, { name: line.name, team: name(line.teamId), goals: (current?.goals ?? 0) + line.goals,
      assists: (current?.assists ?? 0) + line.assists, matches: (current?.matches ?? 0) + 1 })
  }
  const leaders = [...scorers.values()].sort((a, b) => b.goals - a.goals || b.assists - a.assists).slice(0, 5)
  return <section className="space-y-4">
    {world?.schoolRankings?.length ? <div className="rounded-2xl border border-ks-gold/50 bg-[#171407] p-4">
      <h2 className="font-display text-xl text-ks-gold">WORLD SCHOOL POWER TABLE</h2>
      <p className="text-xs text-ks-muted mb-2">Week {world.schoolRankings.at(-1)?.week} · results and goal difference · monthly movement</p>
      {world.schoolRankings.at(-1)?.rows.slice(0, 10).map((row, index) => <div key={row.teamId} className="flex justify-between gap-2 border-t border-ks-border/40 py-2 text-xs">
        <span className="min-w-0 truncate"><b className="text-ks-gold mr-2">{index + 1}</b>{row.name}<small className="block pl-5 text-ks-muted">{row.countryId.toUpperCase()} · {row.points} league pts · {row.previousRank ? `previously #${row.previousRank}` : 'new entry'}</small></span>
        <strong className="shrink-0">{row.score}</strong>
      </div>)}
    </div> : null}
    <div className="rounded-2xl border border-ks-border bg-[#151310] p-4">
      <p className="text-xs uppercase tracking-[.22em] text-ks-gold">World school football</p>
      <h2 className="font-display text-2xl uppercase">World league tracker</h2>
      <p className="text-sm text-ks-muted">Follow a featured school division in each country. Results and tables carry through the season.</p>
      <select aria-label="Country league" className="mt-4 w-full rounded-xl border border-ks-border bg-[#0b0b0b] p-3 text-white" value={country} onChange={event => setCountry(event.target.value)}>
        {NATIONS.map(entry => <option key={entry.id} value={entry.id}>{entry.flag} {entry.name}</option>)}
      </select>
    </div>
    {division ? <>
      {world?.rivalryRecords?.some(record => record.season === world.season && division.teams.some(team => team.id === record.homeTeamId)) && <div className="rounded-2xl border border-ks-gold/50 bg-[#171407] p-3">
        <h3 className="font-display text-ks-gold">ANNUAL SCHOOL RIVALRIES · WEEK 29</h3>
        {world.rivalryRecords.filter(record => record.season === world.season && division.teams.some(team => team.id === record.homeTeamId)).map(record => <p key={record.id} className="border-t border-ks-border/40 py-2 text-xs">{record.homeTeamName} <strong className="text-ks-gold">{record.homeGoals}–{record.awayGoals}</strong> {record.awayTeamName}</p>)}
      </div>}
      <div className="rounded-2xl border border-ks-border bg-[#121212] p-3">
        <h3 className="mb-3 font-display text-xl uppercase">{world?.leagueNames?.[country] ?? `${nation?.name} · Featured school division`}</h3>
        <div className="grid grid-cols-[1fr_2.3rem_2.3rem_2.3rem] gap-2 border-b border-ks-border pb-2 text-[10px] uppercase text-ks-muted"><span>School</span><span>P</span><span>GD</span><span>Pts</span></div>
        {sortStandings(division.standings).map((row, index) => <div key={row.teamId} className="grid grid-cols-[1fr_2.3rem_2.3rem_2.3rem] gap-2 border-b border-ks-border/40 py-2 text-xs">
          <span className="truncate"><span className="mr-2 text-ks-gold">{index + 1}</span>{row.teamName}{schoolRival(division, row.teamId) && <small className="block pl-5 text-ks-muted">Rival: {schoolRival(division, row.teamId)?.name}</small>}</span><span>{row.played}</span><span>{row.goalsFor - row.goalsAgainst}</span><strong>{row.points}</strong>
        </div>)}
      </div>
      <div className="rounded-2xl border border-ks-border bg-[#121212] p-3">
        <h3 className="mb-1 font-display uppercase text-ks-gold">Golden boot watch</h3>
        <p className="mb-2 text-xs text-ks-muted">Goals and assists from played matches in this division.</p>
        {leaders.map((line, index) => <div key={`${line.team}-${line.name}`} className="flex justify-between gap-3 border-t border-ks-border/40 py-2 text-xs">
          <span className="min-w-0 truncate"><b className="mr-2 text-ks-gold">{index + 1}</b>{line.name}<small className="block pl-5 text-ks-muted">{line.team} · {line.matches} matches</small></span>
          <strong className="shrink-0">{line.goals} G · {line.assists} A</strong>
        </div>)}
        {!leaders.length && <p className="text-sm text-ks-muted">The scoring race begins with the first league fixtures in week six.</p>}
      </div>
      {[["Recent results", results], ["Next fixtures", upcoming]] .map(([title, fixtures]) => <div key={title as string} className="rounded-2xl border border-ks-border bg-[#121212] p-3">
        <h3 className="mb-2 font-display uppercase text-ks-gold">{title as string}</h3>
        {(fixtures as typeof results).map(fixture => <div key={fixture.id} className="flex justify-between gap-2 border-t border-ks-border/40 py-2 text-xs">
          <span className="min-w-0 truncate">{name(fixture.homeTeamId)} · {name(fixture.awayTeamId)}</span><strong className="shrink-0">{fixture.played ? `${fixture.homeGoals}–${fixture.awayGoals}` : `W${fixture.week + 5}`}</strong>
        </div>)}
        {(fixtures as typeof results).length === 0 && <p className="text-sm text-ks-muted">No fixtures yet.</p>}
      </div>)}
    </> : <p className="p-4 text-ks-muted">This league begins with the next week of your career.</p>}
  </section>
}
