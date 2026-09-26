import { rand } from './rng'
import { generateTeam, type Team } from './teams'
import { MIN_SCOUT_VISITS, type academyRecruitmentReport } from './academyRecruitment'
import { academyClub } from './academyClubs'
import { NATIONS } from './nations'

// ============================================================================
// SCOUTING — locked spec, and Joel's explicit design requirement:
// NO global reputation threshold that triggers every club offering a contract.
// Interest is PER-CLUB. Reputation gates WHICH TIER of club is even watching,
// not whether an offer comes. Most clubs are out of range and never scout you.
// An offer is a CHOICE (take it / hold out), not an ending.
// ============================================================================

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

export interface ScoutInterest {
  club: Team
  interest: number // 0-100, accumulates from watched performances
  tier: 'local' | 'regional' | 'national'
  watchedMatches?: number
  lastObservedWeek?: number
  addedWeek?: number
}

export interface ScoutingState {
  reputation: number // 0-100, grows from ratings/milestones/being scouted
  watchers: ScoutInterest[] // clubs currently building interest
  offers: ContractOffer[]
}

export interface ContractOffer {
  id: string
  club: Team
  weekOffered: number
  expiresInWeeks: number // holding out too long loses the offer
  kind: 'academy' | 'professional' // academy = join an academy (Grassroots→Academy transition); professional = the actual V1.0 win-state
}

function id() { return crypto.randomUUID() }

export function initScoutingState(): ScoutingState {
  return { reputation: 5, watchers: [], offers: [] }
}

// P52 — Joel: "a realistic scout" doesn't judge a centre-back on goals. This
// used to read only rating + whether you scored/assisted — for a defender
// or keeper, that's nearly always false, so their reputation barely moved
// no matter how well they actually played. Now it reads what a scout
// watching that SPECIFIC position would actually be counting.
export interface MatchPerformanceForReputation {
  rating: number
  position: string
  goals: number
  assists: number
  tackles: number
  interceptions: number
  headers: number
  keyPasses: number
  saves: number
  cleanSheet: boolean
  /** Layer 5: the same display matters more on a bigger stage. */
  competitionPrestigeMultiplier?: number
}

export function updateReputation(state: ScoutingState, perf: MatchPerformanceForReputation): ScoutingState {
  let delta = 0
  if (perf.rating >= 8) delta = 0.25
  else if (perf.rating >= 7) delta = 0.12
  else if (perf.rating >= 6) delta = 0.04
  else if (perf.rating < 4.5) delta = -0.09

  const isGK = perf.position === 'GK'
  const isDefender = perf.position === 'CB' || perf.position === 'FB'
  const isMid = perf.position === 'CM'
  const isWide = perf.position === 'WM' || perf.position === 'WG'
  const goalInvolvement = perf.goals + perf.assists > 0

  if (isGK) {
    // A keeper's reputation is built on saves and clean sheets — a goal is
    // vanishingly rare and shouldn't be the thing that matters here.
    if (perf.saves >= 3) delta += 0.14
    if (perf.cleanSheet) delta += 0.12
  } else if (isDefender) {
    // Tackles/interceptions/headers ARE the main signal. A clean sheet the
    // whole back line earned counts too. Goals are a genuine bonus, not the
    // main thing — a defender who wins every duel and never scores should
    // still build reputation like the real defender they are.
    if (perf.tackles + perf.interceptions + perf.headers >= 3) delta += 0.14
    if (perf.cleanSheet) delta += 0.08
    if (goalInvolvement) delta += 0.05
  } else if (isMid) {
    // Passing output matters as much as end product for a central midfielder.
    if (perf.keyPasses >= 2) delta += 0.1
    if (goalInvolvement) delta += 0.1
  } else if (isWide) {
    // A winger/wing-back is judged on end product AND service.
    if (goalInvolvement) delta += perf.assists > 0 ? 0.12 : 0.1
    if (perf.keyPasses >= 1) delta += 0.06
  } else {
    // Striker default: goals and assists are correctly the main signal here.
    if (goalInvolvement) delta += 0.12
  }

  return { ...state, reputation: clamp(state.reputation + delta * (perf.competitionPrestigeMultiplier ?? 1), 0, 100) }
}

// Reputation gates which tier of club COULD notice you — not whether they do.
// This is the mechanism that prevents "every club scouts you" once you're good.
function reputationUnlocksTier(reputation: number): 'local' | 'regional' | 'national' | null {
  if (reputation >= 55) return 'national'
  if (reputation >= 28) return 'regional'
  if (reputation >= 8) return 'local'
  return null
}

const TIER_PRESTIGE_RANGE: Record<'local' | 'regional' | 'national', [number, number]> = {
  local: [1, 3],
  regional: [3, 6],
  national: [6, 10],
}

// Weekly chance a new scout starts watching — small, tier-gated, so most weeks nothing happens
// and most clubs in the world never notice the player (per Joel's requirement).
export function maybeAddWatcher(state: ScoutingState, playerAge = 0, currentWeek?: number, homeCountryId?: string): ScoutingState {
  if (playerAge < 16 || currentWeek !== undefined && state.watchers.some(w => w.addedWeek === currentWeek)) return state
  const maxTier = reputationUnlocksTier(state.reputation)
  if (!maxTier) return state
  if (state.watchers.length >= 4) return state // don't let watcher list balloon
  // small weekly probability, higher at higher reputation but capped — no threshold-triggers-everyone
  const chance = clamp(0.03 + state.reputation / 400, 0.02, 0.12)
  if (rand() >= chance) return state

  const tiers: ('local' | 'regional' | 'national')[] = maxTier === 'national' ? ['local', 'regional', 'national'] : maxTier === 'regional' ? ['local', 'regional'] : ['local']
  const tier = tiers[Math.floor(rand() * tiers.length)]
  const [lo, hi] = TIER_PRESTIGE_RANGE[tier]
  const prestige = lo + Math.floor(rand() * (hi - lo + 1))
  const countryId = homeCountryId && NATIONS.some(n => n.id === homeCountryId)
    ? rand() < 0.7 ? homeCountryId : NATIONS[Math.floor(rand() * NATIONS.length)].id
    : undefined
  const club = countryId ? academyClub(countryId, prestige, state.watchers.filter(w => w.club.countryId === countryId).map(w => w.club.name)) : generateTeam(prestige)
  if (state.watchers.some((w) => w.club.id === club.id)) return state

  return { ...state, watchers: [...state.watchers, { club, interest: 8, tier, watchedMatches: 0, addedWeek: currentWeek }] }
}

// Each watching club independently builds (or loses) interest based on performance seen.
export function updateWatcherInterest(state: ScoutingState, rating: number, currentWeek?: number): ScoutingState {
  const watchers = state.watchers.map((w) => {
    if (currentWeek !== undefined && w.lastObservedWeek === currentWeek) return w
    let delta = 0
    if (rating >= 7.5) delta = 6
    else if (rating >= 6.5) delta = 3
    else if (rating >= 5) delta = 0.5
    else delta = -2
    return { ...w, interest: clamp(w.interest + delta, 0, 100), watchedMatches: (w.watchedMatches ?? 0) + 1, lastObservedWeek: currentWeek }
  })
  return { ...state, watchers }
}

// Interest crossing a per-club threshold generates a contract OFFER (not a threshold-wins-game;
// each club decides independently, most never reach it).
export function checkForOffers(state: ScoutingState, currentWeek: number, isInAcademy: boolean, playerAge = 18, review?: ReturnType<typeof academyRecruitmentReport>): ScoutingState {
  if (!isInAcademy && (playerAge < 16 || !review?.canInvite)) return state
  const ready = state.watchers.filter((w) => w.interest >= 78 && (isInAcademy || (w.watchedMatches ?? 0) >= MIN_SCOUT_VISITS))
  if (ready.length === 0) return state
  // While in Grassroots, offers are Academy invitations (the real next step per the locked
  // spec). Only once IN an academy do offers become genuine professional contracts.
  // P33: a first professional contract before seventeen is not a thing, and a
  // career probe showed players turning pro at 16 after 2.7 seasons — ending
  // the game years early and skipping most of the academy content. Clubs will
  // still watch and want you; they just cannot sign you yet.
  const kind: 'academy' | 'professional' = isInAcademy ? 'professional' : 'academy'
  if (kind === 'professional' && playerAge < 17) return state
  const newOffers = ready
    .filter((w) => !state.offers.some((o) => o.club.id === w.club.id))
    .map((w) => ({ id: id(), club: w.club, weekOffered: currentWeek, expiresInWeeks: 6 + Math.floor(rand() * 4), kind }))
  if (newOffers.length === 0) return state
  return {
    ...state,
    offers: [...state.offers, ...newOffers],
    watchers: state.watchers.filter((w) => !ready.some((r) => r.club.id === w.club.id)), // they've made their move
  }
}

// Offers expire if not accepted in time — holding out is a real risk (spec).
export function expireOffers(state: ScoutingState, currentWeek: number): ScoutingState {
  return { ...state, offers: state.offers.filter((o) => currentWeek - o.weekOffered < o.expiresInWeeks) }
}

export function reputationLabel(rep: number): string {
  if (rep >= 55) return 'Nationally known'
  if (rep >= 28) return 'Regionally known'
  if (rep >= 8) return 'On the local radar'
  return 'Unknown'
}
