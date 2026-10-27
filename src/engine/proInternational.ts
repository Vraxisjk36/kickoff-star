import { seniorNation } from './seniorNations'
import { computeCurrentAbility, toOvr } from './rating'
import { selectSeniorNationalSquad, type NationalSquadSelection } from './proNationalSquad'
import { CONTINENTAL_WINDOWS, continentalRound } from './proContinentalNations'
import { INTERNATIONAL_WINDOWS, internationalTournamentFixture, internationalCycle, internationalProgress, type TournamentStage } from './proInternationalTournament'
import type { Player } from '../types/player'
import type { ProCareerState } from './proCareer'

export interface SeniorInternationalFixture {
  id: string
  nationId: string
  opponentId: string
  season: number
  week: number
  home: boolean
  competition: TournamentStage
  squad?: NationalSquadSelection
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
  if (state.retired || !!player.injury?.weeksRemaining || (!INTERNATIONAL_WINDOWS.includes(state.week as typeof INTERNATIONAL_WINDOWS[number]) &&
      !CONTINENTAL_WINDOWS.includes(state.week as typeof CONTINENTAL_WINDOWS[number]))) return state
  const cycle = internationalCycle(state.season)
  const qualifiedFinalist = state.season - cycle >= 2 &&
    (state.international?.caps ?? 0) > 0 && !!player.nationality &&
    internationalProgress(player.nationality, cycle, state.international?.fixtures ?? []).qualified
  if (!internationalCallupEligible(player) && !qualifiedFinalist) return state
  const nationId = player.nationality!
  const nation = seniorNation(nationId)
  if (!nation) return state
  const international = state.international ?? { nationId, caps: 0, goals: 0, assists: 0, starts: 0, fixtures: [] }
  if (international.pending || international.fixtures.some(f => f.season === state.season && f.week === state.week))
    return state
  const isRegionalWindow=CONTINENTAL_WINDOWS.includes(state.week as typeof CONTINENTAL_WINDOWS[number])
  const regionalPair=isRegionalWindow ? continentalRound(nationId,state.season,state.week)
    .find(pair=>pair.homeId===nationId||pair.awayId===nationId) : undefined
  const draw = isRegionalWindow
    ? regionalPair ? { opponentId: regionalPair.homeId===nationId ? regionalPair.awayId : regionalPair.homeId,
        home: regionalPair.homeId===nationId, competition: 'continental' as const } : null
    : internationalTournamentFixture(nationId, state.season, state.week, international.fixtures)
  if (!draw) return state
  const squad = selectSeniorNationalSquad(nationId,state.season,state.week,state.backgroundWorld,player,true)
  // A national call-up is earned, not guaranteed: compare the career player's
  // actual football ability with the available squad in their positional role.
  // Legacy and audit saves can omit attributes; retain the original
  // reputation-based estimate until a complete player is available.
  const playerOvr = player.attributes?.values
    ? toOvr(computeCurrentAbility(player))
    : Math.max(35, Math.min(99, Math.round((player.reputation ?? 55) * .55 + 40)))
  const playerPosition = player.position ?? 'CM'
  const sameRole = (position: string) => position === playerPosition ||
    (playerPosition !== 'GK' && position !== 'GK' && position.slice(0,1) === playerPosition.slice(0,1))
  const rivals = squad.members.filter(member => member.source !== 'career' && sameRole(member.position))
  const selectionFloor = rivals.length ? Math.min(...rivals.map(member => member.overall)) : 55
  if (playerOvr + (qualifiedFinalist ? 3 : 0) < selectionFloor - 3) return state
  const pending: SeniorInternationalFixture = {
    id: `senior-int-${nationId}-${state.season}-${state.week}`,
    nationId, season: state.season, week: state.week, ...draw, squad,
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
  if (result.scored < 0 || result.conceded < 0 || result.goals < 0 || result.assists < 0 ||
      result.goals > result.scored || result.minutes > 120 || result.rating < 0 || result.rating > 10 ||
      (result.minutes === 0 && (result.goals > 0 || result.assists > 0))) return null
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
