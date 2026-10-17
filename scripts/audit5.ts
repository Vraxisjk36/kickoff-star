// AUDIT 5 (P29) — economy, sub appearances, navigation.
//
// The headline risk with adding money to a progression game is that it becomes
// a shortcut: if cash can buy energy without limit, the fatigue system stops
// being a constraint, and if kit can buy attributes without limit, the
// potential system stops meaning anything. Both are measured here.
import 'fake-indexeddb/auto'
import { reseed } from '../src/engine/rng'
import {
  SHOP_ITEMS, shopFor, itemById, equipmentBoosts, effectiveValues, ageEquipment,
  monthlyAllowance, allowanceDue, ALLOWANCE_INTERVAL_WEEKS, REWARD_CYCLE, rewardForStreak,
  ODD_JOBS, availableJobs, formatMoney, type OwnedEquipment,
} from '../src/engine/economy'
import { initMatch, advanceToKeyMoment, resolvePlayerMoment, resolveScenarioBeat, resolveInjuryDecision } from '../src/engine/match'
import { generateTeam } from '../src/engine/teams'
import { initialCast } from '../src/engine/relationships'
import { NAV_ITEMS } from '../src/components/navItems'
import { baseRecovery } from '../src/engine/energy'
import type { Player } from '../src/types/player'

reseed(29029)
let fails = 0
const check = (c: boolean, m: string) => { if (!c) { fails++; console.error('  ✗', m) } else console.log('  ✓', m) }

function mkPlayer(over: Partial<Player> = {}): Player {
  const values: Record<string, number> = {}
  for (const k of ['finishing', 'passing', 'dribbling', 'firstTouch', 'pace', 'strength', 'stamina', 'agility', 'vision', 'composure', 'positioning', 'concentration']) values[k] = 10
  return {
    name: 'Sim Player', position: 'ST', potential: 14, preferredFoot: 'right', heightCm: 175,
    attributes: { kind: 'outfield', values },
    confidence: { value: 0, baseline: 0 }, fitness: { stamina: 70 },
    careerClock: { ageYears: 15, phase: 'grassroots-season', grassrootsSeason: 1 },
    matchRatings: [7, 7, 7], seasonGoals: 0, seasonAssists: 0,
    career: { goals: 4, assists: 2, appearances: 10, wins: 4, cleanSheets: 0, bestRating: 8, motmAwards: 1 },
    coachTrust: 0, reputation: 20, scoutWatchers: [], contractOffers: [],
    totalWeeksElapsed: 12, squadRole: 'starting-xi', recentInjuryCount: 0, injury: null,
    relationships: initialCast(), activeArcs: [], recentArcKeys: [],
    money: 50, equipment: [], consumables: {}, lastAllowanceWeek: 8, rewardStreak: 0, lastRewardWeek: -1,
    ...over,
  } as unknown as Player
}

// ---------------------------------------------------------------------------
console.log('\n[A] shop integrity')
{
  check(new Set(SHOP_ITEMS.map((i) => i.id)).size === SHOP_ITEMS.length, 'item ids unique')
  check(SHOP_ITEMS.every((i) => i.price > 0), 'everything costs something')
  for (const i of SHOP_ITEMS) {
    if (i.kind === 'consumable') {
      // P34: consumables are now percentage-of-max rather than flat values.
      check((i.energyPct ?? 0) > 0, `${i.id}: consumable restores a positive fraction of max energy`)
      check(!i.boosts, `${i.id}: consumables do not grant attributes`)
    } else {
      check(!!i.boosts && Object.keys(i.boosts).length > 0, `${i.id}: equipment grants something`)
      check((i.durationWeeks ?? 0) > 0, `${i.id}: equipment expires (${i.durationWeeks}w)`)
      // P30: the academy tier is priced for a scholarship wage and is allowed a
      // slightly bigger single boost. The real guard is unchanged and tested in
      // [B]: NOTHING can push an attribute past the player's potential, no
      // matter what they wear or what they paid for it.
      const cap = i.price >= 150 ? 3 : 2
      check(Object.values(i.boosts ?? {}).every((v) => v <= cap), `${i.id}: no single boost exceeds +${cap} (price ${i.price})`)
      check((i.durationWeeks ?? 0) <= 20, `${i.id}: even premium kit wears out (${i.durationWeeks}w)`)
    }
  }
  // GK/outfield filtering
  const gk = mkPlayer({ position: 'GK' } as Partial<Player>)
  const out = mkPlayer()
  check(shopFor(gk).some((i) => i.gkOnly), 'keepers can buy gloves')
  check(!shopFor(out).some((i) => i.gkOnly), 'outfielders cannot buy gloves')
  // age gating
  const young = mkPlayer({ careerClock: { ageYears: 14, phase: 'grassroots-season', grassrootsSeason: 1 } } as Partial<Player>)
  check(shopFor(young).length < shopFor(mkPlayer({ careerClock: { ageYears: 17, phase: 'grassroots-season', grassrootsSeason: 1 } } as Partial<Player>)).length,
    'older players unlock more of the shop')
}

// ---------------------------------------------------------------------------
console.log('\n[B] equipment can never break the potential system')
{
  // THE key balance guard: kit must never push an attribute past potential.
  const p = mkPlayer({ potential: 14 })
  const maxedEquipment: OwnedEquipment[] = SHOP_ITEMS
    .filter((i) => i.kind === 'equipment' && !i.gkOnly)
    .map((i) => ({ itemId: i.id, weeksRemaining: 10 }))
  const stacked = { ...p, equipment: maxedEquipment } as Player
  const vals = effectiveValues(stacked)
  const over = Object.entries(vals).filter(([, v]) => v > stacked.potential)
  check(over.length === 0, `even wearing EVERY item at once, nothing exceeds potential (${over.map(([k, v]) => `${k}=${v}`).join(', ') || 'none'})`)

  // and a player already at potential gains nothing from kit
  const atCeiling = { ...p, attributes: { kind: 'outfield', values: Object.fromEntries(Object.keys(p.attributes.values as object).map((k) => [k, 14])) } } as unknown as Player
  const ceilStacked = { ...atCeiling, equipment: maxedEquipment } as Player
  const before = atCeiling.attributes.values as Record<string, number>
  const after = effectiveValues(ceilStacked)
  check(Object.keys(before).every((k) => after[k] === before[k]), 'a player at their ceiling gains nothing from kit')

  // one item per slot is a store rule; verify the boost math itself is additive and bounded
  const boots = SHOP_ITEMS.find((i) => i.id === 'boots-elite')!
  const single = equipmentBoosts([{ itemId: boots.id, weeksRemaining: 5 }])
  check(Object.values(single).every((v) => v <= 2), 'single item boosts stay within +2 per attribute')

  // expiry actually removes the bonus
  let eq: OwnedEquipment[] = [{ itemId: 'boots-speed', weeksRemaining: 2 }]
  eq = ageEquipment(eq).equipment
  check(eq.length === 1 && eq[0].weeksRemaining === 1, 'equipment ages a week at a time')
  const final = ageEquipment(eq)
  check(final.equipment.length === 0 && final.expired.includes('boots-speed'), 'worn-out equipment is removed and reported')
  check(Object.keys(equipmentBoosts(final.equipment)).length === 0, 'expired kit grants nothing')
}

// ---------------------------------------------------------------------------
console.log('\n[C] money cannot trivialise the fatigue system')
{
  // How much energy can a player actually buy per month, against what a month
  // of resting gives them for free? If cash dwarfs rest, fatigue stops mattering.
  const p = mkPlayer({ careerClock: { ageYears: 15, phase: 'grassroots-season', grassrootsSeason: 1 } } as Partial<Player>)
  const allowance = monthlyAllowance(p)
  // P34: consumables are now percentage-of-max rather than flat values, so
  // "energy per £" is computed from the percentage tier (×100 for the max bar)
  // — this is the BEST CASE (buying into an empty bar); the cap means real
  // value is often lower, which is exactly the point of the redesign.
  const drink = itemById('energy-drink')!
  const shake = itemById('recovery-shake')!
  const bath = itemById('ice-bath')!
  const bestValue = Math.max(
    (drink.energyPct ?? 0) * 100 / drink.price,
    (shake.energyPct ?? 0) * 100 / shake.price,
    (bath.energyPct ?? 0) * 100 / bath.price,
  )
  const boughtEnergyPerMonth = allowance * bestValue
  const restEnergyPerMonth = baseRecovery({ fitness: { stamina: 50 } } as Player) * ALLOWANCE_INTERVAL_WEEKS

  console.log(`    allowance ${formatMoney(allowance)}/month · best value ${bestValue.toFixed(1)} energy per £`)
  console.log(`    → ${boughtEnergyPerMonth.toFixed(0)} energy/month purchasable vs ${restEnergyPerMonth.toFixed(0)} from resting`)
  check(boughtEnergyPerMonth < restEnergyPerMonth, 'allowance alone cannot out-supply resting — drinks supplement recovery, they do not replace it')
  // P34: repricing consumables to close the job-shift energy exploit (see [C]
  // below) pulled this from 43 to 29/month. 30 was never a real invariant —
  // just a round number — and the actual thing that matters (jobs cannot
  // out-earn resting) is what [C] checks directly. Lowered the floor rather
  // than reopening the exploit to keep a stale number green.
  check(boughtEnergyPerMonth > 20, `...but it is a meaningful top-up (${boughtEnergyPerMonth.toFixed(0)} energy/month), not a token`)

  // Jobs are capped at one a week, so a month is 4 shifts of the best-paying
  // job available. The invariant: converting a shift's wages entirely into
  // energy must return LESS than the shift cost, so working can never be a
  // recovery strategy — only a way to fund kit.
  const jobs = availableJobs(p)
  const bestPaying = [...jobs].sort((a, b) => b.pay - a.pay)[0]
  const perShiftNet = bestPaying.pay * bestValue - bestPaying.energyCost
  const monthlyNet = perShiftNet * ALLOWANCE_INTERVAL_WEEKS
  console.log(`    best shift (${bestPaying.id}): £${bestPaying.pay} → ${(bestPaying.pay * bestValue).toFixed(0)} energy bought, -${bestPaying.energyCost} spent → net ${perShiftNet.toFixed(0)}/shift`)
  check(perShiftNet < 0, `working is a net energy LOSS (${perShiftNet.toFixed(1)}/shift) — you work for money, never for stamina`)
  check(monthlyNet < restEnergyPerMonth, 'a month of shifts cannot out-supply resting')
  check(jobs.every((j) => j.pay * bestValue < j.energyCost), 'no individual job can be converted into a net energy gain')
  check(ODD_JOBS.every((j) => j.energyCost > 0), 'every job costs energy — no free money')
  check(ODD_JOBS.every((j) => j.pay / j.energyCost < 3), 'no job has a runaway pay-to-energy ratio')
}

// ---------------------------------------------------------------------------
console.log('\n[D] allowance behaves')
{
  const poorRelations = mkPlayer({ relationships: initialCast().map((r) => (r.kind === 'parent' ? { ...r, bond: -100 } : r)) } as Partial<Player>)
  const goodRelations = mkPlayer({ relationships: initialCast().map((r) => (r.kind === 'parent' ? { ...r, bond: 100 } : r)) } as Partial<Player>)
  check(monthlyAllowance(goodRelations) > monthlyAllowance(poorRelations), `parent bond pays a real dividend (${monthlyAllowance(goodRelations)} vs ${monthlyAllowance(poorRelations)})`)
  check(monthlyAllowance(goodRelations) / monthlyAllowance(poorRelations) < 2, 'but a good relationship is not a money printer')

  const young = mkPlayer({ careerClock: { ageYears: 14, phase: 'grassroots-season', grassrootsSeason: 1 } } as Partial<Player>)
  const older = mkPlayer({ careerClock: { ageYears: 19, phase: 'academy', grassrootsSeason: 1 } } as Partial<Player>)
  check(monthlyAllowance(older) > monthlyAllowance(young), `allowance grows with age (${monthlyAllowance(young)} → ${monthlyAllowance(older)})`)
  check(monthlyAllowance(young) < itemById('boots-elite')!.price, 'a 14-year-old cannot casually afford the best boots on one allowance')

  check(!allowanceDue(mkPlayer({ totalWeeksElapsed: 10, lastAllowanceWeek: 8 } as Partial<Player>)), 'allowance not due early')
  check(allowanceDue(mkPlayer({ totalWeeksElapsed: 12, lastAllowanceWeek: 8 } as Partial<Player>)), 'allowance due after the interval')
}

// ---------------------------------------------------------------------------
console.log('\n[E] weekly rewards')
{
  check(REWARD_CYCLE.length === 7, '7-step reward cycle')
  check(REWARD_CYCLE.every((r) => (r.money ?? 0) > 0 || !!r.itemId), 'every step gives something')
  check(REWARD_CYCLE.every((r) => !('attribute' in r)), 'rewards never grant attributes — a streak cannot buy a better player')
  // total value of a perfect 7-week streak must not dwarf the allowance
  // The check-in must never out-earn the parents: it's a supplement, not the
  // primary income. (careerSim caught the first cut doing exactly that, and
  // money ran to four figures inside three seasons.)
  const streakMoney = REWARD_CYCLE.reduce((a, r) => a + (r.money ?? 0), 0)
  const rewardPerMonth = (streakMoney / REWARD_CYCLE.length) * ALLOWANCE_INTERVAL_WEEKS
  const allowance = monthlyAllowance(mkPlayer())
  console.log(`    check-in pays ~${formatMoney(rewardPerMonth)}/month vs ${formatMoney(allowance)} allowance`)
  check(rewardPerMonth < allowance * 0.5, `weekly check-in stays a supplement, not the main income (${formatMoney(rewardPerMonth)}/month vs ${formatMoney(allowance)})`)
  check(REWARD_CYCLE.filter((r) => r.itemId).length >= 4, 'rewards skew toward consumables — energy relief is the point')
  check(rewardForStreak(99).day === 7, 'streak rewards cap at the top of the cycle')
  check(rewardForStreak(0).day === 1, 'a broken streak restarts at day 1')
}

// ---------------------------------------------------------------------------
console.log('\n[F] SUB APPEARANCES — being dropped must actually cost you')
{
  const team = generateTeam(4), opp = generateTeam(4)
  function playFull(role: string) {
    const p = mkPlayer({ squadRole: role } as Partial<Player>)
    let s = initMatch(p, team, opp, true)
    const entry = s.entryMinute
    let guard = 0
    while (!s.finished && guard++ < 200) {
      const r = advanceToKeyMoment(s, p)
      s = r.state
      if (r.keyMoment) {
        // Resolve the surfaced decision so a multi-beat V3.2 scenario can
        // genuinely advance. Calling advanceToKeyMoment again without a
        // choice just returns the same active beat forever.
        if (r.keyMoment.isInjuryDecision) s = resolveInjuryDecision(s, false, p)
        else if (r.keyMoment.scenarioId) s = resolveScenarioBeat(s, r.keyMoment, 0, 1, true, 1, 1, 'good')
        else s = resolvePlayerMoment(s, r.keyMoment, 1, true, 1, 1, p.position === 'GK', 'good')
      }
    }
    return { entry, moments: s.playerMoments, rating: s.playerRating, minutes: (90 + s.addedTime) - entry }
  }

  const starters = Array.from({ length: 30 }, () => playFull('starting-xi'))
  const benched = Array.from({ length: 30 }, () => playFull('bench'))
  const reserves = Array.from({ length: 30 }, () => playFull('reserves'))

  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const sEntry = avg(starters.map((r) => r.entry)), bEntry = avg(benched.map((r) => r.entry)), rEntry = avg(reserves.map((r) => r.entry))
  const sMoments = avg(starters.map((r) => r.moments)), bMoments = avg(benched.map((r) => r.moments)), rMoments = avg(reserves.map((r) => r.moments))
  console.log(`    starter: entry ${sEntry.toFixed(0)}' · ${sMoments.toFixed(2)} moments`)
  console.log(`    bench:   entry ${bEntry.toFixed(0)}' · ${bMoments.toFixed(2)} moments`)
  console.log(`    reserve: entry ${rEntry.toFixed(0)}' · ${rMoments.toFixed(2)} moments`)

  check(sEntry === 0, 'starters play from the first whistle')
  check(bEntry >= 55 && bEntry <= 70, `bench players come on in the last half-hour (avg ${bEntry.toFixed(0)}')`)
  check(rEntry > bEntry, 'reserves come on later than bench players')
  check(bMoments < sMoments, `coming off the bench genuinely means fewer chances (${bMoments.toFixed(2)} vs ${sMoments.toFixed(2)})`)
  // P63/P64 — this used to assert a strict 3-tier ordering
  // (starter > bench > reserve), matching the OLD graduated minutes-based
  // guarantee. Joel's explicit P63 spec replaced that with a flat floor —
  // any genuine substitute appearance, whether a bench cameo or an even
  // briefer reserve one, is now guaranteed the same minimum (2). Reserve
  // should still never guarantee MORE than bench, but they're no longer
  // required to be strictly less — asserting comparable instead of strict.
  check(Math.abs(rMoments - bMoments) <= 0.6, `reserve and bench cameos land in the same guaranteed range (reserve ${rMoments.toFixed(2)} vs bench ${bMoments.toFixed(2)})`)
  check(bMoments > 0, 'but a substitute still gets involved — being benched is a setback, not a dead match')
}

// ---------------------------------------------------------------------------
console.log('\n[G] navigation fits a phone')
{
  check(NAV_ITEMS.length === 6, `6 nav items, one row (got ${NAV_ITEMS.length})`)
  check(new Set(NAV_ITEMS.map((i) => i.tab)).size === NAV_ITEMS.length, 'no duplicate nav destinations')
  check(NAV_ITEMS.every((i) => i.label.length <= 8), 'nav labels short enough not to wrap')
  check(!NAV_ITEMS.some((i) => i.tab === 'scouts'), 'scouts is no longer a nav tab (moved into the player page)')
  check(!NAV_ITEMS.some((i) => i.tab === 'table'), 'table is no longer its own tab (merged into league)')
  check(NAV_ITEMS.some((i) => i.tab === 'shop'), 'shop is reachable from the nav')
}

console.log(fails === 0 ? '\n✅ AUDIT 5 PASSED' : `\n❌ AUDIT 5: ${fails} CHECK(S) FAILED`)
process.exit(fails ? 1 : 0)
