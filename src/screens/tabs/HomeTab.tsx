import type { Player } from '../../types/player'
import type { CalendarState } from '../../types/calendar'
import { watchRewardedAd, remainingToday } from '../../engine/ads'
import type { LeagueWorld, Division } from '../../engine/league'
import { sortStandings } from '../../engine/league'
import type { AcademyWorld } from '../../engine/academy'
import { computeCurrentAbility, toOvr } from '../../engine/rating'
import { Panel, Icon } from '../../components/ui'
import iconEnergy from '../../assets/icons/energy.png'
import iconWeek from '../../assets/icons/week.png'
import iconTeamSelection from '../../assets/icons/team_selection.png'
import iconGazette from '../../assets/icons/gazette.png'
import { EnergyMeter } from '../../components/EnergySheet'
import { bandSpec } from '../../engine/energy'
import type { HubTab } from '../../components/navItems'
import Avatar from '../../components/Avatar'
import { getNation } from '../../engine/nations'
import { arcProgressText, weeksLeft } from '../../engine/storylines'
import { itemById } from '../../engine/economy'
import { isLive, STAGE_LABEL } from '../../engine/negotiation'
import { decideSelection, selectionAdvice } from '../../engine/selection'
import { useCareerStore } from '../../store/careerStore'
import { monthForWeek,pathwayNextStep } from '../../engine/pathway'

function ordinal(n: number): string {
  return `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export default function HomeTab({ player, calendar, league, academyLeague, offerCount, onOpenOffers, onGoTo, onOpenEnergy, latestGazetteMasthead, onOpenGazette, onOpenInbox, onOpenYearCalendar }: {
  player: Player
  calendar: CalendarState
  league: LeagueWorld | null
  academyLeague: AcademyWorld | null
  offerCount: number
  onOpenOffers: () => void
  onGoTo: (tab: HubTab) => void
  onOpenEnergy: () => void
  latestGazetteMasthead: string | null
  onOpenGazette: () => void
  onOpenInbox: () => void
  onOpenYearCalendar: () => void
}) {
  const consumeItem = useCareerStore((s) => s.consumeItem)
  const restoreEnergyFromAd = useCareerStore((s) => s.restoreEnergyFromAd)
  const economyNote = useCareerStore((s) => s.economyNote)
  const negotiationBeat = useCareerStore((s) => s.negotiationBeat)
  const clearNegotiationBeat = useCareerStore((s) => s.clearNegotiationBeat)
  const selectionNote = useCareerStore((s) => s.selectionNote)
  const sundayOffer = player.contractOffers.find(o => o.kind === 'club' && o.weeklyWage !== undefined)
  const sundayDeal = player.sundayContract?.season === calendar.currentWeek.seasonYear ? player.sundayContract : undefined
  const acceptSundayRegistration=useCareerStore(s=>s.acceptSundayRegistration)
  const eventsByDay = Object.fromEntries(calendar.currentWeek.events.map((e) => [e.day, e]))
  const ovr = toOvr(computeCurrentAbility(player))
  const isAcademy = player.careerClock.phase === 'academy'
  const world = isAcademy ? academyLeague : league
  const inbox = player.inbox ?? []
  const unreadInbox = inbox.filter((item) => !item.read).length

  let leaguePos: string | null = null
  if (world) {
    const division = (world.divisions as Record<number, Division>)[world.playerDivision]
    const sorted = sortStandings(division.standings)
    const pos = sorted.findIndex((s) => s.teamId === world.playerTeamId) + 1
    leaguePos = pos > 0 ? ordinal(pos) : '—'
  }

  const nextEvent = DAYS.map((day) => eventsByDay[day]).find((e) => e && !e.resolved) ?? calendar.currentWeek.events.find((e) => !e.resolved) ?? calendar.currentWeek.events[0]
  return (
    <div className="career-home flex flex-col gap-2.5 stagger-children">
      <section className="career-hero">
        <div className="career-hero-glow"/>
        <div className="career-hero-top"><span>KICKOFF STAR · {monthForWeek(calendar.currentWeek.weekNumber).toUpperCase()}</span><b>WEEK {calendar.currentWeek.weekNumber}</b></div>
        <div className="career-player">
          <Avatar id={player.avatarId ?? 0} size={62} className="career-avatar" />
          <div className="min-w-0"><small>{player.careerClock.phase.toUpperCase()} · {player.position}</small><h1>{player.name}</h1><p>{getNation(player.nationality).flag} AGE {player.careerClock.ageYears} · {player.squadRole === 'starting-xi' ? 'STARTING XI' : (player.squadRole ?? 'SQUAD').toUpperCase()}</p></div>
          <div className="career-ovr"><strong>{ovr}</strong><span>OVR</span></div>
        </div>
        <div className="career-hero-strip">
          <div><span>ENERGY</span><b>{Math.round(player.fitness.stamina)}%</b></div>
          <div><span>FORM</span><b>{player.matchRatings?.length ? (player.matchRatings.slice(-6).reduce((a,b)=>a+b,0)/player.matchRatings.slice(-6).length).toFixed(1) : '—'}</b></div>
          <div><span>LEAGUE</span><b>{leaguePos ?? '—'}</b></div>
          <div><span>NEXT</span><b>{nextEvent?.type?.replace(/-/g,' ') ?? 'OPEN'}</b></div>
        </div>
      </section>
      {nextEvent && !nextEvent.resolved && (
        <section className={`week-headliner ${nextEvent.type === 'match' ? 'match' : ''}`}>
          <div><span>NEXT UP · {nextEvent.day.toUpperCase()}</span><h3>{nextEvent.title}</h3><p>{nextEvent.type === 'match' ? 'MATCHDAY · Your next competitive test' : nextEvent.type.replace(/-/g,' ').toUpperCase()}</p></div>
          <div className="week-headliner-arrow">→</div>
        </section>
      )}


      {player.careerClock.phase!=='academy'&&<button onClick={()=>onGoTo('fixtures')} className="pathway-headliner text-left"><div><span>{player.pathway?.ageGroup??'YOUTH'} PATHWAY</span><h3>{pathwayNextStep(player)}</h3><p>School → Regional XI → National schools → International</p></div><b>→</b></button>}

      {player.pathway?.sundayStatus==='squad-offer'&&sundayOffer&&<div className="sunday-offer-card"><div><span>COMMUNITY CLUB OFFER</span><b>{sundayOffer.clubName} · Division {sundayOffer.divisionTier}</b><p>£{sundayOffer.weeklyWage}/week for the season. School matches on Thursdays; club league matches on Sundays.</p></div><button onClick={acceptSundayRegistration}>accept place</button></div>}
      {sundayDeal && <button className="text-left text-xs text-ks-gold px-3 py-2 border border-ks-border rounded-lg" onClick={() => onGoTo('table')}>{sundayDeal.clubName} · Division {sundayDeal.division} · £{sundayDeal.weeklyWage}/week · season contract →</button>}
      <button onClick={onOpenInbox} className={`rounded-lg border px-3 py-2.5 flex items-center gap-3 text-left ${unreadInbox > 0 ? 'border-ks-gold/60 bg-ks-gold/10' : 'border-ks-border bg-[#0f0f0d]'}`}>
        <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm ${unreadInbox > 0 ? 'border-ks-gold text-ks-gold' : 'border-ks-border text-ks-muted'}`}>✉</div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-[11px] text-ks-ink tracking-wide">Career inbox</div>
          <div className="text-[9px] text-ks-muted truncate">{inbox.length > 0 ? inbox[inbox.length - 1].title : 'Announcements, selections and invitations'}</div>
        </div>
        <span className={`text-[10px] ${unreadInbox > 0 ? 'text-ks-gold' : 'text-ks-muted'}`}>{unreadInbox > 0 ? `${unreadInbox} new` : 'open'} →</span>
      </button>
      {offerCount > 0 && (
        <button
          onClick={onOpenOffers}
          className="rounded-lg border border-ks-gold bg-ks-gold/10 px-3 py-2.5 flex items-center justify-between animate-pulse"
        >
          <span className="text-ks-gold text-sm font-display tracking-wide">
            {offerCount} contract offer{offerCount === 1 ? '' : 's'} waiting
          </span>
          <span className="text-ks-gold text-xs">view →</span>
        </button>
      )}

      {/* a live contract negotiation is the biggest thing happening in your
          life — it belongs at the very top of the week, not buried in scouts */}
      {isLive(player.negotiation) && (
        <button
          onClick={onOpenOffers}
          className="rounded-lg border border-ks-gold bg-gradient-to-r from-ks-gold/15 to-ks-gold/5 px-3 py-2.5 text-left animate-[pulseglow_2.5s_ease-in-out_infinite]"
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className="font-display tracking-widest text-[10px] uppercase text-ks-gold">
              {player.negotiation!.clubName}
            </span>
            <span className="text-[9px] text-ks-muted uppercase tracking-wider">
              {STAGE_LABEL[player.negotiation!.stage]}
            </span>
          </div>
          <p className="text-[11px] text-ks-ink leading-snug">
            {player.negotiation!.awaitingPlayer ? 'They are waiting on your answer →' : 'Talks are ongoing →'}
          </p>
        </button>
      )}

      {negotiationBeat && (
        <button
          onClick={() => clearNegotiationBeat()}
          className="w-full text-left rounded-lg border border-ks-gold/30 bg-ks-gold/5 px-3 py-2 text-[11px] text-ks-gold animate-[coinpop_0.4s_ease-out] flex items-center justify-between gap-2"
        >
          <span>{negotiationBeat}</span>
          <span className="text-ks-muted shrink-0">✕</span>
        </button>
      )}

      {/* P31 — where you stand in the coach's thinking, and how to move up.
          Answers the question "how do I get in the starting eleven?", which
          previously had no visible answer anywhere in the game. */}
      {(() => {
        // P63 — real, confirmed bug: this used to show `decideSelection`'s
        // live, ungated verdict directly — what the coach WOULD decide
        // right now — completely bypassing the sticky-selection lock that
        // actually governs matches (see PlayerTab's Squad Status panel,
        // which does this correctly). Result: this panel could say
        // "Starting XI, 1st choice" while the player was genuinely benched
        // all game, because the real `player.squadRole` was still locked
        // from the last decision and hadn't caught up. Fixed to show the
        // real, locked role as the headline, matching what actually
        // happens on matchday — the live verdict still informs the pecking
        // order number and advice text, which is legitimately live context,
        // just not the thing that gets falsely promised as current reality.
        const v = decideSelection(player, player.squad)
        const actualRole = (player.squadRole ?? v.role) as typeof v.role
        const color = actualRole === 'starting-xi' ? 'text-green-500' : actualRole === 'bench' ? 'text-orange-400' : 'text-red-500'
        const SETTLE_WEEKS = 3
        const weeksSinceSet = (player.totalWeeksElapsed ?? 0) - (player.squadRoleSetWeek ?? 0)
        const weeksLeft = Math.max(0, SETTLE_WEEKS - weeksSinceSet)
        return (
          <div className="rounded-lg border border-ks-border bg-[#0f0f0d] px-3 py-2.5 relative overflow-hidden texture-turf">
            <div className="relative z-10">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-display tracking-widest text-[10px] text-ks-muted uppercase flex items-center gap-1"><Icon src={iconTeamSelection} />team selection</span>
              <span className={`text-[10px] uppercase tracking-wider ${color}`}>
                {actualRole === 'starting-xi' ? 'starting xi' : actualRole}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] text-ks-muted w-20 shrink-0">coach's view</span>
              <div className="flex-1 h-1.5 rounded-full bg-[#2a2a27] overflow-hidden">
                <div className={`h-full rounded-full ${v.score >= 65 ? 'bg-green-500' : v.score >= 45 ? 'bg-ks-gold' : 'bg-orange-500'}`} style={{ width: `${v.score}%` }} />
              </div>
              <span className="text-[10px] text-ks-ink w-16 text-right">
                {v.pecking}
                {v.pecking === 1 ? 'st' : v.pecking === 2 ? 'nd' : v.pecking === 3 ? 'rd' : 'th'} choice
              </span>
            </div>
            <p className="text-[10px] text-ks-muted leading-snug">
              {weeksLeft > 0
                ? `The coach won't reconsider the side for ${weeksLeft} more week${weeksLeft === 1 ? '' : 's'}. ${selectionAdvice(v, player)}`
                : selectionAdvice(v, player)}
            </p>
            </div>
          </div>
        )
      })()}

      {selectionNote && (
        <div className="rounded-lg border border-ks-gold/40 bg-ks-gold/10 px-3 py-2 text-[11px] text-ks-gold animate-[coinpop_0.4s_ease-out]">
          {selectionNote}
        </div>
      )}

      {economyNote && (
        <div className="rounded-lg border border-ks-gold/30 bg-ks-gold/5 px-3 py-2 text-[11px] text-ks-gold animate-[coinpop_0.4s_ease-out]">
          {economyNote}
        </div>
      )}

      {/* live storylines — a deadline you're carrying should never be buried */}
      {(player.activeArcs ?? []).map((arc) => (
        <button
          key={arc.id}
          onClick={() => onGoTo('people')}
          className="rounded-lg border border-ks-gold/35 bg-ks-gold/5 px-3 py-2.5 text-left"
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className="font-display tracking-wide text-ks-gold text-[11px] uppercase">{arc.title}</span>
            <span className="text-[9px] text-ks-muted uppercase tracking-wider">
              {weeksLeft(arc, player)}w left
            </span>
          </div>
          <p className="text-[11px] text-ks-ink leading-snug">{arc.brief}</p>
          <p className="text-[10px] text-ks-muted mt-0.5">{arcProgressText(arc, player)}</p>
        </button>
      ))}

      <button onClick={() => onGoTo('player')} className="home-player-link"><span>PLAYER PROFILE</span><b>View development, form & career record →</b></button>

      <div className="home-section-label"><span>THIS WEEK</span><i/></div>
      <button onClick={onOpenYearCalendar} className="w-full rounded-lg border border-ks-gold/40 bg-[#161308] px-3 py-3 flex items-center gap-3 text-left">
        <Icon src={iconWeek} /><div className="flex-1"><b className="block font-display text-xs text-ks-gold">YEAR CALENDAR</b><span className="text-[10px] text-ks-muted">January–December · fixtures, cups & selection windows</span></div><span className="text-ks-gold">→</span>
      </button>
      {/* Phase 25: the Gazette teaser — a fresh issue drops every week */}
      {latestGazetteMasthead && (
        <button
          onClick={onOpenGazette}
          className="gazette-feature text-left active:scale-[0.995] transition-transform"
        >
          <div className="flex items-center justify-between">
            <span className="font-display tracking-widest text-[9px] text-ks-gold uppercase flex items-center gap-1"><Icon src={iconGazette} />the gazette · this week</span>
            <span className="text-[9px] text-ks-muted">read →</span>
          </div>
          <div className="font-display text-sm text-white mt-1 leading-snug">{latestGazetteMasthead}</div>
        </button>
      )}

      <div className="home-section-label"><span>PLAYER MANAGEMENT</span><i/></div>
      {/* energy — now a real meter with an explainer, not a bare number */}
      <button
        onClick={onOpenEnergy}
        className="rounded-lg border border-ks-border bg-[#0f0f0d] px-3 py-2.5 text-left active:scale-[0.995] transition-transform"
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] text-ks-muted uppercase tracking-wider flex items-center gap-1">
            <Icon src={iconEnergy} />energy
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`text-[9px] uppercase tracking-wider ${bandSpec(player.fitness.stamina).colorClass}`}>
              {bandSpec(player.fitness.stamina).label}
            </span>
            <span className="text-[9px] text-ks-muted">what's this? →</span>
          </span>
        </div>
        <EnergyMeter stamina={player.fitness.stamina} showLabel={false} />
        {/* P29: energy is deliberately tight, so the fix is always one tap
            away when you're carrying a drink — no hunting through menus. */}
        {(() => {
          const drinks = Object.entries(player.consumables ?? {}).filter(([, n]) => n > 0)
          if (drinks.length === 0 || player.fitness.stamina >= 100) return null
          const [id, n] = drinks[0]
          return (
            <button
              onClick={() => consumeItem(id)}
              className="mt-2 w-full rounded-lg border border-ks-gold/40 bg-ks-gold/5 py-1.5 text-[10px] font-display uppercase tracking-widest text-ks-gold active:scale-[0.99]"
            >
              use {itemById(id)?.name ?? 'drink'} · {n} left
            </button>
          )
        })()}
        {/* P64 — free alternative for players without a drink (or who'd
            rather not spend one) — same 20% restore, paid for by watching
            a real rewarded ad instead of in-game money. */}
        {player.fitness.stamina < 100 && remainingToday('energy') > 0 && (
          <button
            onClick={async () => {
              const reward = await watchRewardedAd('energy')
              if (reward) restoreEnergyFromAd(20)
            }}
            className="mt-2 w-full rounded-lg border border-ks-border bg-[#0f0f0d] py-1.5 text-[10px] font-display uppercase tracking-widest text-ks-muted active:scale-[0.99]"
          >
            watch ad for +20% energy · {remainingToday('energy')} left today
          </button>
        )}
      </button>

      <div className="home-section-label"><span>SCHEDULE</span><i/></div>
      <Panel title={<span className="flex items-center gap-1"><Icon src={iconWeek} />week overview</span>}>
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map((day) => {
            const event = eventsByDay[day]
            const isMatch = event?.type === 'match'
            return (
              <div
                key={day}
                className={`rounded-md border px-1 py-1.5 text-center ${
                  event?.resolved ? 'border-green-500/30 bg-green-500/5' :
                  isMatch ? 'border-ks-gold bg-ks-gold/10' : event ? 'border-ks-border bg-[#161613]' : 'border-ks-border/30'
                }`}
              >
                <div className={`text-[8px] uppercase tracking-wider mb-0.5 ${
                  event?.resolved ? 'text-green-500/70' : isMatch ? 'text-ks-gold' : 'text-ks-muted'
                }`}>{day}</div>
                <div className={`text-[8px] leading-tight min-h-5 ${event?.resolved ? 'text-ks-muted line-through' : 'text-ks-ink'}`}>
                  {event ? (event.resolved ? '✓ ' : '') + event.title.split(' ').slice(0, 2).join(' ') : '·'}
                </div>
              </div>
            )
          })}
        </div>
      </Panel>

    </div>
  )
}
