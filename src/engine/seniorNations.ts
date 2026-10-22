import { NATIONS, type Nation } from './nations'
import { PRO_LEAGUE_PLAN } from './proLeagueRegistry'
import { PRO_SATELLITE_ASSOCIATIONS } from './proSatelliteRegistry'

/** All 218 professional-world national associations, independently of the
 * 24-country youth onboarding catalog. Existing national IDs stay stable.
 */
const authored = new Map(NATIONS.map(nation => [nation.id, nation]))
const associations = [
  ...PRO_LEAGUE_PLAN.map(item => ({ id: item.associationId, name: item.associationName })),
  ...PRO_SATELLITE_ASSOCIATIONS.map(item => ({ id: item.id, name: item.name })),
]
export const SENIOR_NATIONS: readonly Nation[] = associations.map(association => {
  const existing = authored.get(association.id)
  if (existing) return existing
  const hash = [...association.id].reduce((value, letter) =>
    Math.imul(value ^ letter.charCodeAt(0), 16777619) >>> 0, 2166136261)
  return { id: association.id, name: association.name, short: association.id.toUpperCase(),
    flag: '🌐', strength: 4 + hash % 4 }
})
export function seniorNation(id: string | null | undefined): Nation | undefined {
  return SENIOR_NATIONS.find(nation => nation.id === id)
}
