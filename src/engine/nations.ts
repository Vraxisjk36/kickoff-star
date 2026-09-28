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

export function getNation(id: string | null | undefined): Nation {
  return NATIONS.find((n) => n.id === id) ?? NATIONS[0]
}
