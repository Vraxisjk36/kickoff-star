import type { ProClubFinances } from './proClubFinance'

/** Stable IDs are stored in saves; display names can change independently. */
export type ProWorldId = string
export type IsoDate = string

export interface ProAssociation {
  id: ProWorldId
  name: string
  confederation: 'uefa' | 'caf' | 'conmebol' | 'concacaf' | 'afc' | 'ofc'
  currency: string
  /** An association may enter continental qualifiers without a full domestic league. */
  domesticMode: 'full' | 'background'
}

export interface ProClub {
  id: ProWorldId
  associationId: ProWorldId
  /** Missing on older saves and therefore interpreted as the top division. */
  tier?: 1 | 2 | 3 | 4 | 5
  feederGroup?: number
  name: string
  homeCity: string
  stadiumId: ProWorldId
  reputation: number
  finances: ProClubFinances
}

export interface ProPlayer {
  id: ProWorldId
  name: string
  birthDate: IsoDate
  nationalityIds: ProWorldId[]
  position: string
  overall: number
  potential: number
  clubId: ProWorldId | null
  annualWage: number
  shirtNumber: number
  /** Generated academy players enter a senior squad after development. */
  origin?: 'academy' | 'senior' | 'transfer'
  injuredUntil?: IsoDate | null
  careerEndingInjury?: boolean
  retirementChoice?: boolean
  injuryHistory?: ProInjuryRecord[]
}

export interface ProInjuryRecord {
  id: string
  kind: 'hamstring' | 'knee' | 'ankle'
  severity: 'minor' | 'moderate' | 'major'
  date: IsoDate
  until: IsoDate
  daysOut: number
  careerEnding?: boolean
}

export interface ProRetirementRecord { id: string; name: string; clubId: string; date: IsoDate; age: number; finalOverall: number; reason: 'age' | 'injury' | 'player-choice' }
export interface ProLoanRecord { parentClubId: string; borrowingClubId: string; ends: IsoDate; originalWage: number }

export interface ProAcademyProspect {
  id: ProWorldId
  clubId: ProWorldId
  name: string
  birthDate: IsoDate
  nationalityIds: ProWorldId[]
  position: string
  overall: number
  potential: number
  intakeYear: number
}

export interface ProManager {
  id: ProWorldId
  name: string
  clubId: ProWorldId | null
  tacticalStyle: string
  reputation: number
}

export interface ProStadium {
  id: ProWorldId
  name: string
  city: string
  capacity: number
}

export interface ProCompetition {
  id: ProWorldId
  associationId: ProWorldId | null
  kind: 'league' | 'domestic-cup' | 'continental-club' | 'national-team'
  seasonId: string
  entrantIds: ProWorldId[]
  /** League format is frozen for this edition; later editions can change. */
  format: { legs: 1 | 2 | 4; scheduledRounds: number }
  splitScheduled?: boolean
  /** Frozen fictional rules edition; the real association rules remain research pending. */
  tournament?: {
    stage: 'league-phase' | 'groups' | 'knockout'
    round: number
    groupByEntrant?: Record<string, number>
    remainingIds?: string[]
    completed?: boolean
  }
}

export interface ProStandingRow {
  clubId: ProWorldId
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  points: number
}

export interface ProSeasonArchive {
  competitionId: ProWorldId
  seasonId: string
  championId: ProWorldId
  table: ProStandingRow[]
}

export interface ProChampionRecord {
  competitionId: ProWorldId
  seasonId: string
  championId: ProWorldId
}

export interface ProPromotionRecord {
  associationId: string
  seasonId: string
  promotedIds: string[]
  relegatedIds: string[]
  /** Saved final scores, including eliminators and relegation mini-league matches. */
  fixtures: ProFixture[]
}

export interface ProPromotionPlayoff {
  associationId: string
  seasonId: string
  stage: 'eliminator' | 'semifinal' | 'final' | 'mini-league' | 'completed'
  fixtureIds: string[]
  winnerId?: string
  secondWinnerId?: string
  qualifierIds?: string[]
  topFifteenthId?: string
  directPromotedId?: string
}

export interface ProFixture {
  id: ProWorldId
  competitionId: ProWorldId
  kickoffDate: IsoDate
  homeId: ProWorldId
  awayId: ProWorldId
  result?: { homeGoals: number; awayGoals: number }
}

export interface ProWorldEvent {
  id: ProWorldId
  date: IsoDate
  kind: 'match' | 'transfer' | 'contract' | 'award' | 'sponsor' | 'life'
  subjectIds: ProWorldId[]
  details: Record<string, string | number | boolean>
}

/** Persistent pro simulation state; youth saves retain null until entering pro football. */
export interface ProWorldState {
  schemaVersion: 1
  seed: number
  currentDate: IsoDate
  associations: Record<ProWorldId, ProAssociation>
  clubs: Record<ProWorldId, ProClub>
  players: Record<ProWorldId, ProPlayer>
  academyProspects: Record<ProWorldId, ProAcademyProspect>
  retirementCount: number
  academyGraduateCount: number
  transferIntakeCount: number
  retirementHistory: ProRetirementRecord[]
  loans: Record<string, ProLoanRecord>
  managers: Record<ProWorldId, ProManager>
  stadiums: Record<ProWorldId, ProStadium>
  competitions: Record<ProWorldId, ProCompetition>
  fixtures: Record<ProWorldId, ProFixture>
  standings: Record<ProWorldId, ProStandingRow[]>
  seasonHistory: ProSeasonArchive[]
  championHistory: ProChampionRecord[]
  promotionHistory?: ProPromotionRecord[]
  promotionPlayoffs?: Record<string, ProPromotionPlayoff>
  /** Keep a bounded hot log; season archives will be stored separately. */
  recentEvents: ProWorldEvent[]
  /** European national-competition divisions; restored with the world save. */
  nationsTier?: Record<string, number>
  concacafNationsTier?: Record<string, number>
}

export function createEmptyProWorld(currentDate: IsoDate, seed = 1): ProWorldState {
  const parsed = new Date(`${currentDate}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(currentDate) || Number.isNaN(parsed.valueOf()) ||
      parsed.toISOString().slice(0, 10) !== currentDate)
    throw new Error('Expected an ISO calendar date')
  if (!Number.isSafeInteger(seed)) throw new Error('Expected a numeric world seed')
  return { schemaVersion: 1, seed, currentDate, associations: {}, clubs: {}, players: {}, academyProspects: {}, retirementCount: 0, academyGraduateCount: 0, transferIntakeCount: 0, retirementHistory: [], loans: {}, managers: {},
    stadiums: {}, competitions: {}, fixtures: {}, standings: {}, seasonHistory: [], championHistory: [], recentEvents: [] }
}
