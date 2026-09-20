// ============================================================================
// PHASE 30 — CONTRACT NEGOTIATION
//
// Signing an academy scholarship used to be a single button. Joel's note is
// exactly right: in real life this takes weeks and moves through recognisable
// stages, and a lot can go wrong in each of them.
//
//   APPROACH   an informal meeting — a coffee, a look round the training
//              ground, nothing on paper. The club is deciding if they like you
//              as much as they liked the video.
//   TERMS      the actual haggling. Several rounds, each one a real decision:
//              push for more, hold, or accept what's on the table. Your agent
//              does the talking, and how good they are decides how much the
//              offer moves.
//   AGREEMENT  a verbal handshake. Nothing is signed. This is the stage where
//              a rival club can still come in and hijack the whole thing.
//   MEDICAL    the club's doctors go over you. If you've been carrying an
//              injury or running yourself into the ground, this is where it
//              surfaces — and it can cost you terms or the deal.
//   SIGNING    paperwork, photos, and a scholarship.
//
// Every stage advances on the WEEKLY tick, so a full negotiation runs roughly
// 5-9 weeks and lives alongside your season rather than pausing it. It can
// collapse at several points; that's the price of it being a real process.
// ============================================================================
import { rand } from './rng'
import type { Player } from '../types/player'
import { getAgent } from './agents'
import { SCHOLARSHIP_WAGE_CEILING } from './contractLifecycle'

export type NegotiationStage = 'approach' | 'terms' | 'agreement' | 'medical' | 'signing' | 'collapsed' | 'complete'

export interface ContractTerms {
  /** Gross weekly wage before the agent's cut. */
  weeklyWage: number
  /** Length of the scholarship in seasons. */
  years: number
  /** Paid per appearance. */
  appearanceFee: number
  /** Paid per goal (or clean sheet for keepers). */
  goalBonus: number
  /** One-off payment on signing. */
  signingBonus: number
}

export interface Negotiation {
  id: string
  clubId: string
  clubName: string
  clubPrestige: number
  /**
   * P33: the pipeline now runs three kinds of deal, not one.
   *  - 'academy'      first scholarship
   *  - 'renewal'      extending at the club you're already at
   *  - 'professional' the first full pro contract — the career's win state
   * It was inconsistent that the biggest moment in the game was a single
   * button while the lesser academy move got five stages of ceremony.
   */
  kind: 'academy' | 'renewal' | 'professional'
  stage: NegotiationStage
  /** Absolute week the current stage began. */
  stageStartedWeek: number
  /** Absolute week the whole thing began, for the timeline display. */
  startedWeek: number
  /** What's currently on the table. */
  terms: ContractTerms
  /** The club's ceiling — pushing past this risks them walking. */
  clubCeiling: ContractTerms
  /** How many times the player has pushed for more during TERMS. */
  pushCount: number
  /** Club patience, 0-100. Pushing costs it; it never recovers. */
  patience: number
  /** Narrative beats so far, newest last. */
  log: string[]
  /** V5 academy talks are a two-week interactive window. */
  negotiationWeek?: 1 | 2
  /** Set when the deal dies, for the UI to explain why. */
  collapseReason?: string
  /** Whether the player is waiting on a decision this week. */
  awaitingPlayer: boolean
}

// ---------------------------------------------------------------------------
// Opening terms
// ---------------------------------------------------------------------------

/**
 * A youth scholarship, priced realistically. A 16-year-old on a scholarship at
 * a modest academy is on something like £80-120/week; a strong academy might
 * go to £250. That's the band this produces, scaled by club prestige and the
 * player's own reputation. It is deliberately life-changing money for a
 * schoolkid on a £30 allowance without being footballer money.
 */
export function openingTerms(clubPrestige: number, player: Player): ContractTerms {
  const rep = player.reputation ?? 15
  const base = 55 + clubPrestige * 14 + rep * 0.7
  return {
    weeklyWage: Math.round(base * (0.75 + rand() * 0.15)), // clubs open BELOW their ceiling
    years: 2,
    appearanceFee: Math.round(clubPrestige * 1.5),
    goalBonus: Math.round(clubPrestige * 2),
    signingBonus: Math.round(base * 0.8),
  }
}

/** What the club would go to if pushed by a competent agent. */
export function ceilingTerms(opening: ContractTerms, clubPrestige: number): ContractTerms {
  return {
    weeklyWage: Math.round(opening.weeklyWage * 1.55),
    years: 3,
    appearanceFee: Math.round(opening.appearanceFee * 2),
    goalBonus: Math.round(opening.goalBonus * 2),
    signingBonus: Math.round(opening.signingBonus * (1.6 + clubPrestige * 0.04)),
  }
}

export function startNegotiation(player: Player, clubId: string, clubName: string, clubPrestige: number, kind: Negotiation['kind'] = 'academy', baseWageOverride?: number): Negotiation {
  const rawBase = openingTerms(clubPrestige, player)
  // A professional contract is a different order of money to a scholarship;
  // a renewal starts from what you're already earning.
  const base: ContractTerms = baseWageOverride !== undefined
    ? { ...rawBase, weeklyWage: baseWageOverride, signingBonus: Math.round(baseWageOverride * 1.2) }
    : kind === 'professional'
      ? { ...rawBase, weeklyWage: Math.round(rawBase.weeklyWage * 4.5), signingBonus: Math.round(rawBase.signingBonus * 6), years: 3 }
      : rawBase
  // Who is representing you changes the offer clubs OPEN with, not just how
  // far it moves afterwards. A serious agency gets a serious first number; a
  // parent gets what the club thinks they can get away with.
  const skill = getAgent(player.agentId)?.negotiation ?? 0.15
  const openingMod = 0.9 + skill * 0.28
  const terms: ContractTerms = {
    ...base,
    weeklyWage: Math.round(base.weeklyWage * openingMod),
    signingBonus: Math.round(base.signingBonus * openingMod),
  }
  const week = player.totalWeeksElapsed ?? 0
  return {
    id: crypto.randomUUID(),
    clubId, clubName, clubPrestige, kind,
    stage: 'approach',
    stageStartedWeek: week,
    startedWeek: week,
    terms,
    // A scholarship's ceiling is a scholarship's ceiling — no amount of
    // negotiating turns youth terms into professional ones. Only a genuine
    // pro contract escapes the cap.
    clubCeiling: kind === 'professional'
      ? ceilingTerms(base, clubPrestige)
      : (() => {
          const c = ceilingTerms(base, clubPrestige)
          return { ...c, weeklyWage: Math.min(c.weeklyWage, SCHOLARSHIP_WAGE_CEILING) }
        })(),
    pushCount: 0,
    negotiationWeek: 1,
    patience: 100,
    log: [
      kind === 'renewal'
        ? `${clubName} want to talk about extending your deal.`
        : kind === 'professional'
          ? `${clubName} are offering you your first professional contract. Sit down. Breathe.`
          : `${clubName} have been in touch. They'd like to meet.`,
    ],
    awaitingPlayer: true,
  }
}

// ---------------------------------------------------------------------------
// Stage handling
// ---------------------------------------------------------------------------

export const STAGE_LABEL: Record<NegotiationStage, string> = {
  approach: 'First Meeting',
  terms: 'Contract Talks',
  agreement: 'Verbal Agreement',
  medical: 'Medical',
  signing: 'Signing Day',
  collapsed: 'Talks Collapsed',
  complete: 'Signed',
}

export const STAGE_ORDER: NegotiationStage[] = ['approach', 'terms', 'agreement', 'medical', 'signing']

export function stageIndex(stage: NegotiationStage): number {
  const i = STAGE_ORDER.indexOf(stage)
  return i === -1 ? STAGE_ORDER.length : i
}

/** Options the player is offered at the current stage. */
export interface NegotiationChoice {
  id: string
  label: string
  hint: string
}

export function choicesFor(negotiation: Negotiation, player: Player): NegotiationChoice[] {
  switch (negotiation.stage) {
    case 'approach':
      return [
        { id: 'keen', label: 'Tell them you want this', hint: 'Warm, honest, no games' },
        { id: 'cool', label: 'Play it cool', hint: 'Let them do the chasing' },
        { id: 'walk', label: 'End the talks', hint: "You're not interested" },
      ]
    case 'terms': {
      const opts: NegotiationChoice[] = [
        { id: 'accept', label: 'Accept these terms', hint: 'Take what is on the table and move on' },
        { id: 'push', label: 'Push for more', hint: `Your agent goes back to them${negotiation.pushCount >= 2 ? ' — they are losing patience' : ''}` },
      ]
      if (player.contractOffers && player.contractOffers.length > 1) {
        opts.push({ id: 'leverage', label: 'Mention the other interest', hint: 'Risky. Clubs hate being played off' })
      }
      opts.push({ id: 'walk', label: 'Walk away', hint: 'End it here' })
      return opts
    }
    case 'agreement':
      return [
        { id: 'commit', label: 'Give them your word', hint: 'Shake on it and wait for the paperwork' },
        { id: 'stall', label: 'Ask for a few more days', hint: 'See if anyone else moves' },
        { id: 'walk', label: 'Walk away', hint: 'End it here' },
      ]
    case 'medical':
      return [
        { id: 'honest', label: 'Be upfront about your body', hint: 'Declare the niggles' },
        { id: 'downplay', label: 'Say nothing', hint: 'Hope it does not show up' },
      ]
    case 'signing':
      return [
        { id: 'sign', label: 'Sign the contract', hint: 'This is it' },
        { id: 'walk', label: 'Walk away', hint: 'At the very last moment' },
      ]
    default:
      return []
  }
}

export interface NegotiationOutcome {
  negotiation: Negotiation
  /** Set when the deal completes and the academy transition should fire. */
  signed?: { clubId: string; clubName: string; prestige: number; terms: ContractTerms }
  /** Shown to the player as the beat for this week. */
  beat: string
}

/**
 * Resolve the player's choice. Advancing a stage always costs at least one
 * week — the weekly tick moves things on, so nothing here resolves instantly.
 */
export function resolveChoice(negotiation: Negotiation, choiceId: string, player: Player): NegotiationOutcome {
  const agent = getAgent(player.agentId)
  const skill = agent?.negotiation ?? 0.15
  const blunder = agent?.blunderChance ?? 0.22
  const patienceCare = agent?.patienceCare ?? 1.35
  const week = player.totalWeeksElapsed ?? 0
  const n = { ...negotiation, log: [...negotiation.log], stageStartedWeek: week, awaitingPlayer: false }

  const die = (msg: string): NegotiationOutcome => {
    n.stage = 'collapsed'
    n.collapseReason = msg
    n.log.push(msg)
    return { negotiation: n, beat: msg }
  }

  if (choiceId === 'walk') {
    return die(`You told ${n.clubName} you weren't going ahead.`)
  }

  switch (negotiation.stage) {
    case 'approach': {
      if (choiceId === 'keen') {
        // Enthusiasm is good for the relationship, mildly bad for leverage
        n.patience = Math.min(100, n.patience + 10)
        n.terms = { ...n.terms, weeklyWage: Math.round(n.terms.weeklyWage * 0.97) }
        n.log.push(`You told them straight that you want to be there. The room warmed up. They'll put something in writing.`)
      } else {
        // Playing it cool improves the opening offer but costs goodwill
        n.patience -= 12
        n.terms = { ...n.terms, weeklyWage: Math.round(n.terms.weeklyWage * 1.06) }
        n.log.push(`You kept your cards close. They left knowing they'll have to work for this.`)
      }
      n.stage = 'terms'
      n.negotiationWeek = 1
      return { negotiation: n, beat: n.log[n.log.length - 1] }
    }

    case 'terms': {
      if (choiceId === 'accept') {
        n.stage = 'agreement'
        n.negotiationWeek = 2
        n.log.push(`Your agent accepted the terms. ${n.clubName} are drawing up a scholarship.`)
        return { negotiation: n, beat: n.log[n.log.length - 1] }
      }

      if (choiceId === 'leverage') {
        // High risk, high reward, and heavily agent-dependent
        if (rand() < 0.35 + skill * 0.4) {
          const jump = 0.1 + skill * 0.3
          n.terms = improveToward(n.terms, n.clubCeiling, jump)
          n.patience -= 22 * patienceCare
          n.log.push(`Word of the other interest got back to them. The offer moved — noticeably.`)
        } else {
          n.patience -= 42 * patienceCare
          n.log.push(`They didn't appreciate being played off against anyone. The mood turned.`)
          if (n.patience <= 0) return die(`${n.clubName} withdrew their offer. They felt they were being used.`)
        }
        n.pushCount += 1
        n.awaitingPlayer = true
        return { negotiation: n, beat: n.log[n.log.length - 1] }
      }

      // push
      n.pushCount += 1
      // Patience cost escalates: the third ask is far more damaging than the first
      // Audit6 [D]: this was a flat escalation that made relentless pushing a
      // guaranteed collapse regardless of who represented you. Now the agent's
      // diplomacy decides how many times they can go back, and there's real
      // variance so the outcome isn't predetermined.
      n.patience -= (9 + n.pushCount * 7) * patienceCare * (0.75 + rand() * 0.5)
      if (rand() < blunder) {
        n.terms = { ...n.terms, weeklyWage: Math.round(n.terms.weeklyWage * 0.95) }
        n.log.push(`It went badly. Your agent pushed a point they couldn't back up and the club hardened.`)
      } else {
        // Skill spread widened (audit6 [C]): the difference between agents was
        // so small that a 12% commission left you NET WORSE OFF than your
        // parent doing it for free, making the paid options strictly bad.
        const gain = (0.05 + skill * 0.42) / (1 + n.pushCount * 0.3)
        n.terms = improveToward(n.terms, n.clubCeiling, gain)
        n.log.push(`Your agent went back to them. The offer improved.`)
      }
      if (n.patience <= 0) {
        return die(`${n.clubName} have walked away. They felt the negotiation was going nowhere.`)
      }
      n.awaitingPlayer = true
      return { negotiation: n, beat: n.log[n.log.length - 1] }
    }

    case 'agreement': {
      if (choiceId === 'stall') {
        n.patience -= 30
        if (n.patience <= 0) {
          return die(`${n.clubName} gave the scholarship to someone else while you were deciding.`)
        }
        n.log.push(`You asked for more time. They agreed, but the warmth has gone out of it.`)
        n.awaitingPlayer = true
        return { negotiation: n, beat: n.log[n.log.length - 1] }
      }
      n.stage = 'medical'
      n.negotiationWeek = 2
      n.log.push(`You shook on it. The club booked you in for a medical.`)
      return { negotiation: n, beat: n.log[n.log.length - 1] }
    }

    case 'medical': {
      // Real physical state matters here — this is where a season of running
      // yourself into the ground actually shows up.
      const strain = (player.recentInjuryCount ?? 0) * 0.12 + (player.fitness.stamina < 40 ? 0.18 : 0) + (player.injury ? 0.5 : 0)
      const honest = choiceId === 'honest'
      const failChance = Math.max(0, strain * (honest ? 0.5 : 1))

      if (rand() < failChance) {
        if (honest) {
          // Declaring it costs you terms but rarely the deal
          n.terms = { ...n.terms, weeklyWage: Math.round(n.terms.weeklyWage * 0.85), years: Math.max(1, n.terms.years - 1) }
          n.stage = 'signing'
        n.negotiationWeek = 2
          n.negotiationWeek = 2
          n.log.push(`The medical flagged the wear and tear you'd already told them about. They've reduced the offer, but the deal stands.`)
        } else {
          return die(`The medical found what you didn't mention. ${n.clubName} pulled out, and word travels.`)
        }
      } else {
        n.stage = 'signing'
        n.log.push(honest
          ? `You were straight with the doctors and everything checked out. Contracts are being printed.`
          : `You said nothing and nothing showed up. Contracts are being printed.`)
      }
      return { negotiation: n, beat: n.log[n.log.length - 1] }
    }

    case 'signing': {
      n.stage = 'complete'
      n.log.push(`Signed. Photographs in the club shirt, and your parent trying not to cry.`)
      return {
        negotiation: n,
        signed: { clubId: n.clubId, clubName: n.clubName, prestige: n.clubPrestige, terms: n.terms },
        beat: n.log[n.log.length - 1],
      }
    }

    default:
      return { negotiation: n, beat: '' }
  }
}

function improveToward(current: ContractTerms, ceiling: ContractTerms, fraction: number): ContractTerms {
  const step = (a: number, b: number) => Math.round(a + (b - a) * fraction)
  return {
    weeklyWage: step(current.weeklyWage, ceiling.weeklyWage),
    years: current.years,
    appearanceFee: step(current.appearanceFee, ceiling.appearanceFee),
    goalBonus: step(current.goalBonus, ceiling.goalBonus),
    signingBonus: step(current.signingBonus, ceiling.signingBonus),
  }
}

/**
 * The weekly tick. Clubs don't wait forever: each stage has a window, and
 * sitting on a decision burns patience. This is what makes the negotiation
 * genuinely take weeks rather than being a menu you clear in one sitting.
 */
export function tickNegotiation(negotiation: Negotiation, player: Player): NegotiationOutcome | null {
  if (negotiation.stage === 'collapsed' || negotiation.stage === 'complete') return null
  const week = player.totalWeeksElapsed ?? 0
  const waited = week - negotiation.stageStartedWeek
  const n = { ...negotiation, log: [...negotiation.log] }

  // A stage the player hasn't responded to for 3+ weeks starts costing patience.
  if (n.awaitingPlayer && waited >= 3) {
    n.patience -= 18
    if (n.patience <= 0) {
      n.stage = 'collapsed'
      n.collapseReason = `${n.clubName} got tired of waiting and moved on.`
      n.log.push(n.collapseReason)
      return { negotiation: n, beat: n.collapseReason }
    }
    n.stageStartedWeek = week
    const beat = `${n.clubName} are asking for an answer.`
    n.log.push(beat)
    return { negotiation: n, beat }
  }

  // Club-side stages progress on their own after a week: the club needs time
  // to prepare paperwork, book the medical, and so on.
  if (!n.awaitingPlayer && waited >= 1) {
    n.awaitingPlayer = true
    const beat = n.stage === 'terms' ? `${n.clubName} have put an offer on the table.`
      : n.stage === 'agreement' ? `The scholarship paperwork is ready for your answer.`
      : n.stage === 'medical' ? `Your medical is booked for this week.`
      : n.stage === 'signing' ? `Everything is ready. They just need your signature.`
      : `${n.clubName} are moving things along.`
    n.log.push(beat)
    return { negotiation: n, beat }
  }

  return null
}

export function isLive(n: Negotiation | null | undefined): boolean {
  return !!n && n.stage !== 'collapsed' && n.stage !== 'complete'
}

/** Total value of a contract over its length, for the UI comparison line. */
export function contractValue(terms: ContractTerms): number {
  // 44-week seasons
  return Math.round(terms.weeklyWage * 44 * terms.years + terms.signingBonus)
}
