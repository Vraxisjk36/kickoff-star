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
export const VERIFIED_PRO_RULES: Record<'eng' | 'rsa' | 'esp' | 'ger' | 'fra' | 'ita' | 'ned', ProRuleProfile> = {
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
  esp: { associationId: 'esp', edition: '2026/27', topFlightClubs: 20, topFlightMatches: 38,
    directRelegation: 3, relegationPlayoff: 0, lowerTierClubs: 22, lowerTierMatches: 42,
    domesticCups: ['cup-esp', 'super-cup-esp'], implementation: 'partial',
    sources: ['https://www.laliga.com/en-GB/laliga-easports', 'https://www.laliga.com/en-GB/laliga-hypermotion',
      'https://www.laliga.com/noticias/quienes-juegan-el-play-off-de-ascenso'] },
  ger: { associationId: 'ger', edition: '2026/27', topFlightClubs: 18, topFlightMatches: 34,
    directRelegation: 2, relegationPlayoff: 1, lowerTierClubs: 18, lowerTierMatches: 34,
    domesticCups: ['cup-ger', 'super-cup-ger'], implementation: 'partial',
    sources: ['https://www.bundesliga.com/en/bundesliga/news/how-does-promotion-and-relegation-work-in-the-bundesliga-10645'] },
  fra: { associationId: 'fra', edition: '2026/27', topFlightClubs: 18, topFlightMatches: 34,
    directRelegation: 2, relegationPlayoff: 1, lowerTierClubs: 18, lowerTierMatches: 34,
    domesticCups: ['cup-fra', 'super-cup-fra'], implementation: 'partial',
    sources: ['https://ligue1.com/en/articles/l1_article_3812-',
      'https://ligue1.com/en/articles/l1_article_5074-'] },
  ita: { associationId: 'ita', edition: '2026/27', topFlightClubs: 20, topFlightMatches: 38,
    directRelegation: 3, relegationPlayoff: 0, lowerTierClubs: 20, lowerTierMatches: 38,
    domesticCups: ['cup-ita', 'super-cup-ita'], implementation: 'partial',
    sources: ['https://www.legaseriea.it/en'] },
  ned: { associationId: 'ned', edition: '2026/27', topFlightClubs: 18, topFlightMatches: 34,
    directRelegation: 2, relegationPlayoff: 1, lowerTierClubs: 20, lowerTierMatches: 38,
    domesticCups: ['cup-ned', 'super-cup-ned'], implementation: 'partial',
    sources: ['https://eredivisie.nl/competitie/'] },
}
