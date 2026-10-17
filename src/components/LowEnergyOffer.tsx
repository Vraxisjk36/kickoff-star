import { useState } from 'react'
import type { Player } from '../types/player'
import { useCareerStore } from '../store/careerStore'
import { itemById } from '../engine/economy'
import { remainingToday, watchRewardedAd } from '../engine/ads'

export default function LowEnergyOffer({ player, onClose }: { player: Player; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const buyItem = useCareerStore(s => s.buyItem)
  const consumeItem = useCareerStore(s => s.consumeItem)
  const restoreEnergyFromAd = useCareerStore(s => s.restoreEnergyFromAd)
  const drink = itemById('energy-drink')!
  const owned = (player.consumables?.[drink.id] ?? 0) > 0
  const affordable = (player.money ?? 0) >= drink.price

  async function watch() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const reward = await watchRewardedAd('energy')
      if (reward) { restoreEnergyFromAd(20); onClose() }
      else setError('No ad was completed. You can try again or continue playing.')
    } finally { setBusy(false) }
  }

  function recoverWithDrink() {
    if (busy) return
    if (!owned && (!affordable || !buyItem(drink.id).ok)) return
    const result = consumeItem(drink.id)
    if (result.ok) onClose()
    else setError('Recovery is unavailable right now.')
  }

  return <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/75 px-3 pb-[calc(var(--safe-bottom)+.75rem)]" role="dialog" aria-modal="true" aria-labelledby="low-energy-title">
    <div className="w-full max-w-md rounded-2xl border border-ks-gold/50 bg-[#13140e] p-5 shadow-[0_0_40px_rgba(212,175,55,.16)]">
      <div className="font-display text-[10px] tracking-[.2em] text-ks-gold">MATCH FITNESS</div>
      <h2 id="low-energy-title" className="font-display text-2xl text-ks-ink mt-2">Energy is low · {Math.round(player.fitness.stamina)}%</h2>
      <p className="text-sm text-ks-muted mt-2">Top up before your next match, or keep playing and recover on a rest day.</p>
      <div className="grid gap-2 mt-5">
        {remainingToday('energy') > 0 && <button type="button" disabled={busy} onClick={watch} className="min-h-14 rounded-xl bg-ks-gold text-ks-black font-display text-sm tracking-wide disabled:opacity-50">{busy ? 'Loading ad…' : 'WATCH AD · +20 ENERGY'}</button>}
        {(owned || affordable) && <button type="button" disabled={busy} onClick={recoverWithDrink} className="min-h-12 rounded-xl border border-ks-gold/50 text-ks-gold font-display text-xs disabled:opacity-50">{owned ? 'USE ENERGY DRINK · +20' : `BUY & USE ENERGY DRINK · £${drink.price}`}</button>}
        <button type="button" disabled={busy} onClick={onClose} className="min-h-11 text-ks-muted text-sm disabled:opacity-50">Keep playing</button>
      </div>
      {error && <p role="status" className="text-xs text-orange-300 mt-2">{error}</p>}
    </div>
  </div>
}
