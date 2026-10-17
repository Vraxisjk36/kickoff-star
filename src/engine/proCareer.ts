import { assessProDeal } from './proClubFinance'
import { activeBootBonus, relocateProAssets, settleAssetMonth, wearProBoot, type OwnedAsset, type AssetStatement } from './proAssets'
import { proRoll } from './proWorldFactory'
import { advanceProWorldTo } from './proWorldSimulation'
import { rollMatchInjury } from './proLifecycle'
import { nationalCallupFixture } from './proTournaments'
import { advanceProMedia, type ProMediaItem, type ProSponsorOffer } from './proMedia'
import { findMarketMoves, registrationOpen, returnProLoan, signMarketMove, startProLoan, type MarketMove } from './proMovement'
import { counterProTalks, createProContract, moveResidence, progressProTalks, settleProMonth, startProTalks,
  type ProAgentId, type ProContract, type ProLedgerLine, type ProResidence, type ProTalks } from './proContracts'
import type { IsoDate, ProFixture, ProWorldState } from './proWorld'

export type ProAction = 'train' | 'recover' | 'media' | 'rest'
export interface ProOffer { clubId: string; annualWage: number; role: 'prospect' | 'rotation'; loanRisk: 'low' | 'high' }
export interface ProDay { date: IsoDate; training: ProAction; event: string; matchIds: string[]; energy: number; rating?: number }
export interface ProOpportunity { id: string; title: string; detail: string; choices: [string, string]; kind: 'media' | 'community' | 'coach' }
export interface ProCareerState {
  stage: 'trial' | 'offers' | 'signed' | 'retired'
  date: IsoDate
  trialDay: number
  trialScore: number
  clubId: string | null
  playerId: string | null
  offers: ProOffer[]
  energy: number
  trust: number
  reputation: number
  balance: number
  assets?: OwnedAsset[]
  assetStatements?: AssetStatement[]
  assetSettledMonth?: string
  assetDeficiency?: number
  appearances: number
  goals: number
  assists: number
  nationalCaps?: number
  nationalGoals?: number
  followers?: number
  sponsorOffers?: ProSponsorOffer[]
  sponsorDeals?: ProSponsorOffer[]
  sponsorOfferMonth?: string
  signatureBoot?: { name: string; launchDate: IsoDate }
  mediaLog?: ProMediaItem[]
  days: ProDay[]
  daysElapsed?: number
  pendingEvent?: ProOpportunity | null
  followUps?: { date: IsoDate; text: string; reputation: number }[]
  agentId?: ProAgentId | null
  talks?: ProTalks | null
  contract?: ProContract | null
  ledger?: ProLedgerLine[]
  wallets?: Record<string, number>
  residence?: ProResidence | null
  pendingBonus?: number
  loan?: { parentClubId: string; borrowingClubId: string; ends: IsoDate; originalWage: number } | null
  injuryUntil?: IsoDate | null
}
const dayAfter = (date: IsoDate): IsoDate => new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)
const trialActionScore: Record<ProAction, number> = { train: 5, recover: 1, media: 2, rest: 0 }
const opportunities: Omit<ProOpportunity, 'id'>[] = [
  { title: 'The matchday microphone', detail: 'A local reporter asks about your place in the squad.', choices: ['Talk about earning your minutes', 'Promise a breakthrough'], kind: 'media' },
  { title: 'Community visit', detail: 'The club invites you to meet youth players after training.', choices: ['Stay for the session', 'Keep your recovery time'], kind: 'community' },
  { title: 'Coach’s extra session', detail: 'The coach offers an individual session on your first touch.', choices: ['Take the extra session', 'Protect your legs'], kind: 'coach' },
]
export function resolveProOpportunity(career: ProCareerState, choice: 0 | 1): ProCareerState {
  const pending = career.pendingEvent
  if (!pending) throw new Error('No pending event')
  let energy = career.energy
  let trust = career.trust
  let reputation = career.reputation
  const followUps = [...(career.followUps ?? [])]
  if (pending.kind === 'media') {
    if (choice === 0) trust += 2
    else { reputation += 1; followUps.push({ date: new Date(Date.parse(`${career.date}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10), text: 'The interview ran in the local paper.', reputation: 2 }) }
  } else if (pending.kind === 'community') {
    if (choice === 0) { energy = Math.max(0, energy - 8); reputation += 2 }
    else energy = Math.min(100, energy + 5)
  } else if (choice === 0) { energy = Math.max(0, energy - 10); trust += 3 }
  else energy = Math.min(100, energy + 5)
  return { ...career, pendingEvent: null, followUps, energy, trust: Math.min(100, trust), reputation,
    days: [...career.days, { date: career.date, training: 'rest' as const, event: `${pending.title}: ${pending.choices[choice]}.`, matchIds: [], energy }].slice(-90) }
}
export function beginProTrial(date: IsoDate): ProCareerState {
  return { stage: 'trial', date, trialDay: 0, trialScore: 0, clubId: null, playerId: null, offers: [],
    energy: 85, trust: 35, reputation: 10, balance: 0, appearances: 0, goals: 0, assists: 0, nationalCaps: 0, nationalGoals: 0, followers: 0, sponsorOffers: [], sponsorDeals: [], mediaLog: [], days: [],
    agentId: null, talks: null, contract: null, ledger: [], wallets: {}, residence: null, pendingBonus: 0, loan: null, injuryUntil: null }
}

export function chooseProAgent(career: ProCareerState, id: ProAgentId): ProCareerState {
  if (career.stage !== 'offers') throw new Error('Choose representation before signing')
  return { ...career, agentId: id }
}
export function openProTalks(world: ProWorldState, career: ProCareerState, clubId: string): ProCareerState {
  if (career.stage !== 'offers' || !career.agentId || career.talks) throw new Error('Unavailable negotiations')
  const offer = career.offers.find(item => item.clubId === clubId)
  if (!offer) throw new Error('Offer expired')
  return { ...career, talks: startProTalks(world, clubId, career.date, offer.annualWage) }
}
export function requestProCounter(world: ProWorldState, career: ProCareerState): ProCareerState {
  if (!career.talks || !career.agentId) throw new Error('No active negotiation')
  const renewal = career.stage === 'offers' && career.contract?.clubId === career.talks.clubId && career.playerId
  const adjusted = renewal ? structuredClone(world) : world
  if (renewal) {
    const club = adjusted.clubs[career.talks.clubId]
    club.finances.committedAnnualWages = Math.max(0, club.finances.committedAnnualWages - (adjusted.players[career.playerId!]?.annualWage ?? 0))
    club.finances.committedAnnualBonuses = Math.max(0, club.finances.committedAnnualBonuses - career.contract!.appearanceBonus * 30 - career.contract!.goalBonus * 5)
  }
  return { ...career, talks: counterProTalks(adjusted, career.talks, career.date, career.agentId) }
}
export function declineProTalks(career: ProCareerState): ProCareerState {
  return { ...career, offers: career.offers.filter(offer => offer.clubId !== career.talks?.clubId), talks: null }
}
export function availableProTransfers(world: ProWorldState, career: ProCareerState): MarketMove[] {
  return career.stage === 'signed' && career.playerId && !career.loan ? findMarketMoves(world, career.playerId, career.reputation) : []
}
export function openTransferTalks(world: ProWorldState, career: ProCareerState, clubId: string): ProCareerState {
  if (!career.agentId || career.talks || !availableProTransfers(world, career).some(move => move.clubId === clubId))
    throw new Error('Transfer talks unavailable')
  const move = availableProTransfers(world, career).find(item => item.clubId === clubId)!
  return { ...career, talks: { ...startProTalks(world, clubId, career.date, move.annualWage), transferFee: move.fee, loanRisk: move.loanRisk } }
}
export function completeProMove(world: ProWorldState, career: ProCareerState): { world: ProWorldState; career: ProCareerState } {
  if (career.stage !== 'signed' || !career.talks || career.talks.status !== 'ready' || !career.playerId || !career.contract || !career.agentId)
    throw new Error('Transfer not ready')
  const move: MarketMove = { clubId: career.talks.clubId, annualWage: career.talks.annualWage,
    fee: career.talks.transferFee ?? 0, loanRisk: career.talks.loanRisk ?? 'low' }
  const old = career.contract
  const next = signMarketMove(world, career.playerId, move, career.talks.annualWage)
  next.clubs[old.clubId].finances.committedAnnualBonuses = Math.max(0,
    next.clubs[old.clubId].finances.committedAnnualBonuses - old.appearanceBonus * 30 - old.goalBonus * 5)
  const contract = createProContract(next, career.playerId, move.clubId, career.date, career.talks.annualWage,
    'rotation', career.agentId, move.loanRisk)
  const wallets = { ...(career.wallets ?? {}), [contract.currency]: (career.wallets?.[contract.currency] ?? 0) + contract.signingBonus }
  return { world: next, career: { ...career, clubId: move.clubId, contract, talks: null, ...relocateProAssets(career, moveResidence(next, move.clubId, career.date)),
    wallets, balance: wallets[contract.currency], pendingBonus: 0, trust: 40 } }
}
export function availableProLoans(world: ProWorldState, career: ProCareerState): string[] {
  if (career.stage !== 'signed' || !career.clubId || !career.contract || career.loan ||
      !registrationOpen(world.clubs[career.clubId].associationId, world.currentDate)) return []
  const parent = world.clubs[career.clubId]
  return Object.values(world.clubs).filter(club => club.associationId === parent.associationId && club.id !== parent.id &&
    club.reputation < parent.reputation && club.reputation >= parent.reputation - 12 &&
    assessProDeal(club.finances, { annualWage: Math.floor(career.contract!.annualWage / 2), probableAnnualBonuses: 0,
      annualTransferCost: 0, annualAgentFee: 0, upfrontTransferPayment: 0, signingBonus: 0, role: 'rotation' }).affordable)
    .slice(0, 3).map(club => club.id)
}
export function acceptProLoan(world: ProWorldState, career: ProCareerState, clubId: string): { world: ProWorldState; career: ProCareerState } {
  if (!career.playerId || !availableProLoans(world, career).includes(clubId)) throw new Error('Loan unavailable')
  const proposedEnd = new Date(Date.parse(`${career.date}T00:00:00Z`) + 160 * 86400000).toISOString().slice(0, 10)
  const ends = career.contract!.expires < proposedEnd ? career.contract!.expires : proposedEnd
  if (ends <= career.date) throw new Error('This contract expires before the proposed loan begins')
  const { world: next, loan } = startProLoan(world, career.playerId, clubId, ends)
  return { world: next, career: { ...career, clubId, loan, ...relocateProAssets(career, moveResidence(next, clubId, career.date)), trust: 45 } }
}
export function buildTrialOffers(world: ProWorldState, score: number, nationalityId: string): ProOffer[] {
  const local = Object.values(world.clubs).filter(club => club.associationId === nationalityId)
  const regions = local.length >= 4 ? local : Object.values(world.clubs).filter(club => ['rsa','eng','usa','bra'].includes(club.associationId))
  const candidates = [...regions].sort((a, b) => a.reputation - b.reputation || a.id.localeCompare(b.id))
  const picked: ProOffer[] = []
  for (const club of candidates) {
    if (picked.length === 4) break
    if (club.reputation > candidates[Math.floor(candidates.length * .7)].reputation) continue
    const role: ProOffer['role'] = picked.length < 2 ? 'rotation' : 'prospect'
    const cap = Math.min(club.finances.topPlayerAnnualWage * club.finances.roleWageMultiplier[role],
      club.finances.annualSquadCostLimit - club.finances.committedAnnualWages - club.finances.committedAnnualBonuses - club.finances.committedAnnualTransferCosts - club.finances.committedAnnualAgentFees - club.finances.reservedAnnualSquadCosts)
    const wage = Math.max(1, Math.floor(cap * (.18 + Math.min(1, score / 130) * .11)))
    const deal = { annualWage: wage, probableAnnualBonuses: 0, annualTransferCost: 0, annualAgentFee: 0,
      upfrontTransferPayment: 0, signingBonus: 0, role }
    if (assessProDeal(club.finances, deal).affordable)
      picked.push({ clubId: club.id, annualWage: wage, role, loanRisk: picked.length >= 2 ? 'high' : 'low' })
  }
  return picked
}
export function advanceProDay(world: ProWorldState, career: ProCareerState, action: ProAction,
  nationalityId: string): { world: ProWorldState; career: ProCareerState } {
  if (career.stage === 'retired' || career.stage === 'offers' && !career.talks) throw new Error('Choose a club or finish the career before advancing')
  if (career.pendingEvent) throw new Error('Resolve the club event before advancing')
  const date = career.date
  if (career.stage === 'signed' && action === 'train' && career.injuryUntil && career.injuryUntil >= date)
    throw new Error('Training is unavailable until your injury recovery ends')
  const fixtureList = career.clubId ? Object.values(world.fixtures).filter(fixture =>
    fixture.kickoffDate === date && (fixture.homeId === career.clubId || fixture.awayId === career.clubId)) : []
  const nationalFixture = career.stage === 'signed' && career.playerId && !fixtureList.length
    ? nationalCallupFixture(world, career.playerId, nationalityId, date) : null
  // Resolve all matches on this date before the world advances. Training and a
  // fixture can share the day; actions never replace a scheduled match.
  const energyCost = action === 'train' ? 12 : action === 'media' ? 7 : 0
  const recovery = action === 'recover' ? 23 : action === 'rest' ? 14 : 5
  let energy = Math.max(0, Math.min(100, career.energy - energyCost + recovery))
  let trust = career.trust + (action === 'train' ? 2 : action === 'media' ? 1 : 0)
  let reputation = career.reputation + (action === 'media' ? 1 : 0)
  const matured = (career.followUps ?? []).filter(item => item.date <= date)
  reputation += matured.reduce((total, item) => total + item.reputation, 0)
  let appearances = career.appearances
  let goals = career.goals
  let assists = career.assists
  let nationalCaps = career.nationalCaps ?? 0
  let nationalGoals = career.nationalGoals ?? 0
  let rating: number | undefined
  let nextWorld = advanceProWorldTo(world, dayAfter(date))
  let event = action === 'media' ? 'You answered a local press question.' : action === 'train' ? 'You trained with the squad.' : 'You managed your recovery.'
  if (career.stage === 'offers') event = 'Your agent and the club continued talks.'
  if (matured.length) event += ` ${matured.map(item => item.text).join(' ')}`
  if (career.stage === 'signed' && fixtureList.length) {
    const played = energy >= 30 && trust >= 25 && (!career.injuryUntil || date > career.injuryUntil)
    if (played) {
      const seed = proRoll(world.seed, `${career.playerId}:${date}:performance`)
      const started = trust >= 50 && energy >= 50
      rating = Math.min(10, Math.round((5.8 + seed * 2.5 + (started ? .4 : 0) + activeBootBonus(career)) * 10) / 10)
      const fixture = fixtureList[0]
      const atHome = fixture.homeId === career.clubId
      const settled = nextWorld.fixtures[fixture.id]?.result
      const eventResult = nextWorld.recentEvents.find(item => item.id === `event-${fixture.id}`)
      const teamGoals = Number(settled?.[atHome ? 'homeGoals' : 'awayGoals'] ??
        eventResult?.details[atHome ? 'homeGoals' : 'awayGoals'] ?? 0)
      const scored = seed > .87 && teamGoals > 0 ? 1 : 0
      const assisted = seed > .7 && seed < .82 && teamGoals > scored ? 1 : 0
      appearances += fixtureList.length
      goals += scored
      assists += assisted
      trust = Math.min(100, trust + (rating >= 7 ? 2 : -1))
      reputation += scored ? 2 : rating >= 8 ? 1 : 0
      energy = Math.max(0, energy - fixtureList.length * (started ? 22 : 12))
      event = `${started ? 'Started' : 'Came off the bench'} · ${rating.toFixed(1)} rating${scored ? ' · goal' : ''}${assisted ? ' · assist' : ''}.`
    } else event = 'The team played; you were unavailable for selection.'
  }
  if (nationalFixture && energy >= 30 && (!career.injuryUntil || date > career.injuryUntil)) {
    const match = nextWorld.recentEvents.find(item => item.id === `event-${nationalFixture.id}`)
    const teamGoals = Number(match?.details[nationalFixture.homeId === nationalityId ? 'homeGoals' : 'awayGoals'] ?? 0)
    const seed = proRoll(world.seed, `${career.playerId}:${date}:national-performance`)
    const scored = teamGoals > 0 && seed > .86 ? 1 : 0
    nationalCaps++
    nationalGoals += scored
    rating = Math.round((5.8 + seed * 2.8 + (scored ? 1 : 0) + activeBootBonus(career)) * 10) / 10
    energy = Math.max(0, energy - 24)
    reputation += scored ? 3 : rating >= 8 ? 1 : 0
    event = `Represented ${world.associations[nationalityId].name} · ${rating.toFixed(1)} rating${scored ? ' · goal' : ''}.`
  }
  let loan = career.loan ?? null
  let activeClubId = career.clubId
  let residence = career.residence ?? null
  if (loan && career.playerId && nextWorld.players[career.playerId] && dayAfter(date) >= loan.ends) {
    nextWorld = returnProLoan(nextWorld, career.playerId, loan)
    activeClubId = loan.parentClubId
    residence = relocateProAssets(career, moveResidence(nextWorld, activeClubId, dayAfter(date))).residence!
    loan = null
    event += ' Your loan ended and you returned to your parent club.'
  }
  if (rating !== undefined && career.playerId && nextWorld.players[career.playerId])
    rollMatchInjury(nextWorld, nextWorld.players[career.playerId], date, energy)
  let nextScore = career.trialScore
  let trialDay = career.trialDay
  let stage: ProCareerState['stage'] = career.stage
  if (stage === 'signed' && career.playerId && !nextWorld.players[career.playerId]) {
    stage = 'retired'
    event += ' Your professional playing career has come to an end.'
  }
  const injuryUntil = career.playerId ? nextWorld.players[career.playerId]?.injuredUntil ?? null : null
  if (stage === 'signed' && career.playerId && nextWorld.players[career.playerId]?.careerEndingInjury) {
    stage = 'retired'; event += ' A serious injury ended your playing career.'
  } else if (injuryUntil && injuryUntil >= date && rating !== undefined) event += ` Injury: unavailable until ${injuryUntil}.`
  let offers = career.offers
  const talks = progressProTalks(career.talks ?? null, dayAfter(date))
  if (stage === 'signed' && career.contract && !loan && dayAfter(date) >= career.contract.expires) {
    stage = 'offers'
    const renewalClub = nextWorld.clubs[career.contract.clubId]
    const currentOffer: ProOffer = { clubId: renewalClub.id,
      annualWage: Math.max(1, Math.floor(career.contract.annualWage * .95)),
      role: career.contract.role === 'star' || career.contract.role === 'starter' ? 'rotation' : career.contract.role,
      loanRisk: 'low' }
    offers = [currentOffer, ...buildTrialOffers(nextWorld, career.trialScore, nationalityId)
      .filter(offer => offer.clubId !== renewalClub.id).slice(0, 3)]
    event += ' Your contract expired. Your agent can open renewal or free-agent talks.'
  }
  if (stage === 'trial') {
    trialDay++
    nextScore += trialActionScore[action] + (energy >= 40 ? 2 : 0)
    if (trialDay >= 21) { stage = 'offers'; offers = buildTrialOffers(nextWorld, nextScore, nationalityId) }
  }
  let balance = career.balance
  let pendingBonus = career.pendingBonus ?? 0
  if (career.stage === 'signed' && fixtureList.length && rating !== undefined && career.contract) {
    pendingBonus += career.contract.appearanceBonus + (goals - career.goals) * career.contract.goalBonus +
      (assists - career.assists) * career.contract.assistBonus
  }
  const ledger = [...(career.ledger ?? [])]
  const wallets = { ...(career.wallets ?? {}) }
  if (career.stage === 'signed' && career.clubId && (date.slice(5, 7) !== dayAfter(date).slice(5, 7) ||
      dayAfter(date) >= (career.contract?.expires ?? '9999-12-31'))) {
    if (career.contract) {
      const line = settleProMonth(career.contract, nextWorld, date, pendingBonus, residence)
      ledger.push(line)
      wallets[line.currency] = (wallets[line.currency] ?? 0) + line.net
      balance = wallets[line.currency]
      pendingBonus = 0
      event += ' Your monthly wage statement arrived.'
    }
  }
  const days = [...career.days, { date, training: action, event,
    matchIds: [...fixtureList.map((fixture: ProFixture) => fixture.id), ...(nationalFixture ? [nationalFixture.id] : [])], energy, rating }].slice(-90)
  const daysElapsed = (career.daysElapsed ?? 0) + 1
  const opportunity = stage === 'signed' && daysElapsed % 11 === 0
    ? { ...opportunities[Math.floor(proRoll(world.seed, `${career.playerId}:event:${date}`) * opportunities.length)], id: `life-${date}` }
    : null
  const media = advanceProMedia(nextWorld, { ...career, stage, clubId: activeClubId, appearances, reputation, wallets, balance },
    date, appearances > career.appearances, goals > career.goals, nationalCaps > (career.nationalCaps ?? 0))
  const equippedCareer = rating === undefined ? media : wearProBoot(media)
  const assetsCareer = date.slice(0, 7) !== dayAfter(date).slice(0, 7) ? settleAssetMonth(equippedCareer, date) : equippedCareer
  return { world: nextWorld, career: { ...assetsCareer, date: dayAfter(date), trialDay, trialScore: nextScore,
    stage, offers, clubId: activeClubId, loan, residence, assets: loan === null && career.loan ? relocateProAssets(career, residence!).assets : assetsCareer.assets, energy, trust: Math.min(100, Math.max(0, trust)), reputation, appearances, goals, assists, balance: assetsCareer.balance, days,
    daysElapsed, talks, ledger, wallets: assetsCareer.wallets, pendingBonus, injuryUntil, nationalCaps, nationalGoals,
    pendingEvent: opportunity, followUps: (career.followUps ?? []).filter(item => item.date > date) } }
}
export function retireProCareer(world: ProWorldState, career: ProCareerState): { world: ProWorldState; career: ProCareerState } {
  if (career.stage !== 'signed' || !career.playerId || !career.clubId) throw new Error('No active career to retire')
  const next = structuredClone(world)
  const player = next.players[career.playerId]
  if (!player) throw new Error('Player missing')
  player.retirementChoice = true
  next.recentEvents.push({ id: `event-retirement-${player.id}-${career.date}`, date: career.date, kind: 'life',
    subjectIds: [player.id, career.clubId], details: { action: 'player-retired' } })
  return { world: next, career: { ...career, stage: 'retired',
    days: [...career.days, { date: career.date, training: 'rest' as const, event: 'You announced your retirement.', matchIds: [], energy: career.energy }].slice(-90) } }
}
export function signProOffer(world: ProWorldState, career: ProCareerState, clubId: string, identity: {
  id: string; name: string; nationalityId: string; position: string; overall: number; age: number
}, agentId: ProAgentId = 'family', signedYouthHandoff = false): { world: ProWorldState; career: ProCareerState } {
  if (career.stage !== 'offers') throw new Error('Trial offers are not open')
  if (!signedYouthHandoff && (!career.agentId || !career.talks || career.talks.status !== 'ready'))
    throw new Error('Complete contract talks before signing')
  if (signedYouthHandoff && career.playerId) throw new Error('Youth handoff is only available for a first contract')
  const offer = career.offers.find(item => item.clubId === clubId)
  if (!offer) throw new Error('Offer is no longer available')
  const next = structuredClone(world)
  const club = next.clubs[clubId]
  if (career.talks && (career.talks.clubId !== clubId || career.talks.status !== 'ready')) throw new Error('Negotiations are still in progress')
  const annualWage = career.talks?.annualWage ?? offer.annualWage
  const contract = createProContract(next, `career-${identity.id}`, clubId, career.date, annualWage, offer.role, agentId, offer.loanRisk)
  const deal = { annualWage, probableAnnualBonuses: contract.appearanceBonus * 30 + contract.goalBonus * 5,
    annualTransferCost: 0, annualAgentFee: 0, upfrontTransferPayment: 0, signingBonus: contract.signingBonus, role: offer.role }
  if (!club) throw new Error('Club unavailable')
  const id = `career-${identity.id}`
  const existing = next.players[id]
  const priorClub = existing?.clubId ? next.clubs[existing.clubId] : null
  const adjusted = priorClub?.id === club.id && career.contract ? { ...club.finances,
    committedAnnualWages: Math.max(0, club.finances.committedAnnualWages - existing.annualWage),
    committedAnnualBonuses: Math.max(0, club.finances.committedAnnualBonuses - career.contract.appearanceBonus * 30 - career.contract.goalBonus * 5) }
    : club.finances
  if (!assessProDeal(adjusted, deal).affordable) throw new Error('Club budget changed')
  if (existing && priorClub) {
    priorClub.finances.committedAnnualWages = Math.max(0, priorClub.finances.committedAnnualWages - existing.annualWage)
    if (career.contract) priorClub.finances.committedAnnualBonuses = Math.max(0,
      priorClub.finances.committedAnnualBonuses - career.contract.appearanceBonus * 30 - career.contract.goalBonus * 5)
    if (priorClub.id !== club.id) {
      const shirts = new Set(Object.values(next.players).filter(player => player.clubId === club.id).map(player => player.shirtNumber))
      let number = 1
      while (shirts.has(number)) number++
      existing.shirtNumber = number
    }
    existing.clubId = club.id
    existing.annualWage = annualWage
  } else {
    const shirts = new Set(Object.values(next.players).filter(player => player.clubId === clubId).map(player => player.shirtNumber))
    let shirtNumber = 1
    while (shirts.has(shirtNumber)) shirtNumber++
    next.players[id] = { id, name: identity.name, nationalityIds: [identity.nationalityId],
      birthDate: `${Number(career.date.slice(0, 4)) - identity.age}-06-15`, position: identity.position,
      overall: identity.overall, potential: Math.min(94, identity.overall + 15), clubId,
      annualWage, shirtNumber }
  }
  club.finances.cash -= contract.signingBonus
  club.finances.committedAnnualWages += annualWage
  club.finances.committedAnnualBonuses += deal.probableAnnualBonuses
  club.finances.topPlayerAnnualWage = Math.max(club.finances.topPlayerAnnualWage, annualWage)
  next.recentEvents.push({ id: `event-${id}-${career.date}`, date: career.date, kind: 'contract',
    subjectIds: [id, clubId], details: { action: 'signed', annualWage } })
  const residence = moveResidence(next, clubId, career.date)
  const wallets = { ...(career.wallets ?? {}), [contract.currency]: (career.wallets?.[contract.currency] ?? 0) + contract.signingBonus }
  return { world: next, career: { ...career, stage: 'signed', clubId, playerId: id, offers: [], talks: null,
    contract, agentId, wallets, balance: wallets[contract.currency], ...relocateProAssets(career, residence), trust: offer.role === 'rotation' ? 45 : 35 } }
}
export function beginYouthProOffers(world: ProWorldState, date: IsoDate, nationalityId: string, score: number): ProCareerState {
  const trial = beginProTrial(date)
  return { ...trial, stage: 'offers', trialDay: 21, trialScore: score,
    offers: buildTrialOffers(world, score, nationalityId), trust: 45 }
}
