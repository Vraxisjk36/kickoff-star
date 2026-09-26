import { generateTeam, type Team } from './teams'
import { getRegion, regionsFor } from './regions'

/** The sixteen-team National Championship uses representatives from
 * the player's country. Countries with fewer than sixteen game regions field
 * additional district squads, each with its own identity and home region. */
export function nationalRegionalField(schoolTeam: Team, regionId: string | null | undefined, season: number): { playerTeam: Team; opponents: Team[] } {
  const home = getRegion(regionId)
  if (!home) return { playerTeam: { ...schoolTeam, id: `regional-xi-${season}`, name: 'Your Regional XI', short: 'RXI', prestige: Math.max(5, schoolTeam.prestige + 2) }, opponents: [] }

  const playerTeam: Team = { ...schoolTeam, id: `regional-xi-${home.id}-${season}`, name: `${home.name} XI`, short: home.name.slice(0, 3).toUpperCase(),
    prestige: Math.max(5, schoolTeam.prestige + 2), countryId: home.countryId, regionId: home.id }
  const away = regionsFor(home.countryId).filter(region => region.id !== home.id)
  const offset = (season - 1) % away.length
  const ordered = [...away.slice(offset), ...away.slice(0, offset)]
  const labels = ['XI', 'Schools XI', 'District XI', 'Development XI', 'Youth XI', 'County XI', 'Academy XI', 'Community XI']
  const opponents = Array.from({ length: 15 }, (_, i) => {
    const region = ordered[i % ordered.length]
    const label = labels[Math.floor(i / ordered.length)]
    const name = `${region.name} ${label}`
    return { ...generateTeam(5 + i % 3), name, short: region.name.slice(0, 3).toUpperCase(), countryId: home.countryId, regionId: region.id }
  })
  return { playerTeam, opponents }
}
