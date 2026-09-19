import type { PlayerAttributes, Position } from './attributes'

// Bounded running-value shape, reused for Confidence / Coach Trust / Momentum
// per the locked spec decision to keep their math shape consistent.
export interface BoundedState {
  value: number // -10 to +10
  baseline: number // personal resting point this decays toward
}

export type GrassrootsSeason = 1 | 2 | 3 | 4 // hard-capped, age 14-18

export interface CareerClock {
  ageYears: number
  phase: 'school-trials' | 'school-season' | 'grassroots-trials' | 'grassroots-season' | 'academy'
  grassrootsSeason: GrassrootsSeason | null
}

export interface Player {
  /** V4 AAB match-only fatigue scaling; populated by playerForMatch. */
  matchEnergyMultiplier?: number
  id: string
  name: string
  position: Position
  preferredFoot: 'left' | 'right'
  heightCm: number

  attributes: PlayerAttributes
  potential: AttributeValue // hidden from player, drives growth ceiling

  confidence: BoundedState
  fitness: {
    stamina: number // 0-100, current match/session fatigue state
  }

  careerClock: CareerClock

  /** V5 single source of truth for the pre-academy route. */
  youthRoute?: 'school' | 'grassroots'
  /** School id on the school route; null on grassroots. */
  schoolId: string | null
  /** Grassroots club id on the grassroots route; null on school. */
  grassrootsClubId?: string | null
  trialWeekCompleted: 0 | 1 | 2 | 3

  // Phase 32 — standing with the three groups (coach reads off coachTrust)
  standing?: import('../engine/standing').Standing

  // Phase 30 — representation and contracts
  /** AgentSpec.id — chosen once, before the first academy negotiation. */
  agentId?: string | null
  /** The live academy negotiation, if any. */
  negotiation?: import('../engine/negotiation').Negotiation | null
  /** The signed academy scholarship. */
  contract?: {
    clubName: string
    terms: import('../engine/negotiation').ContractTerms
    signedWeek: number
    /** Absolute week the deal expires. */
    expiresWeek: number
  } | null
  /** P33: per-season counters, for the end-of-season review. */
  seasonAppearances?: number
  seasonRatings?: number[]
  /** P33: set once the club has made its renew-or-release call, so it only happens once. */
  renewalDecided?: boolean
  /** Lifetime earnings, gross and to the agent, for the wage screen. */
  careerEarnings?: number
  agentFeesPaid?: number

  // Phase 29 — money, kit and consumables
  money?: number
  equipment?: import('../engine/economy').OwnedEquipment[]
  consumables?: import('../engine/economy').Consumables
  /** P35: the synthetic rival scorer the golden-boot headline tracks against — see engine/headlines.ts. */
  goldenBootRival?: import('../engine/headlines').SyntheticScorer
  /** P36: career trophy cabinet — season-end awards, cumulative counts. */
  personalGlory?: import('../engine/glory').GloryCounts<import('../engine/glory').PersonalGloryKey>
  clubGlory?: import('../engine/glory').GloryCounts<import('../engine/glory').ClubGloryKey>
  nationalGlory?: import('../engine/glory').GloryCounts<import('../engine/glory').NationalGloryKey>
  lastAllowanceWeek?: number
  /** Weekly check-in reward streak. */
  rewardStreak?: number
  lastRewardWeek?: number
  /** Absolute week an odd job was last worked — one per week. */
  lastJobWeek?: number
  /** Absolute week the player last came off the bench, for sub-appearance pacing. */
  lastSubAppearanceWeek?: number

  // Phase 28 — the life layer's persistent state
  relationships?: import('../engine/relationships').Relationship[]
  activeArcs?: import('../engine/storylines').ActiveArc[]
  /** Arc template keys recently resolved, for no-repeat pacing. */
  recentArcKeys?: string[]

  // Phase 27 — identity picked at onboarding
  nationality?: string // Nation.id (engine/nations.ts); drives the international layer
  avatarId?: number // 0-7, components/Avatar.tsx
  archetype?: string | null // Archetype.id (engine/archetypes.ts)

  // Training grade momentum (rolling, -3..+3), locked spec Section 2
  trainingMomentum: number
  /** P63 — consecutive training sessions with no missed week in between. */
  trainingStreak?: number
  /** Week number of the last completed training session, used to detect a missed week and reset the streak. */
  lastTrainingWeek?: number

  // Match rating history (recent-window), feeds scouting later
  matchRatings: number[]
  seasonGoals: number
  seasonAssists: number

  /**
   * Phase 16: career totals. seasonGoals/seasonAssists reset every season and
   * matchRatings only keeps the last 10, so nothing in the save could answer
   * "how many goals have you scored in your career?" until now.
   */
  career?: {
    goals: number
    assists: number
    appearances: number
    wins: number
    cleanSheets: number
    bestRating: number
    motmAwards: number
    /** P52 — a real scout doesn't judge a centre-back on goals. These make
        position-appropriate judgement possible: defenders on tackles/
        interceptions/clean sheets, midfielders on key passes, keepers on
        saves — goals and assists stop being the only thing that counts. */
    tacklesWon: number
    interceptions: number
    headersWon: number
    keyPasses: number
    saves: number
  }
  /** P63 — per-competition breakdown, since "goals" alone can't answer
      "how many of those came in the league vs a cup run vs for your
      country." All cup competitions (school/Sunday/academy cups) are
      grouped as one "cup" bucket — the competition IDs don't cleanly
      support a finer split without a bigger schema change. */
  careerByCompetition?: {
    league: { goals: number; assists: number; appearances: number }
    cup: { goals: number; assists: number; appearances: number }
    international: { goals: number; assists: number; appearances: number }
    other: { goals: number; assists: number; appearances: number }
  }
  /** Phase 16: unlocked achievement keys. */
  achievements?: string[]

  // fail-state: reached age cap (20) without turning pro
  careerEnded?: boolean

  // Current injury (null if fit). weeksRemaining counts down each week advance.
  injury: { severity: string; weeksRemaining: number; description: string } | null
  recentInjuryCount: number // rolling count feeding injury-risk history factor
  // Phase 22a: the player's own Tier-1 NPC squad — 15 named teammates who can
  // individually score/assist in match sim. Optional so old saves (and any
  // code path before a squad exists yet, e.g. mid-trials) keep working —
  // match.ts falls back to generic "a teammate" commentary when absent.
  squad?: import('../engine/squad').SquadPlayer[]
  // Phase 25: weekly newspaper archive, most recent last. Capped in the store
  // so the save doesn't grow unbounded over a multi-season career.
  gazetteIssues?: import('../engine/gazette').GazetteIssue[]
  // Phase 25: last match result, for the Gazette's recap article. Overwritten
  // every match — this is a single most-recent snapshot, not a history log
  // (matchRatings already covers the rolling rating window).
  lastMatchResult?: { opponentName: string; playerScore: number; opponentScore: number; playerGoals: number; playerAssists: number; playerRating: number }
  matchesSinceReturn: number // for sharpness ramp-back after injury
  /** P40: matches remaining suspended following a red card. 0 = available. */
  suspensionMatches?: number

  // Coach Trust (single running score, locked spec)
  coachTrust: number
  /** V3.2 actual team captaincy; separate from the Captain archetype/passive. */
  captaincy?: import('../engine/captaincy').CaptaincyState
  /** Phase 15: recent life-event keys, so the same event can't fire twice running. */
  recentLifeEvents?: string[]

  // Scouting state (per-club interest, reputation-gated per Joel's locked design)
  reputation: number
  scoutWatchers: { clubId: string; clubName: string; clubShort: string; interest: number; tier: string; prestige: number; ratings: { attack: number; midfield: number; defense: number } }[]
  contractOffers: { id: string; clubId: string; clubName: string; clubShort: string; weekOffered: number; expiresInWeeks: number; prestige: number; ratings: { attack: number; midfield: number; defense: number }; kind: 'academy' | 'professional' | 'club'; divisionTier?: number }[]

  // Absolute week counter, never resets at season boundary (used for offer expiry math)
  totalWeeksElapsed: number

  // Academy club name once transitioned from Grassroots (set when an 'academy' offer is accepted)
  academyClubName: string | null

  // Win-state: signed a professional contract (the V1.0 end goal)
  turnedPro: { clubName: string; weekSigned: number } | null
  squadRole: 'starting-xi' | 'bench' | 'reserves' | 'released' | null
  /** P50 — the week (totalWeeksElapsed) squadRole last changed. Selection is now STICKY: a trial or coach verdict has to hold for a settling-in period before the coach reconsiders, so it actually means something rather than being recomputed away within a week. */
  squadRoleSetWeek?: number
}

type AttributeValue = number
