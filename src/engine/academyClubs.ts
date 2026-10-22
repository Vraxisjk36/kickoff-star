import { NATIONS } from './nations'
import { generateTeam, type Team } from './teams'
import { rand } from './rng'
import { computeCurrentAbility, toOvr } from './rating'
import type { Player } from '../types/player'

// Fictional club identities, each anchored to an actual senior club and city.
// The reference is for balancing/debugging only; no official badges or marks.
// Tiers express academy investment and competition level, not senior results.
interface AcademyProfile { name: string; tier: number; reference: string }
const ENTRIES: Record<string, string[]> = {
  eng: ['Manchester Sky|10|Manchester City','West London Blues|9|Chelsea','North London Gunners|9|Arsenal','Merseyside Reds|9|Liverpool','Manchester Reds|8|Manchester United','North London Lilywhites|8|Tottenham Hotspur','Birmingham Villans|8|Aston Villa','Tyneside United|7|Newcastle United','Brighton Albion|7|Brighton & Hove Albion','East London Hammers|6|West Ham United','Leicester Foxes|6|Leicester City','Southampton Saints|6|Southampton'],
  esp: ['Madrid Whites|10|Real Madrid','Barcelona Blau|10|FC Barcelona','Madrid Stripes|9|Atlético de Madrid','Seville Reds|8|Sevilla FC','Bilbao Lions|8|Athletic Club','San Sebastián Blue|8|Real Sociedad','Villarreal Gold|7|Villarreal CF','Valencia Bats|7|Valencia CF','Girona Reds|7|Girona FC','Betis Greens|7|Real Betis','Pamplona Reds|6|CA Osasuna','Celta Vigo Sky|6|RC Celta','Getafe Blues|6|Getafe CF','Espanyol Blue|6|RCD Espanyol','Mallorca Reds|5|RCD Mallorca','Alavés Blue|5|Deportivo Alavés'],
  rsa: ['Pretoria Sundowns|8|Mamelodi Sundowns','Johannesburg Chiefs|7|Kaizer Chiefs','Soweto Pirates|7|Orlando Pirates','Stellenbosch United|7|Stellenbosch FC','Matsatsantsa Pretoria|6|SuperSport United','Durban Arrows|6|Golden Arrows','KZN AmaZulu|6|AmaZulu FC','Polokwane City|5|Polokwane City','Sekhukhune Hills|5|Sekhukhune United','Chippa Eastern Cape|5|Chippa United','Richards Bay Blue|5|Richards Bay FC','Mpumalanga Galaxy|5|TS Galaxy'],
  bra: ['Santos Coast|9|Santos FC','São Paulo Red and Black|9|São Paulo FC','Rio Red and Black|9|Flamengo','Palmeiras Green|9|SE Palmeiras','Rio Tricolour|8|Fluminense','Rio Black and White|8|Botafogo','Porto Alegre Red|8|SC Internacional','Porto Alegre Blue|8|Grêmio','Belo Horizonte Blue|7|Cruzeiro','Belo Horizonte Stripes|7|Atlético Mineiro','Corinthians Black|7|Corinthians','Bahia Blue|6|EC Bahia'],
  arg: ['Buenos Aires Blue and Gold|9|Boca Juniors','River Plate Red Sash|9|River Plate','Avellaneda Red|8|Independiente','Avellaneda Blue|8|Racing Club','La Plata Blue|7|Gimnasia y Esgrima La Plata','La Plata Stripes|7|Estudiantes','Rosario Blue and Gold|7|Rosario Central','Rosario Red and Black|7|Newells Old Boys','Boedo Blue|7|San Lorenzo','Liniers White|7|Vélez Sarsfield','Córdoba Blue|6|Talleres','La Paternal Reds|6|Argentinos Juniors'],
  fra: ['Paris Blue|10|Paris Saint-Germain','Lyon White|9|Olympique Lyonnais','Monaco Red|9|AS Monaco','Marseille Blue|8|Olympique de Marseille','Lille Red|8|Lille OSC','Rennes Red|8|Stade Rennais','Lens Gold|7|RC Lens','Nice Red and Black|7|OGC Nice','Strasbourg Blue|7|RC Strasbourg','Nantes Yellow|6|FC Nantes','Toulouse Violet|6|Toulouse FC','Montpellier Blue|6|Montpellier HSC'],
  ger: ['Munich Red|10|Bayern München','Dortmund Yellow|9|Borussia Dortmund','Leverkusen Red|9|Bayer Leverkusen','Leipzig Red|8|RB Leipzig','Stuttgart White|8|VfB Stuttgart','Frankfurt Eagles|7|Eintracht Frankfurt','Freiburg Red|7|SC Freiburg','Wolfsburg Green|7|VfL Wolfsburg','Berlin Union|6|Union Berlin','Mönchengladbach Foals|6|Borussia Mönchengladbach','Bremen Green|6|Werder Bremen','Hamburg Blue|6|Hamburger SV'],
  ita: ['Milan Red|9|AC Milan','Milan Blue|9|Internazionale','Turin Stripes|9|Juventus','Bergamo Black|9|Atalanta','Rome Red|8|AS Roma','Rome Sky|8|Lazio','Naples Blue|8|Napoli','Florence Violet|7|Fiorentina','Bologna Red|7|Bologna FC','Turin Maroon|6|Torino FC','Genoa Red and Blue|6|Genoa CFC','Udine Black|6|Udinese'],
  por: ['Lisbon Red|9|Benfica','Lisbon Green|9|Sporting CP','Porto Blue|9|FC Porto','Braga Red|8|SC Braga','Guimarães White|7|Vitória SC','Famalicão Blue|7|FC Famalicão','Estoril Gold|6|Estoril Praia','Rio Ave Green|6|Rio Ave FC','Gil Vicente Red|6|Gil Vicente','Boavista Checks|6|Boavista FC','Arouca Blue|5|FC Arouca','Moreira Green|5|Moreirense'],
  ned: ['Amsterdam Red|9|Ajax','Eindhoven Red|9|PSV','Rotterdam Red|8|Feyenoord','Alkmaar Red|8|AZ Alkmaar','Utrecht Red|7|FC Utrecht','Twente Red|7|FC Twente','Heerenveen Blue|6|SC Heerenveen','Arnhem Yellow|6|Vitesse','Groningen Green|6|FC Groningen','Nijmegen Red|6|NEC Nijmegen','Sparta Rotterdam|6|Sparta Rotterdam','Zwolle Blue|5|PEC Zwolle'],
  bel: ['Anderlecht Purple|9|RSC Anderlecht','Bruges Blue|9|Club Brugge','Genk Blue|8|KRC Genk','Antwerp Red|8|Royal Antwerp','Ghent Blue|7|KAA Gent','Liège Red|7|Standard Liège','Brussels Union|7|Union Saint-Gilloise','Mechelen Yellow|6|KV Mechelen','Leuven White|6|OH Leuven','Charleroi Stripes|6|Sporting Charleroi','Cercle Bruges|6|Cercle Brugge','Westerlo Yellow|5|KVC Westerlo'],
  nga: ['Lagos Sporting|8|Sporting Lagos','Enyimba Aba|8|Enyimba FC','Rivers United|7|Rivers United','Kano Pillars|7|Kano Pillars','Remo Sky|7|Remo Stars','Plateau United|6|Plateau United','Shooting Stars Ibadan|6|Shooting Stars','Rangers Enugu|6|Enugu Rangers','Akwa United|6|Akwa United','Bayelsa United|5|Bayelsa United','Sunshine Akure|5|Sunshine Stars','Bendel Insurance|5|Bendel Insurance'],
  gha: ['Accra Hearts|8|Hearts of Oak','Kumasi Porcupines|8|Asante Kotoko','Dreams Accra|7|Dreams FC','Medeama Yellow|7|Medeama SC','Samartex Green|7|FC Samartex','Berekum Chelsea|6|Berekum Chelsea','Bechem United|6|Bechem United','Aduana Stars|6|Aduana Stars','Legon Cities|5|Legon Cities','Nations Abrankese|5|Nations FC','Bibiani Gold|5|Bibiani Gold Stars','Karela United|5|Karela United'],
  sen: ['Dakar Génération|9|Génération Foot','Dakar Diambars|8|Diambars FC','Dakar Jaraaf|7|ASC Jaraaf','Dakar US Gorée|7|US Gorée','Rufisque Teungueth|7|Teungueth FC','Thiès CNEPS|6|CNEPS Excellence','Guédiawaye Blue|6|Guédiawaye FC','Pikine Red|6|AS Pikine','Casa Sports Green|6|Casa Sports','Mbour Stade|5|Stade de Mbour','Linguère Saint-Louis|5|ASC Linguère','Dakar Douanes|5|AS Douanes'],
  mar: ['Rabat Army|9|AS FAR','Casablanca Wydad|9|Wydad AC','Casablanca Raja|9|Raja CA','Berkane Orange|8|RS Berkane','Fès Maghreb|7|MAS Fès','FUS Rabat|7|FUS Rabat','Agadir Hassania|6|Hassania Agadir','Tetouan Moghreb|6|Moghreb Tétouan','Safi Olympic|6|Olympic Safi','Zemamra Blue|6|Renaissance Zemamra','Tangier Union|5|IR Tanger','Meknès Club|5|CODM Meknès'],
  usa: ['Philadelphia Union Youth|9|Philadelphia Union','Dallas Youth|9|FC Dallas','New York Red Youth|8|New York Red Bulls','Los Angeles Galaxy Youth|8|LA Galaxy','Seattle Green Youth|8|Seattle Sounders','Columbus Gold Youth|8|Columbus Crew','Atlanta United Youth|8|Atlanta United','Miami Pink Youth|7|Inter Miami','New York City Youth|7|New York City FC','Kansas City Sporting Youth|7|Sporting Kansas City','Portland Green Youth|7|Portland Timbers','Salt Lake Youth|6|Real Salt Lake'],
  mex: ['América Yellow|9|Club América','Guadalajara Red|9|Guadalajara','Monterrey Stripes|8|CF Monterrey','Tigres Gold|8|Tigres UANL','Pachuca Blue|8|CF Pachuca','Santos Laguna Green|7|Santos Laguna','Toluca Red|7|Deportivo Toluca','Cruz Azul Blue|7|Cruz Azul','Pumas Gold|7|Pumas UNAM','León Green|6|Club León','Atlas Red and Black|6|Atlas FC','Tijuana Red|6|Club Tijuana'],
  jpn: ['Kawasaki Blue|9|Kawasaki Frontale','Yokohama Blue|9|Yokohama F. Marinos','Urawa Red|8|Urawa Red Diamonds','Kashima Red|8|Kashima Antlers','Tokyo Blue|8|FC Tokyo','Osaka Pink|8|Cerezo Osaka','Osaka Black|7|Gamba Osaka','Hiroshima Violet|7|Sanfrecce Hiroshima','Kobe Crimson|7|Vissel Kobe','Kashiwa Yellow|7|Kashiwa Reysol','Nagoya Red|6|Nagoya Grampus','Kyoto Purple|6|Kyoto Sanga'],
  kor: ['Ulsan Blue|9|Ulsan HD','Pohang Red|8|Pohang Steelers','Jeonbuk Green|8|Jeonbuk Hyundai','Seoul Red|8|FC Seoul','Suwon Blue|7|Suwon Samsung','Incheon Blue|7|Incheon United','Daejeon Purple|7|Daejeon Hana Citizen','Daegu Blue|7|Daegu FC','Gwangju Yellow|7|Gwangju FC','Jeju Orange|6|Jeju United','Gangwon Orange|6|Gangwon FC','Busan Red|6|Busan IPark'],
  aus: ['Melbourne City Youth|9|Melbourne City','Sydney Sky Youth|8|Sydney FC','Melbourne Victory Youth|8|Melbourne Victory','Adelaide Red Youth|8|Adelaide United','Western Sydney Red Youth|7|Western Sydney Wanderers','Central Coast Yellow Youth|7|Central Coast Mariners','Perth Purple Youth|7|Perth Glory','Brisbane Orange Youth|7|Brisbane Roar','Newcastle Jets Youth|6|Newcastle Jets','Wellington Gold Youth|6|Wellington Phoenix','Macarthur Black Youth|6|Macarthur FC','Western United Youth|6|Western United'],
  sco: ['Glasgow Celtic Youth|9|Celtic','Glasgow Rangers Youth|9|Rangers','Aberdeen Red Youth|7|Aberdeen','Edinburgh Hearts Youth|7|Heart of Midlothian','Edinburgh Hibs Youth|7|Hibernian','Dundee United Youth|6|Dundee United','Dundee Dark Youth|6|Dundee FC','Motherwell Amber Youth|6|Motherwell','St Mirren Youth|6|St Mirren','Kilmarnock Blue Youth|6|Kilmarnock','Livingston Gold Youth|5|Livingston','St Johnstone Blue Youth|5|St Johnstone'],
  aut: ['Salzburg Red Youth|9|Red Bull Salzburg','Vienna Rapid Youth|8|Rapid Wien','Vienna Austria Youth|8|Austria Wien','Graz Black Youth|8|Sturm Graz','Linz Athletic Youth|7|LASK','Wolfsberg Youth|6|Wolfsberger AC','Hartberg Blue Youth|6|TSV Hartberg','Altach Yellow Youth|6|SCR Altach','Ried Green Youth|6|SV Ried','Innsbruck Youth|5|Wacker Innsbruck','Admira Youth|5|Admira Wacker','Klagenfurt Violet Youth|5|Austria Klagenfurt'],
  sui: ['Basel Red Youth|9|FC Basel','Zürich Grasshopper Youth|8|Grasshopper Club Zürich','Bern Young Youth|8|Young Boys','Zürich Blue Youth|8|FC Zürich','Geneva Servette Youth|7|Servette FC','Lugano Black Youth|7|FC Lugano','Lucerne Blue Youth|7|FC Luzern','St Gallen Green Youth|7|FC St. Gallen','Lausanne Blue Youth|6|Lausanne-Sport','Sion Red Youth|6|FC Sion','Winterthur Red Youth|6|FC Winterthur','Thun Red Youth|6|FC Thun'],
  tur: ['Istanbul Galata Youth|9|Galatasaray','Istanbul Fener Youth|9|Fenerbahçe','Istanbul Besiktas Youth|8|Beşiktaş','Trabzon Maroon Youth|8|Trabzonspor','Istanbul Basak Youth|7|İstanbul Başakşehir','Bursa Green Youth|7|Bursaspor','Izmir Göztepe Youth|7|Göztepe','Antalya Red Youth|6|Antalyaspor','Konya Green Youth|6|Konyaspor','Samsun Red Youth|6|Samsunspor','Adana Blue Youth|6|Adana Demirspor','Ankara Genç Youth|6|Gençlerbirliği'],
}

export const EUROPEAN_ACADEMY_COUNTRIES = ['eng','esp','fra','ger','ita','por','ned','bel','sco','aut','sui','tur'] as const
export function isEuropeanAcademy(countryId?: string): boolean { return !!countryId && EUROPEAN_ACADEMY_COUNTRIES.some(c => c === countryId) }
export function academyProfiles(countryId: string): AcademyProfile[] {
  return (ENTRIES[countryId] ?? ENTRIES.eng).map(row => { const [name, tier, reference] = row.split('|'); return { name, tier: Number(tier), reference } })
}
export function academyClubNames(countryId: string): string[] { return academyProfiles(countryId).map(profile => profile.name) }
export function academyProfileFor(countryId: string, name: string): AcademyProfile | undefined {
  return academyProfiles(countryId).find(profile => profile.name === name)
}

// Academy strength is deliberately independent from team-generation prestige.
// Example: Madrid Whites ~73, Pretoria Sundowns ~53. These are gameplay bands,
// not purported published youth-team ratings.
const COUNTRY_BASE: Record<string, number> = {
  eng: 54, esp: 56, fra: 53, ger: 53, ita: 52, por: 51, ned: 51, bel: 49,
  bra: 51, arg: 50, rsa: 42, nga: 44, gha: 42, sen: 46, mar: 48,
  usa: 48, mex: 48, jpn: 47, kor: 46, aus: 45,
  sco: 49, aut: 49, sui: 49, tur: 49,
}
const PREVIOUS_COUNTRY_BASE: Record<string, number> = {
  eng: 62, esp: 64, fra: 61, ger: 61, ita: 59, por: 58, ned: 58, bel: 55,
  bra: 56, arg: 55, rsa: 42, nga: 44, gha: 42, sen: 46, mar: 49,
  usa: 52, mex: 52, jpn: 51, kor: 48, aus: 47,
  sco: 49, aut: 49, sui: 49, tur: 49,
}
function clamp(value: number, lo: number, hi: number): number { return Math.min(hi, Math.max(lo, value)) }
export function rebalanceAcademyTeam(team: Team): Team {
  if (!team.countryId || team.academyRatingVersion === 2) return team
  const difference = (PREVIOUS_COUNTRY_BASE[team.countryId] ?? 50) - (COUNTRY_BASE[team.countryId] ?? 50)
  const lower = (value: number) => clamp(value - difference, 32, 86)
  return { ...team, academyRatingVersion: 2, ratings: {
    attack: lower(team.ratings.attack), midfield: lower(team.ratings.midfield), defense: lower(team.ratings.defense),
  } }
}
export function academyRatings(countryId: string, tier: number, ageGroup: 'younger' | 'older' = 'younger'): Team['ratings'] {
  const base = (COUNTRY_BASE[countryId] ?? 50) + (tier - 5) * 3 + (ageGroup === 'older' ? 2 : 0)
  const variance = () => Math.round((rand() - 0.5) * 4)
  return { attack: clamp(base + variance(), 32, 86), midfield: clamp(base + variance(), 32, 86), defense: clamp(base + variance(), 32, 86) }
}
/** Separate senior-club display strength; the professional career is an end state. */
export function seniorClubRatings(countryId: string, tier: number): Team['ratings'] {
  const base = clamp((COUNTRY_BASE[countryId] ?? 50) + (tier - 5) * 3 + 17, 50, 91)
  return { attack: base, midfield: base, defense: base }
}
export function academyTeam(countryId: string, profile: AcademyProfile, ageGroup: 'younger' | 'older' = 'younger'): Team {
  const raw = generateTeam(profile.tier)
  return { ...raw, name: profile.name, short: profile.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase(), countryId,
    prestige: profile.tier, ratings: academyRatings(countryId, profile.tier, ageGroup), academyClubKey: `${countryId}:${profile.reference}`, academyRatingVersion: 2 }
}
export function academyClub(countryId: string, targetPrestige = 6, excluded: readonly string[] = []): Team {
  const candidates = academyProfiles(countryId).filter(profile => !excluded.includes(profile.name))
  const pool = candidates.length ? candidates : academyProfiles(countryId)
  const weights = pool.map(profile => Math.max(1, 9 - Math.abs(profile.tier - targetPrestige) * 2))
  let roll = rand() * weights.reduce((sum, weight) => sum + weight, 0)
  const profile = pool.find((_, index) => (roll -= weights[index]) <= 0) ?? pool[pool.length - 1]
  return academyTeam(countryId, profile)
}

function candidateScore(player?: Player): number {
  if (!player) return 5
  const ratings = (player.matchRatings ?? []).slice(-8)
  const average = ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 6
  const ovr = toOvr(computeCurrentAbility(player))
  return clamp(Math.round(3 + Math.max(0, average - 6) * 2 + Math.max(0, ovr - 50) / 12 + (player.reputation ?? 0) / 24), 4, 10)
}
export function academyOfferBatch(original: Player['contractOffers'][number], homeCountryId: string, week: number, player?: Player): Player['contractOffers'] {
  const total = 3 + Math.floor(rand() * 4)
  const score = candidateScore(player)
  const age = player?.careerClock.ageYears ?? 18
  const firstCountry = original.countryId ?? homeCountryId
  const availableFrom = (country: string) => country === homeCountryId ? undefined : 18
  const offerFor = (club: Team): Player['contractOffers'][number] => ({ id: crypto.randomUUID(), clubId: club.id, clubName: club.name,
    clubShort: club.short, countryId: club.countryId, ratings: club.ratings, prestige: club.prestige, kind: 'academy',
    weekOffered: week, expiresInWeeks: club.countryId !== homeCountryId && age < 18 ? (18 - age) * 44 + 10 : 10,
    availableFromAge: availableFrom(club.countryId ?? homeCountryId) })
  const firstProfile = academyProfileFor(firstCountry, original.clubName)
  const first = firstProfile ? offerFor(academyTeam(firstCountry, firstProfile)) : offerFor(academyClub(firstCountry, Math.min(score, original.prestige)))
  // Keep the club that actually watched the player, while normalising its
  // country-based strength so a stale save cannot carry inflated ratings.
  first.id = original.id; first.clubId = original.clubId; first.clubName = original.clubName; first.clubShort = original.clubShort
  const offers = [first]
  if (firstCountry !== homeCountryId) offers.push(offerFor(academyClub(homeCountryId, Math.min(score, 7), offers.map(o => o.clubName))))
  const countries = NATIONS.map(n => n.id)
  while (offers.length < total) {
    const wantsEurope = score >= 7 && offers.every(o => !isEuropeanAcademy(o.countryId)) && offers.length === total - 1
    const availableCountries = countries.filter(candidate => !offers.some(offer => offer.countryId === candidate))
    const europeanCountries = availableCountries.filter(isEuropeanAcademy)
    const country = wantsEurope && europeanCountries.length ? europeanCountries[Math.floor(rand() * europeanCountries.length)]
      : availableCountries[Math.floor(rand() * availableCountries.length)]
    const target = Math.min(score, score >= 8 && rand() < .16 ? 10 : 8)
    const club = academyClub(country, target, offers.filter(o => o.countryId === country).map(o => o.clubName))
    if (offers.some(o => o.countryId === country && o.clubName === club.name)) continue
    if (club.prestige > score + 1) continue
    offers.push(offerFor(club))
  }
  return offers
}

export function europeanContinentalField(playerTeam: Team, route: 'domestic' | 'senior'): Team[] {
  const profileCountries = [...EUROPEAN_ACADEMY_COUNTRIES]
  const used = new Set<string>([`${playerTeam.countryId}:${playerTeam.name}`])
  const pick = (target: number): Team => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const country = profileCountries[Math.floor(rand() * profileCountries.length)]
      const club = academyClub(country, target)
      const key = `${country}:${club.name}`
      if (!used.has(key)) { used.add(key); return club }
    }
    const country = profileCountries[Math.floor(rand() * profileCountries.length)]
    const club = academyClub(country, target, [...used].filter(key => key.startsWith(`${country}:`)).map(key => key.slice(country.length + 1)))
    used.add(`${country}:${club.name}`)
    return club
  }
  const seniorPath = Array.from({ length: route === 'senior' ? 21 : 22 }, () => pick(8))
  const domesticPath = Array.from({ length: route === 'domestic' ? 9 : 10 }, () => pick(7))
  return route === 'senior' ? [playerTeam, ...seniorPath, ...domesticPath] : [...seniorPath, playerTeam, ...domesticPath]
}

/** A small senior-club season simulation. Youth league position does not
 * determine the Champions League path; the senior club's strength does. */
export function seniorClubQualifies(team: Team, season: number): boolean {
  if (!isEuropeanAcademy(team.countryId) || team.prestige < 8) return false
  const key = `${team.academyClubKey ?? team.name}:${season}`
  let hash = 2166136261
  for (const character of key) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return (hash >>> 0) % 100 < Math.min(82, (team.prestige - 4) * 14)
}
