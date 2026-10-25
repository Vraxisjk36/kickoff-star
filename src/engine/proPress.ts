/** Deterministic Phase 3 press moments; no random or time-based side effects. */
export type PressChoice = 'humble' | 'confident' | 'controversial'
export interface PressMoment {
  id: string
  headline: string
  question: string
  context: string
}
export interface PressHistory {
  id: string
  choice: PressChoice
  headline: string
  consequence: string
}
export const pressMomentForSeason = (season: number, week: number, clubName: string, goals: number): PressMoment | null => {
  if (week !== 8 && week !== 22 && week !== 38) return null
  const subject = week === 8 ? 'your place in the squad' : week === 22 ? 'the transfer rumours' : 'the season run-in'
  return {
    id: `press:${season}:${week}`,
    headline: week === 8 ? 'THE FIRST BIG INTERVIEW' : week === 22 ? 'TRANSFER TALK HEATS UP' : 'THE FINAL RUN-IN',
    question: week === 8 ? `How confident are you about your role at ${clubName}?` :
      week === 22 ? 'Reports suggest other clubs are interested. Are you committed to your current team?' :
      `With ${goals} league goals this season, what are your ambitions for the final matches?`,
    context: `Journalists are asking about ${subject}. Your response will affect your reputation and relationships.`,
  }
}
export function resolvePressChoice(moment: PressMoment, choice: PressChoice): {
  reputationDelta: number; trustDelta: number; consequence: string; history: PressHistory
} {
  const outcome = choice === 'humble'
    ? { reputationDelta: 1, trustDelta: 3, consequence: 'Your measured response earns respect in the dressing room.' }
    : choice === 'confident'
      ? { reputationDelta: 3, trustDelta: 0, consequence: 'Your ambition excites supporters and raises expectations.' }
      : { reputationDelta: 5, trustDelta: -6, consequence: 'The headlines explode, but the manager questions your judgement.' }
  return { ...outcome, history: { id: moment.id, choice, headline: moment.headline, consequence: outcome.consequence } }
}
