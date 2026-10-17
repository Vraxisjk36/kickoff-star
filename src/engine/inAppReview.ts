import { Capacitor, registerPlugin } from '@capacitor/core'

const review = registerPlugin<{ request(): Promise<void> }>('KickoffReview')
const STORAGE_KEY = 'kickoff-star-review-attempt'
const COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000
const MILESTONES = [5, 25, 75]
let pending = false

/** Requests Google's native card at a natural post-match break. Play decides whether to display it. */
export async function maybeRequestInAppReview(appearances: number): Promise<void> {
  if (Capacitor.getPlatform() !== 'android' || pending) return
  let previous: { at: number; milestone: number } = { at: 0, milestone: 0 }
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) previous = JSON.parse(saved) as typeof previous
  } catch { /* a new installation or unavailable storage can start fresh */ }
  const milestone = MILESTONES.find(n => appearances >= n && previous.milestone < n)
  if (!milestone || Date.now() - previous.at < COOLDOWN_MS) return

  pending = true
  try {
    // Count the request before calling Play: it may choose not to show a dialog,
    // and the API deliberately does not report whether the player reviewed.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now(), milestone }))
  } catch { /* still let the native review request fail gracefully */ }
  try { await review.request() }
  catch (error) { console.warn('[kickoff-star] review flow unavailable', error) }
  finally { pending = false }
}
