import type { Player } from '../types/player'
import { useCareerStore } from '../store/careerStore'
import {
  STAGE_LABEL, STAGE_ORDER, stageIndex, choicesFor, contractValue,
  type Negotiation,
} from '../engine/negotiation'
import { getAgent, netWage } from '../engine/agents'
import { formatMoney } from '../engine/economy'

// P30 — the contract pipeline. Deliberately shows the process, not just the
// outcome: which stage you're at, how the terms have moved since the opening
// offer, and how much patience the club has left.

function StageTrack({ negotiation }: { negotiation: Negotiation }) {
  const current = stageIndex(negotiation.stage)
  const dead = negotiation.stage === 'collapsed'
  return (
    <div className="flex items-center gap-1">
      {STAGE_ORDER.map((stage, i) => {
        const done = i < current
        const active = i === current && !dead
        return (
          <div key={stage} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-full h-1 rounded-full transition-colors ${
                dead ? 'bg-red-500/30' : done ? 'bg-ks-gold' : active ? 'bg-ks-gold/60 animate-pulse' : 'bg-[#2a2a27]'
              }`}
            />
            <span className={`text-[7px] uppercase tracking-wider text-center leading-tight ${
              active ? 'text-ks-gold' : done ? 'text-ks-muted' : 'text-ks-muted/40'
            }`}>
              {STAGE_LABEL[stage].split(' ')[0]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function TermsPanel({ negotiation, player }: { negotiation: Negotiation; player: Player }) {
  const t = negotiation.terms
  const agent = getAgent(player.agentId)
  const net = netWage(t.weeklyWage, player.agentId)
  return (
    <div className="rounded-xl border border-ks-border bg-[#0f0f0d] px-4 py-3">
      <div className="font-display tracking-widest text-[9px] text-ks-muted uppercase mb-2.5">on the table</div>
      <div className="flex items-end justify-between mb-2.5">
        <div>
          <div className="font-display text-2xl text-ks-gold leading-none">{formatMoney(t.weeklyWage)}<span className="text-sm text-ks-muted">/wk</span></div>
          {agent && agent.commission > 0 && (
            <div className="text-[10px] text-ks-muted mt-0.5">
              {formatMoney(net)}/wk after {agent.name}'s {agent.commission}%
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[9px] text-ks-muted uppercase tracking-wider">total value</div>
          <div className="font-display text-ks-ink text-sm">{formatMoney(contractValue(t))}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <Row label="length" value={`${t.years} season${t.years === 1 ? '' : 's'}`} />
        <Row label="signing fee" value={formatMoney(t.signingBonus)} />
        <Row label="per appearance" value={formatMoney(t.appearanceFee)} />
        <Row label="per goal" value={formatMoney(t.goalBonus)} />
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-ks-muted">{label}</span>
      <span className="text-[11px] text-ks-ink">{value}</span>
    </div>
  )
}

export default function NegotiationScreen({ player, onClose }: { player: Player; onClose: () => void }) {
  const makeChoice = useCareerStore((s) => s.makeNegotiationChoice)
  const negotiation = player.negotiation
  if (!negotiation) return null

  const dead = negotiation.stage === 'collapsed'
  const done = negotiation.stage === 'complete'
  const choices = choicesFor(negotiation, player)
  const agent = getAgent(player.agentId)

  return (
    <div className="min-h-screen bg-ks-black px-5 py-6 max-w-md mx-auto w-full flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <div className="font-display tracking-[0.3em] text-[10px] text-ks-gold uppercase">contract talks</div>
        <button onClick={onClose} className="text-[10px] text-ks-muted uppercase tracking-wider">close</button>
      </div>
      <h1 className="font-display text-ks-ink text-2xl tracking-wide mb-0.5">{negotiation.clubName}</h1>
      <p className="text-[10px] text-ks-muted mb-4">
        {STAGE_LABEL[negotiation.stage]}
        {negotiation.kind === 'academy' && <> · week {Math.min(2, (player.totalWeeksElapsed ?? 0) - negotiation.startedWeek + 1)} of 2</>}
        {agent && <> · represented by {agent.name}</>}
      </p>

      <div className="mb-4"><StageTrack negotiation={negotiation} /></div>

      {/* club patience — the pressure gauge that makes pushing a real risk */}
      {!dead && !done && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-ks-muted uppercase tracking-wider">club patience</span>
            <span className={`text-[10px] ${negotiation.patience > 50 ? 'text-green-500' : negotiation.patience > 25 ? 'text-orange-400' : 'text-red-500'}`}>
              {negotiation.patience > 70 ? 'relaxed' : negotiation.patience > 40 ? 'getting on with it' : negotiation.patience > 20 ? 'losing patience' : 'about to walk'}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[#2a2a27] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${negotiation.patience > 50 ? 'bg-green-500' : negotiation.patience > 25 ? 'bg-orange-500' : 'bg-red-500'}`}
              style={{ width: `${Math.max(0, negotiation.patience)}%` }}
            />
          </div>
        </div>
      )}

      {!dead && <div className="mb-3"><TermsPanel negotiation={negotiation} player={player} /></div>}

      {/* the story so far */}
      <div className="flex-1 overflow-y-auto mb-3">
        <div className="flex flex-col gap-2">
          {negotiation.log.slice(-6).map((line, i, arr) => (
            <p key={i} className={`text-[11px] leading-relaxed ${i === arr.length - 1 ? 'text-ks-ink' : 'text-ks-muted/70'}`}>
              {line}
            </p>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {dead ? (
          <>
            <div className="rounded-xl border border-red-500/40 bg-red-500/5 px-4 py-3 text-[11px] text-ks-ink leading-relaxed">
              {negotiation.collapseReason}
            </div>
            <button onClick={onClose} className="w-full bg-ks-gold text-ks-black font-display tracking-widest rounded-xl py-3.5 text-sm uppercase">
              back to your week
            </button>
          </>
        ) : done ? (
          <button onClick={onClose} className="w-full bg-ks-gold text-ks-black font-display tracking-widest rounded-xl py-3.5 text-sm uppercase">
            continue
          </button>
        ) : negotiation.awaitingPlayer ? (
          choices.map((c) => (
            <button
              key={c.id}
              onClick={() => makeChoice(c.id)}
              className={`text-left rounded-xl border px-4 py-3 transition-colors ${
                c.id === 'walk'
                  ? 'border-red-500/30 bg-red-500/5 hover:border-red-500/60'
                  : 'border-ks-border bg-[#0f0f0d] hover:border-ks-gold hover:bg-ks-gold/5'
              }`}
            >
              <div className={`font-display tracking-wide text-sm uppercase ${c.id === 'walk' ? 'text-red-400' : 'text-ks-gold'}`}>{c.label}</div>
              <div className="text-[10px] text-ks-muted mt-0.5">{c.hint}</div>
            </button>
          ))
        ) : (
          <>
            <div className="rounded-xl border border-ks-border bg-[#0f0f0d] px-4 py-3 text-[11px] text-ks-muted text-center">
              {negotiation.kind === 'academy' ? 'The club is arranging your medical. Advance one week to return for signing.' : 'The ball is in their court. Play your week and see where it stands.'}
            </div>
            <button onClick={onClose} className="w-full bg-ks-gold text-ks-black font-display tracking-widest rounded-xl py-3.5 text-sm uppercase">
              back to your week
            </button>
          </>
        )}
      </div>
    </div>
  )
}
