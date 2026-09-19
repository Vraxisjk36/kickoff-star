import { useState } from 'react'
import { useCareerStore } from '../store/careerStore'
import type { LeagueWorld, Division } from '../engine/league'
import type { AcademyWorld } from '../engine/academy'
import type { Team } from '../engine/teams'
import BottomNav from '../components/BottomNav'
import { NAV_ITEMS, type HubTab } from '../components/navItems'
import HomeTab from './tabs/HomeTab'
import PlayerTab from './tabs/PlayerTab'
import PeopleTab from './tabs/PeopleTab'
import ClubTab from './tabs/ClubTab'
import LeagueTab from './tabs/LeagueTab'
import ShopTab from './tabs/ShopTab'
import WorldTab from './tabs/WorldTab'
import EnergySheet from '../components/EnergySheet'
import AchievementCeremony from '../components/AchievementCeremony'
import ArcVerdictCard from '../components/ArcVerdictCard'
import SeasonReviewCard from '../components/SeasonReviewCard'
import HeadlineToast from '../components/HeadlineToast'
import GazetteScreen from './GazetteScreen'
import YearCalendar from './YearCalendar'
import { buildSchoolCalendar, buildGrassrootsCalendar } from '../engine/careerCalendarV4'
import CaptaincyStoryCard from '../components/CaptaincyStoryCard'

// Phase 10: WeeklyHub is now a shell that hosts six real, routed tabs.
// Tab state is owned by Career so it survives event resolution (training,
// matches, decisions) and returns the player to where they were.

export default function WeeklyHub({
  tab, onTabChange, onOpenOffers, onExitToMenu, league, academyLeague, playerTeam, playerDivision,
}: {
  tab: HubTab
  onTabChange: (tab: HubTab) => void
  onOpenOffers: () => void
  onExitToMenu: () => void
  league: LeagueWorld | null
  academyLeague: AcademyWorld | null
  playerTeam: Team
  playerDivision: Division
}) {
  const player = useCareerStore((s) => s.player)
  const calendar = useCareerStore((s) => s.calendar)
  const cups = useCareerStore((s) => s.cups)
  const youthWorld = useCareerStore((s) => s.youthWorld)
  const international = useCareerStore((s) => s.international)
  const [energyOpen, setEnergyOpen] = useState(false)
  const [gazetteOpen, setGazetteOpen] = useState(false)
  const [yearCalendarOpen, setYearCalendarOpen] = useState(false)
  const pendingAchievements = useCareerStore((s) => s.pendingAchievements)
  const pendingArcVerdicts = useCareerStore((s) => s.pendingArcVerdicts)
  const pendingSeasonReview = useCareerStore((s) => s.pendingSeasonReview)
  const clearSeasonReview = useCareerStore((s) => s.clearSeasonReview)
  const clearArcVerdicts = useCareerStore((s) => s.clearArcVerdicts)
  const pendingHeadlines = useCareerStore((s) => s.pendingHeadlines)
  const clearHeadline = useCareerStore((s) => s.clearHeadline)
  const clearPendingAchievements = useCareerStore((s) => s.clearPendingAchievements)
  const clearCaptaincyStory = useCareerStore((s) => s.clearCaptaincyStory)

  if (!player || !calendar) {
    return <div className="min-h-screen bg-ks-black flex items-center justify-center text-ks-muted">no active career</div>
  }

  const isAcademy = player.careerClock.phase === 'academy'
  const offerCount = (player.contractOffers ?? []).length
  const activeLabel = NAV_ITEMS.find((n) => n.tab === tab)?.label ?? ''
  const youthV5 = useCareerStore((s) => s.youthV5)
  const latestLegacyGazette = player.gazetteIssues && player.gazetteIssues.length > 0 ? player.gazetteIssues[player.gazetteIssues.length - 1] : null
  const worldStories = youthV5.gazetteStories.slice(-8)
  const latestGazette = worldStories.length ? { weekNumber: calendar.currentWeek.weekNumber, seasonYear: player.careerClock.grassrootsSeason ?? 1, masthead: worldStories[worldStories.length-1].headline, articles: worldStories.slice().reverse().map(s=>({kind:s.category==='result'?'recap':s.category,headline:s.headline,body:s.body})) } : latestLegacyGazette

  return (
    <div className="min-h-screen bg-ks-black flex flex-col">
      {/* tab header — gives every destination a sense of place */}
      <div className="sticky top-0 z-20 bg-ks-black/95 backdrop-blur border-b border-ks-border/50">
        <div className="max-w-md mx-auto w-full px-3 py-2">
          <div className="flex items-center justify-between gap-3"><span className="font-display tracking-widest text-[10px] text-ks-gold uppercase">{activeLabel}</span><button type="button" onClick={onExitToMenu} className="career-menu-button" aria-label="Return to Kickoff Star main menu">☰ <span>MENU</span></button></div>
        </div>
      </div>

      <div className="flex-1 px-3 pt-3 pb-40 flex flex-col gap-2.5 max-w-md mx-auto w-full">
        {tab === 'home' && (
          <HomeTab
            player={player}
            calendar={calendar}
            league={isAcademy ? null : league}
            academyLeague={isAcademy ? academyLeague : null}
            offerCount={offerCount}
            onOpenOffers={onOpenOffers}
            onGoTo={onTabChange}
            onOpenEnergy={() => setEnergyOpen(true)}
            latestGazetteMasthead={latestGazette?.masthead ?? null}
            onOpenGazette={() => setGazetteOpen(true)}
            onOpenYearCalendar={() => setYearCalendarOpen(true)}
          />
        )}
        {(tab === 'player' || tab === 'scouts') && <PlayerTab player={player} onOpenOffers={onOpenOffers} />}
        {tab === 'people' && <PeopleTab player={player} />}
        {tab === 'club' && (
          <ClubTab player={player} playerTeam={playerTeam} division={playerDivision} isAcademy={isAcademy} youthWorld={youthWorld} />
        )}
        {(tab === 'fixtures' || tab === 'table') && (
          <LeagueTab
            division={playerDivision}
            playerTeamId={playerTeam.id}
            cups={cups}
            world={(isAcademy ? academyLeague : league)!}
            isAcademy={isAcademy}
            youthWorld={youthWorld}
            initialView={tab === 'table' ? 'table' : 'fixtures'}
          />
        )}
        {tab === 'world' && <WorldTab player={player} calendar={calendar} youthWorld={youthWorld} international={international} />}
        {tab === 'shop' && <ShopTab player={player} />}
      </div>

      <BottomNav active={tab} onSelect={onTabChange} badges={{ scouts: offerCount }} />

      {energyOpen && <EnergySheet player={player} onClose={() => setEnergyOpen(false)} />}
      {gazetteOpen && latestGazette && <GazetteScreen issue={latestGazette} onClose={() => setGazetteOpen(false)} />}
      {yearCalendarOpen && !isAcademy && <YearCalendar calendar={player.youthRoute === 'grassroots' ? buildGrassrootsCalendar(calendar.currentWeek.seasonYear) : buildSchoolCalendar(calendar.currentWeek.seasonYear)} currentWeek={calendar.currentWeek.weekNumber} onClose={() => setYearCalendarOpen(false)} />}

      {/* the season review takes precedence — it's the biggest beat of the year */}
      {pendingSeasonReview && (
        <SeasonReviewCard review={pendingSeasonReview} onDismiss={clearSeasonReview} />
      )}
      {!pendingSeasonReview && player.captaincy?.pendingStory && (
        <CaptaincyStoryCard story={player.captaincy.pendingStory} onDismiss={clearCaptaincyStory} />
      )}
      {!pendingSeasonReview && !player.captaincy?.pendingStory && pendingArcVerdicts.length > 0 && (
        <ArcVerdictCard queue={pendingArcVerdicts} onDismiss={() => clearArcVerdicts()} />
      )}
      {!pendingSeasonReview && !player.captaincy?.pendingStory && pendingArcVerdicts.length === 0 && pendingAchievements.length > 0 && (
        <AchievementCeremony queue={pendingAchievements} onDismiss={clearPendingAchievements} />
      )}

      {/* P35 — a toast, not a screen: sits above the tab content but below the
          full-screen moments (season review, arc verdicts, achievements),
          which naturally cover it while they're up rather than needing an
          explicit precedence check. */}
      <HeadlineToast queue={pendingHeadlines} onDismiss={clearHeadline} />
    </div>
  )
}
