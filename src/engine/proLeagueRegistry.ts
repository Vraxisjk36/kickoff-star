import type { ProAssociation } from './proWorld'

export type ProConfederation = ProAssociation['confederation']
export interface ProLeaguePlan {
  id: string
  associationId: string
  associationName: string
  confederation: ProConfederation
  mode: 'playable' | 'simulated'
  /** A career destination target, not proof that interactive play is implemented. */
  rulesStatus: 'research-pending'
}

// Proposed full top flights, not a claim that their real-world formats have been implemented.
// Codes are stable in saves; player-facing club and competition names live elsewhere.
const planned: Array<{ confederation: ProConfederation; playable: string; simulated: string }> = [
  { confederation: 'uefa',
    playable: 'eng:England,esp:Spain,ger:Germany,fra:France,ita:Italy,por:Portugal,ned:Netherlands,bel:Belgium,sco:Scotland,tur:Türkiye',
    simulated: 'grc:Greece,aut:Austria,sui:Switzerland,dnk:Denmark,swe:Sweden,nor:Norway,pol:Poland,cze:Czechia,hrv:Croatia,srb:Serbia,ukr:Ukraine,rou:Romania,hun:Hungary,bul:Bulgaria,irl:Ireland,fin:Finland' },
  { confederation: 'caf',
    playable: 'rsa:South Africa,nga:Nigeria,mar:Morocco,egy:Egypt,tun:Tunisia,dza:Algeria,gha:Ghana',
    simulated: 'sen:Senegal,civ:Côte d’Ivoire,cod:DR Congo,cmr:Cameroon,ken:Kenya,tza:Tanzania,uga:Uganda,zmb:Zambia,ago:Angola,mli:Mali,moz:Mozambique,zwe:Zimbabwe,eth:Ethiopia,rwa:Rwanda,lby:Libya,ben:Benin,bfa:Burkina Faso' },
  { confederation: 'conmebol',
    playable: 'bra:Brazil,arg:Argentina,col:Colombia,ury:Uruguay,chl:Chile',
    simulated: 'ecu:Ecuador,pry:Paraguay,per:Peru,bol:Bolivia,ven:Venezuela' },
  { confederation: 'concacaf',
    playable: 'usa:United States,mex:Mexico',
    simulated: 'cri:Costa Rica,can:Canada,hnd:Honduras,pan:Panama,gtm:Guatemala,slv:El Salvador,nic:Nicaragua,jam:Jamaica,tto:Trinidad and Tobago,hti:Haiti,cur:Curaçao,dom:Dominican Republic,sur:Suriname,guy:Guyana' },
  { confederation: 'afc',
    playable: 'jpn:Japan,kor:South Korea,sau:Saudi Arabia,ind:India,chn:China,aus:Australia',
    simulated: 'irn:Iran,are:United Arab Emirates,qat:Qatar,tha:Thailand,idn:Indonesia,uzb:Uzbekistan,vnm:Vietnam,irq:Iraq,jor:Jordan,oma:Oman,bhr:Bahrain,kwt:Kuwait,mas:Malaysia,phi:Philippines' },
  { confederation: 'ofc', playable: '', simulated: 'nzl:New Zealand,fji:Fiji,sol:Solomon Islands,png:Papua New Guinea' },
]

function parseLeagues(countries: string, mode: ProLeaguePlan['mode'], confederation: ProConfederation): ProLeaguePlan[] {
  return countries ? countries.split(',').map(country => {
    const separator = country.indexOf(':')
    const associationId = country.slice(0, separator)
    return { id: `top-${associationId}`, associationId, associationName: country.slice(separator + 1),
      confederation, mode, rulesStatus: 'research-pending' }
  }) : []
}

export const PRO_LEAGUE_PLAN: readonly ProLeaguePlan[] = planned.flatMap(group => [
  ...parseLeagues(group.playable, 'playable', group.confederation),
  ...parseLeagues(group.simulated, 'simulated', group.confederation),
])

/** Planned destinations and shipped interactive destinations are deliberately separate. */
export const PRO_CAREER_COUNTRY_TARGETS: readonly string[] = PRO_LEAGUE_PLAN
  .filter(league => league.mode === 'playable').map(league => league.associationId)
export const PRO_INTERACTIVE_COUNTRIES: readonly string[] = ['eng', 'esp', 'ger', 'fra', 'ita', 'ned', 'por', 'bra', 'rsa', 'sco']
export function canStartInteractiveProCareer(associationId: string): boolean {
  return PRO_INTERACTIVE_COUNTRIES.includes(associationId)
}

/** Lower flights with a stable, distinct competition identity. */
export const LOWER_DIVISIONS: Readonly<Record<string, { clubs: number; promoted: number; relegated: number }>> = {
  eng: { clubs: 24, promoted: 3, relegated: 3 }, esp: { clubs: 22, promoted: 3, relegated: 3 },
  ger: { clubs: 18, promoted: 2, relegated: 2 }, fra: { clubs: 18, promoted: 2, relegated: 2 },
  ita: { clubs: 20, promoted: 3, relegated: 3 }, ned: { clubs: 20, promoted: 2, relegated: 2 },
  por: { clubs: 18, promoted: 2, relegated: 2 }, bra: { clubs: 20, promoted: 4, relegated: 4 },
  rsa: { clubs: 16, promoted: 1, relegated: 1 }, sco: { clubs: 10, promoted: 1, relegated: 1 },
}
export const PRO_LOWER_LEAGUE_PLAN: readonly ProLeaguePlan[] = PRO_LEAGUE_PLAN
  .filter(league => league.associationId in LOWER_DIVISIONS)
  .map(league => ({ ...league, id: `second-${league.associationId}`, mode: 'simulated' }))

/** National lower flights whose club membership can be modelled as one table. */
export const DEEP_DIVISIONS: Readonly<Record<string, { third: number; fourth?: number }>> = {
  eng: { third: 24, fourth: 24 }, ger: { third: 20 }, sco: { third: 10, fourth: 10 },
  fra: { third: 18 }, bra: { third: 20 }, ned: { third: 18 },
}
export const PRO_DEEP_LEAGUE_PLAN: readonly ProLeaguePlan[] = PRO_LEAGUE_PLAN
  .filter(league => league.associationId in DEEP_DIVISIONS)
  .flatMap(league => [
    { ...league, id: `third-${league.associationId}`, mode: 'simulated' as const },
    ...(DEEP_DIVISIONS[league.associationId].fourth
      ? [{ ...league, id: `fourth-${league.associationId}`, mode: 'simulated' as const }] : []),
  ])

/** National feeder below England's League Two; retains stable IDs in saved careers. */
export const FIFTH_DIVISIONS: Readonly<Record<string, number>> = { eng: 24 }
export const PRO_FIFTH_LEAGUE_PLAN: readonly ProLeaguePlan[] = PRO_LEAGUE_PLAN
  .filter(league => league.associationId in FIFTH_DIVISIONS)
  .map(league => ({ ...league, id: `fifth-${league.associationId}`, mode: 'simulated' }))

/** Regionalliga groups beneath the national German third tier. */
export const GROUPED_FOURTH: Readonly<Record<string, { groups: number; clubsPerGroup: number; promoted: number }>> = {
  ger: { groups: 5, clubsPerGroup: 18, promoted: 4 },
  fra: { groups: 3, clubsPerGroup: 16, promoted: 3 },
  esp: { groups: 5, clubsPerGroup: 18, promoted: 10 },
  ita: { groups: 9, clubsPerGroup: 18, promoted: 9 },
  por: { groups: 4, clubsPerGroup: 14, promoted: 4 },
  rsa: { groups: 9, clubsPerGroup: 12, promoted: 9 },
  bra: { groups: 16, clubsPerGroup: 6, promoted: 6 },
}
export const PRO_GROUPED_FOURTH_LEAGUE_PLAN: readonly ProLeaguePlan[] = PRO_LEAGUE_PLAN
  .filter(league => league.associationId in GROUPED_FOURTH)
  .flatMap(league => Array.from({ length: GROUPED_FOURTH[league.associationId].groups }, (_, group) =>
    ({ ...league, id: `fourth-${league.associationId}-${group + 1}`, mode: 'simulated' as const })))

/** Scottish Highland and Lowland feeder leagues beneath League Two. */
export const GROUPED_FIFTH: Readonly<Record<string, { groups: number; clubsPerGroup: number }>> = {
  sco: { groups: 2, clubsPerGroup: 18 },
}
export const PRO_GROUPED_FIFTH_LEAGUE_PLAN: readonly ProLeaguePlan[] = PRO_LEAGUE_PLAN
  .filter(league => league.associationId in GROUPED_FIFTH)
  .flatMap(league => Array.from({ length: GROUPED_FIFTH[league.associationId].groups }, (_, group) =>
    ({ ...league, id: `fifth-${league.associationId}-${group + 1}`, mode: 'simulated' as const })))

/** Distinct regional tables; member clubs keep their region when divisions exchange. */
export const GROUPED_THIRD: Readonly<Record<string, { groups: number; clubsPerGroup: number; promoted: number }>> = {
  esp: { groups: 2, clubsPerGroup: 20, promoted: 4 },
  ita: { groups: 3, clubsPerGroup: 20, promoted: 4 },
  por: { groups: 2, clubsPerGroup: 10, promoted: 2 },
  rsa: { groups: 9, clubsPerGroup: 12, promoted: 2 },
}
export const PRO_GROUPED_LEAGUE_PLAN: readonly ProLeaguePlan[] = PRO_LEAGUE_PLAN
  .filter(league => league.associationId in GROUPED_THIRD)
  .flatMap(league => Array.from({ length: GROUPED_THIRD[league.associationId].groups }, (_, group) =>
    ({ ...league, id: `third-${league.associationId}-${group + 1}`, mode: 'simulated' as const })))

/** Hard stop for domestic relegation: these are the deepest simulated tiers.
 * A team can move up from the floor and another takes its place, but no team
 * is sent into an unimplemented lower league. Keep existing floor clubs active.
 */
export const PRO_PYRAMID_FLOORS: Readonly<Record<string, 3 | 4 | 5>> = {
  eng: 5, esp: 4, ger: 4, fra: 4, ita: 4,
  ned: 3, por: 4, bra: 4, rsa: 4, sco: 5,
}

export function validateProLeaguePlan(leagues: readonly ProLeaguePlan[] = PRO_LEAGUE_PLAN): string[] {
  const issues: string[] = []
  if (leagues.length !== 100) issues.push(`Expected 100 leagues; found ${leagues.length}`)
  if (leagues.filter(league => league.mode === 'playable').length !== 30) issues.push('Expected 30 career destination countries')
  if (leagues.filter(league => league.mode === 'simulated').length !== 70) issues.push('Expected 70 background club countries')
  for (const key of ['id', 'associationId'] as const)
    if (new Set(leagues.map(league => league[key])).size !== leagues.length) issues.push(`Duplicate ${key}`)
  return issues
}
