import { create } from 'zustand'
import type { Player } from '../types/player'
import { spendXp, positionCostMultiplier } from '../engine/xp'
import type { CalendarState } from '../types/calendar'
import type { DecisionResult } from '../types/decision'
import { readSave, writeSave, EMPTY_CUPS, SAVE_SCHEMA_VERSION, type SaveSlotId, type CupWorlds } from '../engine/save'
import { nextUnresolvedEvent, markResolved, advanceWeek, alignMatchDays, alignOctoberDevelopment, activeCompetitionForWeek, internationalRoundForWeek, SEASON_WEEKS } from '../engine/calendar'
import { initCupById, batchSimCupStage, advanceCupStage, recordCupPlayerResult, playerCupFixture, syncCupTeamIdentities } from '../engine/cup'
import { initInternationalWorld, formQualifiesForSelection, batchSimQualifyingRound, batchSimFinalsRound, advanceInternationalStage, recordNationResult, internationalTeamById, nationFixture, type InternationalWorld } from '../engine/international'
import { getSchool } from '../engine/schools'
import { getNation } from '../engine/nations'
import { regionalClubNames } from '../engine/regions'
import { nationalRegionalField } from '../engine/regionalRepresentatives'
import { academyOfferBatch, academyChampionsField } from '../engine/academyClubs'
import { archetypeConfidenceSwingMultiplier, archetypeTrustGainMultiplier } from '../engine/archetypes'
import { initialCast, driftRelationships, adjustBond, addPerson, relationshipEffects, resolveInteraction, interactedThisWeek, pruneCast, INTERACTIONS } from '../engine/relationships'
import { createSeasonObjectives, completedSeasonObjectives, seasonObjectivesBrief } from '../engine/seasonObjectives'
import type { ArcVerdict } from '../engine/storylines'
import { itemById, ageEquipment, monthlyAllowance, allowanceDue, rewardForStreak, shopFor, availableJobs, canWorkThisWeek, weeklyLivingCost, energyGainFromPct, type OwnedEquipment } from '../engine/economy'
import { netWage, commissionOn } from '../engine/agents'
import { hasSundayContract, migrateSundayContracts, openSundayContractWindow } from '../engine/sundayContracts'
import { generateTeam } from '../engine/teams'
import { ensureSundayClub, simulateSundayThrough, sundayClub } from '../engine/sundayFootball'
import { recordLeagueGoals } from '../engine/leagueScorers'
import { repairSundayInvitation, representativeEvidence, updateSundayRecruitment } from '../engine/youthOpportunities'
import { decideSelection, matchAvailability, playerForMatch } from '../engine/selection'
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
import { initLeagueWorld, initSchoolLeagueWorld, migrateToSchoolLeagueWorld, resetSchoolLeagueSeason, recordPlayerMatchResult, batchSimDivisionRound, applyPromotionRelegation, topScorerInDivision, sortStandings, type LeagueWorld } from '../engine/league'
import { generateSquad } from '../engine/squad'
import { growSquadForSeason, rollSquadDepartures } from '../engine/squadLifecycle'
import { generateGazetteIssue } from '../engine/gazette'
import { initAcademyWorld, recordAcademyMatchResult, batchSimAcademyRound, applyAcademyPromotion, type AcademyWorld } from '../engine/academy'
import { evaluateCaptaincy, recordCaptainAppearance, clearCaptaincyStory } from '../engine/captaincy'
import { addQualification, archiveCompetitionSeason, initCompetitionCareer, recordCompetitionMatch, recordSelectionResult, scoutingPrestigeMultiplier, serveCompetitionSuspension } from '../engine/competitionCareer'
import { defaultClubSupport, initYouthFinance, postTransaction, type FinanceCategory, type FinanceTransaction } from '../engine/youthFinances'
import { addStoryMoment, createStoryMoment, type StoryMoment } from '../engine/presentation'
import { academyEntryOpen, academyRecruitmentReport, academyTrialAvailable, academyTrialBase, academyOfferCleared, migrateAcademyRecruitment, reviewAcademyShowcase } from '../engine/academyRecruitment'
import { ageGroupFor, initYouthPathway, representativeSelection, selectionPassed } from '../engine/pathway'
import { initOctoberLeague, recordOctoberResult, simulateOctoberWeek, octoberStandings } from '../engine/octoberLeague'

// UI actions can save several snapshots in one tick. Keep their disk writes in
// action order so an older snapshot cannot finish after a newer one.
let saveQueue: Promise<void> = Promise.resolve()
function queueSave(save: Parameters<typeof writeSave>[0]): Promise<void> {
  saveQueue = saveQueue.catch(() => undefined).then(() => writeSave(save))
  return saveQueue
}

interface CareerStore {
  player: Player | null
  calendar: CalendarState | null
  league: LeagueWorld | null
  academyLeague: AcademyWorld | null
  cups: CupWorlds
  international: InternationalWorld | null
  activeSlot: SaveSlotId | null
  /** P53 — in-progress training session, checkpointed after every completed
      drill so a mobile reload mid-session resumes instead of silently
      restarting from scratch. null when no session is in progress. */
  pendingTraining: import('../engine/save').PendingTrainingSnapshot | null
  setPendingTraining: (snapshot: import('../engine/save').PendingTrainingSnapshot | null) => void

  loadFromSlot: (slot: SaveSlotId) => Promise<void>
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
  markStoryRead: (id: string) => void
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
  setYouthRoute: (route: 'school' | 'grassroots', club?: { id: string; name: string }) => void
  setSchool: (schoolId: string) => void
  completeTrials: (role: SquadRole, trialPerformance: number) => void
  /** competitionId routes the result: 'sundayLeague' updates the league table; cup ids update their bracket; 'international' the nation's campaign; 'schoolFriendlies' nothing. shootoutWonByPlayer is only set for drawn knockout ties. */
  applyMatchResult: (rating: number, goals: number, assists: number, finalMatchStamina: number, injury: { severity: string; weeksOut: number; description: string } | null, opponentId: string, playerGoalsScored: number, opponentGoalsScored: number, playerWasHome: boolean, squad: import('../engine/squad').SquadPlayer[] | undefined, opponentName: string | undefined, competitionId: string, shootoutWonByPlayer?: boolean, redCarded?: boolean, matchStats?: { tackle: number; interception: number; header: number; keyPass: number; save: number }, playerWonMotm?: boolean, participation?: { minutes: number; started: boolean }) => void
  respondToOffer: (offerId: string, accept: boolean) => void
  acceptSundayRegistration: () => void
  resolveAcademyTrial: (offerId:string, points:number) => void
  ensureLeagueWorld: () => void
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

/** Keep the legacy numeric balance and the V4 ledger in lockstep. */
function applyFinancialDelta(player: Player, amount: number, category: FinanceCategory, description: string, coveredBy: FinanceTransaction['coveredBy'] = 'player'): Player {
  if (!amount) return player
  const before = player.money ?? 0
  const after = Math.max(0, before + amount)
  const actualAmount = after - before
  return {
    ...player,
    money: after,
    finances: postTransaction(player.finances, player.careerClock.phase, {
      week: player.totalWeeksElapsed ?? 0,
      amount: actualAmount,
      category,
      description,
      coveredBy,
    }),
  }
}

function withStory(player: Player, calendar: CalendarState | null, input: Omit<StoryMoment, 'id' | 'read' | 'week' | 'season'>): Player {
  const moment = createStoryMoment({
    ...input,
    week: calendar?.currentWeek.weekNumber ?? player.totalWeeksElapsed ?? 0,
    season: calendar?.currentWeek.seasonYear ?? 1,
  })
  return { ...player, inbox: addStoryMoment(player.inbox, moment) }
}


function reviewAcademyOpportunities(player: Player, calendar: CalendarState): Player {
  if (player.careerClock.phase === 'academy') return player
  let updated = reviewAcademyShowcase(player, calendar)
  if (updated.pathway?.academyTrialStatus === 'passed' && updated.contractOffers.some(o =>
    o.kind === 'academy' && updated.pathway?.academyQualifiedOfferIds?.includes(o.id))) return updated
  const report = academyRecruitmentReport(updated, calendar)
  const state: ScoutingState = {
    reputation: updated.reputation,
    watchers: updated.scoutWatchers.map(w => ({
      club: { id: w.clubId, name: w.clubName, short: w.clubShort, countryId: w.countryId, ratings: w.ratings, prestige: w.prestige, primaryColor: '#888', secondaryColor: '#fff', notablePlayers: [] },
      interest: w.interest, tier: w.tier as 'local' | 'regional' | 'national',
      watchedMatches: w.watchedMatches, lastObservedWeek: w.lastObservedWeek, addedWeek: w.addedWeek,
    })),
    offers: [],
  }
  // Existing offers retain their original expiry; a club cannot issue another
  // invitation while its existing one is still on the table.
  state.watchers = state.watchers.filter(w => !updated.contractOffers.some(o => o.clubId === w.club.id))
  const result = checkForOffers(state, updated.totalWeeksElapsed ?? 0, false, updated.careerClock.ageYears, report)
  for (const offer of result.offers) {
    updated = { ...updated,
      scoutWatchers: updated.scoutWatchers.filter(w => w.clubId !== offer.club.id),
      contractOffers: [...updated.contractOffers, { id: offer.id, clubId: offer.club.id, clubName: offer.club.name, clubShort: offer.club.short, countryId: offer.club.countryId, ratings: offer.club.ratings, prestige: offer.club.prestige, kind: 'academy', weekOffered: offer.weekOffered, expiresInWeeks: offer.expiresInWeeks }],
      pathway: updated.pathway?.academyTrialStatus === 'passed' || updated.pathway?.academyTrialStatus === 'active' ? updated.pathway : { ...(updated.pathway ?? initYouthPathway(updated)), academyTrialStatus: 'invited', academyTrialClubId: offer.club.id, academyTrialSessions: 0, academyTrialPoints: 0, academyTrialBase: undefined, academyTrialLastWeek: undefined },
    }
    updated = withStory(updated, calendar, { kind: 'invitation', eyebrow: 'Academy invitation', title: `${offer.club.name.toUpperCase()} WANT YOU`,
      body: 'After reviewing your long-term record and repeated scouting visits, the academy has invited you to a trial.',
      detail: `${report.appearances} matches reviewed · ${report.average.toFixed(2)} average rating. Pass the trial before scholarship negotiations can begin.` })
  }
  return updated
}

// Backfill fields missing from older saves so schema drift never produces NaN/undefined.
function migratePlayer(player: Player): Player {
  return {
    ...player,
    grassrootsPath: player.grassrootsPath ?? (player.squadRole === 'released' ? 'sunday' : 'school'),
    pathway: player.pathway ?? initYouthPathway(player),
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
    contractOffers: (player.contractOffers ?? []).filter((o) => o && typeof o.clubId === 'string' && o.ratings && (o.kind === 'academy' || o.kind === 'professional' || o.kind === 'club')),
    turnedPro: player.turnedPro ?? null,
    academyClubName: player.academyClubName ?? null,
    totalWeeksElapsed: player.totalWeeksElapsed ?? 0,
    nationality: player.nationality ?? 'eng',
    avatarId: player.avatarId ?? 0,
    archetype: player.archetype ?? null,
    // Phase 28 — saves predating the life layer get a cast on load, so an
    // in-flight career gains relationships instead of showing an empty list.
    relationships: player.relationships ?? initialCast(),
    // Retire the old timed challenges on load. A saved goalkeeper must never
    // be benched later for a goals target that was already in flight.
    activeArcs: [],
    recentArcKeys: [],
    // P29 — careers saved before the economy existed start it now, with the
    // same two free drinks a new career gets rather than nothing.
    money: player.money ?? 25,
    finances: {
      ...initYouthFinance(player.careerClock.phase),
      ...(player.finances ?? {}),
      currency: 'GBP',
      transactions: player.finances?.transactions ?? [],
      sponsorships: player.finances?.sponsorships ?? [],
    },
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
    competitionCareer: {
      ...initCompetitionCareer(),
      ...(player.competitionCareer ?? {}),
      selections: player.competitionCareer?.selections ?? [],
    },
    inbox: player.inbox ?? [],
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
  activeSlot: null,
  pendingTraining: null,

  loadFromSlot: async (slot) => {
    await saveQueue
    const save = await readSave(slot)
    if (!save) return
    let player = ensureSundayClub(repairSundayInvitation(migrateAcademyRecruitment(migratePlayer(save.player), save.calendar)), save.calendar.currentWeek.weekNumber)
    if (player.squadRoleSetAppearances === undefined) player = { ...player, squadRoleSetAppearances: player.career?.appearances ?? 0 }
    const loadedCalendar = alignOctoberDevelopment(alignMatchDays(save.calendar, player.careerClock.phase, player.grassrootsPath ?? 'school', player.pathway?.sundayStatus === 'registered'), player.careerClock.ageYears, player.careerClock.phase, player.grassrootsPath ?? 'school', player.pathway?.showcaseInvited === true)
    let league = save.league ?? null
    player = migrateSundayContracts(player, player.grassrootsPath === 'school' ? player.sundayLeague : league, save.calendar.currentWeek.seasonYear)
    if (player.pathway?.sundayStatus === 'squad-offer' && player.sundayLeague && !player.sundayContract) player = openSundayContractWindow(player, player.sundayLeague, save.calendar.currentWeek.seasonYear, true)
    let cups = save.cups ?? { ...EMPTY_CUPS }
    if (league && player.careerClock.phase !== 'academy' && player.grassrootsPath === 'school') {
      const schoolName = (player.schoolId ? getSchool(player.schoolId)?.name : null) ?? 'Your School'
      league = migrateToSchoolLeagueWorld(league, schoolName, player.regionId)
      const teams = Object.values(league.divisions).flatMap((division) => division.teams)
      const playerTeam = teams.find((team) => team.id === league!.playerTeamId)
      cups = {
        ...cups,
        schoolCup: cups.schoolCup ? syncCupTeamIdentities(cups.schoolCup, teams) : playerTeam ? initCupById('schoolCup', playerTeam, teams) : null,
        sundayCup: null,
      }
    }
    if (league && player.careerClock.phase !== 'academy' && player.careerClock.ageYears <= 15 && !player.pathway?.showcaseInvited && loadedCalendar.currentWeek.weekNumber >= 36 && loadedCalendar.currentWeek.weekNumber <= 44 && player.octoberLeague?.season !== loadedCalendar.currentWeek.seasonYear) {
      const division = league.divisions[league.playerDivision]
      let october = initOctoberLeague(loadedCalendar.currentWeek.seasonYear, league.playerTeamId, division.teams)
      for (let week = 36; october && week < loadedCalendar.currentWeek.weekNumber && week <= 39; week++) october = simulateOctoberWeek(october, week)
      player = { ...player, octoberLeague: october }
    }
    if (player.careerClock.phase !== 'grassroots-trials' && !player.careerEnded && !player.turnedPro && player.seasonObjectives?.seasonYear !== loadedCalendar.currentWeek.seasonYear) {
      const objectives = createSeasonObjectives(player, loadedCalendar.currentWeek.seasonYear, loadedCalendar.currentWeek.weekNumber)
      player = withStory({ ...player, seasonObjectives: objectives }, loadedCalendar, {
        kind: 'milestone', eyebrow: 'Coach · season plan', title: 'YOUR FOUR SEASON GOALS',
        body: seasonObjectivesBrief(objectives), detail: 'The old short deadlines are gone. Missing one of these season goals never automatically benches you.',
      })
    }
    setState({ player, calendar: loadedCalendar, league, academyLeague: save.academyLeague ?? null, cups, international: save.international ?? null, activeSlot: slot, pendingTraining: save.pendingTraining ?? null, pendingArcVerdicts: [] })
    void getState().saveCurrent()
  },

  startNewCareer: async (player, calendar, slot) => {
    // Phase 28: every career opens with a cast — family, a friend, a coach, a rival.
    player = {
      ...player,
      grassrootsPath: player.grassrootsPath ?? 'school',
      sundayLeague: undefined, sundaySquad: undefined, leagueGoals: [], sundayContract: undefined, lastSundayOfferSeason: undefined, sundayContractsVersion: 1,
      pathway: player.pathway ?? initYouthPathway(player),
      relationships: player.relationships ?? initialCast(),
      activeArcs: [], recentArcKeys: [],
      // P29: you start with a bit of birthday money and, as Joel asked,
      // two free energy drinks in the bag.
      money: 25,
      finances: initYouthFinance(player.careerClock.phase),
      competitionCareer: initCompetitionCareer(),
      inbox: [],
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
    setState({ player, calendar, league: null, academyLeague: null, cups: { ...EMPTY_CUPS }, international: null, activeSlot: slot, pendingTraining: null })
    await queueSave({ schemaVersion: SAVE_SCHEMA_VERSION, slotId: slot, savedAt: new Date().toISOString(), player, calendar, league: null, academyLeague: null, cups: { ...EMPTY_CUPS }, international: null, pendingTraining: null })
  },

  saveCurrent: async () => {
    const { player, calendar, league, academyLeague, cups, international, activeSlot, pendingTraining } = getState()
    if (!player || !calendar || activeSlot === null) return
    await queueSave({ schemaVersion: SAVE_SCHEMA_VERSION, slotId: activeSlot, savedAt: new Date().toISOString(), player, calendar, league, academyLeague, cups, international, pendingTraining: pendingTraining ?? null })
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
    const { player, league, cups, calendar } = getState()
    if (!player || league || player.careerClock.phase === 'academy') return
    // Audit fix: 'Your School' placeholder shipped to players — use the actual
    // chosen school's name for the player's team.
    const school = player.schoolId ? getSchool(player.schoolId) : undefined
    const schoolName = school?.name ?? 'Your School'
    const isSchoolPath = player.grassrootsPath !== 'sunday'
    const localClub = player.regionId ? regionalClubNames(player.regionId)[4] : undefined
    const teamName = isSchoolPath ? schoolName : (player.communityTrialSessions !== undefined ? localClub ?? generateTeam(2).name : player.grassrootsClubName ?? localClub ?? generateTeam(2).name)
    const squad = player.squad ?? generateSquad(2)
    const world = isSchoolPath ? initSchoolLeagueWorld(teamName, player.regionId) : initLeagueWorld(teamName, player.regionId)
    const playerTeam = world.divisions[world.playerDivision].teams.find((t) => t.id === world.playerTeamId)!
    // P63 — real cross-division cup draws: every team across every
    // division in the league, not just fresh disconnected fake teams.
    const allLeagueTeams = Object.values(world.divisions).flatMap((d) => d.teams)
    // Grassroots cup worlds spin up alongside the league (P25: cups were
    // registered in the calendar but never instantiated anywhere).
    const newCups: CupWorlds = {
      ...cups,
      schoolCup: isSchoolPath ? (cups.schoolCup ?? initCupById('schoolCup', playerTeam, allLeagueTeams)) : null,
      nationalChampionship: cups.nationalChampionship ?? null,
      sundayCup: !isSchoolPath ? (cups.sundayCup ?? initCupById('sundayCup', playerTeam, allLeagueTeams)) : null,
    }
    const readyPlayer = !isSchoolPath && calendar && player.communityTrialSessions === undefined ? openSundayContractWindow({ ...player, squad }, world, calendar.currentWeek.seasonYear, true) : { ...player, squad }
    setState({ league: world, cups: newCups, player: readyPlayer })
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
    }
    updatedPlayer.captaincy = evaluateCaptaincy(updatedPlayer, recordedCaptaincy)
    if (effect.money) updatedPlayer = applyFinancialDelta(updatedPlayer, effect.money, 'other', effect.narrative || 'Life event')
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
    // Older life-event choices may still carry a startArc field. Short timed
    // challenges have been retired; the choice's immediate effect still applies.

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
  markStoryRead: (id) => {
    const player = getState().player
    if (!player) return
    setState({ player: { ...player, inbox: (player.inbox ?? []).map((item) => item.id === id ? { ...item, read: true } : item) } })
    void getState().saveCurrent()
  },

  // ---- P29 economy ----------------------------------------------------
  buyItem: (itemId) => {
    const { player } = getState()
    const item = itemById(itemId)
    if (!player || !item) return { ok: false, reason: 'not available' }
    if (!shopFor(player).some((i) => i.id === itemId)) return { ok: false, reason: 'not available yet' }
    if ((player.money ?? 0) < item.price) return { ok: false, reason: 'not enough money' }

    let next: Player = applyFinancialDelta(player, -item.price, item.kind === 'equipment' ? 'equipment' : 'recovery', `Bought ${item.name}`)
    if (item.kind === 'consumable') {
      next = { ...next, consumables: { ...(next.consumables ?? {}), [itemId]: ((next.consumables ?? {})[itemId] ?? 0) + 1 } }
    } else {
      // One item per slot: buying new boots replaces the old pair rather than
      // stacking, so kit bonuses can never be piled up indefinitely.
      const kept = (next.equipment ?? []).filter((o) => itemById(o.itemId)?.slot !== item.slot)
      const owned: OwnedEquipment = { itemId, weeksRemaining: item.durationWeeks ?? 8, condition: 100 }
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
    setState({ player: applyFinancialDelta(player, amount, 'reward', 'Rewarded video bonus') })
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
    let next: Player = { ...player, rewardStreak: streak, lastRewardWeek: week }
    if (reward.money) next = applyFinancialDelta(next, reward.money, 'reward', `Weekly check-in: ${reward.label}`)
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
    const paid = applyFinancialDelta(player, job.pay, 'job', job.label)
    setState({ player: { ...paid, lastJobWeek: player.totalWeeksElapsed ?? 0, fitness: { stamina: Math.round(clamp(player.fitness.stamina - job.energyCost, 0, 100)) } } })
    void getState().saveCurrent()
    return { ok: true, pay: job.pay }
  },

  // ---- P30 representation + contracts ---------------------------------
  clearNegotiationBeat: () => setState({ negotiationBeat: null }),
  serveSuspensionMatch: () => {
    const { player, calendar } = getState()
    if (!player || !calendar) return
    const event = nextUnresolvedEvent(calendar)
    const competitionId = event?.title === 'October development fixture' ? 'octoberDevelopment' : activeCompetitionForWeek(calendar.currentWeek.weekNumber, player.careerClock.phase, player.grassrootsPath, Boolean(getState().cups.schoolDevelopment))?.competitionId
      ?? (nextUnresolvedEvent(calendar)?.title === 'international duty' ? 'international' : 'other')
    setState({
      player: { ...player, suspensionMatches: Math.max(0, (player.suspensionMatches ?? 0) - 1), competitionCareer: serveCompetitionSuspension(player.competitionCareer, competitionId) },
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

    const sent = applyFinancialDelta(player, -amt, 'family-gift', 'Sent money home')
    setState({ player: { ...sent, relationships: adjustBond(player.relationships ?? [], parent.id, bondGain, `you sent money home`), confidence: { ...player.confidence, value: clamp(player.confidence.value + 0.4, -10, 10) } } })
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
    if (offer.kind === 'academy' && (!academyTrialAvailable(player, offerId, getState().calendar) || !academyOfferCleared(player, offerId))) return
    const negotiation = startNegotiation(player, offer.clubId, offer.clubName, offer.prestige, offer.kind)
    setState({ player: { ...player, negotiation }, negotiationBeat: negotiation.log[0] })
    void getState().saveCurrent()
  },

  makeNegotiationChoice: (choiceId) => {
    const { player } = getState()
    if (!player?.negotiation || !isLive(player.negotiation)) return
    if (player.negotiation.kind === 'academy' && (!academyEntryOpen(player, getState().calendar) || !player.contractOffers.some(o => o.clubId === player.negotiation?.clubId && academyOfferCleared(player, o.id)))) return
    const outcome = resolveChoice(player.negotiation, choiceId, player)
    const next: Player = { ...player, negotiation: outcome.negotiation }

    if (outcome.signed) {
      const { clubName, prestige, terms } = outcome.signed
      const week = player.totalWeeksElapsed ?? 0
      const dealKind = player.negotiation.kind ?? 'academy'
      // The signing-on fee lands immediately, minus the agent's cut.
      let signed: Player = {
        ...next,
        contract: { clubName, terms, signedWeek: week, expiresWeek: week + terms.years * SEASON_WEEKS },
        careerEarnings: (next.careerEarnings ?? 0) + terms.signingBonus,
        agentFeesPaid: (next.agentFeesPaid ?? 0) + commissionOn(terms.signingBonus, next.agentId),
      }
      signed = applyFinancialDelta(signed, netWage(terms.signingBonus, next.agentId), 'wage', `${clubName} signing bonus`)
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
    const { player, calendar, league, academyLeague, cups, international } = getState()
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
    if (!updatedInternational && player.pathway?.nationalSelection === 'selected' && representativeEvidence(player, 'national').eligible) {
      const nation = getNation(player.nationality)
      updatedInternational = initInternationalWorld(nation.name, nation.id)
    }
    const campaignActive = !!updatedInternational && updatedInternational.stage !== 'complete' && updatedInternational.stage !== 'not-qualified'
    const hasDuty = campaignActive && player.pathway?.nationalSelection === 'selected' && representativeEvidence(player, 'national').eligible && formQualifiesForSelection(player.matchRatings ?? [])
    const result = advanceWeek(calendar, player.careerClock.ageYears, phase, hasDuty, player.grassrootsPath, player.pathway?.sundayStatus === 'registered')
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
    let updatedSundayLeague = player.sundayLeague ? simulateSundayThrough(player.sundayLeague, completedWeekNumber) : undefined
    let updatedAcademyLeague = academyLeague
    let updatedCups: CupWorlds = { ...cups }
    const isInAcademy = phase === 'academy'
    // P25 fix (THE Phase 25 audit blocker): resolve this week's competition
    // phase-aware, and give EVERY registered competition its sim branch —
    // the previous code only ever handled 'sundayLeague' while the calendar
    // reserved matchdays for five other competitions that didn't exist at
    // runtime, producing 20 dead matchdays a season and zero cup football.
    const weekCompetition = activeCompetitionForWeek(completedWeekNumber, phase, player.grassrootsPath, Boolean(cups.schoolDevelopment))

    if (weekCompetition?.competitionId === 'sundayLeague' || weekCompetition?.competitionId === 'schoolLeague') {
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

    // The country plays its fixtures even when the player misses the squad.
    // Recent form controls match invitations, not the national campaign clock.
    if (updatedInternational) {
      const intlRound = internationalRoundForWeek(completedWeekNumber)
      if (intlRound) {
        if (updatedInternational.stage === 'qualifiers' && intlRound.stage === 'qualifiers') {
          const byId = new Map(updatedInternational.qualifyingGroup.teams.map((t) => [t.id, t]))
          // sim rounds through the window index (self-heals a mid-season call-up
          // whose earlier windows predate the campaign)
          for (let r = 1; r <= intlRound.round; r++) {
            updatedInternational = batchSimQualifyingRound(updatedInternational, r, byId)
          }
          // Catch up every missed national fixture, including earlier windows
          // when the player was not selected for the matchday squad.
          let pending = nationFixture(updatedInternational)
          while (pending && pending.round <= intlRound.round) {
            const home = byId.get(pending.homeTeamId)!, away = byId.get(pending.awayTeamId)!
            const hg = Math.max(0, Math.round((home.ratings.attack - away.ratings.defense) / 30 + 1))
            const ag = Math.max(0, Math.round((away.ratings.attack - home.ratings.defense) / 30 + 1))
            updatedInternational = recordNationResult(updatedInternational, pending.homeTeamId === updatedInternational.nationTeamId ? pending.awayTeamId : pending.homeTeamId, pending.homeTeamId === updatedInternational.nationTeamId ? hg : ag, pending.homeTeamId === updatedInternational.nationTeamId ? ag : hg, pending.homeTeamId === updatedInternational.nationTeamId)
            pending = nationFixture(updatedInternational)
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

    // Sunday clubs issue one contract batch at the season boundary, never weekly approaches.
    const clubApproachOffers = survivingOffers

    // P33: build the review BEFORE promotion/relegation and the stat reset, so
    // it reports the season that was actually played.
    let seasonReview: import('../engine/seasonReview').SeasonReview | null = null
    let personalAwardsWon: import('../engine/glory').PersonalGloryKey[] = []
    let clubAwardsWon: import('../engine/glory').ClubGloryKey[] = []
    let nationalAwardWon = false
    const seasonCompetitionOutcomes: Record<string, string> = {}
    if (result.seasonEnded) {
      const finishingDivision = isInAcademy
        ? updatedAcademyLeague?.divisions[updatedAcademyLeague.playerDivision]
        : updatedLeague?.divisions[updatedLeague.playerDivision]
      const finishingTeamId = isInAcademy ? updatedAcademyLeague?.playerTeamId : updatedLeague?.playerTeamId
      if (finishingDivision && finishingTeamId) {
        const position = sortStandings(finishingDivision.standings).findIndex((s) => s.teamId === finishingTeamId) + 1
        if (position > 0) seasonCompetitionOutcomes[isInAcademy ? 'academyLeague' : updatedLeague?.kind === 'sunday' ? 'sundayLeague' : 'schoolLeague'] = `Finished ${position}${position === 1 ? 'st' : position === 2 ? 'nd' : position === 3 ? 'rd' : 'th'}`
      }
      for (const cup of Object.values(updatedCups)) {
        if (!cup) continue
        seasonCompetitionOutcomes[cup.competitionId] = cup.playerWonCup ? 'Champion' : cup.playerEliminated ? 'Eliminated' : cup.stage === 'complete' ? 'Completed' : 'In progress'
      }
      if (updatedInternational) seasonCompetitionOutcomes.international = updatedInternational.wonTournament ? 'Champion' : updatedInternational.stage === 'not-qualified' ? 'Did not qualify' : updatedInternational.stage === 'complete' ? 'Eliminated' : 'In progress'

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
      if (updatedSundayLeague) updatedSundayLeague = applyPromotionRelegation(updatedSundayLeague)
      if (!isInAcademy && updatedLeague?.kind === 'sunday') updatedLeague = applyPromotionRelegation(updatedLeague)
      if (!isInAcademy && updatedLeague?.kind === 'school') updatedLeague = resetSchoolLeagueSeason(updatedLeague)
      if (isInAcademy && updatedAcademyLeague) updatedAcademyLeague = applyAcademyPromotion(updatedAcademyLeague)
      // Fresh cup draws every season; a finished international campaign resets
      // too (eligibility is re-checked, so a star keeps getting called up).
      const grassrootsTeam = updatedLeague ? updatedLeague.divisions[updatedLeague.playerDivision].teams.find((t) => t.id === updatedLeague!.playerTeamId) : null
      const academyTeam = updatedAcademyLeague ? updatedAcademyLeague.divisions[updatedAcademyLeague.playerDivision].teams.find((t) => t.id === updatedAcademyLeague!.playerTeamId) : null
      const allLeagueTeams = updatedLeague ? Object.values(updatedLeague.divisions).flatMap((d) => d.teams) : []
      const allAcademyTeams = updatedAcademyLeague ? Object.values(updatedAcademyLeague.divisions).flatMap((d) => d.teams) : []
      updatedCups = {
        schoolCup: !isInAcademy && updatedLeague?.kind === 'school' && grassrootsTeam ? initCupById('schoolCup', grassrootsTeam, allLeagueTeams) : null,
        schoolDevelopment: null,
        nationalChampionship: null,
        sundayCup: !isInAcademy && updatedLeague?.kind === 'sunday' && grassrootsTeam ? initCupById('sundayCup', grassrootsTeam, allLeagueTeams) : null,
        academyLeagueCup: isInAcademy && academyTeam ? initCupById('academyLeagueCup', academyTeam, allAcademyTeams) : null,
        academyKnockoutCup: isInAcademy && academyTeam ? initCupById('academyKnockoutCup', academyTeam, allAcademyTeams) : null,
        academyChampionsCup: null,
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
            competitionLabel: isInAcademy ? 'the league' : updatedLeague?.kind === 'school' ? 'the Local School League' : 'the Sunday League',
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
      sundayLeague: updatedSundayLeague,
      sundaySquad: result.seasonEnded ? player.sundaySquad?.map(p => ({ ...p, seasonGoals: 0, seasonAssists: 0 })) : player.sundaySquad,
      leagueGoals: result.seasonEnded ? [] : player.leagueGoals,
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
      pathway: { ...(player.pathway ?? initYouthPathway(player)), ageGroup:ageGroupFor(result.newAge), ...(result.seasonEnded?{regionalSelection:'not-started' as const,nationalSelection:'not-started' as const,regionalScore:undefined,nationalScore:undefined,showcaseInvited:false,showcaseSeason:undefined}:{}) },
      competitionCareer: result.seasonEnded
        ? archiveCompetitionSeason(player.competitionCareer, calendar.currentWeek.seasonYear, seasonCompetitionOutcomes)
        : player.competitionCareer,
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
    if ((player.communityTrialSessions !== undefined || player.grassrootsPath === 'sunday')
      && (player.contractOffers ?? []).some(o => o.kind === 'club')
      && !hasSundayContract(player, calendar.currentWeek.seasonYear, league)
      && !survivingOffers.some(o => o.kind === 'club')) {
      updatedPlayer = { ...updatedPlayer, communityTrialSessions: 0, lastSundayOfferSeason: undefined,
        pathway: { ...(player.pathway ?? initYouthPathway(player)), sundayStatus: 'training-invite' } }
    }
    if (updatedPlayer.octoberLeague?.season === calendar.currentWeek.seasonYear && completedWeekNumber >= 36 && completedWeekNumber <= 39) {
      updatedPlayer = { ...updatedPlayer, octoberLeague: simulateOctoberWeek(updatedPlayer.octoberLeague, completedWeekNumber) }
    }
    if (isInAcademy && completedWeekNumber === 23 && updatedAcademyLeague) {
      const division = updatedAcademyLeague.divisions[updatedAcademyLeague.playerDivision]
      const position = sortStandings(division.standings).findIndex(row => row.teamId === updatedAcademyLeague!.playerTeamId) + 1
      const qualified = updatedAcademyLeague.playerDivision === 1 && position > 0 && position <= 4
      const team = division.teams.find(candidate => candidate.id === updatedAcademyLeague!.playerTeamId)
      if (qualified && team) {
        const field = academyChampionsField(team, updatedPlayer.academyCountryId ?? getNation(updatedPlayer.nationality).id)
        updatedCups = { ...updatedCups, academyChampionsCup: initCupById('academyChampionsCup', field[0], field) }
        updatedPlayer = { ...updatedPlayer, competitionCareer: addQualification(updatedPlayer.competitionCareer, {
          competitionId: 'academyLeague', qualifiedFor: 'academyChampionsCup', season: calendar.currentWeek.seasonYear,
          reason: 'league-position', position,
        }) }
        updatedPlayer = withStory(updatedPlayer, result.calendar, { kind: 'qualification', eyebrow: 'Academy league · continental places',
          title: 'CHAMPIONS CUP QUALIFIED', body: 'A top-four academy finish sends your club into the eight-team continental cup.',
          detail: 'Three knockout rounds against academies from seven other countries begin in week 25.', ceremony: 'draw' })
      }
    }
    if (!isInAcademy && updatedLeague?.kind === 'school' && !result.seasonEnded) {
      const pathway=updatedPlayer.pathway??initYouthPathway(updatedPlayer)
      const nationalCup = updatedCups.nationalChampionship
      const final = nationalCup?.stage === 'complete' && nationalCup.groups.length === 0
        ? nationalCup.knockoutRounds.at(-1)?.[0] : undefined
      if (final?.played && (final.homeTeamId === nationalCup?.playerTeamId || final.awayTeamId === nationalCup?.playerTeamId)) {
        updatedPlayer = { ...updatedPlayer, competitionCareer: addQualification(updatedPlayer.competitionCareer, {
          competitionId: 'nationalChampionship', qualifiedFor: 'international', season: calendar.currentWeek.seasonYear,
          reason: 'cup-result', position: nationalCup?.playerWonCup ? 1 : 2,
        }) }
      }
      const regionalCup = updatedCups.schoolCup
      const regionalFinal = regionalCup?.stage === 'complete' && regionalCup.groups.length === 0
        ? regionalCup.knockoutRounds.at(-1)?.[0] : undefined
      if (regionalFinal?.played && (regionalFinal.homeTeamId === regionalCup?.playerTeamId || regionalFinal.awayTeamId === regionalCup?.playerTeamId)) {
        updatedPlayer = { ...updatedPlayer, competitionCareer: addQualification(updatedPlayer.competitionCareer, {
          competitionId: 'schoolCup', qualifiedFor: 'nationalChampionship', season: calendar.currentWeek.seasonYear,
          reason: 'cup-result', position: regionalCup?.playerWonCup ? 1 : 2,
        }) }
      }
      if(completedWeekNumber===23){const d=updatedLeague.divisions[updatedLeague.playerDivision];const position=sortStandings(d.standings).findIndex(s=>s.teamId===updatedLeague!.playerTeamId)+1;const qualified=position>0&&position<=3;const playerTeam=d.teams.find(t=>t.id===updatedLeague!.playerTeamId);if(qualified){updatedCups={...updatedCups,schoolDevelopment:null};updatedPlayer={...updatedPlayer,competitionCareer:addQualification(updatedPlayer.competitionCareer,{competitionId:'schoolLeague',qualifiedFor:'schoolCup',season:calendar.currentWeek.seasonYear,reason:'league-position',position})}}else if(playerTeam){updatedCups={...updatedCups,schoolCup:updatedCups.schoolCup?{...updatedCups.schoolCup,playerEliminated:true}:null,schoolDevelopment:initCupById('schoolDevelopment',playerTeam,d.teams)}}updatedPlayer=withStory(updatedPlayer,result.calendar,{kind:qualified?'qualification':'selection',eyebrow:'Local School League · final table',title:qualified?'REGIONAL CUP QUALIFIED':'DEVELOPMENT COMPETITION',body:qualified?`A ${position}${position===1?'st':position===2?'nd':'rd'}-place finish sends your school into the 16-team Regional Schools Cup.`:'Your school missed the top three, but your season continues in a six-school development group.',detail:qualified?'Four knockout rounds begin in week 24. Reach the final to secure a National Schools Championship place.':'Five guaranteed matches remain, and your individual performances still count toward Regional XI selection.',ceremony:qualified?'draw':'selection'})}
      else if(completedWeekNumber===28&&pathway.regionalSelection==='not-started'){const score=representativeSelection(updatedPlayer,'regional');const finalist=updatedPlayer.competitionCareer?.qualifications.some(q=>q.competitionId==='schoolCup'&&q.qualifiedFor==='nationalChampionship'&&q.season===calendar.currentWeek.seasonYear);const ok=score.eligible===true&&(score.total>=44||finalist);updatedPlayer={...updatedPlayer,pathway:{...pathway,regionalSelection:ok?'longlist':'cut',regionalScore:score}};updatedPlayer=withStory(updatedPlayer,result.calendar,{kind:ok?'selection':'elimination',eyebrow:'Regional XI · 60-player longlist',title:ok?'YOUR NAME IS ON THE LIST':'NOT ON THE LONGLIST',body:ok?'Your school performances earned a place at the regional selection camp.':'You missed this regional window, but your school and Sunday performances can reopen it next season.',detail:`${score.reason} Selection score ${score.total}/100 · positional rank ${score.positionalRank}.`,ceremony:'selection',metrics:[{label:'Performance',value:score.performance,suffix:'%'},{label:'Ability',value:score.ability,suffix:'%'},{label:'Coach trust',value:score.coachTrust,suffix:'%'},{label:'Total',value:score.total,suffix:'/100',tone:ok?'good':'bad'}]})}
      else if(completedWeekNumber===29&&pathway.regionalSelection==='longlist'){updatedPlayer={...updatedPlayer,pathway:{...pathway,regionalSelection:'camp'}};updatedPlayer=withStory(updatedPlayer,result.calendar,{kind:'selection',eyebrow:'Regional XI · selection camp',title:'FINAL SESSION',body:'Sixty players have become thirty-five. Every touch is being judged by position.',detail:'Form, ability, coach trust, fitness and mentality all count toward the final 23.',ceremony:'selection'})}
      else if(completedWeekNumber===30&&pathway.regionalSelection==='camp'&&pathway.regionalScore){const finalScore=representativeSelection(updatedPlayer,'regional');pathway.regionalScore=finalScore;const finalist=updatedPlayer.competitionCareer?.qualifications.some(q=>q.competitionId==='schoolCup'&&q.qualifiedFor==='nationalChampionship'&&q.season===calendar.currentWeek.seasonYear);const ok=finalist&&finalScore.eligible||selectionPassed(finalScore,'regional');updatedPlayer={...updatedPlayer,pathway:{...pathway,regionalSelection:ok?'selected':'cut'},competitionCareer:recordSelectionResult(updatedPlayer.competitionCareer,{competitionId:'regionalSelection',season:calendar.currentWeek.seasonYear,round:3,entrants:60,survivors:23,score:pathway.regionalScore.total,outcome:ok?'selected':'cut'})};const base=updatedLeague.divisions[updatedLeague.playerDivision].teams.find(t=>t.id===updatedLeague!.playerTeamId);if(ok&&base){const field=nationalRegionalField(base,updatedPlayer.regionId,calendar.currentWeek.seasonYear);updatedCups={...updatedCups,nationalChampionship:initCupById('nationalChampionship',field.playerTeam,field.opponents)}}updatedPlayer=withStory(updatedPlayer,result.calendar,{kind:ok?'selection':'elimination',eyebrow:'Regional XI · final 23',title:ok?'REGIONAL XI':'THE FINAL CUT',body:ok?'Your shirt is hanging in the regional dressing room. You will play at the National Schools Championship.':'Another player edged the final place in your position. The coaches have explained exactly where the gap was.',detail:`Final score ${pathway.regionalScore.total}/100 · positional rank ${pathway.regionalScore.positionalRank}.`,ceremony:ok?'callup':'selection',metrics:[{label:'Final score',value:pathway.regionalScore.total,suffix:'/100',tone:ok?'good':'bad'},{label:'Position rank',value:pathway.regionalScore.positionalRank},{label:'Squad places',value:23}]})}
      else if(completedWeekNumber===35&&pathway.regionalSelection==='selected'&&pathway.nationalSelection==='not-started'&&representativeEvidence(updatedPlayer,'national').eligible){const score=representativeSelection(updatedPlayer,'national');updatedPlayer={...updatedPlayer,pathway:{...pathway,nationalSelection:'longlist',nationalScore:score}};updatedPlayer=withStory(updatedPlayer,result.calendar,{kind:'selection',eyebrow:'National schools · shortlist',title:'NATIONAL CONSIDERATION',body:'The championship selectors have reduced the country to one final camp.',detail:`You enter camp ranked ${score.positionalRank} in your position with a score of ${score.total}/100.`,ceremony:'selection',metrics:[{label:'Championship form',value:score.performance,suffix:'%'},{label:'Selection score',value:score.total,suffix:'/100'}]})}
      else if(completedWeekNumber===35&&pathway.regionalSelection==='selected'&&pathway.nationalSelection==='not-started'){const evidence=representativeEvidence(updatedPlayer,'national');updatedPlayer={...updatedPlayer,pathway:{...pathway,nationalSelection:'cut'}};updatedPlayer=withStory(updatedPlayer,result.calendar,{kind:'selection',eyebrow:'National schools review',title:'MORE TO PROVE',body:'You have not yet built the championship record needed for national selection.',detail:evidence.reason,ceremony:'selection'})}
      else if(completedWeekNumber===36&&pathway.nationalSelection==='longlist'&&pathway.nationalScore){const finalScore=representativeSelection(updatedPlayer,'national');pathway.nationalScore=finalScore;const finalist=updatedPlayer.competitionCareer?.qualifications.some(q=>q.competitionId==='nationalChampionship'&&q.qualifiedFor==='international'&&q.season===calendar.currentWeek.seasonYear);const ok=finalist&&finalScore.eligible||selectionPassed(finalScore,'national')&&!updatedPlayer.regionId;updatedPlayer={...updatedPlayer,pathway:{...pathway,nationalSelection:ok?'selected':'cut'},competitionCareer:recordSelectionResult(updatedPlayer.competitionCareer,{competitionId:'nationalSelection',season:calendar.currentWeek.seasonYear,round:2,entrants:35,survivors:23,score:pathway.nationalScore.total,outcome:ok?'selected':'cut'})};updatedPlayer=withStory(updatedPlayer,result.calendar,{kind:ok?'selection':'elimination',eyebrow:'National schools · final squad',title:ok?'COUNTRY CALLED':'NOT THIS WINDOW',body:ok?'Your regional XI made the national final. You have earned the national shirt; international youth football is next.':'You were close, but the final national place went elsewhere. Your pathway stays open.',detail:`Final score ${pathway.nationalScore.total}/100 · positional rank ${pathway.nationalScore.positionalRank}.`,ceremony:ok?'callup':'selection',metrics:[{label:'Final score',value:pathway.nationalScore.total,suffix:'/100',tone:ok?'good':'bad'},{label:'Position rank',value:pathway.nationalScore.positionalRank}]})}
    }
    if (!isInAcademy && completedWeekNumber === 39 && player.careerClock.ageYears <= 15) {
      const october = updatedPlayer.competitionCareer?.current.octoberDevelopment
      const position = updatedPlayer.octoberLeague ? octoberStandings(updatedPlayer.octoberLeague).findIndex(row => row.teamId === updatedPlayer.octoberLeague!.playerTeamId) + 1 : 0
      updatedPlayer = withStory(updatedPlayer, result.calendar, {
        kind: 'selection', eyebrow: 'October Development Series', title: 'FOUR-MATCH WINDOW COMPLETE',
        body: 'The October fixtures are over. Your performances stay on your career record and count toward your development.',
        detail: `${position ? `Finished ${position} of 5 · ` : ''}${october?.appearances ?? 0} appearances · ${october?.goals ?? 0} goals · ${october?.assists ?? 0} assists. Missed matches are simulated; the next season brings another chance.`,
        metrics: [{ label: 'Place', value: position || 0 }, { label: 'Appearances', value: october?.appearances ?? 0 }, { label: 'Goals', value: october?.goals ?? 0 }],
      })
    }
    const newClubApproach = clubApproachOffers.find((offer) => offer.kind === 'club' && !(player.contractOffers ?? []).some((old) => old.id === offer.id))
    if (newClubApproach) {
      updatedPlayer = withStory(updatedPlayer, result.calendar, {
        kind: 'invitation', eyebrow: 'Club approach', title: `${newClubApproach.clubName.toUpperCase()} ARE WATCHING`,
        body: 'A grassroots club has offered you a new route through the youth game.',
        detail: 'The offer expires. Review the club, its division and what the move would mean for your place.',
      })
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
      updatedPlayer = applyFinancialDelta(updatedPlayer, amount, 'allowance', 'Family allowance', 'family')
      updatedPlayer = { ...updatedPlayer, lastAllowanceWeek: updatedPlayer.totalWeeksElapsed ?? 0 }
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
    if (!matchAvailability(updatedPlayer).canStart) lastSelectionNote = verdict.reason
    if (verdict.changed && weeksSinceSet >= SETTLE_WEEKS && matchAvailability(updatedPlayer).canStart && !(updatedPlayer.grassrootsPath === 'sunday' && updatedPlayer.pathway?.sundayStatus !== 'registered')) {
      updatedPlayer = { ...updatedPlayer, squadRole:verdict.role, squadRoleSetWeek:updatedPlayer.totalWeeksElapsed??0, squadRoleSetAppearances:updatedPlayer.career?.appearances??0, pathway:updatedPlayer.pathway?{...updatedPlayer.pathway,schoolSquad:verdict.role==='reserves'?'reserve':updatedPlayer.grassrootsPath==='sunday'?'released':'first'}:updatedPlayer.pathway }
      lastSelectionNote = verdict.reason
      updatedPlayer = withStory(updatedPlayer, result.calendar, {
        kind: 'squad', eyebrow: 'Squad announcement',
        title: verdict.role === 'starting-xi' ? 'YOU ARE IN THE STARTING XI' : verdict.role === 'bench' ? 'NAMED ON THE BENCH' : 'MOVED TO THE RESERVES',
        body: verdict.reason,
        detail: `Your role is now ${verdict.role === 'starting-xi' ? 'Starting XI' : verdict.role}.`,
      })
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
    if (updatedPlayer.contract && contractStatus(updatedPlayer).kind !== 'expired') {
      const gross = updatedPlayer.contract.terms.weeklyWage
      const fee = commissionOn(gross, updatedPlayer.agentId)
      // Digs, travel and food come straight back out — a scholarship is income
      // AND independence, not free money.
      const living = weeklyLivingCost(updatedPlayer)
      updatedPlayer = applyFinancialDelta(updatedPlayer, netWage(gross, updatedPlayer.agentId), 'wage', `${updatedPlayer.contract.clubName} weekly allowance`, 'academy')
      updatedPlayer = applyFinancialDelta(updatedPlayer, -living, 'living-cost', 'Digs, travel and food')
      updatedPlayer = { ...updatedPlayer, careerEarnings: (updatedPlayer.careerEarnings ?? 0) + gross, agentFeesPaid: (updatedPlayer.agentFeesPaid ?? 0) + fee }
    }

    const sundayWorldForPay = player.grassrootsPath === 'school' ? player.sundayLeague : league
    if (hasSundayContract(player, calendar.currentWeek.seasonYear, sundayWorldForPay) && player.sundayContract!.lastPaidWeek !== player.totalWeeksElapsed) {
      const contract = player.sundayContract!
      updatedPlayer = applyFinancialDelta(updatedPlayer, contract.weeklyWage, 'wage', `${contract.clubName} Sunday league salary`)
      updatedPlayer = { ...updatedPlayer, sundayContract: { ...contract, lastPaidWeek: player.totalWeeksElapsed }, careerEarnings: (updatedPlayer.careerEarnings ?? 0) + contract.weeklyWage }
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
          squadRoleSetWeek: updatedPlayer.totalWeeksElapsed ?? 0,
          squadRoleSetAppearances: updatedPlayer.career?.appearances ?? 0,
          squad: outcome.endsCareer ? updatedPlayer.squad : generateSquad(2),
          coachTrust: 0,
          negotiation: null,
          contractOffers: outcome.endsCareer ? updatedPlayer.contractOffers : updatedPlayer.contractOffers.filter(o => o.kind === 'club'),
          pathway: outcome.endsCareer ? updatedPlayer.pathway : { ...(updatedPlayer.pathway ?? initYouthPathway(updatedPlayer)), academyTrialStatus: 'none', academyTrialClubId: undefined },
          finances: outcome.endsCareer ? updatedPlayer.finances : { ...(updatedPlayer.finances ?? initYouthFinance('grassroots-season')), clubSupport: defaultClubSupport('grassroots-season') },
        }
        lastContractNote = outcome.message
        if (!outcome.endsCareer) {
          // back to a grassroots world; the next tick rebuilds it
          updatedAcademyLeague = null
          updatedLeague = null
          updatedCups = { ...EMPTY_CUPS }
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

    // The coach now sets four season-long objectives. Missing one never
    // overrides the normal selection system or deducts confidence.
    let arcPlayer: Player = { ...updatedPlayer, activeArcs: [], recentArcKeys: [] }
    if (result.seasonEnded && player.seasonObjectives?.seasonYear === calendar.currentWeek.seasonYear) {
      const completed = completedSeasonObjectives(player.seasonObjectives, player)
      arcPlayer = {
        ...arcPlayer,
        coachTrust: clamp((arcPlayer.coachTrust ?? 0) + completed * 0.2, -10, 10),
        confidence: { ...arcPlayer.confidence, value: clamp(arcPlayer.confidence.value + completed * 0.2, -10, 10) },
      }
      arcPlayer = withStory(arcPlayer, result.calendar, {
        kind: 'milestone', eyebrow: 'Coach · season objectives', title: 'SEASON GOALS REVIEWED',
        body: `You completed ${completed} of the four goals the coach set. ${completed ? 'Your work earned a small boost to trust and confidence.' : 'No penalty—your place is decided by your performances and fitness.'}`,
        detail: 'These objectives are a guide for the season. Missing a target never benches you.',
      })
    }
    if (result.seasonEnded && !arcPlayer.careerEnded && !arcPlayer.turnedPro) {
      const objectives = createSeasonObjectives(arcPlayer, result.calendar.currentWeek.seasonYear)
      arcPlayer = withStory({ ...arcPlayer, seasonObjectives: objectives }, result.calendar, {
        kind: 'milestone', eyebrow: 'Coach · new season', title: 'YOUR FOUR SEASON GOALS',
        body: seasonObjectivesBrief(objectives), detail: 'Track these all year on your player screen. There is no automatic benching for a missed goal.',
      })
    }

    // Career end: reaching the age cap (20) without turning pro is the fail-state
    let finalPlayer = result.reachedAgeCap
      ? { ...arcPlayer, careerEnded: true }
      : arcPlayer
    if(result.seasonEnded&&result.newAge>=18&&!isInAcademy&&finalPlayer.grassrootsPath==='school'&&!finalPlayer.careerEnded){finalPlayer={...finalPlayer,grassrootsPath:'sunday',squadRole:'bench',squadRoleSetWeek:finalPlayer.totalWeeksElapsed??0,squadRoleSetAppearances:finalPlayer.career?.appearances??0,pathway:{...(finalPlayer.pathway??initYouthPathway(finalPlayer)),schoolSquad:'released',sundayInterest:100,sundayStatus:'registered'}};finalPlayer=withStory(finalPlayer,result.calendar,{kind:'milestone',eyebrow:'Age 18 · school leaver',title:'SCHOOL FOOTBALL COMPLETE',body:'Your school career is over, but your football career is not. Sunday football, showcases and academy opportunities remain open.',detail:'There are no dead careers: keep performing and another route can find you.',ceremony:'callup'});updatedLeague=updatedSundayLeague??null;finalPlayer={...finalPlayer,squad:finalPlayer.sundaySquad??finalPlayer.squad,sundayLeague:undefined,sundaySquad:undefined};updatedSundayLeague=undefined;updatedCups={...EMPTY_CUPS}}
    if (result.seasonEnded && finalPlayer.careerClock.phase !== 'academy' && !finalPlayer.careerEnded) {
      const contractWorld = finalPlayer.grassrootsPath === 'school' ? finalPlayer.sundayLeague : updatedLeague
      if (contractWorld) {
        finalPlayer = openSundayContractWindow(finalPlayer, contractWorld, result.calendar.currentWeek.seasonYear, false, player)
        if (finalPlayer.contractOffers.some(o => o.kind === 'club')) finalPlayer = withStory(finalPlayer, result.calendar, { kind: 'invitation', eyebrow: 'Sunday transfer week · week 1', title: 'CHOOSE YOUR NEXT SEASON',
          body: 'The season is complete. Review your renewal and any approaches from other clubs.',
          detail: 'This is the one-week transfer window. Each deal lasts for the full new season; club names, divisions and weekly wages are shown in Offers.' })
      }
    }
    finalPlayer = reviewAcademyOpportunities(finalPlayer, result.calendar)
    if (updatedLeague && finalPlayer.careerClock.phase !== 'academy' && finalPlayer.careerClock.ageYears <= 15 && !finalPlayer.pathway?.showcaseInvited && result.calendar.currentWeek.weekNumber === 36 && finalPlayer.octoberLeague?.season !== result.calendar.currentWeek.seasonYear) {
      const division = updatedLeague.divisions[updatedLeague.playerDivision]
      finalPlayer = { ...finalPlayer, octoberLeague: initOctoberLeague(result.calendar.currentWeek.seasonYear, updatedLeague.playerTeamId, division.teams) }
    }
    const hasPyramidMovement = isInAcademy || updatedLeague?.kind === 'sunday'
    if (result.seasonEnded && hasPyramidMovement && seasonReview?.promoted) {
      finalPlayer = withStory(finalPlayer, result.calendar, { kind: 'promotion', eyebrow: 'Season verdict', title: 'PROMOTED', body: 'Your team has earned a place at the next level.', detail: seasonReview.verdict })
    } else if (result.seasonEnded && hasPyramidMovement && seasonReview?.relegated) {
      finalPlayer = withStory(finalPlayer, result.calendar, { kind: 'relegation', eyebrow: 'Season verdict', title: 'RELEGATED', body: 'The season ends with your team dropping a division.', detail: seasonReview.verdict })
    }

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

    setState({ player: finalPlayer, calendar: alignOctoberDevelopment(alignMatchDays(result.calendar, finalPlayer.careerClock.phase, finalPlayer.grassrootsPath ?? 'school', finalPlayer.pathway?.sundayStatus === 'registered'), finalPlayer.careerClock.ageYears, finalPlayer.careerClock.phase, finalPlayer.grassrootsPath ?? 'school', finalPlayer.pathway?.showcaseInvited === true), league: updatedLeague, academyLeague: updatedAcademyLeague, cups: updatedCups, international: updatedInternational, pendingArcVerdicts: [], pendingHeadlines: [...getState().pendingHeadlines, ...weeklyHeadlines], pendingSeasonReview: seasonReview, economyNote: lastContractNote ?? lastEconomyNote, selectionNote: lastSelectionNote, negotiationBeat: negotiationBeatThisWeek ?? getState().negotiationBeat })
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

    let updatedPlayer: Player = {
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

    if (player.communityTrialSessions !== undefined && player.pathway?.sundayStatus === 'training-invite') {
      const sessions = player.communityTrialSessions + 1
      updatedPlayer = { ...updatedPlayer, communityTrialSessions: sessions }
      const world = getState().league
      if (sessions >= 3 && world) {
        updatedPlayer = openSundayContractWindow(updatedPlayer, world, calendar.currentWeek.seasonYear, true)
        if (updatedPlayer.contractOffers.some(o => o.kind === 'club')) {
          updatedPlayer = withStory({ ...updatedPlayer, pathway: { ...updatedPlayer.pathway!, sundayStatus: 'squad-offer' } }, calendar, {
            kind: 'invitation', eyebrow: 'Community trial', title: 'A NEW CLUB WANTS YOU',
            body: `${world.divisions[world.playerDivision].teams.find(t => t.id === world.playerTeamId)?.name ?? 'A community club'} have offered you a Sunday season contract after three training sessions.`,
            detail: 'Review the offer and sign to play league and cup matches. The contract lasts for this season.',
          })
        }
      }
    }

    const event = nextUnresolvedEvent(calendar)
    const updatedCalendar = event ? markResolved(calendar, event.id) : calendar
    setState({ player: updatedPlayer, calendar: updatedCalendar })
    void getState().saveCurrent()
  },

  setYouthRoute: (route, club) => {
    const { player } = getState()
    if (!player) return
    setState({ player: {
      ...player,
      youthRoute: route,
      grassrootsPath: route === 'school' ? 'school' : 'sunday',
      schoolId: route === 'school' ? player.schoolId : null,
      grassrootsClubId: route === 'grassroots' ? club?.id ?? null : null,
      grassrootsClubName: route === 'grassroots' ? club?.name ?? null : null,
      sundayLeague: undefined,
      sundaySquad: undefined,
      sundayContract: undefined,
    } })
    void getState().saveCurrent()
  },

  setSchool: (schoolId) => {
    const { player } = getState()
    if (!player) return
    setState({ player: { ...player, youthRoute: 'school', grassrootsPath: 'school', schoolId, grassrootsClubId: null, grassrootsClubName: null } })
    void getState().saveCurrent()
  },

  completeTrials: (role, performance) => {
    const { player, calendar } = getState()
    if (!player) return
    // Trial performance nudges starting attributes within a small band (potential untouched).
    // Strong trials (+) lift attrs slightly; poor trials (-) start lower. Never exceeds potential.
    const band = (performance - 0.5) * 1.2 // -0.6 .. +0.6 per attribute
    const values = { ...(player.attributes.values as Record<string, number>) }
    for (const k of Object.keys(values)) {
      values[k] = clamp(Math.round((values[k] + band) * 10) / 10, 1, player.potential - 1)
    }
    let updatedPlayer: Player = {
      ...player,
      attributes: { ...player.attributes, values } as Player['attributes'],
      squadRole: role,
      grassrootsPath: role === 'released' || player.youthRoute === 'grassroots' ? 'sunday' : 'school',
      communityTrialSessions: role === 'released' ? 0 : undefined,
      pathway: role === 'released'
        ? { ...(player.pathway??initYouthPathway(player)), schoolSquad: 'released', sundayInterest:45, sundayStatus: 'training-invite' }
        : player.youthRoute === 'grassroots'
          ? { ...(player.pathway??initYouthPathway(player)), sundayInterest:100, sundayStatus:'registered' }
          : { ...(player.pathway??initYouthPathway(player)), schoolSquad:role==='reserves'?(performance<.5?'development':'reserve'):'first', sundayInterest:0, sundayStatus:'undiscovered' },
      squadRoleSetWeek: player.totalWeeksElapsed ?? 0,
      squadRoleSetAppearances: player.career?.appearances ?? 0,
      trialWeekCompleted: 3,
      careerClock: { ...player.careerClock, phase: 'grassroots-season' },
      competitionCareer: recordSelectionResult(player.competitionCareer, {
        competitionId: 'schoolTrials', season: calendar?.currentWeek.seasonYear ?? 1, round: 4,
        entrants: 60, survivors: 20, score: Math.round(performance * 100),
        outcome: role === 'released' ? 'cut' : 'selected',
      }),
    }
    updatedPlayer = withStory(updatedPlayer, calendar, {
      kind: 'selection', eyebrow: 'Final squad reveal',
      title: role === 'released' ? 'YOU HAVE BEEN CUT' : role === 'starting-xi' ? 'STARTING XI' : role === 'bench' ? 'YOU MADE THE SQUAD' : 'DEVELOPMENT SQUAD',
      body: player.youthRoute === 'grassroots'
        ? role === 'released'
          ? `${player.grassrootsClubName ?? 'The club'} did not offer you a squad place. Train with another community club three times to earn a fresh Sunday contract offer.`
          : `${player.grassrootsClubName ?? 'The club'} selected you for the ${role === 'starting-xi' ? 'starting eleven' : role}. Your next fixtures are in the Sunday League and Sunday Cup.`
        : role === 'released'
          ? 'The school coaches cut you. Train with a community club three times to earn a Sunday contract offer and keep your academy route alive.'
          : `The coaches selected you for the ${role === 'starting-xi' ? 'starting eleven' : role}. You will represent your school in the local league and Regional Schools Cup.`,
      detail: `Trial score: ${Math.round(performance * 100)}. The selection was earned from your performance, ability, fitness and coach trust.`,
    })
    const seasonObjectives = createSeasonObjectives(updatedPlayer, calendar?.currentWeek.seasonYear ?? 1, calendar?.currentWeek.weekNumber ?? 4)
    updatedPlayer = withStory({ ...updatedPlayer, seasonObjectives }, calendar, {
      kind: 'milestone', eyebrow: 'Coach · season plan', title: 'YOUR FOUR SEASON GOALS',
      body: seasonObjectivesBrief(seasonObjectives), detail: 'Work toward these across the season. A missed goal never automatically costs your place.',
    })
    setState({ player: updatedPlayer })
    void getState().saveCurrent()
  },

  applyMatchResult: (rating, goals, assists, finalMatchStamina, injury, opponentId, playerGoalsScored, opponentGoalsScored, playerWasHome, squad, opponentName, competitionId, shootoutWonByPlayer, redCarded, matchStats, playerWonMotm = false, participation) => {
    const { player, calendar, league, academyLeague, cups, international } = getState()
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
    if (!matchAvailability(player).canPlay || participation?.minutes === 0) {
      if (competitionId === 'schoolFriendlies' && opponentName) {
        setState({ player: { ...player, friendlyResults: [...(player.friendlyResults ?? []).filter(f => f.season !== calendar.currentWeek.seasonYear || f.week !== calendar.currentWeek.weekNumber), {
          season:calendar.currentWeek.seasonYear, week:calendar.currentWeek.weekNumber, opponentId, opponentName,
          isHome:playerWasHome, goalsFor:playerGoalsScored, goalsAgainst:opponentGoalsScored,
        }].slice(-12) } })
      }
      getState().resolveCurrentEvent(); return
    }
    const wasStarter = matchAvailability(player).canStart && (participation?.started ?? playerForMatch(player, competitionId).squadRole === 'starting-xi')
    const isInAcademy = player.careerClock.phase === 'academy'
    if (!isInAcademy && (competitionId === 'sundayLeague' || competitionId === 'sundayCup') && !hasSundayContract(player, calendar.currentWeek.seasonYear, player.grassrootsPath === 'school' ? player.sundayLeague : league)) { getState().resolveCurrentEvent(); return }
    const careerCompetitionId = competitionId === 'sundayLeague' && isInAcademy ? 'academyLeague' : competitionId
    const matchStories: Omit<StoryMoment, 'id' | 'read' | 'week' | 'season'>[] = []

    // Route the result to the RIGHT competition — league table only moves for
    // league matches; cup brackets and the international campaign own theirs;
    // friendlies touch nothing but the player.
    const isSideSunday = !isInAcademy && player.grassrootsPath === 'school' && competitionId === 'sundayLeague'
    const isLeagueMatch = competitionId === 'sundayLeague' || competitionId === 'schoolLeague'
    let updatedSundayLeague = isSideSunday && player.sundayLeague ? recordPlayerMatchResult(player.sundayLeague, opponentId, playerGoalsScored, opponentGoalsScored, playerWasHome, goals) : player.sundayLeague
    if (isSideSunday && updatedSundayLeague) updatedSundayLeague = simulateSundayThrough(updatedSundayLeague, calendar.currentWeek.weekNumber, false)
    let updatedLeague = isLeagueMatch && !isSideSunday && !isInAcademy && league ? recordPlayerMatchResult(league, opponentId, playerGoalsScored, opponentGoalsScored, playerWasHome, goals) : league
    let updatedAcademyLeague = isLeagueMatch && isInAcademy && academyLeague ? recordAcademyMatchResult(academyLeague, opponentId, playerGoalsScored, opponentGoalsScored, playerWasHome, goals) : academyLeague

    // P60 — "round results" on the match summary screen needs the REST of
    // this week's fixtures simulated too, not just the player's own. That
    // used to only happen later, inside advanceToNextWeek — meaning the
    // summary screen would show an empty round results list every time,
    // since it renders well before the week actually advances. Sim the
    // rest of the current round right now, immediately after recording the
    // player's own result. includePlayerTeam stays false — that fixture is
    // already recorded above, batchSimDivisionRound correctly skips
    // anything already marked played.
    if (isLeagueMatch && !isSideSunday) {
      const roundInfo = activeCompetitionForWeek(calendar.currentWeek.weekNumber, player.careerClock.phase, player.grassrootsPath, Boolean(cups.schoolDevelopment))
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
        if (!cupWorld.playerWonCup && next.playerWonCup) {
          matchStories.push({ kind: 'champion', eyebrow: cupWorld.label, title: 'CHAMPIONS', body: `You and your teammates have won the ${cupWorld.label}.`, detail: 'This trophy is now part of your permanent career history.', ceremony:'trophy' })
        } else if (!cupWorld.playerEliminated && next.playerEliminated) {
          matchStories.push({ kind: 'elimination', eyebrow: cupWorld.label, title: 'ELIMINATED', body: `Your run in the ${cupWorld.label} is over.`, detail: 'The world keeps moving. Your league season and other pathways remain alive.' })
        } else if (cupWorld.stage === 'group' && next.stage === 'knockout' && !next.playerEliminated) {
          matchStories.push({ kind: 'qualification', eyebrow: cupWorld.label, title: 'QUALIFIED', body: 'You have advanced from the group stage.', detail: 'The knockout draw is now waiting in the Competition Hub.', ceremony:'draw' })
        }
        updatedCups = { ...cups, [key]: next }
      }
    }
    let updatedInternational = international
    if (competitionId === 'international' && international) {
      updatedInternational = recordNationResult(international, opponentId, playerGoalsScored, opponentGoalsScored, playerWasHome, shootoutWonByPlayer)
      updatedInternational = advanceInternationalStage(updatedInternational)
      if (!international.wonTournament && updatedInternational.wonTournament) {
        matchStories.push({ kind: 'champion', eyebrow: 'International youth football', title: 'INTERNATIONAL CHAMPIONS', body: 'You have won a tournament for your country.', detail: 'This is the biggest stage in the youth game.', ceremony:'trophy' })
      } else if (international.stage !== 'complete' && updatedInternational.stage === 'complete' && !updatedInternational.wonTournament) {
        matchStories.push({ kind: 'elimination', eyebrow: 'International youth football', title: 'TOURNAMENT OVER', body: 'Your country has been eliminated.', detail: 'Your performances remain on your career record and in front of national-level scouts.' })
      } else if (international.stage === 'qualifiers' && updatedInternational.stage === 'finals') {
        matchStories.push({ kind: 'qualification', eyebrow: 'International youth football', title: 'FINALS QUALIFIED', body: 'Your country has reached the international finals.', detail: 'The pressure—and the scouting exposure—just increased.' })
      }
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
        club: { id: w.clubId, name: w.clubName, short: w.clubShort, countryId: w.countryId, ratings: w.ratings, prestige: w.prestige, primaryColor: '#888', secondaryColor: '#fff', notablePlayers: [] },
        interest: w.interest, tier: w.tier as 'local' | 'regional' | 'national',
        watchedMatches: w.watchedMatches, lastObservedWeek: w.lastObservedWeek, addedWeek: w.addedWeek,
      })),
      // 'club' transfer approaches are a P27 store-level concept the scouting
      // engine doesn't know about — hold them aside and merge back after.
      offers: (player.contractOffers ?? []).filter((o) => o.kind !== 'club').map((o) => ({
        id: o.id, weekOffered: o.weekOffered, expiresInWeeks: o.expiresInWeeks, kind: o.kind as 'academy' | 'professional',
        club: { id: o.clubId, name: o.clubName, short: o.clubShort, countryId: o.countryId, ratings: o.ratings, prestige: o.prestige, primaryColor: '#888', secondaryColor: '#fff', notablePlayers: [] },
      })),
    }
    let scoutingOut = updateReputation(scoutingIn, {
      rating, position: player.position, goals, assists,
      tackles: matchStats?.tackle ?? 0, interceptions: matchStats?.interception ?? 0,
      headers: matchStats?.header ?? 0, keyPasses: matchStats?.keyPass ?? 0, saves: matchStats?.save ?? 0,
      cleanSheet: opponentGoalsScored === 0,
      competitionPrestigeMultiplier: scoutingPrestigeMultiplier(careerCompetitionId),
    })
    if (player.careerClock.ageYears >= 16) {
      scoutingOut = updateWatcherInterest(scoutingOut, rating, player.totalWeeksElapsed ?? 0)
      scoutingOut = maybeAddWatcher(scoutingOut, player.careerClock.ageYears, player.totalWeeksElapsed ?? 0, player.academyCountryId ?? getNation(player.nationality).id)
    } else {
      scoutingOut = { ...scoutingOut, watchers: [] }
    }
    if (isInAcademy) scoutingOut = checkForOffers(scoutingOut, player.totalWeeksElapsed ?? 0, true, player.careerClock.ageYears)
    const newOffer = scoutingOut.offers.find((offer) => !scoutingIn.offers.some((old) => old.id === offer.id))
    if (newOffer) {
      matchStories.push({
        kind: 'invitation', eyebrow: newOffer.kind === 'academy' ? 'Academy invitation' : 'Professional opportunity',
        title: `${newOffer.club.name.toUpperCase()} WANT YOU`,
        body: newOffer.kind === 'academy' ? 'Your performances have earned an academy invitation.' : 'A club is ready to discuss your first professional contract.',
        detail: 'Open your offers before the invitation expires.',
      })
    }

    // weekly stamina reflects how the match actually went, not a flat cost —
    // a player subbed early or barely used ends up less drained (Section 5)
    let updatedPlayer: Player = {
      ...player,
      squad: isSideSunday || competitionId === 'nationalChampionship' || competitionId === 'international' ? player.squad : squad ?? player.squad,
      octoberLeague: competitionId === 'octoberDevelopment' && player.octoberLeague?.season === calendar.currentWeek.seasonYear
        ? recordOctoberResult(player.octoberLeague, calendar.currentWeek.weekNumber, opponentId, playerWasHome ? playerGoalsScored : opponentGoalsScored, playerWasHome ? opponentGoalsScored : playerGoalsScored)
        : player.octoberLeague,
      sundaySquad: isSideSunday ? squad ?? player.sundaySquad : player.sundaySquad,
      sundayLeague: updatedSundayLeague,
      leagueGoals: isLeagueMatch ? recordLeagueGoals(player, careerCompetitionId, isSideSunday ? player.sundayLeague?.playerDivision ?? 3 : isInAcademy ? academyLeague?.playerDivision ?? 2 : league?.playerDivision ?? 1, goals) : player.leagueGoals,
      lastMatchResult: opponentName
        ? { opponentName, playerScore: playerGoalsScored, opponentScore: opponentGoalsScored, playerGoals: goals, playerAssists: assists, playerRating: rating }
        : player.lastMatchResult,
      matchRatings: [...(player.matchRatings ?? []), rating].slice(-10),
      friendlyResults: competitionId === 'schoolFriendlies' && opponentName
        ? [...(player.friendlyResults ?? []).filter(f => f.season !== calendar.currentWeek.seasonYear || f.week !== calendar.currentWeek.weekNumber), {
            season: calendar.currentWeek.seasonYear, week: calendar.currentWeek.weekNumber, opponentId, opponentName,
            isHome: playerWasHome, goalsFor: playerGoalsScored, goalsAgainst: opponentGoalsScored,
          }].slice(-12)
        : player.friendlyResults,
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
          : competitionId === 'sundayLeague' || competitionId === 'schoolLeague' ? 'league'
          : competitionId === 'schoolCup' || competitionId === 'nationalChampionship' || competitionId === 'sundayCup' || competitionId === 'academyLeagueCup' || competitionId === 'academyKnockoutCup' || competitionId === 'academyChampionsCup' ? 'cup'
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
      competitionCareer: recordCompetitionMatch(player.competitionCareer, {
        competitionId: careerCompetitionId,
        season: calendar.currentWeek.seasonYear,
        started: wasStarter,
        minutes: participation?.minutes ?? (wasStarter ? 90 : player.squadRole === 'bench' ? 30 : 15),
        rating,
        goals,
        assists,
        cleanSheet: player.position === 'GK' && opponentGoalsScored === 0,
        redCarded,
        playerOfMatch: playerWonMotm,
      }),
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
      scoutWatchers: scoutingOut.watchers.map((w) => ({ clubId: w.club.id, clubName: w.club.name, clubShort: w.club.short, countryId: w.club.countryId, interest: w.interest, tier: w.tier, prestige: w.club.prestige, ratings: w.club.ratings, watchedMatches: w.watchedMatches, lastObservedWeek: w.lastObservedWeek, addedWeek: w.addedWeek })),
      contractOffers: [
        ...scoutingOut.offers.map((o) => ({ id: o.id, clubId: o.club.id, clubName: o.club.name, clubShort: o.club.short, countryId: o.club.countryId, weekOffered: o.weekOffered, expiresInWeeks: o.expiresInWeeks, prestige: o.club.prestige, ratings: o.club.ratings, kind: o.kind as 'academy' | 'professional' | 'club' })),
        ...(player.contractOffers ?? []).filter((o) => o.kind === 'club'),
      ],
    }
    if(newOffer?.kind==='academy'&&updatedPlayer.pathway?.academyTrialStatus!=='active'&&updatedPlayer.pathway?.academyTrialStatus!=='passed')updatedPlayer={...updatedPlayer,pathway:{...(updatedPlayer.pathway??initYouthPathway(updatedPlayer)),academyTrialStatus:'invited',academyTrialClubId:newOffer.club.id,academyTrialSessions:0,academyTrialPoints:0,academyTrialBase:undefined,academyTrialLastWeek:undefined}}
    if (!isInAcademy && player.grassrootsPath === 'school' && ['schoolLeague', 'schoolReserveLeague', 'schoolCup'].includes(competitionId)) {
      const previousStatus = updatedPlayer.pathway?.sundayStatus
      updatedPlayer = ensureSundayClub(updateSundayRecruitment(updatedPlayer, rating), calendar.currentWeek.weekNumber)
      if (updatedPlayer.pathway?.sundayStatus === 'squad-offer' && updatedPlayer.sundayLeague) updatedPlayer = openSundayContractWindow(updatedPlayer, updatedPlayer.sundayLeague, calendar.currentWeek.seasonYear, true)
      if (updatedPlayer.pathway?.sundayStatus === 'training-invite' && previousStatus !== 'training-invite' && previousStatus !== 'squad-offer') matchStories.push({ kind: 'invitation', eyebrow: 'Community football', title: 'SUNDAY CLUB INVITE', body: `${sundayClub(updatedPlayer.sundayLeague)?.name ?? 'A local club'} have followed your school performances and invited you to train.`, detail: 'Keep performing to earn a squad offer. This is community football; academy scouting starts at 16.' })
    }
    updatedPlayer = reviewAcademyOpportunities(updatedPlayer, calendar)
    for (const story of matchStories) updatedPlayer = withStory(updatedPlayer, calendar, story)
    const event = nextUnresolvedEvent(calendar)
    const updatedCalendar = event ? markResolved(calendar, event.id) : calendar
    // P35 — post-match headlines, checked off the exact scouting before/after
    // this function already computes, so no extra state reads are needed.
    const matchHeadlines = checkPostMatchHeadlines({
      player: updatedPlayer, rating, goals, assists, won: playerGoalsScored > opponentGoalsScored,
      opponentName: opponentName ?? 'their opponents', weekNumber: player.totalWeeksElapsed ?? 0,
      scoutingBefore: scoutingIn, scoutingAfter: scoutingOut,
    })
    setState({
      player: updatedPlayer, calendar: updatedCalendar, league: updatedLeague, academyLeague: updatedAcademyLeague,
      cups: updatedCups, international: updatedInternational,
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
      const retry = offer.kind === 'club' && player.grassrootsPath === 'sunday'
        && !hasSundayContract(player, calendar.currentWeek.seasonYear, getState().league)
        && !remainingOffers.some(o => o.kind === 'club')
      setState({ player: { ...player, contractOffers: remainingOffers,
        ...(retry ? { communityTrialSessions: 0, lastSundayOfferSeason: undefined,
          pathway: { ...(player.pathway ?? initYouthPathway(player)), sundayStatus: 'training-invite' as const } } : {}) } })
      void getState().saveCurrent()
      return
    }

    if (offer.kind === 'club') {
      // P27 club transfer: move to the approaching club — a real team already
      // in the league world. New teammates, new coach (trust resets to
      // neutral, role back to bench: earn your shirt), your standings history
      // stays with your old club exactly like real football.
      const sideRegistration = player.grassrootsPath === 'school' && !!player.sundayLeague
      const league = sideRegistration ? player.sundayLeague : getState().league
      if (!league || !offer.divisionTier || offer.weeklyWage === undefined || offer.contractSeason !== calendar.currentWeek.seasonYear || (player.totalWeeksElapsed ?? 0) - offer.weekOffered >= offer.expiresInWeeks) return
      if (hasSundayContract(player, calendar.currentWeek.seasonYear, league)) return
      if (player.sundayContract && calendar.currentWeek.weekNumber !== 1) return
      const division = league.divisions[offer.divisionTier as 1 | 2 | 3]
      const target = division.teams.find((t) => t.id === offer.clubId)
      if (!target) {
        setState({ player: { ...player, contractOffers: remainingOffers } })
        void getState().saveCurrent()
        return
      }
      const stayingAtClub = player.sundayContract?.clubId === target.id && league.playerTeamId === target.id
      const movedLeague = simulateSundayThrough({ ...league, playerDivision: offer.divisionTier as 1 | 2 | 3, playerTeamId: target.id }, calendar.currentWeek.weekNumber - 1)
      let movedPlayer: Player = {
        ...player,
        contractOffers: remainingOffers.filter((o) => o.kind !== 'club'),
        sundayContract: { clubId: target.id, clubName: target.name, division: offer.divisionTier as 1 | 2 | 3, season: calendar.currentWeek.seasonYear, weeklyWage: offer.weeklyWage },
        sundayContractsVersion: 1,
        communityTrialSessions: undefined,
        pathway: { ...(player.pathway ?? initYouthPathway(player)), sundayStatus: 'registered' },
        squad: sideRegistration ? player.squad : stayingAtClub ? player.squad : generateSquad(target.prestige),
        sundayLeague: sideRegistration ? movedLeague : player.sundayLeague,
        sundaySquad: sideRegistration ? stayingAtClub ? player.sundaySquad : generateSquad(target.prestige) : player.sundaySquad,
        leagueGoals: recordLeagueGoals(player, 'sundayLeague', league.playerDivision, 0),
        squadRole: sideRegistration || stayingAtClub ? player.squadRole : 'bench',
        squadRoleSetWeek: player.totalWeeksElapsed ?? 0,
        squadRoleSetAppearances: player.career?.appearances ?? 0,
        coachTrust: sideRegistration || stayingAtClub ? player.coachTrust : 0,
        reputation: clamp((player.reputation ?? 0) + (stayingAtClub ? 0 : 3), 0, 100),
      }
      movedPlayer = withStory(movedPlayer, calendar, { kind: 'selection', eyebrow: 'Sunday season contract', title: offer.renewal ? 'CONTRACT RENEWED' : 'SUNDAY CONTRACT SIGNED',
        body: `${target.name} · Division ${offer.divisionTier} · £${offer.weeklyWage} per week.`,
        detail: 'You are committed for the season. The next Sunday transfer window is at the season boundary. School matches are on Thursdays; Sunday league matches are on Sundays.', ceremony: 'callup' })
      setState({ player: movedPlayer, calendar: alignMatchDays(calendar, player.careerClock.phase, player.grassrootsPath ?? 'school', true), ...(sideRegistration ? {} : { league: movedLeague }) })
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
    getState().beginNegotiation(offer.id)
  },

  acceptSundayRegistration: () => {
    const { player } = getState()
    const offer = player?.contractOffers.find(o => o.kind === 'club' && o.weeklyWage !== undefined)
    if (offer) getState().respondToOffer(offer.id, true)
  },
  resolveAcademyTrial: (offerId, points) => {
    const { player, calendar } = getState()
    if (!player || !academyTrialAvailable(player, offerId, calendar)) return
    const offer = player.contractOffers.find(o => o.id === offerId)!
    const previous = player.pathway ?? initYouthPathway(player)
    const sameClub = previous.academyTrialClubId === offer.clubId
    const sessions = sameClub ? previous.academyTrialSessions ?? 0 : 0
    const week = player.totalWeeksElapsed ?? 0
    if (sessions >= 3 || sameClub && previous.academyTrialLastWeek === week) return
    const validPoints = [[12, 17, 8], [17, 13, 7], [19, 14, 10]][sessions]
    if (!validPoints.includes(points)) return
    const base = sameClub ? previous.academyTrialBase ?? academyTrialBase(player) : academyTrialBase(player)
    const earned = (sameClub ? previous.academyTrialPoints ?? 0 : 0) + points
    const count = sessions + 1
    const score = Math.min(100, base + earned)
    const complete = count === 3
    const passed = complete && score >= 62
    const offers = passed ? academyOfferBatch(offer, getNation(player.nationality).id, week) : []
    const pathway = { ...previous, academyTrialClubId: offer.clubId, academyTrialStatus: complete ? passed ? 'passed' as const : 'failed' as const : 'active' as const,
      academyQualifiedOfferIds: passed ? offers.map(o => o.id) : undefined,
      academyTrialSessions: count, academyTrialPoints: earned, academyTrialBase: base, academyTrialLastWeek: week }
    let updated: Player = { ...player, pathway,
      contractOffers: passed ? [...player.contractOffers.filter(o => o.kind !== 'academy'), ...offers]
        : complete ? player.contractOffers.filter(o => o.id !== offerId) : player.contractOffers,
      competitionCareer: recordSelectionResult(player.competitionCareer, { competitionId: 'academyTrials', season: calendar?.currentWeek.seasonYear ?? 1,
        round: count, entrants: count === 1 ? 60 : count === 2 ? 35 : 20, survivors: count === 1 ? 35 : count === 2 ? 20 : 1,
        score, outcome: complete ? passed ? 'selected' : 'cut' : 'advanced' }),
    }
    updated = withStory(updated, calendar, { kind: complete ? passed ? 'selection' : 'elimination' : 'selection',
      eyebrow: `${offer.clubName} academy trial`, title: complete ? passed ? 'TRIAL PASSED' : 'TRIAL ENDS HERE' : `TRIAL SESSION ${count}/3`,
      body: complete ? passed ? `${offers.length} academies have offered scholarship talks. Choose a club and an agent before negotiations.` : 'The academy chose other players, but your current pathway remains open.'
        : `Assessment ${count} is complete. Return next week for the next stage of the trial.`,
      detail: `Trial score ${score}/100${complete ? ' · required 62.' : ' · one assessment per week.'}`,
      ceremony: 'selection', metrics: [{ label: 'Trial score', value: score, suffix: '/100', tone: complete && !passed ? 'bad' : 'good' },
        { label: 'Session', value: count, suffix: '/3' }] })
    setState({ player: updated })
    void getState().saveCurrent()
  },

  completeAcademyMove: (clubName, prestige) => {
    const { player, calendar } = getState()
    if (!player || !academyEntryOpen(player, calendar) || player.negotiation?.kind !== 'academy' || player.negotiation.stage !== 'complete' || player.negotiation.clubName !== clubName || !player.contractOffers.some(o => o.clubId === player.negotiation?.clubId && academyOfferCleared(player, o.id))) return
    // Academy offer accepted: Grassroots → Academy transition. Reset scouting state
    // (a fresh academy career starts its own reputation/watchers) and initialize the
    // academy league world, discarding the Grassroots one.
    let updatedPlayer: Player = {
      ...player,
      academyClubName: clubName,
      academyCountryId: player.contractOffers.find(o => o.clubId === player.negotiation?.clubId)?.countryId ?? getNation(player.nationality).id,
      sundayLeague: undefined, sundaySquad: undefined, sundayContract: undefined,
      squadRole: 'bench', // a new academy signing starts as unproven, not an automatic starter (was carrying over stale Grassroots trial status)
      squadRoleSetWeek: player.totalWeeksElapsed ?? 0,
      squadRoleSetAppearances: player.career?.appearances ?? 0,
      contractOffers: [],
      scoutWatchers: [],
      reputation: 15, // academy signings start with modest built-in reputation, not zero
      careerClock: { ...player.careerClock, phase: 'academy', grassrootsSeason: null },
      finances: { ...(player.finances ?? initYouthFinance('academy')), currency: 'GBP', clubSupport: defaultClubSupport('academy') },
    }
    updatedPlayer = withStory(updatedPlayer, null, {
      kind: 'invitation', eyebrow: 'Academy pathway', title: 'WELCOME TO THE ACADEMY',
      body: `${clubName} is your new home. The level, support and expectations have all changed.`,
      detail: 'You begin on the bench. Earn your place through training and match performances.',
    })
    // Clamp to the Professional Development League's actual prestige range (5-7) — the
    // originating scout's own prestige (which can be as low as 1 for a local watcher)
    // must not become the academy team's strength, or the player could be dropped into
    // a division of prestige-5-7 teams with an unplayably weak prestige-1 team of their own.
    const academyWorld = initAcademyWorld(clubName, Math.max(5, Math.min(7, prestige)), updatedPlayer.academyCountryId)
    const academyTeam = academyWorld.divisions[academyWorld.playerDivision].teams.find((t) => t.id === academyWorld.playerTeamId)!
    const allAcademyTeams = Object.values(academyWorld.divisions).flatMap((d) => d.teams)
    // Grassroots cups end with the grassroots career; academy cups spin up in
    // their place (same depth, per the locked product strategy).
    const academyCups: CupWorlds = {
      schoolCup: null,
      schoolDevelopment: null,
      nationalChampionship: null,
      sundayCup: null,
      academyLeagueCup: initCupById('academyLeagueCup', academyTeam, allAcademyTeams),
      academyKnockoutCup: initCupById('academyKnockoutCup', academyTeam, allAcademyTeams),
      academyChampionsCup: null,
    }
    setState({ player: updatedPlayer, league: null, academyLeague: academyWorld, cups: academyCups })
    // Signing is the biggest moment in the game so far — celebrate it now, not
    // a week later on the next calendar tick.
    getState().runAchievementCheck()
    void getState().saveCurrent()
  },
}))
