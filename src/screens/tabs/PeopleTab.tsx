import { useState } from 'react'
import type { Player } from '../../types/player'
import { useCareerStore } from '../../store/careerStore'
import {
  activeCast, bondLabel, bondColor, interactionsFor, interactedThisWeek, KIND_LABEL, type Relationship,
} from '../../engine/relationships'
import { standingOf, standingLabel, standingColor, STANDING_LABEL, type StandingGroup } from '../../engine/standing'
import { Panel, EmptyNote } from '../../components/ui'

// Phase 28 — the people screen. Modelled on BitLife's relationship list: every
// person has a bar, a status, a memory of what's passed between you, and a set
// of things you can actually DO about it.

function BondBar({ bond }: { bond: number }) {
  // -100..100 mapped onto a centre-origin bar so hostility reads as clearly
  // as closeness rather than just "a short green bar".
  const pct = Math.abs(bond) / 2
  return (
    <div className="relative h-1.5 rounded-full bg-[#2a2a27] overflow-hidden flex-1">
      <div className="absolute inset-y-0 left-1/2 w-px bg-ks-border/70" />
      <div
        className={`absolute inset-y-0 rounded-full ${bond >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
        style={bond >= 0 ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }}
      />
    </div>
  )
}

function PersonCard({ person, player }: { person: Relationship; player: Player }) {
  const [open, setOpen] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const interactWith = useCareerStore((s) => s.interactWith)

  const usedThisWeek = interactedThisWeek(person, player.totalWeeksElapsed ?? 0)

  const act = (interactionId: string) => {
    const result = interactWith(person.id, interactionId)
    if (!result) {
      setFlash(usedThisWeek ? 'already spent time with them this week' : 'too drained for that right now')
      return
    }
    setFlash(result.success ? `went well (+${result.delta})` : `didn't land (${result.delta})`)
    window.setTimeout(() => setFlash(null), 2600)
  }

  return (
    <div className="rounded-lg border border-ks-border bg-[#0f0f0d] overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full px-3 py-2.5 text-left">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[11px] text-ks-ink flex-1 truncate">{person.name}</span>
          <span className="text-[9px] text-ks-muted uppercase tracking-wider">{KIND_LABEL[person.kind]}</span>
          <span className={`text-[9px] uppercase tracking-wider w-16 text-right ${bondColor(person.bond)}`}>
            {bondLabel(person.bond)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <BondBar bond={person.bond} />
          <span className={`font-display text-[10px] w-7 text-right ${bondColor(person.bond)}`}>{Math.round(person.bond)}</span>
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 flex flex-col gap-2.5">
          <p className="text-[10px] text-ks-muted leading-relaxed">{person.note}</p>

          {person.history.length > 0 && (
            <div className="flex flex-col gap-1 border-l border-ks-border/60 pl-2">
              {person.history.slice(-3).map((h, i) => (
                <p key={i} className="text-[10px] text-ks-muted/80 leading-snug">— {h}</p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            {interactionsFor(person).map((i) => (
              <button
                key={i.id}
                onClick={() => act(i.id)}
                disabled={usedThisWeek || player.fitness.stamina < i.energyCost}
                className="rounded-md border border-ks-border bg-[#161613] px-2 py-2 text-[10px] text-ks-ink text-left disabled:opacity-30 active:border-ks-gold"
              >
                {i.label}
                <span className="block text-[9px] text-ks-muted">−{i.energyCost} energy</span>
              </button>
            ))}
          </div>

          {usedThisWeek && !flash && (
            <p className="text-[10px] text-ks-muted">you've already spent time with them this week</p>
          )}
          {flash && <p className="text-[10px] text-ks-gold">{flash}</p>}
        </div>
      )}
    </div>
  )
}

export default function PeopleTab({ player }: { player: Player }) {
  const cast = activeCast(player.relationships ?? [])
  const sorted = [...cast].sort((a, b) => b.bond - a.bond)

  return (
    <div className="flex flex-col gap-2.5">
      {/* P32 — the three groups. Coach reads off coachTrust so there is one
          source of truth; the dressing room and the terraces are their own. */}
      <Panel title="📊 standing">
        <div className="flex flex-col gap-2.5">
          {(['coach', 'teammates', 'fans'] as StandingGroup[]).map((g) => {
            const v = standingOf(player, g)
            const pct = Math.abs(v) / 2
            return (
              <div key={g}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-ks-ink">{STANDING_LABEL[g]}</span>
                  <span className={`text-[9px] uppercase tracking-wider ${standingColor(v)}`}>{standingLabel(v)}</span>
                </div>
                <div className="relative h-1.5 rounded-full bg-[#2a2a27] overflow-hidden">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-ks-border/70" />
                  <div
                    className={`absolute inset-y-0 rounded-full ${v >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                    style={v >= 0 ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-[10px] text-ks-muted leading-relaxed mt-2.5">
          The dressing room cares about results and doing your job. The supporters care about goals and moments.
          Both move a little after every match you play.
        </p>
      </Panel>

      <Panel title={`people — ${cast.length}`}>
        {cast.length === 0 ? (
          <EmptyNote>Nobody yet.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-2">
            {sorted.map((p) => <PersonCard key={p.id} person={p} player={player} />)}
          </div>
        )}
      </Panel>

      <p className="text-[10px] text-ks-muted leading-relaxed px-1">
        Bonds fade if you leave people alone too long. Close relationships steady your confidence,
        a good coach bond builds trust faster, and family keeps your energy up.
      </p>
    </div>
  )
}
