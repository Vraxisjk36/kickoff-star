import { useState, useEffect } from 'react'
import { useCareerStore } from '../store/careerStore'
import { nextUnresolvedEvent, activeCompetitionForWeek } from '../engine/calendar'
import { playerCupFixture, CUP_CONFIGS } from '../engine/cup'
import { nationFixture, internationalTeamById } from '../engine/international'
import { generateTeam } from '../engine/teams'
import { canPlayYouthShowcase } from '../engine/academyRecruitment'
import { hasSundayContract } from '../engine/sundayContracts'
import { matchAvailability, playerForMatch } from '../engine/selection'
import { representativeEvidence } from '../engine/youthOpportunities'
import { formQualifiesForSelection } from '../engine/international'
import { rand } from '../engine/rng'
import { sfx } from '../engine/audio'
import { playMusic, pauseMusic } from '../engine/music'
import { pickLifeEvent, buildLifeContext } from '../engine/lifeEvents'
import { pickRelationshipEvent } from '../engine/relationshipEvents'
import { rand as randRoll } from '../engine/rng'
import type { Decision, DecisionResult } from '../types/decision'
import type { TrainingOutcome } from '../engine/training'
import type { Injury } from '../engine/injuries'
import type { RestChoice } from '../engine/energy'
import type { Team } from '../engine/teams'
import type { Division } from '../engine/league'
import WeeklyHub from './WeeklyHub'
import DecisionCard from '../components/DecisionCard'
import TrainingScreen from './TrainingScreen'
import MatchScreen from './MatchScreen'
import ShootoutScreen from './ShootoutScreen'
import MatchSummary from './MatchSummary'
import ImpactReveal, { type ImpactSnapshot } from '../components/ImpactReveal'
import AllocationScreen from '../components/AllocationScreen'
import { matchXpEarned } from '../engine/xp'
import CareerEnd from './CareerEnd'
import TurnedPro from './TurnedPro'
import ContractOffers from './ContractOffers'
import AgentSelect from './AgentSelect'
import NegotiationScreen from './NegotiationScreen'
import { isLive } from '../engine/negotiation'
import StreetGameScreen from './StreetGameScreen'
import StreetInvite from './StreetInvite'
import RestDayScreen from './RestDayScreen'
import MatchDayScreen from './MatchDayScreen'
import AcademyTrialScreen from './AcademyTrialScreen'
import type { HubTab } from '../components/navItems'
import type { RatingBreakdown } from '../engine/ratingSystemV32'
import type { PlayerMatchStats } from '../engine/matchStats'

type Mode =
  | { kind: 'hub' }
  | { kind: 'decision'; decision: Decision }
  | { kind: 'training' }
  | { kind: 'rest' }
  | { kind: 'matchday'; opponent: Team; isHome: boolean; competitionId: string; competitionLabel: string; isKnockout: boolean }
  | { kind: 'match'; opponent: Team; isHome: boolean; competitionId: string; competitionLabel: string; isKnockout: boolean }
  | { kind: 'shootout'; opponent: Team; isHome: boolean; competitionId: string; isKnockout: boolean; matchResult: { rating: number; goals: number; assists: number; won: boolean; drew: boolean; finalMatchStamina: number; injury: { severity: string; weeksOut: number; description: string } | null; wasSubbed: boolean; redCarded: boolean; playerScore: number; opponentScore: number; motm?: { playerWon: boolean; winnerName: string; winnerRating: number; winnerPosition: string }; squad?: import('../engine/squad').SquadPlayer[]; matchStats: { tackle: number; interception: number; header: number; keyPass: number; save: number }; playerStats: PlayerMatchStats; ratingBreakdown?: RatingBreakdown; minutesPlayed: number; yellowCards: number } }
  | { kind: 'summary'; rating: number; goals: number; assists: number; won: boolean; drew: boolean; finalMatchStamina: number; injury: { severity: string; weeksOut: number; description: string } | null; wasSubbed: boolean; redCarded: boolean; opponent: Team; playerGoalsScored: number; opponentGoalsScored: number; playerWasHome: boolean; motm?: { playerWon: boolean; winnerName: string; winnerRating: number; winnerPosition: string }; squad?: import('../engine/squad').SquadPlayer[]; competitionId: string; isKnockout: boolean; shootoutWon?: boolean; matchStats: { tackle: number; interception: number; header: number; keyPass: number; save: number }; playerStats: PlayerMatchStats; ratingBreakdown?: RatingBreakdown; minutesPlayed: number; yellowCards: number }
  | { kind: 'impact'; before: ImpactSnapshot; after: ImpactSnapshot; matchXp: number; tier: import('../engine/xp').CompetitionTier; playerName: string; rating: number; goals: number; assists: number; won: boolean; drew: boolean }
  | { kind: 'allocate-match'; matchXp: number; tier: import('../engine/xp').CompetitionTier }
  | { kind: 'allocate-training'; xp: number; attrs: import('../engine/xp').AttributeKey[] }
  | { kind: 'offers' }
  | { kind: 'agent' }
  | { kind: 'negotiation' }
  | { kind:'academy-trial'; offerId:string; clubName:string }
  | { kind: 'street-invite'; variant: 'street' | 'small-sided' }
  | { kind: 'street-game'; variant: 'street' | 'small-sided' }

export default function Career({ onExitToMenu }: { onExitToMenu?: () => void }) {
  const player = useCareerStore((s) => s.player)
  const calendar = useCareerStore((s) => s.calendar)
  const league = useCareerStore((s) => s.league)
  const academyLeague = useCareerStore((s) => s.academyLeague)
  const cups = useCareerStore((s) => s.cups)
  const international = useCareerStore((s) => s.international)
  const applyDecisionResult = useCareerStore((s) => s.applyDecisionResult)
  const resolveCurrentEvent = useCareerStore((s) => s.resolveCurrentEvent)
  const serveSuspensionMatch = useCareerStore((s) => s.serveSuspensionMatch)
  const advanceToNextWeek = useCareerStore((s) => s.advanceToNextWeek)
  const applyTrainingOutcome = useCareerStore((s) => s.applyTrainingOutcome)
  const applyRestChoice = useCareerStore((s) => s.applyRestChoice)
  const noteLifeEvent = useCareerStore((s) => s.noteLifeEvent)
  const runAchievementCheck = useCareerStore((s) => s.runAchievementCheck)
  const applyMatchResult = useCareerStore((s) => s.applyMatchResult)
  const spendAttributeXp = useCareerStore((s) => s.spendAttributeXp)
  const respondToOffer = useCareerStore((s) => s.respondToOffer)
  const resolveAcademyTrial=useCareerStore(s=>s.resolveAcademyTrial)
  const beginNegotiation = useCareerStore((s) => s.beginNegotiation)
  const applyStreetGameResult = useCareerStore((s) => s.applyStreetGameResult)
  const ensureLeagueWorld = useCareerStore((s) => s.ensureLeagueWorld)

  const [mode, setMode] = useState<Mode>({ kind: 'hub' })

  // Background music plays everywhere except actual match/training gameplay —
  // it would compete with the crowd/whistle sfx and the training pacing beats.
  // 'shootout' included: it's a tense match-adjacent screen, same rule applies.
  useEffect(() => {
    const silentModes = new Set(['training', 'matchday', 'match', 'street-game', 'shootout'])
    if (silentModes.has(mode.kind)) {
      pauseMusic()
    } else {
      playMusic()
    }
  }, [mode.kind])

  // Hub tab lives here (not in WeeklyHub) so it survives training/match/decision
  // screens unmounting the hub — the player returns to the tab they left.
  const [tab, setTab] = useState<HubTab>('home')
  // Session-level preference: some players want to sim the moments rather than play
  // them. Lives here so it persists across matches within a career session.
  const [autoResolve, setAutoResolve] = useState(false)
  const isInAcademy = player?.careerClock.phase === 'academy'

  // Grassroots league world is created lazily post-trials (never during Academy —
  // that world is created directly by respondToOffer when an academy offer is accepted).
  useEffect(() => {
    if (player && !player.turnedPro && !player.careerEnded && !isInAcademy && !league) ensureLeagueWorld()
  }, [player, league, isInAcademy, ensureLeagueWorld])

  if (!calendar || !player) return null

  if (player.turnedPro) {
    return <TurnedPro player={player} onMenu={() => onExitToMenu?.()} />
  }

  if (player.careerEnded) {
    return <CareerEnd player={player} onMenu={() => onExitToMenu?.()} />
  }

  // Active world depends on career phase — both share the same Division/Fixture shape
  const activeWorld = isInAcademy ? academyLeague : league
  // World init is a one-render window (grassroots via useEffect, academy synchronously
  // inside respondToOffer). Returning null here flashed a blank black screen with no nav
  // and no way out — show an explicit loading state instead.
  if (!activeWorld) {
    return (
      <div className="min-h-screen bg-ks-black flex items-center justify-center">
        <span className="font-display tracking-widest text-[11px] text-ks-muted uppercase animate-pulse">
          setting up your season…
        </span>
      </div>
    )
  }

  const playerDivision: Division = (activeWorld.divisions as Record<number, Division>)[activeWorld.playerDivision]
  const clubTeam = playerDivision.teams.find((t) => t.id === activeWorld.playerTeamId)!
  // On international duty you walk out for your NATION, not your club.
  const nationTeam = international ? internationalTeamById(international).get(international.nationTeamId) : undefined
  const inIntlMode = (mode.kind === 'matchday' || mode.kind === 'match' || mode.kind === 'summary') && mode.competitionId === 'international'
  const modeCompetitionId=mode.kind==='matchday'||mode.kind==='match'||mode.kind==='summary'||mode.kind==='shootout'?mode.competitionId:null
  const modeCup=modeCompetitionId?(cups as unknown as Record<string,import('../engine/cup').CupWorld|null>)[modeCompetitionId]:null
  const cupPlayerTeam=modeCup?.teams.find(t=>t.id===modeCup.playerTeamId)
  const sundayWorld = player.sundayLeague
  const sundayTeam = sundayWorld?.divisions[sundayWorld.playerDivision].teams.find(t => t.id === sundayWorld.playerTeamId)
  const playerTeam = modeCompetitionId === 'sundayLeague' && !isInAcademy && player.grassrootsPath === 'school' && sundayTeam ? sundayTeam : inIntlMode && nationTeam ? nationTeam : cupPlayerTeam??clubTeam
  const matchdayPlayer = playerForMatch(player, modeCompetitionId ?? '')
  const pending = nextUnresolvedEvent(calendar)

  const handleContinue = () => {
    if (!pending) { advanceToNextWeek(); return }
    if (player.injury) {
      resolveCurrentEvent()
      return
    }
    // P40: suspension only prevents playing MATCHES — training/rest/school
    // still happen as normal, unlike an injury which stops everything.
    if (pending.type === 'match' && (player.suspensionMatches ?? 0) > 0) {
      serveSuspensionMatch()
      return
    }
    if (pending.type === 'training') { setMode({ kind: 'training' }); return }
    if (pending.type === 'rest') { setMode({ kind: 'rest' }); return }
    if (pending.type === 'match') {
      // P25 fix: the matchday belongs to a specific competition — resolve THAT
      // competition's fixture instead of blindly burning the next league game
      // (which crammed all 22 league fixtures into the first half-season and
      // left 20 dead matchdays behind it).

      // Midweek international duty is its own slot, independent of Saturday.
      if (pending.title === 'international duty') {
        const fx = international ? nationFixture(international) : null
        if (!international || !fx || player.pathway?.nationalSelection !== 'selected' || !representativeEvidence(player, 'national').eligible || !formQualifiesForSelection(player.matchRatings)) { resolveCurrentEvent(); return }
        const byId = internationalTeamById(international)
        const nationIsHome = fx.homeTeamId === international.nationTeamId
        const opponent = byId.get(nationIsHome ? fx.awayTeamId : fx.homeTeamId)
        if (!opponent) { resolveCurrentEvent(); return }
        setMode({ kind: 'matchday', opponent, isHome: nationIsHome, competitionId: 'international', competitionLabel: international.stage === 'finals' ? 'International Finals' : 'International Qualifier', isKnockout: international.stage === 'finals' })
        return
      }
      if (pending.title === 'Sunday league fixture' || pending.title === 'Sunday community fixture') {
        if (!sundayWorld || player.pathway?.sundayStatus !== 'registered') { resolveCurrentEvent(); return }
        const division = sundayWorld.divisions[sundayWorld.playerDivision]
        const fixture = division.fixtures.find(f => !f.played && f.week <= calendar.currentWeek.weekNumber && (f.homeTeamId === sundayWorld.playerTeamId || f.awayTeamId === sundayWorld.playerTeamId))
        if (!fixture) { resolveCurrentEvent(); return }
        const isHome = fixture.homeTeamId === sundayWorld.playerTeamId
        const opponent = division.teams.find(t => t.id === (isHome ? fixture.awayTeamId : fixture.homeTeamId))
        if (!opponent) { resolveCurrentEvent(); return }
        setMode({ kind: 'matchday', opponent, isHome, competitionId: 'sundayLeague', competitionLabel: `Sunday League · Division ${sundayWorld.playerDivision}`, isKnockout: false })
        return
      }

      const comp = activeCompetitionForWeek(calendar.currentWeek.weekNumber, player.careerClock.phase, player.grassrootsPath, Boolean(cups.schoolDevelopment))
      if (!comp) { resolveCurrentEvent(); return }

      if (comp.competitionId === 'sundayLeague' || comp.competitionId === 'schoolLeague') {
        const schoolSquad=player.pathway?.schoolSquad
        if(!isInAcademy&&comp.competitionId==='schoolLeague'&&(schoolSquad==='reserve'||schoolSquad==='development')){const development=schoolSquad==='development';const opponent=generateTeam(Math.max(1,Math.min(5,playerTeam.prestige+(rand()<.5?-1:0))));setMode({kind:'matchday',opponent,isHome:rand()<.5,competitionId:development?'schoolDevelopmentLeague':'schoolReserveLeague',competitionLabel:development?'School Development Fixture':'School Reserve League',isKnockout:false});return}
        const fixture = playerDivision.fixtures
          .filter((f) => !f.played && f.week <= comp.round && (f.homeTeamId === activeWorld.playerTeamId || f.awayTeamId === activeWorld.playerTeamId))
          .sort((a, b) => a.week - b.week)[0]
        // No fixture (e.g. you transferred mid-window into a team whose match
        // this round is already played) -> the Saturday becomes extra training.
        if (!fixture) { setMode({ kind: 'training' }); return }
        const isHome = fixture.homeTeamId === activeWorld.playerTeamId
        const opponent = playerDivision.teams.find((t) => t.id === (isHome ? fixture.awayTeamId : fixture.homeTeamId))
        if (!opponent) { resolveCurrentEvent(); return }
        const competitionLabel = isInAcademy ? 'League' : comp.competitionId === 'schoolLeague' ? 'Local School League' : 'Sunday League'
        setMode({ kind: 'matchday', opponent, isHome, competitionId: comp.competitionId, competitionLabel, isKnockout: false })
        return
      }

      if (comp.competitionId === 'schoolFriendlies') {
        // Friendlies: an ad-hoc opponent near the player's level; nothing at
        // stake but sharpness, reputation and scout eyes.
        const opponent = generateTeam(Math.max(1, Math.min(10, playerTeam.prestige + (rand() < 0.5 ? -1 : 1))))
        setMode({ kind: 'matchday', opponent, isHome: rand() < 0.5, competitionId: 'schoolFriendlies', competitionLabel: 'School Friendly', isKnockout: false })
        return
      }
      if(comp.competitionId==='youthShowcase'){if(!canPlayYouthShowcase(player,calendar)){setMode({kind:'training'});return}const opponent=generateTeam(Math.max(5,Math.min(9,playerTeam.prestige+3)));setMode({kind:'matchday',opponent,isHome:true,competitionId:'youthShowcase',competitionLabel:'National Youth Showcase',isKnockout:false});return}

      if (comp.competitionId === 'nationalChampionship' && (player.pathway?.regionalSelection !== 'selected' || !representativeEvidence(player, 'regional').eligible)) { setMode({ kind: 'training' }); return }

      // A cup competition. If the player is eliminated (or the cup's done),
      // Saturday becomes extra training — never a dead tap.
      const cupWorld = (cups as unknown as Record<string, import('../engine/cup').CupWorld | null>)[comp.competitionId]
      const cupFixture = cupWorld ? playerCupFixture(cupWorld) : null
      if (!cupWorld || !cupFixture) { setMode({ kind: 'training' }); return }
      const isHome = cupFixture.homeTeamId === cupWorld.playerTeamId
      const opponent = cupWorld.teams.find((t) => t.id === (isHome ? cupFixture.awayTeamId : cupFixture.homeTeamId))
      if (!opponent) { resolveCurrentEvent(); return }
      const isKnockout = cupWorld.stage === 'knockout'
      setMode({ kind: 'matchday', opponent, isHome, competitionId: comp.competitionId, competitionLabel: CUP_CONFIGS[comp.competitionId]?.label ?? 'Cup', isKnockout })
      return
    }
    // Phase 15: the school slot now draws from the state-gated life-event pool
    // instead of replaying one hardcoded decision for all 34 weeks.
    // P32 — mid-week football. The player is offered it; declining is a real
    // option (it costs energy you might need for Saturday).
    if (pending.type === 'street') {
      const variant = pending.title.includes('small-sided') ? 'small-sided' as const : 'street' as const
      setMode({ kind: 'street-invite', variant })
      return
    }

    if (pending.type === 'school') {
      // Phase 28: ~55% of life slots now draw from the RELATIONSHIP pool —
      // events built around a specific named person in your cast, whose bond
      // gates them and moves with the outcome. The rest come from the general
      // pool so the world isn't only ever about the people you know.
      const week = calendar.currentWeek.weekNumber
      const relPick = randRoll() < 0.55 ? pickRelationshipEvent(player, week, player.recentLifeEvents ?? []) : null
      if (relPick) {
        noteLifeEvent(`${relPick.event.key}:${relPick.person.id}`)
        setMode({ kind: 'decision', decision: relPick.decision })
        return
      }
      const ctx = buildLifeContext(player, week)
      const { event, decision } = pickLifeEvent(ctx, player.recentLifeEvents ?? [])
      noteLifeEvent(event.key)
      setMode({ kind: 'decision', decision })
      return
    }
    resolveCurrentEvent()
  }

  const handleDecisionResolved = (result: DecisionResult, relationshipId?: string) => {
    applyDecisionResult(result, relationshipId)
    setMode({ kind: 'hub' })
  }

  const handleTrainingComplete = (outcome: TrainingOutcome, energySpent: number, injury: Injury | null, xpEarned: number, restrictedAttrs: import('../engine/xp').AttributeKey[]) => {
    applyTrainingOutcome(outcome, energySpent, injury)
    setMode({ kind: 'allocate-training', xp: xpEarned, attrs: restrictedAttrs })
  }

  const handleRestChoice = (choice: RestChoice) => {
    applyRestChoice(choice)
    setMode({ kind: 'hub' })
  }

  if (mode.kind === 'decision') {
    return <DecisionCard decision={mode.decision} onResolved={(r) => handleDecisionResolved(r, mode.decision.relationshipId)} />
  }
  if (mode.kind === 'training') {
    return <TrainingScreen player={player} onComplete={handleTrainingComplete} />
  }
  if (mode.kind === 'allocate-training') {
    return (
      <AllocationScreen
        title="training complete"
        subtitle="restricted to what you actually trained today"
        totalXp={mode.xp}
        attrs={mode.attrs}
        values={player.attributes.values as Record<string, number>}
        potential={player.potential}
        onSpend={(attr, amount) => spendAttributeXp(attr, amount)}
        onDone={() => setMode({ kind: 'hub' })}
      />
    )
  }
  if (mode.kind === 'rest') {
    return <RestDayScreen player={player} onChoose={handleRestChoice} />
  }
  if ((mode.kind === 'matchday' || mode.kind === 'match') && !isInAcademy && (mode.competitionId === 'sundayLeague' || mode.competitionId === 'sundayCup') && !hasSundayContract(player, calendar.currentWeek.seasonYear, player.grassrootsPath === 'school' ? sundayWorld : league)) {
    return <div className="min-h-screen bg-ks-black flex items-center justify-center px-5"><div className="max-w-sm w-full rounded-xl border border-ks-border p-6 text-center"><h1 className="font-display text-xl text-ks-gold">SUNDAY REGISTRATION</h1><p className="text-sm text-ks-ink mt-3">You need a signed season contract to play for this club.</p><button className="w-full bg-ks-gold text-ks-black rounded-lg py-3 mt-4" onClick={() => setMode({ kind: 'offers' })}>review contracts</button><button className="w-full text-ks-muted py-3" onClick={() => { resolveCurrentEvent(); setMode({ kind: 'hub' }) }}>sit out this fixture</button></div></div>
  }
  if ((mode.kind === 'matchday' || mode.kind === 'match') && !matchAvailability(player).canPlay) {
    return <div className="min-h-screen bg-ks-black flex items-center justify-center px-5"><div className="max-w-sm w-full rounded-2xl border border-ks-border p-6 text-center"><h1 className="font-display text-ks-gold text-2xl">RESTED FOR THIS MATCH</h1><p className="text-ks-ink mt-3">Your energy is {Math.round(player.fitness.stamina)}%. Below 30%, you cannot play.</p><p className="text-ks-muted text-sm mt-2">Your team will play without you. Recover to at least 50% to be considered for a starting place.</p><button className="w-full bg-ks-gold text-ks-black rounded-xl py-3 mt-5" onClick={() => { resolveCurrentEvent(); setMode({ kind: 'hub' }) }}>sit out this match →</button></div></div>
  }
  if (mode.kind === 'matchday') {
    return (
      <MatchDayScreen
        player={matchdayPlayer}
        playerTeam={playerTeam}
        opponent={mode.opponent}
        isHome={mode.isHome}
        competitionLabel={mode.competitionLabel}
        onKickOff={() => { sfx.whistle(); setMode({ kind: 'match', opponent: mode.opponent, isHome: mode.isHome, competitionId: mode.competitionId, competitionLabel: mode.competitionLabel, isKnockout: mode.isKnockout }) }}
      />
    )
  }
  if (mode.kind === 'match') {
    return (
      <MatchScreen
        player={matchdayPlayer}
        playerTeam={playerTeam}
        opponent={mode.opponent}
        playerIsHome={mode.isHome}
        autoResolve={autoResolve}
        onToggleAutoResolve={() => setAutoResolve((v) => !v)}
        onComplete={(r) => {
          const drew = r.playerScore === r.opponentScore
          if (mode.isKnockout && drew) {
            // P67 — real interactive shootout instead of a single hidden
            // roll. Hold the match result until it resolves.
            setMode({
              kind: 'shootout', opponent: mode.opponent, isHome: mode.isHome,
              competitionId: mode.competitionId, isKnockout: mode.isKnockout,
              matchResult: r,
            })
            return
          }
          setMode({
            kind: 'summary', ...r, opponent: mode.opponent,
            playerGoalsScored: r.playerScore, opponentGoalsScored: r.opponentScore,
            playerWasHome: mode.isHome, competitionId: mode.competitionId, isKnockout: mode.isKnockout,
            shootoutWon: undefined,
          })
        }}
      />
    )
  }
  if (mode.kind === 'shootout') {
    return (
      <ShootoutScreen
        player={player}
        playerTeam={playerTeam}
        opponent={mode.opponent}
        playerIsHome={mode.isHome}
        onComplete={(playerWon) => {
          const r = mode.matchResult
          setMode({
            kind: 'summary', ...r, opponent: mode.opponent,
            playerGoalsScored: r.playerScore, opponentGoalsScored: r.opponentScore,
            playerWasHome: mode.isHome, competitionId: mode.competitionId, isKnockout: mode.isKnockout,
            shootoutWon: playerWon,
          })
        }}
      />
    )
  }
  if (mode.kind === 'summary') {
    const needsShootout = mode.isKnockout && mode.drew
    const shootoutWon = mode.shootoutWon
    return (
      <MatchSummary
        rating={mode.rating} goals={mode.goals} assists={mode.assists} won={mode.won} drew={mode.drew}
        injury={mode.injury} wasSubbed={mode.wasSubbed} redCarded={mode.redCarded}
        playerStats={mode.playerStats} ratingBreakdown={mode.ratingBreakdown} minutesPlayed={mode.minutesPlayed} yellowCards={mode.yellowCards}
        shootout={needsShootout ? { won: shootoutWon! } : null}
        onDone={() => {
          // P47 — Joel: "show the actual number increase." Snapshot BEFORE
          // applyMatchResult runs (the current player is still pre-match at
          // this point), then read the store fresh right after — that's the
          // real after-state, not a re-derived estimate.
          const snapshotOf = (p: typeof player): ImpactSnapshot => ({
            confidence: p.confidence.value,
            coachTrust: p.coachTrust,
            reputation: p.reputation,
            teammates: p.standing?.teammates ?? 0,
            fans: p.standing?.fans ?? 0,
          })
          const before = snapshotOf(player)
          applyMatchResult(
            mode.rating, mode.goals, mode.assists, mode.finalMatchStamina, mode.injury,
            mode.opponent.id, mode.playerGoalsScored, mode.opponentGoalsScored, mode.playerWasHome,
            mode.squad, mode.opponent.name, mode.competitionId, shootoutWon, mode.redCarded, mode.matchStats, mode.motm?.playerWon, { minutes: mode.minutesPlayed, started: matchdayPlayer.squadRole === 'starting-xi' }
          )
          // Must run AFTER the result lands — career counters are what most
          // achievements read, and they only exist once applyMatchResult has run.
          runAchievementCheck({
            rating: mode.rating, goals: mode.goals, assists: mode.assists,
            won: mode.won, cleanSheet: mode.opponentGoalsScored === 0, wasSubbed: mode.wasSubbed,
          })
          const freshPlayer = useCareerStore.getState().player
          const after = freshPlayer ? snapshotOf(freshPlayer) : before
          // P49 — universal match XP pool, "you used everything." Cup ties
          // and internationals are a bigger stage than a routine league
          // fixture, which is exactly why they're worth more development.
          // P59 audit finding: academy cup competitions (academyLeagueCup,
          // academyKnockoutCup — see calendar.ts's ACADEMY_ACTIVE set) were
          // never checked here, only the grassroots cup names. A real cup
          // tie during the academy phase was silently earning plain
          // academy-tier XP (600 base) instead of cup-tier XP (900 base)
          // despite genuinely being a cup competition — the "bigger stage,
          // more development" rule wasn't actually reaching academy cups.
          const tier: import('../engine/xp').CompetitionTier =
            mode.competitionId === 'international' ? 'international'
            : mode.competitionId === 'schoolCup' || mode.competitionId === 'nationalChampionship' || mode.competitionId === 'sundayCup' || mode.competitionId === 'academyLeagueCup' || mode.competitionId === 'academyKnockoutCup' ? 'cup'
            : freshPlayer?.careerClock.phase === 'academy' ? 'academy' : 'grassroots'
          const matchXp = matchXpEarned(tier, mode.rating, mode.goals, mode.assists)
          setMode({ kind: 'impact', before, after, matchXp, tier, playerName: player.name, rating: mode.rating, goals: mode.goals, assists: mode.assists, won: mode.won, drew: mode.drew })
        }}
      />
    )
  }
  if (mode.kind === 'impact') {
    return (
      <ImpactReveal
        before={mode.before} after={mode.after}
        playerName={mode.playerName} rating={mode.rating} goals={mode.goals} assists={mode.assists} won={mode.won} drew={mode.drew}
        onDone={() => setMode({ kind: 'allocate-match', matchXp: mode.matchXp, tier: mode.tier })}
      />
    )
  }
  if (mode.kind === 'allocate-match') {
    const attrs = (player.position === 'GK' ? ['reflexes', 'handling', 'gkPositioning', 'distribution'] : ['passing', 'shooting', 'dribbling', 'tackling', 'pace', 'strength', 'stamina', 'agility', 'vision', 'composure', 'positioning', 'concentration']) as import('../engine/xp').AttributeKey[]
    return (
      <AllocationScreen
        title="match xp earned"
        subtitle={`${mode.tier} fixture — you used everything out there, spend it anywhere`}
        totalXp={mode.matchXp}
        attrs={attrs}
        values={player.attributes.values as Record<string, number>}
        potential={player.potential}
        onSpend={(attr, amount) => spendAttributeXp(attr, amount)}
        onDone={() => setMode({ kind: 'hub' })}
      />
    )
  }

  if (mode.kind === 'street-invite') {
    return (
      <StreetInvite
        player={player}
        variant={mode.variant}
        onAccept={() => setMode({ kind: 'street-game', variant: mode.variant })}
        onDecline={() => { resolveCurrentEvent(); setMode({ kind: 'hub' }) }}
      />
    )
  }

  if (mode.kind === 'street-game') {
    return (
      <StreetGameScreen
        player={player}
        variant={mode.variant}
        onDone={(result) => { applyStreetGameResult(result); setMode({ kind: 'hub' }) }}
      />
    )
  }

  if (mode.kind === 'agent') {
    return <AgentSelect onDone={() => setMode({ kind: 'offers' })} />
  }

  if (mode.kind === 'negotiation') {
    return <NegotiationScreen player={player} onClose={() => setMode({ kind: 'hub' })} />
  }
  if(mode.kind==='academy-trial')return <AcademyTrialScreen player={player} clubName={mode.clubName} onComplete={(passed,score)=>{resolveAcademyTrial(mode.offerId,passed,score);if(!passed){setMode({kind:'hub'});return}const fresh=useCareerStore.getState().player;if(!fresh?.agentId){setMode({kind:'agent'});return}beginNegotiation(mode.offerId);setMode({kind:'negotiation'})}}/>

  if (mode.kind === 'offers') {
    return (
      <ContractOffers
        player={player}
        onRespond={(id, accept) => {
          if (!accept) { respondToOffer(id, false); setMode({ kind: 'hub' }); return }
          const offer = (player.contractOffers ?? []).find((o) => o.id === id)
          // P30: an academy move is no longer a single button. You need
          // representation first, then talks that run over several weeks.
          // P33: both academy AND professional deals go through the pipeline.
          if (offer?.kind === 'academy' || offer?.kind === 'professional') {
            if(offer.kind==='academy'&&!(player.pathway?.academyTrialStatus==='passed'&&player.pathway.academyTrialClubId===offer.clubId)){setMode({kind:'academy-trial',offerId:offer.id,clubName:offer.clubName});return}
            if (!player.agentId) { setMode({ kind: 'agent' }); return }
            beginNegotiation(id)
            setMode({ kind: 'negotiation' })
            return
          }
          respondToOffer(id, true)
        }}
        onClose={() => setMode({ kind: 'hub' })}
      />
    )
  }

  return (
    <div className="relative">
      <WeeklyHub
        tab={tab}
        onTabChange={setTab}
        onOpenOffers={() => setMode({ kind: isLive(player.negotiation) ? 'negotiation' : 'offers' })}
        onExitToMenu={() => onExitToMenu?.()}
        league={league}
        academyLeague={academyLeague}
        playerTeam={playerTeam}
        playerDivision={playerDivision}
      />
      <div className="fixed left-0 right-0 px-3 max-w-md mx-auto z-20" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.5rem)' }}>
        <button
          onClick={handleContinue}
          className="w-full bg-ks-gold text-ks-black font-display tracking-wide rounded-xl py-3.5 text-sm shadow-[0_0_25px_rgba(212,175,55,0.3)] active:scale-[0.99] transition-transform"
        >
          {player.injury
            ? `recovering — ${player.injury.weeksRemaining} week${player.injury.weeksRemaining === 1 ? '' : 's'} left →`
            : pending ? `continue — ${pending.day.toUpperCase()}: ${pending.title}` : 'advance to next week →'}
        </button>
      </div>
    </div>
  )
}
