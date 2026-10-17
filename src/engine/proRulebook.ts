/** Rules pinned to the 2026/27 season. Club names remain fictional in-game.
 * Reviewed against the Premier League, EFL, PSL and CAF publications.
 * This is a format specification, not a claim that all routes are implemented.
 */
export interface ProRuleProfile {
  associationId: string
  edition: string
  topFlightClubs: number
  topFlightMatches: number
  directRelegation: number
  relegationPlayoff: number
  lowerTierClubs: number
  lowerTierMatches: number
  domesticCups: readonly string[]
  implementation: 'partial'
  sources: readonly string[]
}
export const VERIFIED_PRO_RULES: Record<'eng' | 'rsa', ProRuleProfile> = {
  eng: { associationId: 'eng', edition: '2026/27', topFlightClubs: 20, topFlightMatches: 38,
    directRelegation: 3, relegationPlayoff: 0, lowerTierClubs: 24, lowerTierMatches: 46,
    domesticCups: ['cup-eng', 'league-cup-eng'], implementation: 'partial',
    sources: ['https://www.premierleague.com/en/news/4675097/all-380-fixtures-for-202627-premier-league-season',
      'https://www.premierleague.com/en/european-qualification-explained',
      'https://www.efl.com/news/2026/march/05/efl-statement--sky-bet-championship-play-off-format/'] },
  rsa: { associationId: 'rsa', edition: '2026/27', topFlightClubs: 16, topFlightMatches: 30,
    directRelegation: 1, relegationPlayoff: 1, lowerTierClubs: 16, lowerTierMatches: 30,
    domesticCups: ['mtn8-rsa', 'league-cup-rsa', 'cup-rsa'], implementation: 'partial',
    sources: ['https://psl.co.za/content/125534',
      'https://www.psl.co.za/news/article/5615294-psl-confirms-the-202627-season-calend',
      'https://www.psl.co.za/news/article/5613244-nedbank-cup-2026-participating-clubs',
      'https://www.cafonline.com/caf-champions-league/news/top-clubs-on-the-continent-set-to-represent-southern-africa-in-caf-interclub-competitions/'] },
}
