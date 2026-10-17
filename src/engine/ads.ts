// P64 — real AdMob integration via Capacitor (native), not H5 Games Ads —
// switched from the original TWA/PWABuilder plan specifically because a TWA
// showed browser chrome and an unfamiliar URL, which looked wrong for a
// finished app. Capacitor wraps the exact same web build in a genuine
// native shell instead.
//
// Three rewarded-video placements:
//   - energy: alongside the existing energy-drink item
//   - cash: alongside existing odd-jobs/allowance
//   - xp: a small post-session/post-match boost
//
// Production placements provisioned for this app. Use registered test devices
// in AdMob when personally testing ads on a Play release.
import { AdMob, InterstitialAdPluginEvents, RewardAdPluginEvents, type AdMobRewardItem } from '@capacitor-community/admob'
import { Capacitor } from '@capacitor/core'

export type AdPlacement = 'energy' | 'cash' | 'xp'

/** The browser build has no rewarded-ad SDK, so it must not offer ad buttons. */
export function rewardedAdsAvailable(): boolean {
  return Capacitor.isNativePlatform()
}

const AD_UNIT_IDS: Record<AdPlacement, string> = {
  energy: 'ca-app-pub-5886721718793058/8562570543',
  cash: 'ca-app-pub-5886721718793058/9192202496',
  xp: 'ca-app-pub-5886721718793058/8065903214',
}
const SEASON_INTERSTITIAL_ID = 'ca-app-pub-5886721718793058/8649277016'

const IS_TESTING = false

// Energy ads are small emergency top-ups. Two a day cannot replace the
// stronger 50% and full recovery items, even if both ads are watched.
const DAILY_CAPS: Record<AdPlacement, number> = { energy: 2, cash: 5, xp: 5 }
const STORAGE_KEY = 'ks-ad-watch-log'

interface WatchLog {
  date: string // YYYY-MM-DD, local
  counts: Record<AdPlacement, number>
}

function todayKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function readLog(): WatchLog {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as WatchLog
      if (parsed.date === todayKey() && parsed.counts &&
          ['energy', 'cash', 'xp'].every((key) => Number.isFinite(parsed.counts[key as AdPlacement]))) return parsed
    }
  } catch {
    // corrupt/missing log — start fresh rather than block the player
  }
  return { date: todayKey(), counts: { energy: 0, cash: 0, xp: 0 } }
}

function writeLog(log: WatchLog) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log))
  } catch {
    // best-effort only — a failed write just means the cap isn't tracked this session
  }
}

/** How many of this placement's ads are still available today. */
export function remainingToday(placement: AdPlacement): number {
  const log = readLog()
  return Math.max(0, DAILY_CAPS[placement] - log.counts[placement])
}

let initialization: Promise<void> | null = null
// Shared across every screen and ad format. A reward event can arrive before
// the video closes, so the gate stays held until dismissal.
let adBusy = false
let lastAdFinishedAt = 0
const AD_GAP_MS = 60_000
function claimAd(): boolean {
  if (adBusy || Date.now() - lastAdFinishedAt < AD_GAP_MS) return false
  adBusy = true
  return true
}
function releaseAd() {
  adBusy = false
  lastAdFinishedAt = Date.now()
}
async function ensureInitialized() {
  if (!Capacitor.isNativePlatform()) return
  if (!initialization) initialization = AdMob.initialize({ initializeForTesting: IS_TESTING }).then(() => {}).catch(error => {
    initialization = null
    throw error
  })
  await initialization
}

/** One non-rewarded ad at each season break, per career. Never interrupts a match. */
export async function showSeasonInterstitial(playerId: string, season: number, breakPoint: 'mid' | 'end'): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  if (!claimAd()) return
  const key = `ks-season-ad:${playerId}:${season}:${breakPoint}`
  try {
    if (localStorage.getItem(key)) { adBusy = false; return }
    // Claim before loading to avoid a second request on remount or rapid taps.
    localStorage.setItem(key, '1')
  } catch { adBusy = false; return }
  try {
    await ensureInitialized()
    await AdMob.prepareInterstitial({ adId: SEASON_INTERSTITIAL_ID, isTesting: IS_TESTING })
    await new Promise<void>((resolve, reject) => {
      let settled = false
      const handles: Promise<{ remove: () => Promise<void> }>[] = []
      const finish = (error?: unknown) => {
        if (settled) return
        settled = true
        for (const h of handles) void h.then(handle => handle.remove())
        if (error) reject(error)
        else resolve()
      }
      handles.push(AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => finish()))
      handles.push(AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, error => finish(error)))
      // showInterstitial resolves on display, not when the video closes.
      void AdMob.showInterstitial().catch(error => finish(error))
    })
  } catch (error) {
    console.warn('[kickoff-star] season ad unavailable', error)
  } finally {
    releaseAd()
  }
}

/**
 * Shows a rewarded ad for the given placement. Resolves with the real
 * reward item if the player watched it through to completion, or null if
 * they closed it early, it failed to load, the daily cap is hit, or we're
 * not running as a native app (e.g. testing in a browser) — every caller
 * must treat null as "no reward," never assume a call here means success.
 */
export async function watchRewardedAd(placement: AdPlacement): Promise<AdMobRewardItem | null> {
  if (remainingToday(placement) <= 0) return null
  if (!Capacitor.isNativePlatform()) return null // no native ad SDK in a plain browser
  if (!claimAd()) return null

  try {
    await ensureInitialized()
    const adId = AD_UNIT_IDS[placement]
    await AdMob.prepareRewardVideoAd({ adId, isTesting: IS_TESTING })
    const result: AdMobRewardItem = await new Promise((resolve, reject) => {
      let settled = false
      let earned: AdMobRewardItem | null = null
      const handles: Promise<{ remove: () => Promise<void> }>[] = []
      const cleanup = () => { for (const h of handles) void h.then((handle) => handle.remove()) }
      const finish = (reward: AdMobRewardItem | null) => {
        if (settled) return
        settled = true
        cleanup()
        if (reward) resolve(reward)
        else reject(new Error('dismissed-before-reward'))
      }

      handles.push(AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward) => {
        earned = reward
      }))
      handles.push(AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        finish(earned)
      }))
      handles.push(AdMob.addListener(RewardAdPluginEvents.FailedToShow, (err) => {
        if (!settled) { settled = true; cleanup(); reject(err) }
      }))
      AdMob.showRewardVideoAd().catch((err) => { if (!settled) { settled = true; cleanup(); reject(err) } })
    })

    const log = readLog()
    log.counts[placement] += 1
    writeLog(log)
    return result
  } catch {
    // closed early, failed to load, or failed to show — no reward, no cap consumed
    return null
  } finally {
    releaseAd()
  }
}
