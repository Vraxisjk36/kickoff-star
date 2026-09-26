import { NATIONS } from './nations'
import { regionsFor } from './regions'
import { generateTeam, type Team } from './teams'
import { rand } from './rng'
import type { Player } from '../types/player'

// Fictional names point to recognisable football cities and rivalries without
// borrowing real club marks. The rest of each country's 24-club pool uses its
// own game localities, so domestic academy fixtures stay in that country.
const MARQUEE: Record<string, string[]> = {
  eng: ['West London Blues', 'North London Gunners', 'Manchester Reds', 'Manchester Sky', 'Merseyside Reds', 'North London Lilywhites'],
  rsa: ['Johannesburg Chiefs', 'Soweto Pirates', 'Pretoria Sundowns', 'Cape Town City', 'Durban Arrows', 'Stellenbosch United'],
  bra: ['São Paulo Red and Black', 'Rio Stripes', 'Santos Coast', 'Belo Horizonte Blue'],
  esp: ['Madrid Whites', 'Barcelona Blau', 'Madrid Stripes', 'Seville Reds'],
  fra: ['Paris Blue', 'Marseille Blue', 'Lyon White', 'Monaco Red'],
  ger: ['Munich Red', 'Dortmund Yellow', 'Berlin Union', 'Leverkusen Red'],
  ita: ['Milan Red', 'Milan Blue', 'Turin Stripes', 'Rome Red'],
  por: ['Lisbon Red', 'Lisbon Green', 'Porto Blue', 'Braga Red'],
}

export function academyClubNames(countryId: string): string[] {
  const country = NATIONS.some(n => n.id === countryId) ? countryId : 'eng'
  const places = regionsFor(country).flatMap(region => region.localities)
  const names = [...(MARQUEE[country] ?? [])]
  for (const suffix of ['Athletic', 'United', 'City', 'Sporting', 'Rovers']) {
    for (const place of places) if (!names.includes(`${place} ${suffix}`)) names.push(`${place} ${suffix}`)
    if (names.length >= 24) break
  }
  return names.slice(0, 24)
}

export function academyClub(countryId: string, prestige: number, excluded: readonly string[] = []): Team {
  const names = academyClubNames(countryId).filter(name => !excluded.includes(name))
  const name = names[Math.floor(rand() * names.length)]
  return { ...generateTeam(prestige), name, short: name.slice(0, 3).toUpperCase(), countryId }
}

export function academyOfferBatch(original: Player['contractOffers'][number], homeCountryId: string, week: number): Player['contractOffers'] {
  const total = 3 + Math.floor(rand() * 4)
  const originalCountry = original.countryId ?? homeCountryId
  const otherCountries = NATIONS.filter(n => n.id !== originalCountry).sort(() => rand() - 0.5).slice(0, total - 1)
  const lead = { ...original, countryId: originalCountry, weekOffered: week, expiresInWeeks: 10 }
  const others = otherCountries.map(nation => {
    const club = academyClub(nation.id, Math.max(5, Math.min(8, original.prestige)))
    return { id: crypto.randomUUID(), clubId: club.id, clubName: club.name, clubShort: club.short, countryId: nation.id,
      ratings: club.ratings, prestige: club.prestige, kind: 'academy' as const, weekOffered: week, expiresInWeeks: 10 }
  })
  return [lead, ...others]
}

export function academyChampionsField(playerTeam: Team, countryId: string): Team[] {
  const opponents = NATIONS.filter(nation => nation.id !== countryId).sort(() => rand() - 0.5).slice(0, 7)
  return [{ ...playerTeam, countryId }, ...opponents.map(nation => academyClub(nation.id, nation.strength + 1))]
}
