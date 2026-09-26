import { useState } from 'react'
import type { Division, Fixture } from '../../engine/league'
import type { Team } from '../../engine/teams'
import type { CupWorlds } from '../../engine/save'
import { scheduleFor } from '../../engine/calendar'
import type { CupWorld } from '../../engine/cup'
import { knockoutRoundLabel, playerCupFixture } from '../../engine/cup'
import { Panel, TeamCrest, EmptyNote, Icon } from '../../components/ui'
import iconGlory from '../../assets/icons/glory.png'
import CupBracket from '../../components/CupBracket'
import { useCareerStore } from '../../store/careerStore'
import { getRegion } from '../../engine/regions'
import { friendlyOpponent } from '../../engine/friendlies'

// Fixture.week is a ROUND index from the round-robin generator, NOT a calendar
// week. P25 fix: rounds map to the LEAGUE's own scheduled weeks — the old code
// indexed into the union of every competition's weeks, so every label after
// the first cup week pointed at the wrong Saturday.
function calendarWeekFor(round:number,phase:'grassroots-trials'|'grassroots-season'|'academy',path:'school'|'sunday'):number|null {
  const weeks=[...(scheduleFor(phase,path).schoolLeague??[])].sort((a,b)=>a-b)
  return weeks[round - 1] ?? null
}

function cupStatusLine(world: CupWorld): { label: string; status: string; next: string | null } {
  if (world.playerWonCup) return { label: world.label, status: 'WINNERS', next: null }
  if (world.stage === 'complete') return { label: world.label, status: world.playerEliminated ? 'out' : 'finished', next: null }
  if (world.playerEliminated) return { label: world.label, status: 'eliminated', next: null }
  const fx = playerCupFixture(world)
  if (!fx) return { label: world.label, status: world.stage === 'group' ? 'group stage' : 'knockout', next: null }
  const isHome = fx.homeTeamId === world.playerTeamId
  const opp = world.teams.find((t) => t.id === (isHome ? fx.awayTeamId : fx.homeTeamId))
  const stageLabel = world.stage === 'group' ? `group r${fx.round}` : knockoutRoundLabel(world)
  return { label: world.label, status: stageLabel, next: opp ? `${isHome ? 'vs' : 'at'} ${opp.name}` : null }
}

type Row = {
  fixture: Fixture
  opponent: Team | undefined
  isHome: boolean
  result: 'W' | 'D' | 'L' | null
  scoreLine: string | null
}

function buildRows(division: Division, playerTeamId: string): Row[] {
  return division.fixtures
    .filter((f) => f.homeTeamId === playerTeamId || f.awayTeamId === playerTeamId)
    .sort((a, b) => a.week - b.week)
    .map((fixture) => {
      const isHome = fixture.homeTeamId === playerTeamId
      const opponentId = isHome ? fixture.awayTeamId : fixture.homeTeamId
      const opponent = division.teams.find((t) => t.id === opponentId)

      if (!fixture.played || fixture.homeGoals === null || fixture.awayGoals === null) {
        return { fixture, opponent, isHome, result: null, scoreLine: null }
      }
      const forGoals = isHome ? fixture.homeGoals : fixture.awayGoals
      const againstGoals = isHome ? fixture.awayGoals : fixture.homeGoals
      const result: 'W' | 'D' | 'L' = forGoals > againstGoals ? 'W' : forGoals === againstGoals ? 'D' : 'L'
      return { fixture, opponent, isHome, result, scoreLine: `${forGoals} - ${againstGoals}` }
    })
}

const RESULT_STYLE: Record<'W' | 'D' | 'L', string> = {
  W: 'bg-green-500/15 text-green-500 border-green-500/40',
  D: 'bg-ks-border/40 text-ks-muted border-ks-border',
  L: 'bg-red-500/15 text-red-500 border-red-500/40',
}

export default function FixturesTab({ division, playerTeamId, cups, route }: { division: Division; playerTeamId: string; cups?: CupWorlds; route?: 'school' | 'sunday' }) {
  const player=useCareerStore(s=>s.player);const phase=player?.careerClock.phase??'grassroots-season';const path=route??player?.grassrootsPath??'school'
  const regionName = getRegion(player?.regionId)?.name
  const cupName = (cup: CupWorld) => cup.competitionId === 'schoolCup' && regionName ? `${regionName} Schools Cup` : cup.label
  const rows = buildRows(division, playerTeamId)
  const activeCups = cups ? Object.values(cups).filter((c): c is CupWorld => c !== null) : []
  const [bracketFor, setBracketFor] = useState<CupWorld | null>(null)
  const calendar = useCareerStore(s => s.calendar)
  const season = calendar?.currentWeek.seasonYear ?? 1
  const currentWeek = calendar?.currentWeek.weekNumber ?? 4
  const leagueRows = rows.map(r => ({ id:r.fixture.id, week:calendarWeekFor(r.fixture.week,phase,path) ?? r.fixture.week, opponent:r.opponent, name:r.opponent?.name ?? 'TBD', isHome:r.isHome, result:r.result, scoreLine:r.scoreLine, friendly:false }))
  const friendlyRows = path === 'school' && phase !== 'academy' ? (scheduleFor(phase,path).schoolFriendlies ?? []).flatMap(week => {
    const saved = player?.friendlyResults?.find(f => f.season === season && f.week === week)
    if (!saved && week < currentWeek) return []
    const opponent = friendlyOpponent(division, playerTeamId, week, season)
    const goalsFor = saved?.goalsFor, goalsAgainst = saved?.goalsAgainst
    const result: 'W' | 'D' | 'L' | null = goalsFor === undefined || goalsAgainst === undefined ? null : goalsFor > goalsAgainst ? 'W' : goalsFor === goalsAgainst ? 'D' : 'L'
    return [{ id:`friendly-${season}-${week}`, week, opponent, name:saved?.opponentName ?? opponent?.name ?? 'Friendly opponent', isHome:saved?.isHome ?? week % 2 === 0, result, scoreLine:result ? `${goalsFor} - ${goalsAgainst}` : null, friendly:true }]
  }) : []
  // Older saves did not retain friendly fixtures. Recover their most recent
  // preseason result from the player's last match when week 6 opens.
  const legacy = path === 'school' && currentWeek >= 6 && currentWeek <= 7 && !player?.friendlyResults?.length &&
    !leagueRows.some(r => r.result) && player?.lastMatchResult && (player.seasonAppearances ?? 0) > 0
    ? player.lastMatchResult : null
  const legacyResult: 'W' | 'D' | 'L' | null = legacy ? legacy.playerScore > legacy.opponentScore ? 'W' : legacy.playerScore === legacy.opponentScore ? 'D' : 'L' : null
  const legacyRows = legacy && legacyResult ? [{ id:'legacy-friendly', week:5, opponent:undefined, name:legacy.opponentName, isHome:false, result:legacyResult, scoreLine:`${legacy.playerScore} - ${legacy.opponentScore}`, friendly:true }] : []
  const allRows = [...leagueRows, ...friendlyRows, ...legacyRows].sort((a,b) => a.week - b.week)
  const played = allRows.filter(r => r.result !== null)
  const upcoming = allRows.filter(r => r.result === null)
  const form = played.slice(-5).map(r => r.result!)
  const next = upcoming[0]

  return (
    <div className="fixtures-centre flex flex-col gap-2.5">
      <section className="fixtures-hero"><small>SEASON CENTRE</small><h2>{phase === 'academy' ? 'Academy League' : path === 'school' ? `${regionName ?? 'Local'} Schools League` : 'Sunday League'}</h2><p>Fixtures & results · {phase === 'academy' ? 'Saturdays' : path === 'school' ? 'school matchdays' : 'Sundays'}</p>{next?<div className="next-fixture"><div><span>NEXT MATCH</span><b>{`WEEK ${next.week}`}</b></div><div className="next-opponent">{next.opponent&&<TeamCrest primary={next.opponent.primaryColor} secondary={next.opponent.secondaryColor} short={next.opponent.short}/>}<strong>{next.name}</strong><i>{next.friendly ? 'FRIENDLY' : next.isHome ? 'HOME' : 'AWAY'}</i></div></div>:<p>Season schedule complete.</p>}</section>
      <div className="home-section-label"><span>RECENT FORM</span><i/></div>
      <Panel title="📈 form">
        {form.length === 0 ? (
          <EmptyNote>No results yet this season.</EmptyNote>
        ) : (
          <div className="flex items-center gap-1.5">
            {form.map((r, i) => (
              <div
                key={i}
                className={`w-7 h-7 rounded-md border flex items-center justify-center font-display text-[11px] ${RESULT_STYLE[r]}`}
              >
                {r}
              </div>
            ))}
            <span className="text-[10px] text-ks-muted ml-2">last {form.length}</span>
          </div>
        )}
      </Panel>

      <div className="home-section-label"><span>COMPETITIONS</span><i/></div>
      {activeCups.length > 0 && (
        <Panel title={<span className="flex items-center gap-1"><Icon src={iconGlory} />cup competitions</span>}>
          <div className="flex flex-col gap-2">
            {activeCups.map((c) => {
              const line = cupStatusLine(c)
              const hasBracket = c.knockoutRounds.length > 0
              return (
                <button
                  key={c.competitionId}
                  onClick={() => hasBracket && setBracketFor(c)}
                  disabled={!hasBracket}
                  className="flex items-center gap-2.5 text-left disabled:opacity-70"
                >
                  <span className="text-[11px] text-ks-ink flex-1 truncate">{cupName(c)}</span>
                  {line.next && <span className="text-[10px] text-ks-muted truncate max-w-[10rem]">{line.next}</span>}
                  <span className={`text-[9px] uppercase tracking-wider ${line.status === 'WINNERS' ? 'text-ks-gold' : line.status === 'eliminated' || line.status === 'out' ? 'text-red-500' : 'text-ks-muted'}`}>{line.status}</span>
                  {hasBracket && <span className="text-ks-muted text-[10px]">›</span>}
                </button>
              )
            })}
          </div>
        </Panel>
      )}

      {bracketFor && <CupBracket world={bracketFor} title={cupName(bracketFor)} onClose={() => setBracketFor(null)} />}

      <div className="home-section-label"><span>SCHEDULE</span><i/></div><Panel title={`upcoming — ${upcoming.length}`}>
        {upcoming.length === 0 ? (
          <EmptyNote>Season complete — no fixtures remaining.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-2">
            {upcoming.map((r) => (
              <div key={r.id} className="fixture-row flex items-center gap-2.5">
                <span className="text-[9px] text-ks-muted w-8 shrink-0">
                  {`wk ${r.week}`}
                </span>
                {r.opponent && (
                  <TeamCrest primary={r.opponent.primaryColor} secondary={r.opponent.secondaryColor} short={r.opponent.short} size="sm" />
                )}
                <span className="text-[11px] text-ks-ink flex-1 truncate">{r.name}</span>
                <span className="text-[9px] text-ks-muted uppercase tracking-wider">{r.friendly ? 'friendly' : r.isHome ? 'home' : 'away'}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title={`results — ${played.length}`}>
        {played.length === 0 ? (
          <EmptyNote>Your played matches will appear here.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-2">
            {[...played].reverse().map((r) => (
              <div key={r.id} className="flex items-center gap-2.5">
                <span className="text-[9px] text-ks-muted w-8 shrink-0">
                  {`wk ${r.week}`}
                </span>
                {r.opponent && (
                  <TeamCrest primary={r.opponent.primaryColor} secondary={r.opponent.secondaryColor} short={r.opponent.short} size="sm" />
                )}
                <span className="text-[11px] text-ks-ink flex-1 truncate">{r.name}</span>
                <span className="text-[11px] text-ks-ink font-display">{r.scoreLine}</span>{r.friendly && <span className="text-[8px] text-ks-gold">FR</span>}
                <div className={`w-5 h-5 rounded border flex items-center justify-center font-display text-[9px] ${RESULT_STYLE[r.result!]}`}>
                  {r.result}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
