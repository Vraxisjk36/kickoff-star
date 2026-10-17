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
    simulated: 'grc:Greece,aut:Austria,sui:Switzerland,dnk:Denmark,swe:Sweden,nor:Norway,pol:Poland,cze:Czechia,hrv:Croatia,srb:Serbia' },
  { confederation: 'caf',
    playable: 'rsa:South Africa,nga:Nigeria,mar:Morocco,egy:Egypt,tun:Tunisia,dza:Algeria,gha:Ghana',
    simulated: 'sen:Senegal,civ:Côte d’Ivoire,cod:DR Congo,cmr:Cameroon,ken:Kenya,tza:Tanzania,uga:Uganda,zmb:Zambia,ago:Angola,mli:Mali,moz:Mozambique' },
  { confederation: 'conmebol',
    playable: 'bra:Brazil,arg:Argentina,col:Colombia,ury:Uruguay,chl:Chile',
    simulated: 'ecu:Ecuador,pry:Paraguay,per:Peru,bol:Bolivia,ven:Venezuela' },
  { confederation: 'concacaf',
    playable: 'usa:United States,mex:Mexico',
    simulated: 'cri:Costa Rica,can:Canada,hnd:Honduras,pan:Panama,gtm:Guatemala,slv:El Salvador,nic:Nicaragua,jam:Jamaica,tto:Trinidad and Tobago' },
  { confederation: 'afc',
    playable: 'jpn:Japan,kor:South Korea,sau:Saudi Arabia,ind:India,chn:China,aus:Australia',
    simulated: 'irn:Iran,are:United Arab Emirates,qat:Qatar,tha:Thailand,idn:Indonesia,uzb:Uzbekistan,vnm:Vietnam,irq:Iraq' },
  { confederation: 'ofc', playable: '', simulated: 'nzl:New Zealand,fji:Fiji' },
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
export const PRO_INTERACTIVE_COUNTRIES: readonly string[] = ['eng']
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

export function validateProLeaguePlan(leagues: readonly ProLeaguePlan[] = PRO_LEAGUE_PLAN): string[] {
  const issues: string[] = []
  if (leagues.length !== 75) issues.push(`Expected 75 leagues; found ${leagues.length}`)
  if (leagues.filter(league => league.mode === 'playable').length !== 30) issues.push('Expected 30 career destination countries')
  if (leagues.filter(league => league.mode === 'simulated').length !== 45) issues.push('Expected 45 background club countries')
  for (const key of ['id', 'associationId'] as const)
    if (new Set(leagues.map(league => league[key])).size !== leagues.length) issues.push(`Duplicate ${key}`)
  return issues
}
