import { Share } from '@capacitor/share'
import { Capacitor } from '@capacitor/core'
import type { Player } from '../types/player'

export async function shareCareer(player: Player): Promise<void> {
  const madeIt = Boolean(player.turnedPro)
  const text = madeIt
    ? `${player.name} signed for ${player.turnedPro?.clubName} in Kickoff Star! ${player.career?.appearances ?? 0} appearances, ${player.career?.goals ?? 0} goals on the journey from school to pro.`
    : `${player.name}'s Kickoff Star journey: ${player.career?.appearances ?? 0} appearances and ${player.career?.goals ?? 0} goals. How far can you go?`
  const url = 'https://play.google.com/store/apps/details?id=com.vraxis.kickoffstar'
  if (Capacitor.isNativePlatform()) {
    await Share.share({ title: 'Kickoff Star career', text, url, dialogTitle: 'Share your career' })
  } else if (navigator.share) {
    await navigator.share({ title: 'Kickoff Star career', text, url })
  } else {
    await navigator.clipboard.writeText(`${text} ${url}`)
  }
}
