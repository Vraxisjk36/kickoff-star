import { useState } from 'react'
import type { Player } from '../../types/player'
import { objectiveProgress, completedSeasonObjectives } from '../../engine/seasonObjectives'
import { computeCurrentAbility, toOvr } from '../../engine/rating'
import { trustLabel, trustEmoji, generateNotebookEntry, notebookTone } from '../../engine/coachTrust'
import { Panel, Bar, TickBar, VerticalBarChart, RadarChart, StatRow, EmptyNote, Section, Icon } from '../../components/ui'
import iconShape from '../../assets/icons/shape.png'
import iconScouts from '../../assets/icons/scouts.png'
import iconMedical from '../../assets/icons/medical.png'
import iconGlory from '../../assets/icons/glory.png'
import iconCoachNotebook from '../../assets/icons/coach_notebook.png'
import { decideSelection, promotionEvidence, selectionAdvice } from '../../engine/selection'
import AchievementList from '../../components/AchievementList'
import GloryCabinet from '../../components/GloryCabinet'
import Avatar from '../../components/Avatar'
import { getNation } from '../../engine/nations'
import { getArchetype } from '../../engine/archetypes'
import ScoutsTab from './ScoutsTab'

// P27 restructure (Joel: 'one long ass scroll'): identity header + attributes
// stay always-visible; everything else collapses behind section buttons.
// P54 — Section itself moved to components/ui.tsx so HomeTab can share it.

const GROUPS: { title: string; attrs: string[] }[] = [
  { title: 'technical', attrs: ['passing', 'shooting', 'dribbling', 'tackling'] },
  { title: 'physical', attrs: ['pace', 'strength', 'stamina', 'agility'] },
  { title: 'mental', attrs: ['vision', 'composure', 'positioning', 'concentration'] },
]

const GK_GROUP: { title: string; attrs: string[] }[] = [
  { title: 'goalkeeping', attrs: ['reflexes', 'handling', 'gkPositioning', 'distribution'] },
]

const ATTR_LABELS: Record<string, string> = { gkPositioning: 'positioning' }

function ratingColor(r: number): string {
  if (r >= 7.5) return 'text-green-500'
  if (r >= 6.5) return 'text-ks-gold'
  if (r >= 5.5) return 'text-ks-ink'
  return 'text-orange-500'
}

export default function PlayerTab({ player, onOpenOffers }: { player: Player; onOpenOffers?: () => void }) {
  const [view, setView] = useState<'overview' | 'development' | 'career'>('overview')
  const c = player.career
  const values = player.attributes.values as Record<string, number>
  const isGk = player.attributes.kind === 'goalkeeper'
  const groups = isGk ? GK_GROUP : GROUPS
  const ovr = toOvr(computeCurrentAbility(player))
  const ratings = player.matchRatings ?? []
  const recent = ratings.slice(-6)
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
  const notebook = generateNotebookEntry(player, player.coachTrust ?? 0)
  const tone = notebookTone(player.coachTrust ?? 0)

  return (
    <div className="flex flex-col gap-2.5">
      <div className="player-card-v2">
        <div className="player-card-number">{player.position}</div>
        <div className="player-card-beam"/>
        <Avatar id={player.avatarId ?? 0} size={72} className="relative z-10 shrink-0 player-card-avatar" />
        <div className="flex-1 min-w-0 relative z-10">
          <div className="font-display tracking-wide text-ks-ink text-base leading-tight truncate">
            {getNation(player.nationality).flag} {player.name}
          </div>
          <div className="text-[10px] text-ks-muted mb-1">
            {player.position} &middot; age {player.careerClock.ageYears} &middot; {player.heightCm}cm &middot; {player.preferredFoot} foot
          </div>
          {getArchetype(player.archetype) && (
            <div className="text-[9px] text-ks-gold uppercase tracking-widest mb-1.5">{getArchetype(player.archetype)!.label}</div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-ks-muted uppercase tracking-wider">potential</span>
            <TickBar value={player.potential} />
            <span className="font-display text-green-500 text-xs">{player.potential}</span>
          </div>
        </div>
        <div className="player-card-ovr"><strong>{ovr}</strong><span>OVERALL</span></div>
      </div>

      <div className="player-quick-strip"><div><span>APPS</span><b>{c?.appearances ?? 0}</b></div><div><span>GOALS</span><b>{c?.goals ?? 0}</b></div><div><span>ASSISTS</span><b>{c?.assists ?? 0}</b></div><div><span>BEST</span><b>{c?.bestRating?.toFixed(1) ?? '—'}</b></div></div>
      <nav className="player-view-switch" aria-label="Player details">{(['overview','development','career'] as const).map(tab => <button key={tab} aria-pressed={view === tab} onClick={() => setView(tab)}>{tab}</button>)}</nav>
      {view === 'overview' && <>
      {/* P50 — the coach's verdict used to only ever surface as a one-time
          weekly note that scrolled away. Now it's always visible: where you
          actually stand, and how long until it can change — the real
          substance behind the "sticky" selection system. */}
      {player.squadRole && player.squadRole !== 'released' && (() => {
        const verdict = decideSelection(player, player.squad)
        const evidence = promotionEvidence(player)
        const SETTLE_WEEKS = 3
        const weeksSinceSet = (player.totalWeeksElapsed ?? 0) - (player.squadRoleSetWeek ?? 0)
        const weeksLeft = Math.max(0, SETTLE_WEEKS - weeksSinceSet)
        const roleLabel = player.squadRole === 'starting-xi' ? 'Starting XI' : player.squadRole === 'bench' ? 'Bench' : 'Reserves'
        return (
          <Panel title="🎽 squad status">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[13px] text-ks-ink font-display tracking-wide">{roleLabel}</span>
              <span className="text-[11px] text-ks-muted">{verdict.pecking} of {verdict.competing} for your position</span>
            </div>
            <p className="text-[11px] text-ks-muted leading-relaxed">
              {player.squadRole !== 'starting-xi' && !evidence.ready
                ? selectionAdvice(verdict, player)
                : weeksLeft > 0
                ? `The coach reviews the side in ${weeksLeft} week${weeksLeft === 1 ? '' : 's'}.`
                : verdict.changed ? 'Your performances have earned a selection review.' : 'Keep performing to move up.'}
            </p>
          </Panel>
        )
      })()}

      {player.captaincy && player.captaincy.role !== 'none' && (
        <Panel title="© leadership">
          <div className="flex items-center justify-between mb-2">
            <span className="font-display text-ks-gold tracking-wide">{player.captaincy.role === 'captain' ? 'Club Captain' : 'Vice-Captain'}</span>
            <span className="text-[10px] text-ks-muted">appointed week {player.captaincy.appointedWeek ?? '—'}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <StatRow label="matches as captain" value={player.captaincy.matchesAsCaptain} />
            <StatRow label="matches as vice-captain" value={player.captaincy.matchesAsViceCaptain} />
          </div>
          <p className="text-[10px] text-ks-muted leading-relaxed mt-2">Leadership is earned through trust, consistency, standing and time in the side.</p>
        </Panel>
      )}
      </>}

      {/* P60 — reference: a radar/hexagon chart showing the player's
          attribute "shape" at a glance, alongside (not replacing) the bars. */}
      {view === 'development' && <><div className="development-card"><div className="development-title"><span><Icon src={iconShape} /> PLAYER DNA</span><b>OVR {ovr}</b></div><div className="development-radar"><RadarChart
          points={groups.flatMap((g) => g.attrs.slice(0, isGk ? 4 : 2)).map((attr) => ({
            label: ATTR_LABELS[attr] ?? attr,
            value: values[attr] ?? 0,
          }))}
        /></div><div className="development-meta"><span>{getArchetype(player.archetype)?.label ?? player.position}</span><i>Potential {player.potential}</i></div></div>

      {groups.map((group) =>
        group.title === 'physical' || group.title === 'mental' ? null : (
          <Panel key={group.title} title={group.title}>
            <div className="flex flex-col gap-1.5">
              {group.attrs.map((attr) => (
                <div key={attr} className="flex items-center gap-2">
                  <span className="text-[10px] text-ks-muted capitalize w-20 truncate">{ATTR_LABELS[attr] ?? attr}</span>
                  <Bar value={values[attr] ?? 0} />
                  <span className="text-[10px] text-ks-ink w-4 text-right">{Math.round(values[attr] ?? 0)}</span>
                </div>
              ))}
            </div>
          </Panel>
        )
      )}
      {!isGk && (
        <div className="flex gap-2.5">
          {groups.filter((g) => g.title === 'physical' || g.title === 'mental').map((group) => (
            <div key={group.title} className="flex-1 rounded-lg border border-ks-border bg-[#0f0f0d] px-3 py-3">
              <div className="font-display tracking-widest text-[10px] text-ks-muted uppercase mb-1">{group.title}</div>
              <VerticalBarChart attrs={group.attrs} values={values} labels={ATTR_LABELS} />
            </div>
          ))}
        </div>
      )}

      </>}
      {view === 'overview' && <><Section title="📈 form & season" defaultOpen>
        {recent.length === 0 ? (
          <EmptyNote>No matches played yet. Your recent ratings will show here.</EmptyNote>
        ) : (
          <>
            <div className="form-track mb-3">{recent.map((r,i)=><div key={i} className="form-match"><span className={ratingColor(r)}>{r.toFixed(1)}</span><i style={{height:`${Math.max(14,(r-4)*18)}px`}}/><small>M{i+1}</small></div>)}</div>
            <div className="flex flex-col gap-1.5">
              <StatRow label="matches played" value={ratings.length} />
              <StatRow label="average rating" value={avg ? avg.toFixed(2) : '—'} />
              <StatRow label="season goals" value={player.seasonGoals ?? 0} />
              <StatRow label="season assists" value={player.seasonAssists ?? 0} />
            </div>
          </>
        )}
      </Section>

      {player.seasonObjectives && <Section title="🎯 coach's season goals" defaultOpen>
        <p className="text-[11px] text-ks-muted mb-3">{completedSeasonObjectives(player.seasonObjectives, player)} of 4 reached. The coach reviews these at season's end; missing one never automatically changes your squad role.</p>
        <div className="flex flex-col gap-2">
          {player.seasonObjectives.objectives.map(objective => {
            const progress = objectiveProgress(player.seasonObjectives!, objective, player)
            return <div key={objective.kind} className="rounded-lg border border-ks-border bg-[#11110e] px-3 py-2.5 flex items-center justify-between gap-2">
              <span className="text-[11px] text-ks-ink">{objective.title}</span>
              <span className={`text-[10px] text-right ${progress.met ? 'text-green-400' : 'text-ks-gold'}`}>{progress.met ? '✓ ' : ''}{progress.label}</span>
            </div>
          })}
        </div>
      </Section>}

      </>}
      {view === 'career' && <><Section title={<span className="flex items-center gap-1"><Icon src={iconScouts} />scouts & interest</span>}>
        <ScoutsTab player={player} onOpenOffers={onOpenOffers ?? (() => {})} />
      </Section>

      <Section title="🏅 career record">
        <div className="flex flex-col gap-1.5">
          <StatRow label="appearances" value={c?.appearances ?? 0} />
          <StatRow label="goals" value={c?.goals ?? 0} />
          <StatRow label="assists" value={c?.assists ?? 0} />
          <StatRow label="wins" value={c?.wins ?? 0} />
          <StatRow label="clean sheets" value={c?.cleanSheets ?? 0} />
          <StatRow label="best rating" value={c?.bestRating ? c.bestRating.toFixed(1) : '—'} />
          <StatRow label="player of the match" value={c?.motmAwards ?? 0} />
          <StatRow label="matches as captain" value={player.captaincy?.matchesAsCaptain ?? 0} />
        </div>
        {/* P63 — "how many of my goals came in the league vs a cup run vs
            for my country." */}
        {player.careerByCompetition && (
          <div className="mt-3 pt-3 border-t border-ks-border/50">
            <div className="font-display tracking-widest text-[9px] text-ks-muted uppercase mb-2">by competition</div>
            <div className="flex flex-col gap-1.5">
              {([
                ['league', 'league'],
                ['cup', 'cups'],
                ['international', 'international'],
                ['other', 'friendlies & other'],
              ] as const).map(([key, label]) => {
                const b = player.careerByCompetition![key]
                if (b.appearances === 0) return null
                return (
                  <div key={key} className="flex items-center justify-between text-[11px]">
                    <span className="text-ks-muted capitalize">{label}</span>
                    <span className="text-ks-ink">{b.appearances} apps · {b.goals}G {b.assists}A</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Section>

      <Section title="🧭 career pathway" defaultOpen>
        <div className="flex items-stretch gap-1.5">
          {([
            { key: 'grassroots', label: 'Grassroots', active: player.careerClock.phase !== 'academy' && !player.turnedPro, complete: player.careerClock.phase === 'academy' || !!player.turnedPro },
            { key: 'academy', label: 'Academy', active: player.careerClock.phase === 'academy' && !player.turnedPro, complete: !!player.turnedPro },
            { key: 'pro', label: 'Professional', active: !!player.turnedPro, complete: false },
          ]).map((stage, index) => (
            <div key={stage.key} className="contents">
              <div className={`flex-1 rounded-lg border px-2 py-2.5 text-center ${stage.active ? 'border-ks-gold bg-ks-gold/10' : stage.complete ? 'border-green-500/40 bg-green-500/5' : 'border-ks-border bg-[#0f0f0d]'}`}>
                <div className={`text-[8px] uppercase tracking-wider ${stage.active ? 'text-ks-gold' : stage.complete ? 'text-green-500' : 'text-ks-muted'}`}>{stage.complete ? 'complete' : stage.active ? 'current' : 'locked'}</div>
                <div className="font-display text-[10px] text-ks-ink mt-1">{stage.label}</div>
              </div>
              {index < 2 && <div className="flex items-center text-ks-muted text-[10px]">›</div>}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-ks-muted leading-relaxed mt-2.5">
          {player.careerClock.phase === 'academy' ? 'Perform in academy competitions, build scout interest and earn a professional contract.' : player.grassrootsPath === 'sunday' ? 'Build consistent Sunday performances. Academy scouts watch from 16 and review invitations each October, starting in year three.' : 'Build your school record first. Academy scouting starts at 16; invitations open in October of year three after a review of your previous seasons.'}
        </p>
      </Section>

      <Section title={<span className="flex items-center gap-1"><Icon src={iconGlory} />glory</span>}>
        <GloryCabinet player={player} />
      </Section>

      <Section title="🎖️ trophy cabinet & achievements">
        <AchievementList player={player} />
      </Section>
      </>}

      {view === 'overview' && <><Section title={<span className="flex items-center gap-1"><Icon src={iconCoachNotebook} />coach's notebook</span>}>
        <div className="flex items-center gap-3 mb-2.5">
          <Bar value={(player.coachTrust ?? 0) + 10} max={20} />
          <span className="text-[11px] text-ks-ink w-20 text-right">{trustEmoji(player.coachTrust ?? 0)} {trustLabel(player.coachTrust ?? 0)}</span>
        </div>
        <div className="flex flex-col gap-2">
          {notebook.strengths.map((s, i) => (
            <div key={`s${i}`} className="flex gap-2 text-[11px] leading-relaxed">
              <span className="text-green-500 shrink-0">+</span>
              <span className="text-ks-ink">{s}</span>
            </div>
          ))}
          {notebook.weaknesses.map((w, i) => (
            <div key={`w${i}`} className="flex gap-2 text-[11px] leading-relaxed">
              <span className="text-orange-500 shrink-0">−</span>
              <span className="text-ks-ink">{w}</span>
            </div>
          ))}
          <div className={`text-[11px] leading-relaxed pt-2 border-t border-ks-border/40 ${
            tone === 'cold' ? 'text-orange-400' : tone === 'warm' ? 'text-green-400' : 'text-ks-muted'
          }`}>
            {notebook.recommendation}
          </div>
        </div>
      </Section>

      {player.injury && (
        <Panel title={<span className="flex items-center gap-1"><Icon src={iconMedical} />medical</span>}>
          <div className="flex flex-col gap-1.5">
            <StatRow label="status" value={<span className="text-orange-500 capitalize">{player.injury.severity}</span>} />
            <StatRow label="weeks out" value={player.injury.weeksRemaining} />
          </div>
          <p className="text-[11px] text-ks-muted leading-relaxed mt-2">{player.injury.description}</p>
        </Panel>
      )}
      </>}
    </div>
  )
}
