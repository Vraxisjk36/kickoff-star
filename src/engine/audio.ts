// Audio layer — fully synthesized via WebAudio, so the PWA ships zero audio
// assets and works offline out of the box. Everything routes through one
// master gain with a persisted mute toggle.
//
// Mobile constraint: an AudioContext can only start from a user gesture, so
// the context is created lazily on the first sfx call (which is always a tap).

const MUTE_KEY = 'kickoff-star-muted'

let ctx: AudioContext | null = null
let master: GainNode | null = null

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
      master = ctx.createGain()
      master.gain.value = isMuted() ? 0 : 0.5
      master.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

export function isMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false }
}

export function setMuted(muted: boolean): void {
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0') } catch { /* private mode */ }
  if (master) master.gain.value = muted ? 0 : 0.5
}

export function toggleMuted(): boolean {
  const next = !isMuted()
  setMuted(next)
  return next
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = 'sine', peak = 0.4) {
  const c = ensureCtx()
  if (!c || !master) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  const t = c.currentTime + start
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  osc.connect(gain).connect(master)
  osc.start(t)
  osc.stop(t + duration + 0.05)
}

function noise(start: number, duration: number, filterFreq: number, peak = 0.3) {
  const c = ensureCtx()
  if (!c || !master) return
  const len = Math.ceil(c.sampleRate * duration)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = filterFreq
  const gain = c.createGain()
  const t = c.currentTime + start
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(peak, t + duration * 0.2)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  src.connect(filter).connect(gain).connect(master)
  src.start(t)
}

export const sfx = {
  /** Soft UI tap. */
  tap() { tone(660, 0, 0.06, 'sine', 0.12) },
  /** Referee's whistle — kickoff / full time. */
  whistle() {
    tone(2100, 0, 0.16, 'square', 0.10)
    tone(2400, 0.02, 0.14, 'square', 0.06)
  },
  /** Full-time double whistle. */
  fullTime() {
    tone(2100, 0, 0.12, 'square', 0.10)
    tone(2100, 0.18, 0.12, 'square', 0.10)
    tone(2100, 0.36, 0.30, 'square', 0.10)
  },
  /** A brief low crowd bed between key incidents. Kept short so background
   * audio never runs after the match or when the app is paused. */
  crowd() { noise(0, 2.8, 520, 0.045); noise(0.5, 1.8, 1100, 0.025) },
  /** Goal — crowd swell plus a rising hit. */
  goal() {
    noise(0, 1.1, 900, 0.35)
    tone(392, 0, 0.15, 'triangle', 0.3)
    tone(523, 0.12, 0.2, 'triangle', 0.35)
    tone(784, 0.26, 0.4, 'triangle', 0.4)
  },
  /** Opposition goal — flat crowd murmur, minor fall. */
  concede() {
    noise(0, 0.7, 500, 0.2)
    tone(330, 0, 0.2, 'triangle', 0.2)
    tone(262, 0.18, 0.35, 'triangle', 0.2)
  },
  /** Timing-bar perfect. */
  perfect() {
    tone(880, 0, 0.08, 'sine', 0.3)
    tone(1320, 0.07, 0.12, 'sine', 0.3)
  },
  /** Timing-bar miss. */
  miss() { tone(180, 0, 0.18, 'sawtooth', 0.18) },
  /** Achievement fanfare. */
  achievement() {
    tone(523, 0, 0.12, 'triangle', 0.3)
    tone(659, 0.11, 0.12, 'triangle', 0.3)
    tone(784, 0.22, 0.12, 'triangle', 0.3)
    tone(1047, 0.33, 0.35, 'triangle', 0.38)
  },
}
