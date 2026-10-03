import type { Player } from '../types/player'
import { computeCurrentAbility, toOvr } from './rating'

// ============================================================================
// PHASE 16 — ACHIEVEMENTS & CEREMONY
//
// Note on why this needed new state: the player only ever tracked SEASON goals and
// assists (reset every season) and a rolling window of the last 10 match ratings.
// Nothing recorded career totals, so "score 50 career goals" was unanswerable. The
// career counters in Player.career are added by this phase for exactly that reason.
//
// Design rules:
//  - Achievements observe, they never grant. Nothing here modifies attributes,
//    reputation or trust — after Phase 15's saturation problems, the last thing this
//    game needs is another system quietly feeding the clamped stats.
//  - Every achievement is checkable from persisted state alone, so a save loaded
//    mid-career unlocks correctly rather than silently missing everything earned.
// ============================================================================

export type AchievementTier = 'bronze' | 'silver' | 'gold'
export type AchievementCategory = 'debut' | 'scoring' | 'performance' | 'career' | 'adversity' | 'recognition'

export interface AchievementContext {
  player: Player
  /** Present only on the match-completed trigger. */
  match?: {
    rating: number
    goals: number
    assists: number
    won: boolean
    cleanSheet: boolean
    wasSubbed: boolean
  }
}

export interface Achievement {
  key: string
  title: string
  description: string
  category: AchievementCategory
  tier: AchievementTier
  /** Hidden achievements show as "???" until unlocked. */
  hidden?: boolean
  check: (c: AchievementContext) => boolean
}

const career = (p: Player) => p.career ?? {
  goals: 0, assists: 0, appearances: 0, wins: 0, cleanSheets: 0, bestRating: 0, motmAwards: 0,
  tacklesWon: 0, interceptions: 0, headersWon: 0, keyPasses: 0, saves: 0,
}

export const ACHIEVEMENTS: Achievement[] = [
  // --- debut ---
  {
    key: 'first-appearance', title: 'First Whistle', description: 'Play your first match.',
    category: 'debut', tier: 'bronze',
    check: (c) => career(c.player).appearances >= 1,
  },
  {
    key: 'first-goal', title: 'Off the Mark', description: 'Score your first career goal.',
    category: 'debut', tier: 'bronze',
    check: (c) => career(c.player).goals >= 1,
  },
  {
    key: 'first-assist', title: 'The Final Ball', description: 'Register your first career assist.',
    category: 'debut', tier: 'bronze',
    check: (c) => career(c.player).assists >= 1,
  },
  {
    key: 'first-clean-sheet', title: 'Nothing Past You', description: 'Keep your first clean sheet.',
    category: 'debut', tier: 'bronze',
    check: (c) => career(c.player).cleanSheets >= 1,
  },
  {
    key: 'first-win', title: 'Winning Feeling', description: 'Win your first match.',
    category: 'debut', tier: 'bronze',
    check: (c) => career(c.player).wins >= 1,
  },

  // --- scoring ---
  {
    key: 'brace', title: 'Double Up', description: 'Score twice in one match.',
    category: 'scoring', tier: 'bronze',
    check: (c) => (c.match?.goals ?? 0) >= 2,
  },
  {
    key: 'hat-trick', title: 'Match Ball', description: 'Score three in a single match.',
    category: 'scoring', tier: 'gold',
    check: (c) => (c.match?.goals ?? 0) >= 3,
  },
  {
    key: 'goals-10', title: 'Ten Up', description: 'Score 10 career goals.',
    category: 'scoring', tier: 'bronze',
    check: (c) => career(c.player).goals >= 10,
  },
  {
    key: 'goals-25', title: 'Regular Threat', description: 'Score 25 career goals.',
    category: 'scoring', tier: 'silver',
    check: (c) => career(c.player).goals >= 25,
  },
  {
    key: 'goals-50', title: 'Half Century', description: 'Score 50 career goals.',
    category: 'scoring', tier: 'gold',
    check: (c) => career(c.player).goals >= 50,
  },
  {
    key: 'assists-15', title: 'Provider', description: 'Register 15 career assists.',
    category: 'scoring', tier: 'silver',
    check: (c) => career(c.player).assists >= 15,
  },
  {
    key: 'goal-and-assist', title: 'Involved', description: 'Score and assist in the same match.',
    category: 'scoring', tier: 'silver',
    check: (c) => (c.match?.goals ?? 0) >= 1 && (c.match?.assists ?? 0) >= 1,
  },

  // --- performance ---
  {
    key: 'rating-8', title: 'Standout', description: 'Earn a match rating of 8.0 or higher.',
    category: 'performance', tier: 'silver',
    check: (c) => (c.match?.rating ?? 0) >= 8.0,
  },
  {
    key: 'rating-9', title: 'Unplayable', description: 'Earn a match rating of 9.0 or higher.',
    category: 'performance', tier: 'gold',
    check: (c) => (c.match?.rating ?? 0) >= 9.0,
  },
  {
    key: 'hot-streak', title: 'Purple Patch', description: 'Average 7.5+ across your last five matches.',
    category: 'performance', tier: 'gold',
    check: (c) => {
      const r = (c.player.matchRatings ?? []).slice(-5)
      return r.length >= 5 && r.reduce((a, b) => a + b, 0) / r.length >= 7.5
    },
  },
  {
    key: 'clean-sheets-5', title: 'The Wall', description: 'Keep 5 career clean sheets.',
    category: 'performance', tier: 'silver',
    check: (c) => career(c.player).cleanSheets >= 5,
  },

  // --- career ---
  {
    key: 'apps-10', title: 'Established', description: 'Make 10 career appearances.',
    category: 'career', tier: 'bronze',
    check: (c) => career(c.player).appearances >= 10,
  },
  {
    key: 'apps-50', title: 'Veteran of the Ranks', description: 'Make 50 career appearances.',
    category: 'career', tier: 'gold',
    check: (c) => career(c.player).appearances >= 50,
  },
  {
    key: 'starting-xi', title: 'Named in the Eleven', description: 'Earn a place in the starting XI.',
    category: 'career', tier: 'silver',
    check: (c) => c.player.squadRole === 'starting-xi',
  },
  {
    key: 'academy-signing', title: 'Signed', description: 'Join an academy.',
    category: 'career', tier: 'gold',
    check: (c) => c.player.careerClock.phase === 'academy',
  },
  {
    key: 'turned-pro', title: 'Professional', description: 'Sign your first professional contract.',
    category: 'career', tier: 'gold',
    check: (c) => !!c.player.turnedPro,
  },

  // --- adversity ---
  {
    key: 'comeback', title: 'Back in the Side', description: 'Play again after an injury lay-off.',
    category: 'adversity', tier: 'silver',
    check: (c) => (c.player.recentInjuryCount ?? 0) >= 1 && (c.player.matchesSinceReturn ?? 0) >= 1 && !c.player.injury,
  },
  {
    key: 'against-the-odds', title: 'Against the Odds', description: 'Score while your confidence is on the floor.',
    category: 'adversity', tier: 'gold', hidden: true,
    check: (c) => (c.match?.goals ?? 0) >= 1 && c.player.confidence.value <= -4,
  },
  {
    key: 'running-on-empty', title: 'Running on Empty', description: 'Earn a 7.5+ rating while drained.',
    category: 'adversity', tier: 'gold', hidden: true,
    check: (c) => (c.match?.rating ?? 0) >= 7.5 && c.player.fitness.stamina <= 30,
  },

  // --- recognition ---
  {
    key: 'first-scout', title: "Someone's Watching", description: 'Attract your first scout.',
    category: 'recognition', tier: 'silver',
    check: (c) => (c.player.scoutWatchers ?? []).length >= 1,
  },
  {
    key: 'first-offer', title: 'On the Table', description: 'Receive your first contract offer.',
    category: 'recognition', tier: 'silver',
    check: (c) => (c.player.contractOffers ?? []).length >= 1 || c.player.careerClock.phase === 'academy',
  },
  {
    key: 'well-known', title: 'Name on Lips', description: 'Reach a reputation of 55.',
    category: 'recognition', tier: 'gold',
    check: (c) => (c.player.reputation ?? 0) >= 55,
  },
  {
    key: 'coachs-favourite', title: "Coach's Favourite", description: 'Reach maximum coach trust.',
    category: 'recognition', tier: 'gold',
    check: (c) => (c.player.coachTrust ?? 0) >= 9,
  },
  // --- P50: OVR growth milestones, tied to the new XP allocation system —
  // measured against the real toOvr() curve (see scripts/simXp.ts): a
  // trial-fresh player starts around 28, grassroots exit lands near 62,
  // academy exit near 72. These thresholds mark genuine progress through
  // those real bands, not arbitrary round numbers.
  {
    key: 'promising-talent', title: 'Promising Talent', description: 'Reach a 40 overall rating.',
    category: 'recognition', tier: 'bronze',
    check: (c) => toOvr(computeCurrentAbility(c.player)) >= 40,
  },
  {
    key: 'first-team-quality', title: 'First-Team Quality', description: 'Reach a 55 overall rating.',
    category: 'recognition', tier: 'silver',
    check: (c) => toOvr(computeCurrentAbility(c.player)) >= 55,
  },
  {
    key: 'academy-standout', title: 'Academy Standout', description: 'Reach a 70 overall rating.',
    category: 'recognition', tier: 'gold',
    check: (c) => toOvr(computeCurrentAbility(c.player)) >= 70,
  },
  {
    key: 'elite-prospect', title: 'Elite Prospect', description: 'Reach an 85 overall rating — rare air for a career this young.',
    category: 'recognition', tier: 'gold', hidden: true,
    check: (c) => toOvr(computeCurrentAbility(c.player)) >= 85,
  },
]

export const TIER_COLOR: Record<AchievementTier, string> = {
  bronze: 'text-orange-400',
  silver: 'text-ks-muted',
  gold: 'text-ks-gold',
}

export const TIER_BORDER: Record<AchievementTier, string> = {
  bronze: 'border-orange-400/40',
  silver: 'border-ks-muted/40',
  gold: 'border-ks-gold/50',
}

export const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  debut: 'firsts',
  scoring: 'scoring',
  performance: 'performance',
  career: 'career',
  adversity: 'adversity',
  recognition: 'recognition',
}

/**
 * Return the keys newly unlocked by this context. Pure — the caller persists them.
 * Already-unlocked keys are never re-returned, so a ceremony can't fire twice.
 */
export function checkAchievements(ctx: AchievementContext, unlocked: string[]): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !unlocked.includes(a.key) && a.check(ctx))
}

export function achievementByKey(key: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.key === key)
}
