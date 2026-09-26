import { useState } from 'react'
import type { Division, LeagueWorld } from '../../engine/league'
import type { AcademyWorld } from '../../engine/academy'
import type { CupWorlds } from '../../engine/save'
import FixturesTab from './FixturesTab'
import TableTab from './TableTab'
import CompetitionHub from './CompetitionHub'
import { useCareerStore } from '../../store/careerStore'

// P29: fixtures and the table were separate nav tabs, which pushed the bottom
// bar to seven items and wrapped it onto two rows. They answer the same
// question ("where are we in this competition"), so they're one tab now with a
// segmented control.
export default function LeagueTab({ division, playerTeamId, cups, world, isAcademy, initialView }: {
  division: Division
  playerTeamId: string
  cups?: CupWorlds
  world: LeagueWorld | AcademyWorld
  isAcademy: boolean
  initialView?: 'fixtures' | 'table'
}) {
  const player = useCareerStore((s) => s.player)
  const [competition, setCompetition] = useState<'school' | 'sunday'>('school')
  const [view, setView] = useState<'hub' | 'fixtures' | 'table'>(initialView ?? 'hub')

  const canSwitch = !isAcademy && player?.grassrootsPath === 'school'
  const sundaySelected = canSwitch && competition === 'sunday'
  const selectedWorld = sundaySelected ? player?.sundayLeague : world
  const selectedDivision = selectedWorld?.divisions[selectedWorld.playerDivision as keyof typeof selectedWorld.divisions] ?? division
  const selectedTeamId = selectedWorld?.playerTeamId ?? playerTeamId
  const selectedCups = sundaySelected ? undefined : cups
  const views: ('hub' | 'fixtures' | 'table')[] = sundaySelected ? ['fixtures', 'table'] : ['hub', 'fixtures', 'table']
  return (
    <div className="flex flex-col gap-2.5">
      {canSwitch && <div className="flex gap-1.5" aria-label="Choose competition">{(['school', 'sunday'] as const).map(id => <button key={id} aria-pressed={competition === id} onClick={() => { setCompetition(id); if (id === 'sunday' && view === 'hub') setView('table') }} className={`flex-1 rounded-lg border px-3 py-2 text-xs ${competition === id ? 'border-ks-gold text-ks-gold bg-ks-gold/10' : 'border-ks-border text-ks-muted'}`}>{id === 'school' ? 'School football' : 'Sunday league'}</button>)}</div>}
      {sundaySelected && selectedWorld && !player?.sundayContract && <p className="text-[10px] text-ks-muted">Prospective Sunday club — sign a season contract before playing.</p>}
      <div className="flex gap-1.5 p-1 rounded-xl bg-[#0f0f0d] border border-ks-border">
        {views.map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 rounded-lg py-2 font-display tracking-widest text-[10px] uppercase transition-all ${
              view === v ? 'bg-ks-gold text-ks-black shadow-[0_2px_10px_rgba(212,175,55,0.3)]' : 'text-ks-muted'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {!selectedWorld ? <p className="text-xs text-ks-muted p-4">No Sunday club has approached you yet. Build a consistent school record to earn a named club invitation.</p> : view === 'hub' && player && !sundaySelected
        ? <CompetitionHub player={player} division={selectedDivision} playerTeamId={selectedTeamId} cups={selectedCups} />
        : view === 'fixtures'
        ? <FixturesTab division={selectedDivision} playerTeamId={selectedTeamId} cups={selectedCups} route={sundaySelected ? 'sunday' : undefined} />
        : <TableTab key={competition} world={selectedWorld} playerTeamId={selectedTeamId} isAcademy={isAcademy} />}
    </div>
  )
}
