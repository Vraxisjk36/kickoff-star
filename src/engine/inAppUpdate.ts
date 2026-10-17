import { Capacitor, registerPlugin } from '@capacitor/core'

const update = registerPlugin<{ check(): Promise<void> }>('KickoffUpdate')
const LAST_CHECK_KEY = 'kickoff-star-update-check'
const CHECK_INTERVAL = 24 * 60 * 60 * 1000
let checking = false

/** Play decides whether a newer eligible version is available. The menu is a safe break in play. */
export async function checkForPlayUpdate(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android' || checking) return
  const last = Number(localStorage.getItem(LAST_CHECK_KEY) ?? 0)
  if (Date.now() - last < CHECK_INTERVAL) return
  checking = true
  try {
    await update.check()
    localStorage.setItem(LAST_CHECK_KEY, String(Date.now()))
  } catch (error) { console.warn('[kickoff-star] update check unavailable', error) }
  finally { checking = false }
}
