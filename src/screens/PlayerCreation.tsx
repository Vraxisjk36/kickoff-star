import { rand } from '../engine/rng'
import { useState } from 'react'
import type { Player } from '../types/player'
import type { Position } from '../types/attributes'
import { OUTFIELD_ATTRIBUTES, GOALKEEPER_ATTRIBUTES, isGoalkeeperPosition } from '../types/attributes'
import type { CalendarState } from '../types/calendar'
import { useCareerStore } from '../store/careerStore'
import { NATIONS } from '../engine/nations'
import { regionsFor } from '../engine/regions'
import { ARCHETYPES, archetypeAttributeDeltas, getArchetype } from '../engine/archetypes'
import Avatar, { AVATAR_IMAGES } from '../components/Avatar'

const POSITIONS: { code: Position; name: string }[] = [
  { code: 'GK', name: 'Goalkeeper' },
  { code: 'CB', name: 'Centre-Back' },
  { code: 'FB', name: 'Full-Back' },
  { code: 'CM', name: 'Midfielder' },
  { code: 'WM', name: 'Wide Mid' },
  { code: 'WG', name: 'Winger' },
  { code: 'ST', name: 'Striker' },
]

// P60 — pitch coordinates for the tap-to-select picker. Attacking third at
// the top, own goal at the bottom, matching how a real formation reads.
const PITCH_SPOTS: Record<Position, { top: string; left: string }> = {
  ST: { top: '13%', left: '50%' },
  WG: { top: '27%', left: '78%' },
  WM: { top: '46%', left: '22%' },
  CM: { top: '49%', left: '50%' },
  FB: { top: '70%', left: '78%' },
  CB: { top: '73%', left: '50%' },
  GK: { top: '91%', left: '50%' },
}

function randomBetween(min: number, max: number) {
  return Math.round(min + rand() * (max - min))
}

function buildNewPlayer(name: string, position: Position, foot: 'left' | 'right', nationality: string, regionId: string, avatarId: number, archetypeId: string): Player {
  const isGK = isGoalkeeperPosition(position)
  const potential = randomBetween(8, 16)
  const attributes = isGK
    ? { kind: 'goalkeeper' as const, values: Object.fromEntries(GOALKEEPER_ATTRIBUTES.map((a) => [a, randomBetween(1, 4)])) as Record<string, number> }
    : { kind: 'outfield' as const, values: Object.fromEntries(OUTFIELD_ATTRIBUTES.map((a) => [a, randomBetween(1, 4)])) as Record<string, number> }
  // Archetype tilt: boosted attributes start +2, the trade-off starts -1 —
  // clamped inside the same 1..potential-1 band trials use, so no archetype
  // can start above what the growth system would ever allow.
  const arch = getArchetype(archetypeId)
  if (arch) {
    for (const [attr, delta] of Object.entries(archetypeAttributeDeltas(arch, position))) {
      if (attr in attributes.values) {
        attributes.values[attr] = Math.max(1, Math.min(potential - 1, attributes.values[attr] + delta))
      }
    }
  }
  return {
    id: crypto.randomUUID(),
    name, position, preferredFoot: foot,
    heightCm: randomBetween(160, 190),
    attributes: attributes as Player['attributes'],
    potential,
    confidence: { value: 0, baseline: 0 },
    fitness: { stamina: 100 },
    careerClock: { ageYears: 14, phase: 'grassroots-trials', grassrootsSeason: 1 },
    nationality, regionId, avatarId, archetype: archetypeId,
    schoolId: null, trialWeekCompleted: 0, squadRole: null, trainingMomentum: 0, matchRatings: [], seasonGoals: 0, seasonAssists: 0, injury: null, recentInjuryCount: 0, matchesSinceReturn: 3, coachTrust: 0, reputation: 5, scoutWatchers: [], contractOffers: [], totalWeeksElapsed: 0, academyClubName: null, turnedPro: null,
  }
}

function buildInitialCalendar(): CalendarState {
  return {
    currentWeek: {
      weekNumber: 1, seasonYear: 1,
      events: [{ id: crypto.randomUUID(), day: 'mon', type: 'school', title: 'first day of your youth career', resolved: false }],
    },
    history: [],
  }
}

export default function PlayerCreation({ onComplete, onBack }: { onComplete: () => void; onBack: () => void }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [position, setPosition] = useState<Position | null>(null)
  const [foot, setFoot] = useState<'left' | 'right' | null>(null)
  const [avatarId, setAvatarId] = useState<number | null>(null)
  const [nation, setNation] = useState<string | null>(null)
  const [regionId, setRegionId] = useState<string | null>(null)
  const [archetype, setArchetype] = useState<string | null>(null)
  const startNewCareer = useCareerStore((s) => s.startNewCareer)

  const LAST_STEP = 6
  const canProceed =
    step === 0 ? name.trim().length > 0
    : step === 1 ? position !== null
    : step === 2 ? foot !== null
    : step === 3 ? avatarId !== null
    : step === 4 ? nation !== null
    : step === 5 ? regionId !== null
    : archetype !== null

  const handleNext = async () => {
    if (step < LAST_STEP) { setStep(step + 1); return }
    if (!name.trim() || !position || !foot || avatarId === null || !nation || !regionId || !archetype) return
    const player = buildNewPlayer(name.trim(), position, foot, nation, regionId, avatarId, archetype)
    await startNewCareer(player, buildInitialCalendar(), 0)
    onComplete()
  }

  return (
    <div className="relative min-h-screen w-full bg-ks-black flex flex-col">
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 50% 50% at 50% 0%, rgba(212,175,55,0.08), transparent 60%), linear-gradient(180deg, #0a0a09, #050504)',
      }} />

      {/* top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-6">
        <button onClick={() => (step === 0 ? onBack() : setStep(step - 1))} className="text-ks-muted text-sm">← back</button>
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={`h-1 rounded-full transition-all ${i === step ? 'w-6 bg-ks-gold' : i < step ? 'w-3 bg-ks-gold/50' : 'w-3 bg-ks-border'}`} />
          ))}
        </div>
        <div className="w-10" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col px-6 py-8 max-w-md mx-auto w-full">
        <h1 className="font-display text-ks-ink text-2xl tracking-wide mb-1">
          {step === 0 ? 'what\'s your name?' : step === 1 ? 'pick your position' : step === 2 ? 'preferred foot' : step === 3 ? 'pick your look' : step === 4 ? 'choose your country' : step === 5 ? 'choose your region' : 'what kind of player are you?'}
        </h1>
        <p className="text-ks-muted text-xs mb-8">
          {step === 0 ? 'every legend needs a name.'
            : step === 1 ? 'where do you want to make your mark?'
            : step === 2 ? 'which foot do you trust?'
            : step === 3 ? 'this is the face of your career.'
            : step === 4 ? 'your nation — one day they might come calling.'
            : step === 5 ? 'your first schools and clubs come from here.'
            : 'one defining trait. it shapes your attributes and how you play, permanently.'}
        </p>

        {step === 0 && (
          <input
            autoFocus value={name} onChange={(e) => setName(e.target.value)}
            className="bg-[#0f0f0d] border border-ks-border rounded-xl px-4 py-4 text-ks-ink text-lg outline-none focus:border-ks-gold"
            placeholder="your name"
          />
        )}

        {step === 1 && (
          <div className="relative rounded-xl border border-ks-border overflow-hidden" style={{ aspectRatio: '3/4', background: 'linear-gradient(180deg,#0f2818,#0a1f11)' }}>
            {/* pitch markings */}
            <svg className="absolute inset-0 w-full h-full opacity-25" viewBox="0 0 100 133" preserveAspectRatio="none">
              <rect x="2" y="2" width="96" height="129" fill="none" stroke="#fff" strokeWidth="0.5" />
              <line x1="2" y1="66.5" x2="98" y2="66.5" stroke="#fff" strokeWidth="0.5" />
              <circle cx="50" cy="66.5" r="12" fill="none" stroke="#fff" strokeWidth="0.5" />
              <rect x="22" y="2" width="56" height="18" fill="none" stroke="#fff" strokeWidth="0.5" />
              <rect x="22" y="113" width="56" height="18" fill="none" stroke="#fff" strokeWidth="0.5" />
            </svg>
            {/* P60 — reference: tap a spot on a real pitch instead of a flat
                button grid. Same 7 positions we've always had (GK/CB/FB/CM/
                WM/WG/ST) — this is purely a nicer picker, not a bigger
                position system. */}
            {POSITIONS.map((p) => (
              <button
                key={p.code}
                onClick={() => setPosition(p.code)}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                style={PITCH_SPOTS[p.code]}
              >
                <div className={`w-11 h-11 rounded-full border-2 flex items-center justify-center font-display text-xs tracking-wide transition-all ${
                  position === p.code ? 'border-ks-gold bg-ks-gold text-ks-black scale-110 shadow-[0_0_16px_rgba(212,175,55,0.5)]' : 'border-white/40 bg-black/50 text-ks-ink'
                }`}>
                  {p.code}
                </div>
              </button>
            ))}
          </div>
        )}
        {step === 1 && position && (
          <p className="text-center text-[11px] text-ks-muted mt-2">{POSITIONS.find((p) => p.code === position)?.name}</p>
        )}

        {step === 2 && (
          <div className="grid grid-cols-2 gap-2.5">
            {(['left', 'right'] as const).map((f) => (
              <button key={f} onClick={() => setFoot(f)}
                className={`border rounded-xl py-8 font-display text-xl tracking-widest capitalize transition-all ${
                  foot === f ? 'border-ks-gold bg-ks-gold/10 text-ks-gold' : 'border-ks-border bg-[#0f0f0d] text-ks-ink'
                }`}>{f}</button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-4 gap-2.5">
            {AVATAR_IMAGES.map((_, i) => (
              <button key={i} onClick={() => setAvatarId(i)}
                className={`border rounded-xl p-2 flex items-center justify-center transition-all ${
                  avatarId === i ? 'border-ks-gold bg-ks-gold/10 shadow-[0_0_18px_rgba(212,175,55,0.25)]' : 'border-ks-border bg-[#0f0f0d]'
                }`}>
                <Avatar id={i} size={56} />
              </button>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[52vh] pr-1">
            {NATIONS.map((n) => (
              <button key={n.id} onClick={() => { setNation(n.id); setRegionId(null) }}
                className={`border rounded-xl px-3 py-3 flex items-center gap-2.5 transition-all ${
                  nation === n.id ? 'border-ks-gold bg-ks-gold/10' : 'border-ks-border bg-[#0f0f0d]'
                }`}>
                <span className="text-xl leading-none">{n.flag}</span>
                <span className={`text-[11px] text-left ${nation === n.id ? 'text-ks-gold' : 'text-ks-ink'}`}>{n.name}</span>
              </button>
            ))}
          </div>
        )}

        {step === 5 && (
          <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[56vh] pr-1">
            {regionsFor(nation ?? '').map((region) => (
              <button key={region.id} onClick={() => setRegionId(region.id)}
                className={`border rounded-xl px-3 py-4 text-left transition-all ${regionId === region.id ? 'border-ks-gold bg-ks-gold/10 text-ks-gold' : 'border-ks-border bg-[#0f0f0d] text-ks-ink'}`}>
                <span className="font-display text-sm">{region.name}</span>
                <span className="block text-[10px] text-ks-muted mt-1">{region.localities.join(' · ')}</span>
              </button>
            ))}
          </div>
        )}

        {step === 6 && (
          <div className="flex flex-col gap-2 overflow-y-auto max-h-[56vh] pr-1">
            {ARCHETYPES.map((a) => (
              <button key={a.id} onClick={() => setArchetype(a.id)}
                className={`border rounded-xl px-4 py-3 text-left transition-all ${
                  archetype === a.id ? 'border-ks-gold bg-ks-gold/10' : 'border-ks-border bg-[#0f0f0d]'
                }`}>
                <div className={`font-display tracking-wide text-sm ${archetype === a.id ? 'text-ks-gold' : 'text-ks-ink'}`}>{a.label}</div>
                <div className="text-[10px] text-ks-muted mt-0.5">{a.tagline}</div>
                <div className="text-[9px] text-ks-muted mt-1.5 uppercase tracking-wider">
                  {(position === 'GK' && a.gkAlternative ? a.gkAlternative.boosts : a.boosts).join(' +2 · ')} +2
                  {' · '}{(position === 'GK' && a.gkAlternative ? a.gkAlternative.tradeoffs : a.tradeoffs).join(', ')} -1
                </div>
                <div className={`text-[10px] mt-1 ${archetype === a.id ? 'text-ks-gold' : 'text-ks-muted'}`}>{a.passiveText}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative z-10 px-6 pb-8 max-w-md mx-auto w-full">
        <button onClick={handleNext} disabled={!canProceed}
          className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-4 text-base disabled:opacity-25 shadow-[0_0_25px_rgba(212,175,55,0.2)]">
          {step < LAST_STEP ? 'continue' : 'begin your career'}
        </button>
      </div>
    </div>
  )
}
