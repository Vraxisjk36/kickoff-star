import type { ProAssociation } from './proWorld'

export type ProConfederation = ProAssociation['confederation']
export interface ProLeaguePlan {
  id: string
  associationId: string
  associationName: string
  confederation: ProConfederation
  mode: 'playable' | 'simulated'
  /** Club count, cup rules and exact dates require association-level research. */
  rulesStatus: 'research-pending'
}

// Proposed full top flights, not a claim that their real-world formats have been implemented.
// Codes are stable in saves; player-facing club and competition names live elsewhere.
const planned: Array<{ confederation: ProConfederation; playable: string; simulated: string }> = [
  { confederation: 'uefa',
    playable: 'eng:England,esp:Spain,ger:Germany,fra:France,ita:Italy,por:Portugal,ned:Netherlands,bel:Belgium,sco:Scotland,tur:Türkiye,grc:Greece,aut:Austria',
    simulated: 'sui:Switzerland,dnk:Denmark,swe:Sweden,nor:Norway,pol:Poland,cze:Czechia,hrv:Croatia,srb:Serbia' },
  { confederation: 'caf',
    playable: 'rsa:South Africa,nga:Nigeria,mar:Morocco,egy:Egypt,tun:Tunisia,dza:Algeria,gha:Ghana,sen:Senegal',
    simulated: 'civ:Côte d’Ivoire,cod:DR Congo,cmr:Cameroon,ken:Kenya,tza:Tanzania,uga:Uganda,zmb:Zambia,ago:Angola,mli:Mali,moz:Mozambique' },
  { confederation: 'conmebol',
    playable: 'bra:Brazil,arg:Argentina,col:Colombia,ury:Uruguay,chl:Chile',
    simulated: 'ecu:Ecuador,pry:Paraguay,per:Peru,bol:Bolivia,ven:Venezuela' },
  { confederation: 'concacaf',
    playable: 'usa:United States,mex:Mexico,cri:Costa Rica',
    simulated: 'can:Canada,hnd:Honduras,pan:Panama,gtm:Guatemala,slv:El Salvador,nic:Nicaragua,jam:Jamaica,tto:Trinidad and Tobago' },
  { confederation: 'afc',
    playable: 'jpn:Japan,kor:South Korea,sau:Saudi Arabia,ind:India,chn:China,aus:Australia',
    simulated: 'irn:Iran,are:United Arab Emirates,qat:Qatar,tha:Thailand,idn:Indonesia,uzb:Uzbekistan,vnm:Vietnam,irq:Iraq' },
  { confederation: 'ofc', playable: 'nzl:New Zealand', simulated: 'fji:Fiji' },
]

function parseLeagues(countries: string, mode: ProLeaguePlan['mode'], confederation: ProConfederation): ProLeaguePlan[] {
  return countries.split(',').map(country => {
    const separator = country.indexOf(':')
    const associationId = country.slice(0, separator)
    return { id: `top-${associationId}`, associationId, associationName: country.slice(separator + 1),
      confederation, mode, rulesStatus: 'research-pending' }
  })
}

export const PRO_LEAGUE_PLAN: readonly ProLeaguePlan[] = planned.flatMap(group => [
  ...parseLeagues(group.playable, 'playable', group.confederation),
  ...parseLeagues(group.simulated, 'simulated', group.confederation),
])

export function validateProLeaguePlan(leagues: readonly ProLeaguePlan[] = PRO_LEAGUE_PLAN): string[] {
  const issues: string[] = []
  if (leagues.length !== 75) issues.push(`Expected 75 leagues; found ${leagues.length}`)
  if (leagues.filter(league => league.mode === 'playable').length !== 35) issues.push('Expected 35 playable leagues')
  if (leagues.filter(league => league.mode === 'simulated').length !== 40) issues.push('Expected 40 simulated leagues')
  for (const key of ['id', 'associationId'] as const)
    if (new Set(leagues.map(league => league[key])).size !== leagues.length) issues.push(`Duplicate ${key}`)
  return issues
}
