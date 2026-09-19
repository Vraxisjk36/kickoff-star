import type { Position } from './attributes'

export type SchoolSquadTier = 'first-team' | 'reserve' | 'development' | 'cut'
export type FirstTeamRole = 'starter' | 'rotation' | 'bench'
export type RepresentativeLevel = 'none' | 'regional-longlist' | 'regional-squad' | 'national-longlist' | 'national-squad'
export type YouthRoute = 'school' | 'grassroots' | 'academy'

export interface YouthSchool {
  id: string
  name: string
  districtId: string
  colours: [string, string]
  prestige: number
  footballRating: number
  coaching: number
  facilities: number
  youthDevelopment: number
  scoutExposure: number
  style: 'possession' | 'direct' | 'counter' | 'pressing' | 'balanced'
  rivalId: string | null
  intakeStrength: number
}

export interface YouthNpcPlayer {
  id: string
  name: string
  age: number
  position: Position
  overall: number
  potentialBand: 'low' | 'normal' | 'high' | 'elite'
  form: number
  energy: number
  squadTier: Exclude<SchoolSquadTier, 'cut'>
}

export interface YouthSchoolSquads {
  firstTeam: YouthNpcPlayer[]
  reserve: YouthNpcPlayer[]
  development: YouthNpcPlayer[]
}

export interface SundayLeagueClub {
  id: string
  name: string
  districtId: string
  strength: number
  coaching: number
  exposure: number
  pathwayFocus: 'minutes' | 'development' | 'results'
  transportSupport: 'none' | 'partial' | 'full'
}

export type CompetitionKind =
  | 'friendly'
  | 'school-league'
  | 'school-cup'
  | 'reserve-league'
  | 'minor-school-cup'
  | 'sunday-league'
  | 'sunday-cup'
  | 'regional-selection'
  | 'national-championship'
  | 'showcase'
  | 'academy-trial'

export interface YouthCompetition {
  id: string
  name: string
  kind: CompetitionKind
  prestige: number
  monthStart: number
  monthEnd: number
  matchDay: 'thursday' | 'saturday' | 'sunday' | 'mixed'
  eligibleSquads: SchoolSquadTier[]
  format:
    | { type: 'friendlies'; targetMatches: number }
    | { type: 'league'; teams: number; rounds: number }
    | { type: 'groups-knockout'; teams: number; groups: number; groupSize: number; qualifyPerGroup: number }
    | { type: 'knockout'; teams: number }
    | { type: 'selection'; longlist: number; camp: number; finalSquad: number }
    | { type: 'showcase'; matches: number }
    | { type: 'trial'; sessions: number }
}

export interface YouthCalendarBlock {
  id: string
  weeks: [number, number]
  month: number
  title: string
  primary: CompetitionKind | 'training' | 'off-season'
  schoolMatchDay?: 'thursday' | 'saturday'
  sundayLeagueAvailable: boolean
  notes: string
}

export interface ExposureState {
  school: number
  grassroots: number
  regional: number
  academy: number
}

export interface SundayApproach {
  id: string
  clubId: string
  kind: 'training-invite' | 'trial-invite' | 'squad-offer' | 'tournament-invite'
  week: number
  expiresWeek: number
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  reason: string
}

export interface PathwayHistoryEntry {
  week: number
  type: 'trial' | 'promotion' | 'demotion' | 'cut' | 'sunday-approach' | 'representative' | 'academy'
  title: string
  detail: string
}

export interface YouthPathwayState {
  route: YouthRoute
  schoolTier: SchoolSquadTier
  firstTeamRole: FirstTeamRole | null
  schoolTierSinceWeek: number
  sundayClubId: string | null
  representative: RepresentativeLevel
  academyStatus: 'none' | 'monitored' | 'trial-invited' | 'trialling' | 'academy'
  exposure: ExposureState
  selectionScore: number
  pendingSundayApproaches: SundayApproach[]
  history: PathwayHistoryEntry[]
}

export interface AcademyClub {
  id: string
  name: string
  region: string
  prestige: number
  coaching: number
  facilities: number
  positionNeeds: Partial<Record<Position, number>>
}

export interface AcademyScoutInterest {
  clubId: string
  awareness: number
  interest: number
  lastSeenWeek: number | null
  matchesSeen: number
  status: 'unknown' | 'aware' | 'monitoring' | 'watchlist' | 'trial-ready'
}

export interface YouthScoutingProfile {
  localVisibility: number
  schoolReputation: number
  grassrootsReputation: number
  regionalReputation: number
  academyExposure: number
  academyInterest: Record<string, AcademyScoutInterest>
  knownScoutVisits: { week: number; clubId: string; competition: CompetitionKind; reason: string }[]
}

export interface CompetitionTeamEntry {
  id: string
  name: string
  strength: number
  source: 'school' | 'sunday' | 'representative'
}

export interface CompetitionFixture {
  id: string
  competitionId: string
  round: number
  stage: 'league' | 'group' | 'quarter-final' | 'semi-final' | 'final'
  groupId?: string
  homeTeamId: string
  awayTeamId: string
  played: boolean
  homeGoals?: number
  awayGoals?: number
  winnerId?: string | null
}

export interface CompetitionStanding {
  teamId: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
}

export interface LeagueCompetitionState {
  id: string
  kind: 'league'
  teams: CompetitionTeamEntry[]
  fixtures: CompetitionFixture[]
  standings: CompetitionStanding[]
  currentRound: number
  complete: boolean
}

export interface GroupCompetitionState {
  id: string
  kind: 'groups-knockout'
  teams: CompetitionTeamEntry[]
  groups: Record<string, string[]>
  fixtures: CompetitionFixture[]
  standings: Record<string, CompetitionStanding[]>
  currentRound: number
  stage: 'groups' | 'quarter-final' | 'semi-final' | 'final' | 'complete'
  qualifiedTeamIds: string[]
  eliminatedTeamIds: string[]
  championId: string | null
}

export interface KnockoutCompetitionState {
  id: string
  kind: 'knockout'
  teams: CompetitionTeamEntry[]
  fixtures: CompetitionFixture[]
  currentRound: number
  stage: 'quarter-final' | 'semi-final' | 'final' | 'complete'
  eliminatedTeamIds: string[]
  championId: string | null
}

export interface YouthCompetitionStatLine {playerId:string;name:string;teamId:string;position:Position;apps:number;starts:number;minutes:number;goals:number;assists:number;cleanSheets:number;saves:number;tackles:number;keyPasses:number;ratingTotal:number;potm:number}
export interface YouthCompetitionStatBook {competitionId:string;players:Record<string,YouthCompetitionStatLine>}

export interface YouthCompetitionWorld {
  interSchools: LeagueCompetitionState | null
  reserveLeague: LeagueCompetitionState | null
  regionalSchools: GroupCompetitionState | null
  minorSchoolCup: KnockoutCompetitionState | null
  sundayLeague: LeagueCompetitionState | null
  nationalChampionship: GroupCompetitionState | null
  statBooks: Record<string, YouthCompetitionStatBook>
}

export interface FinanceTransaction {
  id: string
  week: number
  amount: number
  category: 'allowance' | 'odd-job' | 'transport' | 'food' | 'recovery' | 'equipment' | 'club-support' | 'match-allowance' | 'academy-support' | 'showcase' | 'trial' | 'other'
  description: string
}

export interface YouthFinanceState {
  balance: number
  familySupportLevel: 'limited' | 'normal' | 'strong'
  familyAllowancePerMonth: number
  lastAllowanceWeek: number
  transportPass: boolean
  transportPasses: number
  recoveryCredits: number
  bootsCondition: number
  weeklyPersonalBudget: number
  totalEarned: number
  totalSpent: number
  transactions: FinanceTransaction[]
}

export interface YouthWorld {
  version: 1
  seed: string
  seasonYear: number
  currentWeek: number
  selectedSchoolId: string | null
  districts: { id: string; name: string }[]
  schools: YouthSchool[]
  schoolSquads: Record<string, YouthSchoolSquads>
  sundayClubs: SundayLeagueClub[]
  academyClubs: AcademyClub[]
  scouting: YouthScoutingProfile
  competitionWorld: YouthCompetitionWorld
  finances: YouthFinanceState
  competitions: YouthCompetition[]
  calendar: YouthCalendarBlock[]
  pathway: YouthPathwayState
}
