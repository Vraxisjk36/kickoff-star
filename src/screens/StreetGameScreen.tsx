import { useState } from 'react'
import type { Player } from '../types/player'
import {
  initStreetGame, advanceStreet, resolveStreetChance, streetRewards,
  FORMATIONS, type StreetGameState, type StreetVariant,
} from '../engine/streetGame'
import StreetMiniGame, { streetGameKindFor } from '../components/StreetMiniGame'
import { rollInjury, injuryRisk } from '../engine/injuries'
import { rand } from '../engine/rng'
import { sfx } from '../engine/audio'

// P32 — the mid-week game. Formation choice first (it genuinely changes how
// many chances come your way), then play, then a modest reward.

type Phase = 'formation' | 'playing' | 'chance' | 'results'

export default function StreetGameScreen({ player, variant, onDone }: {
  player: Player
  variant: StreetVariant
  onDone: (result: { attributeGains: Record<string, number>; confidence: number; energyCost: number; injury: { severity: string; weeksOut: number; description: string } | null; won: boolean; scoreline: string }) => void
}) {
  const [phase, setPhase] = useState<Phase>('formation')
  const [formationId, setFormationId] = useState('balanced')
  const [game, setGame] = useState<StreetGameState | null>(null)
  const [beat, setBeat] = useState<string>('')
  const [chancePrompt, setChancePrompt] = useState('')

  const squadNames = (player.squad ?? []).slice(0, 5).map((s) => s.name)

  const start = () => {
    const g = initStreetGame(player, variant, formationId, squadNames)
    setGame(g)
    setBeat(g.log[0])
    setPhase('playing')
    sfx.whistle()
  }

  const next = () => {
    if (!game) return
    const { state, beat: b } = advanceStreet(game)
    setGame(state)
    setBeat(b.text)
    if (b.kind === 'your-chance') {
      setChancePrompt(b.text)
      setPhase('chance')
      return
    }
    if (b.kind === 'their-goal') sfx.concede()
    if (b.kind === 'teammate-goal') sfx.goal()
    if (state.finished) setPhase('results')
  }

  const resolveChance = (quality: number) => {
    if (!game) return
    const { state, text, scored } = resolveStreetChance(game, quality)
    if (scored) sfx.goal(); else sfx.miss()
    setBeat(text)

    // Higher injury risk than a proper match — no warm-up, no physio, bad surface.
    let withInjury = state
    const risk = injuryRisk(player.position, player.fitness.stamina, 0.5, 0.9, player.recentInjuryCount ?? 0) * state.config.injuryMultiplier
    if (rand() < risk) {
      const rolled = rollInjury(1)
      if (rolled && rolled.severity !== 'knock') {
        withInjury = { ...state, injury: { severity: rolled.severity, weeksOut: rolled.weeksOut, description: rolled.description }, finished: true }
        setBeat(`${rolled.description} That's your game over.`)
      }
    }

    setGame(withInjury)
    setPhase(withInjury.finished ? 'results' : 'playing')
  }

  // ---- formation ----
  if (phase === 'formation' || !game) {
    return (
      <div className="min-h-screen bg-ks-black px-5 py-8 max-w-md mx-auto w-full flex flex-col">
        <div className="font-display tracking-[0.3em] text-[10px] text-ks-gold uppercase mb-2">
          {variant === 'street' ? 'street game' : 'small-sided game'}
        </div>
        <h1 className="font-display text-ks-ink text-2xl tracking-wide mb-1">pick your shape</h1>
        <p className="text-ks-muted text-xs mb-5 leading-relaxed">
          {variant === 'street'
            ? 'Four a side, first to five, no keeper worth the name. How you set up decides how much of it comes your way.'
            : 'Six a side in training. Same rules, slightly more organised. Usually.'}
        </p>

        <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
          {FORMATIONS.map((f) => {
            const picked = formationId === f.id
            return (
              <button
                key={f.id}
                onClick={() => setFormationId(f.id)}
                className={`text-left rounded-xl border px-4 py-3 transition-all ${
                  picked ? 'border-ks-gold bg-ks-gold/10' : 'border-ks-border bg-[#0f0f0d]'
                }`}
              >
                <div className="flex items-baseline justify-between mb-0.5">
                  <span className={`font-display tracking-wide text-sm ${picked ? 'text-ks-gold' : 'text-ks-ink'}`}>{f.name}</span>
                  <span className="font-display text-ks-muted text-sm">{f.shape}</span>
                </div>
                <p className="text-[10px] text-ks-muted leading-relaxed mb-2">{f.description}</p>
                <div className="flex gap-3">
                  <Meter label="your chances" value={f.attackBias / 1.5} />
                  <Meter label="their chances" value={f.defenceBias / 1.5} invert />
                  <Meter label="ball to you" value={f.playerShare} />
                </div>
              </button>
            )
          })}
        </div>

        <button
          onClick={start}
          className="w-full mt-4 bg-ks-gold text-ks-black font-display tracking-widest rounded-xl py-4 text-sm uppercase"
          style={{ marginBottom: 'var(--safe-bottom)' }}
        >
          kick off
        </button>
      </div>
    )
  }

  // ---- mini-game ----
  if (phase === 'chance') {
    return (
      <div className="min-h-screen bg-ks-black px-5 py-8 max-w-md mx-auto w-full flex flex-col justify-center">
        <Scoreboard game={game} />
        <StreetMiniGame
          key={game.playerChances}
          kind={streetGameKindFor(game.playerChances - 1)}
          prompt={chancePrompt}
          onComplete={resolveChance}
        />
      </div>
    )
  }

  // ---- results ----
  if (phase === 'results') {
    const rewards = streetRewards(game)
    return (
      <div className="min-h-screen bg-ks-black px-5 py-8 max-w-md mx-auto w-full flex flex-col justify-center">
        <div className={`font-display tracking-[0.3em] text-[10px] uppercase text-center mb-3 ${game.won ? 'text-green-500' : 'text-ks-muted'}`}>
          {game.won ? 'winners stay on' : 'game over'}
        </div>
        <div className="font-display text-5xl text-ks-gold text-center mb-1">{game.yourScore}–{game.theirScore}</div>
        <p className="text-[11px] text-ks-muted text-center mb-5">{rewards.note}</p>

        <div className="rounded-xl border border-ks-border bg-[#0f0f0d] px-4 py-3 mb-3">
          <div className="font-display tracking-widest text-[9px] text-ks-muted uppercase mb-2">what you got out of it</div>
          <div className="flex flex-col gap-1">
            {Object.entries(rewards.attributeGains).filter(([, v]) => v > 0).map(([attr, v]) => (
              <div key={attr} className="flex items-center justify-between">
                <span className="text-[11px] text-ks-ink">{attr}</span>
                <span className="text-[11px] text-green-500">+{v.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-ks-border/60 mt-1 pt-1">
              <span className="text-[11px] text-ks-muted">energy</span>
              <span className="text-[11px] text-orange-400">−{game.config.energyCost}</span>
            </div>
          </div>
        </div>

        {game.injury && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/5 px-4 py-3 mb-3">
            <div className="text-[10px] text-red-400 uppercase tracking-wider mb-1">injured</div>
            <p className="text-[11px] text-ks-ink">{game.injury.description}</p>
          </div>
        )}

        <button
          onClick={() => onDone({
            attributeGains: rewards.attributeGains,
            confidence: rewards.confidence,
            energyCost: game.config.energyCost,
            injury: game.injury,
            won: game.won,
            scoreline: `${game.yourScore}–${game.theirScore}`,
          })}
          className="w-full bg-ks-gold text-ks-black font-display tracking-widest rounded-xl py-3.5 text-sm uppercase"
        >
          head home
        </button>
      </div>
    )
  }

  // ---- playing ----
  return (
    <div className="min-h-screen bg-ks-black px-5 py-8 max-w-md mx-auto w-full flex flex-col justify-center">
      <Scoreboard game={game} />
      <div className="rounded-xl border border-ks-border bg-[#0f0f0d] px-4 py-5 mb-4 min-h-[5.5rem] flex items-center">
        <p className="text-ks-ink text-sm leading-relaxed">{beat}</p>
      </div>
      <button
        onClick={next}
        className="w-full bg-ks-gold text-ks-black font-display tracking-widest rounded-xl py-4 text-sm uppercase active:scale-[0.99]"
      >
        play on →
      </button>
    </div>
  )
}

function Scoreboard({ game }: { game: StreetGameState }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="font-display tracking-widest text-[10px] text-ks-muted uppercase">{game.config.title}</span>
        <span className="text-[9px] text-ks-muted uppercase tracking-wider">first to {game.config.target}</span>
      </div>
      <div className="flex items-center justify-center gap-4">
        <span className="font-display text-4xl text-ks-gold">{game.yourScore}</span>
        <span className="text-ks-muted text-sm">–</span>
        <span className="font-display text-4xl text-ks-ink">{game.theirScore}</span>
      </div>
      <div className="text-center text-[9px] text-ks-muted uppercase tracking-wider mt-1">
        {game.config.formation.name} · {game.config.formation.shape}
      </div>
    </div>
  )
}

function Meter({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className="flex-1">
      <div className="text-[8px] text-ks-muted uppercase tracking-wider mb-0.5">{label}</div>
      <div className="h-1 rounded-full bg-[#2a2a27] overflow-hidden">
        <div className={`h-full rounded-full ${invert ? 'bg-orange-500' : 'bg-ks-gold'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
