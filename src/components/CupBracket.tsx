import type { CupWorld } from '../engine/cup'
import { sortStandings } from '../engine/league'

// P36 — the visual bracket the reference screenshots showed. The knockout DATA
// has existed since P19/P20 (knockoutRounds is already an array of rounds of
// fixtures); nothing here changes the cup engine, this only draws it. Your own
// path through the bracket is highlighted round by round so you can see how
// far you are from the final at a glance, the way the reference image did.

function roundLabel(roundsTotal: number, roundIndex: number): string {
  const remaining = roundsTotal - roundIndex // 0 = final
  if (remaining === 0) return 'Final'
  if (remaining === 1) return 'Semi Final'
  if (remaining === 2) return 'Quarter Final'
  return `Round of ${Math.pow(2, remaining + 1)}`
}

function TeamRow({ name, isPlayerTeam, goals, played }: { name: string; isPlayerTeam: boolean; goals: number | null; played: boolean }) {
  return (
    <div className={`flex items-center justify-between px-2 py-1.5 ${isPlayerTeam ? 'bg-ks-gold/10' : ''}`}>
      <span className={`text-[10px] truncate flex-1 ${isPlayerTeam ? 'text-ks-gold font-medium' : 'text-ks-ink'}`}>{name}</span>
      <span className={`text-[10px] tabular-nums ml-1 ${isPlayerTeam ? 'text-ks-gold' : 'text-ks-muted'}`}>
        {played && goals !== null ? goals : played ? '-' : ''}
      </span>
    </div>
  )
}

export default function CupBracket({ world, onClose }: { world: CupWorld; onClose: () => void }) {
  const rounds = world.knockoutRounds
  const roundsTotal = rounds.length

  return (
    <div className="fixed inset-0 z-50 bg-ks-black overflow-y-auto">
      <div className="sticky top-0 z-10 bg-ks-black/95 backdrop-blur-sm border-b border-ks-border px-4 py-3 flex items-center justify-between">
        <div>
          <div className="font-display tracking-widest text-[9px] text-ks-gold uppercase">{world.label}</div>
          <div className="text-[11px] text-ks-muted">
            {world.playerWonCup ? 'Champions' : world.playerEliminated ? 'Eliminated' : 'Bracket'}
          </div>
        </div>
        <button onClick={onClose} className="text-[10px] text-ks-muted uppercase tracking-wider px-3 py-1.5 border border-ks-border rounded-md">
          close
        </button>
      </div>

      <div className="cup-stage-hero"><div className="cup-orbit"><i/><i/><i/><b>★</b></div><small>{world.competitionId==='nationalChampionship'?`${world.teams.length} REGIONAL XIS · ONE NATIONAL CHAMPION`:world.competitionId==='schoolCup'?`${world.teams.length} SCHOOLS · REGIONAL STAGE`:world.competitionId==='academyChampionsCup'?'8 COUNTRIES · ONE ACADEMY CHAMPION':'KNOCKOUT FOOTBALL'}</small><h1>{world.label}</h1><p>{world.stage==='group'?'Every point moves the live group table.':world.stage==='knockout'?'One match. One route forward.':'Tournament complete.'}</p></div>
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
            <div key={roundIndex}>
              <div className={`font-display tracking-widest text-[9px] uppercase mb-1.5 px-1 ${isCurrentRound && !world.playerEliminated && world.stage !== 'complete' ? 'text-ks-gold' : 'text-ks-muted'}`}>
                {roundLabel(roundsTotal, roundIndex)}
                {isCurrentRound && !world.playerEliminated && world.stage !== 'complete' && ' — this round'}
              </div>
              <div className="flex flex-col gap-1.5">
                {roundFixtures.map((fx) => {
                  const involvesPlayer = fx.homeTeamId === world.playerTeamId || fx.awayTeamId === world.playerTeamId
                  const home = world.teams.find((t) => t.id === fx.homeTeamId)
                  const away = world.teams.find((t) => t.id === fx.awayTeamId)
                  return (
                    <div
                      key={fx.id}
                      className={`rounded-lg border overflow-hidden ${involvesPlayer ? 'border-ks-gold/50' : 'border-ks-border'} ${fx.homeTeamId === 'BYE' || fx.awayTeamId === 'BYE' ? 'opacity-50' : ''}`}
                    >
                      <TeamRow name={home?.name ?? (fx.homeTeamId === 'BYE' ? 'Bye' : '?')} isPlayerTeam={fx.homeTeamId === world.playerTeamId} goals={fx.homeGoals} played={fx.played} />
                      <div className="h-px bg-ks-border" />
                      <TeamRow name={away?.name ?? (fx.awayTeamId === 'BYE' ? 'Bye' : '?')} isPlayerTeam={fx.awayTeamId === world.playerTeamId} goals={fx.awayGoals} played={fx.played} />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
