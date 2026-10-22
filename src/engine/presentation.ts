// V4 Layer 8 — durable story beats. The simulation decides what happened;
// this module turns that truth into an inbox item and a one-time reveal.

export type StoryMomentKind =
  | 'selection'
  | 'squad'
  | 'qualification'
  | 'elimination'
  | 'champion'
  | 'invitation'
  | 'promotion'
  | 'relegation'
  | 'milestone'

export interface StoryMoment {
  id: string
  kind: StoryMomentKind
  eyebrow: string
  title: string
  body: string
  detail?: string
  week: number
  season: number
  read: boolean
  metrics?: { label:string; value:number; suffix?:string; tone?:'good'|'neutral'|'bad' }[]
  ceremony?: 'selection'|'draw'|'trophy'|'callup'
}

export function createStoryMoment(input: Omit<StoryMoment, 'id' | 'read'>): StoryMoment {
  return { ...input, id: crypto.randomUUID(), read: false }
}

export function addStoryMoment(inbox: StoryMoment[] | undefined, moment: StoryMoment): StoryMoment[] {
  const existing = inbox ?? []
  const duplicate = existing.some((item) => item.kind === moment.kind && item.title === moment.title && item.week === moment.week && item.season === moment.season)
  return duplicate ? existing : [...existing, moment].slice(-40)
}

export function storyTone(kind: StoryMomentKind): 'gold' | 'good' | 'bad' | 'neutral' {
  if (kind === 'champion' || kind === 'promotion' || kind === 'invitation') return 'gold'
  if (kind === 'selection' || kind === 'qualification' || kind === 'squad') return 'good'
  if (kind === 'elimination' || kind === 'relegation') return 'bad'
  return 'neutral'
}
