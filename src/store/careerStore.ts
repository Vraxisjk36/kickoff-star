import { create } from 'zustand'
import type { Player } from '../types/player'
import { spendXp, positionCostMultiplier } from '../engine/xp'
import { computeCurrentAbility, toOvr } from '../engine/rating'
import type { CalendarState } from '../types/calendar'
import type { DecisionResult } from '../types/decision'
import { readSave, writeSave, EMPTY_CUPS, EMPTY_YOUTH_V5, type SaveSlotId, type CupWorlds, type YouthV5Runtime } from '../engine/save'
import { nextUnresolvedEvent, markResolved, advanceWeek, activeCompetitionForWeek, internationalRoundForWeek, SEASON_WEEKS } from '../engine/calendar'
import { initCupById, batchSimCupStage, advanceCupStage, recordCupPlayerResult, playerCupFixture } from '../engine/cup'
import { initInternationalWorld, isCallUpEligible, formQualifiesForSelection, batchSimQualifyingRound, batchSimFinalsRound, advanceInternationalStage, recordNationResult, internationalTeamById, nationFixture, type InternationalWorld } from '../engine/international'
import { getSchool } from '../engine/schools'
import { getNation } from '../engine/nations'
import { rand } from '../engine/rng'
import { archetypeConfidenceSwingMultiplier, archetypeTrustGainMultiplier } from '../engine/archetypes'
import { initialCast, driftRelationships, adjustBond, addPerson, relationshipEffects, resolveInteraction, interactedThisWeek, pruneCast, INTERACTIONS } from '../engine/relationships'
import { maybeStartArc, tickArcs, ARC_TEMPLATES, baselineOf, type ActiveArc, type ArcVerdict } from '../engine/storylines'
import { itemById, ageEquipment, monthlyAllowance, allowanceDue, rewardForStreak, shopFor, availableJobs, canWorkThisWeek, weeklyLivingCost, energyGainFromPct, type OwnedEquipment } from '../engine/economy'
import { netWage, commissionOn } from '../engine/agents'
import { decideSelection } from '../engine/selection'
import { standingFromMatch, applyStandingDeltas, driftStanding } from '../engine/standing'
import { startNegotiation, resolveChoice, tickNegotiation, isLive } from '../engine/negotiation'
import { contractStatus, renewalVerdict, renewalBaseWage, releaseOutcome } from '../engine/contractLifecycle'
import { buildSeasonReview } from '../engine/seasonReview'
import { computeSeasonAwards, computeClubAwards, addGlory } from '../engine/glory'
import { recoveryFor, restOption, type RestChoice } from '../engine/energy'
import { checkAchievements, type Achievement } from '../engine/achievements'
import type { TrainingOutcome } from '../engine/training'
import type { SquadRole } from '../engine/trials'
import { trustFromMatchRating, trustFromTrainingGrade, decayTrust, decayConfidence } from '../engine/coachTrust'
import { updateReputation, updateWatcherInterest, maybeAddWatcher, checkForOffers, type ScoutingState } from '../engine/scouting'
import { checkPostMatchHeadlines, checkWeeklyHeadlines, initSyntheticScorer, driftSyntheticScorer, type Headline } from '../engine/headlines'
import { initLeagueWorld, initSchoolLeagueWorld, recordPlayerMatchResult, batchSimDivisionRound, applyPromotionRelegation, topScorerInDivision, type LeagueWorld } from '../engine/league'
import { generateSquad } from '../engine/squad'
import { growSquadForSeason, rollSquadDepartures } from '../engine/squadLifecycle'
import { generateGazetteIssue } from '../engine/gazette'
import { resultStory, selectionStory } from '../engine/gazetteV4'
import { createRegionalCamp, simulateNpcCampAssessments, advanceRegionalCamp } from '../engine/regionalSelectionV4'
import { buildNationalShortlist, selectNational23 } from '../engine/nationalPathwayV4'
import { createOctoberLeague, advanceOctoberLeague, createThreeDayFestival, advanceFestival } from '../engine/youthFestivalV5'
import { buildAcademySeason, reviewAcademyRole, proContractEligible } from '../engine/academyCareerV4'
import { buildCareerSummary } from '../engine/careerEndV4'
import { initAcademyWorld, recordAcademyMatchResult, batchSimAcademyRound, applyAcademyPromotion, type AcademyWorld } from '../engine/academy'
import { evaluateCaptaincy, recordCaptainAppearance, clearCaptaincyStory } from '../engine/captaincy'
import { createYouthWorld } from '../engine/youthWorld'
import { applyTrialOutcome } from '../engine/youthPathways'
import { initializeCompetitionWorld } from '../engine/youthCompetitionsV4'
import type { YouthWorld } from '../types/youthWorld'

interface CareerStore {
  player: Player | null
  calendar: CalendarState | null
  league: LeagueWorld | null
  academyLeague: AcademyWorld | null
  cups: CupWorlds
  international: InternationalWorld | null
  youthWorld: YouthWorld | null
  youthV5: YouthV5Runtime
  activeSlot: SaveSlotId | null
  /** P53 — in-progress training session, checkpointed after every completed
      drill so a mobile reload mid-session resumes instead of silently
      restarting from scratch. null when no session is in progress. */
  pendingTraining: import('../engine/save').PendingTrainingSnapshot | null
  setPendingTraining: (snapshot: import('../engine/save').PendingTrainingSnapshot | null) => void

  loadFromSlot: (slot: SaveSlotId, routeChoice?: 'school'|'grassroots') => Promise<void>
  startNewCareer: (player: Player, calendar: CalendarState, slot: SaveSlotId) => Promise<void>
  saveCurrent: () => Promise<void>

  // Resolve a decision's effects onto the player, mark event resolved.
  applyDecisionResult: (result: DecisionResult, relationshipId?: string) => void
  resolveCurrentEvent: () => void // for events with no decision (rest days)
  advanceToNextWeek: () => void
  applyTrainingOutcome: (outcome: TrainingOutcome, energySpent: number, injury?: { severity: string; weeksOut: number; description: string } | null) => void
  applyRestChoice: (choice: RestChoice) => void
  noteLifeEvent: (key: string) => void
  /** Achievements unlocked by the last action, drained by the UI to show a ceremony. */
  pendingAchievements: Achievement[]
  clearPendingAchievements: () => void
  runAchievementCheck: (match?: { rating: number; goals: number; assists: number; won: boolean; cleanSheet: boolean; wasSubbed: boolean }) => void
  /** Phase 28: verdicts from storyline arcs that resolved this week, drained by the UI. */
  pendingArcVerdicts: ArcVerdict[]
  clearArcVerdicts: () => void
  /** P35: NSS-style contextual news toasts, distinct from the weekly Gazette. Drained one at a time. */
  pendingHeadlines: Headline[]
  clearHeadline: () => void
  /** Short note about money/kit from the last week tick, shown on the hub. */
  economyNote: string | null
  /** Team-selection change from the last week tick, shown on the hub. */
  selectionNote: string | null
  /** P33: end-of-season review, drained by the UI. */
  pendingSeasonReview: import('../engine/seasonReview').SeasonReview | null
  clearSeasonReview: () => void
  clearCaptaincyStory: () => void
  /** Player-initiated relationship interaction (the BitLife-style verb list). */
  interactWith: (relationshipId: string, interactionId: string) => { success: boolean; delta: number } | null
  /** P29 economy. */
  buyItem: (itemId: string) => { ok: boolean; reason?: string }
  consumeItem: (itemId: string) => { ok: boolean; energyGained?: number }
  /** P64 — same energy-gain formula as a consumable, triggered by a watched rewarded ad instead of inventory. */
  restoreEnergyFromAd: (pct: number) => void
  /** P64 — a modest cash reward for watching a rewarded ad, no energy cost unlike odd jobs. */
  grantCashFromAd: (amount: number) => void
  /** P34: rewarded-ad energy top-up (20%, capped at 100), same tier as the cheapest shop drink. */
  claimWeeklyReward: () => { claimed: boolean; label?: string }
  /** Take an odd job for cash — costs energy, may cost time with people. */
  workOddJob: (jobId: string) => { ok: boolean; pay?: number }
  /** P30 representation + contracts. */
  signAgent: (agentId: string) => void
  beginNegotiation: (offerId: string) => void
  makeNegotiationChoice: (choiceId: string) => void
  negotiationBeat: string | null
  clearNegotiationBeat: () => void
  /** P40: sit out a match due to suspension — resolves the event and decrements the ban by one match. */
  serveSuspensionMatch: () => void
  /** P49 — spend a chunk of an XP pool into one attribute. Returns the actual result so the UI can show the bar fill/level-up. */
  spendAttributeXp: (attr: string, xpAmount: number) => import('../engine/xp').SpendResult | null
  /** Grassroots → Academy transition; called on signing day. */
  completeAcademyMove: (clubName: string, prestige: number) => void
  /** P33: send money home — the wage economy's tie back into the family. */
  sendMoneyHome: (amount: number) => { ok: boolean; bondGain?: number }
  /** P32: apply the outcome of a street / small-sided game. */
  applyStreetGameResult: (result: { attributeGains: Record<string, number>; confidence: number; energyCost: number; injury: { severity: string; weeksOut: number; description: string } | null }) => void
  setYouthRoute: (route: 'school' | 'grassroots') => void
  setGrassrootsClub: (clubId: string) => void
  setSchool: (schoolId: string) => void
  completeTrials: (role: SquadRole, trialPerformance: number) => void
  /** competitionId routes the result: 'sundayLeague' updates the league table; cup ids update their bracket; 'international' the nation's campaign; 'schoolFriendlies' nothing. shootoutWonByPlayer is only set for drawn knockout ties. */
  applyMatchResult: (rating: number, goals: number, assists: number, finalMatchStamina: number, injury: { severity: string; weeksOut: number; description: string } | null, opponentId: string, playerGoalsScored: number, opponentGoalsScored: number, playerWasHome: boolean, squad: import('../engine/squad').SquadPlayer[] | undefined, opponentName: string | undefined, competitionId: string, shootoutWonByPlayer?: boolean, redCarded?: boolean, matchStats?: { tackle: number; interception: number; header: number; keyPass: number; save: number }, playerWonMotm?: boolean) => void
  respondToOffer: (offerId: string, accept: boolean) => void
  ensureLeagueWorld: () => void
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

// Backfill fields missing from older saves so schema drift never produces NaN/undefined.
function migratePlayer(player: Player): Player {
  return {
    ...player,
    trainingMomentum: player.trainingMomentum ?? 0,
    matchRatings: player.matchRatings ?? [],
    seasonGoals: player.seasonGoals ?? 0,
    seasonAssists: player.seasonAssists ?? 0,
    confidence: player.confidence ?? { value: 0, baseline: 0 },
    fitness: player.fitness ?? { stamina: 100 },
    recentLifeEvents: player.recentLifeEvents ?? [],
    achievements: player.achievements ?? [],
    // Backfill career totals from whatever the old save DID hold, so an existing
    // career doesn't reset to zero appearances the moment it loads.
    career: player.career ?? {
      goals: player.seasonGoals ?? 0,
      assists: player.seasonAssists ?? 0,
      appearances: (player.matchRatings ?? []).length,
      wins: 0,
      cleanSheets: 0,
      bestRating: Math.max(0, ...(player.matchRatings ?? [0])),
      motmAwards: 0,
      tacklesWon: 0, interceptions: 0, headersWon: 0, keyPasses: 0, saves: 0,
    },
    injury: player.injury ?? null,
    recentInjuryCount: player.recentInjuryCount ?? 0,
    matchesSinceReturn: player.matchesSinceReturn ?? 3,
    coachTrust: player.coachTrust ?? 0,
    captaincy: player.captaincy ?? { role: 'none', matchesAsCaptain: 0, matchesAsViceCaptain: 0, appointedWeek: null },
    reputation: player.reputation ?? 5,
    // drop any watcher/offer entries from saves predating clubId/ratings (schema-shape change, not just a missing field)
    scoutWatchers: (player.scoutWatchers ?? []).filter((w) => w && typeof w.clubId === 'string' && w.ratings),
    contractOffers: (player.contractOffers ?? []).filter((o) => o && typeof o.clubId === 'string' && o.ratings && (o.kind === 'academy' || o.kind === 'professional')),
    turnedPro: player.turnedPro ?? null,
    academyClubName: player.academyClubName ?? null,
    totalWeeksElapsed: player.totalWeeksElapsed ?? 0,
    nationality: player.nationality ?? 'eng',
    youthRoute: player.youthRoute ?? undefined,
    grassrootsClubId: player.grassrootsClubId ?? null,
    avatarId: player.avatarId ?? 0,
    archetype: player.archetype ?? null,
    // Phase 28 — saves predating the life layer get a cast on load, so an
    // in-flight career gains relationships instead of showing an empty list.
    relationships: player.relationships ?? initialCast(),
    activeArcs: player.activeArcs ?? [],
    recentArcKeys: player.recentArcKeys ?? [],
    // P29 — careers saved before the economy existed start it now, with the
    // same two free drinks a new career gets rather than nothing.
    money: player.money ?? 25,
    equipment: player.equipment ?? [],
    consumables: player.consumables ?? { 'energy-drink': 2 },
    lastAllowanceWeek: player.lastAllowanceWeek ?? (player.totalWeeksElapsed ?? 0),
    rewardStreak: player.rewardStreak ?? 0,
    lastRewardWeek: player.lastRewardWeek ?? -1,
    // P30 — careers saved before agents/contracts existed simply have none yet.
    agentId: player.agentId ?? null,
    negotiation: player.negotiation ?? null,
    contract: player.contract ?? null,
    careerEarnings: player.careerEarnings ?? 0,
    agentFeesPaid: player.agentFeesPaid ?? 0,
    standing: player.standing ?? { teammates: 0, fans: 0 },
    // P36 — saves predating the trophy cabinet simply have an empty one.
    personalGlory: player.personalGlory ?? {},
    suspensionMatches: player.suspensionMatches ?? 0,
    clubGlory: player.clubGlory ?? {},
    nationalGlory: player.nationalGlory ?? {},
  }
}


export const useCareerStore = create<CareerStore>((setState, getState) => ({
  player: null,
  calendar: null,
  league: null,
  academyLeague: null,
  cups: { ...EMPTY_CUPS },
  international: null,
  youthWorld: null,
  youthV5: { ...EMPTY_YOUTH_V5 },
  activeSlot: null,
  pendingTraining: null,

  loadFromSlot: async (slot, routeChoice) => {
    const save = await readSave(slot,routeChoice)
    if (!save) return
    const migratedPlayer = migratePlayer(save.player)
    const youthWorld = save.youthWorld ?? initializeCompetitionWorld(createYouthWorld(migratedPlayer.id, migratedPlayer.schoolId))
    setState({ player: migratedPlayer, calendar: save.calendar, league: save.league ?? null, academyLeague: save.academyLeague ?? null, cups: save.cups ?? { ...EMPTY_CUPS }, international: save.international ?? null, youthWorld, youthV5:save.youthV5??{...EMPTY_YOUTH_V5}, activeSlot: slot, pendingTraining: save.pendingTraining ?? null })
  },

  startNewCareer: async (player, calendar, slot) => {
    // Phase 28: every career opens with a cast — family, a friend, a coach, a rival.
    player = {
      ...player,
      relationships: player.relationships ?? initialCast(),
      activeArcs: [], recentArcKeys: [],
      // P29: you start with a bit of birthday money and, as Joel asked,
      // two free energy drinks in the bag.
      money: 25,
      consumables: { 'energy-drink': 2 },
      equipment: [],
      lastAllowanceWeek: 0,
      rewardStreak: 0,
      lastRewardWeek: -1,
      // P30 — initialised explicitly rather than left undefined. migratePlayer
      // normalises these to null on load, so a fresh career that left them
      // undefined diverged from its own reloaded state (caught by careerSim's
      // save/load roundtrip assertions).
      agentId: null,
      negotiation: null,
      contract: null,
      careerEarnings: 0,
      agentFeesPaid: 0,
      standing: { teammates: 0, fans: 0 },
      // P48 — REAL BUG FIX. `squad` was never seeded here, so it was undefined
      // for the whole of grassroots. decideSelection() runs every week and
      // calls competitionFor(player, squad) — with no squad there are no
      // rivals, so pecking order came out as 1, which is inside the starting
      // slots, so EVERY player was auto-promoted to 'starting-xi' on their
      // first weekly tick regardless of what the trials actually decided.
      // That's why making the bench in trials still produced a starting debut:
      // you weren't beating anyone for the shirt, there was nobody to beat.
      // Prestige 2 = a grassroots side, the same tier the trials assume.
      squad: generateSquad(2),
      // P36 — same reasoning as the P30 comment above: seed explicit empty
      // records rather than leaving these undefined, so a fresh career
      // doesn't diverge from its own reloaded (migrated) state.
      personalGlory: {},
      suspensionMatches: 0,
      clubGlory: {},
      nationalGlory: {},
    }
    const youthWorld = initializeCompetitionWorld(createYouthWorld(player.id, player.schoolId, 1, 'school', player.nationality??'eng'))
    setState({ player, calendar, league: null, academyLeague: null, cups: { ...EMPTY_CUPS }, international: null, youthWorld, youthV5:{...EMPTY_YOUTH_V5}, activeSlot: slot, pendingTraining: null })
    await writeSave({ schemaVersion: 5, slotId: slot, savedAt: new Date().toISOString(), player, calendar, league: null, academyLeague: null, cups: { ...EMPTY_CUPS }, international: null, pendingTraining: null, youthWorld, youthV5:{...EMPTY_YOUTH_V5} })
  },

  saveCurrent: async () => {
    const { player, calendar, league, academyLeague, cups, international, youthWorld, youthV5, activeSlot, pendingTraining } = getState()
    if (!player || !calendar || activeSlot === null) return
    await writeSave({ schemaVersion: 5, slotId: activeSlot, savedAt: new Date().toISOString(), player, calendar, league, academyLeague, cups, international, pendingTraining: pendingTraining ?? null, youthWorld, youthV5 })
  },

  setPendingTraining: (snapshot) => {
    setState({ pendingTraining: snapshot })
    // Deliberately awaited via saveCurrent's own fire-and-forget pattern —
    // this IS the fix, so it has to actually reach disk promptly, not wait
    // for some other unrelated action to eventually trigger a save.
    void getState().saveCurrent()
  },

  // League world is created lazily once the player reaches the Grassroots season
  // (trials use ad-hoc opponents; the real league only needs to exist once trials are done).
  // Never runs during Academy phase — academyLeague governs matches there instead.
  ensureLeagueWorld: () => {
    const { player, league, cups } = getState()
    if (!player || league || player.careerClock.phase === 'academy') return
    // Audit fix: 'Your School' placeholder shipped to players — use the actual
    // chosen school's name for the player's team.
    const school = player.schoolId ? getSchool(player.schoolId) : undefined
    const grassrootsClub = player.youthRoute === 'grassroots' ? getState().youthWorld?.sundayClubs.find(c => c.id === player.grassrootsClubId) : undefined
    const teamName = player.youthRoute === 'school' ? (school?.name ?? 'Your School') : (grassrootsClub?.name ?? 'Your Club')
    const squad = player.squad ?? generateSquad(player.youthRoute === 'school' ? 3 : 2)
    const world = player.youthRoute === 'school' ? initSchoolLeagueWorld(teamName) : initLeagueWorld(teamName)
    const playerTeam = world.divisions[world.playerDivision].teams.find((t) => t.id === world.playerTeamId)!
    // P63 — real cross-division cup draws: every team across every
    // division in the league, not just fresh disconnected fake teams.
    const allLeagueTeams = Object.values(world.divisions).flatMap((d) => d.teams)
    // Grassroots cup worlds spin up alongside the league (P25: cups were
    // registered in the calendar but never instantiated anywhere).
    const newCups: CupWorlds = {
      ...cups,
      schoolCup: cups.schoolCup ?? initCupById('schoolCup', playerTeam, allLeagueTeams),
      sundayCup: cups.sundayCup ?? initCupById('sundayCup', playerTeam, allLeagueTeams),
    }
    setState({ league: world, cups: newCups, player: { ...player, squad } })
    void getState().saveCurrent()
  },

  applyDecisionResult: (result, relationshipId) => {
    const { player, calendar } = getState()
    if (!player || !calendar) return
    // Captaincy is evaluated from the player's updated post-match standing,
    // then the appearance is recorded using the role held for this match.
    const heldCaptaincy = player.captaincy ?? { role: 'none' as const, matchesAsCaptain: 0, matchesAsViceCaptain: 0, appointedWeek: null }
    const recordedCaptaincy = recordCaptainAppearance(heldCaptaincy)
    const event = nextUnresolvedEvent(calendar)
    const effect = result.effect

    let updatedPlayer: Player = {
      ...player,
      confidence: {
        ...player.confidence,
        value: clamp(player.confidence.value + (effect.confidence ?? 0), -10, 10),
      },
      fitness: {
        stamina: Math.round(clamp(player.fitness.stamina + (effect.energy ?? 0), 0, 100)),
      },
      coachTrust: clamp((player.coachTrust ?? 0) + (effect.coachTrust ?? 0), -10, 10),
      reputation: clamp((player.reputation ?? 0) + (effect.reputation ?? 0), 0, 100),
      money: Math.max(0, (player.money ?? 0) + (effect.money ?? 0)),
    }
    updatedPlayer.captaincy = evaluateCaptaincy(updatedPlayer, recordedCaptaincy)

    // Phase 28 — this is the link that makes the life layer causal:
    // a choice can move a NAMED person's bond, introduce someone new to the
    // cast, or open a multi-week arc that resolves several weeks from now.
    if (effect.relationshipDelta && relationshipId) {
      updatedPlayer = {
        ...updatedPlayer,
        relationships: adjustBond(updatedPlayer.relationships ?? [], relationshipId, effect.relationshipDelta, effect.narrative),
      }
    }
    if (effect.addPerson) {
      const { list } = addPerson(updatedPlayer.relationships ?? [], effect.addPerson.kind, effect.addPerson.note, effect.addPerson.bond)
      // keep the cast bounded — see pruneCast for why
      updatedPlayer = { ...updatedPlayer, relationships: pruneCast(list) }
    }
    if (effect.startArc) {
      const template = ARC_TEMPLATES.find((t) => t.key === effect.startArc)
      const live = updatedPlayer.activeArcs ?? []
      // never stack the same arc, and honour the same 2-arc ceiling the
      // random roller uses so a run of event choices can't bury the player
      if (template && live.length < 2 && !live.some((a) => a.key === template.key)) {
        const built = template.build(updatedPlayer)
        const absWeek = updatedPlayer.totalWeeksElapsed ?? 0
        const arc: ActiveArc = {
          ...built,
          id: crypto.randomUUID(),
          key: template.key,
          title: template.title,
          startedWeek: absWeek,
          deadlineWeek: absWeek + template.weeks,
          baseline: baselineOf(updatedPlayer),
        }
        const needsPerson = arc.objective.kind === 'keepBond' || arc.objective.kind === 'raiseBond'
        if (!needsPerson || (arc.objective as { relationshipId?: string }).relationshipId) {
          updatedPlayer = { ...updatedPlayer, activeArcs: [...live, arc] }
        }
      }
    }

    const updatedCalendar = event ? markResolved(calendar, event.id) : calendar
    setState({ player: updatedPlayer, calendar: updatedCalendar })
    void getState().saveCurrent()
  },

  resolveCurrentEvent: () => {
    const { player, calendar } = getState()
    if (!player || !calendar) return
    const event = nextUnresolvedEvent(calendar)
    if (!event) return
    // Phase 11: rest days are NO LONGER silently resolved here. They route to
    // RestDayScreen -> applyRestChoice so the recovery is a player decision.
    // The one exception is an injured player, who is skipped past every event by
    // Career.tsx — they still need their week's recovery, so grant the full rest.
    let updatedPlayer = player
    if (event.type === 'rest' && player.injury) {
      updatedPlayer = {
        ...player,
        fitness: { stamina: Math.round(clamp(player.fitness.stamina + recoveryFor(player, 'full-rest'), 0, 100)) },
      }
    }
    setState({ player: updatedPlayer, calendar: markResolved(calendar, event.id) })
    void getState().saveCurrent()
  },

  pendingAchievements: [],
  pendingArcVerdicts: [],
  pendingHeadlines: [],
  economyNote: null,
  selectionNote: null,
  negotiationBeat: null,
  pendingSeasonReview: null,

  clearPendingAchievements: () => setState({ pendingAchievements: [] }),
  // dequeues ONE verdict — several can resolve in the same week and each
  // deserves its own beat rather than being collapsed into one card
  clearArcVerdicts: () => setState({ pendingArcVerdicts: getState().pendingArcVerdicts.slice(1) }),
  clearHeadline: () => setState({ pendingHeadlines: getState().pendingHeadlines.slice(1) }),

  // ---- P29 economy ----------------------------------------------------
  buyItem: (itemId) => {
    const { player } = getState()
    const item = itemById(itemId)
    if (!player || !item) return { ok: false, reason: 'not available' }
    if (!shopFor(player).some((i) => i.id === itemId)) return { ok: false, reason: 'not available yet' }
    if ((player.money ?? 0) < item.price) return { ok: false, reason: 'not enough money' }

    let next: Player = { ...player, money: (player.money ?? 0) - item.price }
    if (item.kind === 'consumable') {
      next = { ...next, consumables: { ...(next.consumables ?? {}), [itemId]: ((next.consumables ?? {})[itemId] ?? 0) + 1 } }
    } else {
      // One item per slot: buying new boots replaces the old pair rather than
      // stacking, so kit bonuses can never be piled up indefinitely.
      const kept = (next.equipment ?? []).filter((o) => itemById(o.itemId)?.slot !== item.slot)
      const owned: OwnedEquipment = { itemId, weeksRemaining: item.durationWeeks ?? 8 }
      next = { ...next, equipment: [...kept, owned] }
    }
    setState({ player: next })
    void getState().saveCurrent()
    return { ok: true }
  },

  consumeItem: (itemId) => {
    const { player } = getState()
    const item = itemById(itemId)
    if (!player || !item || item.kind !== 'consumable') return { ok: false }
    const have = (player.consumables ?? {})[itemId] ?? 0
    if (have <= 0) return { ok: false }
    const before = player.fitness.stamina
    // P34: percentage-of-max, always capped at 100 — a 100% tonic at 70
    // energy tops out at 100, it never banks the extra as if the bar went to 170.
    const after = Math.round(clamp(before + energyGainFromPct(before, item.energyPct ?? 0), 0, 100))
    if (after === before) return { ok: false } // already full — don't waste it
    setState({
      player: {
        ...player,
        consumables: { ...(player.consumables ?? {}), [itemId]: have - 1 },
        fitness: { stamina: after },
      },
    })
    void getState().saveCurrent()
    return { ok: true, energyGained: after - before }
  },

  restoreEnergyFromAd: (pct) => {
    const { player } = getState()
    if (!player) return
    const before = player.fitness.stamina
    const after = Math.round(clamp(before + energyGainFromPct(before, pct), 0, 100))
    if (after === before) return
    setState({ player: { ...player, fitness: { stamina: after } } })
    void getState().saveCurrent()
  },

  grantCashFromAd: (amount) => {
    const { player } = getState()
    if (!player) return
    setState({ player: { ...player, money: (player.money ?? 0) + amount } })
    void getState().saveCurrent()
  },

  claimWeeklyReward: () => {
    const { player } = getState()
    if (!player) return { claimed: false }
    const week = player.totalWeeksElapsed ?? 0
    if ((player.lastRewardWeek ?? -1) >= week) return { claimed: false }
    // Streak continues if you checked in last week, otherwise it resets —
    // the point of a streak is that it can break.
    const continued = (player.lastRewardWeek ?? -1) === week - 1
    const streak = continued ? (player.rewardStreak ?? 0) + 1 : 0
    const reward = rewardForStreak(streak)
    let next: Player = { ...player, rewardStreak: streak, lastRewardWeek: week, money: (player.money ?? 0) + (reward.money ?? 0) }
    if (reward.itemId) {
      next = { ...next, consumables: { ...(next.consumables ?? {}), [reward.itemId]: ((next.consumables ?? {})[reward.itemId] ?? 0) + (reward.count ?? 1) } }
    }
    setState({ player: next })
    void getState().saveCurrent()
    return { claimed: true, label: reward.label }
  },

  workOddJob: (jobId) => {
    const { player } = getState()
    if (!player) return { ok: false }
    const job = availableJobs(player).find((j) => j.id === jobId)
    if (!job) return { ok: false }
    if (player.fitness.stamina < job.energyCost) return { ok: false }
    // One job a week — see canWorkThisWeek. Without this the shop could be
    // farmed indefinitely inside a single week.
    if (!canWorkThisWeek(player)) return { ok: false }
    setState({
      player: {
        ...player,
        money: (player.money ?? 0) + job.pay,
        lastJobWeek: player.totalWeeksElapsed ?? 0,
        fitness: { stamina: Math.round(clamp(player.fitness.stamina - job.energyCost, 0, 100)) },
      },
    })
    void getState().saveCurrent()
    return { ok: true, pay: job.pay }
  },

  // ---- P30 representation + contracts ---------------------------------
  clearNegotiationBeat: () => setState({ negotiationBeat: null }),
  serveSuspensionMatch: () => {
    const { player, calendar } = getState()
    if (!player || !calendar) return
    const event = nextUnresolvedEvent(calendar)
    setState({
      player: { ...player, suspensionMatches: Math.max(0, (player.suspensionMatches ?? 0) - 1) },
      calendar: event ? markResolved(calendar, event.id) : calendar,
    })
    void getState().saveCurrent()
  },
  clearSeasonReview: () => setState({ pendingSeasonReview: null }),
  clearCaptaincyStory: () => {
    const player=getState().player
    if(!player?.captaincy)return
    setState({player:{...player,captaincy:clearCaptaincyStory(player.captaincy)}})
  },

  // ---- P49 XP-based attribute progression --------------------------------
  spendAttributeXp: (attr, xpAmount) => {
    const { player } = getState()
    if (!player) return null
    const values = player.attributes.values as Record<string, number>
    const current = values[attr] ?? 8
    // Same ceiling the old trial-growth clamp used — never quite reaches
    // potential itself, matching the existing locked headroom convention.
    const ceiling = Math.max(current, player.potential - 1)
    // P55 — GK attributes cost 3x more per level (see positionCostMultiplier)
    // to correct the real structural overshoot found by simulation: a
    // keeper's weighted OVR average reads only 4 attributes vs an outfield
    // player's 12, so identical earning rates moved a GK's OVR roughly 3x
    // faster over a real 6-year career. Effective XP is scaled down at the
    // spend point rather than changing the cost table itself, so the same
    // xp.ts cost curve stays the single source of truth for every position.
    const effectiveXp = xpAmount / positionCostMultiplier(player.position === 'GK')
    const result = spendXp(current, effectiveXp, ceiling)
    // xpUsed/leftover came back in scaled "effective" units — convert back to
    // real pool units before returning, or the caller's on-screen "XP left"
    // counter would under-decrement and never correctly reach zero for a GK.
    const mult = positionCostMultiplier(player.position === 'GK')
    const realResult = { ...result, xpUsed: result.xpUsed * mult, leftover: result.leftover * mult }
    setState({
      player: {
        ...player,
        attributes: { ...player.attributes, values: { ...values, [attr]: result.newLevel } } as Player['attributes'],
      },
    })
    void getState().saveCurrent()
    return realResult
  },

  // P32 — a street game costs energy and carries injury risk, and gives back
  // small attribute gains. It deliberately does NOT touch appearances, the
  // league table, selection or standing: it's extra football, not a shortcut.
  // P33. Once you're earning, money piled up with nowhere meaningful to go —
  // a career probe ended on £9,965. Kit is one sink; this is the other, and it
  // is the one that means something. Your parents covered your boots, your
  // travel and your subs for years on an ordinary wage. Paying some of it back
  // moves the bond that pays your allowance, steadies your confidence, and is
  // simply the thing a decent person does.
  sendMoneyHome: (amount) => {
    const { player } = getState()
    if (!player) return { ok: false }
    const amt = Math.floor(amount)
    if (amt <= 0 || (player.money ?? 0) < amt) return { ok: false }
    const parent = (player.relationships ?? []).find((r) => !r.ended && r.kind === 'parent')
    if (!parent) return { ok: false }

    // Generosity is measured against what you actually earn, so £50 from a
    // schoolkid counts for more than £50 from a scholarship player.
    const weekly = player.contract?.terms.weeklyWage ?? Math.max(10, monthlyAllowance(player) / 4)
    const bondGain = Math.max(1, Math.min(12, Math.round((amt / weekly) * 6)))

    setState({
      player: {
        ...player,
        money: (player.money ?? 0) - amt,
        relationships: adjustBond(player.relationships ?? [], parent.id, bondGain, `you sent money home`),
        confidence: { ...player.confidence, value: clamp(player.confidence.value + 0.4, -10, 10) },
      },
    })
    void getState().saveCurrent()
    return { ok: true, bondGain }
  },

  applyStreetGameResult: (result) => {
    const { player, calendar } = getState()
    if (!player || !calendar) return
    const values = { ...(player.attributes.values as Record<string, number>) }
    for (const [attr, gain] of Object.entries(result.attributeGains)) {
      if (values[attr] === undefined) continue
      // the potential ceiling still applies — street football can't make you
      // a better player than you could ever have been
      values[attr] = Math.min(player.potential, Math.round((values[attr] + gain) * 100) / 100)
    }
    const event = nextUnresolvedEvent(calendar)
    setState({
      player: {
        ...player,
        attributes: { ...player.attributes, values } as Player['attributes'],
        fitness: { stamina: Math.round(clamp(player.fitness.stamina - result.energyCost, 0, 100)) },
        confidence: { ...player.confidence, value: clamp(player.confidence.value + result.confidence, -10, 10) },
        injury: result.injury
          ? { severity: result.injury.severity, weeksRemaining: result.injury.weeksOut, description: result.injury.description }
          : player.injury,
        recentInjuryCount: result.injury ? (player.recentInjuryCount ?? 0) + 1 : (player.recentInjuryCount ?? 0),
      },
      calendar: event ? markResolved(calendar, event.id) : calendar,
    })
    void getState().saveCurrent()
  },

  signAgent: (agentId) => {
    const { player } = getState()
    if (!player || player.agentId) return // one-time choice, like the archetype
    setState({ player: { ...player, agentId } })
    void getState().saveCurrent()
  },

  beginNegotiation: (offerId) => {
    const { player } = getState()
    if (!player) return
    // Representation first — you cannot open talks without an agent, which is
    // what makes the agent choice a real gate rather than a menu item.
    if (!player.agentId) return
    if (isLive(player.negotiation)) return
    const offer = (player.contractOffers ?? []).find((o) => o.id === offerId)
    if (!offer || (offer.kind !== 'academy' && offer.kind !== 'professional')) return
    const negotiation = startNegotiation(player, offer.clubId, offer.clubName, offer.prestige, offer.kind)
    setState({ player: { ...player, negotiation }, negotiationBeat: negotiation.log[0] })
    void getState().saveCurrent()
  },

  makeNegotiationChoice: (choiceId) => {
    const { player } = getState()
    if (!player?.negotiation || !isLive(player.negotiation)) return
    const outcome = resolveChoice(player.negotiation, choiceId, player)
    const next: Player = { ...player, negotiation: outcome.negotiation }

    if (outcome.signed) {
      const { clubName, prestige, terms } = outcome.signed
      const week = player.totalWeeksElapsed ?? 0
      const dealKind = player.negotiation.kind ?? 'academy'
      // The signing-on fee lands immediately, minus the agent's cut.
      const signed: Player = {
        ...next,
        contract: { clubName, terms, signedWeek: week, expiresWeek: week + terms.years * SEASON_WEEKS },
        money: (next.money ?? 0) + netWage(terms.signingBonus, next.agentId),
        careerEarnings: (next.careerEarnings ?? 0) + terms.signingBonus,
        agentFeesPaid: (next.agentFeesPaid ?? 0) + commissionOn(terms.signingBonus, next.agentId),
      }
      // P33: the pipeline now closes three different deals.
      if (dealKind === 'renewal') {
        // Same club, fresh terms — no world transition, just a new contract.
        setState({ player: { ...signed, renewalDecided: false }, negotiationBeat: outcome.beat })
        void getState().saveCurrent()
        return
      }
      if (dealKind === 'professional') {
        // The win state, now earned through the same five stages as everything
        // else rather than a single tap.
        setState({
          player: { ...signed, turnedPro: { clubName, weekSigned: week }, contractOffers: [] },
          negotiationBeat: outcome.beat,
        })
        getState().runAchievementCheck()
        void getState().saveCurrent()
        return
      }
      setState({ player: signed, negotiationBeat: outcome.beat })
      // Hand off to the existing academy transition for world/cup/reputation setup.
      getState().completeAcademyMove(clubName, prestige)
      return
    }

    setState({ player: next, negotiationBeat: outcome.beat })
    void getState().saveCurrent()
  },

  // Phase 28: spend a bit of energy to work on a relationship. This is the
  // player's direct lever on the cast — everything else moves bonds as a side
  // effect of events, this is deliberate investment.
  interactWith: (relationshipId, interactionId) => {
    const { player } = getState()
    if (!player) return null
    const list = player.relationships ?? []
    const person = list.find((r) => r.id === relationshipId)
    const interaction = INTERACTIONS.find((i) => i.id === interactionId)
    if (!person || !interaction || person.ended) return null
    if (player.fitness.stamina < interaction.energyCost) return null
    // Audit fix: one meaningful interaction per person per week. Without this,
    // spamming interactions pinned every bond at 100 inside 12 weeks.
    const currentWeek = player.totalWeeksElapsed ?? 0
    if (interactedThisWeek(person, currentWeek)) return null

    const outcome = resolveInteraction(person, interaction)
    const updated = adjustBond(list, relationshipId, outcome.delta, outcome.memory)
      .map((r) => (r.id === relationshipId ? { ...r, lastInteractedWeek: currentWeek } : r))
    setState({
      player: {
        ...player,
        relationships: updated,
        fitness: { stamina: Math.round(clamp(player.fitness.stamina - interaction.energyCost, 0, 100)) },
      },
    })
    void getState().saveCurrent()
    return { success: outcome.success, delta: outcome.delta }
  },

  runAchievementCheck: (match) => {
    const { player } = getState()
    if (!player) return
    const unlocked = player.achievements ?? []
    const newly = checkAchievements({ player, match }, unlocked)
    if (newly.length === 0) return
    setState({
      player: { ...player, achievements: [...unlocked, ...newly.map((a) => a.key)] },
      pendingAchievements: [...getState().pendingAchievements, ...newly],
    })
    void getState().saveCurrent()
  },

  noteLifeEvent: (key) => {
    const { player } = getState()
    if (!player) return
    // Keep only a short window — enough to stop repeats, not a growing save payload.
    setState({ player: { ...player, recentLifeEvents: [...(player.recentLifeEvents ?? []), key].slice(-6) } })
  },

  applyRestChoice: (choice) => {
    const { player, calendar } = getState()
    if (!player || !calendar) return
    const opt = restOption(choice)
    const recovered = recoveryFor(player, choice)

    const updatedPlayer: Player = {
      ...player,
      fitness: { stamina: Math.round(clamp(player.fitness.stamina - opt.energyCost + recovered, 0, 100)) },
      confidence: {
        ...player.confidence,
        value: clamp(player.confidence.value + opt.confidenceDelta, -10, 10),
      },
      coachTrust: clamp((player.coachTrust ?? 0) + opt.trustDelta, -10, 10),
      recentInjuryCount: Math.max(0, (player.recentInjuryCount ?? 0) - opt.injuryHistoryRelief),
    }

    const event = nextUnresolvedEvent(calendar)
    const updatedCalendar = event ? markResolved(calendar, event.id) : calendar
    setState({ player: updatedPlayer, calendar: updatedCalendar })
    void getState().saveCurrent()
  },

  advanceToNextWeek: () => {
    const { player, calendar, league, academyLeague, cups, international, youthWorld, youthV5 } = getState()
    if (!player || !calendar) return
    let lastEconomyNote: string | null = null
    let lastSelectionNote: string | null = null
    let lastContractNote: string | null = null
    const completedWeekNumber = calendar.currentWeek.weekNumber
    const phase = player.careerClock.phase
    // P56 — Call-up check BEFORE building next week: crossing the RATING bar
    // (not the old hidden reputation gate) starts an international campaign,
    // and the next calendar week needs to know about it to lay down
    // Wednesday duty. Once a campaign exists, being selected for any GIVEN
    // fixture additionally depends on real recent form — eligible doesn't
    // mean automatic, matching how a real youth call-up actually works.
    let updatedInternational = international
    if (!updatedInternational && isCallUpEligible(toOvr(computeCurrentAbility(player)))) {
      const nation = getNation(player.nationality)
      updatedInternational = initInternationalWorld(nation.name)
    }
    const campaignActive = !!updatedInternational && updatedInternational.stage !== 'complete' && updatedInternational.stage !== 'not-qualified'
    const hasDuty = campaignActive && formQualifiesForSelection(player.matchRatings ?? [])
    const result = advanceWeek(calendar, player.careerClock.ageYears, phase, hasDuty)
    // injuries count down by ~1 week per week advance; clear when recovered
    const injuryStillOut = player.injury && player.injury.weeksRemaining > 1
    // coach trust decays gently toward neutral each week (spec: needs reinforcement)
    const decayedTrust = decayTrust({ value: player.coachTrust ?? 0 })
    // confidence regresses toward the player's resting point each week (see decayConfidence)
    const decayedConfidence = decayConfidence(player.confidence.value, player.confidence.baseline ?? 0)
    // offers expire if the player hasn't acted — holding out is a real risk (spec).
    // Uses an absolute totalWeeksElapsed counter (not the resettable per-season weekNumber)
    // so expiry math is never affected by season rollover.
    const nextTotalWeeks = (player.totalWeeksElapsed ?? 0) + 1
    const survivingOffers = (player.contractOffers ?? []).filter(
      (o) => nextTotalWeeks - o.weekOffered < o.expiresInWeeks
    )

    // Batch-sim the rest of the division ONLY on weeks the player also has a fixture
    // (MATCH_WEEKS) — otherwise the rest of the league would finish its 9-fixture season
    // in the first 9 calendar weeks while the player, whose matchdays are spread across
    // all 34 weeks, is still only a few games in. Keeping this gated keeps everyone in sync.
    // Uses an explicit round index (position within MATCH_WEEKS) rather than inferring from
    // unplayed fixtures, so a player-missed match (e.g. injury) can never stall the rest of
    // the division's simulation. Promotion/relegation still applies at season end regardless.
    // Same treatment applies to the academy world once the player has transitioned there.
    let updatedLeague = league
    let updatedAcademyLeague = academyLeague
    let updatedCups: CupWorlds = { ...cups }
    const isInAcademy = phase === 'academy'
    // P25 fix (THE Phase 25 audit blocker): resolve this week's competition
    // phase-aware, and give EVERY registered competition its sim branch —
    // the previous code only ever handled 'sundayLeague' while the calendar
    // reserved matchdays for five other competitions that didn't exist at
    // runtime, producing 20 dead matchdays a season and zero cup football.
    const weekCompetition = activeCompetitionForWeek(completedWeekNumber, phase)

    if (weekCompetition?.competitionId === 'sundayLeague') {
      const round = weekCompetition.round
      if (!isInAcademy && updatedLeague) {
        const division = updatedLeague.divisions[updatedLeague.playerDivision]
        // Sim through this round; include the player's team if their fixture is
        // still unplayed (injured matchday) so the season never strands a fixture.
        const playerUnplayed = division.fixtures.some((f) => !f.played && f.week <= round && (f.homeTeamId === updatedLeague!.playerTeamId || f.awayTeamId === updatedLeague!.playerTeamId))
        const simmed = batchSimDivisionRound(division, round, updatedLeague.playerTeamId, playerUnplayed)
        // P63 — real, confirmed bug: every other division in the pyramid
        // (whichever tiers the player ISN'T currently in) never got
        // batch-simmed anywhere in the codebase — checked every call site.
        // Their fixtures stayed permanently unplayed forever, standings
        // never moved. Sim every OTHER division for the same round too, so
        // the rest of the pyramid actually runs in parallel instead of
        // sitting frozen.
        const otherDivisions = { ...updatedLeague.divisions, [updatedLeague.playerDivision]: simmed }
        for (const tier of Object.keys(updatedLeague.divisions) as unknown as (1 | 2 | 3)[]) {
          if (Number(tier) === updatedLeague.playerDivision) continue
          otherDivisions[tier] = batchSimDivisionRound(otherDivisions[tier], round, '', false)
        }
        updatedLeague = { ...updatedLeague, divisions: otherDivisions }
      }
      if (isInAcademy && updatedAcademyLeague) {
        const division = updatedAcademyLeague.divisions[updatedAcademyLeague.playerDivision]
        const playerUnplayed = division.fixtures.some((f) => !f.played && f.week <= round && (f.homeTeamId === updatedAcademyLeague!.playerTeamId || f.awayTeamId === updatedAcademyLeague!.playerTeamId))
        const simmed = batchSimAcademyRound(division, round, updatedAcademyLeague.playerTeamId, playerUnplayed)
        // Same fix for the academy pyramid's other tiers.
        const otherAcademyDivisions = { ...updatedAcademyLeague.divisions, [updatedAcademyLeague.playerDivision]: simmed }
        for (const tier of Object.keys(updatedAcademyLeague.divisions) as unknown as (keyof typeof updatedAcademyLeague.divisions)[]) {
          if (String(tier) === String(updatedAcademyLeague.playerDivision)) continue
          otherAcademyDivisions[tier] = batchSimAcademyRound(otherAcademyDivisions[tier], round, '', false)
        }
        updatedAcademyLeague = { ...updatedAcademyLeague, divisions: otherAcademyDivisions }
      }
    } else if (weekCompetition && weekCompetition.competitionId in updatedCups) {
      const key = weekCompetition.competitionId as keyof CupWorlds
      let cupWorld = updatedCups[key]
      if (cupWorld && cupWorld.stage !== 'complete') {
        // Include the player's fixture in the sim if it's still unplayed after
        // their Saturday (injured, or they're eliminated and their team plays on).
        const stillUnplayed = playerCupFixture({ ...cupWorld, playerEliminated: false }) !== null
        cupWorld = batchSimCupStage(cupWorld, weekCompetition.round, stillUnplayed)
        cupWorld = advanceCupStage(cupWorld)
        updatedCups = { ...updatedCups, [key]: cupWorld }
      }
    }
    // 'schoolFriendlies' needs no batch sim — friendlies are self-contained.

    // International windows run MIDWEEK, independent of the Saturday branch above.
    if (updatedInternational && campaignActive) {
      const intlRound = internationalRoundForWeek(completedWeekNumber)
      if (intlRound) {
        if (updatedInternational.stage === 'qualifiers' && intlRound.stage === 'qualifiers') {
          const byId = new Map(updatedInternational.qualifyingGroup.teams.map((t) => [t.id, t]))
          // sim rounds through the window index (self-heals a mid-season call-up
          // whose earlier windows predate the campaign)
          for (let r = 1; r <= intlRound.round; r++) {
            updatedInternational = batchSimQualifyingRound(updatedInternational, r, byId)
          }
          // the nation's own missed fixtures (player injured) sim as NPC games
          const pending = nationFixture(updatedInternational)
          if (pending && pending.round <= intlRound.round) {
            const home = byId.get(pending.homeTeamId)!, away = byId.get(pending.awayTeamId)!
            const hg = Math.max(0, Math.round((home.ratings.attack - away.ratings.defense) / 30 + 1))
            const ag = Math.max(0, Math.round((away.ratings.attack - home.ratings.defense) / 30 + 1))
            updatedInternational = recordNationResult(updatedInternational, pending.homeTeamId === updatedInternational.nationTeamId ? pending.awayTeamId : pending.homeTeamId, pending.homeTeamId === updatedInternational.nationTeamId ? hg : ag, pending.homeTeamId === updatedInternational.nationTeamId ? ag : hg, pending.homeTeamId === updatedInternational.nationTeamId)
          }
          updatedInternational = advanceInternationalStage(updatedInternational)
        } else if (updatedInternational.stage === 'finals' && intlRound.stage === 'finals') {
          updatedInternational = batchSimFinalsRound(updatedInternational)
          const pending = nationFixture(updatedInternational)
          if (pending) {
            // player missed the finals tie — nation plays without them, simple sim
            const byId = internationalTeamById(updatedInternational)
            const home = byId.get(pending.homeTeamId)!, away = byId.get(pending.awayTeamId)!
            const hg = Math.max(0, Math.round((home.ratings.attack - away.ratings.defense) / 30 + 1))
            let ag = Math.max(0, Math.round((away.ratings.attack - home.ratings.defense) / 30 + 1))
            if (hg === ag) ag += 1
            const nationHome = pending.homeTeamId === updatedInternational.nationTeamId
            updatedInternational = recordNationResult(updatedInternational, nationHome ? pending.awayTeamId : pending.homeTeamId, nationHome ? hg : ag, nationHome ? ag : hg, nationHome)
          }
          updatedInternational = advanceInternationalStage(updatedInternational)
        }
      }
    }

    // P27 — REALISTIC CLUB TRANSFERS (grassroots only; academy moves stay the
    // scouted academy-offer path). During the mid-season window (weeks 18-24)
    // and the run-in window (weeks 40-43), Sunday League clubs who've seen
    // enough — reputation + recent form — can approach you to join THEM next
    // Saturday. The approaching club is a REAL team from the league world (you
    // would genuinely play with that squad in that division), never a
    // fabricated one, and stronger divisions demand more reputation.
    let clubApproachOffers = survivingOffers
    const inTransferWindow = (completedWeekNumber >= 18 && completedWeekNumber <= 24) || (completedWeekNumber >= 40 && completedWeekNumber <= 43)
    if (!isInAcademy && updatedLeague && inTransferWindow && !player.injury) {
      const recentForm = (player.matchRatings ?? []).slice(-5)
      const formAvg = recentForm.length >= 3 ? recentForm.reduce((a, b) => a + b, 0) / recentForm.length : 0
      const rep = player.reputation ?? 0
      const alreadyHasClubOffer = clubApproachOffers.some((o) => o.kind === 'club')
      // ~8% of window weeks with good form + some reputation — a couple of
      // approaches per strong season, none for a quiet one.
      if (!alreadyHasClubOffer && formAvg >= 6.8 && rep >= 12 && rand() < 0.08) {
        const targetTier = rep >= 35 && updatedLeague.playerDivision > 1
          ? updatedLeague.playerDivision - 1 // a division above comes calling
          : updatedLeague.playerDivision // a stronger side in your own division
        const division = updatedLeague.divisions[targetTier as 1 | 2 | 3]
        const candidates = division.teams.filter((t) => t.id !== updatedLeague!.playerTeamId)
        const club = candidates[Math.floor(rand() * candidates.length)]
        if (club) {
          clubApproachOffers = [...clubApproachOffers, {
            id: crypto.randomUUID(), clubId: club.id, clubName: club.name, clubShort: club.short,
            weekOffered: nextTotalWeeks, expiresInWeeks: 3, prestige: club.prestige, ratings: club.ratings,
            kind: 'club' as const, divisionTier: targetTier,
          }]
        }
      }
    }

    // P33: build the review BEFORE promotion/relegation and the stat reset, so
    // it reports the season that was actually played.
    let seasonReview: import('../engine/seasonReview').SeasonReview | null = null
    let personalAwardsWon: import('../engine/glory').PersonalGloryKey[] = []
    let clubAwardsWon: import('../engine/glory').ClubGloryKey[] = []
    let nationalAwardWon = false
    if (result.seasonEnded) {
      // `player` (not the post-tick copy) still holds the season just played.
      seasonReview = buildSeasonReview(
        player,
        isInAcademy ? updatedAcademyLeague : updatedLeague,
        updatedCups,
        isInAcademy,
        player.careerClock.grassrootsSeason ?? 1,
        {
          appearances: player.seasonAppearances ?? 0,
          goals: player.seasonGoals ?? 0,
          assists: player.seasonAssists ?? 0,
          ratings: player.seasonRatings ?? [],
        },
      )
      // P36 — Glory: decide season AWARDS from the same review, before it
      // resets. computeSeasonAwards/computeClubAwards only OBSERVE (same
      // discipline as achievements.ts) — nothing here touches attributes,
      // trust or reputation, a trophy is a record, not a lever.
      personalAwardsWon = computeSeasonAwards(seasonReview, player.goldenBootRival)
      clubAwardsWon = computeClubAwards(seasonReview)
    }

    if (result.seasonEnded) {
      if (!isInAcademy && updatedLeague) updatedLeague = applyPromotionRelegation(updatedLeague)
      if (isInAcademy && updatedAcademyLeague) updatedAcademyLeague = applyAcademyPromotion(updatedAcademyLeague)
      // Fresh cup draws every season; a finished international campaign resets
      // too (eligibility is re-checked, so a star keeps getting called up).
      const grassrootsTeam = updatedLeague ? updatedLeague.divisions[updatedLeague.playerDivision].teams.find((t) => t.id === updatedLeague!.playerTeamId) : null
      const academyTeam = updatedAcademyLeague ? updatedAcademyLeague.divisions[updatedAcademyLeague.playerDivision].teams.find((t) => t.id === updatedAcademyLeague!.playerTeamId) : null
      const allLeagueTeams = updatedLeague ? Object.values(updatedLeague.divisions).flatMap((d) => d.teams) : []
      const allAcademyTeams = updatedAcademyLeague ? Object.values(updatedAcademyLeague.divisions).flatMap((d) => d.teams) : []
      updatedCups = {
        schoolCup: !isInAcademy && grassrootsTeam ? initCupById('schoolCup', grassrootsTeam, allLeagueTeams) : null,
        sundayCup: !isInAcademy && grassrootsTeam ? initCupById('sundayCup', grassrootsTeam, allLeagueTeams) : null,
        academyLeagueCup: isInAcademy && academyTeam ? initCupById('academyLeagueCup', academyTeam, allAcademyTeams) : null,
        academyKnockoutCup: isInAcademy && academyTeam ? initCupById('academyKnockoutCup', academyTeam, allAcademyTeams) : null,
      }
      // P36 — National glory: capture BEFORE the campaign resets. A completed
      // campaign that was actually won earns the trophy; anything else
      // (eliminated, still qualifying) earns nothing.
      nationalAwardWon = !!(updatedInternational?.stage === 'complete' && updatedInternational.wonTournament)
      updatedInternational = null
    }

    // Phase 22b: squad lifecycle runs once per season boundary — growth, then
    // departures/replacements (order matters: departures should reflect the
    // grown quality, not the pre-growth one, so a breakout season teammate is
    // the one actually attracting transfer interest).
    let updatedSquad = player.squad
    let seasonDepartures: import('../engine/squadLifecycle').DepartureEvent[] = []
    let seasonArrivals: import('../engine/squad').SquadPlayer[] = []
    if (result.seasonEnded && updatedSquad) {
      const beforeIds = new Set(updatedSquad.map((p) => p.id))
      updatedSquad = growSquadForSeason(updatedSquad).map((p) => ({ ...p, seasonGoals: 0, seasonAssists: 0 }))
      const { squad: afterDepartures, departures } = rollSquadDepartures(updatedSquad)
      updatedSquad = afterDepartures
      seasonDepartures = departures
      seasonArrivals = updatedSquad.filter((p) => !beforeIds.has(p.id))
      // Departure events now feed the Gazette (see below) — no longer silently
      // lost, though they still don't route through the life-events engine
      // itself (that would be a further phase, not this one).
    }

    // Phase 25: THE GAZETTE. Once per week (matches "drops every Monday" —
    // this fires right as the new week is built), pulling together whatever
    // actually happened: squad transfers (season-end only), the last match,
    // any current injury, and a preview of the next fixture if one exists.
    const activeWorld = isInAcademy ? updatedAcademyLeague : updatedLeague
    let upcomingFixtureInfo: import('../engine/gazette').UpcomingFixtureInfo | null = null
    if (activeWorld) {
      const division = (activeWorld.divisions as Record<number, import('../engine/league').Division>)[activeWorld.playerDivision]
      const next = division.fixtures.find((f) => !f.played && (f.homeTeamId === activeWorld.playerTeamId || f.awayTeamId === activeWorld.playerTeamId))
      if (next) {
        const opponentId = next.homeTeamId === activeWorld.playerTeamId ? next.awayTeamId : next.homeTeamId
        const opponent = division.teams.find((t) => t.id === opponentId)
        const ownTeam = division.teams.find((t) => t.id === activeWorld.playerTeamId)
        if (opponent && ownTeam) {
          upcomingFixtureInfo = {
            opponentName: opponent.name,
            opponentPrestige: opponent.prestige,
            ownPrestige: ownTeam.prestige,
            competitionLabel: isInAcademy ? 'the league' : 'the Sunday League',
            isRivalOrCup: false,
          }
        }
      }
    }
    const gazetteIssue = generateGazetteIssue(
      result.calendar.currentWeek.weekNumber,
      result.calendar.currentWeek.seasonYear,
      player,
      seasonDepartures,
      seasonArrivals,
      upcomingFixtureInfo,
      player.lastMatchResult ?? null
    )

    // Phase 28 — the life layer's weekly tick.
    // 1) bonds drift toward neutral when neglected
    const driftedRelationships = driftRelationships(player.relationships ?? [])
    // 2) the cast pays off mechanically (all deltas deliberately tiny — they
    //    run EVERY week, and P15/P24 both proved unbounded weekly deltas
    //    saturate clamped stats and silently switch systems off)
    const relEffects = relationshipEffects(driftedRelationships)
    const driftedStanding = driftStanding(player.standing)

    let updatedPlayer: Player = {
      ...player,
      relationships: driftedRelationships,
      standing: driftedStanding,
      squad: updatedSquad,
      gazetteIssues: [...(player.gazetteIssues ?? []), gazetteIssue].slice(-8),
      // season tallies reset at each season boundary (so "season goals" != career goals)
      seasonGoals: result.seasonEnded ? 0 : player.seasonGoals,
      seasonAppearances: result.seasonEnded ? 0 : (player.seasonAppearances ?? 0),
      seasonRatings: result.seasonEnded ? [] : (player.seasonRatings ?? []),
      seasonAssists: result.seasonEnded ? 0 : player.seasonAssists,
      // P64 — the golden boot rival is now a real player from a real,
      // findable team whenever the simulated season has one (falls back to
      // the old synthetic drift only when nobody's scored yet — very early
      // season, or a fresh world with no data to draw from).
      goldenBootRival: (() => {
        const division = isInAcademy
          ? updatedAcademyLeague?.divisions[updatedAcademyLeague.playerDivision]
          : updatedLeague?.divisions[updatedLeague.playerDivision]
        const activePlayerTeamId = isInAcademy ? updatedAcademyLeague?.playerTeamId : updatedLeague?.playerTeamId
        const real = division && activePlayerTeamId ? topScorerInDivision(division, activePlayerTeamId) : null
        if (real) return real
        return result.seasonEnded
          ? initSyntheticScorer()
          : driftSyntheticScorer(player.goldenBootRival ?? initSyntheticScorer())
      })(),
      // P36 — Glory: fold in whatever this season earned. addGlory is additive
      // (increments existing counts), so a career's cabinet only ever grows.
      personalGlory: personalAwardsWon.length > 0 ? addGlory(player.personalGlory, personalAwardsWon) : player.personalGlory,
      clubGlory: clubAwardsWon.length > 0 ? addGlory(player.clubGlory, clubAwardsWon) : player.clubGlory,
      nationalGlory: nationalAwardWon ? addGlory(player.nationalGlory, ['internationalTrophy'] as const) : player.nationalGlory,
      injury: injuryStillOut ? { ...player.injury!, weeksRemaining: player.injury!.weeksRemaining - 1 } : null,
      coachTrust: clamp(decayedTrust.value + relEffects.trustDrift, -10, 10),
      confidence: { ...player.confidence, value: clamp(decayedConfidence + relEffects.confidenceSupport, -10, 10) },
      fitness: { stamina: Math.round(clamp(player.fitness.stamina + relEffects.energySupport, 0, 100)) },
      contractOffers: clubApproachOffers,
      totalWeeksElapsed: nextTotalWeeks,
      careerClock: {
        ...player.careerClock,
        ageYears: result.newAge,
        grassrootsSeason: result.seasonEnded && player.careerClock.grassrootsSeason
          ? (Math.min(4, player.careerClock.grassrootsSeason + 1) as typeof player.careerClock.grassrootsSeason)
          : player.careerClock.grassrootsSeason,
      },
    }
    // 3) P29 economy tick: kit wears out, and the allowance lands monthly.
    const { equipment: agedEquipment, expired } = ageEquipment(updatedPlayer.equipment)
    updatedPlayer = { ...updatedPlayer, equipment: agedEquipment }
    if (expired.length > 0) {
      // surfaced on the hub rather than vanishing silently
      lastEconomyNote = `${expired.map((id) => itemById(id)?.name ?? 'kit').join(', ')} finally wore out.`
    }
    // Your parents stop the allowance once the club is paying you.
    if (!updatedPlayer.contract && allowanceDue(updatedPlayer)) {
      const amount = monthlyAllowance(updatedPlayer)
      updatedPlayer = {
        ...updatedPlayer,
        money: (updatedPlayer.money ?? 0) + amount,
        lastAllowanceWeek: updatedPlayer.totalWeeksElapsed ?? 0,
      }
      lastEconomyNote = lastEconomyNote
        ? `${lastEconomyNote} Allowance came in: £${amount}.`
        : `Allowance came in: £${amount}.`
    }

    // 3a) P31 — TEAM SELECTION. The coach picks his side every week. This is
    // the missing path from bench to starting XI: before this, nothing in the
    // game could promote a player who was training well and performing.
    //
    // P50 — STICKY selection. This used to recompute and overwrite the role
    // every single week with no minimum tenure, which meant a trial or a
    // coach verdict never actually held — a real coach doesn't hand a debut
    // start to a kid who scraped onto the bench three days ago. A verdict
    // now has to hold for SETTLE_WEEKS before the coach reconsiders, in
    // EITHER direction — this also protects a good player from one bad week
    // right after a promotion causing instant whiplash.
    const SETTLE_WEEKS = 3
    const weeksSinceSet = (updatedPlayer.totalWeeksElapsed ?? 0) - (updatedPlayer.squadRoleSetWeek ?? 0)
    const verdict = decideSelection(updatedPlayer, updatedPlayer.squad)
    if (verdict.changed && weeksSinceSet >= SETTLE_WEEKS) {
      updatedPlayer = { ...updatedPlayer, squadRole: verdict.role, squadRoleSetWeek: updatedPlayer.totalWeeksElapsed ?? 0 }
      lastSelectionNote = verdict.reason
    } else if (verdict.changed) {
      // A change is warranted but hasn't settled yet — surface the pecking
      // order itself so it's visible, not silent, even while nothing moves.
      const weeksLeft = SETTLE_WEEKS - weeksSinceSet
      lastSelectionNote = `You're ${verdict.pecking}${verdict.pecking === 1 ? 'st' : verdict.pecking === 2 ? 'nd' : verdict.pecking === 3 ? 'rd' : 'th'} choice of ${verdict.competing} for your position. The coach won't reconsider the side for ${weeksLeft} more week${weeksLeft === 1 ? '' : 's'}.`
    }

    // 3b) P30 — WAGES. Once you're on a scholarship the club pays you weekly,
    // minus your agent's cut. This is the first real income in the game: a
    // £150/wk scholarship dwarfs a £30 monthly allowance, which is exactly the
    // step-change signing for an academy should feel like.
    if (updatedPlayer.contract) {
      const gross = updatedPlayer.contract.terms.weeklyWage
      const fee = commissionOn(gross, updatedPlayer.agentId)
      // Digs, travel and food come straight back out — a scholarship is income
      // AND independence, not free money.
      const living = weeklyLivingCost(updatedPlayer)
      updatedPlayer = {
        ...updatedPlayer,
        money: Math.max(0, (updatedPlayer.money ?? 0) + netWage(gross, updatedPlayer.agentId) - living),
        careerEarnings: (updatedPlayer.careerEarnings ?? 0) + gross,
        agentFeesPaid: (updatedPlayer.agentFeesPaid ?? 0) + fee,
      }
    }

    // 3b2) P33 — CONTRACT LIFECYCLE. Found by playing a career to the end: a
    // scholarship signed in week 78 expired in week 166 and the player was
    // still being paid in week 248, because expiresWeek was never read.
    if (updatedPlayer.contract && !isLive(updatedPlayer.negotiation)) {
      const status = contractStatus(updatedPlayer)

      const contractClub = updatedPlayer.contract.clubName
      if (status.kind === 'decision-due' && !updatedPlayer.renewalDecided) {
        const verdict = renewalVerdict(updatedPlayer)
        updatedPlayer = { ...updatedPlayer, renewalDecided: true }
        if (verdict.keep) {
          const club = contractClub
          const wage = renewalBaseWage(updatedPlayer, verdict.score)
          updatedPlayer = {
            ...updatedPlayer,
            negotiation: startNegotiation(updatedPlayer, 'renewal-club', club, 6, 'renewal', wage),
          }
          lastContractNote = `${club} want to extend your deal.`
        } else {
          lastContractNote = `${contractClub} have told you they are not renewing. ${verdict.reason}`
        }
      }

      if (status.kind === 'expired') {
        const outcome = releaseOutcome(updatedPlayer)
        updatedPlayer = {
          ...updatedPlayer,
          contract: null,
          renewalDecided: false,
          careerEnded: outcome.endsCareer ? true : updatedPlayer.careerEnded,
          // Released from an academy means dropping back into local football.
          careerClock: outcome.endsCareer
            ? updatedPlayer.careerClock
            : { ...updatedPlayer.careerClock, phase: 'grassroots-season' },
          academyClubName: outcome.endsCareer ? updatedPlayer.academyClubName : null,
          squadRole: 'bench',
          coachTrust: 0,
        }
        lastContractNote = outcome.message
        if (!outcome.endsCareer) {
          // back to a grassroots world; the next tick rebuilds it
          updatedAcademyLeague = null
          updatedLeague = null
        }
      }
    }

    // 3c) P30 — the negotiation runs on the weekly clock, which is what makes
    // it take weeks rather than being a menu cleared in one sitting.
    let negotiationBeatThisWeek: string | null = null
    if (isLive(updatedPlayer.negotiation)) {
      const ticked = tickNegotiation(updatedPlayer.negotiation!, updatedPlayer)
      if (ticked) {
        updatedPlayer = { ...updatedPlayer, negotiation: ticked.negotiation }
        negotiationBeatThisWeek = ticked.beat
      }
    }

    // 4) storyline arcs: judge the live ones, then maybe open a new one.
    //    Verdicts are applied here so a deadline that expires this week lands
    //    with real consequences (trust, confidence, even losing your place).
    const { remaining, verdicts } = tickArcs(updatedPlayer.activeArcs ?? [], updatedPlayer)
    let arcPlayer: Player = { ...updatedPlayer, activeArcs: remaining }
    for (const v of verdicts) {
      const cons = v.consequence
      arcPlayer = {
        ...arcPlayer,
        confidence: { ...arcPlayer.confidence, value: clamp(arcPlayer.confidence.value + (cons.confidence ?? 0), -10, 10) },
        coachTrust: clamp((arcPlayer.coachTrust ?? 0) + (cons.coachTrust ?? 0), -10, 10),
        reputation: clamp((arcPlayer.reputation ?? 0) + (cons.reputation ?? 0), 0, 100),
        fitness: { stamina: Math.round(clamp(arcPlayer.fitness.stamina + (cons.energy ?? 0), 0, 100)) },
        squadRole: cons.setSquadRole ?? arcPlayer.squadRole,
        recentArcKeys: [...(arcPlayer.recentArcKeys ?? []), v.arc.key].slice(-10),
      }
      if (cons.bond && v.arc.relationshipId) {
        arcPlayer = { ...arcPlayer, relationships: adjustBond(arcPlayer.relationships ?? [], v.arc.relationshipId, cons.bond, cons.narrative) }
      }
    }
    const newArc = maybeStartArc(arcPlayer, result.calendar.currentWeek.weekNumber, arcPlayer.activeArcs ?? [], arcPlayer.recentArcKeys ?? [])
    if (newArc) arcPlayer = { ...arcPlayer, activeArcs: [...(arcPlayer.activeArcs ?? []), newArc] }

    // V5 graduation rule: if school ends at 18 and no academy/pro route was secured, the youth career ends here.
    const graduatedWithoutAcademy = result.seasonEnded && result.newAge >= 18 && arcPlayer.careerClock.phase !== 'academy' && !arcPlayer.turnedPro
    const finalPlayer = (result.reachedAgeCap || graduatedWithoutAcademy)
      ? { ...arcPlayer, careerEnded: true }
      : arcPlayer

    // P35 — weekly headlines: title race / relegation tension / golden boot
    // chase / a big cup tie coming up. Checked once per week, separate from
    // the achievement check below, and gated inside the engine so it doesn't
    // fire every single week.
    const activeWorldForHeadlines = isInAcademy ? updatedAcademyLeague : updatedLeague
    const divisionForHeadlines = activeWorldForHeadlines
      ? (activeWorldForHeadlines.divisions as Record<number, import('../engine/league').Division>)[activeWorldForHeadlines.playerDivision]
      : null
    let nextFixtureInfo: { opponentName: string; isCupKnockout: boolean; cupRoundLabel?: string } | null = null
    const liveCup = Object.values(updatedCups).find((c) => c && !c.playerEliminated && c.stage === 'knockout')
    if (liveCup) {
      const fx = playerCupFixture(liveCup)
      if (fx) {
        const oppId = fx.homeTeamId === liveCup.playerTeamId ? fx.awayTeamId : fx.homeTeamId
        const opp = liveCup.teams.find((t: import('../engine/teams').Team) => t.id === oppId)
        if (opp) nextFixtureInfo = { opponentName: opp.name, isCupKnockout: true, cupRoundLabel: liveCup.label }
      }
    }
    const weeklyHeadlines = checkWeeklyHeadlines({
      player: finalPlayer,
      weekNumber: result.calendar.currentWeek.weekNumber,
      seasonWeeks: SEASON_WEEKS,
      standings: divisionForHeadlines?.standings ?? null,
      playerTeamId: activeWorldForHeadlines?.playerTeamId ?? null,
      scorer: finalPlayer.goldenBootRival ?? initSyntheticScorer(),
      nextFixture: nextFixtureInfo,
      worldTeamNames: divisionForHeadlines?.teams.map((t) => t.name) ?? [],
    })

    // V5 live pathway orchestration. These systems used to exist as isolated
    // engines; the weekly career tick now owns their lifecycle.
    let nextYouthV5={...youthV5}
    let pathwayWorld=youthWorld
    const newWeek=result.calendar.currentWeek.weekNumber
    const route=pathwayWorld?.pathway.route??player.youthRoute
    const playerOvr=toOvr(computeCurrentAbility(updatedPlayer))
    if(pathwayWorld&&route==='school'&&newWeek===29&&!nextYouthV5.regionalCamp){
      const school=pathwayWorld.schools.find(s=>s.id===pathwayWorld!.selectedSchoolId)??pathwayWorld.schools[0]
      nextYouthV5.regionalCamp=createRegionalCamp(pathwayWorld,school.districtId,{id:player.id,name:player.name,age:updatedPlayer.careerClock.ageYears,position:player.position,overall:playerOvr,schoolId:school.id},newWeek)
      nextYouthV5.gazetteStories=[...nextYouthV5.gazetteStories,selectionStory(newWeek,'regional selection camp',player.name,true,'You have been named on the 60-player regional camp longlist.')].slice(-120)
    }
    if(pathwayWorld&&nextYouthV5.regionalCamp&&newWeek>=30&&newWeek<=31&&nextYouthV5.regionalCamp.stage!=='complete'){
      let camp=simulateNpcCampAssessments(nextYouthV5.regionalCamp,pathwayWorld,newWeek-28)
      camp=advanceRegionalCamp(camp);nextYouthV5.regionalCamp=camp
      if(camp.stage==='final-23'){
        const selected=camp.finalSquadIds.includes(player.id)
        pathwayWorld={...pathwayWorld,pathway:{...pathwayWorld.pathway,representative:selected?'regional-squad':pathwayWorld.pathway.representative}}
        nextYouthV5.gazetteStories=[...nextYouthV5.gazetteStories,selectionStory(newWeek,'regional final 23',player.name,selected,selected?'You survived the regional cuts and made the final squad.':'The final regional cut ended your representative run this season.')].slice(-120)
        nextYouthV5.nationalPathway=selectNational23(buildNationalShortlist(player.nationality??'eng',[camp.trialists.filter(p=>p.selected)]))
      }
    }
    if(pathwayWorld&&newWeek===36&&!nextYouthV5.octoberCompetition){
      const teamName=route==='school'?(pathwayWorld.schools.find(s=>s.id===pathwayWorld!.selectedSchoolId)?.name??'Your School'):(pathwayWorld.sundayClubs.find(s=>s.id===pathwayWorld!.pathway.sundayClubId)?.name??'Your Club')
      const teams=[{id:'user-oct',name:teamName,strength:playerOvr,source:route==='school'?'school' as const:'sunday' as const},...Array.from({length:4},(_,i)=>({id:`oct-${i}`,name:`October XI ${i+1}`,strength:48+i*4,source:'school' as const}))]
      nextYouthV5.octoberCompetition=createOctoberLeague('october-development',teams)
    }
    if(nextYouthV5.octoberCompetition&&newWeek>=36&&newWeek<=40&&!nextYouthV5.octoberCompetition.complete)nextYouthV5.octoberCompetition=advanceOctoberLeague(nextYouthV5.octoberCompetition,`${pathwayWorld?.seed}|oct|${newWeek}`,'user-oct')
    if(pathwayWorld&&newWeek===41&&!nextYouthV5.festival&&route==='grassroots'){
      const club=pathwayWorld.sundayClubs.find(s=>s.id===pathwayWorld!.pathway.sundayClubId)
      const teams=[{id:'user-fest',name:club?.name??'Your Club',strength:playerOvr,source:'sunday' as const},...Array.from({length:3},(_,i)=>({id:`fest-${i}`,name:`Festival XI ${i+1}`,strength:47+i*4,source:'sunday' as const}))]
      nextYouthV5.festival=createThreeDayFestival('november-festival',teams)
    }
    if(nextYouthV5.festival&&newWeek>=41&&newWeek<=43&&!nextYouthV5.festival.complete)nextYouthV5.festival=advanceFestival(nextYouthV5.festival,`${pathwayWorld?.seed}|festival|${newWeek}`,'user-fest')
    if(pathwayWorld&&updatedPlayer.careerClock.phase==='academy'&&updatedPlayer.academyClubName&&!nextYouthV5.academySeason){
      const club=pathwayWorld.academyClubs.find(a=>a.name===updatedPlayer.academyClubName)
      if(club)nextYouthV5.academySeason=buildAcademySeason(club,pathwayWorld.academyClubs,result.calendar.currentWeek.seasonYear,updatedPlayer.careerClock.ageYears)
    }
    if(nextYouthV5.academySeason&&updatedPlayer.careerClock.phase==='academy'){
      const avg=(updatedPlayer.seasonRatings??[]).length?(updatedPlayer.seasonRatings??[]).reduce((a,b)=>a+b,0)/(updatedPlayer.seasonRatings??[]).length:6
      const review=reviewAcademyRole('bench',{averageRating:avg,minutes:(updatedPlayer.seasonAppearances??0)*70,training:Math.min(100,(updatedPlayer.trainingMomentum??0)*10+55),discipline:90,energy:updatedPlayer.fitness.stamina,positionCompetition:55})
      nextYouthV5.academySeason={...nextYouthV5.academySeason,proPathwayScore:review.proPathwayScore,releaseRisk:review.releaseRisk}
      if(proContractEligible(nextYouthV5.academySeason,updatedPlayer.careerClock.ageYears,playerOvr)&&!(updatedPlayer.contractOffers??[]).some(o=>o.kind==='professional')){
        const club=pathwayWorld?.academyClubs.find(a=>a.id===nextYouthV5.academySeason!.clubId)
        if(club)updatedPlayer={...updatedPlayer,contractOffers:[...(updatedPlayer.contractOffers??[]),{id:`pro-v5-${newWeek}`,clubId:club.id,clubName:club.name,clubShort:club.name.slice(0,3).toUpperCase(),weekOffered:updatedPlayer.totalWeeksElapsed??0,expiresInWeeks:3,prestige:club.prestige,ratings:{attack:club.prestige,midfield:club.prestige,defense:club.prestige},kind:'professional'}]}
      }
    }
    if(finalPlayer.careerEnded&&!nextYouthV5.careerSummary){
      nextYouthV5.careerSummary=buildCareerSummary({reason:graduatedWithoutAcademy?'graduated-without-academy':'career-ended',age:finalPlayer.careerClock.ageYears,finalOverall:playerOvr,peakOverall:playerOvr,matches:finalPlayer.career?.appearances??0,goals:finalPlayer.career?.goals??0,assists:finalPlayer.career?.assists??0,trophies:Object.keys(finalPlayer.clubGlory??{}),awards:Object.keys(finalPlayer.personalGlory??{}),representativeCaps:0,academyName:finalPlayer.academyClubName??undefined,proClubName:finalPlayer.turnedPro?.clubName})
    }
    const updatedYouthWorld = pathwayWorld ? { ...pathwayWorld, currentWeek: result.calendar.currentWeek.weekNumber, seasonYear: result.calendar.currentWeek.seasonYear } : pathwayWorld
    setState({ player: finalPlayer, calendar: result.calendar, league: updatedLeague, academyLeague: updatedAcademyLeague, cups: updatedCups, international: updatedInternational, youthWorld: updatedYouthWorld, youthV5:nextYouthV5, pendingArcVerdicts: [...getState().pendingArcVerdicts, ...verdicts], pendingHeadlines: [...getState().pendingHeadlines, ...weeklyHeadlines], pendingSeasonReview: seasonReview, economyNote: lastContractNote ?? lastEconomyNote, selectionNote: lastSelectionNote, negotiationBeat: negotiationBeatThisWeek ?? getState().negotiationBeat })
    // Non-match achievements (scouts noticing you, offers arriving, coach trust,
    // reputation, squad role, injury comeback) have no match to hang off, so the
    // week tick is their trigger. Runs after setState so it reads the new state.
    getState().runAchievementCheck()
    void getState().saveCurrent()
  },

  applyTrainingOutcome: (outcome, energySpent, injury) => {
    const { player, calendar } = getState()
    if (!player || !calendar) return

    // P49 — attributes no longer grow directly from a training outcome.
    // outcome.attributeGains is intentionally UNUSED now (kept on the type
    // for now rather than ripped out, since gradeSession/objectives/momentum
    // all still read from the same TrainingOutcome shape) — real growth now
    // happens through the XP allocation screen the player taps through
    // themselves, using the restricted pool from trainingXpForDrill().

    const trustState = trustFromTrainingGrade({ value: player.coachTrust ?? 0 }, outcome.grade)

    // P63 — session streaks: cheap, sticky, borrowed from how mobile career
    // games (e.g. New Star Soccer) reward consistency. A whole calendar
    // week passing with no training breaks it; training in the same or the
    // very next week continues it.
    const currentWeek = calendar.currentWeek.weekNumber
    const weeksSinceLastTraining = currentWeek - (player.lastTrainingWeek ?? currentWeek)
    const trainingStreak = weeksSinceLastTraining > 1 ? 1 : (player.trainingStreak ?? 0) + 1

    const updatedPlayer: Player = {
      ...player,
      trainingStreak,
      lastTrainingWeek: currentWeek,
      trainingMomentum: outcome.newMomentum,
      confidence: {
        ...player.confidence,
        value: clamp(player.confidence.value + outcome.confidenceDelta, -10, 10),
      },
      fitness: { stamina: Math.round(clamp(player.fitness.stamina - energySpent, 0, 100)) },
      // Intensity choice nudges trust on top of the grade — coaches notice who grafts.
      coachTrust: clamp(trustState.value + (outcome.trustDelta ?? 0), -10, 10),
      // Phase 11: training-ground injuries are now possible. A 'knock' (weeksOut 0)
      // must NOT become an active injury or it soft-blocks the calendar for a week.
      injury: injury && injury.weeksOut > 0
        ? { severity: injury.severity, weeksRemaining: injury.weeksOut, description: injury.description }
        : player.injury,
      recentInjuryCount: injury && injury.weeksOut > 0
        ? (player.recentInjuryCount ?? 0) + 1
        : (player.recentInjuryCount ?? 0),
    }

    const event = nextUnresolvedEvent(calendar)
    const updatedCalendar = event ? markResolved(calendar, event.id) : calendar
    setState({ player: updatedPlayer, calendar: updatedCalendar })
    void getState().saveCurrent()
  },

  setYouthRoute: (route) => {
    const { player } = getState()
    if (!player) return
    const cleanPlayer: Player = {
      ...player,
      youthRoute: route,
      schoolId: route === 'school' ? player.schoolId : null,
      grassrootsClubId: route === 'grassroots' ? (player.grassrootsClubId ?? null) : null,
      trialWeekCompleted: 0,
      squadRole: null,
      careerClock: { ...player.careerClock, phase: route === 'school' ? 'school-trials' : 'grassroots-trials' },
    }
    const world = initializeCompetitionWorld(createYouthWorld(player.id, cleanPlayer.schoolId, 1, route, player.nationality??'eng'))
    setState({ player: cleanPlayer, youthWorld: world, league: null, cups: { ...EMPTY_CUPS } })
    void getState().saveCurrent()
  },

  setGrassrootsClub: (clubId) => {
    const { player, youthWorld } = getState()
    if (!player || player.youthRoute !== 'grassroots') return
    const world = youthWorld ?? initializeCompetitionWorld(createYouthWorld(player.id, null, 1, 'grassroots', player.nationality??'eng'))
    if (!world.sundayClubs.some((club) => club.id === clubId)) return
    setState({
      player: { ...player, schoolId: null, grassrootsClubId: clubId },
      youthWorld: { ...world, selectedSchoolId: null, pathway: { ...world.pathway, route: 'grassroots', sundayClubId: clubId, schoolTier: 'cut' } },
    })
    void getState().saveCurrent()
  },

  setSchool: (schoolId) => {
    const { player, youthWorld } = getState()
    if (!player || player.youthRoute !== 'school') return
    const baseWorld = youthWorld ? { ...youthWorld, selectedSchoolId: schoolId, pathway: { ...youthWorld.pathway, route: 'school' as const, sundayClubId: null } } : createYouthWorld(player.id, schoolId, 1, 'school', player.nationality??'eng')
    const nextWorld = initializeCompetitionWorld(baseWorld)
    setState({ player: { ...player, schoolId }, youthWorld: nextWorld })
    void getState().saveCurrent()
  },

  completeTrials: (role, performance) => {
    const { player, youthWorld } = getState()
    if (!player) return
    // Trial performance nudges starting attributes within a small band (potential untouched).
    // Strong trials (+) lift attrs slightly; poor trials (-) start lower. Never exceeds potential.
    const band = (performance - 0.5) * 1.2 // -0.6 .. +0.6 per attribute
    const values = { ...(player.attributes.values as Record<string, number>) }
    for (const k of Object.keys(values)) {
      values[k] = clamp(Math.round((values[k] + band) * 10) / 10, 1, player.potential - 1)
    }
    const baseWorld = youthWorld ?? createYouthWorld(player.id, player.schoolId, 1, player.youthRoute==='grassroots'?'grassroots':'school', player.nationality??'eng')
    const youthTrial = applyTrialOutcome(baseWorld, performance, 3)
    const updatedPlayer: Player = {
      ...player,
      attributes: { ...player.attributes, values } as Player['attributes'],
      // V4 pathway engine is authoritative; legacy role mirrors it so the
      // existing V3.2 match/selection screens remain compatible during migration.
      squadRole: youthTrial.legacySquadRole ?? role,
      squadRoleSetWeek: player.totalWeeksElapsed ?? 0,
      trialWeekCompleted: 3,
      careerClock: { ...player.careerClock, phase: player.youthRoute === 'school' ? 'school-season' : 'grassroots-season' },
    }
    setState({ player: updatedPlayer, youthWorld: youthTrial.world })
    void getState().saveCurrent()
  },

  applyMatchResult: (rating, goals, assists, finalMatchStamina, injury, opponentId, playerGoalsScored, opponentGoalsScored, playerWasHome, squad, opponentName, competitionId, shootoutWonByPlayer, redCarded, matchStats, playerWonMotm = false) => {
    const { player, calendar, league, academyLeague, cups, international, youthWorld, youthV5 } = getState()
    if (!player || !calendar) return
    // P24 rebalance: was tuned for a 9-match season; the flat 2/-1 values
    // saturated confidence at the +10 cap within a single season once match
    // volume roughly tripled (P17-21). Re-derived via threshold search against
    // decayConfidence's locked proportional-with-floor decay (see coachTrust.ts)
    // — 1.1 is just above the floor-decay's escape threshold, producing a
    // stable ~5.4 plateau for a genuinely good season instead of pinning at cap.
    // P27 'Maverick' passive: confidence swings amplified in BOTH directions
    const swing = archetypeConfidenceSwingMultiplier(player.archetype)
    const confDelta = (rating >= 7 ? 1.1 : rating >= 6 ? 0.2 : -0.6) * swing
    const wasStarter = player.squadRole === 'starting-xi'
    const isInAcademy = player.careerClock.phase === 'academy'

    // Route the result to the RIGHT competition — league table only moves for
    // league matches; cup brackets and the international campaign own theirs;
    // friendlies touch nothing but the player.
    const isLeagueMatch = competitionId === 'sundayLeague'
    let updatedLeague = isLeagueMatch && !isInAcademy && league ? recordPlayerMatchResult(league, opponentId, playerGoalsScored, opponentGoalsScored, playerWasHome) : league
    let updatedAcademyLeague = isLeagueMatch && isInAcademy && academyLeague ? recordAcademyMatchResult(academyLeague, opponentId, playerGoalsScored, opponentGoalsScored, playerWasHome) : academyLeague

    // P60 — "round results" on the match summary screen needs the REST of
    // this week's fixtures simulated too, not just the player's own. That
    // used to only happen later, inside advanceToNextWeek — meaning the
    // summary screen would show an empty round results list every time,
    // since it renders well before the week actually advances. Sim the
    // rest of the current round right now, immediately after recording the
    // player's own result. includePlayerTeam stays false — that fixture is
    // already recorded above, batchSimDivisionRound correctly skips
    // anything already marked played.
    if (isLeagueMatch) {
      const roundInfo = activeCompetitionForWeek(calendar.currentWeek.weekNumber, player.careerClock.phase)
      if (roundInfo) {
        if (!isInAcademy && updatedLeague) {
          const division = updatedLeague.divisions[updatedLeague.playerDivision]
          const simmed = batchSimDivisionRound(division, roundInfo.round, updatedLeague.playerTeamId, false)
          updatedLeague = { ...updatedLeague, divisions: { ...updatedLeague.divisions, [updatedLeague.playerDivision]: simmed } }
        }
        if (isInAcademy && updatedAcademyLeague) {
          const division = updatedAcademyLeague.divisions[updatedAcademyLeague.playerDivision]
          const simmed = batchSimAcademyRound(division, roundInfo.round, updatedAcademyLeague.playerTeamId, false)
          updatedAcademyLeague = { ...updatedAcademyLeague, divisions: { ...updatedAcademyLeague.divisions, [updatedAcademyLeague.playerDivision]: simmed } }
        }
      }
    }

    let updatedCups = cups
    if (competitionId in cups) {
      const key = competitionId as keyof CupWorlds
      const cupWorld = cups[key]
      if (cupWorld) {
        let next = recordCupPlayerResult(cupWorld, opponentId, playerGoalsScored, opponentGoalsScored, playerWasHome, shootoutWonByPlayer)
        next = advanceCupStage(next)
        updatedCups = { ...cups, [key]: next }
      }
    }
    let updatedInternational = international
    if (competitionId === 'international' && international) {
      updatedInternational = recordNationResult(international, opponentId, playerGoalsScored, opponentGoalsScored, playerWasHome, shootoutWonByPlayer)
      updatedInternational = advanceInternationalStage(updatedInternational)
    }

    // Coach Trust: aggregate from this match's performance relative to expectations (spec)
    // P27 'Captain' passive scales the GAIN only (never deepens a loss).
    const rawTrust = trustFromMatchRating({ value: player.coachTrust ?? 0 }, rating, wasStarter)
    const trustGain = rawTrust.value - (player.coachTrust ?? 0)
    const trustState = { value: (player.coachTrust ?? 0) + (trustGain > 0 ? trustGain * archetypeTrustGainMultiplier(player.archetype) : trustGain) }

    // Scouting: reconstruct engine state from persisted flat fields, update, flatten back
    const scoutingIn: ScoutingState = {
      reputation: player.reputation ?? 5,
      watchers: (player.scoutWatchers ?? []).map((w) => ({
        club: { id: w.clubId, name: w.clubName, short: w.clubShort, ratings: w.ratings, prestige: w.prestige, primaryColor: '#888', secondaryColor: '#fff', notablePlayers: [] },
        interest: w.interest, tier: w.tier as 'local' | 'regional' | 'national',
      })),
      // 'club' transfer approaches are a P27 store-level concept the scouting
      // engine doesn't know about — hold them aside and merge back after.
      offers: (player.contractOffers ?? []).filter((o) => o.kind !== 'club').map((o) => ({
        id: o.id, weekOffered: o.weekOffered, expiresInWeeks: o.expiresInWeeks, kind: o.kind as 'academy' | 'professional',
        club: { id: o.clubId, name: o.clubName, short: o.clubShort, ratings: o.ratings, prestige: o.prestige, primaryColor: '#888', secondaryColor: '#fff', notablePlayers: [] },
      })),
    }
    let scoutingOut = updateReputation(scoutingIn, {
      rating, position: player.position, goals, assists,
      tackles: matchStats?.tackle ?? 0, interceptions: matchStats?.interception ?? 0,
      headers: matchStats?.header ?? 0, keyPasses: matchStats?.keyPass ?? 0, saves: matchStats?.save ?? 0,
      cleanSheet: opponentGoalsScored === 0,
    })
    scoutingOut = updateWatcherInterest(scoutingOut, rating)
    scoutingOut = maybeAddWatcher(scoutingOut)
    scoutingOut = checkForOffers(scoutingOut, player.totalWeeksElapsed ?? 0, isInAcademy, player.careerClock.ageYears)

    // weekly stamina reflects how the match actually went, not a flat cost —
    // a player subbed early or barely used ends up less drained (Section 5)
    const updatedPlayer: Player = {
      ...player,
      squad: squad ?? player.squad,
      lastMatchResult: opponentName
        ? { opponentName, playerScore: playerGoalsScored, opponentScore: opponentGoalsScored, playerGoals: goals, playerAssists: assists, playerRating: rating }
        : player.lastMatchResult,
      matchRatings: [...(player.matchRatings ?? []), rating].slice(-10),
      seasonGoals: (player.seasonGoals ?? 0) + goals,
      seasonAssists: (player.seasonAssists ?? 0) + assists,
      // Phase 16: career totals, which the rolling season/window fields can't provide.
      career: {
        goals: (player.career?.goals ?? 0) + goals,
        assists: (player.career?.assists ?? 0) + assists,
        appearances: (player.career?.appearances ?? 0) + 1,
        wins: (player.career?.wins ?? 0) + (playerGoalsScored > opponentGoalsScored ? 1 : 0),
        // Audit fixes: clean sheets are a KEEPER's stat, not something a striker
        // banks whenever the defence holds; MOTM needs an actual decisive
        // display (top-end rating plus a direct contribution), not a bare
        // rating threshold.
        cleanSheets: (player.career?.cleanSheets ?? 0) + (player.position === 'GK' && opponentGoalsScored === 0 ? 1 : 0),
        bestRating: Math.max(player.career?.bestRating ?? 0, rating),
        motmAwards: (player.career?.motmAwards ?? 0) + (playerWonMotm ? 1 : 0),
        // P52 — the real stats a scout actually watches, not just goals/assists.
        tacklesWon: (player.career?.tacklesWon ?? 0) + (matchStats?.tackle ?? 0),
        interceptions: (player.career?.interceptions ?? 0) + (matchStats?.interception ?? 0),
        headersWon: (player.career?.headersWon ?? 0) + (matchStats?.header ?? 0),
        keyPasses: (player.career?.keyPasses ?? 0) + (matchStats?.keyPass ?? 0),
        saves: (player.career?.saves ?? 0) + (matchStats?.save ?? 0),
      },
      // P63 — per-competition breakdown: "how many of my goals came in the
      // league vs a cup run vs for my country." All cup competitions
      // (school/Sunday/academy cups) share one "cup" bucket — the real
      // competitionIds don't cleanly support a finer split.
      careerByCompetition: (() => {
        const prev = player.careerByCompetition ?? {
          league: { goals: 0, assists: 0, appearances: 0 },
          cup: { goals: 0, assists: 0, appearances: 0 },
          international: { goals: 0, assists: 0, appearances: 0 },
          other: { goals: 0, assists: 0, appearances: 0 },
        }
        const bucket: keyof typeof prev =
          competitionId === 'international' ? 'international'
          : competitionId === 'sundayLeague' ? 'league'
          : competitionId === 'schoolCup' || competitionId === 'sundayCup' || competitionId === 'academyLeagueCup' || competitionId === 'academyKnockoutCup' ? 'cup'
          : 'other'
        return {
          ...prev,
          [bucket]: {
            goals: prev[bucket].goals + goals,
            assists: prev[bucket].assists + assists,
            appearances: prev[bucket].appearances + 1,
          },
        }
      })(),
      confidence: { ...player.confidence, value: clamp(player.confidence.value + confDelta, -10, 10) },
      fitness: { stamina: Math.round(clamp(Math.min(finalMatchStamina, player.fitness.stamina), 0, 100)) },
      injury: injury ? { severity: injury.severity, weeksRemaining: injury.weeksOut, description: injury.description } : player.injury,
      recentInjuryCount: injury && injury.severity !== 'knock' ? (player.recentInjuryCount ?? 0) + 1 : player.recentInjuryCount ?? 0,
      // Audit fix: a knock (weeksOut 0) is not a layoff — it must not re-apply
      // the post-injury sharpness ramp. Only real time out resets the counter.
      matchesSinceReturn: injury && injury.weeksOut > 0 ? 0 : (player.matchesSinceReturn ?? 0) + 1,
      // P40 — a red card costs you your next match, the same real consequence
      // it carries in an actual league. One match, not tied to weeks, since a
      // suspension is measured in games missed, not calendar time.
      suspensionMatches: redCarded ? 1 : (player.suspensionMatches ?? 0),
      seasonAppearances: (player.seasonAppearances ?? 0) + 1,
      seasonRatings: [...(player.seasonRatings ?? []), rating],
      // P32: the dressing room and the terraces react to every match.
      standing: applyStandingDeltas(player.standing, standingFromMatch({
        rating, goals, assists,
        won: playerGoalsScored > opponentGoalsScored,
        drew: playerGoalsScored === opponentGoalsScored,
        played: true,
        isHomeCrowd: playerWasHome,
      })),
      coachTrust: trustState.value,
      reputation: scoutingOut.reputation,
      scoutWatchers: scoutingOut.watchers.map((w) => ({ clubId: w.club.id, clubName: w.club.name, clubShort: w.club.short, interest: w.interest, tier: w.tier, prestige: w.club.prestige, ratings: w.club.ratings })),
      contractOffers: [
        ...scoutingOut.offers.map((o) => ({ id: o.id, clubId: o.club.id, clubName: o.club.name, clubShort: o.club.short, weekOffered: o.weekOffered, expiresInWeeks: o.expiresInWeeks, prestige: o.club.prestige, ratings: o.club.ratings, kind: o.kind as 'academy' | 'professional' | 'club' })),
        ...(player.contractOffers ?? []).filter((o) => o.kind === 'club'),
      ],
    }
    const event = nextUnresolvedEvent(calendar)
    const updatedCalendar = event ? markResolved(calendar, event.id) : calendar
    // V5 integration: the same match that updates the player must update the
    // Competition Centre stat book and the persistent world Gazette.
    let updatedYouthWorld=youthWorld
    if(updatedYouthWorld){
      const bookId=competitionId
      const oldBook=updatedYouthWorld.competitionWorld.statBooks?.[bookId]??{competitionId:bookId,players:{}}
      const old=oldBook.players[player.id]??{playerId:player.id,name:player.name,teamId:updatedYouthWorld.pathway.route==='school'?(player.schoolId??'school'):(player.grassrootsClubId??'grassroots'),position:player.position,apps:0,goals:0,assists:0,cleanSheets:0,ratingTotal:0}
      const nextBook={...oldBook,players:{...oldBook.players,[player.id]:{...old,apps:old.apps+1,goals:old.goals+goals,assists:old.assists+assists,cleanSheets:old.cleanSheets+(player.position==='GK'&&opponentGoalsScored===0?1:0),ratingTotal:old.ratingTotal+rating}}}
      updatedYouthWorld={...updatedYouthWorld,competitionWorld:{...updatedYouthWorld.competitionWorld,statBooks:{...updatedYouthWorld.competitionWorld.statBooks,[bookId]:nextBook}}}
    }
    const week=player.totalWeeksElapsed??0
    const gazette=resultStory(week,competitionId,playerWasHome?(updatedYouthWorld?.pathway.route==='school'?'School XI':'Your Club'):(opponentName??'Opposition'),playerWasHome?(opponentName??'Opposition'):(updatedYouthWorld?.pathway.route==='school'?'School XI':'Your Club'),playerWasHome?playerGoalsScored:opponentGoalsScored,playerWasHome?opponentGoalsScored:playerGoalsScored)
    const updatedYouthV5={...youthV5,gazetteStories:[...youthV5.gazetteStories,gazette].slice(-120)}
    // P35 — post-match headlines, checked off the exact scouting before/after
    // this function already computes, so no extra state reads are needed.
    const matchHeadlines = checkPostMatchHeadlines({
      player: updatedPlayer, rating, goals, assists, won: playerGoalsScored > opponentGoalsScored,
      opponentName: opponentName ?? 'their opponents', weekNumber: player.totalWeeksElapsed ?? 0,
      scoutingBefore: scoutingIn, scoutingAfter: scoutingOut,
    })
    setState({
      player: updatedPlayer, calendar: updatedCalendar, league: updatedLeague, academyLeague: updatedAcademyLeague,
      cups: updatedCups, international: updatedInternational, youthWorld:updatedYouthWorld, youthV5:updatedYouthV5,
      pendingHeadlines: [...getState().pendingHeadlines, ...matchHeadlines],
    })
    void getState().saveCurrent()
  },

  respondToOffer: (offerId, accept) => {
    const { player, calendar } = getState()
    if (!player || !calendar) return
    const offer = (player.contractOffers ?? []).find((o) => o.id === offerId)
    if (!offer) return
    const remainingOffers = (player.contractOffers ?? []).filter((o) => o.id !== offerId)

    if (!accept) {
      setState({ player: { ...player, contractOffers: remainingOffers } })
      void getState().saveCurrent()
      return
    }

    if (offer.kind === 'club') {
      // P27 club transfer: move to the approaching club — a real team already
      // in the league world. New teammates, new coach (trust resets to
      // neutral, role back to bench: earn your shirt), your standings history
      // stays with your old club exactly like real football.
      const { league } = getState()
      if (!league || !offer.divisionTier) return
      const division = league.divisions[offer.divisionTier as 1 | 2 | 3]
      const target = division.teams.find((t) => t.id === offer.clubId)
      if (!target) {
        setState({ player: { ...player, contractOffers: remainingOffers } })
        void getState().saveCurrent()
        return
      }
      const movedLeague: LeagueWorld = { ...league, playerDivision: offer.divisionTier as 1 | 2 | 3, playerTeamId: target.id }
      const movedPlayer: Player = {
        ...player,
        contractOffers: remainingOffers.filter((o) => o.kind !== 'club'),
        squad: generateSquad(target.prestige),
        squadRole: 'bench',
        squadRoleSetWeek: player.totalWeeksElapsed ?? 0,
        coachTrust: 0,
        reputation: clamp((player.reputation ?? 0) + 3, 0, 100),
      }
      setState({ player: movedPlayer, league: movedLeague })
      getState().runAchievementCheck()
      void getState().saveCurrent()
      return
    }

    if (offer.kind === 'professional') {
      // P33: this used to sign instantly. The career's biggest moment now runs
      // through the same negotiation as everything else — and at professional
      // money, so the jump from a scholarship is felt.
      setState({
        player: { ...player, negotiation: startNegotiation(player, offer.clubId, offer.clubName, offer.prestige, 'professional') },
        negotiationBeat: `${offer.clubName} want to make you a professional.`,
      })
      void getState().saveCurrent()
      return
    }

    // P30: academy moves now run through the negotiation pipeline, so this
    // path just delegates. The transition itself lives in completeAcademyMove
    // so signing day can trigger it directly.
    getState().completeAcademyMove(offer.clubName, offer.prestige)
  },

  completeAcademyMove: (clubName, prestige) => {
    const { player } = getState()
    if (!player) return
    // Academy offer accepted: Grassroots → Academy transition. Reset scouting state
    // (a fresh academy career starts its own reputation/watchers) and initialize the
    // academy league world, discarding the Grassroots one.
    const updatedPlayer: Player = {
      ...player,
      academyClubName: clubName,
      squadRole: 'bench', // a new academy signing starts as unproven, not an automatic starter (was carrying over stale Grassroots trial status)
      squadRoleSetWeek: player.totalWeeksElapsed ?? 0,
      contractOffers: [],
      scoutWatchers: [],
      reputation: 15, // academy signings start with modest built-in reputation, not zero
      careerClock: { ...player.careerClock, phase: 'academy', grassrootsSeason: null },
    }
    // Clamp to the Professional Development League's actual prestige range (5-7) — the
    // originating scout's own prestige (which can be as low as 1 for a local watcher)
    // must not become the academy team's strength, or the player could be dropped into
    // a division of prestige-5-7 teams with an unplayably weak prestige-1 team of their own.
    const academyWorld = initAcademyWorld(clubName, Math.max(5, Math.min(7, prestige)))
    const academyTeam = academyWorld.divisions[academyWorld.playerDivision].teams.find((t) => t.id === academyWorld.playerTeamId)!
    const allAcademyTeams = Object.values(academyWorld.divisions).flatMap((d) => d.teams)
    // Grassroots cups end with the grassroots career; academy cups spin up in
    // their place (same depth, per the locked product strategy).
    const academyCups: CupWorlds = {
      schoolCup: null,
      sundayCup: null,
      academyLeagueCup: initCupById('academyLeagueCup', academyTeam, allAcademyTeams),
      academyKnockoutCup: initCupById('academyKnockoutCup', academyTeam, allAcademyTeams),
    }
    setState({ player: updatedPlayer, league: null, academyLeague: academyWorld, cups: academyCups })
    // Signing is the biggest moment in the game so far — celebrate it now, not
    // a week later on the next calendar tick.
    getState().runAchievementCheck()
    void getState().saveCurrent()
  },
}))