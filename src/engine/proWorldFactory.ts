import { DEEP_DIVISIONS, FIFTH_DIVISIONS, GROUPED_FOURTH, GROUPED_FIFTH, GROUPED_THIRD, LOWER_DIVISIONS, PRO_FIFTH_LEAGUE_PLAN, PRO_GROUPED_FOURTH_LEAGUE_PLAN, PRO_GROUPED_FIFTH_LEAGUE_PLAN, PRO_DEEP_LEAGUE_PLAN, PRO_GROUPED_LEAGUE_PLAN, PRO_LEAGUE_PLAN, PRO_LOWER_LEAGUE_PLAN, type ProLeaguePlan } from './proLeagueRegistry'
import { createEmptyProWorld, type IsoDate, type ProAcademyProspect, type ProClub, type ProCompetition, type ProFixture,
  type ProPlayer, type ProWorldState } from './proWorld'
import { isInPeriod, type SeasonCalendarProfile } from './proCalendar'
import { PRO_SATELLITE_ASSOCIATIONS } from './proSatelliteRegistry'
import { VERIFIED_PRO_RULES } from './proRulebook'
import { proClubIdentity } from './proClubIdentities'
import { proRatingTarget, proClubReputationTarget } from './proRatings'

const DAY = 86_400_000
const utc = (date: IsoDate) => Date.parse(`${date}T00:00:00Z`)
const iso = (time: number): IsoDate => new Date(time).toISOString().slice(0, 10)
const padded = (value: number) => String(value).padStart(2, '0')
const hash = (value: string): number => { let n = 2166136261; for (const char of value) n = Math.imul(n ^ char.charCodeAt(0), 16777619); return n >>> 0 }
export const proRoll = (seed: number, key: string): number => hash(`${seed}:${key}`) / 4294967296

// Provisional format profiles, never presented as official fixture dates.
const springStart = new Set(['bra','arg','col','ury','chl','ecu','pry','per','bol','ven','usa','can','jpn','kor','chn','swe','nor','fji'])
const autumnStart = new Set(['aus','nzl'])
const julyStart = new Set(['mex'])
export function proCalendarProfile(associationId: string, startYear: number): SeasonCalendarProfile {
  const startMonth = associationId === 'bra' && startYear >= 2026 ? 1
    : springStart.has(associationId) ? 2 : autumnStart.has(associationId) ? 10 : julyStart.has(associationId) ? 7 : 8
  const endYear = startMonth >= 7 ? startYear + 1 : startYear
  const endMonth = startMonth === 10 ? 6 : startMonth >= 7 ? 5 : 11
  const breaks = associationId === 'esp' ? [{ start: `${startYear}-12-22`, end: `${endYear}-01-04` }] : []
  const finalDay = new Date(Date.UTC(startYear, startMonth, 0)).getUTCDate()
  return { id: `${associationId}-${startYear}`, startMonth, endMonth, breaks,
    registrationPeriods: [
      { start: `${startYear}-${padded(startMonth)}-01`, end: `${startYear}-${padded(startMonth)}-${padded(finalDay)}` },
      { start: `${endYear}-01-01`, end: `${endYear}-01-31` },
    ] }
}

const currencyGroups: Record<string, string> = {
  GBP: 'eng,sco', EUR: 'esp,ger,fra,ita,por,ned,bel,aut,grc,irl,cyp,hrv,fin,bul',
  ZAR: 'rsa', NGN: 'nga', MAD: 'mar', EGP: 'egy', TND: 'tun', DZD: 'dza', GHS: 'gha', XOF: 'sen,civ,mli,ben,bfa',
  CDF: 'cod', XAF: 'cmr', KES: 'ken', TZS: 'tza', UGX: 'uga', ZMW: 'zmb', AOA: 'ago', MZN: 'moz',
  BRL: 'bra', ARS: 'arg', COP: 'col', UYU: 'ury', CLP: 'chl', USD: 'usa,ecu,slv,zwe',
  PYG: 'pry', PEN: 'per', BOB: 'bol', VES: 'ven', MXN: 'mex', CAD: 'can', CRC: 'cri',
  HNL: 'hnd', PAB: 'pan', GTQ: 'gtm', NIO: 'nic', JMD: 'jam', TTD: 'tto',
  JPY: 'jpn', KRW: 'kor', SAR: 'sau', INR: 'ind', CNY: 'chn', AUD: 'aus', IRR: 'irn',
  AED: 'are', QAR: 'qat', THB: 'tha', IDR: 'idn', UZS: 'uzb', VND: 'vnm', IQD: 'irq',
  NZD: 'nzl', FJD: 'fji', SBD: 'sol', PGK: 'png', CHF: 'sui', DKK: 'dnk', SEK: 'swe', NOK: 'nor', PLN: 'pol',
  CZK: 'cze', RSD: 'srb', TRY: 'tur',
  UAH: 'ukr', RON: 'rou', HUF: 'hun',
  ETB: 'eth', RWF: 'rwa', LYD: 'lby', HTG: 'hti', XCG: 'cur', DOP: 'dom', SRD: 'sur', GYD: 'guy',
  JOD: 'jor', OMR: 'oma', BHD: 'bhr', KWD: 'kwt', MYR: 'mas', PHP: 'phi',
}
const currencies = Object.fromEntries(Object.entries(currencyGroups).flatMap(([code, ids]) => ids.split(',').map(id => [id, code])))

// Phase 1 world capacity, not verified real-life club counts. Clubs and formats
// are replaced by researched country editions before the public pro release.
export function plannedClubCount(id: string): number {
  if (id in VERIFIED_PRO_RULES) return VERIFIED_PRO_RULES[id as keyof typeof VERIFIED_PRO_RULES].topFlightClubs
  if (['eng','esp','ita','bra','mex','nga','egy','usa'].includes(id)) return 20
  if (id === 'fra') return 18
  if (id === 'ger' || id === 'por' || id === 'ned' || id === 'tur') return 18
  if (id === 'sco' || id === 'aut' || id === 'nzl' || id === 'fji') return 12
  return 16
}

const namedCities: Record<string, string[]> = {
  eng: ['London','Manchester','Liverpool','Leeds','Birmingham','Newcastle','Brighton','Bristol'],
  esp: ['Madrid','Barcelona','Seville','Valencia','Bilbao','Vigo','Málaga','Zaragoza'],
  rsa: ['Johannesburg','Pretoria','Cape Town','Durban','Bloemfontein','Gqeberha','Stellenbosch','Polokwane'],
  bra: ['São Paulo','Rio','Santos','Salvador','Recife','Porto Alegre','Belo Horizonte','Curitiba'],
  usa: ['New York','Los Angeles','Miami','Chicago','Seattle','Atlanta','Dallas','Philadelphia'],
  jpn: ['Tokyo','Osaka','Yokohama','Nagoya','Kobe','Sapporo','Kyoto','Hiroshima'],
}
const regionalCityAnchors: Record<string, string[]> = {"esp":["Vigo","Barcelona","Valencia","Seville","Madrid"],"ger":["Cologne","Mannheim","Hamburg","Leipzig","Munich"],"fra":["Lille","Paris","Marseille"],"ita":["Turin","Milan","Genoa","Venice","Bologna","Florence","Rome","Naples","Palermo"],"por":["Braga","Porto","Coimbra","Faro"],"rsa":["Polokwane","Mbombela","Pretoria","Johannesburg","Rustenburg","Bloemfontein","Kimberley","Durban","Cape Town"],"bra":["Manaus","Belem","Macapa","Sao Luis","Fortaleza","Natal","Joao Pessoa","Recife","Maceio","Aracaju","Salvador","Goiania","Belo Horizonte","Rio de Janeiro","Sao Paulo","Porto Alegre"],"sco":["Inverness","Edinburgh"]}
const identities = ['Athletic','United','City','Sporting','Rovers','Union','Albion','Wanderers',
  'Olympic','Dynamo','Harbour','Racing','North','South','Eagles','Stars','Central','Lions','Valley','Academia']
const firstNames = ['Amir','Daniel','Leo','Jamal','Hiro','Thabo','Mateo','Samuel','Yusuf','Kai','André','Rafael','Kofi','Milan','Santiago','Noah']
const lastNames = ['Silva','Kamara','Morales','Okafor','Diallo','Costa','Kim','Mokoena','Garcia','Sato','Mensah','Bennett','Ahmed','Santos','Novak','Reyes']
// Regional recruitment pools give squads a plausible mix without using licensed player data.
const recruitmentPools: Record<string, string[]> = {
  eng: ['sco','irl','wal','fra','esp','por','nga','gha','bra','arg'],
  esp: ['por','fra','arg','bra','ury','col','mar'],
  ger: ['aut','ned','bel','fra','pol','tur','sui'],
  fra: ['bel','mar','sen','civ','dza','cmr','cod','por'],
  ita: ['fra','esp','arg','bra','alb','sui','tun'],
  por: ['bra','ago','moz','civ','esp','fra'],
  rsa: ['zwe','zmb','moz','nam','nga','gha','cod'],
  usa: ['can','mex','col','arg','bra','jam'],
  bra: ['arg','ury','col','pry','per','bol'],
  jpn: ['kor','aus','bra','chn'],
  nga: ['gha','cmr','ben','civ','sen'],
  egy: ['mar','tun','dza','gha','nga','sud'],
}

// Fictional name banks are selected from nationality rather than club location.
const regionalNames: Record<string, { first: string[]; last: string[] }> = {
  eng: { first: ['Oliver','Ethan','Jack','Harry','Callum','George','Lewis','Ryan'], last: ['Walker','Hughes','Taylor','Wilson','Clarke','Foster','Barker','Cooper'] },
  esp: { first: ['Diego','Pablo','Álvaro','Javier','Iker','Sergio','Nico','Hugo'], last: ['Ruiz','Navarro','Ortega','Vega','Castillo','Molina','Serrano','Iglesias'] },
  ger: { first: ['Lukas','Felix','Jonas','Emil','Florian','Max','Tim','Leon'], last: ['Weber','Becker','Keller','Schulz','Vogel','Hoffmann','Richter','Brandt'] },
  fra: { first: ['Mathis','Hugo','Lucas','Noé','Yanis','Antoine','Louis','Enzo'], last: ['Laurent','Moreau','Petit','Lefèvre','Girard','Roux','Fontaine','Chevalier'] },
  ita: { first: ['Luca','Marco','Andrea','Matteo','Nicolo','Davide','Pietro','Alessio'], last: ['Romano','Ricci','Conti','Marino','Greco','Gallo','Ferrari','Rinaldi'] },
  por: { first: ['Tiago','João','Diogo','Rui','Gonçalo','Nuno','Pedro','Miguel'], last: ['Ferreira','Pereira','Almeida','Teixeira','Carvalho','Ribeiro','Sousa','Coelho'] },
  bra: { first: ['Rafael','Caio','Bruno','Gabriel','Vinícius','João','Lucas','Thiago'], last: ['Oliveira','Souza','Lima','Pereira','Costa','Barbosa','Ribeiro','Mendes'] },
  rsa: { first: ['Thabo','Siyabonga','Sipho','Lethabo','Kabelo','Bongani','Sibusiso','Tshepo'], last: ['Mokoena','Dlamini','Ndlovu','Khumalo','Maseko','Mthembu','Nkosi','Mahlangu'] },
  nga: { first: ['Chinedu','Tunde','Emeka','Ifeanyi','Samuel','Ayo','Obinna','Kelechi'], last: ['Okafor','Adeyemi','Balogun','Nwosu','Eze','Adebayo','Uche','Ojo'] },
  jpn: { first: ['Haruto','Yuto','Ren','Kaito','Sota','Daiki','Takumi','Riku'], last: ['Tanaka','Sato','Suzuki','Yamamoto','Kobayashi','Nakamura','Ito','Watanabe'] },
  kor: { first: ['Min-jun','Ji-ho','Seo-jun','Do-yun','Hyun-woo','Jun-seo','Tae-min','Jae-hyun'], last: ['Kim','Lee','Park','Choi','Jung','Kang','Cho','Yoon'] },
  usa: { first: ['Mason','Logan','Aiden','Noah','Carter','Dylan','Wyatt','Jordan'], last: ['Johnson','Miller','Davis','Brown','Anderson','Brooks','Reed','Morgan'] },
  arg: { first: ['Facundo','Tomás','Lautaro','Julián','Franco','Nicolás','Agustín','Matías'], last: ['Fernández','Álvarez','Acosta','Benítez','Pereyra','Medina','Cabrera','Rojas'] },
  mar: { first: ['Youssef','Amine','Achraf','Hamza','Bilal','Anas','Omar','Ayoub'], last: ['El Idrissi','Bennani','Alaoui','Amrani','Berrada','Ziani','Tazi','Fassi'] },
  egy: { first: ['Omar','Ahmed','Youssef','Mostafa','Karim','Mahmoud','Hassan','Tarek'], last: ['Hassan','Ibrahim','Fathy','Mansour','Farouk','Nasser','Khalil','Salem'] },
}

const positions = ['GK','GK','RB','CB','CB','CB','LB','DM','CM','CM','AM','RW','LW','ST','ST','GK','CB','RB','LB','CM','CM','RW','LW','ST']

function clubName(league:ProLeaguePlan,index:number,tier=1,offset=index):{name:string;city:string}{
  const named=proClubIdentity(league.associationId,offset,tier,league.associationName)
  if(tier===1)return named
  const city=namedCities[league.associationId]?.[offset%(namedCities[league.associationId].length)] ??
    named.city
  const style=identities[(offset+tier*3)%identities.length]
  const distinction=['County','Town','Athletic','United','Vale','Borough'][
    Math.floor(offset/Math.max(1,namedCities[league.associationId]?.length??8))%6]
  return {city,name:`${city} ${style} ${distinction}`}
}

/** Expose the same generated club identities used by the actual living league.
 * Do not hand applicants a trial offer from an invented separate roster.
 */
export function proWorldClubIdentity(associationId: string, tier: 1 | 2, rank: number): {name:string;city:string} {
  const league=PRO_LEAGUE_PLAN.find(item=>item.associationId===associationId)
  if(!league)throw new Error(`Unknown association: ${associationId}`)
  const index=tier===1?rank:plannedClubCount(associationId)+rank
  return clubName(league,index,tier,rank)
}

function createSquad(club: ProClub, seed: number, year: number, squadStrength = club.reputation): ProPlayer[] {
  const wageBudget = Math.floor(club.finances.annualSquadCostLimit * .66)
  const rosterPositions = club.tier === 3 && (club.associationId in GROUPED_THIRD || ['fra', 'bra'].includes(club.associationId))
    ? positions.slice(0, 20) : positions
  // Depth is positional, not simply the order of the 24-man roster. Every club
  // has recognizable first-choice players, rotation options and weaker reserves.
  const seenPositions = new Map<string, number>()
  const squadRatings = rosterPositions.map((position, i) => {
    const depth = seenPositions.get(position) ?? 0
    seenPositions.set(position, depth + 1)
    const starterCount = position === 'CB' || position === 'CM' ? 2 : 1
    const depthBonus = depth < starterCount ? 4 : depth === starterCount ? -2 : -6
    const variation = Math.round((proRoll(seed, `${club.id}:ovr:${i}`) - .5) * 8)
    return Math.min(90, Math.max(40, squadStrength + depthBonus + variation))
  })
  // Wages reflect a player's place in the hierarchy, while respecting the
  // existing club wage budget and preserving deterministic squad generation.
  const weights = squadRatings.map((overall, i) =>
    Math.max(.5, Math.pow(1.065, overall - squadStrength) * (0.9 + proRoll(seed, `${club.id}:wage:${i}`) * .2)))
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  const usedNames = new Set<string>()
  return rosterPositions.map((position, i) => {
    const pool = recruitmentPools[club.associationId] ??
      PRO_LEAGUE_PLAN.filter(item => item.confederation ===
        PRO_LEAGUE_PLAN.find(league => league.associationId === club.associationId)?.confederation &&
        item.associationId !== club.associationId).slice(0, 12).map(item => item.associationId)
    const foreignShare = club.tier === 1 ? .28 : club.tier === 2 ? .16 : .08
    const nationality = pool.length && proRoll(seed, `${club.id}:foreign:${i}`) < foreignShare
      ? pool[Math.floor(proRoll(seed, `${club.id}:origin:${i}`) * pool.length)]
      : club.associationId
    const names = regionalNames[nationality] ?? { first: firstNames, last: lastNames }
    let surname = names.last[Math.floor(proRoll(seed, `${club.id}:surname:${i}`) * names.last.length)]
    let first = names.first[Math.floor(proRoll(seed, `${club.id}:first:${i}`) * names.first.length)]
    let probe = 0
    while (usedNames.has(`${first} ${surname}`) && probe < names.first.length * names.last.length) {
      probe++
      first = names.first[(i + probe + Math.floor(proRoll(seed, `${club.id}:first:${i}`) * names.first.length)) % names.first.length]
      surname = names.last[(i * 7 + probe + Math.floor(proRoll(seed, `${club.id}:surname:${i}`) * names.last.length)) % names.last.length]
    }
    usedNames.add(`${first} ${surname}`)
    const age = 18 + Math.floor(proRoll(seed, `${club.id}:age:${i}`) * 16)
    const overall = squadRatings[i]
    const growth = age <= 23 ? 6 + Math.floor(proRoll(seed, `${club.id}:potential:${i}`) * 8)
      : age <= 28 ? 3 + Math.floor(proRoll(seed, `${club.id}:potential:${i}`) * 6)
      : Math.floor(proRoll(seed, `${club.id}:potential:${i}`) * 4)
    return { id: `player-${club.id}-${i}`, name: `${first} ${surname}`, birthDate: `${year - age}-06-15`,
      nationalityIds: [nationality], position, overall, potential: Math.min(94, overall + growth),
      clubId: club.id, annualWage: Math.floor(wageBudget * weights[i] / totalWeight), shirtNumber: i + 1 }
  })
}

/** Two prospects per club per intake; only successful graduates enter the wage bill. */
export function createAcademyIntake(club: ProClub, seed: number, year: number): ProAcademyProspect[] {
  return [0, 1].map(index => {
    const id = `academy-${club.id}-${year}-${index}`
    const rating = Math.max(34, Math.round(club.reputation - 15 + proRoll(seed, `${id}:ability`) * 13))
    return { id, clubId: club.id, intakeYear: year,
      name: `${firstNames[Math.floor(proRoll(seed, `${id}:first`) * firstNames.length)]} ${lastNames[Math.floor(proRoll(seed, `${id}:last`) * lastNames.length)]}`,
      birthDate: `${year - 18}-06-15`, nationalityIds: [club.associationId],
      position: positions[Math.floor(proRoll(seed, `${id}:position`) * positions.length)],
      overall: rating, potential: Math.min(94, rating + 7 + Math.floor(proRoll(seed, `${id}:potential`) * 13)) }
  })
}

export function newProLeagueSeason(world: ProWorldState, league: ProLeaguePlan, startYear: number): ProFixture[] {
  const tier = league.id.startsWith('second-') ? 2 : league.id.startsWith('third-') ? 3 : league.id.startsWith('fourth-') ? 4 : league.id.startsWith('fifth-') ? 5 : 1
  const lower = tier > 1
  const group = league.id.match(/^(?:third|fourth|fifth)-[a-z]+-(\d+)$/)?.[1]
  const clubIds = Object.values(world.clubs).filter(club => club.associationId === league.associationId &&
    (tier === 1 ? !club.tier || club.tier === 1 : club.tier === tier) &&
    (!group || club.feederGroup === Number(group))).map(club => club.id).sort()
  const competitionId = league.id
  const scottishSplit = !lower && league.associationId === 'sco' && clubIds.length === 12
  const scottishLower = lower && league.associationId === 'sco' && clubIds.length === 10
  const brazilThird = tier === 3 && league.associationId === 'bra'
  const rounds = scottishSplit ? 33 : (clubIds.length - 1) * (brazilThird ? 1 : scottishLower ? 4 : 2)
  const competition: ProCompetition = { id: competitionId, associationId: league.associationId, kind: 'league',
    seasonId: String(startYear), entrantIds: clubIds, format: { legs: brazilThird ? 1 : scottishLower ? 4 : 2, scheduledRounds: scottishSplit ? 38 : rounds } }
  world.competitions[competitionId] = competition
  world.standings[competitionId] = clubIds.map(clubId => ({ clubId, played: 0, won: 0, drawn: 0, lost: 0,
    goalsFor: 0, goalsAgainst: 0, points: 0 }))
  const profile = proCalendarProfile(league.associationId, startYear)
  const endYear = profile.endMonth < profile.startMonth ? startYear + 1 : startYear
  const brazil2026 = league.associationId === 'bra' && startYear >= 2026
  const start = utc(brazil2026 ? lower ? `${startYear}-03-21` : `${startYear}-01-28`
    : `${startYear}-${padded(profile.startMonth)}-15`)
  // The Scottish top flight reserves five weekly matchdays after the 33-game split.
  const end = utc(league.id.startsWith('third-por-') ? `${endYear}-01-22` : scottishSplit ? `${endYear}-04-11` : scottishLower ? `${endYear}-04-30` : brazil2026
    ? lower ? `${startYear}-11-28` : `${startYear}-12-02`
    : `${endYear}-${padded(profile.endMonth)}-17`)
  const rotating = [...clubIds]
  const half = rotating.length / 2
  let previousKickoff = 0
  const fixtures: ProFixture[] = []
  for (let round = 0; round < rounds; round++) {
    const firstLeg = round % ((clubIds.length - 1) * 2) < clubIds.length - 1
    const week = round % (clubIds.length - 1)
    const arr = [...rotating]
    for (let turn = 0; turn < week; turn++) arr.splice(1, 0, arr.pop()!)
    let kickoff = start + Math.round(round * (end - start) / (rounds - 1) / DAY) * DAY
    if (rounds <= 40) kickoff += ((6 - new Date(kickoff).getUTCDay() + 7) % 7) * DAY
    // Crowded second divisions need midweek rounds; leave at least three days between rounds.
    while (isInPeriod(iso(kickoff), profile.breaks) || kickoff <= previousKickoff + 2 * DAY) kickoff += DAY
    previousKickoff = kickoff
    for (let pair = 0; pair < half; pair++) {
      const home = arr[pair]
      const away = arr[arr.length - 1 - pair]
      const [h, a] = (week + pair) % 2 === 0 ? [home, away] : [away, home]
      const reverse = scottishLower ? Math.floor(round / (clubIds.length - 1)) % 2 === 1 : !firstLeg
      let homeId = reverse ? a : h
      let awayId = reverse ? h : a
      if (scottishSplit && round >= 22) {
        // The third Premiership round robin must balance 16/17 home matches.
        // Reusing first-leg orientations produces 11-home/22-away extremes.
        const firstIndex = clubIds.indexOf(home)
        const secondIndex = clubIds.indexOf(away)
        const distance = (secondIndex - firstIndex + clubIds.length) % clubIds.length
        const firstHosts = distance < clubIds.length / 2 ||
          distance === clubIds.length / 2 && firstIndex < secondIndex
        homeId = firstHosts ? home : away
        awayId = firstHosts ? away : home
      }
      const id = `fixture-${league.id}-${startYear}-${round + 1}-${pair + 1}`
      const fixture = { id, competitionId, kickoffDate: iso(kickoff), homeId, awayId } satisfies ProFixture
      world.fixtures[id] = fixture
      fixtures.push(fixture)
    }
  }
  return fixtures
}

export function createProWorld(seed: number, currentDate: IsoDate): ProWorldState {
  const world = createEmptyProWorld(currentDate, seed)
  for (const association of PRO_SATELLITE_ASSOCIATIONS) world.associations[association.id] = { ...association }
  const currentYear = Number(currentDate.slice(0, 4))
  for (const league of PRO_LEAGUE_PLAN) {
    const currency = currencies[league.associationId]
    if (!currency) throw new Error(`No currency for ${league.associationId}`)
    world.associations[league.associationId] = { id: league.associationId, name: league.associationName,
      confederation: league.confederation, currency, domesticMode: 'full' }
    const deep = DEEP_DIVISIONS[league.associationId]
    const topCount = plannedClubCount(league.associationId)
    const secondCount = LOWER_DIVISIONS[league.associationId]?.clubs ?? 0
    const grouped = GROUPED_THIRD[league.associationId]
    const thirdCount = (deep?.third ?? 0) + (grouped ? grouped.groups * grouped.clubsPerGroup : 0)
    const fourthGroups = GROUPED_FOURTH[league.associationId]
    const fourthCount = (deep?.fourth ?? 0) + (fourthGroups ? fourthGroups.groups * fourthGroups.clubsPerGroup : 0)
    const fifthGroups = GROUPED_FIFTH[league.associationId]
    const fifthCount = (FIFTH_DIVISIONS[league.associationId] ?? 0) +
      (fifthGroups ? fifthGroups.groups * fifthGroups.clubsPerGroup : 0)
    const clubCount = topCount + secondCount + thirdCount + fourthCount + fifthCount
    for (let i = 0; i < clubCount; i++) {
      const id = `club-${league.associationId}-${padded(i + 1)}`
      let identity = clubName(league, i, i < topCount ? 1 : i < topCount + secondCount ? 2 : i < topCount + secondCount + thirdCount ? 3 : i < topCount + secondCount + thirdCount + fourthCount ? 4 : 5,
      i < topCount ? i : i < topCount + secondCount ? i - topCount : i < topCount + secondCount + thirdCount ? i-topCount-secondCount : i < topCount+secondCount+thirdCount+fourthCount ? i-topCount-secondCount-thirdCount : i-topCount-secondCount-thirdCount-fourthCount)
      const tier = i < topCount ? 1 : i < topCount + secondCount ? 2 : i < topCount + secondCount + thirdCount ? 3 : i < topCount + secondCount + thirdCount + fourthCount ? 4 : 5
      const offset = tier === 1 ? i : tier === 2 ? i - topCount : tier === 3 ? i - topCount - secondCount :
        tier === 4 ? i - topCount - secondCount - thirdCount : i - topCount - secondCount - thirdCount - fourthCount
      const squadStrength = proRatingTarget(league.associationId,tier,offset,
        tier === 1 ? topCount : tier === 2 ? secondCount : tier === 3 ? thirdCount : tier === 4 ? fourthCount : fifthCount,
        league.confederation)
      const reputation = proClubReputationTarget(league.associationId,tier,offset,
        Math.max(35,Math.min(90,squadStrength + Math.floor(proRoll(seed, `${id}:rep`) * 3) - 1)))
      const revenue = Math.round((11_000_000 + reputation * 2_300_000) * (league.mode === 'playable' ? 1.1 : .8))
      const annualSquadCostLimit = Math.floor(revenue * .58)
      const finances: ProClub['finances'] = { clubId: id, currency, annualRevenue: revenue,
        baselineAnnualRevenue: revenue, cash: Math.floor(revenue * .36), debt: 0,
        annualSquadCostLimit, committedAnnualWages: 0,
        committedAnnualBonuses: Math.floor(annualSquadCostLimit * .08),
        committedAnnualTransferCosts: Math.floor(annualSquadCostLimit * .07),
        committedAnnualAgentFees: Math.floor(annualSquadCostLimit * .015),
        reservedAnnualSquadCosts: Math.floor(annualSquadCostLimit * .04),
        committedTransferPayments: Math.floor(revenue * .03), topPlayerAnnualWage: 0,
        roleWageMultiplier: { prospect: .24, rotation: .65, starter: 1, star: 1.45 } }
      const feederGroup = grouped && tier === 3 ? Math.floor(offset / grouped.clubsPerGroup) + 1 :
        fourthGroups && tier === 4 ? Math.floor(offset / fourthGroups.clubsPerGroup) + 1 :
        fifthGroups && tier === 5 ? Math.floor(offset / fifthGroups.clubsPerGroup) + 1 : undefined
      if (feederGroup && regionalCityAnchors[league.associationId]?.[feederGroup - 1]) {
        const city = regionalCityAnchors[league.associationId][feederGroup - 1]
        identity = { city, name: `${city} ${identities[i % identities.length]} ${['County','Town','Athletic','United'][Math.floor(i / 16)%4]}` }
      }
      const club: ProClub = { id, associationId: league.associationId, tier, feederGroup,
        homeRegion: feederGroup ?? (fourthGroups
          ? 1 + (i % fourthGroups.groups) : grouped
            ? 1 + (i % grouped.groups) : fifthGroups
              ? 1 + (i % fifthGroups.groups) : undefined),
        homeRegionCount: grouped && tier === 3 ? grouped.groups : fourthGroups && tier === 4 ? fourthGroups.groups :
          fifthGroups && tier === 5 ? fifthGroups.groups : fourthGroups?.groups ?? grouped?.groups ?? fifthGroups?.groups,
        licenseEligible: true, name: identity.name,
        homeCity: identity.city, stadiumId: `stadium-${id}`, reputation, finances }
      world.clubs[id] = club
      world.stadiums[club.stadiumId] = { id: club.stadiumId, name: `${identity.city} Ground ${padded(i + 1)}`,
        city: identity.city, capacity: 5_000 + Math.round(reputation * 300) }
      world.managers[`manager-${id}`] = { id: `manager-${id}`, clubId: id,
        name: `${firstNames[(i + 3) % firstNames.length]} ${lastNames[(i + 8) % lastNames.length]}`,
        tacticalStyle: ['balanced','possession','counter','pressing'][i % 4], reputation: Math.round(reputation) }
      const squad = createSquad(club, seed, currentYear, squadStrength)
      for (const player of squad) world.players[player.id] = player
      for (const prospect of createAcademyIntake(club, seed, currentYear)) world.academyProspects[prospect.id] = prospect
      finances.committedAnnualWages = squad.reduce((sum, player) => sum + player.annualWage, 0)
      finances.topPlayerAnnualWage = Math.max(...squad.map(player => player.annualWage))
    }
    const startMonth = proCalendarProfile(league.associationId, currentYear).startMonth
    const startYear = Number(currentDate.slice(5, 7)) >= startMonth ? currentYear : currentYear - 1
    newProLeagueSeason(world, league, startYear)
    const second = PRO_LOWER_LEAGUE_PLAN.find(item => item.associationId === league.associationId)
    if (second) newProLeagueSeason(world, second, startYear)
    for (const deeper of PRO_DEEP_LEAGUE_PLAN.filter(item => item.associationId === league.associationId))
      newProLeagueSeason(world, deeper, startYear)
    for (const grouped of PRO_GROUPED_LEAGUE_PLAN.filter(item => item.associationId === league.associationId))
      newProLeagueSeason(world, grouped, startYear)
    for (const fourth of PRO_GROUPED_FOURTH_LEAGUE_PLAN.filter(item => item.associationId === league.associationId))
      newProLeagueSeason(world, fourth, startYear)
    for (const fifth of PRO_FIFTH_LEAGUE_PLAN.filter(item => item.associationId === league.associationId))
      newProLeagueSeason(world, fifth, startYear)
    for (const fifth of PRO_GROUPED_FIFTH_LEAGUE_PLAN.filter(item => item.associationId === league.associationId))
      newProLeagueSeason(world, fifth, startYear)
  }
  return world
}

/** A migration generates one template world. Index its rosters once rather than
 * repeatedly scanning tens of thousands of players for every incoming club.
 */
const generatedRosters = new WeakMap<ProWorldState, {
  players: Map<string, ProPlayer[]>
  prospects: Map<string, ProAcademyProspect[]>
}>()
function templateRosters(generated: ProWorldState) {
  const cached = generatedRosters.get(generated)
  if (cached) return cached
  const players = new Map<string, ProPlayer[]>()
  const prospects = new Map<string, ProAcademyProspect[]>()
  for (const player of Object.values(generated.players)) {
    if (!player.clubId) continue
    const group = players.get(player.clubId) ?? []
    group.push(player)
    players.set(player.clubId, group)
  }
  for (const prospect of Object.values(generated.academyProspects)) {
    const group = prospects.get(prospect.clubId) ?? []
    group.push(prospect)
    prospects.set(prospect.clubId, group)
  }
  const result = { players, prospects }
  generatedRosters.set(generated, result)
  return result
}

/** Existing careers gain new background leagues without replacing an active season. */
export function hydrateNewBackgroundLeagues(world: ProWorldState, generatedWorld?: ProWorldState): void {
  const missing = PRO_LEAGUE_PLAN.filter(league => !world.competitions[league.id])
  if (!missing.length) return
  const generated = generatedWorld ?? createProWorld(world.seed, world.currentDate)
  for (const league of missing) {
    const id = league.associationId
    if (Object.values(world.clubs).some(club => club.associationId === id))
      throw new Error(`Missing league but existing clubs for ${id}`)
    world.associations[id] = generated.associations[id]
    for (const club of Object.values(generated.clubs).filter(club => club.associationId === id)) {
      world.clubs[club.id] = club
      world.stadiums[club.stadiumId] = generated.stadiums[club.stadiumId]
      world.managers[`manager-${club.id}`] = generated.managers[`manager-${club.id}`]
    }
    for (const player of Object.values(generated.players).filter(player => player.nationalityIds.includes(id) && player.clubId && world.clubs[player.clubId]))
      world.players[player.id] = player
    for (const prospect of Object.values(generated.academyProspects).filter(player => player.nationalityIds.includes(id)))
      world.academyProspects[prospect.id] = prospect
    world.competitions[league.id] = generated.competitions[league.id]
    world.standings[league.id] = generated.standings[league.id]
    for (const fixture of Object.values(generated.fixtures).filter(fixture => fixture.competitionId === league.id))
      world.fixtures[fixture.id] = fixture
  }
}

/** Add lower flights to pre-upgrade saves without replacing their existing clubs or records. */
export function hydrateLowerDivisions(world: ProWorldState, generatedWorld?: ProWorldState): void {
  const missing = PRO_LOWER_LEAGUE_PLAN.filter(league => !world.competitions[league.id])
  if (!missing.length) return
  const generated = generatedWorld ?? createProWorld(world.seed, world.currentDate)
  for (const league of missing) {
    const id = league.associationId
    const templates = Object.values(generated.clubs).filter(club => club.associationId === id && club.tier === 2)
    let serial = Math.max(...Object.values(world.clubs).filter(club => club.associationId === id)
      .map(club => Number(club.id.split('-').at(-1)) || 0), plannedClubCount(id) + templates.length)
    for (const template of templates) {
      const clubId = world.clubs[template.id] ? `club-${id}-${padded(++serial)}` : template.id
      const stadiumId = `stadium-${clubId}`
      const club = { ...structuredClone(template), id: clubId, stadiumId,
        finances: { ...structuredClone(template.finances), clubId } }
      world.clubs[clubId] = club
      world.stadiums[stadiumId] = { ...generated.stadiums[template.stadiumId], id: stadiumId }
      world.managers[`manager-${clubId}`] = { ...generated.managers[`manager-${template.id}`], id: `manager-${clubId}`, clubId }
      for (const player of (templateRosters(generated).players.get(template.id) ?? [])) {
        const playerId = player.id.replace(template.id, clubId)
        world.players[playerId] = { ...player, id: playerId, clubId }
      }
      for (const prospect of (templateRosters(generated).prospects.get(template.id) ?? [])) {
        const prospectId = prospect.id.replace(template.id, clubId)
        world.academyProspects[prospectId] = { ...prospect, id: prospectId, clubId }
      }
    }
    newProLeagueSeason(world, league, Number(world.competitions[`top-${id}`].seasonId))
  }
}

/** Older saves receive the national feeder flights without replacing any club or season already played. */
export function hydrateDeepDivisions(world: ProWorldState, generatedWorld?: ProWorldState): void {
  const missing = PRO_DEEP_LEAGUE_PLAN.filter(league => !world.competitions[league.id])
  if (!missing.length) return
  const generated = generatedWorld ?? createProWorld(world.seed, world.currentDate)
  for (const league of missing) {
    const id = league.associationId
    const tier = league.id.startsWith('third-') ? 3 : 4
    const templates = Object.values(generated.clubs).filter(club => club.associationId === id && club.tier === tier)
    let serial = Math.max(0, ...Object.values(world.clubs).filter(club => club.associationId === id)
      .map(club => Number(club.id.split('-').at(-1)) || 0))
    for (const template of templates) {
      const clubId = world.clubs[template.id] ? `club-${id}-${padded(++serial)}` : template.id
      const stadiumId = `stadium-${clubId}`
      world.clubs[clubId] = { ...structuredClone(template), id: clubId, stadiumId,
        finances: { ...structuredClone(template.finances), clubId } }
      world.stadiums[stadiumId] = { ...generated.stadiums[template.stadiumId], id: stadiumId }
      world.managers[`manager-${clubId}`] = { ...generated.managers[`manager-${template.id}`], id: `manager-${clubId}`, clubId }
      for (const player of (templateRosters(generated).players.get(template.id) ?? [])) {
        const playerId = player.id.replace(template.id, clubId)
        world.players[playerId] = { ...player, id: playerId, clubId }
      }
      for (const prospect of (templateRosters(generated).prospects.get(template.id) ?? [])) {
        const prospectId = prospect.id.replace(template.id, clubId)
        world.academyProspects[prospectId] = { ...prospect, id: prospectId, clubId }
      }
    }
    newProLeagueSeason(world, league, Number(world.competitions[`top-${id}`].seasonId))
  }
}

/** Add the grouped feeders to existing saves while retaining every played result. */
/** Supply the new English National League to old saves, without touching previous fixtures. */
export function hydrateFifthDivisions(world: ProWorldState, generatedWorld?: ProWorldState): void {
  const missing = PRO_FIFTH_LEAGUE_PLAN.filter(league => !world.competitions[league.id])
  if (!missing.length) return
  const generated = generatedWorld ?? createProWorld(world.seed, world.currentDate)
  for (const league of missing) {
    const id = league.associationId
    const templates = Object.values(generated.clubs).filter(club => club.associationId === id && club.tier === 5)
    let serial = Math.max(0, ...Object.values(world.clubs).filter(club => club.associationId === id)
      .map(club => Number(club.id.split('-').at(-1)) || 0))
    for (const template of templates) {
      const clubId = world.clubs[template.id] ? `club-${id}-${padded(++serial)}` : template.id
      const stadiumId = `stadium-${clubId}`
      world.clubs[clubId] = { ...structuredClone(template), id: clubId, stadiumId,
        finances: { ...structuredClone(template.finances), clubId } }
      world.stadiums[stadiumId] = { ...generated.stadiums[template.stadiumId], id: stadiumId }
      world.managers[`manager-${clubId}`] = { ...generated.managers[`manager-${template.id}`], id: `manager-${clubId}`, clubId }
      for (const player of (templateRosters(generated).players.get(template.id) ?? [])) {
        const playerId = player.id.replace(template.id, clubId)
        world.players[playerId] = { ...player, id: playerId, clubId }
      }
      for (const prospect of (templateRosters(generated).prospects.get(template.id) ?? [])) {
        const prospectId = prospect.id.replace(template.id, clubId)
        world.academyProspects[prospectId] = { ...prospect, id: prospectId, clubId }
      }
    }
    newProLeagueSeason(world, league, Number(world.competitions[`top-${id}`].seasonId))
  }
}

/** Add German regional fourth-tier groups to existing saves without replaying older seasons. */
export function hydrateGroupedFourthDivisions(world: ProWorldState, generatedWorld?: ProWorldState): void {
  const missing = PRO_GROUPED_FOURTH_LEAGUE_PLAN.filter(league => !world.competitions[league.id])
  if (!missing.length) return
  const generated = generatedWorld ?? createProWorld(world.seed, world.currentDate)
  for (const league of missing) {
    const id = league.associationId
    const group = Number(league.id.split('-').at(-1))
    const templates = Object.values(generated.clubs).filter(club =>
      club.associationId === id && club.tier === 4 && club.feederGroup === group)
    let serial = Math.max(0, ...Object.values(world.clubs).filter(club => club.associationId === id)
      .map(club => Number(club.id.split('-').at(-1)) || 0))
    for (const template of templates) {
      const clubId = world.clubs[template.id] ? `club-${id}-${padded(++serial)}` : template.id
      const stadiumId = `stadium-${clubId}`
      world.clubs[clubId] = { ...structuredClone(template), id: clubId, stadiumId,
        finances: { ...structuredClone(template.finances), clubId } }
      world.stadiums[stadiumId] = { ...generated.stadiums[template.stadiumId], id: stadiumId }
      world.managers[`manager-${clubId}`] = { ...generated.managers[`manager-${template.id}`], id: `manager-${clubId}`, clubId }
      for (const player of (templateRosters(generated).players.get(template.id) ?? [])) {
        const playerId = player.id.replace(template.id, clubId)
        world.players[playerId] = { ...player, id: playerId, clubId }
      }
      for (const prospect of (templateRosters(generated).prospects.get(template.id) ?? [])) {
        const prospectId = prospect.id.replace(template.id, clubId)
        world.academyProspects[prospectId] = { ...prospect, id: prospectId, clubId }
      }
    }
    newProLeagueSeason(world, league, Number(world.competitions[`top-${id}`].seasonId))
  }
}

/** Attach the Highland/Lowland tiers to older Scottish saves. */
export function hydrateGroupedFifthDivisions(world: ProWorldState, generatedWorld?: ProWorldState): void {
  const missing = PRO_GROUPED_FIFTH_LEAGUE_PLAN.filter(league => !world.competitions[league.id])
  if (!missing.length) return
  const generated = generatedWorld ?? createProWorld(world.seed, world.currentDate)
  for (const league of missing) {
    const id = league.associationId
    const group = Number(league.id.split('-').at(-1))
    const templates = Object.values(generated.clubs).filter(club =>
      club.associationId === id && club.tier === 5 && club.feederGroup === group)
    let serial = Math.max(0, ...Object.values(world.clubs).filter(club => club.associationId === id)
      .map(club => Number(club.id.split('-').at(-1)) || 0))
    for (const template of templates) {
      const clubId = world.clubs[template.id] ? `club-${id}-${padded(++serial)}` : template.id
      const stadiumId = `stadium-${clubId}`
      world.clubs[clubId] = { ...structuredClone(template), id: clubId, stadiumId,
        finances: { ...structuredClone(template.finances), clubId } }
      world.stadiums[stadiumId] = { ...generated.stadiums[template.stadiumId], id: stadiumId }
      world.managers[`manager-${clubId}`] = { ...generated.managers[`manager-${template.id}`], id: `manager-${clubId}`, clubId }
      for (const player of (templateRosters(generated).players.get(template.id) ?? [])) {
        const playerId = player.id.replace(template.id, clubId)
        world.players[playerId] = { ...player, id: playerId, clubId }
      }
      for (const prospect of (templateRosters(generated).prospects.get(template.id) ?? [])) {
        const prospectId = prospect.id.replace(template.id, clubId)
        world.academyProspects[prospectId] = { ...prospect, id: prospectId, clubId }
      }
    }
    newProLeagueSeason(world, league, Number(world.competitions[`top-${id}`].seasonId))
  }
}

export function hydrateGroupedDivisions(world: ProWorldState, generatedWorld?: ProWorldState): void {
  const missing = PRO_GROUPED_LEAGUE_PLAN.filter(league => !world.competitions[league.id])
  if (!missing.length) return
  const generated = generatedWorld ?? createProWorld(world.seed, world.currentDate)
  for (const league of missing) {
    const id = league.associationId
    const group = Number(league.id.split('-').at(-1))
    const templates = Object.values(generated.clubs).filter(club => club.associationId === id && club.tier === 3 && club.feederGroup === group)
    let serial = Math.max(0, ...Object.values(world.clubs).filter(club => club.associationId === id)
      .map(club => Number(club.id.split('-').at(-1)) || 0))
    for (const template of templates) {
      const clubId = world.clubs[template.id] ? `club-${id}-${padded(++serial)}` : template.id
      const stadiumId = `stadium-${clubId}`
      world.clubs[clubId] = { ...structuredClone(template), id: clubId, stadiumId,
        finances: { ...structuredClone(template.finances), clubId } }
      world.stadiums[stadiumId] = { ...generated.stadiums[template.stadiumId], id: stadiumId }
      world.managers[`manager-${clubId}`] = { ...generated.managers[`manager-${template.id}`], id: `manager-${clubId}`, clubId }
      for (const player of (templateRosters(generated).players.get(template.id) ?? [])) {
        const playerId = player.id.replace(template.id, clubId)
        world.players[playerId] = { ...player, id: playerId, clubId }
      }
      for (const prospect of (templateRosters(generated).prospects.get(template.id) ?? [])) {
        const prospectId = prospect.id.replace(template.id, clubId)
        world.academyProspects[prospectId] = { ...prospect, id: prospectId, clubId }
      }
    }
    newProLeagueSeason(world, league, Number(world.competitions[`top-${id}`].seasonId))
  }
}
