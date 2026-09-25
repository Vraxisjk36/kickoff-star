// V4 Youth World — the career-facing competition layer.
//
// league.ts/cup.ts/international.ts remain the authorities for fixtures and
// results. This module gives every one of those engines a shared identity,
// eligibility rules, prestige, player statistics, discipline and an archive.
// Presentation code can now read one stable model instead of reverse-engineering
// five unrelated world shapes.

export type CompetitionFormat = 'league' | 'group-knockout' | 'knockout' | 'friendly' | 'selection'
export type CompetitionCategory = 'school' | 'sunday' | 'grassroots' | 'academy' | 'international' | 'selection'
export type CompetitionLevel = 'local' | 'regional' | 'national' | 'international'

export interface EligibilityRules {
  minAge?: number
  maxAge?: number
  schoolRegistered?: boolean
  academyPlayersAllowed?: boolean
  requiresInjuryClearance?: boolean
}

export interface CompetitionDefinition {
  id: string
  name: string
  format: CompetitionFormat
  category: CompetitionCategory
  level: CompetitionLevel
  prestige: number // 0..100; used by scouting, awards and future presentation
  eligibility: EligibilityRules
  yellowCardsForBan: number
}

export const COMPETITION_DEFINITIONS: Record<string, CompetitionDefinition> = {
  schoolLeague: { id: 'schoolLeague', name: 'Local School League', format: 'league', category: 'school', level: 'local', prestige: 25, eligibility: { minAge: 14, maxAge: 18, schoolRegistered: true, academyPlayersAllowed: false, requiresInjuryClearance: true }, yellowCardsForBan: 3 },
  schoolReserveLeague: { id: 'schoolReserveLeague', name: 'School Reserve League', format: 'league', category: 'school', level: 'local', prestige: 18, eligibility: { minAge: 14, maxAge: 18, schoolRegistered: true, academyPlayersAllowed: false, requiresInjuryClearance: true }, yellowCardsForBan: 3 },
  schoolDevelopmentLeague: { id: 'schoolDevelopmentLeague', name: 'School Development Fixtures', format: 'friendly', category: 'school', level: 'local', prestige: 12, eligibility: { minAge: 14, maxAge: 18, schoolRegistered: true, academyPlayersAllowed: false, requiresInjuryClearance: true }, yellowCardsForBan: 3 },
  sundayLeague: { id: 'sundayLeague', name: 'Sunday League', format: 'league', category: 'sunday', level: 'local', prestige: 20, eligibility: { minAge: 14, maxAge: 18, academyPlayersAllowed: false, requiresInjuryClearance: true }, yellowCardsForBan: 3 },
  sundayCommunity: { id: 'sundayCommunity', name: 'Community Sunday Football', format: 'friendly', category: 'sunday', level: 'local', prestige: 22, eligibility: { minAge: 14, maxAge: 18, academyPlayersAllowed: false, requiresInjuryClearance: true }, yellowCardsForBan: 3 },
  academyLeague: { id: 'academyLeague', name: 'Academy League', format: 'league', category: 'academy', level: 'national', prestige: 60, eligibility: { minAge: 15, maxAge: 19, academyPlayersAllowed: true, requiresInjuryClearance: true }, yellowCardsForBan: 3 },
  schoolFriendlies: { id: 'schoolFriendlies', name: 'School Friendlies', format: 'friendly', category: 'school', level: 'local', prestige: 15, eligibility: { minAge: 14, maxAge: 18, schoolRegistered: true, academyPlayersAllowed: false, requiresInjuryClearance: true }, yellowCardsForBan: 3 },
  schoolCup: { id: 'schoolCup', name: 'Regional Schools Cup', format: 'group-knockout', category: 'school', level: 'regional', prestige: 48, eligibility: { minAge: 14, maxAge: 18, schoolRegistered: true, academyPlayersAllowed: false, requiresInjuryClearance: true }, yellowCardsForBan: 3 },
  nationalChampionship: { id: 'nationalChampionship', name: 'National Schools Championship', format: 'group-knockout', category: 'selection', level: 'national', prestige: 72, eligibility: { minAge: 14, maxAge: 18, schoolRegistered: true, academyPlayersAllowed: false, requiresInjuryClearance: true }, yellowCardsForBan: 2 },
  regionalSelection: { id: 'regionalSelection', name: 'Regional XI Selection', format: 'selection', category: 'selection', level: 'regional', prestige: 55, eligibility: { minAge: 14, maxAge: 18, schoolRegistered: true, requiresInjuryClearance: true }, yellowCardsForBan: 3 },
  nationalSelection: { id: 'nationalSelection', name: 'National Schools Selection', format: 'selection', category: 'selection', level: 'national', prestige: 78, eligibility: { minAge: 14, maxAge: 18, schoolRegistered: true, requiresInjuryClearance: true }, yellowCardsForBan: 3 },
  youthShowcase: { id: 'youthShowcase', name: 'Youth Showcase', format: 'friendly', category: 'selection', level: 'national', prestige: 68, eligibility: { minAge: 16, maxAge: 18, requiresInjuryClearance: true }, yellowCardsForBan: 3 },
  octoberDevelopment: { id: 'octoberDevelopment', name: 'October Development Series', format: 'league', category: 'grassroots', level: 'local', prestige: 28, eligibility: { minAge: 14, maxAge: 15, academyPlayersAllowed: false, requiresInjuryClearance: true }, yellowCardsForBan: 3 },
  sundayCup: { id: 'sundayCup', name: 'Sunday Cup', format: 'knockout', category: 'sunday', level: 'local', prestige: 30, eligibility: { minAge: 14, maxAge: 18, academyPlayersAllowed: false, requiresInjuryClearance: true }, yellowCardsForBan: 2 },
  academyLeagueCup: { id: 'academyLeagueCup', name: 'U18 Premier Cup', format: 'group-knockout', category: 'academy', level: 'national', prestige: 65, eligibility: { minAge: 15, maxAge: 19, academyPlayersAllowed: true, requiresInjuryClearance: true }, yellowCardsForBan: 3 },
  academyKnockoutCup: { id: 'academyKnockoutCup', name: 'Youth Cup', format: 'knockout', category: 'academy', level: 'national', prestige: 70, eligibility: { minAge: 15, maxAge: 19, academyPlayersAllowed: true, requiresInjuryClearance: true }, yellowCardsForBan: 2 },
  international: { id: 'international', name: 'International Youth Cup', format: 'group-knockout', category: 'international', level: 'international', prestige: 90, eligibility: { minAge: 15, maxAge: 19, academyPlayersAllowed: true, requiresInjuryClearance: true }, yellowCardsForBan: 2 },
  schoolTrials: { id: 'schoolTrials', name: 'School Trials', format: 'selection', category: 'selection', level: 'local', prestige: 25, eligibility: { minAge: 14, maxAge: 18, schoolRegistered: true, requiresInjuryClearance: true }, yellowCardsForBan: 3 },
  academyTrials: { id: 'academyTrials', name: 'Academy Trials', format: 'selection', category: 'selection', level: 'regional', prestige: 55, eligibility: { minAge: 16, maxAge: 19, requiresInjuryClearance: true }, yellowCardsForBan: 3 },
}

const FALLBACK_COMPETITION: CompetitionDefinition = {
  id: 'other', name: 'Other Competition', format: 'friendly', category: 'grassroots', level: 'local', prestige: 20,
  eligibility: { minAge: 14, maxAge: 19, requiresInjuryClearance: true }, yellowCardsForBan: 3,
}

export function competitionDefinition(id: string): CompetitionDefinition {
  return COMPETITION_DEFINITIONS[id] ?? { ...FALLBACK_COMPETITION, id }
}

export interface CompetitionPlayerStats {
  competitionId: string
  season: number
  appearances: number
  starts: number
  minutes: number
  goals: number
  assists: number
  cleanSheets: number
  ratingTotal: number
  averageRating: number
  yellowCards: number
  redCards: number
  playerOfMatchAwards: number
}

export interface CompetitionDiscipline {
  yellowCards: number
  redCards: number
  suspensionMatches: number
}

export interface CompetitionAward {
  competitionId: string
  season: number
  kind: 'golden-boot' | 'top-assist-provider' | 'best-goalkeeper' | 'player-of-tournament' | 'best-young-player' | 'best-xi'
}

export interface CompetitionArchiveEntry extends CompetitionPlayerStats {
  competitionName: string
  prestige: number
  outcome: string
  awards: CompetitionAward['kind'][]
}

export interface QualificationRecord {
  competitionId: string
  qualifiedFor: string
  season: number
  reason: 'league-position' | 'cup-result' | 'selection' | 'host'
  position?: number
}

export interface SelectionRecord {
  competitionId: string
  season: number
  round: number
  entrants: number
  survivors: number
  score: number
  outcome: 'advanced' | 'selected' | 'cut'
}

export interface CompetitionCareerState {
  current: Record<string, CompetitionPlayerStats>
  discipline: Record<string, CompetitionDiscipline>
  history: CompetitionArchiveEntry[]
  awards: CompetitionAward[]
  qualifications: QualificationRecord[]
  selections: SelectionRecord[]
}

export function initCompetitionCareer(): CompetitionCareerState {
  return { current: {}, discipline: {}, history: [], awards: [], qualifications: [], selections: [] }
}

export interface MatchCompetitionInput {
  competitionId: string
  season: number
  started: boolean
  minutes: number
  rating: number
  goals: number
  assists: number
  cleanSheet: boolean
  yellowCarded?: boolean
  redCarded?: boolean
  playerOfMatch?: boolean
}

function emptyStats(competitionId: string, season: number): CompetitionPlayerStats {
  return { competitionId, season, appearances: 0, starts: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0, ratingTotal: 0, averageRating: 0, yellowCards: 0, redCards: 0, playerOfMatchAwards: 0 }
}

export function recordCompetitionMatch(state: CompetitionCareerState | undefined, input: MatchCompetitionInput): CompetitionCareerState {
  const base = state ?? initCompetitionCareer()
  const prev = base.current[input.competitionId] ?? emptyStats(input.competitionId, input.season)
  const appearances = prev.appearances + 1
  const ratingTotal = prev.ratingTotal + input.rating
  const nextStats: CompetitionPlayerStats = {
    ...prev,
    season: input.season,
    appearances,
    starts: prev.starts + (input.started ? 1 : 0),
    minutes: prev.minutes + Math.max(0, Math.round(input.minutes)),
    goals: prev.goals + input.goals,
    assists: prev.assists + input.assists,
    cleanSheets: prev.cleanSheets + (input.cleanSheet ? 1 : 0),
    ratingTotal,
    averageRating: Math.round((ratingTotal / appearances) * 100) / 100,
    yellowCards: prev.yellowCards + (input.yellowCarded ? 1 : 0),
    redCards: prev.redCards + (input.redCarded ? 1 : 0),
    playerOfMatchAwards: prev.playerOfMatchAwards + (input.playerOfMatch ? 1 : 0),
  }

  const rule = competitionDefinition(input.competitionId)
  const oldDiscipline = base.discipline[input.competitionId] ?? { yellowCards: 0, redCards: 0, suspensionMatches: 0 }
  const yellows = oldDiscipline.yellowCards + (input.yellowCarded ? 1 : 0)
  const crossedYellowBan = input.yellowCarded && yellows > 0 && yellows % rule.yellowCardsForBan === 0
  const nextDiscipline: CompetitionDiscipline = {
    yellowCards: yellows,
    redCards: oldDiscipline.redCards + (input.redCarded ? 1 : 0),
    suspensionMatches: oldDiscipline.suspensionMatches + (input.redCarded ? 1 : 0) + (crossedYellowBan ? 1 : 0),
  }

  return {
    ...base,
    current: { ...base.current, [input.competitionId]: nextStats },
    discipline: { ...base.discipline, [input.competitionId]: nextDiscipline },
  }
}

export function serveCompetitionSuspension(state: CompetitionCareerState | undefined, competitionId: string): CompetitionCareerState {
  const base = state ?? initCompetitionCareer()
  const discipline = base.discipline[competitionId]
  if (!discipline?.suspensionMatches) return base
  return { ...base, discipline: { ...base.discipline, [competitionId]: { ...discipline, suspensionMatches: discipline.suspensionMatches - 1 } } }
}

export function isEligible(rules: EligibilityRules, input: { age: number; schoolId?: string | null; isAcademy: boolean; injured: boolean }): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = []
  if (rules.minAge !== undefined && input.age < rules.minAge) reasons.push(`must be at least ${rules.minAge}`)
  if (rules.maxAge !== undefined && input.age > rules.maxAge) reasons.push(`must be ${rules.maxAge} or younger`)
  if (rules.schoolRegistered && !input.schoolId) reasons.push('school registration required')
  if (rules.academyPlayersAllowed === false && input.isAcademy) reasons.push('academy players are not eligible')
  if (rules.requiresInjuryClearance && input.injured) reasons.push('medical clearance required')
  return { eligible: reasons.length === 0, reasons }
}

export function selectionScore(input: { performance: number; attributes: number; coachTrust: number; fitness: number; form: number; mentality: number }): number {
  return input.performance * 0.4 + input.attributes * 0.2 + input.coachTrust * 0.15 + input.fitness * 0.1 + input.form * 0.1 + input.mentality * 0.05
}

export function scoutingPrestigeMultiplier(competitionId: string): number {
  return 0.75 + competitionDefinition(competitionId).prestige / 100
}

function inferredAwards(stats: CompetitionPlayerStats): CompetitionAward['kind'][] {
  const out: CompetitionAward['kind'][] = []
  if (stats.goals >= 6) out.push('golden-boot')
  if (stats.assists >= 5) out.push('top-assist-provider')
  if (stats.cleanSheets >= 5 && stats.averageRating >= 7.1) out.push('best-goalkeeper')
  if (stats.appearances >= 3 && stats.averageRating >= 8) out.push('player-of-tournament')
  else if (stats.appearances >= 5 && stats.averageRating >= 7.35) out.push('best-xi')
  return out
}

export function archiveCompetitionSeason(state: CompetitionCareerState | undefined, season: number, outcomes: Record<string, string> = {}): CompetitionCareerState {
  const base = state ?? initCompetitionCareer()
  const seasonStats = Object.values(base.current).filter((s) => s.season === season && s.appearances > 0)
  const newAwards: CompetitionAward[] = []
  const entries = seasonStats.map((stats) => {
    const def = competitionDefinition(stats.competitionId)
    const awards = inferredAwards(stats)
    for (const kind of awards) newAwards.push({ competitionId: stats.competitionId, season, kind })
    return { ...stats, competitionName: def.name, prestige: def.prestige, outcome: outcomes[stats.competitionId] ?? 'Completed', awards }
  })
  return {
    ...base,
    current: Object.fromEntries(Object.entries(base.current).filter(([, s]) => s.season !== season)),
    history: [...base.history, ...entries].slice(-80),
    awards: [...base.awards, ...newAwards].slice(-120),
    discipline: {}, // cards reset between youth seasons
  }
}

export function addQualification(state: CompetitionCareerState | undefined, record: QualificationRecord): CompetitionCareerState {
  const base = state ?? initCompetitionCareer()
  const duplicate = base.qualifications.some((q) => q.competitionId === record.competitionId && q.qualifiedFor === record.qualifiedFor && q.season === record.season)
  return duplicate ? base : { ...base, qualifications: [...base.qualifications, record].slice(-60) }
}

export function recordSelectionResult(state: CompetitionCareerState | undefined, record: SelectionRecord): CompetitionCareerState {
  const base = state ?? initCompetitionCareer()
  return { ...base, selections: [...(base.selections ?? []), record].slice(-40) }
}
