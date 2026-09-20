import { get, set, del } from 'idb-keyval'
import type { Player } from '../types/player'
import type { CalendarState } from '../types/calendar'
import type { LeagueWorld } from './league'
import type { AcademyWorld } from './academy'
import type { CupWorld } from './cup'
import type { InternationalWorld } from './international'
import type { TrainingSession } from './training'
import type { TrainingIntensity } from './energy'

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
//  v4: separates school football from the Sunday League fallback route.
//  v5: complete representative pathway + National Schools Championship.
export const SAVE_SCHEMA_VERSION = 7

export type SaveSlotId = 0 | 1 | 2

export interface CupWorlds {
  schoolCup: CupWorld | null
  nationalChampionship: CupWorld | null
  sundayCup: CupWorld | null
  schoolDevelopment: CupWorld | null
  octoberLeague: CupWorld | null
  youthFestival: CupWorld | null
  academyLeagueCup: CupWorld | null
  academyKnockoutCup: CupWorld | null
}

export const EMPTY_CUPS: CupWorlds = { schoolCup:null, nationalChampionship:null, sundayCup:null, schoolDevelopment:null, octoberLeague:null, youthFestival:null, academyLeagueCup:null, academyKnockoutCup:null }

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
  /** Explicit choice required for legacy saves that used School+Sunday simultaneously. */
  legacyRouteMigration?: 'pending' | 'school' | 'grassroots'
}

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
    }
  }
  if (raw.schemaVersion < 3) {
    return { ...raw, schemaVersion: SAVE_SCHEMA_VERSION, pendingTraining: null }
  }
  if (raw.schemaVersion < 4) {
    return { ...raw, schemaVersion: SAVE_SCHEMA_VERSION }
  }
  if (raw.schemaVersion < 6) return { ...raw, schemaVersion: SAVE_SCHEMA_VERSION, cups: { ...EMPTY_CUPS, ...(raw.cups ?? {}) }, legacyRouteMigration: raw.player?.sundayLeague && raw.player?.schoolId ? 'pending' : undefined }
  if (raw.schemaVersion < 7) return { ...raw, schemaVersion: SAVE_SCHEMA_VERSION, cups:{...EMPTY_CUPS,...(raw.cups??{})}, legacyRouteMigration: raw.player?.sundayLeague && raw.player?.schoolId ? 'pending' : undefined }
  return { ...raw, cups:{ ...EMPTY_CUPS, ...(raw.cups ?? {}) } }
}

export async function writeSave(save: SaveGame): Promise<void> {
  await set(slotKey(save.slotId), { ...save, schemaVersion: SAVE_SCHEMA_VERSION })
}

export async function readSave(slot: SaveSlotId): Promise<SaveGame | undefined> {
  const raw = await get(slotKey(slot))
  return raw ? migrateSave(raw) : undefined
}

export async function deleteSave(slot: SaveSlotId): Promise<void> {
  await del(slotKey(slot))
}

export async function listSaves(): Promise<(SaveGame | undefined)[]> {
  return Promise.all([0, 1, 2].map((slot) => readSave(slot as SaveSlotId)))
}
