import { NATIONS, getNation } from './nations'
import type { Player } from '../types/player'
import type { ProCareerState } from './proCareer'

export interface SeniorInternationalFixture {
  id: string
  nationId: string
  opponentId: string
  season: number
  week: number
  home: boolean
  competition: 'friendly' | 'qualifier'
  result?: { scored: number; conceded: number; goals: number; assists: number; rating: number; minutes: number }
}
export interface SeniorInternationalRecord {
  id: string
  nationId: string
  opponentId: string
  season: number
  week: number
  competition: SeniorInternationalFixture['competition']
  home: boolean
  scored: number
  conceded: number
  goals: number
  assists: number
  rating: number
  minutes: number
}
export interface SeniorInternationalCareer {
  nationId: string
  caps: number
  goals: number
  assists: number
  starts: number
  lastSelectionSeason?: number
  fixtures: SeniorInternationalRecord[]
  pending?: SeniorInternationalFixture | null
}
const WINDOWS = [12, 25, 37]
export function internationalCallupEligible(player: Player): boolean {
  if (!player.turnedPro || !player.nationality) return false
  const caps = player.proCareer?.international?.caps ?? 0
  const form = player.matchRatings.slice(-8)
  const average = form.length ? form.reduce((a, b) => a + b, 0) / form.length : 6
  const performances = (player.seasonAppearances ?? 0) + (player.seasonGoals ?? 0) * 2 +
    (player.seasonAssists ?? 0) + (player.reputation ?? 0) * .25 + Math.max(0, average - 6) * 6
  return performances >= 20 || (caps > 0 && performances >= 12)
}
/** Called on each pro week. No rerolling eligibility or opponents when reloading. */
export function scheduleSeniorInternational(state: ProCareerState, player: Player): ProCareerState {
  if (state.retired || !WINDOWS.includes(state.week) ||
      !internationalCallupEligible(player)) return state
  const nationId = player.nationality!
  const nation = getNation(nationId)
  if (nation.id !== nationId) return state
  const international = state.international ?? { nationId, caps: 0, goals: 0, assists: 0, starts: 0, fixtures: [] }
  if (international.pending || international.fixtures.some(f => f.season === state.season && f.week === state.week))
    return state
  const choices = NATIONS.filter(item => item.id !== nationId &&
    Math.abs(item.strength - nation.strength) <= 2)
  const position = (state.season * 17 + state.week * 3 + nationId.charCodeAt(0)) % choices.length
  const opponent = choices[position]
  const pending: SeniorInternationalFixture = {
    id: `senior-int-${nationId}-${state.season}-${state.week}`,
    nationId, opponentId: opponent.id, season: state.season, week: state.week,
    home: (state.season + state.week) % 2 === 0,
    competition: state.week === 25 ? 'qualifier' : 'friendly',
  }
  return { ...state, international: { ...international, pending, lastSelectionSeason: state.season } }
}
export function completeSeniorInternational(state: ProCareerState, player: Player,
  result: { scored: number; conceded: number; goals: number; assists: number; rating: number; minutes: number }):
  { state: ProCareerState; player: Player } | null {
  const international = state.international, pending = international?.pending
  if (!pending || pending.season !== state.season || pending.week !== state.week ||
      pending.nationId !== player.nationality || result.minutes < 0 ||
      ![result.scored, result.conceded, result.goals, result.assists, result.rating, result.minutes]
        .every(Number.isFinite)) return null
  const record: SeniorInternationalRecord = { ...pending, ...result }
  const caps = result.minutes > 0 ? 1 : 0
  const nextInternational: SeniorInternationalCareer = {
    ...international!, pending: null, caps: international!.caps + caps,
    starts: international!.starts + (result.minutes >= 45 ? 1 : 0),
    goals: international!.goals + (caps ? result.goals : 0),
    assists: international!.assists + (caps ? result.assists : 0),
    fixtures: [...international!.fixtures, record].slice(-120),
  }
  const careerByCompetition = player.careerByCompetition
  const internationalStats = careerByCompetition?.international ?? { appearances: 0, goals: 0, assists: 0 }
  return { state: { ...state, international: nextInternational },
    player: { ...player,
      careerByCompetition: careerByCompetition ? { ...careerByCompetition,
        international: { appearances: internationalStats.appearances + caps,
          goals: internationalStats.goals + (caps ? result.goals : 0),
          assists: internationalStats.assists + (caps ? result.assists : 0) } }
        : player.careerByCompetition,
    } }

}
export function forfeitSeniorInternational(state: ProCareerState): ProCareerState {
  const pending = state.international?.pending
  if (!pending) return state
  return { ...state, international: { ...state.international!,
    pending: null, fixtures: [...state.international!.fixtures, {
      ...pending, scored: 0, conceded: 0, goals: 0, assists: 0, rating: 0, minutes: 0,
    }].slice(-120) } }
}
