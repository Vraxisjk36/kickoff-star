import { PRO_LEAGUE_PLAN } from './proLeagueRegistry'
import { PRO_SATELLITE_ASSOCIATIONS } from './proSatelliteRegistry'
// Phase 27 — nationality. Picked during onboarding, drives the youth
// international layer (your nation IS the team you get called up for) and
// flavour throughout the UI. Ratings are a loose youth-football strength
// band, feeding the qualifying-group difficulty.
export interface Nation {
  id: string
  name: string
  short: string
  flag: string // emoji — renders everywhere without an asset pipeline
  strength: number // 4-8, seeds the nation team's prestige
}

export const NATIONS: Nation[] = [
  { id: 'eng', name: 'England', short: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', strength: 7 },
  { id: 'rsa', name: 'South Africa', short: 'RSA', flag: '🇿🇦', strength: 5 },
  { id: 'bra', name: 'Brazil', short: 'BRA', flag: '🇧🇷', strength: 8 },
  { id: 'arg', name: 'Argentina', short: 'ARG', flag: '🇦🇷', strength: 8 },
  { id: 'fra', name: 'France', short: 'FRA', flag: '🇫🇷', strength: 8 },
  { id: 'ger', name: 'Germany', short: 'GER', flag: '🇩🇪', strength: 7 },
  { id: 'esp', name: 'Spain', short: 'ESP', flag: '🇪🇸', strength: 8 },
  { id: 'por', name: 'Portugal', short: 'POR', flag: '🇵🇹', strength: 7 },
  { id: 'ita', name: 'Italy', short: 'ITA', flag: '🇮🇹', strength: 7 },
  { id: 'ned', name: 'Netherlands', short: 'NED', flag: '🇳🇱', strength: 7 },
  { id: 'nga', name: 'Nigeria', short: 'NGA', flag: '🇳🇬', strength: 6 },
  { id: 'gha', name: 'Ghana', short: 'GHA', flag: '🇬🇭', strength: 5 },
  { id: 'sen', name: 'Senegal', short: 'SEN', flag: '🇸🇳', strength: 6 },
  { id: 'mar', name: 'Morocco', short: 'MAR', flag: '🇲🇦', strength: 6 },
  { id: 'usa', name: 'United States', short: 'USA', flag: '🇺🇸', strength: 6 },
  { id: 'mex', name: 'Mexico', short: 'MEX', flag: '🇲🇽', strength: 6 },
  { id: 'jpn', name: 'Japan', short: 'JPN', flag: '🇯🇵', strength: 6 },
  { id: 'kor', name: 'South Korea', short: 'KOR', flag: '🇰🇷', strength: 5 },
  { id: 'aus', name: 'Australia', short: 'AUS', flag: '🇦🇺', strength: 5 },
  { id: 'bel', name: 'Belgium', short: 'BEL', flag: '🇧🇪', strength: 7 },
  { id: 'sco', name: 'Scotland', short: 'SCO', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', strength: 6 },
  { id: 'aut', name: 'Austria', short: 'AUT', flag: '🇦🇹', strength: 6 },
  { id: 'sui', name: 'Switzerland', short: 'SUI', flag: '🇨🇭', strength: 6 },
  { id: 'tur', name: 'Türkiye', short: 'TUR', flag: '🇹🇷', strength: 6 },
]

// The 24 established nations retain their authored strengths and flags. Every
// other professional-world association also has a playable national identity.
const existing = new Set(NATIONS.map(nation => nation.id))
const allAssociations = [
  ...PRO_LEAGUE_PLAN.map(item => ({ id: item.associationId, name: item.associationName })),
  ...PRO_SATELLITE_ASSOCIATIONS.map(item => ({ id: item.id, name: item.name })),
]
for (const association of allAssociations) {
  if (existing.has(association.id)) continue
  existing.add(association.id)
  // Stable fallback strength; never rerolls after a save is loaded.
  const hash = [...association.id].reduce((value, letter) =>
    Math.imul(value ^ letter.charCodeAt(0), 16777619) >>> 0, 2166136261)
  NATIONS.push({ id: association.id, name: association.name,
    short: association.id.toUpperCase(), flag: '🌐', strength: 4 + hash % 4 })
}
export function getNation(id: string | null | undefined): Nation {
  return NATIONS.find(nation => nation.id === id) ?? NATIONS[0]
}
export function isSupportedNation(id: string | null | undefined): boolean {
  return !!id && NATIONS.some(nation => nation.id === id)
}
