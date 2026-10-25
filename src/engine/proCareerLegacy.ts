import type { ProCareerState } from './proCareer'
import { worldPlayerAwards } from './proHonours'

export interface CareerLegacyMoment {
  id: string
  eyebrow: string
  title: string
  description: string
  detail: string
}
const targets = [1, 10, 25, 50, 100, 200, 300, 500]
/** Season archives are the source of truth; awards are only earned when the actual
 * deterministic honours algorithm says the player won. */
export function careerLegacyMoments(state: ProCareerState): CareerLegacyMoment[] {
  const records = state.seasonRecords ?? []
  const seen = new Set(state.seenMilestones ?? [])
  const complete = records.reduce((a, r) => ({
    appearances: a.appearances + r.appearances,
    goals: a.goals + r.goals,
    assists: a.assists + r.assists,
    titles: a.titles + Number(r.leagueChampion),
  }), { appearances: 0, goals: 0, assists: 0, titles: 0 })
  const milestones: CareerLegacyMoment[] = []
  for (const [stat, label] of [
    ['appearances', 'PROFESSIONAL APPEARANCES'],
    ['goals', 'CAREER GOALS'],
    ['assists', 'CAREER ASSISTS'],
    ['titles', 'LEAGUE TITLES'],
  ] as const) {
    const levels = stat === 'titles' ? [1, 3, 5, 10] : targets
    for (const level of levels) {
      if (complete[stat] < level) continue
      const id = `legacy:${stat}:${level}`
      if (seen.has(id)) continue
      milestones.push({
        id, eyebrow: 'CAREER LEGACY', title: `${level} ${label}`,
        description: `A landmark achievement across your professional career.`,
        detail: `Career totals: ${complete.appearances} appearances · ${complete.goals} goals · ${complete.assists} assists · ${complete.titles} league titles.`,
      })
    }
  }
  for (const season of records) {
    for (const award of worldPlayerAwards(season)) {
      if (!award.won) continue
      const id = `legacy:award:${season.season}:${award.id}`
      if (seen.has(id)) continue
      milestones.push({
        id, eyebrow: 'TROPHY CABINET', title: award.title.toUpperCase(),
        description: `You earned this honour in season ${season.season} while playing for ${season.clubName}.`,
        detail: award.reason,
      })
    }
  }
  return milestones
}
export function nextCareerLegacyMoment(state: ProCareerState): CareerLegacyMoment | null {
  return careerLegacyMoments(state)[0] ?? null
}
