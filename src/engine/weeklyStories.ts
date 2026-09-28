import type { Player } from '../types/player'
import type { Decision, DecisionOption, OutcomeEffect } from '../types/decision'

// Three stories per year; the other three appear the following season. Each
// begins, returns three weeks later, and concludes nine weeks after opening.
const STORIES = [
  { key: 'home-kit', start: 'Your family has an unexpected bill. A neighbour offers paid weekend work, but it will cost recovery time.', follow: 'The neighbour calls again. The bill is still there, and your family remembers what you chose.', end: 'The bill has been settled. Your family talks about how you handled the last few weeks.', help: 'Take the shift', focus: 'Protect match recovery', helpEffect: { money: 18, energy: -5, confidence: 1 }, focusEffect: { energy: 4, confidence: -1 } },
  { key: 'study-partner', start: 'A classmate is falling behind and asks you to study together before the next assessment.', follow: 'The assessment is close. Your classmate brings notes and asks for another session.', end: 'Results come back. Your classmate seeks you out after school.', help: 'Study together', focus: 'Study on your own', helpEffect: { energy: -3, confidence: 1, attributePractice: 'vision' }, focusEffect: { energy: 2, confidence: -1 } },
  { key: 'community-pitch', start: 'The local pitch needs repairs. A volunteer asks the squad to lend a hand.', follow: 'The repair fund is short. The volunteers invite you back.', end: 'The pitch reopens. The kids playing there recognise your face.', help: 'Help at the pitch', focus: 'Keep your training time', helpEffect: { energy: -4, reputation: 1, attributePractice: 'passing' }, focusEffect: { energy: 2 } },
  { key: 'coach-film', start: 'Your coach offers to review your match footage with you after training.', follow: 'The coach has marked three moments from your last game. There is time for one more review.', end: 'The coach checks whether you applied the lesson in matches.', help: 'Review the footage', focus: 'Head home to recover', helpEffect: { energy: -3, coachTrust: 1, attributePractice: 'vision' }, focusEffect: { energy: 4 } },
  { key: 'team-mate', start: 'A teammate has lost confidence. He asks you to stay behind for extra practice.', follow: 'He wants another session. Your own legs are heavy after the week.', end: 'He finds you after the next match and talks about the help you gave.', help: 'Stay and practice', focus: 'Set a boundary', helpEffect: { energy: -5, confidence: 1, attributePractice: 'passing' }, focusEffect: { energy: 3, confidence: -1 } },
  { key: 'holiday-work', start: 'A shop offers a few paid hours during a school break. The club has optional training on the same day.', follow: 'The shop has another shift available while you plan your next match.', end: 'The owner settles your wages and asks whether you would come back.', help: 'Take the paid work', focus: 'Attend optional training', helpEffect: { money: 15, energy: -4 }, focusEffect: { coachTrust: 1, attributePractice: 'shooting', energy: -3 } },
] as const

const STARTS = [2, 16, 30]
export function isStoryWeek(week: number): boolean { return STARTS.some(start => [start, start + 3, start + 9].includes(week)) }

export function weeklyStoryDecision(player: Player, season: number, week: number): Decision | null {
  const slot = STARTS.findIndex(start => [start, start + 3, start + 9].includes(week))
  if (slot < 0) return null
  const story = STORIES[((season - 1) % 2) * 3 + slot]
  const key = `${season}:${story.key}`
  const previous = player.weeklyStories?.[key]
  const beat = (week === STARTS[slot] ? 1 : week === STARTS[slot] + 3 ? 2 : 3) as 1 | 2 | 3
  if (beat > 1 && (!previous || previous.beat !== beat - 1)) return null
  const path = previous?.path
  const situation = beat === 1 ? story.start : beat === 2 ? story.follow : story.end
  const options: DecisionOption[] = (['help', 'focus'] as const).map(route => {
    const base: OutcomeEffect = route === 'help' ? story.helpEffect : story.focusEffect
    const continued = beat === 3 && route === path
    return { id: crypto.randomUUID(), label: route === 'help' ? story.help : story.focus,
      hint: beat === 3 ? continued ? 'See this through' : 'Choose a different ending' : beat === 2 && route === path ? 'Continue your approach' : undefined,
      successChance: 1,
      onSuccess: { ...base, ...(continued ? { confidence: 1, reputation: 1 } : {}), storyChoice: { key, path: route, beat },
        narrative: beat === 3 ? continued ? 'Your earlier choices shaped this outcome. The people involved remember you followed through.' : 'You changed course. The people involved noticed, and the story closes here.' : 'Your choice carries into the next chapter.' },
    }
  })
  return { id: crypto.randomUUID(), context: 'event', situation: `${situation}${beat > 1 ? ` You previously chose to ${path === 'help' ? story.help.toLowerCase() : story.focus.toLowerCase()}.` : ''}`,
    meta: `STORY · ${beat} OF 3`, options }
}
