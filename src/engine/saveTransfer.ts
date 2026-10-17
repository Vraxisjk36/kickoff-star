import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { deleteSave, readSave, writeSave, SAVE_SCHEMA_VERSION, type SaveGame, type SaveSlotId } from './save'

const MAX_IMPORT_BYTES = 32 * 1024 * 1024
const FORMAT = 'kickoff-star-career-backup'

export async function exportCareer(slot: SaveSlotId): Promise<void> {
  const save = await readSave(slot)
  if (!save) throw new Error('This slot is empty.')
  const contents = JSON.stringify({ format: FORMAT, version: 1, save })
  const filename = `kickoff-star-slot-${slot + 1}-${new Date().toISOString().slice(0, 10)}.json`
  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({ path: filename, data: contents, directory: Directory.Cache, encoding: Encoding.UTF8 })
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache })
    await Share.share({ title: 'Back up Kickoff Star career', files: [uri], dialogTitle: 'Save your career backup' })
  } else {
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
}

export async function importCareer(file: File, slot: SaveSlotId): Promise<void> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('Backup is too large (32 MB limit).')
  let payload: unknown
  try { payload = JSON.parse(await file.text()) } catch { throw new Error('This is not a valid JSON backup.') }
  if (!payload || typeof payload !== 'object' || !('format' in payload) || payload.format !== FORMAT ||
      !('version' in payload) || payload.version !== 1 || !('save' in payload)) {
    throw new Error('This is not a Kickoff Star career backup.')
  }
  const save = payload.save as Partial<SaveGame> | null
  if (!save || !Number.isInteger(save.schemaVersion) || save.schemaVersion! > SAVE_SCHEMA_VERSION || save.schemaVersion! < 1 ||
      !save.player || typeof save.player.id !== 'string' || typeof save.player.name !== 'string' ||
      !save.calendar?.currentWeek || !Array.isArray(save.calendar.currentWeek.events) ||
      !save.player.careerClock || !save.player.attributes || !save.player.fitness ||
      !save.cups || !('international' in save) || !('league' in save)) {
    throw new Error('This backup is incomplete or was made by a newer version of the game.')
  }
  await writeSave({ ...save, slotId: slot, savedAt: new Date().toISOString() } as SaveGame)
}

export async function deleteLocalGameData(): Promise<void> {
  for (const slot of [0, 1, 2] as const) await deleteSave(slot)
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('kickoff-star-') || key.startsWith('competition-seen:')) localStorage.removeItem(key)
  }
}
