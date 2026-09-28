import { useState } from 'react'
import type { Division, LeagueWorld } from '../../engine/league'
import type { AcademyWorld } from '../../engine/academy'
import type { CupWorlds } from '../../engine/save'
import FixturesTab from './FixturesTab'
import TableTab from './TableTab'
import CompetitionHub from './CompetitionHub'
import { useCareerStore } from '../../store/careerStore'
import WorldLeaguesTab from './WorldLeaguesTab'

export default function LeagueTab({ division, playerTeamId, cups, world, isAcademy, initialView }: {
  division: Division
  playerTeamId: string
  cups?: CupWorlds
  world: LeagueWorld | AcademyWorld
  isAcademy: boolean
  initialView?: 'fixtures' | 'table'
}) {
  const player = useCareerStore(s => s.player)
  const [view, setView] = useState<'hub' | 'fixtures' | 'table' | 'world'>(initialView ?? 'hub')
  return <div className="league-centre flex flex-col gap-2.5">
    <div className="flex gap-1.5 p-1 rounded-xl bg-[#0f0d0d] border border-ks-border">
      {(['hub', 'fixtures', 'table', 'world'] as const).map(v => <button key={v} onClick={() => setView(v)}
        className={`flex-1 rounded-lg py-2 font-display tracking-widest text-[10px] uppercase transition-all ${view === v ? 'bg-ks-gold text-ks-black' : 'text-ks-muted'}`}>{v}</button>)}
    </div>
    {view === 'hub' && player ? <CompetitionHub player={player} division={division} playerTeamId={playerTeamId} cups={cups} />
      : view === 'fixtures' ? <FixturesTab division={division} playerTeamId={playerTeamId} cups={cups} />
      : view === 'world' ? <WorldLeaguesTab world={player?.worldLeagues} homeCountryId={player?.regionId?.split('-')[0]} homeDivision={!isAcademy ? division : null} />
      : <TableTab world={world} playerTeamId={playerTeamId} isAcademy={isAcademy} />}
  </div>
}
