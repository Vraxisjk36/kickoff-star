// Original, locally generated soundtrack. See scripts/generateSoundtrack.py.
// A dedicated music preference lets players retain match sound effects.

import { isMuted } from './audio'

const TRACK_URL = './audio/under-the-lights.mp3'
const VOLUME = 0.24
const MUSIC_KEY = 'kickoff-star-music-enabled'

export function musicEnabled(): boolean {
  try { return localStorage.getItem(MUSIC_KEY) !== '0' } catch { return true }
}

export function setMusicEnabled(enabled: boolean): void {
  try { localStorage.setItem(MUSIC_KEY, enabled ? '1' : '0') } catch { /* storage unavailable */ }
  syncMusicMute()
}

let el: HTMLAudioElement | null = null
let wantsToPlay = false

function ensureEl(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  if (!el) {
    el = new Audio(TRACK_URL)
    el.loop = true
    el.volume = isMuted() || !musicEnabled() ? 0 : VOLUME
    el.preload = 'auto'
  }
  return el
}

/** Start (or resume) background music. Safe to call repeatedly. */
export function playMusic(): void {
  wantsToPlay = true
  const a = ensureEl()
  if (!a) return
  a.volume = isMuted() || !musicEnabled() ? 0 : VOLUME
  if (!musicEnabled()) return
  if (a.paused) {
    // play() can reject if not yet inside a user gesture on some mobile
    // browsers — that's fine, it'll succeed on the next gesture-triggered
    // call since wantsToPlay stays true.
    void a.play().catch(() => { /* will retry on next call */ })
  }
}

/** Pause background music (used during match/training screens). */
export function pauseMusic(): void {
  wantsToPlay = false
  if (el && !el.paused) el.pause()
}

/** Re-apply the current mute state to the music element (call from mute toggle). */
export function syncMusicMute(): void {
  if (!el) return
  el.volume = isMuted() || !musicEnabled() ? 0 : VOLUME
  if (!musicEnabled() && !el.paused) el.pause()
  // If unmuting and playback was desired, make sure it's actually running.
  if (wantsToPlay && musicEnabled() && el.paused) void el.play().catch(() => { /* ignore */ })
}


/** Pause audio whenever the app is backgrounded and resume only if it was wanted. */
export function installMusicLifecycle(): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return () => {}
  const suspend = () => { if (el && !el.paused) el.pause() }
  const resume = () => {
    if (document.visibilityState === 'visible' && wantsToPlay && musicEnabled() && el?.paused) {
      el.volume = isMuted() ? 0 : VOLUME
      void el.play().catch(() => {})
    }
  }
  const onVisibility = () => document.visibilityState === 'hidden' ? suspend() : resume()
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', suspend)
  window.addEventListener('pageshow', resume)
  window.addEventListener('blur', suspend)
  window.addEventListener('focus', resume)
  return () => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', suspend)
    window.removeEventListener('pageshow', resume)
    window.removeEventListener('blur', suspend)
    window.removeEventListener('focus', resume)
  }
}
