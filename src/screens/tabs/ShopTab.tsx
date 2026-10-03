import { useState, useEffect, useRef } from 'react'
import type { Player } from '../../types/player'
import { useCareerStore } from '../../store/careerStore'
import {
  shopFor, itemById, equipmentBoosts, monthlyAllowance, allowanceDue,
  availableJobs, rewardForStreak, formatMoney, canWorkThisWeek, weeklyLivingCost, ALLOWANCE_INTERVAL_WEEKS,
  type ShopItem,
} from '../../engine/economy'
import { Panel, EmptyNote, Icon } from '../../components/ui'
import iconContract from '../../assets/icons/contract.png'
import iconCoins from '../../assets/icons/coins.png'
import iconKitbag from '../../assets/icons/kitbag.png'
import iconEnergy from '../../assets/icons/energy.png'
import iconBoots from '../../assets/icons/boots.png'
import iconTraining from '../../assets/icons/training.png'
import AnimatedNumber from '../../components/AnimatedNumber'
import { watchRewardedAd, remainingToday, rewardedAdsAvailable } from '../../engine/ads'
import { getAgent, netWage } from '../../engine/agents'

// P29/P34 — the money screen. Everything is earnable in-game: allowance, odd
// jobs, the weekly check-in, and now an optional rewarded ad for a free
// energy top-up (same 20% tier as the cheapest drink — an ad is a free
// alternative to spending, never a better deal than spending). No purchases,
// no forced ads, nothing gated behind either.

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[9px] text-ks-muted">{label}</span>
      <span className="text-[10px] text-ks-ink">{value}</span>
    </div>
  )
}

function Money({ amount }: { amount: number }) {
  return <span className="font-display text-ks-gold tabular-nums">{formatMoney(amount)}</span>
}

function ItemCard({ item, player, onBuy }: { item: ShopItem; player: Player; onBuy: (id: string) => void }) {
  const affordable = (player.money ?? 0) >= item.price
  const owned = (player.equipment ?? []).find((o) => o.itemId === item.id)
  const held = (player.consumables ?? {})[item.id] ?? 0

  return (
    <div className={`rounded-lg border px-3 py-2.5 transition-colors ${owned ? 'border-ks-gold/50 bg-ks-gold/5' : 'border-ks-border bg-[#0f0f0d]'}`}>
      <div className="flex items-start gap-2 mb-1">
        <span className="text-[11px] text-ks-ink flex-1 leading-snug">{item.name}</span>
        {held > 0 && <span className="text-[9px] text-ks-gold uppercase tracking-wider shrink-0">x{held}</span>}
        {owned && <span className="text-[9px] text-ks-gold uppercase tracking-wider shrink-0">{owned.condition ?? Math.round((owned.weeksRemaining / Math.max(1, item.durationWeeks ?? owned.weeksRemaining)) * 100)}% · {owned.weeksRemaining}w</span>}
      </div>

      {(player.finances?.transactions.length ?? 0) > 0 && (
        <Panel title={<span className="flex items-center gap-1"><Icon src={iconCoins} />recent transactions</span>}>
          <div className="flex flex-col gap-1.5">
            {[...(player.finances?.transactions ?? [])].reverse().slice(0, 6).map((transaction) => (
              <div key={transaction.id} className="flex items-center gap-2 text-[10px]">
                <span className="text-ks-muted w-8">wk {transaction.week}</span>
                <span className="text-ks-ink flex-1 truncate">{transaction.description}</span>
                <span className={transaction.amount >= 0 ? 'text-green-500' : 'text-orange-400'}>{transaction.amount >= 0 ? '+' : '−'}{formatMoney(Math.abs(transaction.amount))}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}
      <p className="text-[10px] text-ks-muted leading-relaxed mb-2">{item.description}</p>
      <button
        onClick={() => onBuy(item.id)}
        disabled={!affordable}
        className={`w-full rounded-lg py-2 font-display tracking-widest text-[10px] uppercase transition-all ${
          affordable
            ? 'bg-ks-gold text-ks-black active:scale-[0.98] shadow-[0_2px_12px_rgba(212,175,55,0.25)]'
            : 'border border-ks-border text-ks-muted/50'
        }`}
      >
        {affordable ? `buy · ${formatMoney(item.price)}` : `${formatMoney(item.price)} — can't afford`}
      </button>
    </div>
  )
}

export default function ShopTab({ player }: { player: Player }) {
  // P54 — ChatGPT review: "count the money instead of just showing the
  // number, people love it." Only animates on a REAL change — prevMoney
  // lags one render behind, so AnimatedNumber gets a genuine from->to on
  // the render right after money changes, not a restart every re-render.
  const currentMoney = player.money ?? 0
  const prevMoneyRef = useRef(currentMoney)
  const [displayFrom, setDisplayFrom] = useState(currentMoney)
  useEffect(() => {
    if (prevMoneyRef.current !== currentMoney) {
      setDisplayFrom(prevMoneyRef.current)
      prevMoneyRef.current = currentMoney
    }
  }, [currentMoney])

  const buyItem = useCareerStore((s) => s.buyItem)
  const consumeItem = useCareerStore((s) => s.consumeItem)
  const claimWeeklyReward = useCareerStore((s) => s.claimWeeklyReward)
  const workOddJob = useCareerStore((s) => s.workOddJob)
  const grantCashFromAd = useCareerStore((s) => s.grantCashFromAd)
  const sendMoneyHome = useCareerStore((s) => s.sendMoneyHome)
  const [flash, setFlash] = useState<string | null>(null)
  const [section, setSection] = useState<'kit' | 'jobs'>('kit')

  const say = (msg: string) => { setFlash(msg); window.setTimeout(() => setFlash(null), 2600) }

  const items = shopFor(player)
  const consumables = items.filter((i) => i.kind === 'consumable')
  const equipment = items.filter((i) => i.kind === 'equipment')
  const boosts = equipmentBoosts(player.equipment)
  const held = Object.entries(player.consumables ?? {}).filter(([, n]) => n > 0)

  const week = player.totalWeeksElapsed ?? 0
  const rewardAvailable = (player.lastRewardWeek ?? -1) < week
  const nextReward = rewardForStreak((player.lastRewardWeek ?? -1) === week - 1 ? (player.rewardStreak ?? 0) + 1 : 0)
  const weeksToAllowance = ALLOWANCE_INTERVAL_WEEKS - (week - (player.lastAllowanceWeek ?? 0))

  return (
    <div className="flex flex-col gap-2.5">
      {/* wallet */}
      <div className="relative overflow-hidden rounded-xl border border-ks-gold/30 bg-gradient-to-br from-[#1a1710] to-[#0d0d0b] px-4 py-3.5">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 100% at 85% 20%, rgba(212,175,55,0.14), transparent 65%)' }} />
        <div className="relative z-10 flex items-end justify-between">
          <div>
            <div className="font-display tracking-[0.25em] text-[9px] text-ks-muted uppercase mb-0.5">your money</div>
            <div className="font-display text-3xl text-ks-gold tabular-nums leading-none">£<AnimatedNumber from={displayFrom} to={currentMoney} duration={700} /></div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-ks-muted uppercase tracking-wider">allowance</div>
            <div className="text-[11px] text-ks-ink">{formatMoney(monthlyAllowance(player))} / {ALLOWANCE_INTERVAL_WEEKS}wks</div>
            <div className="text-[9px] text-ks-muted">
              {allowanceDue(player) ? 'due now' : `in ${Math.max(0, weeksToAllowance)}w`}
            </div>
          </div>
        </div>
      </div>

      {/* P30: once you're on a scholarship, wages replace the allowance as the
          main income — so the contract belongs on the money screen. */}
      {player.contract && (
        <Panel title={<span className="flex items-center gap-1"><Icon src={iconContract} />your contract</span>}>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[11px] text-ks-ink">{player.contract.clubName}</div>
                <div className="text-[9px] text-ks-muted uppercase tracking-wider">scholarship</div>
              </div>
              <div className="text-right">
                <div className="font-display text-xl text-ks-gold leading-none">
                  {formatMoney(netWage(player.contract.terms.weeklyWage, player.agentId))}<span className="text-xs text-ks-muted">/wk</span>
                </div>
                {getAgent(player.agentId)?.commission ? (
                  <div className="text-[9px] text-ks-muted">
                    {formatMoney(player.contract.terms.weeklyWage)} gross · {getAgent(player.agentId)!.commission}% to {getAgent(player.agentId)!.name}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="border-t border-ks-border/60 pt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5">
              <MiniRow label="per appearance" value={formatMoney(player.contract.terms.appearanceFee)} />
              <MiniRow label="per goal" value={formatMoney(player.contract.terms.goalBonus)} />
              <MiniRow label="digs & travel" value={`−${formatMoney(weeklyLivingCost(player))}/wk`} />
              <MiniRow label="career earnings" value={formatMoney(player.careerEarnings ?? 0)} />
              <MiniRow label="agent fees paid" value={formatMoney(player.agentFeesPaid ?? 0)} />
            </div>
          </div>
        </Panel>
      )}

      {flash && <div className="rounded-lg border border-ks-gold/40 bg-ks-gold/10 px-3 py-2 text-[11px] text-ks-gold">{flash}</div>}

      {/* P33 — the sink that means something */}
      {(player.money ?? 0) >= 20 && (
        <Panel title={<span className="flex items-center gap-1"><Icon src={iconCoins} />send money home</span>}>
          <p className="text-[10px] text-ks-muted leading-relaxed mb-2.5">
            They covered your boots, your travel and your subs for years. You can put some of it back.
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {[20, 50, 120].filter((a) => (player.money ?? 0) >= a).map((amt) => (
              <button
                key={amt}
                onClick={() => {
                  const r = sendMoneyHome(amt)
                  say(r.ok ? `sent ${formatMoney(amt)} home — they were made up (+${r.bondGain} bond)` : "couldn't do that")
                }}
                className="rounded-lg border border-ks-gold/40 bg-ks-gold/5 py-2.5 text-[11px] font-display text-ks-gold"
              >
                {formatMoney(amt)}
              </button>
            ))}
          </div>
        </Panel>
      )}

      {/* weekly check-in */}
      <button
        onClick={() => {
          const r = claimWeeklyReward()
          say(r.claimed ? `claimed: ${r.label}` : 'already claimed this week')
        }}
        disabled={!rewardAvailable}
        className={`rounded-xl border px-4 py-3 text-left transition-all ${
          rewardAvailable
            ? 'border-ks-gold bg-ks-gold/10 active:scale-[0.99] animate-[pulseglow_2.5s_ease-in-out_infinite]'
            : 'border-ks-border bg-[#0f0f0d] opacity-60'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className={`font-display tracking-widest text-[10px] uppercase ${rewardAvailable ? 'text-ks-gold' : 'text-ks-muted'}`}>
              weekly check-in
            </div>
            <div className="text-[11px] text-ks-ink mt-0.5">
              {rewardAvailable ? `claim ${nextReward.label}` : 'come back next week'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-ks-muted uppercase tracking-wider">streak</div>
            <div className="font-display text-ks-gold text-lg leading-none">{(player.rewardStreak ?? 0) + 1}</div>
          </div>
        </div>
      </button>

      {/* what you're carrying / wearing */}
      <Panel title={<span className="flex items-center gap-1"><Icon src={iconKitbag} />your kitbag</span>}>
        {held.length === 0 && Object.keys(boosts).length === 0 ? (
          <EmptyNote>Nothing in the bag. Buy something below.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-2">
            {held.map(([id, n]) => {
              const item = itemById(id)
              if (!item) return null
              const full = player.fitness.stamina >= 100
              return (
                <div key={id} className="flex items-center gap-2">
                  <span className="text-[11px] text-ks-ink flex-1 truncate">{item.name} <span className="text-ks-muted">x{n}</span></span>
                  <button
                    onClick={() => {
                      const r = consumeItem(id)
                      say(r.ok ? `+${r.energyGained} energy` : full ? 'already full on energy' : "couldn't use that")
                    }}
                    disabled={full}
                    className="rounded-md border border-ks-gold/50 text-ks-gold text-[10px] uppercase tracking-wider px-2.5 py-1 disabled:opacity-30"
                  >
                    use
                  </button>
                </div>
              )
            })}
            {Object.keys(boosts).length > 0 && (
              <div className="border-t border-ks-border/60 pt-2 mt-1">
                <div className="text-[9px] text-ks-muted uppercase tracking-wider mb-1">active kit bonuses</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(boosts).map(([attr, v]) => (
                    <span key={attr} className="text-[10px] text-green-500 border border-green-500/30 bg-green-500/5 rounded-md px-1.5 py-0.5">
                      {attr} +{v}
                    </span>
                  ))}
                </div>
                <p className="text-[9px] text-ks-muted mt-1.5">Kit can't push an attribute above your potential.</p>
              </div>
            )}
          </div>
        )}
      </Panel>

      <div className="flex gap-1.5 p-1 rounded-xl bg-[#0f0f0d] border border-ks-border">
        {(['kit', 'jobs'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setSection(v)}
            className={`flex-1 rounded-lg py-2 font-display tracking-widest text-[10px] uppercase transition-all ${
              section === v ? 'bg-ks-gold text-ks-black' : 'text-ks-muted'
            }`}
          >
            {v === 'kit' ? 'shop' : 'earn money'}
          </button>
        ))}
      </div>

      {section === 'kit' ? (
        <>
          <Panel title={<span className="flex items-center gap-1"><Icon src={iconEnergy} />energy & recovery</span>}>
            <div className="flex flex-col gap-2">
              {consumables.map((i) => <ItemCard key={i.id} item={i} player={player} onBuy={(id) => {
                const r = buyItem(id)
                say(r.ok ? `bought ${itemById(id)?.name}` : r.reason ?? 'could not buy that')
              }} />)}
            </div>
          </Panel>

          <Panel title={<span className="flex items-center gap-1"><Icon src={iconBoots} />boots & equipment</span>}>
            <div className="flex flex-col gap-2">
              {equipment.map((i) => <ItemCard key={i.id} item={i} player={player} onBuy={(id) => {
                const r = buyItem(id)
                say(r.ok ? `bought ${itemById(id)?.name}` : r.reason ?? 'could not buy that')
              }} />)}
            </div>
          </Panel>
          <p className="text-[10px] text-ks-muted leading-relaxed px-1">
            Equipment wears out after a set number of weeks, and you can only wear one item per slot —
            new boots replace your old pair.
          </p>
        </>
      ) : (
        <Panel title={<span className="flex items-center gap-1"><Icon src={iconTraining} />odd jobs</span>}>
          <div className="flex flex-col gap-2">
            {availableJobs(player).map((job) => {
              const canDo = player.fitness.stamina >= job.energyCost && canWorkThisWeek(player)
              return (
                <div key={job.id} className="rounded-lg border border-ks-border bg-[#0f0f0d] px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[11px] text-ks-ink flex-1">{job.label}</span>
                    <Money amount={job.pay} />
                  </div>
                  <p className="text-[10px] text-ks-muted mb-2">{job.description}</p>
                  <button
                    onClick={() => {
                      const r = workOddJob(job.id)
                      say(r.ok ? `earned ${formatMoney(r.pay ?? 0)}` : canWorkThisWeek(player) ? 'too drained for that' : 'already worked this week')
                    }}
                    disabled={!canDo}
                    className={`w-full rounded-lg py-2 font-display tracking-widest text-[10px] uppercase ${
                      canDo ? 'border border-ks-gold/50 text-ks-gold' : 'border border-ks-border text-ks-muted/40'
                    }`}
                  >
                    work · −{job.energyCost} energy
                  </button>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-ks-muted leading-relaxed mt-2">
            One job a week, and it costs more energy than the wages can buy back in drinks —
            you work for boots, not for stamina.
          </p>
          {/* P64 — a free alternative that costs no in-game energy, just
              real attention — deliberately paid less than the cheapest
              odd job since it doesn't compete with the actual economy. */}
          {rewardedAdsAvailable() && remainingToday('cash') > 0 && (
            <button
              onClick={async () => {
                const reward = await watchRewardedAd('cash')
                if (reward) { grantCashFromAd(10); say('earned £10') }
              }}
              className="w-full mt-2 rounded-lg border border-ks-border bg-[#0f0f0d] py-2 font-display tracking-widest text-[10px] uppercase text-ks-muted"
            >
              watch ad for £10 · {remainingToday('cash')} left today
            </button>
          )}
        </Panel>
      )}
    </div>
  )
}
