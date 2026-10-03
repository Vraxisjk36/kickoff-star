import type { Player } from '../types/player'

export type SeasonObjectiveKind = 'appearances' | 'goals' | 'assists' | 'saves' | 'cleanSheets' | 'tackles' | 'interceptions' | 'keyPasses' | 'averageRating'

export interface SeasonObjective {
  kind: SeasonObjectiveKind
  title: string
  target: number
  minMatches?: number
}

export interface SeasonObjectives {
  seasonYear: number
  objectives: [SeasonObjective, SeasonObjective, SeasonObjective, SeasonObjective]
  baseline: { appearances: number; goals: number; assists: number; saves: number; cleanSheets: number; tackles: number; interceptions: number; keyPasses: number; ratings: number }
}

const count = (kind: SeasonObjectiveKind, title: string, target: number): SeasonObjective => ({ kind, title, target })

/** Four coach goals for the entire season. No objective changes squad selection. */
export function createSeasonObjectives(player: Player, seasonYear: number, weekNumber = 1): SeasonObjectives {
  // Existing careers first receiving this feature midway through a season get
  // targets proportional to the time still available. New seasons use full targets.
  const fraction = Math.max(0.25, Math.min(1, (45 - weekNumber) / 40))
  const target = (n: number) => Math.max(1, Math.round(n * fraction))
  const appearances = count('appearances', 'Play regularly', target(10))
  const average: SeasonObjective = { kind: 'averageRating', title: 'Finish with a solid match rating', target: 6.5, minMatches: target(8) }
  let specialist: [SeasonObjective, SeasonObjective]
  switch (player.position) {
    case 'GK': specialist = [count('saves', 'Make key saves', target(14)), count('cleanSheets', 'Keep clean sheets', target(3))]; break
    case 'CB': specialist = [count('tackles', 'Win tackles', target(8)), count('interceptions', 'Read and intercept play', target(7))]; break
    case 'FB': specialist = [count('tackles', 'Win tackles', target(8)), count('interceptions', 'Read and intercept play', target(6))]; break
    case 'CM': specialist = [count('keyPasses', 'Create chances', target(6)), count('assists', 'Set up goals', target(2))]; break
    case 'WM':
    case 'WG': specialist = [count('goals', 'Score goals', target(3)), count('assists', 'Set up goals', target(2))]; break
    case 'ST': specialist = [count('goals', 'Score goals', target(6)), count('assists', 'Set up goals', target(2))]; break
  }
  const career = player.career
  return {
    seasonYear,
    objectives: [appearances, ...specialist, average],
    baseline: {
      appearances: career?.appearances ?? 0, goals: career?.goals ?? 0, assists: career?.assists ?? 0,
      saves: career?.saves ?? 0, cleanSheets: career?.cleanSheets ?? 0, tackles: career?.tacklesWon ?? 0,
      interceptions: career?.interceptions ?? 0, keyPasses: career?.keyPasses ?? 0,
      ratings: player.seasonRatings?.length ?? 0,
    },
  }
}

export function objectiveProgress(plan: SeasonObjectives, objective: SeasonObjective, player: Player): { value: number; met: boolean; label: string } {
  const career = player.career
  if (objective.kind === 'averageRating') {
    const ratings = (player.seasonRatings ?? []).slice(plan.baseline.ratings)
    const average = ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0
    return { value: average, met: ratings.length >= (objective.minMatches ?? 1) && average >= objective.target,
      label: `${ratings.length}/${objective.minMatches ?? 1} matches · ${ratings.length ? average.toFixed(1) : '—'} average / ${objective.target.toFixed(1)}` }
  }
  const totals: Record<Exclude<SeasonObjectiveKind, 'averageRating'>, number> = {
    appearances: career?.appearances ?? 0, goals: career?.goals ?? 0, assists: career?.assists ?? 0,
    saves: career?.saves ?? 0, cleanSheets: career?.cleanSheets ?? 0, tackles: career?.tacklesWon ?? 0,
    interceptions: career?.interceptions ?? 0, keyPasses: career?.keyPasses ?? 0,
  }
  const value = Math.max(0, totals[objective.kind] - plan.baseline[objective.kind])
  return { value, met: value >= objective.target, label: `${Math.min(value, objective.target)}/${objective.target}` }
}

export function completedSeasonObjectives(plan: SeasonObjectives, player: Player): number {
  return plan.objectives.filter(objective => objectiveProgress(plan, objective, player).met).length
}

export function seasonObjectivesBrief(plan: SeasonObjectives): string {
  return plan.objectives.map(objective => objective.kind === 'averageRating'
    ? `${objective.title}: ${objective.target.toFixed(1)} over ${objective.minMatches} matches`
    : `${objective.title}: ${objective.target}`).join(' · ')
}
