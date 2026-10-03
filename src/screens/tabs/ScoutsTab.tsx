import { academyRecruitmentReport } from '../../engine/academyRecruitment'
import { useCareerStore } from '../../store/careerStore'
import type { Player } from '../../types/player'
import { reputationLabel } from '../../engine/scouting'
import { Panel, Bar, EmptyNote, Icon } from '../../components/ui'
import iconScouts from '../../assets/icons/scouts.png'

// Tiers come from scouting.ts TIER_PRESTIGE_RANGE: local | regional | national.
const TIER_STYLE: Record<string, string> = {
  local: 'text-ks-muted',
  regional: 'text-ks-gold',
  national: 'text-green-500',
}

const OFFER_THRESHOLD = 78 // matches checkForOffers() in scouting.ts

export default function ScoutsTab({ player, onOpenOffers }: { player: Player; onOpenOffers: () => void }) {
  const calendar = useCareerStore(s => s.calendar)
  const review = academyRecruitmentReport(player, calendar)
  const watchers = player.scoutWatchers ?? []
  const offers = player.contractOffers ?? []
  const isAcademy = player.careerClock.phase === 'academy'

  return (
    <div className="scouting-centre flex flex-col gap-2.5">
      <section className="scout-hero"><div className="scout-radar"/><small>RECRUITMENT NETWORK</small><h2>SCOUTING CENTRE</h2><p>{watchers.length ? `${watchers.length} club${watchers.length===1?'':'s'} tracking your progress` : 'Your performances build your market'}</p><div className="scout-rep"><span>REPUTATION</span><b>{Math.round(player.reputation ?? 5)}</b><i>{reputationLabel(player.reputation ?? 5)}</i></div></section>
      {!isAcademy && <Panel title="academy pathway"><p className="text-[11px] text-ks-ink">Scouting starts at 16. Invitations open each October, from your third year.</p><p className="text-[10px] text-ks-muted mt-2">Clubs review the previous two seasons and this year, then make repeated visits. A trial and scholarship talks follow a successful invitation.</p><p className="text-[10px] text-ks-gold mt-2">{review.appearances} matches reviewed · {review.average.toFixed(2)} average · {review.completedSeasons}/2 completed seasons with 10+ appearances</p><p className="text-[10px] text-ks-muted mt-2">{review.reasons[0] ?? 'Your record meets the October review standard. Individual clubs still need enough scouting visits and interest.'}</p></Panel>}
      {offers.length > 0 && (
        <button
          onClick={onOpenOffers}
          className="rounded-lg border border-ks-gold bg-ks-gold/10 px-3 py-2.5 flex items-center justify-between"
        >
          <span className="text-ks-gold text-sm font-display tracking-wide">
            {offers.length} offer{offers.length === 1 ? '' : 's'} on the table
          </span>
          <span className="text-ks-gold text-xs">review →</span>
        </button>
      )}

      <Panel title={<span className="flex items-center gap-1"><Icon src={iconScouts} />reputation</span>}>
        <div className="flex items-center gap-3 mb-2">
          <Bar value={player.reputation ?? 5} max={100} />
          <span className="text-[11px] text-ks-ink w-24 text-right">{reputationLabel(player.reputation ?? 5)}</span>
        </div>
        <EmptyNote>
          Reputation decides which <em>tier</em> of club can notice you — it doesn't guarantee interest.
          Every club forms its own opinion, and most will never scout you at all.
        </EmptyNote>
      </Panel>

      <div className="home-section-label"><span>CLUB INTEREST</span><i/></div>
      <Panel title={`clubs watching — ${watchers.length}`}>
        {watchers.length === 0 ? (
          <EmptyNote>{player.careerClock.ageYears < 16 ? 'Academy scouts begin watching at 16. Your school performances now build the record they will review later.' : 'No clubs watching yet. Keep building a consistent record.'}</EmptyNote>
        ) : (
          <div className="flex flex-col gap-2.5">
            {watchers.map((w) => (
              <div key={w.clubId ?? w.clubName} className="scout-club flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-ks-ink truncate">{w.clubName}</span>
                  <span className={`text-[9px] uppercase tracking-wider ${TIER_STYLE[w.tier] ?? 'text-ks-muted'}`}>
                    {w.tier}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Bar value={w.interest} max={100} />
                  <span className={`text-[9px] w-6 text-right ${w.interest >= OFFER_THRESHOLD ? 'text-green-500' : 'text-ks-muted'}`}>
                    {Math.round(w.interest)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        {watchers.length > 0 && (
          <p className="text-[10px] text-ks-muted mt-2.5 pt-2 border-t border-ks-border/40">
            {isAcademy ? `A club can offer a professional contract at 17 with interest of ${OFFER_THRESHOLD}.` : `Academy trials need ${OFFER_THRESHOLD} interest, at least 6 scouting visits in separate weeks, and a qualifying October review.`}
          </p>
        )}
      </Panel>

      <div className="home-section-label"><span>PATHWAY</span><i/></div>
      <Panel title="➡️ what happens next">
        <EmptyNote>
          {isAcademy
            ? 'You\'re in an academy now — offers from here are genuine professional contracts. Signing one ends your youth career and turns you pro.'
            : 'An academy invitation earns a trial. Pass it, then agree a scholarship before moving clubs. Invitations expire if you leave them unanswered.'}
        </EmptyNote>
      </Panel>
    </div>
  )
}
