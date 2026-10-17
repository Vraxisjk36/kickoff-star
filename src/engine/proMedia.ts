import type { ProWorldState, ProWorldEvent, IsoDate } from './proWorld'
import type { ProCareerState } from './proCareer'
import { proRoll } from './proWorldFactory'

export interface ProSponsor { id: string; name: string; category: string; tier: number; history: string; topPlayers: { name: string; overall: number }[]; topClubs: string[] }
export interface ProSponsorOffer { id: string; sponsorId: string; issued: IsoDate; expires: IsoDate; years: number; annualFee: number; appearanceTarget: number; status: 'offered' | 'active' | 'expired' | 'completed'; nextPayment?: IsoDate }
export interface ProMediaItem { id: string; date: IsoDate; channel: 'gazette' | 'social'; scope: 'club' | 'country' | 'world'; headline: string; body: string }
const categories = ['Boots', 'Training', 'Lifestyle', 'Nutrition', 'Travel', 'Technology']
const roots = ['Aster', 'Velar', 'Northline', 'Forge', 'Solstice', 'Arcway', 'Evercrest', 'Luma', 'Meridian', 'Kinetic']
export const PRO_SPONSORS: readonly ProSponsor[] = roots.flatMap((root, index) => categories.map((category, offset) => {
  const tier = Math.min(5, 1 + Math.floor((index + offset) / 3))
  return { id: `sponsor-${index}-${offset}`, name: `${root} ${category === 'Boots' ? 'Sport' : category}`,
    category, tier, history: `${root} began as a regional ${category.toLowerCase()} company and expanded its football programme over time.`,
    topPlayers: Array.from({ length: 4 }, (_, rank) => ({ name: `${root} athlete ${rank + 1}`, overall: 54 + tier * 5 + (3 - rank) * 2 })),
    topClubs: [`${root} Athletic`, `${root} City`, `${root} United`] }
}))
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
const addYears = (date: string, years: number) => `${Number(date.slice(0, 4)) + years}${date.slice(4)}`
export function sponsorEligibility(career: ProCareerState, sponsor: ProSponsor): boolean {
  return career.stage === 'signed' && (career.sponsorDeals ?? []).filter(deal => deal.status === 'active').length < 2 &&
    !(career.sponsorDeals ?? []).some(deal => deal.status === 'active' &&
      PRO_SPONSORS.find(other => other.id === deal.sponsorId)?.category === sponsor.category) && career.appearances >= 5 && career.reputation >= 10 + sponsor.tier * 12 &&
    (career.followers ?? 0) >= (sponsor.tier - 1) * 2000 &&
    !(career.sponsorDeals ?? []).some(deal => deal.sponsorId === sponsor.id && deal.status === 'active')
}
export function proposeSponsor(world: ProWorldState, career: ProCareerState): ProSponsorOffer | null {
  if (career.stage !== 'signed' || !career.playerId || career.sponsorOffers?.some(offer => offer.status === 'offered')) return null
  const eligible = PRO_SPONSORS.filter(sponsor => sponsorEligibility(career, sponsor))
  if (!eligible.length) return null
  const sponsor = eligible[Math.floor(proRoll(world.seed, `${career.playerId}:sponsor:${career.date.slice(0, 7)}`) * eligible.length)]
  const years = 2 + Math.floor(proRoll(world.seed, `${sponsor.id}:${career.date}:term`) * 4)
  return { id: `deal-${sponsor.id}-${career.date}`, sponsorId: sponsor.id, issued: career.date,
    expires: addDays(career.date, 14), years, annualFee: (300 + sponsor.tier * 750) * 100,
    appearanceTarget: 8 + sponsor.tier * 3, status: 'offered' }
}
export function answerSponsor(career: ProCareerState, id: string, accept: boolean): ProCareerState {
  const offer = career.sponsorOffers?.find(item => item.id === id && item.status === 'offered' && item.expires >= career.date)
  if (!offer) throw new Error('Sponsor offer expired')
  const sponsor = PRO_SPONSORS.find(item => item.id === offer.sponsorId)!
  const active = accept ? { ...offer, status: 'active' as const, expires: addYears(career.date, offer.years), nextPayment: addDays(career.date, 30) } : null
  return { ...career, sponsorOffers: career.sponsorOffers?.filter(item => item.id !== id),
    sponsorDeals: active ? [...(career.sponsorDeals ?? []), active] : career.sponsorDeals,
    mediaLog: [...(career.mediaLog ?? []), { id: `${id}-decision`, date: career.date, channel: 'gazette', scope: 'club',
      headline: accept ? `${sponsor.name} signs ${career.playerId}` : `${sponsor.name} talks end`,
      body: accept ? `${sponsor.name} agreed a ${offer.years}-year partnership. The player must remain active to receive the monthly fee.` : 'Both sides leave the door open to future talks.' } as ProMediaItem].slice(-80) }
}
export function advanceProMedia(world: ProWorldState, career: ProCareerState, date: IsoDate,
  appearance: boolean, scored: boolean, international: boolean): ProCareerState {
  const followers = Math.max(0, (career.followers ?? 0) + (appearance ? 250 : 0) + (scored ? 1200 : 0) +
    (international ? 450 : 0) + (career.reputation >= 70 ? 15 : 0))
  let sponsorOffers = (career.sponsorOffers ?? []).map(offer => offer.status === 'offered' && offer.expires < date
    ? { ...offer, status: 'expired' as const } : offer)
  let sponsorDeals = (career.sponsorDeals ?? []).map(deal => ({ ...deal }))
  let wallets = { ...(career.wallets ?? {}) }
  let balance = career.balance
  const mediaLog = [...(career.mediaLog ?? [])]
  const playerId = career.playerId
  for (const deal of sponsorDeals) {
    if (deal.status !== 'active') continue
    if (date >= deal.expires) { deal.status = 'completed'; continue }
    if (deal.nextPayment && date >= deal.nextPayment) {
      const currency = career.contract?.currency
      if (currency && career.appearances >= deal.appearanceTarget) {
        wallets[currency] = (wallets[currency] ?? 0) + Math.floor(deal.annualFee / 12)
        balance = wallets[currency]
        mediaLog.push({ id: `${deal.id}-payment-${date}`, date, channel: 'social', scope: 'club',
          headline: `${PRO_SPONSORS.find(item => item.id === deal.sponsorId)?.name} partnership`, body: 'The monthly endorsement payment arrived.' })
      }
      deal.nextPayment = addDays(date, 30)
    }
  }
  if (career.stage === 'signed' && playerId && !sponsorOffers.some(offer => offer.status === 'offered') &&
    date.slice(-2) === '01' && !(career.sponsorOfferMonth === date.slice(0, 7))) {
    const offer = proposeSponsor(world, { ...career, followers, sponsorOffers, date })
    if (offer) sponsorOffers = [...sponsorOffers, offer]
  }
  const relevant = world.recentEvents.filter(event => event.date === date &&
    (event.subjectIds.includes(playerId ?? '') || event.subjectIds.includes(career.clubId ?? ''))).slice(-3)
  for (const event of relevant) {
    if (mediaLog.some(item => item.id === `media-${event.id}`)) continue
    mediaLog.push(eventStory(event, world))
  }
  if (scored || international) mediaLog.push({ id: `social-${playerId}-${date}`, date, channel: 'social',
    scope: international ? 'country' : 'club', headline: international ? 'National team spotlight' : 'Matchday reaction',
    body: international ? 'Supporters react to a senior international appearance.' : 'Supporters discuss the player’s contribution after the match.' })
  return { ...career, followers, sponsorOffers: sponsorOffers.slice(-12), sponsorDeals, wallets, balance,
    sponsorOfferMonth: date.slice(0, 7), mediaLog: mediaLog.slice(-80) }
}
function eventStory(event: ProWorldEvent, world: ProWorldState): ProMediaItem {
  const subject = event.subjectIds.map(id => world.clubs[id]?.name ?? world.players[id]?.name ?? world.associations[id]?.name).filter(Boolean).join(' and ')
  const outcome = event.kind === 'match' ? `${event.details.homeGoals ?? 0}–${event.details.awayGoals ?? 0}` : event.kind
  return { id: `media-${event.id}`, date: event.date, channel: 'gazette', scope: 'club',
    headline: event.kind === 'match' ? `${subject}: ${outcome}` : `${subject}: ${event.kind}`,
    body: event.kind === 'match' ? `The result is in. ${subject} featured in a ${outcome} fixture.` : `The latest ${event.kind} development involving ${subject} is now part of the season record.` }
}
export function signatureBootEligible(career: ProCareerState): boolean {
  return career.stage === 'signed' && career.appearances >= 120 && career.reputation >= 85 &&
    (career.followers ?? 0) >= 100_000 && !!career.sponsorDeals?.some(deal => deal.status === 'active' &&
      PRO_SPONSORS.find(sponsor => sponsor.id === deal.sponsorId)?.category === 'Boots')
}
export function launchSignatureBoot(career: ProCareerState, name: string): ProCareerState {
  if (!signatureBootEligible(career) || career.signatureBoot) throw new Error('Signature boot is not available')
  const cleaned = name.trim().slice(0, 40)
  if (cleaned.length < 3) throw new Error('Give your boot a name of at least three characters')
  const item: ProMediaItem = { id: `signature-${career.date}`, date: career.date, channel: 'gazette', scope: 'world',
    headline: `${cleaned} launches`, body: 'A signature boot line arrives after a long run of appearances, audience growth and a boot partnership.' }
  return { ...career, signatureBoot: { name: cleaned, launchDate: career.date },
    mediaLog: [...(career.mediaLog ?? []), item].slice(-80) }
}
