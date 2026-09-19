import type { Position } from '../types/attributes'
import type {
  AcademyClub, SundayLeagueClub, YouthCalendarBlock, YouthCompetition, YouthNpcPlayer,
  YouthFinanceState, YouthPathwayState, YouthSchool, YouthSchoolSquads, YouthScoutingProfile, YouthWorld,
} from '../types/youthWorld'

function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function seeded(seed: string) {
  let x = hashSeed(seed) || 1
  return () => {
    x += 0x6D2B79F5
    let t = x
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DISTRICTS = [
  { id:'north',name:'North Region' },{ id:'north-east',name:'North East Region' },
  { id:'east',name:'East Region' },{ id:'south-east',name:'South East Region' },
  { id:'south',name:'South Region' },{ id:'south-west',name:'South West Region' },
  { id:'west',name:'West Region' },{ id:'central',name:'Central Region' },
]

const COUNTRY_SCHOOLS:Record<string,string[]>={eng:['Westview','Greenwood','Riverside','Kingsway','Northridge','Parkside','Hillcrest','Lakeside','St Andrews','Central'],rsa:['Mamelodi','Soweto','Tshwane','Alexandra','Diepsloot','Katlehong','Atteridgeville','Ga-Rankuwa','Mdantsane','Khayelitsha'],bra:['Santos','Paulista','Carioca','Ipanema','Campinas','Bahia'],arg:['Rosario','Cordoba','Mendoza','La Plata','Santa Fe'],fra:['Lyonnais','Marseille','Bordeaux','Lille','Nantes'],ger:['Rhein','Munich','Dortmund','Hamburg','Leipzig'],esp:['Valencia','Sevilla','Bilbao','Catalunya','Madrid'],nga:['Lagos','Abuja','Kano','Ibadan','Enugu'],gha:['Accra','Kumasi','Tamale','Cape Coast'],usa:['Brooklyn','Austin','Miami','Seattle','Phoenix']}
const SCHOOL_SUFFIX = ['High','Secondary','College','Academy']
const FIRST = ['Liam','Musa','Teboho','Jayden','Aiden','Kabelo','Ethan','Siyanda','Noah','Lethabo','Reece','Kamo','Luke','Thabo','Daniel','Aphiwe','Neo','Marcus','Kofi','Sam']
const LAST = ['Mokoena','Jacobs','Smith','Maseko','Dlamini','Adams','Nkosi','Williams','Mahlangu','Brown','Ndlovu','Mthembu','Peters','Molefe','Naidoo','Clarke','Mensah','Daniels','Khumalo','Botha']
const POSITIONS: Position[] = ['GK','CB','CB','FB','FB','CM','CM','WM','WG','WG','ST']

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)) }
function pick<T>(r: () => number, xs: T[]): T { return xs[Math.floor(r() * xs.length)] }

function makeNpc(r: () => number, school: YouthSchool, tier: YouthNpcPlayer['squadTier'], i: number): YouthNpcPlayer {
  const tierAdj = tier === 'first-team' ? 3 : tier === 'reserve' ? -2 : -7
  const overall = clamp(Math.round(school.footballRating + tierAdj + (r() - .5) * 16), 38, 82)
  return {
    id: `${school.id}-${tier}-${i}`,
    name: `${pick(r, FIRST)} ${pick(r, LAST)}`,
    age: tier === 'development' ? (r() < .7 ? 13 : 14) : (r() < .55 ? 14 : 15),
    position: POSITIONS[i % POSITIONS.length],
    overall,
    potentialBand: r() > .96 ? 'elite' : r() > .78 ? 'high' : r() < .14 ? 'low' : 'normal',
    form: Math.round((5.8 + r() * 1.5) * 10) / 10,
    energy: Math.round(78 + r() * 22),
    squadTier: tier,
  }
}

function makeSquads(r: () => number, school: YouthSchool): YouthSchoolSquads {
  return {
    firstTeam: Array.from({ length: 20 }, (_, i) => makeNpc(r, school, 'first-team', i)),
    reserve: Array.from({ length: 18 }, (_, i) => makeNpc(r, school, 'reserve', i)),
    development: Array.from({ length: 14 }, (_, i) => makeNpc(r, school, 'development', i)),
  }
}

function schoolIdentity(index: number, country='eng') {
  const pool=COUNTRY_SCHOOLS[country]??COUNTRY_SCHOOLS.eng
  const prefix=pool[index%pool.length]
  const suffix = SCHOOL_SUFFIX[Math.floor(index / pool.length) % SCHOOL_SUFFIX.length]
  return { id: `${prefix}-${suffix}-${index}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: `${prefix} ${suffix}` }
}

function generateSchools(r: () => number,country='eng'): YouthSchool[] {
  const schools = Array.from({ length: 640 }, (_, i) => {
    const identity = schoolIdentity(i,country)
    const district = DISTRICTS[Math.floor(i / 80) % DISTRICTS.length]
    const prestigeBase = i === 0 ? 78 : i === 1 ? 62 : i === 2 ? 48 : 40 + Math.round(r() * 38)
    // School football uses a youth scale: elite school XIs live around the mid-50s,
    // ordinary teams in the 40s. Senior/pro-looking 65-80 OVR schools were a V4 leak.
    const rating = clamp(Math.round(38 + prestigeBase * .18 + (r() - .5) * 8), 36, 58)
    const school: YouthSchool = {
      ...identity,
      districtId: district.id,
      colours: i % 3 === 0 ? ['#d4af37','#111111'] : i % 3 === 1 ? ['#ffffff','#17355c'] : ['#be2332','#ffffff'],
      prestige: prestigeBase,
      footballRating: rating,
      coaching: clamp(rating + Math.round((r() - .5) * 12), 42, 88),
      facilities: clamp(prestigeBase + Math.round((r() - .5) * 16), 35, 92),
      youthDevelopment: clamp(rating + Math.round((r() - .5) * 14), 40, 90),
      scoutExposure: clamp(Math.round((.55 + prestigeBase / 100) * 100) / 100, .65, 1.45),
      style: pick(r, ['possession','direct','counter','pressing','balanced'] as const),
      rivalId: null,
      intakeStrength: clamp(Math.round(rating + (r() - .5) * 14), 40, 88),
    }
    return school
  })
  for (let i = 0; i < schools.length; i += 2) {
    if (schools[i + 1]) {
      schools[i].rivalId = schools[i + 1].id
      schools[i + 1].rivalId = schools[i].id
    }
  }
  return schools
}

function generateAcademyClubs(r: () => number): AcademyClub[] {
  // V4 Academy World: fictional identities deliberately echo the geography and
  // football culture of recognisable real academies without using protected
  // club names, crests or trademarks. This gives trial offers a real global
  // football map instead of the old generic 12-club pool.
  const clubs = [
    ['west-london-blues','West London Blues','England',94],
    ['north-london-reds','North London Reds','England',90],
    ['manchester-sky','Manchester Sky','England',95],
    ['mersey-reds','Mersey Reds','England',93],
    ['madrid-whites','Madrid Whites','Spain',97],
    ['catalonia-blau','Catalonia Blau','Spain',96],
    ['madrid-rojos','Madrid Rojos','Spain',91],
    ['munich-reds','Munich Reds','Germany',96],
    ['dortmund-yellows','Dortmund Yellows','Germany',92],
    ['paris-blue','Paris Blue','France',94],
    ['lyon-youth','Lyon Youth','France',89],
    ['milan-redblack','Milan Redblack','Italy',91],
    ['turin-blackwhite','Turin Blackwhite','Italy',92],
    ['amsterdam-redwhite','Amsterdam Redwhite','Netherlands',95],
    ['eindhoven-red','Eindhoven Red','Netherlands',90],
    ['lisbon-eagles','Lisbon Eagles','Portugal',94],
    ['porto-dragons','Porto Dragons','Portugal',91],
    ['brussels-purple','Brussels Purple','Belgium',86],
    ['sao-paulo-saints','São Paulo Saints','Brazil',91],
    ['rio-rubro','Rio Rubro','Brazil',90],
    ['buenos-aires-bluegold','Buenos Aires Bluegold','Argentina',92],
    ['buenos-aires-redwhite','Buenos Aires Redwhite','Argentina',91],
    ['johannesburg-gold','Johannesburg Gold','South Africa',84],
    ['pretoria-sundowns','Pretoria Sundowns','South Africa',87],
  ] as const
  const positions: Position[] = ['GK','CB','FB','CM','WM','WG','ST']
  return clubs.map(([id,name,region,base]) => {
    const positionNeeds: Partial<Record<Position, number>> = {}
    for (const p of positions) positionNeeds[p] = Math.round(35 + r() * 60)
    return {
      id: `academy-${id}`,
      name,
      region,
      prestige: clamp(Math.round(base + (r() - .5) * 5), 78, 99),
      coaching: clamp(Math.round(base - 4 + r() * 8), 74, 99),
      facilities: clamp(Math.round(base - 3 + r() * 8), 72, 99),
      positionNeeds,
    }
  })
}

function initialFinances(seed:string): YouthFinanceState {
  const r=seeded(seed+'|finance')
  const familySupportLevel = r() < .2 ? 'limited' : r() > .86 ? 'strong' : 'normal'
  const balance = familySupportLevel === 'limited' ? 18 : familySupportLevel === 'strong' ? 42 : 28
  return {
    balance,
    familySupportLevel,
    familyAllowancePerMonth: familySupportLevel === 'limited' ? 12 : familySupportLevel === 'strong' ? 24 : 18,
    lastAllowanceWeek:0,
    transportPass:false,
    transportPasses:0,
    recoveryCredits:0,
    bootsCondition:82,
    weeklyPersonalBudget:familySupportLevel === 'limited' ? 5 : familySupportLevel === 'strong' ? 10 : 7,
    totalEarned:balance,
    totalSpent:0,
    transactions:[{
      id:'opening-balance',week:1,amount:balance,category:'allowance',
      description:'Starting pocket money / family support.',
    }],
  }
}

function initialScouting(academies: AcademyClub[]): YouthScoutingProfile {
  const academyInterest: YouthScoutingProfile['academyInterest'] = {}
  for (const club of academies) {
    academyInterest[club.id] = {
      clubId: club.id, awareness: 0, interest: 0, lastSeenWeek: null,
      matchesSeen: 0, status: 'unknown',
    }
  }
  return {
    localVisibility: 0,
    schoolReputation: 0,
    grassrootsReputation: 0,
    regionalReputation: 0,
    academyExposure: 0,
    academyInterest,
    knownScoutVisits: [],
  }
}

function generateSundayClubs(r: () => number,country='eng'): SundayLeagueClub[] {
  const ROOTS:Record<string,string[]>={eng:['City Stars','Young Lions','Athletic Juniors','United Youth','Community FC','Dynamos','Rovers','Sporting','Warriors','Future Stars','Town FC','Olympians'],rsa:['Mzansi Stars','Township United','Young Bucks','Amazulu Juniors','Community Aces','Diski United','Ubuntu Rovers','Kasi Chiefs','Young Brazilians','Future Stars','City Warriors','Development XI'],bra:['Jovens FC','Estrela','Atletico Junior','Uniao Youth','Futuro FC','Sporting Juniors'],arg:['Juniors Unidos','Barrio FC','Atletico Juvenil','Estrella Sur','Deportivo Youth'],nga:['Naija Stars','Lagos Juniors','United Youth','Community Eagles','Future FC'],gha:['Accra Stars','Young Lions','Community XI','Future Stars','United Juniors']}
  const roots=ROOTS[country]??ROOTS.eng
  return Array.from({ length: 16 }, (_, i) => ({
    id: `sunday-${i + 1}`,
    name: `${DISTRICTS[i % DISTRICTS.length].name.replace(' Region','')} ${roots[i % roots.length]}`,
    districtId: DISTRICTS[i % DISTRICTS.length].id,
    strength: Math.round(48 + r() * 27),
    coaching: Math.round(45 + r() * 35),
    exposure: Math.round((.55 + r() * .8) * 100) / 100,
    pathwayFocus: pick(r, ['minutes','development','results'] as const),
    transportSupport: pick(r, ['none','partial','partial','full'] as const),
  }))
}

export const YOUTH_COMPETITIONS: YouthCompetition[] = [
  { id:'preseason-friendlies', name:'School Preseason', kind:'friendly', prestige:1, monthStart:1, monthEnd:1, matchDay:'thursday', eligibleSquads:['first-team','reserve'], format:{type:'friendlies',targetMatches:2} },
  { id:'inter-schools', name:'Inter-Schools League', kind:'school-league', prestige:2, monthStart:2, monthEnd:6, matchDay:'thursday', eligibleSquads:['first-team'], format:{type:'league',teams:10,rounds:18} },
  { id:'reserve-league', name:'Inter-Schools Reserve League', kind:'reserve-league', prestige:1, monthStart:3, monthEnd:9, matchDay:'thursday', eligibleSquads:['reserve'], format:{type:'league',teams:8,rounds:7} },
  { id:'regional-schools', name:'Regional Schools Championship', kind:'school-cup', prestige:4, monthStart:4, monthEnd:5, matchDay:'thursday', eligibleSquads:['first-team'], format:{type:'groups-knockout',teams:24,groups:4,groupSize:6,qualifyPerGroup:2} },
  { id:'minor-school-cups', name:'School Invitationals', kind:'minor-school-cup', prestige:2, monthStart:6, monthEnd:9, matchDay:'thursday', eligibleSquads:['first-team','reserve'], format:{type:'knockout',teams:8} },
  { id:'sunday-league', name:'Grassroots League', kind:'sunday-league', prestige:2, monthStart:2, monthEnd:9, matchDay:'sunday', eligibleSquads:['first-team','reserve','development','cut'], format:{type:'league',teams:12,rounds:22} },
  { id:'regional-selection', name:'Regional Selection Camp', kind:'regional-selection', prestige:5, monthStart:6, monthEnd:6, matchDay:'mixed', eligibleSquads:['first-team','reserve'], format:{type:'selection',longlist:60,camp:35,finalSquad:23} },
  { id:'national-schools', name:'National Youth Championship', kind:'national-championship', prestige:7, monthStart:7, monthEnd:7, matchDay:'mixed', eligibleSquads:['first-team','reserve'], format:{type:'groups-knockout',teams:8,groups:2,groupSize:4,qualifyPerGroup:2} },
  { id:'youth-showcase', name:'Youth Showcase', kind:'showcase', prestige:6, monthStart:10, monthEnd:10, matchDay:'saturday', eligibleSquads:['first-team','reserve','development','cut'], format:{type:'showcase',matches:2} },
  { id:'academy-window', name:'Academy Trial Window', kind:'academy-trial', prestige:8, monthStart:10, monthEnd:10, matchDay:'mixed', eligibleSquads:['first-team','reserve','development','cut'], format:{type:'trial',sessions:3} },
]

export const YOUTH_CALENDAR: YouthCalendarBlock[] = [
  {id:'jan-trials',weeks:[1,3],month:1,title:'Opening Trials',primary:'training',sundayLeagueAvailable:false,notes:'Three-week route-specific trials.'},
  {id:'jan-friendlies',weeks:[4,5],month:1,title:'Preseason Friendlies',primary:'friendly',schoolMatchDay:'thursday',sundayLeagueAvailable:false,notes:'Two friendlies after trials.'},
  {id:'feb-jun-league',weeks:[6,23],month:2,title:'Main League Season',primary:'school-league',schoolMatchDay:'thursday',sundayLeagueAvailable:true,notes:'School: 10 teams, 18 home/away rounds. Grassroots league runs through September.'},
  {id:'jul-aug-regional',weeks:[24,28],month:7,title:'Regional / Development Competition',primary:'school-cup',schoolMatchDay:'thursday',sundayLeagueAvailable:true,notes:'Qualified schools play five regional group matches; eliminated schools play five development matches.'},
  {id:'aug-selection',weeks:[29,31],month:8,title:'Regional Selection Camp',primary:'regional-selection',sundayLeagueAvailable:true,notes:'Persistent 60 → 35 → 23 selection.'},
  {id:'sep-national',weeks:[32,35],month:9,title:'National Schools Championship',primary:'national-championship',sundayLeagueAvailable:true,notes:'Eight regional representative squads.'},
  {id:'october',weeks:[36,40],month:10,title:'October Competition / Academy Assessment',primary:'showcase',sundayLeagueAvailable:true,notes:'Four-match five-team competition with one bye, or academy assessment.'},
  {id:'november',weeks:[41,43],month:11,title:'International / Festival Window',primary:'showcase',sundayLeagueAvailable:false,notes:'Representative international football or optional three-day 40-minute festival.'},
  {id:'december',weeks:[44,48],month:12,title:'Season Close',primary:'off-season',sundayLeagueAvailable:false,notes:'Awards, contracts, recovery and season transition.'},
]

export function initialPathway(route: 'school' | 'grassroots' = 'school'): YouthPathwayState {
  return {
    route, schoolTier: route === 'school' ? 'development' : 'cut', firstTeamRole:null, schoolTierSinceWeek:0,
    sundayClubId:null, representative:'none', academyStatus:'none',
    exposure:{school:0,grassroots:0,regional:0,academy:0},
    selectionScore:0, pendingSundayApproaches:[], history:[],
  }
}

export function createYouthWorld(seed: string, selectedSchoolId: string | null = null, seasonYear = 1, route: 'school' | 'grassroots' = 'school', country='eng'): YouthWorld {
  const r = seeded(seed+'|'+country)
  const schools = generateSchools(r,country)
  const schoolSquads: Record<string, YouthSchoolSquads> = {}
  for (const school of schools) schoolSquads[school.id] = makeSquads(r, school)
  const academyClubs = generateAcademyClubs(r)
  return {
    version:1, seed, seasonYear, currentWeek:1, selectedSchoolId,
    districts:DISTRICTS, schools, schoolSquads,
    sundayClubs:generateSundayClubs(r,country),
    academyClubs,
    scouting:initialScouting(academyClubs),
    competitionWorld:{ interSchools:null,reserveLeague:null,regionalSchools:null,minorSchoolCup:null,sundayLeague:null,nationalChampionship:null,statBooks:{} },
    finances:initialFinances(seed),
    competitions:YOUTH_COMPETITIONS,
    calendar:YOUTH_CALENDAR,
    pathway:initialPathway(route),
  }
}

export function schoolById(world: YouthWorld, id: string | null) {
  return id ? world.schools.find(s => s.id === id) : undefined
}

export function calendarBlockForWeek(world: YouthWorld, week: number) {
  return world.calendar.find(b => week >= b.weeks[0] && week <= b.weeks[1])
}
