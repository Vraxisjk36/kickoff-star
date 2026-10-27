/** Persistent national-team selection story; derived from actual squad and caps. */
import type { ProCareerState } from './proCareer'
export interface InternationalCareerMoment {
  id: string
  eyebrow: string
  title: string
  description: string
  detail: string
}
export function nextInternationalCareerMoment(state: ProCareerState): InternationalCareerMoment | null {
  const international = state.international
  if (!international) return null
  const seen = new Set(state.seenMilestones ?? [])
  const pending = international.pending
  if (pending) {
    const debut = international.caps === 0
    const id = debut ? `national-debut:${international.nationId}` : `national-selection:${pending.id}`
    if (!seen.has(id)) {
      return {
        id,
        eyebrow: debut ? 'YOUR COUNTRY CALLS' : 'NATIONAL TEAM SELECTION',
        title: debut ? 'YOUR FIRST SENIOR CALL-UP' : 'THE NATIONAL SHIRT AWAITS',
        description: debut ? 'Years of training and club performances have earned your first senior national-team opportunity.' :
          `You have been selected for ${pending.competition} duty. Every appearance can strengthen your international legacy.`,
        detail: debut ? 'Make your senior debut and begin building caps, international goals and a national-team reputation.' :
          `Career international record: ${international.caps} caps · ${international.goals} goals · ${international.assists} assists.`,
      }
    }
  }
  for (const threshold of [1, 10, 25, 50, 100]) {
    if (international.caps < threshold) continue
    const id = `national-caps:${international.nationId}:${threshold}`
    if (!seen.has(id)) return {
      id, eyebrow: 'INTERNATIONAL LEGACY',
      title: threshold === 1 ? 'A SENIOR INTERNATIONAL' : `${threshold} CAPS FOR YOUR COUNTRY`,
      description: threshold === 1 ? 'Your first international appearance is now part of your career history.' :
        `You have reached ${threshold} senior international appearances.`,
      detail: `International totals: ${international.caps} caps · ${international.goals} goals · ${international.assists} assists.`,
    }
  }
  for (const threshold of [1, 10, 25, 50]) {
    if (international.goals < threshold) continue
    const id = `national-goals:${international.nationId}:${threshold}`
    if (!seen.has(id)) return {
      id, eyebrow: 'INTERNATIONAL GOALSCORER',
      title: threshold === 1 ? 'YOUR FIRST GOAL FOR YOUR COUNTRY' : `${threshold} INTERNATIONAL GOALS`,
      description: `A landmark moment for your national-team career.`,
      detail: `Your international record: ${international.caps} caps · ${international.goals} goals.`,
    }
  }
  return null
}
