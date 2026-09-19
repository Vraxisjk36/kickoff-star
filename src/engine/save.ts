import { get, set, del } from 'idb-keyval'
import type { Player } from '../types/player'
import type { CalendarState } from '../types/calendar'
import type { LeagueWorld } from './league'
import type { AcademyWorld } from './academy'
import type { CupWorld } from './cup'
import type { InternationalWorld } from './international'
import type { TrainingSession } from './training'
import type { TrainingIntensity } from './energy'
import type { YouthWorld } from '../types/youthWorld'
import { assessLegacyRoute, type LegacyRouteChoice } from './youthSaveV5'

// Locked scope: local-only save data (IndexedDB), 3 save slots per device.
//
// SCHEMA VERSIONING (audit blocker fix): every save now carries schemaVersion
// so future shape changes migrate instead of silently corrupting careers.
//  v1 (implicit, no version field): player/calendar/league/academyLeague only
//  v2: + schemaVersion, cup worlds, international world
//  v3: + pendingTraining — P53 real bug: a training session's progress
//      (which drill you're on, XP earned so far) lived ONLY in local React
//      component state, never saved. A confirmed real playtest report: mid
//      training session on a phone, playing through itch's iframe embed,
//      the game reloaded (mobile browsers are far more prone to backgrounding
//      an iframe than a desktop tab) and the whole session silently restarted
//      from the first drill, wiping real progress with no warning. Now
//      checkpointed after every completed drill so a reload resumes instead
//      of restarting.
export const SAVE_SCHEMA_VERSION = 5

export type SaveSlotId = 0 | 1 | 2

export interface CupWorlds {
  schoolCup: CupWorld | null
  sundayCup: CupWorld | null
  academyLeagueCup: CupWorld | null
  academyKnockoutCup: CupWorld | null
}

export const EMPTY_CUPS: CupWorlds = { schoolCup: null, sundayCup: null, academyLeagueCup: null, academyKnockoutCup: null }

export interface PendingTrainingSnapshot {
  session: TrainingSession
  xpEarned: number
  energySpent: number
  intensity: TrainingIntensity
}

export interface SaveGame {
  schemaVersion: number
  slotId: SaveSlotId
  savedAt: string // ISO timestamp
  player: Player
  calendar: CalendarState
  league: LeagueWorld | null
  academyLeague: AcademyWorld | null
  cups: CupWorlds
  international: InternationalWorld | null
  pendingTraining: PendingTrainingSnapshot | null
  /** V4 persistent generated youth-football world. Null for pre-V4 saves until initialized. */
  youthWorld: YouthWorld | null
  /** V5 integrated systems persisted with the career. */
  youthV5: YouthV5Runtime
}

export interface YouthV5Runtime {
  gazetteStories: import('./gazetteV4').GazetteStory[]
  regionalCamp: import('./regionalSelectionV4').RegionalCamp | null
  nationalPathway: import('./nationalPathwayV4').NationalSelection | null
  festival: import('./youthFestivalV5').FestivalState | null
  octoberCompetition: import('./youthFestivalV5').OctoberLeagueState | null
  grassrootsContract: import('./grassrootsContractsV5').GrassrootsContract | null
  scholarshipWindow: import('./schoolScholarshipsV5').ScholarshipWindow | null
  youthOffers: import('./youthAcademyV4').AcademyOfferV4[]
  academyNegotiation: import('./academyNegotiationV4').AcademyNegotiation | null
  academySeason: import('./academyCareerV4').AcademySeason | null
  careerSummary: import('./careerEndV4').CareerSummary | null
}
export const EMPTY_YOUTH_V5:YouthV5Runtime={gazetteStories:[],regionalCamp:null,nationalPathway:null,festival:null,octoberCompetition:null,grassrootsContract:null,scholarshipWindow:null,youthOffers:[],academyNegotiation:null,academySeason:null,careerSummary:null}

const slotKey = (slot: SaveSlotId) => `kickoff-star-save-${slot}`

// Bring any older on-disk shape up to the current schema. v1 saves predate
// cups/internationals — they get empty worlds, which the store lazily
// initializes on the next week tick (batch-sim self-heal covers the missed rounds).
function migrateSave(raw: SaveGame & { schemaVersion?: number }): SaveGame {
  if (!raw.schemaVersion || raw.schemaVersion < 2) {
    return {
      ...raw,
      schemaVersion: SAVE_SCHEMA_VERSION,
      cups: (raw as SaveGame).cups ?? { ...EMPTY_CUPS },
      international: (raw as SaveGame).international ?? null,
      pendingTraining: null,
      youthWorld: null,
      youthV5: { ...EMPTY_YOUTH_V5 },
    }
  }
  if (raw.schemaVersion < 3) {
    return { ...raw, schemaVersion: SAVE_SCHEMA_VERSION, pendingTraining: null, youthWorld: null, youthV5:{...EMPTY_YOUTH_V5} }
  }
  if (raw.schemaVersion < 4) {
    return { ...raw, schemaVersion: SAVE_SCHEMA_VERSION, youthWorld: null, youthV5:{...EMPTY_YOUTH_V5} }
  }
  if(raw.schemaVersion < 5)return { ...raw, schemaVersion:SAVE_SCHEMA_VERSION, youthWorld:raw.youthWorld??null, youthV5:{...EMPTY_YOUTH_V5} }
  return { ...raw, youthWorld: raw.youthWorld ?? null, youthV5:raw.youthV5??{...EMPTY_YOUTH_V5} }
}

export async function writeSave(save: SaveGame): Promise<void> {
  await set(slotKey(save.slotId), { ...save, schemaVersion: SAVE_SCHEMA_VERSION })
}

export async function readSave(slot: SaveSlotId, routeChoice?:LegacyRouteChoice): Promise<SaveGame | undefined> {
  const raw = await get(slotKey(slot))
  if(!raw)return undefined
  const assessment=assessLegacyRoute(raw)
  if(assessment.needsRouteChoice&&!routeChoice)throw new Error('V5_ROUTE_CHOICE_REQUIRED')
  if(routeChoice&&raw.youthWorld){raw.youthWorld={...raw.youthWorld,pathway:{...raw.youthWorld.pathway,route:routeChoice,sundayClubId:routeChoice==='school'?null:raw.youthWorld.pathway?.sundayClubId??null}};raw.player={...raw.player,youthRoute:routeChoice}}
  return migrateSave(raw)
}

export async function deleteSave(slot: SaveSlotId): Promise<void> {
  await del(slotKey(slot))
}

export async function listSaves(): Promise<(SaveGame | undefined)[]> {
  return Promise.all([0,1,2].map(async slot=>{try{return await readSave(slot as SaveSlotId)}catch(e){if(e instanceof Error&&e.message==='V5_ROUTE_CHOICE_REQUIRED'){const raw=await get(slotKey(slot as SaveSlotId));return raw as SaveGame}throw e}}))
}
export async function legacyRouteAssessment(slot:SaveSlotId){const raw=await get(slotKey(slot));return raw?assessLegacyRoute(raw):null}
