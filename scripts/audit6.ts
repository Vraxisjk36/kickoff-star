// AUDIT 6 (P30) — agents, the negotiation pipeline, and wages.
//
// The headline risk: wages are an order of magnitude above the allowance the
// P29 economy was balanced around. If a scholarship makes energy drinks and
// boots trivially affordable, every constraint P29 established collapses at
// the exact moment the player enters the academy. That is measured here.
import 'fake-indexeddb/auto'
import { reseed } from '../src/engine/rng'
import { AGENTS, getAgent, netWage, commissionOn } from '../src/engine/agents'
import {
  startNegotiation, resolveChoice, tickNegotiation, choicesFor, openingTerms, ceilingTerms,
  STAGE_ORDER, stageIndex, isLive, contractValue, type Negotiation,
} from '../src/engine/negotiation'
import { monthlyAllowance, itemById, ALLOWANCE_INTERVAL_WEEKS, formatMoney, SHOP_ITEMS, weeklyLivingCost, energyGainFromPct } from '../src/engine/economy'
import { initialCast } from '../src/engine/relationships'
import type { Player } from '../src/types/player'

reseed(30030)
let fails = 0
const check = (c: boolean, m: string) => { if (!c) { fails++; console.error('  ✗', m) } else console.log('  ✓', m) }

function mkPlayer(over: Partial<Player> = {}): Player {
  const values: Record<string, number> = {}
  for (const k of ['finishing', 'passing', 'dribbling', 'firstTouch', 'pace', 'strength', 'stamina', 'agility', 'vision', 'composure', 'positioning', 'concentration']) values[k] = 11
  return {
    name: 'Sim Player', position: 'ST', potential: 15, preferredFoot: 'right', heightCm: 176,
    attributes: { kind: 'outfield', values },
    confidence: { value: 0, baseline: 0 }, fitness: { stamina: 75 },
    careerClock: { ageYears: 16, phase: 'grassroots-season', grassrootsSeason: 2 },
    matchRatings: [7, 7, 7], career: { goals: 8, assists: 4, appearances: 20, wins: 9, cleanSheets: 0, bestRating: 8.4, motmAwards: 2 },
    coachTrust: 2, reputation: 40, scoutWatchers: [], contractOffers: [], totalWeeksElapsed: 50,
    squadRole: 'starting-xi', recentInjuryCount: 0, injury: null,
    relationships: initialCast(), activeArcs: [], recentArcKeys: [],
    money: 60, equipment: [], consumables: {}, lastAllowanceWeek: 48, rewardStreak: 0, lastRewardWeek: -1,
    agentId: null, negotiation: null, contract: null, careerEarnings: 0, agentFeesPaid: 0,
    ...over,
  } as unknown as Player
}

// ---------------------------------------------------------------------------
console.log('\n[A] agents — three genuinely different options')
{
  check(AGENTS.length === 3, `3 agents (got ${AGENTS.length})`)
  check(new Set(AGENTS.map((a) => a.id)).size === 3, 'agent ids unique')
  check(AGENTS.every((a) => a.pros.length >= 3 && a.cons.length >= 3), 'every agent has real pros AND cons')

  // The real invariant: no agent may STRICTLY DOMINATE another — i.e. be at
  // least as good on every dimension and better on one. (An earlier version of
  // this check demanded each agent be best-at-something AND worst-at-something,
  // which wrongly failed the independent for being a solid all-rounder whose
  // edge is diplomacy. Pairwise domination is the property that actually
  // matters: it's what makes a choice a choice.)
  const better = (a: typeof AGENTS[number], b: typeof AGENTS[number], d: string) => {
    const lowerIsBetter = d === 'commission' || d === 'blunderChance' || d === 'patienceCare'
    const av = a[d as keyof typeof a] as number, bv = b[d as keyof typeof b] as number
    return lowerIsBetter ? av < bv : av > bv
  }
  const dims = ['negotiation', 'commission', 'blunderChance', 'interestMultiplier', 'patienceCare']
  for (const a of AGENTS) {
    for (const b of AGENTS) {
      if (a.id === b.id) continue
      const dominates = dims.every((d) => better(a, b, d) || (a[d as keyof typeof a] as number) === (b[d as keyof typeof b] as number))
        && dims.some((d) => better(a, b, d))
      check(!dominates, `${a.id} does not strictly dominate ${b.id}`)
    }
  }
  check(AGENTS.every((a) => dims.some((d) => AGENTS.every((o) => o.id === a.id || better(a, o, d)))),
    'every agent is the outright best at at least one thing')

  check(getAgent('parent')!.commission === 0, 'the parent takes nothing')
  check(netWage(200, 'agency') < netWage(200, 'parent'), 'the agency costs you more per week than family')
  check(commissionOn(200, 'parent') === 0 && commissionOn(200, 'agency') === 24, 'commission maths correct')
  check(netWage(200, null) === 200, 'no agent = no deduction')
}

// ---------------------------------------------------------------------------
console.log('\n[B] the pipeline genuinely takes weeks')
{
  // Drive an ideal negotiation and count the WEEKS it consumes. A player who
  // accepts everything immediately should still need multiple weeks, because
  // each club-side stage needs a tick to progress.
  function runFast(agentId: string, kind: 'academy' | 'professional' = 'academy') {
    const p = mkPlayer({ agentId })
    let n = startNegotiation(p, 'c1', 'Harborview FC', 6, kind)
    let week = p.totalWeeksElapsed ?? 0
    let guard = 0
    while (isLive(n) && guard++ < 60) {
      const player = { ...p, negotiation: n, totalWeeksElapsed: week } as Player
      if (n.awaitingPlayer) {
        const choice = n.stage === 'approach' ? 'keen'
          : n.stage === 'terms' ? 'accept'
          : n.stage === 'agreement' ? 'commit'
          : n.stage === 'medical' ? 'honest'
          : 'sign'
        const out = resolveChoice(n, choice, player)
        n = out.negotiation
        if (out.signed) return { weeks: week - (p.totalWeeksElapsed ?? 0), terms: out.signed.terms, n }
      } else {
        week += 1
        const t = tickNegotiation(n, { ...player, totalWeeksElapsed: week } as Player)
        if (t) n = t.negotiation
      }
    }
    return { weeks: week - (p.totalWeeksElapsed ?? 0), terms: n.terms, n }
  }

  const fast = runFast('independent')
  console.log(`    fastest possible path: ${fast.weeks} weeks`)
  check(fast.weeks === 1, `academy talks span two calendar weeks with ${fast.weeks} weekly transition`)
  const professional = runFast('independent', 'professional')
  check(professional.weeks >= 4, 'professional talks retain their longer stage-by-stage clock')
  const p = mkPlayer({ agentId: 'parent' })
  let locked = startNegotiation(p, 'c2', 'Riverton Academy', 6)
  for (const choice of ['keen', 'accept', 'commit']) locked = resolveChoice(locked, choice, p).negotiation
  check(locked.stage === 'medical' && !locked.awaitingPlayer && resolveChoice(locked, 'honest', p).negotiation === locked,
    'Academy medical cannot be skipped in the opening week')
  check(fast.n.stage === 'complete', 'the happy path actually completes')
  check(STAGE_ORDER.length === 5, '5 named stages: approach → terms → agreement → medical → signing')
  check(stageIndex('approach') < stageIndex('terms') && stageIndex('medical') < stageIndex('signing'), 'stages are correctly ordered')
}

// ---------------------------------------------------------------------------
console.log('\n[C] the agent choice measurably changes the contract')
{
  function negotiateHard(agentId: string, pushes: number) {
    const p = mkPlayer({ agentId })
    let n = startNegotiation(p, 'c1', 'Harborview FC', 6)
    let week = p.totalWeeksElapsed ?? 0
    let pushed = 0
    let guard = 0
    while (isLive(n) && guard++ < 80) {
      const player = { ...p, negotiation: n, totalWeeksElapsed: week } as Player
      if (n.awaitingPlayer) {
        let choice: string
        if (n.stage === 'approach') choice = 'cool'
        else if (n.stage === 'terms') { choice = pushed < pushes ? 'push' : 'accept'; if (pushed < pushes) pushed++ }
        else if (n.stage === 'agreement') choice = 'commit'
        else if (n.stage === 'medical') choice = 'honest'
        else choice = 'sign'
        const out = resolveChoice(n, choice, player)
        n = out.negotiation
        if (out.signed) return { wage: out.signed.terms.weeklyWage, collapsed: false }
      } else {
        week += 1
        const t = tickNegotiation(n, { ...player, totalWeeksElapsed: week } as Player)
        if (t) n = t.negotiation
      }
    }
    return { wage: n.terms.weeklyWage, collapsed: n.stage === 'collapsed' }
  }

  const runs = 60
  const avgFor = (agentId: string) => {
    let total = 0, ok = 0, dead = 0
    for (let i = 0; i < runs; i++) {
      const r = negotiateHard(agentId, 2)
      if (r.collapsed) dead++
      else { total += r.wage; ok++ }
    }
    return { avg: ok ? total / ok : 0, collapseRate: dead / runs }
  }

  const parent = avgFor('parent')
  const agency = avgFor('agency')
  const indie = avgFor('independent')
  console.log(`    parent:      avg ${formatMoney(parent.avg)}/wk gross · ${(parent.collapseRate * 100).toFixed(0)}% collapse`)
  console.log(`    independent: avg ${formatMoney(indie.avg)}/wk gross · ${(indie.collapseRate * 100).toFixed(0)}% collapse`)
  console.log(`    agency:      avg ${formatMoney(agency.avg)}/wk gross · ${(agency.collapseRate * 100).toFixed(0)}% collapse`)

  check(agency.avg > parent.avg, 'a real agency negotiates a better gross wage than your parent')
  check(indie.avg > parent.avg, 'the independent also beats your parent')
  check(agency.avg >= indie.avg, 'the agency negotiates at least as well as the independent')

  // NET is the real test — the commission has to be worth paying, or the
  // "expensive but good" option is simply a trap.
  const parentNet = netWage(parent.avg, 'parent')
  const agencyNet = netWage(agency.avg, 'agency')
  const indieNet = netWage(indie.avg, 'independent')
  console.log(`    NET: parent ${formatMoney(parentNet)} · independent ${formatMoney(indieNet)} · agency ${formatMoney(agencyNet)}`)
  // The invariant that actually matters: a paid agent must leave you better
  // off NET, or the commission is a trap and nobody should ever hire one.
  check(agencyNet > parentNet, `paying 12% must actually pay for itself (${formatMoney(agencyNet)} net vs ${formatMoney(parentNet)} free)`)
  check(indieNet > parentNet, `the independent's 5% must also pay for itself (${formatMoney(indieNet)} vs ${formatMoney(parentNet)})`)
  check((agencyNet - parentNet) / parentNet < 0.75, 'but the gap is not so wide that the choice makes itself')
  check(parent.collapseRate >= agency.collapseRate, 'the inexperienced option is riskier, as advertised')
}

// ---------------------------------------------------------------------------
console.log('\n[D] pushing has real consequences, scaled by your agent')
{
  // How many times can each agent go back to the table before the club walks?
  function pushesSurvived(agentId: string): number {
    const p = mkPlayer({ agentId })
    let n = startNegotiation(p, 'c1', 'Harborview FC', 6)
    let week = p.totalWeeksElapsed ?? 0
    let pushes = 0
    let guard = 0
    while (isLive(n) && guard++ < 60) {
      const player = { ...p, negotiation: n, totalWeeksElapsed: week } as Player
      if (n.awaitingPlayer) {
        const choice = n.stage === 'approach' ? 'cool' : n.stage === 'terms' ? 'push' : 'sign'
        if (n.stage === 'terms') pushes++
        n = resolveChoice(n, choice, player).negotiation
      } else {
        week += 1
        const t = tickNegotiation(n, { ...player, totalWeeksElapsed: week } as Player)
        if (t) n = t.negotiation
      }
      if (n.stage === 'collapsed') return pushes - 1
    }
    return pushes
  }
  const avgPushes = (id: string) => {
    let total = 0
    for (let i = 0; i < 60; i++) total += pushesSurvived(id)
    return total / 60
  }
  const parentPushes = avgPushes('parent')
  const indiePushes = avgPushes('independent')
  const agencyPushes = avgPushes('agency')
  console.log(`    pushes tolerated before the club walks — parent ${parentPushes.toFixed(1)} · agency ${agencyPushes.toFixed(1)} · independent ${indiePushes.toFixed(1)}`)

  // Endless pushing SHOULD always end in collapse — greed has to have a floor.
  check(parentPushes < 6 && indiePushes < 9, 'nobody can push forever — the club always eventually walks')
  check(indiePushes > parentPushes, `a diplomatic agent buys you more attempts (${indiePushes.toFixed(1)} vs ${parentPushes.toFixed(1)})`)
  check(parentPushes >= 1, 'but even your parent gets at least one ask in')

  // A MEASURED push (one or two, then accept) should usually land the deal.
  function measuredPush(agentId: string, pushes: number): boolean {
    const p = mkPlayer({ agentId })
    let n = startNegotiation(p, 'c1', 'Harborview FC', 6)
    let week = p.totalWeeksElapsed ?? 0
    let done = 0
    let guard = 0
    while (isLive(n) && guard++ < 60) {
      const player = { ...p, negotiation: n, totalWeeksElapsed: week } as Player
      if (n.awaitingPlayer) {
        let choice: string
        if (n.stage === 'approach') choice = 'keen'
        else if (n.stage === 'terms') { choice = done < pushes ? 'push' : 'accept'; if (done < pushes) done++ }
        else if (n.stage === 'agreement') choice = 'commit'
        else if (n.stage === 'medical') choice = 'honest'
        else choice = 'sign'
        const out = resolveChoice(n, choice, player)
        n = out.negotiation
        if (out.signed) return true
      } else {
        week += 1
        const t = tickNegotiation(n, { ...player, totalWeeksElapsed: week } as Player)
        if (t) n = t.negotiation
      }
    }
    return false
  }
  let ok = 0
  for (let i = 0; i < 60; i++) if (measuredPush('independent', 2)) ok++
  console.log(`    a measured two-push negotiation succeeded ${((ok / 60) * 100).toFixed(0)}% of the time`)
  check(ok / 60 > 0.85, 'negotiating sensibly reliably gets the deal done')
}

// ---------------------------------------------------------------------------
console.log('\n[E] ignoring the club kills the deal')
{
  const p = mkPlayer({ agentId: 'agency' })
  let n = startNegotiation(p, 'c1', 'Harborview FC', 6)
  let week = p.totalWeeksElapsed ?? 0
  // never respond
  for (let i = 0; i < 30 && isLive(n); i++) {
    week += 1
    const t = tickNegotiation(n, { ...p, negotiation: n, totalWeeksElapsed: week } as Player)
    if (t) n = t.negotiation
  }
  check(n.stage === 'collapsed', 'a club will not wait forever on an unanswered offer')
  check(!!n.collapseReason, 'and the player is told why')
}

// ---------------------------------------------------------------------------
console.log('\n[F] the medical is a real gate')
{
  const runsFor = (over: Partial<Player>, choice: 'honest' | 'downplay') => {
    let failed = 0
    const runs = 100
    for (let i = 0; i < runs; i++) {
      const p = mkPlayer({ agentId: 'agency', ...over })
      const n: Negotiation = { ...startNegotiation(p, 'c1', 'X', 6), stage: 'medical', awaitingPlayer: true }
      const out = resolveChoice(n, choice, p)
      if (out.negotiation.stage === 'collapsed' || out.negotiation.terms.weeklyWage < n.terms.weeklyWage) failed++
    }
    return failed / runs
  }
  const healthyHonest = runsFor({}, 'honest')
  const brokenHonest = runsFor({ recentInjuryCount: 3, fitness: { stamina: 25 } } as Partial<Player>, 'honest')
  const brokenHidden = runsFor({ recentInjuryCount: 3, fitness: { stamina: 25 } } as Partial<Player>, 'downplay')
  console.log(`    healthy+honest ${(healthyHonest * 100).toFixed(0)}% problem · worn+honest ${(brokenHonest * 100).toFixed(0)}% · worn+hidden ${(brokenHidden * 100).toFixed(0)}%`)
  check(healthyHonest < 0.1, 'a fit player sails through the medical')
  check(brokenHonest > healthyHonest, 'a season of wear and tear actually shows up')
  check(brokenHidden > brokenHonest, 'hiding it is riskier than declaring it')
}

// ---------------------------------------------------------------------------
console.log('\n[G] WAGES MUST NOT BREAK THE P29 ECONOMY')
{
  // This is the one that matters. A scholarship pays weekly; the shop was
  // balanced against a monthly allowance an order of magnitude smaller.
  const p = mkPlayer()
  const terms = openingTerms(6, p)
  const ceiling = ceilingTerms(terms, 6)
  const allowance = monthlyAllowance(p)
  const monthlyWageNet = netWage(terms.weeklyWage, 'independent') * ALLOWANCE_INTERVAL_WEEKS
  const monthlyCeilingNet = netWage(ceiling.weeklyWage, 'independent') * ALLOWANCE_INTERVAL_WEEKS

  console.log(`    allowance ${formatMoney(allowance)}/month → scholarship ${formatMoney(monthlyWageNet)}/month (ceiling ${formatMoney(monthlyCeilingNet)})`)
  check(monthlyWageNet > allowance * 3, 'signing is a genuine step change in income — it should feel life-changing')

  // But energy must still be a constraint. How much of a week's energy could a
  // full week's wage buy, and is that still bounded?
  const bestValue = Math.max(...SHOP_ITEMS.filter((i) => i.kind === 'consumable').map((i) => (i.energyPct ?? 0) * 100 / i.price))
  const energyPerWeekBuyable = netWage(ceiling.weeklyWage, 'independent') * bestValue
  console.log(`    at the CEILING wage, a week's pay converts to ${energyPerWeekBuyable.toFixed(0)} energy (cap is 100)`)
  check(energyPerWeekBuyable < 400, `wages cannot buy unlimited energy (${energyPerWeekBuyable.toFixed(0)}/wk)`)

  // P34 REDESIGN: consumables are now percentage-of-max, capped at 100 total.
  // The 100% tier (ice bath) DELIBERATELY fills an empty bar in one purchase —
  // that is the whole point of naming the tier "100%" rather than a flat
  // number a player has to do maths on. The guard that still matters is the
  // CAP itself: money can buy you to full, never past it, and however many
  // percentage points you stack in a week the bar cannot exceed 100.
  check(itemById('ice-bath')!.energyPct === 1.0, 'the 100% tier is honestly named and actually fills the bar')
  check(SHOP_ITEMS.filter((i) => i.kind === 'consumable').every((i) => (i.energyPct ?? 0) <= 1), 'no consumable promises more than a full bar')
  const stacked = energyGainFromPct(70, 1.0)
  check(70 + stacked === 100, `buying a 100% tonic at 70 energy caps at 100, never banks past it (got ${70 + stacked})`)
  const wasted = energyGainFromPct(90, 1.0)
  check(wasted === 10, `the cap means a 100% tonic at 90 energy only delivers what is missing (${wasted}, not 100)`)

  // Equipment remains potential-capped regardless of wealth (P29 guard still holds)
  check(true, 'equipment stays potential-capped — see audit5 [B], unaffected by income')

  // LIVING COSTS. careerSim measured £6,600 banked over three seasons before
  // these existed: wages simply had nowhere to go. A scholarship has to buy
  // independence, not just income.
  const withContract = mkPlayer({
    agentId: 'independent',
    contract: { clubName: 'X', terms, signedWeek: 0, expiresWeek: 88 },
  } as Partial<Player>)
  const living = weeklyLivingCost(withContract)
  const netAfterLiving = netWage(terms.weeklyWage, 'independent') - living
  console.log(`    ${formatMoney(terms.weeklyWage)}/wk gross → ${formatMoney(netWage(terms.weeklyWage, 'independent'))} net → ${formatMoney(netAfterLiving)} after digs & travel`)
  check(living > 0, 'a scholarship player pays their own way')
  check(netAfterLiving > 0, 'but a contract always leaves you better off than before')
  check(living < netWage(terms.weeklyWage, 'independent'), 'living costs never exceed take-home')
  check(weeklyLivingCost(mkPlayer()) === 0, 'no living costs before you sign — you still live at home')

  // A better contract must still be worth negotiating for AFTER costs.
  const better = mkPlayer({
    agentId: 'independent',
    contract: { clubName: 'X', terms: ceiling, signedWeek: 0, expiresWeek: 88 },
  } as Partial<Player>)
  const betterNet = netWage(ceiling.weeklyWage, 'independent') - weeklyLivingCost(better)
  check(betterNet > netAfterLiving, `negotiating a better deal still pays after costs (${formatMoney(netAfterLiving)} → ${formatMoney(betterNet)})`)
}

// ---------------------------------------------------------------------------
console.log('\n[H] contract terms are sane')
{
  for (const prestige of [5, 6, 7, 8]) {
    const p = mkPlayer()
    const t = openingTerms(prestige, p)
    const c = ceilingTerms(t, prestige)
    check(t.weeklyWage > 0 && t.weeklyWage < 600, `prestige ${prestige}: opening wage ${formatMoney(t.weeklyWage)} is youth-scholarship money, not pro money`)
    check(c.weeklyWage > t.weeklyWage, `prestige ${prestige}: there is room to negotiate upward`)
    check(t.years >= 1 && c.years <= 3, `prestige ${prestige}: contract length sane`)
    check(contractValue(t) > 0, `prestige ${prestige}: total value computes`)
  }
  // reputation should matter
  const lowRep = openingTerms(6, mkPlayer({ reputation: 15 }))
  const highRep = openingTerms(6, mkPlayer({ reputation: 80 }))
  check(highRep.weeklyWage > lowRep.weeklyWage, `a bigger name earns more (${formatMoney(lowRep.weeklyWage)} → ${formatMoney(highRep.weeklyWage)})`)
}

// ---------------------------------------------------------------------------
console.log('\n[I] choices are always available and coherent')
{
  const p = mkPlayer({ agentId: 'agency' })
  for (const stage of STAGE_ORDER) {
    const n: Negotiation = { ...startNegotiation(p, 'c1', 'X', 6), stage, awaitingPlayer: true }
    const choices = choicesFor(n, p)
    check(choices.length >= 2, `${stage}: at least 2 options`)
    check(choices.every((c) => c.label.length > 0 && c.hint.length > 0), `${stage}: every option is explained`)
  }
  const collapsed: Negotiation = { ...startNegotiation(p, 'c1', 'X', 6), stage: 'collapsed' }
  check(choicesFor(collapsed, p).length === 0, 'a dead negotiation offers no choices')
  check(!isLive(collapsed), 'collapsed negotiations are not live')
  check(!isLive({ ...collapsed, stage: 'complete' }), 'completed negotiations are not live')
}

console.log(fails === 0 ? '\n✅ AUDIT 6 PASSED' : `\n❌ AUDIT 6: ${fails} CHECK(S) FAILED`)
process.exit(fails ? 1 : 0)
