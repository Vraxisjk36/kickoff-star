// P64 — real AdMob integration via Capacitor (native), not H5 Games Ads —
// switched from the original TWA/PWABuilder plan specifically because a TWA
// showed browser chrome and an unfamiliar URL, which looked wrong for a
// finished app. Capacitor wraps the exact same web build in a genuine
// native shell instead.
//
// Three rewarded-video placements only, matching the agreed "just enough to
// get us going, nothing that pops up uninvited" principle — no banners, no
// interstitials, every ad is opt-in and gives something real in return:
//   - energy: alongside the existing energy-drink item
//   - cash: alongside existing odd-jobs/allowance
//   - xp: a small post-session/post-match boost
//
// Production placements provisioned for this app. Use registered test devices
// in AdMob when personally testing ads on a Play release.
import { AdMob, RewardAdPluginEvents, type AdMobRewardItem } from '@capacitor-community/admob'
import { Capacitor } from '@capacitor/core'

export type AdPlacement = 'energy' | 'cash' | 'xp'

/** The browser build has no rewarded-ad SDK, so it must not offer ad buttons. */
export function rewardedAdsAvailable(): boolean {
  return Capacitor.isNativePlatform()
}

const AD_UNIT_IDS: Record<AdPlacement, string> = {
  energy: 'ca-app-pub-5886721718793058/3165887211',
  cash: 'ca-app-pub-5886721718793058/4997989428',
  xp: 'ca-app-pub-5886721718793058/8882032143',
}

const IS_TESTING = false

const DAILY_CAP = 5
const STORAGE_KEY = 'ks-ad-watch-log'

interface WatchLog {
  date: string // YYYY-MM-DD, local
  counts: Record<AdPlacement, number>
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
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
  return Math.max(0, DAILY_CAP - log.counts[placement])
}

let initialized = false
async function ensureInitialized() {
  if (initialized || !Capacitor.isNativePlatform()) return
  await AdMob.initialize({ initializeForTesting: IS_TESTING })
  initialized = true
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

  try {
    await ensureInitialized()
    const adId = AD_UNIT_IDS[placement]
    await AdMob.prepareRewardVideoAd({ adId, isTesting: IS_TESTING })
    const result: AdMobRewardItem = await new Promise((resolve, reject) => {
      let settled = false
      const handles: Promise<{ remove: () => Promise<void> }>[] = []
      const cleanup = () => { for (const h of handles) h.then((handle) => handle.remove()) }

      handles.push(AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward) => {
        settled = true
        cleanup()
        resolve(reward)
      }))
      handles.push(AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        if (!settled) { cleanup(); reject(new Error('dismissed-before-reward')) }
      }))
      handles.push(AdMob.addListener(RewardAdPluginEvents.FailedToShow, (err) => {
        cleanup()
        reject(err)
      }))
      AdMob.showRewardVideoAd().catch((err) => { cleanup(); reject(err) })
    })

    const log = readLog()
    log.counts[placement] += 1
    writeLog(log)
    return result
  } catch {
    // closed early, failed to load, or failed to show — no reward, no cap consumed
    return null
  }
}
