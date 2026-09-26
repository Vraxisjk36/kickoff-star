import TopScorers from '../../components/TopScorers'
import { useCareerStore } from '../../store/careerStore'
import { useState } from 'react'
import type { Division } from '../../engine/league'
import { divisionLabel, type LeagueWorld } from '../../engine/league'
import { academyDivisionLabel, type AcademyWorld } from '../../engine/academy'
import StandingsTable from '../../components/StandingsTable'
import { getRegion } from '../../engine/regions'

// P27 (Joel: "i dont see the other 2 divisions"): the table tab now shows the
// WHOLE pyramid — tap between divisions. Your own division opens by default
// and is marked; promotion/relegation zones render in every one, so you can
// see who's coming up beneath you and who you'd face above.
export default function TableTab({ world, playerTeamId, isAcademy }: {
  world: LeagueWorld | AcademyWorld
  playerTeamId: string
  isAcademy: boolean
}) {
  const player = useCareerStore(s => s.player)
  const isSchool = !isAcademy && 'kind' in world && world.kind === 'school'
  const tiers = isSchool ? [world.playerDivision] : Object.keys(world.divisions).map(Number).sort()
  const [tier, setTier] = useState<number>(world.playerDivision)
  const division = (world.divisions as Record<number, Division>)[tier]
  const sorted = [...division.standings].sort((a,b)=>b.points-a.points || (b.goalsFor-b.goalsAgainst)-(a.goalsFor-a.goalsAgainst))
  const playerStanding = tier===world.playerDivision ? sorted.find(s=>s.teamId===playerTeamId) : undefined
  const playerPos = playerStanding ? sorted.findIndex(s=>s.teamId===playerTeamId)+1 : 0
  const leader = sorted[0]

  return (
    <div className="flex flex-col gap-2.5">
      <section className="table-hero"><small>{isAcademy?'ACADEMY':isSchool?'SCHOOL FOOTBALL':'SUNDAY LEAGUE'} · COMPETITION CENTRE</small><h1>{isAcademy?academyDivisionLabel(tier as 1|2):isSchool?`${getRegion(player?.regionId)?.name ?? 'Local'} Schools League`:divisionLabel(tier as 1|2|3)}</h1><div className="table-story">{playerStanding?<><div><span>YOUR POSITION</span><b>{playerPos}</b></div><div><span>POINTS</span><b>{playerStanding.points}</b></div><div><span>LEADER</span><strong>{leader?.teamName??'—'}</strong></div><div><span>GAP</span><b>{Math.max(0,(leader?.points??0)-playerStanding.points)}</b></div></>:<><div><span>LEADER</span><strong>{leader?.teamName??'—'}</strong></div><div><span>POINTS</span><b>{leader?.points??0}</b></div></>}</div></section>

      {!isSchool && <div className="division-switcher flex gap-1.5">
        {tiers.map((t) => (
          <button
            key={t}
            onClick={() => setTier(t)}
            className={`flex-1 rounded-lg border py-2 font-display tracking-widest text-[10px] uppercase transition-all ${
              tier === t ? 'border-ks-gold bg-ks-gold/10 text-ks-gold' : 'border-ks-border bg-[#0f0f0d] text-ks-muted'
            }`}
          >
            {isAcademy ? (t === 1 ? 'U18 PL' : 'PDL') : `Div ${t}`}
            {t === world.playerDivision && <span className="ml-1 text-ks-gold">•</span>}
          </button>
        ))}
      </div>}

      <StandingsTable division={division} playerTeamId={tier === world.playerDivision ? playerTeamId : ''} isAcademy={isAcademy} hideZones={isSchool} />
      <p className="text-[10px] text-ks-muted leading-relaxed px-1">
        {isSchool
          ? 'represent your school across the local league, friendlies and School Cup. academy scouts follow standout performances.'
          : isAcademy
          ? 'top 3 of the development league earn promotion at the end of the season. no relegation in the academy.'
          : 'top 2 go up, bottom 2 go down — decided on the final matchday of the season.'}
      </p>
      {player && <TopScorers division={division} player={player} playerTeamId={playerTeamId} competitionId={isAcademy ? 'academyLeague' : isSchool ? 'schoolLeague' : 'sundayLeague'} />}
    </div>
  )
}
