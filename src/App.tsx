import { useEffect, useRef, useState } from 'react'
import SplashScreen from './screens/SplashScreen'
import MainMenu from './screens/MainMenu'
import PlayerCreation from './screens/PlayerCreation'
import StoryIntro from './screens/StoryIntro'
import SchoolSelection from './screens/SchoolSelection'
import RouteSelection, { type YouthRouteChoice } from './screens/RouteSelection'
import GrassrootsSelection, { type GrassrootsClubChoice } from './screens/GrassrootsSelection'
import TrialsScreen from './screens/TrialsScreen'
import Career from './screens/Career'
import SettingsScreen from './screens/SettingsScreen'
import CreditsScreen from './screens/CreditsScreen'
import HelpScreen from './screens/HelpScreen'
import LoadCareerScreen from './screens/LoadCareerScreen'
import { useCareerStore } from './store/careerStore'
import { listSaves, type SaveSlotId } from './engine/save'
import type { School } from './engine/schools'
import type { SquadRole } from './engine/trials'
import { installMusicLifecycle, pauseMusic } from './engine/music'

type Screen = 'splash' | 'menu' | 'create' | 'story' | 'route' | 'school' | 'grassroots' | 'trials' | 'career' | 'settings' | 'credits' | 'help' | 'load'

// Native-shell validation touch: navigation contract is intentionally centralized here.
const SCREEN_VALUES: Screen[] = ['splash', 'menu', 'create', 'story', 'route', 'school', 'grassroots', 'trials', 'career', 'settings', 'credits', 'help', 'load']
const isScreen = (value: unknown): value is Screen => typeof value === 'string' && SCREEN_VALUES.includes(value as Screen)

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash')
  const [chosenSchool, setChosenSchool] = useState<School | null>(null)
  const [chosenRoute, setChosenRoute] = useState<YouthRouteChoice | null>(null)
  const screenRef = useRef<Screen>(screen)
  screenRef.current = screen
  const player = useCareerStore((s) => s.player)
  const loadFromSlot = useCareerStore((s) => s.loadFromSlot)
  const setYouthRoute = useCareerStore((s) => s.setYouthRoute)
  const setSchool = useCareerStore((s) => s.setSchool)
  const setGrassrootsClub = useCareerStore((s) => s.setGrassrootsClub)
  const completeTrials = useCareerStore((s) => s.completeTrials)

  useEffect(() => {
    const removeMusicLifecycle = installMusicLifecycle()
    window.history.replaceState({ screen: 'splash' }, '')
    const onPopState = (event: PopStateEvent) => {
      const next = event.state?.screen
      setScreen(isScreen(next) ? next : 'menu')
    }
    const onNativeBack = () => {
      const current = screenRef.current
      if (current === 'menu') return
      if (current === 'career' || current === 'settings' || current === 'credits' || current === 'help' || current === 'load' || current === 'create') {
        window.history.replaceState({ screen: 'menu' }, '')
        setScreen('menu')
        return
      }
      window.history.back()
    }
    window.addEventListener('popstate', onPopState)
    window.addEventListener('kickoffstar:native-back', onNativeBack)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('kickoffstar:native-back', onNativeBack)
      removeMusicLifecycle()
    }
  }, [])

  const navigate = (next: Screen) => {
    window.history.pushState({ screen: next }, '')
    setScreen(next)
  }

  const replace = (next: Screen) => {
    window.history.replaceState({ screen: next }, '')
    setScreen(next)
  }

  const goBackToMenu = () => replace('menu')

  const exitCareerToMenu = () => {
    pauseMusic()
    replace('menu')
  }

  const enterLoadedCareer = async (slot: SaveSlotId, push = true) => {
    await loadFromSlot(slot)
    const p = useCareerStore.getState().player
    if (!p) {
      replace('menu')
      return
    }
    if (p.trialWeekCompleted < 3) {
      setChosenSchool(null)
      const route = p.youthRoute ?? (p.grassrootsPath === 'sunday' ? 'grassroots' : p.schoolId ? 'school' : null)
      setChosenRoute(route)
      ;(push ? navigate : replace)(route === 'grassroots' ? 'grassroots' : route === 'school' ? 'school' : 'route')
    } else {
      ;(push ? navigate : replace)('career')
    }
  }

  const handleContinue = async () => {
    const saves = (await listSaves()).filter((s): s is NonNullable<typeof s> => !!s)
    if (saves.length === 0) return
    const latest = [...saves].sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))[0]
    await enterLoadedCareer(latest.slotId)
  }

  const handleRouteChosen = (route: YouthRouteChoice) => {
    setChosenRoute(route)
    setChosenSchool(null)
    setYouthRoute(route)
    replace(route === 'school' ? 'school' : 'grassroots')
  }

  const handleSchoolChosen = (school: School) => {
    setChosenSchool(school)
    setSchool(school.id)
    replace('trials')
  }

  const handleGrassrootsChosen = (club: GrassrootsClubChoice) => {
    setChosenRoute('grassroots')
    setChosenSchool(club)
    setGrassrootsClub(club.clubId, club.name)
    replace('trials')
  }

  const handleTrialsComplete = (role: SquadRole, performance: number) => {
    if (role === 'released') {
      setChosenSchool(null)
      replace(chosenRoute === 'grassroots' ? 'grassroots' : 'school')
      return
    }
    completeTrials(role, performance)
    replace('career')
  }

  if (screen === 'splash') return <SplashScreen onDone={() => replace('menu')} />
  if (screen === 'menu') {
    return (
      <MainMenu
        onNewCareer={() => navigate('create')}
        onContinue={handleContinue}
        onLoadCareer={() => navigate('load')}
        onOpenSettings={() => navigate('settings')}
        onOpenCredits={() => navigate('credits')}
        onOpenHelp={() => navigate('help')}
      />
    )
  }
  if (screen === 'load') return <LoadCareerScreen onBack={goBackToMenu} onLoad={(slot) => enterLoadedCareer(slot, false)} />
  if (screen === 'settings') return <SettingsScreen onBack={goBackToMenu} />
  if (screen === 'credits') return <CreditsScreen onBack={goBackToMenu} />
  if (screen === 'help') return <HelpScreen onBack={goBackToMenu} />
  if (screen === 'create') return <PlayerCreation onComplete={() => replace('story')} onBack={goBackToMenu} />
  if (screen === 'story') return <StoryIntro onComplete={() => replace('route')} />
  if (screen === 'route') return <RouteSelection onChoose={handleRouteChosen} />
  if (screen === 'school') return <SchoolSelection onChoose={handleSchoolChosen} />
  if (screen === 'grassroots') return <GrassrootsSelection onChoose={handleGrassrootsChosen} />
  if (screen === 'trials' && player && chosenSchool) {
    return <TrialsScreen player={player} school={chosenSchool} route={chosenRoute ?? player.youthRoute ?? 'school'} onComplete={handleTrialsComplete} />
  }
  return <Career onExitToMenu={exitCareerToMenu} />
}
