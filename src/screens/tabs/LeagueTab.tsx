import { useState } from 'react'
import type { Division, LeagueWorld } from '../../engine/league'
import type { AcademyWorld } from '../../engine/academy'
import type { CupWorlds } from '../../engine/save'
import FixturesTab from './FixturesTab'
import TableTab from './TableTab'
import CompetitionHub from './CompetitionHub'
import { useCareerStore } from '../../store/careerStore'

// V5 rebuild rule: the youth route is exclusive. This tab therefore renders
// the ONE authoritative league world supplied by WeeklyHub/Career. The old
// School + side-Sunday switch duplicated fixtures, tables and stats.
export default function LeagueTab({ division, playerTeamId, cups, world, isAcademy, initialView }: {
  division: Division
  playerTeamId: string
  cups?: CupWorlds
  world: LeagueWorld | AcademyWorld
  isAcademy: boolean
  initialView?: 'fixtures' | 'table'
}) {
  const player = useCareerStore((s) => s.player)
  const [view, setView] = useState<'hub' | 'fixtures' | 'table'>(initialView ?? 'hub')
  const route = !isAcademy && player?.youthRoute === 'grassroots' ? 'sunday' : undefined
  const views: ('hub' | 'fixtures' | 'table')[] = ['hub','fixtures','table']

  return (
    <div className="flex flex-col gap-2.5">
      <div className="rounded-xl border border-ks-border bg-[#0f0f0d] px-3 py-2">
        <div className="font-display tracking-widest text-[9px] uppercase text-ks-gold">
          {isAcademy ? 'academy competition' : player?.youthRoute === 'grassroots' ? 'grassroots football' : 'school football'}
        </div>
        <div className="text-[11px] text-ks-muted mt-0.5">Fixtures, results and the table below all come from this same competition.</div>
      </div>
      <div className="flex gap-1.5 p-1 rounded-xl bg-[#0f0f0d] border border-ks-border">
        {views.map(v => <button key={v} onClick={()=>setView(v)} className={`flex-1 rounded-lg py-2 font-display tracking-widest text-[10px] uppercase transition-all ${view===v?'bg-ks-gold text-ks-black shadow-[0_2px_10px_rgba(212,175,55,0.3)]':'text-ks-muted'}`}>{v}</button>)}
      </div>
      {view === 'hub' && player
        ? <CompetitionHub player={player} division={division} playerTeamId={playerTeamId} cups={cups} />
        : view === 'fixtures'
          ? <FixturesTab division={division} playerTeamId={playerTeamId} cups={cups} route={route} />
          : <TableTab world={world} playerTeamId={playerTeamId} isAcademy={isAcademy} />}
    </div>
  )
}
