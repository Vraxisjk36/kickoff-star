import { rand } from './rng'
import { matchAvailability, playerForMatch } from './selection'
import { archetypeStaminaDrainMultiplier } from './archetypes'
import type { Player } from '../types/player'
import type { Team } from './teams'
import { computeCurrentAbility } from './rating'
import { fatigueModifier, driveStaminaCost, evaluateSub } from './fatigue'
import { pacingPressure, pacedInvolvement, shouldPromoteHalfChance, isStarved } from './chancePacing'
import { standingMatchEffects } from './standing'
import { injuryRisk, rollInjury } from './injuries'
import { createCommentator, surnameOf, fill, type Commentator, type CommentaryContext } from './commentary'
import { ratingNudgeFor, type ExecutionGrade } from './execution'
import { pickGoalscorer, pickAssister, applyTeammateGoal, type SquadPlayer } from './squad'
import { scenariosFor, scenariosForAttackRole, scenarioById, type ScenarioCategory } from './matchScenarios'
import { debugScenarioOverride } from './devTools'
import { resolveLegacyDriveShot, scoreSnapshot } from './matchResolutionV2'
import { emptyMatchStats, simulateBackgroundStats, mergeMatchStats, type PlayerMatchStats } from './matchStats'
import { createMatchEnvironment } from './matchModel'
import { calculatePlayerRating, type RatingBreakdown } from './ratingSystemV32'
import { simulateMotmField, selectManOfTheMatch, type MotmResult } from './motmV32'

// ============================================================================
// FOOTBALL ENGINE — Sections 1-4 (Possession, Chance/Decision, Goals, Ratings)
// Implements the locked spec. Drives are discrete; two independent rolls per drive;
// momentum with decay + diminishing returns; involvement roll routes key moments to
// the player; chance tiers set probability ceilings; ratings weight decision-quality.
// ============================================================================

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

export type ChanceTier = 'half' | 'good' | 'clear'
export type DriveOwner = 'player-team' | 'opponent'

export interface MatchState {
  homeTeam: Team
  awayTeam: Team
  playerIsHome: boolean
  minute: number
  addedTime: number
  homeScore: number
  awayScore: number
  momentum: number // -10 (opponent) .. +10 (player team)
  drivesSinceInvolved: number
  playerMoments: number // count of key moments given (for min-2 guarantee)
  midpointMomentUsed: boolean // P63 — the midpoint safety-net checkpoint fires at most once
  matchStamina: number // Section 5: live in-match fatigue, separate from weekly stamina
  // Phase 22a: the player's own squad (Tier 1 NPCs). Optional so any code path
  // that doesn't have a squad yet (or a save from before this phase) still
  // works — teammate goals just fall back to the old generic "a teammate"
  // commentary with no name and no individual stat tracking.
  squad?: SquadPlayer[]
  substituted: boolean
  subMinute: number | null
  /**
   * P29 SUB APPEARANCES. Starters enter at 0'. A bench player watches the
   * first hour and comes on around 55-75' — fewer minutes, fewer chances, and
   * a rating built from a smaller sample. Before this, squadRole only affected
   * coach-trust maths while the player always played a full 90, so being
   * dropped to the bench cost you nothing on matchday.
   */
  entryMinute: number
  /** Minute of the player's last key moment — drives P31 chance pacing. */
  lastMomentMinute: number
  /** True once the player is physically on the pitch. */
  onPitch: boolean
  injury: { severity: string; weeksOut: number; description: string } | null
  // player match rating accumulation (Section 4)
  playerRating: number
  playerGoals: number
  playerAssists: number
  /** Full position-aware match statistics. Event stats are authoritative; ordinary off-ball actions are filled at FT. */
  playerStats: PlayerMatchStats
  /** Quality samples from the decisions actually surfaced to the player. */
  decisionQualityTotal: number
  executionQualityTotal: number
  ratedMoments: number
  /** Transparent full-time rating ledger; populated when the match finishes. */
  ratingBreakdown?: RatingBreakdown
  /** Comparative player-of-the-match result, generated at full time. */
  motm?: MotmResult
  events: MatchEvent[]
  finished: boolean
  // Phase 12. Non-serialised: MatchState is transient (never written to a save slot),
  // so holding the commentator here is safe and keeps its no-repeat memory alive for
  // the whole match. Spreads copy the reference, which is exactly what we want.
  commentator: Commentator
  playerSurname: string
  lastAmbientMinute: number
  /**
   * P38 — a multi-beat scenario currently in progress. Set the moment a
   * scenario begins, cleared the moment it resolves terminally. While this is
   * set, the match screen stays "inside" the passage of play (advancing beats
   * locally) instead of returning to the normal drive-based sim loop.
   */
  activeScenario: { scenarioId: string; beatId: string; tier: ChanceTier } | null
  /** P40 — disciplinary record for THIS match. Only the player's own bookings are tracked (we don't simulate every player's discipline). */
  yellowCards: number
  redCarded: boolean
}

export interface MatchEvent {
  minute: number
  text: string
  kind: 'info' | 'goal' | 'chance' | 'halftime' | 'fulltime'
  /** Authoritative score immediately after this event. Goal presentation must
   * never try to infer the scoring side from translated/commentary text. */
  homeScore?: number
  awayScore?: number
  scoringSide?: 'home' | 'away'
}

// A key moment surfaced to the player (rendered via DecisionCard by the screen layer).
export interface KeyMoment {
  tier: ChanceTier
  isDefensive: boolean // GK / defender moment on an opponent drive
  /** P37: a GK moment on their OWN team's build-up — passing the ball out, never a shot on goal. */
  isDistribution: boolean
  minute: number
  situation: string
  /** P38 — set when this moment is a beat within a MatchScenario, so the UI/resolution route through the scenario bridge instead of the flat option pools. */
  scenarioId?: string
  beatId?: string
  /**
   * P38 — Joel: "injury moments where you feel pain and need to decide
   * whether to stay on or ask to be subbed off." A KNOCK (weeksOut 0) used to
   * be a zero-stakes narrated aside with no player agency at all. Now it's a
   * real choice: play through it (risk it flaring into a real injury) or
   * signal to come off (safe, but the match is over for you).
   */
  isInjuryDecision?: boolean
}

export function initMatch(player: Player, playerTeam: Team, opponent: Team, playerIsHome: boolean, squad?: SquadPlayer[]): MatchState {
  const commentator = createCommentator()
  const surname = surnameOf(player.name)
  // Bench players come on in the last half-hour; reserves who make the squad
  // at all get on later still. Starters play from the first whistle.
  const availability = matchAvailability(player)
  const role = playerForMatch(player, '').squadRole
  const entryMinute = !availability.canPlay ? 120 : role === 'starting-xi' || !role ? 0
    : role === 'bench' ? 55 + Math.floor(rand() * 16) // 55-70
    : 70 + Math.floor(rand() * 16) // reserves: 70-85, a cameo
  const base: MatchState & { _playerPosition?: import('../types/attributes').Position } = {
    homeTeam: playerIsHome ? playerTeam : opponent,
    awayTeam: playerIsHome ? opponent : playerTeam,
    playerIsHome,
    minute: 0,
    addedTime: 1 + Math.floor(rand() * 6),
    homeScore: 0,
    awayScore: 0,
    momentum: 0,
    drivesSinceInvolved: 0,
    playerMoments: 0,
    midpointMomentUsed: false,
    matchStamina: clamp(player.fitness.stamina, 5, 100), // no artificial floor-inflation — a tired player starts genuinely tired
    squad,
    substituted: !availability.canPlay,
    subMinute: null,
    entryMinute,
    lastMomentMinute: entryMinute,
    onPitch: entryMinute === 0,
    injury: null,
    playerRating: 6.0, // neutral baseline (Section 4)
    playerGoals: 0,
    playerAssists: 0,
    playerStats: emptyMatchStats(),
    decisionQualityTotal: 0,
    executionQualityTotal: 0,
    ratedMoments: 0,
    events: [],
    finished: false,
    commentator: commentator,
    playerSurname: surname,
    lastAmbientMinute: 0,
    activeScenario: null,
    yellowCards: 0,
    redCarded: false,
    _playerPosition: player.position,
  }
  // P33: standingMatchEffects existed but was NEVER CALLED — the three meters
  // were decorative. A dressing room that wants you to do well makes you play
  // better; a crowd that's turned on you gets in your head at home. Both are
  // deliberately tiny, because they apply to every single match.
  const standing = standingMatchEffects(player, playerIsHome)
  base.playerRating = clamp(base.playerRating + standing.ratingBonus, 1, 10)

  return {
    ...base,
    events: [
      { minute: 0, text: commentator.line('kickoff', ctxOf(base)), kind: 'info' },
      ...(entryMinute > 0
        ? [{ minute: 0, text: `${surname} starts on the bench today.`, kind: 'info' as const }]
        : []),
    ],
  }
}

/** Build the context every commentary line is rendered against. */
function ctxOf(s: MatchState): CommentaryContext {
  const pt = playerTeamOf(s)
  const opp = opponentOf(s)
  const playerScore = s.playerIsHome ? s.homeScore : s.awayScore
  const oppScore = s.playerIsHome ? s.awayScore : s.homeScore
  return {
    player: s.playerSurname,
    team: pt.short,
    opp: opp.short,
    minute: s.minute,
    homeShort: s.homeTeam.short,
    awayShort: s.awayTeam.short,
    homeScore: s.homeScore,
    awayScore: s.awayScore,
    diff: playerScore - oppScore,
    momentum: s.momentum,
  }
}

// P40 — a red card means playing a man light for the rest of the match. This
// is what makes the card a real consequence rather than a cosmetic stat:
// every rating read for the player's own team is quietly worse from the
// moment they're sent off. ~9% is a deliberately modest single-man penalty —
// going down to 10 hurts, but a team doesn't collapse from one dismissal.
const RED_CARD_TEAM_PENALTY = 0.91

function playerTeamOf(state: MatchState): Team {
  const t = state.playerIsHome ? state.homeTeam : state.awayTeam
  if (!state.redCarded) return t
  return {
    ...t,
    ratings: {
      attack: t.ratings.attack * RED_CARD_TEAM_PENALTY,
      midfield: t.ratings.midfield * RED_CARD_TEAM_PENALTY,
      defense: t.ratings.defense * RED_CARD_TEAM_PENALTY,
    },
  }
}
function opponentOf(state: MatchState): Team {
  return state.playerIsHome ? state.awayTeam : state.homeTeam
}

// Momentum modifier with diminishing returns (Section 1 anti-snowball).
function momentumFactor(momentum: number, forPlayerTeam: boolean): number {
  const signed = forPlayerTeam ? momentum : -momentum
  // diminishing curve: tanh-like, capped so extremes barely differ from mid
  const norm = signed / 10
  const curved = Math.sign(norm) * (1 - Math.pow(1 - Math.abs(norm), 2))
  return 1 + curved * 0.12 // max ~±12%
}

// --- Drive resolution (Section 1) ---
interface DriveResult {
  owner: DriveOwner
  reached: 'stalled' | 'final-third' | 'clear' // how far it got
  tier: ChanceTier | null
}

function resolveDrive(state: MatchState): DriveResult {
  const pt = playerTeamOf(state)
  const opp = opponentOf(state)
  const homeAdv = state.playerIsHome ? 1.12 : 0.94

  // Possession allocation weighted by midfield + momentum (Section 1)
  const ptMid = pt.ratings.midfield * momentumFactor(state.momentum, true) * homeAdv
  const oppMid = opp.ratings.midfield * momentumFactor(state.momentum, false)
  const owner: DriveOwner = rand() < ptMid / (ptMid + oppMid) ? 'player-team' : 'opponent'

  const attacker = owner === 'player-team' ? pt : opp
  const defender = owner === 'player-team' ? opp : pt

  // ROLL 1: survival vs opponent defense (binary, per spec — no severity carry)
  // P31: raised from 0.55. Measured drive outcomes were 82% stalled / 7% final
  // third / 11% clear, which over ~26 drives yields only ~1.4 clear chances for
  // the player's team — the engine was mathematically incapable of giving a
  // player a normal match's involvement.
  const survivalChance = clamp(0.68 - (defender.ratings.defense - 50) / 200, 0.3, 0.9)
  if (rand() > survivalChance) {
    return { owner, reached: 'stalled', tier: null }
  }

  // ROLL 2: progression vs attack rating — FLAT baseline, independent of roll 1 (spec).
  // Soft floor so underdogs still occasionally break through.
  const progressBase = clamp(0.38 + (attacker.ratings.attack - 40) / 90, 0.3, 0.85)
  const r = rand()
  if (r < progressBase * 0.6) {
    // clear chance
    const tier: ChanceTier = attacker.ratings.attack > 65 ? 'clear' : rand() < 0.5 ? 'clear' : 'good'
    return { owner, reached: 'clear', tier }
  } else if (r < progressBase) {
    return { owner, reached: 'final-third', tier: 'half' }
  }
  return { owner, reached: 'stalled', tier: null }
}

// --- Involvement roll (Section 2): does this drive route to the player? ---
function involvementChance(player: Player, isPlayerTeamDrive: boolean, _drivesSinceInvolved: number, minute: number): number {
  const ca = computeCurrentAbility(player)
  const isGK = player.position === 'GK'
  // GK/defenders get involved on OPPONENT drives; attackers on PLAYER-TEAM drives
  const attackingRole = ['ST', 'WG', 'WM', 'CM'].includes(player.position)
  const wantsThisDrive = isPlayerTeamDrive ? attackingRole || player.position === 'FB' : (isGK || ['CB', 'FB'].includes(player.position))
  // P37: a GK gets DISTRIBUTION touches on their own team's build-up (goal
  // kicks, starting an attack), not shooting involvement — small and rare
  // deliberately, since a real keeper's touches are mostly unforced. Was a
  // hard 0 before, which meant the whole distribution mechanic below this
  // function was unreachable dead code no matter how correctly it was built.
  if (isGK && isPlayerTeamDrive) return 0.05
  if (!wantsThisDrive) return 0.08
  let base = 0.45 + (ca / 20) * 0.35
  // late-match fatigue: tired legs get involved slightly less (Section 5 lite)
  if (minute > 70) base *= 1 - (minute - 70) / 200
  // NOTE: the anti-starvation floor used to live here, keyed on drives since
  // involvement. It never fired (see chancePacing.ts) — pacing pressure is
  // applied by the caller now, which can see the match clock.
  return clamp(base, 0.05, 0.97)
}

// Advance the match until the next player key moment, or until full-time.
// Returns either a key moment for the player to decide, or a finished flag.
export interface AdvanceResult {
  state: MatchState
  keyMoment: KeyMoment | null
}

// P31: shortened from 2-5min (~26 drives) to ~1.4-3.4min (~37 drives). More
// drives means both more routable chances AND more opportunities for the feed
// to say something — the match previously produced only ~12 events across 90
// minutes, which is why it read as dead air punctuated by goals.
const TIME_PER_DRIVE = () => 1.4 + rand() * 2

export function advanceToKeyMoment(state: MatchState, player: Player): AdvanceResult {
  let s = { ...state, events: [...state.events] }
  const fullTime = 90 + s.addedTime

  // P38: while a scenario is in progress, the match is "inside" a single
  // passage of play — resolution walks the scenario graph, not the normal
  // drive-based sim. This function is only ever called between beats when
  // there's nothing active, but the guard keeps it correct regardless of
  // caller discipline (tests, future call sites) rather than relying on
  // every caller remembering not to call this mid-scenario.
  if (s.activeScenario) {
    const scen = scenarioById(s.activeScenario.scenarioId)
    const b = scen?.beats[s.activeScenario.beatId]
    if (scen && b) {
      return {
        state: s,
        keyMoment: {
          tier: s.activeScenario.tier, isDefensive: scen.category === 'defend' || scen.category === 'gk-defend',
          isDistribution: scen.category === 'gk-distribution',
          minute: s.minute, situation: fill(b.situation, ctxOf(s)), scenarioId: scen.id, beatId: b.id,
        },
      }
    }
    // Dangling reference (shouldn't happen, validateScenario guards it) — drop
    // out of the scenario cleanly rather than getting stuck.
    s = { ...s, activeScenario: null }
  }

  while (!s.finished) {
    // half-time marker
    if (s.minute >= 45 && !s.events.some((e) => e.kind === 'halftime')) {
      s.momentum = Math.round(s.momentum * 0.5) // partial reset (Section 1)
      s.events.push({ minute: 45, text: s.commentator.line('halftime', ctxOf({ ...s, minute: 45 })), kind: 'halftime' })
    }

    // P63 — the fullTime-only guarantee check below concentrates every
    // forced moment into stoppage time once it has to fire more often (a
    // real regression caught by audit7 when the guarantee count was
    // raised). A midpoint checkpoint spreads that delivery out — if the
    // player is still at zero moments by the halfway point of their own
    // time on the pitch, force one in now rather than waiting for the only
    // other checkpoint, which is the literal final minute of the match.
    const midpoint = s.entryMinute + (fullTime - s.entryMinute) / 2
    if (s.minute >= midpoint && s.minute < fullTime && s.playerMoments === 0 && !s.substituted && !s.injury && s.onPitch && !s.midpointMomentUsed) {
      s.playerMoments += 1
      s.midpointMomentUsed = true
      const forced = buildKeyMoment(s, 'half', player.position === 'GK' || ['CB', 'FB'].includes(player.position), player)
      return { state: s, keyMoment: forced }
    }

    if (s.minute >= fullTime) {
      // min-2 guarantee: if the player barely featured, force a late half-chance before full time —
      // but only if they're still ON the pitch (not subbed off or injured out)
      // P63 — Joel: subs should get at least 2 moments a game, starters 4.
      // Natural chance generation already averages close to 4/match for a
      // full-90 starter (see the P31 pacing tuning note), so this safety
      // net only needs to catch the shortfall cases — raised the starter
      // floor from 2 to 3. The real gap was subs specifically: minutes-only
      // gating meant a sub coming on with only 15-20 minutes left could be
      // guaranteed just 1 (or 0), even though they genuinely featured.
      // Anyone who actually got onto the pitch — starter or sub — is now
      // guaranteed at least 2; starters get 3 to reflect their fuller
      // involvement without duplicating what natural generation already does.
      const isStarterAppearance = s.entryMinute === 0
      const guarantee = isStarterAppearance ? 3 : 2
      if (s.playerMoments < guarantee && !s.substituted && !s.injury && s.onPitch) {
        s.playerMoments += 1
        const forced = buildKeyMoment(s, 'half', player.position === 'GK' || ['CB', 'FB'].includes(player.position), player)
        return { state: s, keyMoment: forced }
      }
      s = finishMatchForAudit(s)
      return { state: s, keyMoment: null }
    }

    // Clamp the drive so the clock lands exactly on 45 when crossing half-time.
    // Without this the minute jumps to e.g. 48, events at 46-48 get appended, and THEN
    // the half-time marker (hardcoded to minute 45) is pushed after them — so the feed
    // read out of chronological order. Audit caught this in a sample feed.
    const advanced = Math.round(s.minute + TIME_PER_DRIVE())
    s.minute = s.minute < 45 && advanced > 45 ? 45 : Math.min(fullTime, advanced)
    const driveMinutes = TIME_PER_DRIVE()
    const drive = resolveDrive(s)

    // momentum decay each drive toward 0 (Section 1)
    s.momentum = s.momentum > 0 ? Math.max(0, s.momentum - 1) : Math.min(0, s.momentum + 1)

    // Bring a substitute on when their moment arrives.
    //
    // P32 BUG FIX — this is the one the player reported as "how do I get a
    // chance after being substituted?". The condition was `!onPitch && minute
    // >= entryMinute`. When a STARTER was substituted off, onPitch went false
    // and their entryMinute is 0 — so on the very next drive this branch
    // brought them straight back on, pushed a "coming on" line, refilled their
    // stamina and made them eligible for key moments again. That's how a goal
    // arrived after the 72nd-minute substitution, and why the feed contradicted
    // itself. A player who has already left the match can never re-enter it.
    if (!s.onPitch && !s.substituted && !s.injury && !s.redCarded && s.minute >= s.entryMinute) {
      s.onPitch = true
      s.events.push({ minute: s.minute, text: `${s.playerSurname} is coming on.`, kind: 'info' })
      // A sub comes on fresh regardless of the week's fatigue having ticked —
      // they've been sat down for an hour. Still capped by their real energy.
      s.matchStamina = clamp(s.matchStamina + 12, 5, 100)
    }

    // P31 FIX (player report: "why does it only start getting alive when I come
    // onto the field"). This branch used to `continue` straight past all
    // narration, so a substitute watched 60 minutes of total silence and an
    // injured player saw nothing after going off. The match is now narrated
    // around them — they're at the ground, they can see it.
    if (s.substituted || s.injury || !s.onPitch) {
      // P32: precedence matters. This tested !onPitch FIRST, so a player who
      // had been substituted OFF (onPitch now correctly false) was given
      // "waiting to come on" bench lines — the feed telling him he might get
      // on when he'd already been hooked. Someone who has left the match is
      // sidelined; only a player who has never been on is on the bench.
      const hasLeftTheMatch = s.substituted || s.injury !== null || s.redCarded
      const watching: 'bench' | 'sidelined' = hasLeftTheMatch ? 'sidelined' : 'bench'
      if (drive.reached === 'clear') {
        // a real chance happened — resolve and narrate it as a spectator
        s = drive.owner === 'player-team'
          ? autoResolveTeammateChance(s, drive.tier ?? 'good')
          : autoResolveOpponentChance(s, drive.tier ?? 'good')
      } else if (s.minute - s.lastAmbientMinute >= 6 && rand() < 0.6) {
        s.events.push({ minute: s.minute, text: s.commentator.line(watching, ctxOf(s)), kind: 'info' })
        s.lastAmbientMinute = s.minute
      }
      continue
    }

    const isPlayerTeamDrive = drive.owner === 'player-team'
    const wasNearInvolvement = drive.reached !== 'stalled'

    // Section 5: fatigue drain for the player every drive they're on the pitch for
    s.matchStamina = clamp(s.matchStamina - driveStaminaCost(player.position, driveMinutes, wasNearInvolvement) * archetypeStaminaDrainMultiplier(player.archetype) * (player.matchEnergyMultiplier ?? 1), 0, 100)

    // Section 6: sparing injury roll, only on drives with real intensity (near a chance)
    if (wasNearInvolvement) {
      const risk = injuryRisk(player.position, s.matchStamina, 0.5, 0.9, player.recentInjuryCount ?? 0)
      const rolled = rollInjury(risk)
      if (rolled && rolled.severity !== 'knock') {
        s.injury = { severity: rolled.severity, weeksOut: rolled.weeksOut, description: rolled.description }
        s.onPitch = false // off the pitch — no further involvement
        // Commentary narrates the moment; the clinical description is kept too so the
        // player still learns how long they're out for.
        s.events.push({ minute: s.minute, text: s.commentator.line('injury', ctxOf(s)), kind: 'info' })
        s.events.push({ minute: s.minute, text: rolled.description, kind: 'info' })
        continue // injury ends the player's involvement for the rest of the match
      } else if (rolled && rolled.severity === 'knock') {
        // P38: this used to be a throwaway narrated line with zero stakes —
        // exactly the gap Joel flagged. A knock now genuinely asks the
        // player something, and the answer has a real consequence either way.
        return {
          state: s,
          keyMoment: {
            tier: 'half', isDefensive: false, isDistribution: false, isInjuryDecision: true,
            minute: s.minute, situation: injuryDecisionSituation(),
          },
        }
      }
    }

    // Section 5: AI substitution check (only if not already subbed/injured)
    const teamLosing = s.playerIsHome ? s.homeScore < s.awayScore : s.awayScore < s.homeScore
    // A player who has only just come on is not getting hooked — give any
    // substitute at least 15 minutes before they can be withdrawn themselves.
    const minutesOnPitch = s.minute - s.entryMinute
    const sub = minutesOnPitch < 15
      ? { shouldSub: false, reason: 'none' as const }
      : evaluateSub(player.position, s.matchStamina, s.playerRating, s.minute, teamLosing)
    // Do not hook a starter before they have had enough playable football to
    // understand the performance. This also keeps a full start meaningfully
    // richer than a substitute cameo; emergency late changes can still happen.
    const hasRepresentativeSample = s.entryMinute > 0 || s.playerMoments >= 2
    if (sub.shouldSub && hasRepresentativeSample) {
      s.substituted = true
      s.onPitch = false // P31b: leaving the pitch must actually clear this flag
      s.subMinute = s.minute
      const subKind = sub.reason === 'fatigue' ? 'sub-fatigue' : sub.reason === 'poor-rating' ? 'sub-rating' : 'sub-tactical'
      s.events.push({ minute: s.minute, text: s.commentator.line(subKind, ctxOf(s)), kind: 'info' })
      continue
    }

    // pacing needs to be known before the branch chain below
    const abilityEarly = computeCurrentAbility(player)
    if (drive.reached === 'stalled' && !isStarved(s.minute, { lastMomentMinute: s.lastMomentMinute, momentsSoFar: s.playerMoments }, s.entryMinute, fullTime, player, abilityEarly)) {
      // Phase 12: the feed used to go completely silent between chances, which is why
      // matches read as a list of goals rather than a game. Ambient colour fills the
      // gaps — rate-limited by minute so it never floods the feed.
      if (s.minute - s.lastAmbientMinute >= 5 && rand() < 0.62) {
        s.events.push({ minute: s.minute, text: s.commentator.line('ambient', ctxOf(s)), kind: 'info' })
        s.lastAmbientMinute = s.minute
      }
      continue // no chance, keep simming (fast-sim)
    }

    // P31 pacing: how far behind their expected involvement is the player?
    const ability = computeCurrentAbility(player)
    const pressure = pacingPressure(player, ability, s.minute, s.entryMinute, fullTime, {
      lastMomentMinute: s.lastMomentMinute, momentsSoFar: s.playerMoments,
    })

    if (drive.reached === 'clear' && isPlayerTeamDrive) {
      // does it route to the player?
      const inv = pacedInvolvement(involvementChance(player, true, s.drivesSinceInvolved, s.minute) * fatigueModifier(s.matchStamina), pressure)
      if (rand() < inv) {
        s.drivesSinceInvolved = 0
        s.playerMoments += 1
        s.lastMomentMinute = s.minute
        const entered = enterMomentOrScenario(s, drive.tier ?? 'good', false, player)
        return { state: entered.state, keyMoment: entered.keyMoment }
      } else {
        // teammate chance auto-resolves
        s = autoResolveTeammateChance(s, drive.tier ?? 'good')
        s.drivesSinceInvolved += 1
      }
    } else if (drive.reached === 'clear' && !isPlayerTeamDrive) {
      // opponent clear chance — defensive player moment?
      const inv = pacedInvolvement(involvementChance(player, false, s.drivesSinceInvolved, s.minute) * fatigueModifier(s.matchStamina), pressure)
      if (rand() < inv) {
        s.drivesSinceInvolved = 0
        s.playerMoments += 1
        s.lastMomentMinute = s.minute
        const entered = enterMomentOrScenario(s, drive.tier ?? 'good', true, player)
        return { state: entered.state, keyMoment: entered.keyMoment }
      } else {
        s = autoResolveOpponentChance(s, drive.tier ?? 'good')
        s.drivesSinceInvolved += 1
      }
    } else if (isStarved(s.minute, { lastMomentMinute: s.lastMomentMinute, momentsSoFar: s.playerMoments }, s.entryMinute, fullTime, player, ability)) {
      // P31b FLOOR: nothing has come to the player for far too long. In a weak
      // team that can otherwise mean a whole match without a touch. The next
      // drive becomes a moment whatever it was — a loose ball, a duel, a
      // chase-back. Team quality decides how GOOD your moments are, not
      // whether you get any.
      s.drivesSinceInvolved = 0
      s.playerMoments += 1
      s.lastMomentMinute = s.minute
      // P37: this used to force `defensive=true` for a GK on EITHER side of
      // the ball, which meant even the starvation floor could never surface
      // a distribution moment. Now it only forces defensive when the
      // opponent actually has the ball — on the GK's own team's drive,
      // buildKeyMoment correctly reads defensive=false as isDistribution.
      const defensive = (player.position === 'GK' && !isPlayerTeamDrive) || (!isPlayerTeamDrive && ['CB', 'FB'].includes(player.position))
      return { state: s, keyMoment: buildKeyMoment(s, 'half', defensive, player) }
    } else if (drive.reached === 'final-third' && shouldPromoteHalfChance(pressure)
        && (isPlayerTeamDrive ? true : ['GK', 'CB', 'FB'].includes(player.position))) {
      // P31: THE guarantee. A player who has gone well past their expected gap
      // gets the next promising move, as a half chance rather than a gilt-edged
      // one. This is what spreads involvement across the 90 instead of dumping
      // it into stoppage time.
      // P37: a GK is now eligible on EITHER side of the ball (previously
      // excluded entirely on their own team's drive) — !isPlayerTeamDrive
      // correctly resolves to isDistribution=true when it's their own team's
      // build-up, and isDefensive=true when they're facing the opponent.
      s.drivesSinceInvolved = 0
      s.playerMoments += 1
      s.lastMomentMinute = s.minute
      return { state: s, keyMoment: buildKeyMoment(s, 'half', !isPlayerTeamDrive, player) }
    } else {
      // final-third half chance that fizzles — now actually narrated
      if (rand() < 0.6) {
        s.events.push({ minute: s.minute, text: s.commentator.line('near-miss', ctxOf(s)), kind: 'info' })
        s.lastAmbientMinute = s.minute
      }
      s.drivesSinceInvolved += 1
    }
  }
  return { state: s, keyMoment: null }
}

// P38 — the fork between a full multi-beat scenario and a routine single-shot
// moment. Deliberately not every 'clear' chance becomes a three-act story —
// that would make every match feel the same length of saga and slow the
// pacing the P31 work was tuned around. ~40% of eligible chances get the full
// treatment; the rest stay a normal single-shot pick, same as before this
// phase existed.
const SCENARIO_CHANCE = 0.4

function enterMomentOrScenario(s: MatchState, tier: ChanceTier, isDefensive: boolean, player: Player): { state: MatchState; keyMoment: KeyMoment } {
  const isGK = player.position === 'GK'
  const category: ScenarioCategory = isGK && isDefensive ? 'gk-defend' : isGK && !isDefensive ? 'gk-distribution' : isDefensive ? 'defend' : 'attack'
  // V3.2: being involved in an attack no longer means being selected as the finisher.
  // Position shapes the player's football role before a scenario is drawn.
  const attackRole = (() => {
    const r = rand()
    switch (player.position) {
      case 'ST': return r < .62 ? 'finishing' : r < .84 ? 'creation' : 'progression'
      case 'WG': return r < .38 ? 'finishing' : r < .72 ? 'creation' : 'progression'
      case 'WM': return r < .18 ? 'finishing' : r < .65 ? 'creation' : 'progression'
      case 'CM': return r < .12 ? 'finishing' : r < .60 ? 'creation' : 'progression'
      case 'FB': return r < .07 ? 'finishing' : r < .62 ? 'creation' : 'progression'
      case 'CB': return r < .06 ? 'finishing' : r < .28 ? 'creation' : 'progression'
      default: return 'progression'
    }
  })()
  const eligible = category === 'attack' ? scenariosForAttackRole(tier, attackRole) : scenariosFor(category, tier)

  // P45 — content-creation override. If the page was loaded with
  // ?debugScenario=<id>, the next eligible chance for THAT scenario's own
  // category/tier routes straight to it instead of a random pick — no need
  // to grind matches hoping for the right roll to film a specific clip.
  // Silently falls through to normal random selection if the forced id isn't
  // actually eligible here (wrong category/tier), so a stale or mistyped
  // param can never softlock a match.
  const forcedId = debugScenarioOverride()
  if (forcedId) {
    const forced = eligible.find((sc) => sc.id === forcedId)
    if (forced) {
      const entryBeat = forced.beats[forced.entryBeatId]
      const next: MatchState = { ...s, activeScenario: { scenarioId: forced.id, beatId: forced.entryBeatId, tier } }
      return {
        state: next,
        keyMoment: {
          tier, isDefensive: category === 'defend' || category === 'gk-defend',
          isDistribution: category === 'gk-distribution',
          minute: s.minute, situation: fill(entryBeat.situation, ctxOf(s)), scenarioId: forced.id, beatId: entryBeat.id,
        },
      }
    }
  }

  // Attack moments now always use a role-aware authored passage when one exists.
  // Defensive/GK content keeps the existing pacing mix.
  const scenarioChance = category === 'attack' ? 1 : SCENARIO_CHANCE
  if (eligible.length > 0 && rand() < scenarioChance) {
    const scen = eligible[Math.floor(rand() * eligible.length)]
    const entryBeat = scen.beats[scen.entryBeatId]
    const next: MatchState = { ...s, activeScenario: { scenarioId: scen.id, beatId: scen.entryBeatId, tier } }
    return {
      state: next,
      keyMoment: {
        tier, isDefensive: category === 'defend' || category === 'gk-defend',
        isDistribution: category === 'gk-distribution',
        // P39 — scenario text now renders through the SAME fill()/{player}/
        // {team}/{opp} interpolation commentary uses, so a scenario beat
        // reads as part of the same broadcast voice instead of a disconnected
        // second system with no names in it.
        minute: s.minute, situation: fill(entryBeat.situation, ctxOf(s)), scenarioId: scen.id, beatId: entryBeat.id,
      },
    }
  }
  return { state: s, keyMoment: buildKeyMoment(s, tier, isDefensive, player) }
}

// P38 — a few situation variants so the same knock doesn't always read
// identically. Deliberately short and visceral — this is a physical moment,
// not a tactical one.
const INJURY_DECISION_SITUATIONS = [
  'You go down clutching your hamstring. The physio is already jogging on. Stay on, or signal to come off?',
  'A knock to the ankle and it stings badly. You can try to run it off, or wave for the bench.',
  'You take a knee in the thigh and it\'s gone dead. Play through it, or ask to be taken off?',
  'Something in your calf just tightened sharply. Risk it, or call it a day?',
]
function injuryDecisionSituation(): string {
  return INJURY_DECISION_SITUATIONS[Math.floor(rand() * INJURY_DECISION_SITUATIONS.length)]
}

/**
 * P38 — resolve the injury decision. This is deliberately NOT run through the
 * same attribute-driven optionChance formula as a football decision — there
 * is no dribbling or shooting skill involved in whether to ask for a
 * substitution. "Ask to come off" is a certainty (it's just a request).
 * "Play through it" carries a real, fatigue-scaled risk of the knock
 * escalating into an actual injury, using the same injuryRisk() the rest of
 * the match already trusts, just weighted up — you're aggravating something
 * that's already hurt, not rolling fresh dice.
 */
export function resolveInjuryDecision(s: MatchState, playedThrough: boolean, player: Player): MatchState {
  let next = { ...s, events: [...s.events] }
  if (!playedThrough) {
    next.substituted = true
    next.subMinute = s.minute
    next.onPitch = false
    next.events.push({ minute: s.minute, text: next.commentator.line('injury-asked-off', ctxOf(next)), kind: 'info' })
    return next
  }

  // Playing through it: a real, elevated chance of it going again, worse.
  const aggravateRisk = Math.min(0.55, injuryRisk(player.position, s.matchStamina, 0.5, 0.9, player.recentInjuryCount ?? 0) * 40)
  if (rand() < aggravateRisk) {
    // Escalate: this is now a genuine injury, not a knock. Reuse the same
    // severity bands the match engine already trusts, but skip 'knock' —
    // you already had the chance to protect a knock, this is what happens
    // when that gamble doesn't pay off.
    const r = rand()
    const severity = r < 0.55 ? 'minor' : r < 0.88 ? 'moderate' : 'severe'
    const weeksOut = severity === 'minor' ? 1 + Math.floor(rand() * 2) : severity === 'moderate' ? 3 + Math.floor(rand() * 4) : 8 + Math.floor(rand() * 10)
    const description = severity === 'minor'
      ? 'It goes again, and this time it doesn\'t settle. A minor injury — a couple of weeks out.'
      : severity === 'moderate'
      ? 'It goes properly this time. A more serious injury — several weeks on the sidelines.'
      : 'It goes seriously. A bad injury — this is a real setback to your season.'
    next.injury = { severity, weeksOut, description }
    next.onPitch = false
    next.events.push({ minute: s.minute, text: next.commentator.line('injury', ctxOf(next)), kind: 'info' })
    next.events.push({ minute: s.minute, text: description, kind: 'info' })
  } else {
    next.events.push({ minute: s.minute, text: next.commentator.line('injury-played-through', ctxOf(next)), kind: 'info' })
  }
  return next
}

function buildKeyMoment(s: MatchState, tier: ChanceTier, isDefensive: boolean, player: Player): KeyMoment {
  const isGK = player.position === 'GK'
  const isDistribution = isGK && !isDefensive
  let situation: string
  if (isDefensive && isGK) {
    situation = tier === 'clear'
      ? 'A striker breaks clean through and bears down on your goal. It\'s just you and him.'
      : 'A shot fizzes in from the edge of the box, heading for the bottom corner.'
  } else if (isDefensive) {
    situation = 'The striker gets in behind and you\'re the last line of defence. You have to stop this.'
  } else if (isDistribution) {
    // P37 fix: this branch used to fall through to the generic attacking text
    // below ("the ball breaks to you in the box with the goal at your
    // mercy") for a GOALKEEPER, which is nonsensical and previously let
    // "success" resolve as the keeper personally scoring. A goalkeeper's
    // moment on their own team's build-up is about starting the attack, not
    // finishing it.
    situation = tier === 'clear'
      ? 'The ball is worked back to you with space to pick a pass. Where does it go?'
      : tier === 'good'
      ? 'You collect it under a bit of pressure. Quick decision needed.'
      : 'A loose ball rolls to you with an opponent closing fast.'
  } else {
    situation = tier === 'clear'
      ? 'The ball breaks to you in the box with the goal at your mercy.'
      : tier === 'good'
      ? 'A cross comes in and you meet it on the edge of the six-yard box.'
      : 'It drops to you at a tight angle under pressure. Half a chance.'
  }
  return { tier, isDefensive, isDistribution, minute: s.minute, situation }
}

// Auto-resolve a teammate's chance (Section 1): scores based on attack vs defense.
// Phase 22a: when a squad is present, the goal (and often an assist) is now
// credited to a SPECIFIC named teammate, weighted by position/quality —
// this is what makes it "individually affect match sim" rather than a
// faceless team-level event.
function autoResolveTeammateChance(s: MatchState, tier: ChanceTier): MatchState {
  const shot = resolveLegacyDriveShot(s.homeTeam, s.awayTeam, scoreSnapshot(s.homeScore, s.awayScore, s.minute, s.playerIsHome), true, tier, rand(), rand())
  if (shot.goal) {
    let squad = s.squad
    let scorer: SquadPlayer | null = null
    let assister: SquadPlayer | null = null
    if (squad) {
      scorer = pickGoalscorer(squad)
      if (scorer) { assister = pickAssister(squad, scorer.id); squad = applyTeammateGoal(squad, scorer.id, assister?.id ?? null) }
    }
    const scoredState = { ...nextScore(s, true), squad }
    const ctx = { ...ctxOf(scoredState), scorer: scorer ? surnameOf(scorer.name) : undefined, assister: assister ? surnameOf(assister.name) : undefined }
    return applyGoal({ ...s, squad }, true, s.commentator.line('goal-teammate', ctx))
  }
  const missed = { ...s, momentum: clamp(s.momentum + 1, -10, 10) }
  return { ...missed, events: [...missed.events, { minute: s.minute, text: s.commentator.line('chance-wasted-teammate', ctxOf(missed)), kind: 'chance' as const }] }
}

function autoResolveOpponentChance(s: MatchState, tier: ChanceTier): MatchState {
  const shot = resolveLegacyDriveShot(s.homeTeam, s.awayTeam, scoreSnapshot(s.homeScore, s.awayScore, s.minute, s.playerIsHome), false, tier, rand(), rand())
  if (shot.goal) return applyGoal(s, false, s.commentator.line('goal-opponent', ctxOf(nextScore(s, false))))
  const survived = { ...s, momentum: clamp(s.momentum - 1, -10, 10) }
  return { ...survived, events: [...survived.events, { minute: s.minute, text: s.commentator.line('chance-survived', ctxOf(survived)), kind: 'chance' as const }] }
}

/**
 * A goal line needs to describe the scoreline AFTER the goal ("{team} are level",
 * "{home} {hs} - {as} {away}"). Rendering against pre-goal state produced lines that
 * were off by one goal, so build the context against the projected score.
 */
function nextScore(s: MatchState, byPlayerTeam: boolean): MatchState {
  const scoredHome = (byPlayerTeam && s.playerIsHome) || (!byPlayerTeam && !s.playerIsHome)
  return {
    ...s,
    homeScore: s.homeScore + (scoredHome ? 1 : 0),
    awayScore: s.awayScore + (scoredHome ? 0 : 1),
  }
}

function applyGoal(s: MatchState, byPlayerTeam: boolean, text: string): MatchState {
  const scoredHome = (byPlayerTeam && s.playerIsHome) || (!byPlayerTeam && !s.playerIsHome)
  const homeScore = s.homeScore + (scoredHome ? 1 : 0)
  const awayScore = s.awayScore + (scoredHome ? 0 : 1)
  return {
    ...s,
    homeScore,
    awayScore,
    momentum: clamp(s.momentum + (byPlayerTeam ? 4 : -4), -10, 10),
    events: [...s.events, {
      minute: s.minute,
      text,
      kind: 'goal' as const,
      homeScore,
      awayScore,
      scoringSide: scoredHome ? 'home' as const : 'away' as const,
    }],
  }
}

// --- Resolve the player's own key-moment decision (Sections 2-4) ---
// optionQuality: 0..1 how good the chosen option was (reward tier / max)
// success: did the roll succeed
export function resolvePlayerMoment(
  s: MatchState, moment: KeyMoment, optionQuality: number, success: boolean, chosenReward: number, maxReward: number,
  isGkMoment = false, executionGrade: ExecutionGrade | null = null
): MatchState {
  let next = { ...s, events: [...s.events], playerStats: { ...s.playerStats } }
  next.decisionQualityTotal += maxReward > 0 ? chosenReward / maxReward : .5
  next.executionQualityTotal += executionGrade === 'perfect' ? 1 : executionGrade === 'good' ? .82 : executionGrade === 'ok' ? .62 : executionGrade === 'miss' ? .28 : (success ? .72 : .42)
  next.ratedMoments += 1

  if (moment.isDefensive) {
    // success = prevented the goal
    if (success) {
      const kind = isGkMoment ? 'save-made' : 'defended'
      next.events.push({ minute: s.minute, text: next.commentator.line(kind, ctxOf(next)), kind: 'chance' })
      if (isGkMoment) { next.playerStats.shotsFaced += 1; next.playerStats.saves += 1; if (moment.tier === 'clear') next.playerStats.highDifficultySaves += 1 }
      else { next.playerStats.tacklesAttempted += 1; next.playerStats.tacklesWon += 1; next.playerStats.duelsAttempted += 1; next.playerStats.duelsWon += 1 }
      next.momentum = clamp(next.momentum + 2, -10, 10)
    } else {
      if (isGkMoment) { next.playerStats.shotsFaced += 1; next.playerStats.goalsConceded += 1 }
      else { next.playerStats.tacklesAttempted += 1; next.playerStats.duelsAttempted += 1 }
      next = applyGoal(next, false, next.commentator.line('beaten', ctxOf(nextScore(next, false))))
    }
  } else if (moment.isDistribution) {
    // P37 — a goalkeeper choosing how to start play. Success is a good pass:
    // it never becomes a personal goal or assist, it just keeps the team
    // moving forward. Failure is a genuine turnover — mostly just lost
    // possession, but a bad enough one in a bad enough moment can gift the
    // opponent a goal outright, the way a real sliced clearance sometimes does.
    if (success) {
      next.playerStats.distributionAttempted += 1; next.playerStats.distributionCompleted += 1
      next.events.push({ minute: s.minute, text: next.commentator.line('distribution-good', ctxOf(next)), kind: 'chance' })
      next.momentum = clamp(next.momentum + 1, -10, 10)
    } else {
      next.playerStats.distributionAttempted += 1
      const concedesDirectly = moment.tier === 'clear' && rand() < 0.22
      if (concedesDirectly) {
        next = applyGoal(next, false, next.commentator.line('distribution-poor', ctxOf(nextScore(next, false))))
      } else {
        next.events.push({ minute: s.minute, text: next.commentator.line('distribution-poor', ctxOf(next)), kind: 'chance' })
        next.momentum = clamp(next.momentum - 2, -10, 10)
      }
    }
  } else {
    if (success) {
      const isGoal = optionQuality > 0.5 || moment.tier === 'clear'
      if (isGoal) {
        next = applyGoal(next, true, next.commentator.line('goal-player', ctxOf(nextScore(next, true))))
        next.playerGoals += 1
        next.playerStats.goals += 1; next.playerStats.shots += 1; next.playerStats.shotsOnTarget += 1
      } else {
        // One line for the assist, not two — the old code pushed an assist line AND a
        // separate goal line, which read as two different events for one moment.
        next.playerAssists += 1
        next.playerStats.assists += 1; next.playerStats.keyPasses += 1; next.playerStats.chancesCreated += 1
        next = applyGoal(next, true, next.commentator.line('assist', ctxOf(nextScore(next, true))))
      }
    } else {
      next.playerStats.shots += 1
      next.events.push({ minute: s.minute, text: next.commentator.line('chance-missed', ctxOf(next)), kind: 'chance' })
      next.momentum = clamp(next.momentum + 1, -10, 10)
    }
  }

  // --- Match rating update (Section 4): decision quality over outcome luck ---
  next.playerRating = updateRating(next.playerRating, optionQuality, success, moment.tier, chosenReward, maxReward)
  // Striking it cleanly is credited even when the outcome doesn't fall your way —
  // good process, bad luck. Small on purpose: it's a nudge, not a second rating system.
  if (executionGrade) {
    next.playerRating = clamp(next.playerRating + ratingNudgeFor(executionGrade), 1, 10)
  }
  return next
}

// P38 — applies a scenario BeatOutcome using the exact same effects as the
// single-shot paths above (goal/assist/save/beaten/distribution), just driven
// by data instead of moment flags, and narrated with the scenario's OWN
// authored text instead of a commentary-bank line.
function applyBeatOutcome(s: MatchState, outcome: import('./matchScenarios').BeatOutcome, text: string, tier: ChanceTier): MatchState {
  let next = { ...s, events: [...s.events], playerStats: { ...s.playerStats } }
  switch (outcome.kind) {
    case 'save':
      next.playerStats.shotsFaced += 1
      next.playerStats.saves += 1
      if (tier === 'clear') next.playerStats.highDifficultySaves += 1
      next.events.push({ minute: s.minute, text, kind: 'chance' })
      next.momentum = clamp(next.momentum + 2, -10, 10)
      return next
    case 'beaten':
      next.playerStats.shotsFaced += 1
      next.playerStats.goalsConceded += 1
      return applyGoal(next, false, text)
    case 'distribution-good':
      next.playerStats.distributionAttempted += 1
      next.playerStats.distributionCompleted += 1
      next.events.push({ minute: s.minute, text, kind: 'chance' })
      next.momentum = clamp(next.momentum + 1, -10, 10)
      return next
    case 'distribution-poor': {
      next.playerStats.distributionAttempted += 1
      const concedesDirectly = !!outcome.canConcedeDirectly && tier === 'clear' && rand() < 0.22
      if (concedesDirectly) return applyGoal(next, false, text)
      next.events.push({ minute: s.minute, text, kind: 'chance' })
      next.momentum = clamp(next.momentum - 2, -10, 10)
      return next
    }
    case 'goal':
      next = applyGoal(next, true, text)
      next.playerGoals += 1
      next.playerStats.goals += 1
      next.playerStats.shots += 1
      next.playerStats.shotsOnTarget += 1
      return next
    case 'assist':
      next.playerAssists += 1
      next.playerStats.assists += 1
      next.playerStats.keyPasses += 1
      next.playerStats.chancesCreated += 1
      return applyGoal(next, true, text)
    case 'chance-missed':
      next.playerStats.shots += 1
      next.events.push({ minute: s.minute, text, kind: 'chance' })
      next.momentum = clamp(next.momentum + 1, -10, 10)
      return next
    case 'continue':
      // handled entirely by the caller — this branch is unreachable in
      // practice (resolveScenarioBeat checks for 'continue' first) but kept
      // exhaustive so the switch can never silently fall through.
      return next
  }
}

/**
 * P38 — resolve a player's choice within an active scenario beat. A
 * 'continue' outcome advances activeScenario to the next beat and returns
 * WITHOUT touching score, goals or rating — the passage of play isn't over
 * yet. A terminal outcome (goal/save/etc) applies it via applyBeatOutcome,
 * clears activeScenario, and updates the rating exactly once, from the FINAL
 * beat's choice — intermediate "continue" choices already show their
 * consequence narratively (a good run, a clean tackle) without directly
 * being rated themselves, same as a real match: getting into a good position
 * isn't itself scored, converting or wasting it is.
 */
/**
 * P40 — resolve whether a reckless option draws a card, independent of
 * whether the football challenge itself succeeded or failed (a good tackle
 * can still catch an ankle; a missed one can be perfectly fair). Only rolled
 * when the chosen option actually carries cardRisk — routine options never
 * touch this at all.
 */
function rollCardConsequence(s: MatchState, cardRisk: number): MatchState {
  if (rand() >= cardRisk) return s
  let next = { ...s, events: [...s.events] }

  const severityRoll = rand()
  if (severityRoll < 0.55) {
    // A warning — narrated, but no lasting consequence. Most reckless
    // challenges in real football draw a word from the referee, not a card.
    next.events.push({ minute: s.minute, text: next.commentator.line('card-warning', ctxOf(next)), kind: 'info' })
    return next
  }

  if (severityRoll < 0.9) {
    // Yellow.
    next.yellowCards += 1
    if (next.yellowCards >= 2) {
      // Second yellow = red. Same match-ending consequence as a direct red.
      next.events.push({ minute: s.minute, text: next.commentator.line('card-second-yellow', ctxOf(next)), kind: 'info' })
      next.redCarded = true
      next.onPitch = false
    } else {
      next.events.push({ minute: s.minute, text: next.commentator.line('card-yellow', ctxOf(next)), kind: 'info' })
    }
    return next
  }

  // Direct red — rare, reserved for the most reckless challenges.
  next.events.push({ minute: s.minute, text: next.commentator.line('card-red', ctxOf(next)), kind: 'info' })
  next.redCarded = true
  next.onPitch = false
  return next
}

export function resolveScenarioBeat(
  s: MatchState, moment: KeyMoment, optIndex: number, optionQuality: number, success: boolean,
  chosenReward: number, maxReward: number, executionGrade: ExecutionGrade | null = null,
): MatchState {
  const scen = moment.scenarioId ? scenarioById(moment.scenarioId) : undefined
  const beatDef = scen && moment.beatId ? scen.beats[moment.beatId] : undefined
  const option = beatDef?.options[optIndex]
  if (!scen || !beatDef || !option) {
    // Should never happen (validateScenario guards this in audit), but a live
    // match must never crash over a data-structure lookup miss — just end
    // the passage of play quietly rather than throwing.
    return { ...s, activeScenario: null }
  }

  const outcome = success ? option.onSuccess : option.onFailure
  const text = fill(success ? option.successText : option.failureText, ctxOf(s))

  // P40 — a card is independent of whether the football challenge succeeded.
  // Rolled once, right after the outcome is known, before we decide whether
  // the beat continues or terminates — a card can happen on EITHER path.
  let carded = s
  if (option.cardRisk) carded = rollCardConsequence(s, option.cardRisk)

  const decisionQuality = maxReward > 0 ? chosenReward / maxReward : .5
  const executionQuality = executionGrade === 'perfect' ? 1 : executionGrade === 'good' ? .82 : executionGrade === 'ok' ? .62 : executionGrade === 'miss' ? .28 : (success ? .72 : .42)
  const evaluated = {
    ...carded,
    decisionQualityTotal: carded.decisionQualityTotal + decisionQuality,
    executionQualityTotal: carded.executionQualityTotal + executionQuality,
    ratedMoments: carded.ratedMoments + 1,
  }

  // A player who has just been sent off cannot continue a passage of play —
  // whatever the beat's outcome said, being dismissed overrides it.
  if (evaluated.redCarded && !s.redCarded) {
    return { ...evaluated, activeScenario: null }
  }

  if (outcome.kind === 'continue') {
    // P38 fix (audit7 caught this): a 'continue' step previously left s.minute
    // completely untouched, so an entire multi-beat scenario played out within
    // a single frozen minute. That meant time "spent" inside a scenario never
    // passed through the normal drive loop, which is where ambient/near-miss/
    // auto-resolved teammate content gets generated — total events per match
    // dropped from ~20 to ~9. A small, realistic +1 minute per beat keeps the
    // scenario feeling like one continuous passage of play while still
    // leaving the drive loop the same overall 90 minutes to work with once
    // the scenario resolves and normal simulation resumes.
    return {
      ...evaluated,
      minute: evaluated.minute + 1,
      events: [...evaluated.events, { minute: evaluated.minute, text, kind: 'chance' }],
      activeScenario: { scenarioId: moment.scenarioId!, beatId: outcome.beatId, tier: moment.tier },
    }
  }

  let next = applyBeatOutcome(evaluated, outcome, text, moment.tier)
  next.activeScenario = null
  next.playerRating = updateRating(next.playerRating, optionQuality, success, moment.tier, chosenReward, maxReward)
  if (executionGrade) {
    next.playerRating = clamp(next.playerRating + ratingNudgeFor(executionGrade), 1, 10)
  }
  return next
}

// Section 4: good choice + bad luck = small penalty; bad choice + lucky = smaller reward.
function updateRating(current: number, _optionQuality: number, success: boolean, tier: ChanceTier, chosenReward: number, maxReward: number): number {
  const choseWell = maxReward > 0 ? chosenReward / maxReward : 0.5
  let delta: number
  if (success) {
    delta = 0.4 + choseWell * 0.8 // good choices that pay off score most
  } else {
    // penalty softened if the choice was smart (bad luck), harsher if reckless
    delta = -0.5 + choseWell * 0.4
  }
  const tierWeight = tier === 'clear' ? 1.1 : tier === 'good' ? 1.0 : 0.85
  return clamp(current + delta * tierWeight, 1, 10)
}

export function finishMatchForAudit(s: MatchState): MatchState {
  const won = s.playerIsHome ? s.homeScore > s.awayScore : s.awayScore > s.homeScore
  const drew = s.homeScore === s.awayScore
  const resultNudge = won ? 0.3 : drew ? 0 : -0.2
  const rawRating = clamp(s.playerRating + resultNudge, 1, 10)
  const playerGoalsFor = s.playerIsHome ? s.homeScore : s.awayScore
  const conceded = s.playerIsHome ? s.awayScore : s.homeScore
  const env = createMatchEnvironment(s.homeTeam, s.awayTeam)
  const possession = s.playerIsHome ? env.homePossession : env.awayPossession
  const minutes = Math.max(0, Math.min(s.minute, s.subMinute ?? s.minute) - s.entryMinute)
  const decisionQuality = s.ratedMoments ? s.decisionQualityTotal / s.ratedMoments : .5
  const executionQuality = s.ratedMoments ? s.executionQualityTotal / s.ratedMoments : .5
  const background = simulateBackgroundStats({
    position: (s as MatchState & { _playerPosition?: import('../types/attributes').Position })._playerPosition ?? 'CM',
    minutes, teamPossession: possession, teamGoals: playerGoalsFor, goalsConceded: conceded,
    rating: rawRating, decisionQuality, executionQuality,
    seed: Math.round((s.minute + 1) * 1009 + s.homeScore * 97 + s.awayScore * 193 + s.playerMoments * 389),
  })
  const stats = mergeMatchStats(background, { ...s.playerStats, goalsConceded: conceded })
  const position = (s as MatchState & { _playerPosition?: import('../types/attributes').Position })._playerPosition ?? 'CM'
  const breakdown = calculatePlayerRating({
    position, stats, decisionQuality, executionQuality, ratedMoments: s.ratedMoments,
    minutes, yellowCards: s.yellowCards, redCarded: s.redCarded,
  })
  const finalRating = breakdown.total
  const playerId='career-player'
  const field=simulateMotmField({
    homeScore:s.homeScore, awayScore:s.awayScore, playerIsHome:s.playerIsHome,
    player:{id:playerId,name:s.playerSurname,position,rating:finalRating,stats},
  })
  const motm=selectManOfTheMatch(field,playerId) ?? undefined
  return { ...s, finished: true, playerStats: stats, playerRating: finalRating, ratingBreakdown: breakdown, motm,
    events: [...s.events, { minute: s.minute, text: s.commentator.line('fulltime', ctxOf(s)), kind: 'fulltime' as const }] }
}
