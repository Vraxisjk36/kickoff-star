/** Phase 3 persistent club relationships and transfer-pressure ledger.
 * Pure transitions: safe to replay from a save without random outcomes.
 */
export interface ProRelationship {
  clubId: string
  affinity: number
  rivalry: number
  meetings: number
  wins: number
  losses: number
  lastEvent: string
}
export interface ProRelationshipEvent {
  id: string
  clubId: string
  kind: 'fixture' | 'negotiation' | 'rejection' | 'transfer' | 'return'
  description: string
}
export interface ProRelationshipLedger {
  clubs: Record<string, ProRelationship>
  events: ProRelationshipEvent[]
}
export const emptyProRelationships = (): ProRelationshipLedger => ({ clubs: {}, events: [] })
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
export function recordProRelationship(
  ledger: ProRelationshipLedger | undefined,
  event: ProRelationshipEvent,
  outcome?: 'win' | 'loss' | 'draw',
): ProRelationshipLedger {
  const source = ledger ?? emptyProRelationships()
  if (source.events.some(item => item.id === event.id)) return source
  const previous = source.clubs[event.clubId] ?? {
    clubId: event.clubId, affinity: 50, rivalry: 0, meetings: 0, wins: 0, losses: 0, lastEvent: '',
  }
  const affinityDelta = event.kind === 'transfer' ? 24 :
    event.kind === 'return' ? 10 : event.kind === 'negotiation' ? 4 :
    event.kind === 'rejection' ? -14 : 0
  const rivalryDelta = event.kind === 'rejection' ? 12 :
    event.kind === 'fixture' ? (outcome === 'draw' ? 3 : 6) : 0
  const updated: ProRelationship = {
    ...previous,
    affinity: clamp(previous.affinity + affinityDelta),
    rivalry: clamp(previous.rivalry + rivalryDelta),
    meetings: previous.meetings + (event.kind === 'fixture' ? 1 : 0),
    wins: previous.wins + (event.kind === 'fixture' && outcome === 'win' ? 1 : 0),
    losses: previous.losses + (event.kind === 'fixture' && outcome === 'loss' ? 1 : 0),
    lastEvent: event.description,
  }
  return { clubs: { ...source.clubs, [event.clubId]: updated },
    events: [...source.events, event].slice(-120) }
}
export function transferRelationshipModifier(ledger: ProRelationshipLedger | undefined, clubId: string): number {
  const club = ledger?.clubs[clubId]
  if (!club) return 0
  return Math.max(-0.08, Math.min(0.08, (club.affinity - 50) / 500 - club.rivalry / 1250))
}
