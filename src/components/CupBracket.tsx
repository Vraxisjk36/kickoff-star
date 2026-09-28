import { knockoutRoundLabel, type CupWorld } from '../engine/cup'
import { sortStandings } from '../engine/league'

// P36 — the visual bracket the reference screenshots showed. The knockout DATA
// has existed since P19/P20 (knockoutRounds is already an array of rounds of
// fixtures); nothing here changes the cup engine, this only draws it. Your own
// path through the bracket is highlighted round by round so you can see how
// far you are from the final at a glance, the way the reference image did.

function TeamRow({ name, isPlayerTeam, goals, played, wonShootout }: { name: string; isPlayerTeam: boolean; goals: number | null; played: boolean; wonShootout?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-2 py-1.5 ${isPlayerTeam ? 'bg-ks-gold/10' : ''}`}>
      <span className={`text-[10px] truncate flex-1 ${isPlayerTeam ? 'text-ks-gold font-medium' : 'text-ks-ink'}`}>{name}{wonShootout ? ' · pens' : ''}</span>
      <span className={`text-[10px] tabular-nums ml-1 ${isPlayerTeam ? 'text-ks-gold' : 'text-ks-muted'}`}>
        {played && goals !== null ? goals : played ? '-' : ''}
      </span>
    </div>
  )
}

export default function CupBracket({ world, onClose, title = world.label }: { world: CupWorld; onClose: () => void; title?: string }) {
  const rounds = world.knockoutRounds

  return (
    <div className="fixed inset-0 z-50 bg-ks-black overflow-y-auto">
      <div className="sticky top-0 z-10 bg-ks-black/95 backdrop-blur-sm border-b border-ks-border px-4 py-3 flex items-center justify-between">
        <div>
          <div className="font-display tracking-widest text-[9px] text-ks-gold uppercase">{title}</div>
          <div className="text-[11px] text-ks-muted">
            {world.playerWonCup ? 'Champions' : world.playerEliminated ? 'Eliminated' : 'Bracket'}
          </div>
        </div>
        <button onClick={onClose} className="text-[10px] text-ks-muted uppercase tracking-wider px-3 py-1.5 border border-ks-border rounded-md">
          close
        </button>
      </div>

      <div className="cup-stage-hero"><div className="cup-orbit"><i/><i/><i/><b>★</b></div><small>{world.competitionId==='nationalChampionship'?`${world.teams.length} REGIONAL XIS · ONE NATIONAL CHAMPION`:world.competitionId==='schoolCup'?`${world.teams.length} SCHOOLS · REGIONAL STAGE`:world.competitionId==='academyChampionsCup'?`${world.teams.length} EUROPEAN CLUBS · 22 SENIOR PATH + 10 DOMESTIC PATH`:'KNOCKOUT FOOTBALL'}</small><h1>{title}</h1><p>{world.stage==='qualifying'?'Six midweek dates decide the knockout field.':world.stage==='group'?'Every point moves the live group table.':world.stage==='knockout'?`${knockoutRoundLabel(world)} · win to advance`:'Tournament complete.'}</p></div>
      {world.competitionId === 'academyChampionsCup' && <div className="mx-4 mt-4 rounded-xl border border-ks-border bg-ks-panel px-4 py-3 text-[11px] text-ks-muted">Your entry: <strong className="text-ks-gold">{world.continentalRoute === 'senior' ? 'senior club route' : 'domestic youth champion route'}</strong>. {world.stage === 'qualifying' ? `Midweek match ${world.qualifier?.round ?? 0}/6 · ${world.continentalRoute === 'senior' ? 'top 22 of 36 advance' : 'three home-and-away ties, 10 advance'}.` : 'The knockout bracket follows qualification.'}</div>}
      {world.stage === 'qualifying' && world.qualifier && <div className="mx-4 mt-3 rounded-xl border border-ks-border bg-ks-panel p-3 text-xs">
        <strong className="text-ks-gold uppercase">{world.continentalRoute === 'senior' ? 'League phase table' : 'Qualifying ties'}</strong>
        {world.continentalRoute === 'senior' ? [...world.qualifier.standings].sort((a,b) => b.points-a.points || (b.goalsFor-b.goalsAgainst)-(a.goalsFor-a.goalsAgainst)).slice(0,36).map((row,index) => <div key={row.teamId} className={`flex justify-between border-b border-ks-border/40 py-1 ${row.teamId === world.playerTeamId ? 'text-ks-gold' : ''}`}><span>{index+1}. {row.teamName}</span><span>{row.played}P · {row.points}pts</span></div>)
          : world.qualifier.rounds.flatMap((round, index) => round.filter(f => f.homeTeamId === world.playerTeamId || f.awayTeamId === world.playerTeamId).map(f => <div key={f.id} className="border-b border-ks-border/40 py-2">Leg {index + 1}: {world.teams.find(t => t.id === f.homeTeamId)?.name} {f.played ? `${f.homeGoals}–${f.awayGoals}` : 'vs'} {world.teams.find(t => t.id === f.awayTeamId)?.name}</div>))}
      </div>}
      {world.stage === 'knockout' && <div className="cup-round-progress" aria-label="Cup progress"><span>THE ROAD TO THE FINAL</span><strong>{knockoutRoundLabel(world)}</strong><div><i style={{ width: `${Math.min(100, Math.round((1 - (world.knockoutRounds[world.currentKnockoutRound - 1]?.length ?? 1) / Math.max(1, world.teams.length / 2)) * 100))}%` }} /></div></div>}
      {world.playerWonCup && (
        <div className="mx-4 mt-4 rounded-xl border border-ks-gold bg-ks-gold/10 px-4 py-3 text-center">
          <div className="text-2xl mb-1">🏆</div>
          <div className="font-display text-ks-gold text-sm tracking-wide">WINNERS</div>
        </div>
      )}

      <div className="px-3 py-4 flex flex-col gap-4">
        {world.groups.length>0&&<div className="cup-groups-grid">{world.groups.map((g,gi)=>{const table=sortStandings(world.groupStandings[g.groupId]??[]);return <div className="cup-group-card" key={g.groupId} style={{animationDelay:`${gi*90}ms`}}><div className="cup-group-title"><span>GROUP {String.fromCharCode(65+gi)}</span><b>TOP {world.qualifiersPerGroup??1} ADVANCE</b></div>{table.map((s,i)=><div className={`cup-group-row ${s.teamId===world.playerTeamId?'you':''}`} key={s.teamId}><i>{i+1}</i><span>{s.teamName}</span><small>{s.played}P</small><b>{s.points}</b></div>)}</div>})}</div>}
        {rounds.length === 0 && (
          <p className="text-[11px] text-ks-muted text-center py-4">The knockout draw appears when the group stage ends.</p>
        )}
        {rounds.map((roundFixtures, roundIndex) => {
          const isCurrentRound = roundIndex === world.currentKnockoutRound - 1
          return (
            <details key={roundIndex} className="cup-round" open={isCurrentRound ? true : undefined}>
              <summary className={`font-display tracking-widest uppercase px-1 ${isCurrentRound && !world.playerEliminated && world.stage !== 'complete' ? 'text-ks-gold' : 'text-ks-muted'}`}>
                {knockoutRoundLabel(world, roundIndex)}
                <span>{isCurrentRound && !world.playerEliminated && world.stage !== 'complete' ? 'This round' : `${roundFixtures.length} ties`}</span>
              </summary>
              <div className="cup-ties-grid">
                {roundFixtures.map((fx) => {
                  const involvesPlayer = fx.homeTeamId === world.playerTeamId || fx.awayTeamId === world.playerTeamId
                  const home = world.teams.find((t) => t.id === fx.homeTeamId)
                  const away = world.teams.find((t) => t.id === fx.awayTeamId)
                  return (
                    <div
                      key={fx.id}
                      className={`cup-tie ${involvesPlayer ? 'cup-tie-player' : ''} ${fx.homeTeamId === 'BYE' || fx.awayTeamId === 'BYE' ? 'opacity-50' : ''}`}
                    >
                      <TeamRow name={home?.name ?? (fx.homeTeamId === 'BYE' ? 'Bye' : '?')} isPlayerTeam={fx.homeTeamId === world.playerTeamId} goals={fx.homeGoals} played={fx.played} wonShootout={fx.homeGoals === fx.awayGoals && fx.winnerTeamId === fx.homeTeamId} />
                      <div className="h-px bg-ks-border" />
                      <TeamRow name={away?.name ?? (fx.awayTeamId === 'BYE' ? 'Bye' : '?')} isPlayerTeam={fx.awayTeamId === world.playerTeamId} goals={fx.awayGoals} played={fx.played} wonShootout={fx.homeGoals === fx.awayGoals && fx.winnerTeamId === fx.awayTeamId} />
                    </div>
                  )
                })}
              </div>
            </details>
          )
        })}
      </div>
    </div>
  )
}
