import { sortStandings, type Division } from '../engine/league'

// Zone rules differ between the two worlds:
//   Grassroots (3 tiers): top 2 promoted (any tier below 1), bottom 2 relegated (any tier above 3).
//   Academy (2 tiers):    top 3 of the PDL promoted, NO relegation at all (see applyAcademyPromotion).
// The pre-Phase-10 Standings screen applied the Grassroots rules to both, which drew a
// phantom relegation zone in the Academy. Fixed here.
function zonesFor(tier: number, isAcademy: boolean): { promo: number; rel: number } {
  if (isAcademy) return { promo: tier === 2 ? 3 : 0, rel: 0 }
  return { promo: tier > 1 ? 2 : 0, rel: tier < 3 ? 2 : 0 }
}

export default function StandingsTable({ division, playerTeamId, isAcademy = false, hideZones = false }: {
  division: Division
  playerTeamId: string
  isAcademy?: boolean
  hideZones?: boolean
}) {
  const sorted = sortStandings(division.standings)
  const { promo, rel } = hideZones ? { promo: 0, rel: 0 } : zonesFor(division.tier, isAcademy)

  return (
    <>
      <div className="rounded-lg border border-ks-border bg-[#0f0f0d] overflow-hidden">
        <div className="grid grid-cols-[1.75rem_1fr_2rem_2rem_2rem] gap-1 px-3 py-2 text-[9px] text-ks-muted uppercase tracking-wider border-b border-ks-border/60">
          <span>#</span><span>team</span><span className="text-right">p</span><span className="text-right">gd</span><span className="text-right">pts</span>
        </div>
        {sorted.map((s, i) => {
          const isPlayer = s.teamId === playerTeamId
          const inPromo = promo > 0 && i < promo
          const inRel = rel > 0 && i >= sorted.length - rel
          const gd = s.goalsFor - s.goalsAgainst
          return (
            <div
              key={s.teamId}
              className={`grid grid-cols-[1.75rem_1fr_2rem_2rem_2rem] gap-1 px-3 py-2 text-[11px] items-center ${
                isPlayer ? 'bg-ks-gold/10' : ''
              } ${i < sorted.length - 1 ? 'border-b border-ks-border/30' : ''}`}
            >
              <span
                className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-display ${
                  inPromo ? 'bg-green-500/20 text-green-500' : inRel ? 'bg-red-500/20 text-red-500' : 'text-ks-muted'
                }`}
              >
                {i + 1}
              </span>
              <span className={`truncate ${isPlayer ? 'text-ks-gold font-display tracking-wide' : 'text-ks-ink'}`}>{s.teamName}</span>
              <span className="text-right text-ks-muted">{s.played}</span>
              <span className="text-right text-ks-muted">{gd > 0 ? '+' : ''}{gd}</span>
              <span className="text-right text-ks-ink font-display">{s.points}</span>
            </div>
          )
        })}
      </div>

      {(promo > 0 || rel > 0) && (
        <div className="flex items-center gap-4 text-[10px] text-ks-muted mt-2 px-1">
          {promo > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-green-500/70" />
              promotion {isAcademy ? '' : `(top ${promo})`}
            </span>
          )}
          {rel > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-500/70" />
              relegation (bottom {rel})
            </span>
          )}
        </div>
      )}
    </>
  )
}
