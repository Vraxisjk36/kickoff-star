import { recordProRelationship, transferRelationshipModifier } from './proRelationships'
import type { Player } from '../types/player'
import { createProCareer, type ProCareerState, type ProClubObjective, type ProMarketOffer, type ProPayStatement } from './proCareer'
import { createProWorld } from './proWorldFactory'
import { advanceProWorldTo } from './proWorldSimulation'
import { gameWithholdingBps } from './proContracts'
import { getAgent } from './agents'
import { assessProDeal } from './proClubFinance'
import { completeProTransfer } from './proTransfers'
import { registrationOpen } from './proMovement'
import { PRO_INTERACTIVE_COUNTRIES } from './proLeagueRegistry'
import { returnProLoan } from './proMovement'
import { nextShirtNumber } from './proLifecycle'
import { gatherProNews } from './proNews'
import { computeCurrentAbility, toOvr } from './rating'
import { recordTournamentResult, proCompetitionName } from './proTournaments'
import type { ProFixture, ProWorldState } from './proWorld'
import type { MatchRecord } from './matchLedger'
import { generateTeam, teamOverall } from './teams'
import { calibrateSeniorTeam, proRatingTarget } from './proRatings'
import type { LeagueWorld, Division } from './league'
import { mondayFrom } from './proWeeklySchedule'

const addDays = (date: string, days: number): string => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
const monthIndex = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1
function housingFor(player: Player): number { return Math.max(260, Math.round((player.contract?.terms.weeklyWage ?? 1000) * 52 / 12 * .22)) }

/** Club board expectations use relative reputation within the actual division.
 * They remain attached to a club/season; promotion generates a new objective.
 */
export function generateClubObjective(state: ProCareerState, world = state.backgroundWorld): ProClubObjective | undefined {
  if (!world || !state.clubWorldIds) return undefined
  const worldClubId = state.clubWorldIds[state.world.playerTeamId]
  const competition = Object.values(world.competitions).find(comp =>
    comp.kind === 'league' && comp.entrantIds.includes(worldClubId))
  if (!competition) return undefined
  const participants = competition.entrantIds
    .map(id => world.clubs[id])
    .filter((club): club is NonNullable<typeof club> => !!club)
    .sort((a, b) => b.reputation - a.reputation || a.id.localeCompare(b.id))
  const expectedRank = participants.findIndex(club => club.id === worldClubId) + 1
  const count = competition.entrantIds.length
  if (!expectedRank || !count) return undefined
  const type = expectedRank <= Math.max(2, Math.round(count * .12)) ? 'title'
    : expectedRank <= Math.round(count * .3) ? 'continental'
    : expectedRank <= Math.round(count * .65) ? 'top-half' : 'survival'
  const targetPosition = type === 'title' ? Math.max(1, Math.round(count * .12))
    : type === 'continental' ? Math.max(3, Math.round(count * .28))
      : type === 'top-half' ? Math.ceil(count / 2) : Math.max(1, count - Math.max(2, Math.floor(count * .16)))
  return { seasonId: competition.seasonId, competitionId: competition.id, clubId: worldClubId,
    type, targetPosition, boardConfidence: 60 }
}

/** Use the persistent federation competition as the playable match-calendar
 * source. Local team IDs remain stable, while fixture IDs and opponents match
 * the real world exactly. Also works after promotion and relegation.
 */
export function syncPlayableProLeague(state: ProCareerState, world = state.backgroundWorld): ProCareerState {
  if (!world || !state.clubWorldIds) return state
  const associationId = state.associationId ?? 'eng'
  const playerClubId = state.clubWorldIds[state.world.playerTeamId]
  if (!playerClubId) return state
  const competition = Object.values(world.competitions).find(comp =>
    comp.kind === 'league' && comp.associationId === associationId &&
    comp.entrantIds.includes(playerClubId))
  if (!competition) return state
  const current = state.world.divisions[1]
  const oldTeams = new Map(current.teams.map(team => [state.clubWorldIds![team.id], team]))
  const teams = competition.entrantIds.map((clubId, index) => {
    const club = world.clubs[clubId]
    const existing = oldTeams.get(clubId)
    const generated = existing ?? generateTeam(Math.max(3, Math.min(8, Math.round(club.reputation / 14))))
    const tier = competition.id.startsWith('top-') ? 1 : (club.tier ?? 2)
    const target = Math.max(club.reputation,proRatingTarget(associationId,tier,index,competition.entrantIds.length))
    const normalized = teamOverall(generated) < target-5
      ? calibrateSeniorTeam(generated,target) : generated
    return { ...normalized, name: club.name,
      short: club.name.split(' ').map(word => word[0]).join('').slice(0, 3).toUpperCase(),
      id: existing?.id ?? `career-club-${clubId}-${index}` }
  })
  const clubWorldIds = Object.fromEntries(teams.map((team, index) =>
    [team.id, competition.entrantIds[index]]))
  const reverse = new Map(teams.map((team, index) =>
    [competition.entrantIds[index], team.id]))
  const orderedFixtures = Object.values(world.fixtures).filter(fixture =>
    fixture.competitionId === competition.id &&
    fixture.id.includes(`-${competition.seasonId}-`))
    .sort((a, b) => a.kickoffDate.localeCompare(b.kickoffDate) || a.id.localeCompare(b.id))
  const dates = [...new Set(orderedFixtures.map(fixture => fixture.kickoffDate))]
  const played = new Map(current.fixtures.filter(fixture => fixture.played)
    .map(fixture => [fixture.id, fixture]))
  const fixtures = orderedFixtures.map(fixture => {
    const recorded = played.get(fixture.id)
    return { id: fixture.id, week: dates.indexOf(fixture.kickoffDate) + 1,
      homeTeamId: reverse.get(fixture.homeId)!, awayTeamId: reverse.get(fixture.awayId)!,
      played: recorded?.played ?? false, homeGoals: recorded?.homeGoals ?? null,
      awayGoals: recorded?.awayGoals ?? null }
  }).filter(fixture => fixture.homeTeamId && fixture.awayTeamId)
  const sameSeason = state.activeSeasonId === competition.seasonId &&
    state.activeCompetitionId === competition.id
  const previous = new Map(sameSeason ? current.standings.map(row => [row.teamId, row]) : [])
  const standings = teams.map(team => ({
    teamId: team.id,
    played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
    ...(previous.get(team.id) ?? {}),
    // Preserve played match totals, but use the upgraded full club name.
    teamName: team.name, teamShort: team.short,
  }))
  const division: Division = { ...current, teams, standings, fixtures,
    matchRecords: sameSeason ? current.matchRecords : [], tier: 1 }
  const leagues: LeagueWorld = { ...state.world, kind: 'pro',
    playerTeamId: reverse.get(playerClubId) ?? state.world.playerTeamId,
    divisions: { ...state.world.divisions, 1: division } }
  const selected = { ...state, world: leagues, clubWorldIds,
    activeCompetitionId: competition.id, activeSeasonId: competition.seasonId }
  const existing = state.clubObjective
  const clubObjective = existing && existing.seasonId === competition.seasonId &&
    existing.competitionId === competition.id && existing.clubId === playerClubId
    ? existing : generateClubObjective(selected, world)
  return { ...selected, clubObjective }
}

/** Attach the recorded club to the living world without touching the youth save. */
export function attachProWorld(state: ProCareerState, player: Player): ProCareerState {
  if (state.backgroundWorld) return state
  // Align first-team preseason with the opening of the national fixture
  // calendar. Continental European leagues start in August; Brazil starts
  // in January. Week 1 is preseason, Week 5 the first league date.
  const baseDate = (state.associationId ?? 'eng') === 'bra' ? '2026-01-03' : '2026-07-18'
  const date = addDays(baseDate, (state.season - 1) * 364 + (state.week - 1) * 7)
  const world = createProWorld(player.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) + 17, date)
  const playable = state.world.divisions[1].teams
  const country = state.associationId ?? 'eng'
  const targetCompetition = world.competitions[`${state.openingTier===2?'second':'top'}-${country}`]
  const global = targetCompetition?.entrantIds.map(id=>world.clubs[id]) ?? []
  if(global.length!==playable.length)throw new Error(`Professional league size mismatch: ${country} tier ${state.openingTier??1}`)
  const ownName=playable.find(team=>team.id===state.world.playerTeamId)?.name
  // The chosen offer must connect to its *real* persistent club, not a
  // placeholder assigned to a high-ranking team by array index.
  const chosen=global.find(club=>club.name===ownName)
  if(!chosen)throw new Error(`Offered club ${ownName} is missing from the living world`)
  const remaining=global.filter(club=>club.id!==chosen.id)
  const clubWorldIds=Object.fromEntries(playable.map((team,index)=>
    [team.id,index===0?chosen.id:remaining[index-1].id]))
  const ownClubId = clubWorldIds[state.world.playerTeamId]
  const club = world.clubs[ownClubId]
  const annualWage = Math.round((player.contract?.terms.weeklyWage ?? 1200) * 52)
  const playerId = `career-${player.id}`
  const shirtNumber = nextShirtNumber(Object.values(world.players), club.id, state.shirtNumber)
  world.players[playerId] = { id: playerId, name: player.name, birthDate: `${Number(date.slice(0, 4)) - player.careerClock.ageYears}-06-15`,
    nationalityIds: [player.nationality ?? 'eng'], position: player.position, overall: toOvr(computeCurrentAbility(player)),
    potential: Math.max(45, Math.min(94, Math.round(player.potential * 4.4))), clubId: club.id, annualWage, shirtNumber, origin: 'senior' }
  club.finances.committedAnnualWages += annualWage
  const residence = state.residence ?? { countryId: club.associationId, city: club.homeCity, monthlyRent: housingFor(player), hotelUntil: addDays(date, 21) }
  return syncPlayableProLeague({ ...state, backgroundWorld: world, clubWorldIds, date, shirtNumber, residence, payStatements: state.payStatements ?? [], pendingBonus: state.pendingBonus ?? 0, news: state.news ?? [] })
}

/** The next dated cup tie for the player's club, before the next weekly tick. */
export function pendingProCup(state: ProCareerState): ProFixture | null {
  if (!state.backgroundWorld || !state.date || !state.clubWorldIds || state.freeAgentSinceWeek !== undefined) return null
  const clubId = state.clubWorldIds[state.world.playerTeamId]
  const weekStart=mondayFrom(state.date)
  const until = addDays(weekStart, 7)
  // National-team duty supersedes club cup and summer invitational selection.
  if (state.international?.pending) return null
  return Object.values(state.backgroundWorld.fixtures)
    .filter(fixture => !fixture.result && fixture.kickoffDate >= weekStart && fixture.kickoffDate < until &&
      (fixture.homeId === clubId || fixture.awayId === clubId) && !!state.backgroundWorld!.competitions[fixture.competitionId]?.tournament)
    .sort((a, b) => a.kickoffDate.localeCompare(b.kickoffDate) || a.id.localeCompare(b.id))[0] ?? null
}

export function resolveProCup(state: ProCareerState, player: Player, fixtureId: string, result: {
  scored: number; conceded: number; goals: number; assists: number; rating: number; energy: number; minutes: number;
  yellowCards: number; redCarded: boolean; injury?: { severity: string; weeksOut: number; description: string } | null
}): { state: ProCareerState; record: MatchRecord } | null {
  const due = pendingProCup(state)
  if (!due || due.id !== fixtureId || !state.backgroundWorld || !state.clubWorldIds) return null
  const home = due.homeId === state.clubWorldIds[state.world.playerTeamId]
  const world = { ...state.backgroundWorld,
    fixtures: { ...state.backgroundWorld.fixtures, [due.id]: { ...due } },
    standings: { ...state.backgroundWorld.standings, [due.competitionId]: state.backgroundWorld.standings[due.competitionId].map(row => ({ ...row })) },
    recentEvents: [...state.backgroundWorld.recentEvents] }
  if (!recordTournamentResult(world, due.id, home ? result.scored : result.conceded, home ? result.conceded : result.scored)) return null
  const fixture = world.fixtures[due.id]
  const record: MatchRecord = { id: due.id, competitionId: due.competitionId, season: state.season, week: state.week,
    homeTeamId: due.homeId, awayTeamId: due.awayId,
    homeTeamName: world.clubs[due.homeId]?.name ?? due.homeId, awayTeamName: world.clubs[due.awayId]?.name ?? due.awayId,
    homeGoals: fixture.result!.homeGoals, awayGoals: fixture.result!.awayGoals,
    lines: [{ playerId: player.id, name: player.name, position: player.position, teamId: state.world.playerTeamId,
      minutes: result.minutes, started: player.squadRole === 'starting-xi', rating: result.rating, goals: result.goals, assists: result.assists,
      saves: 0, tackles: 0, interceptions: 0, keyPasses: 0, yellowCards: result.yellowCards, redCards: result.redCarded ? 1 : 0 }] }
  return { state: { ...state, backgroundWorld: world }, record }
}

export function cupLabel(fixture: ProFixture): string { return proCompetitionName(fixture.competitionId) }

export function advanceLivingWorld(previous: ProCareerState, next: ProCareerState, player: Player): { state: ProCareerState; player: Player } {
  if (!previous.backgroundWorld || !previous.date) return { state: next, player }
  // The youth calendar has 44 playable weeks. Eight off-season weeks pass at
  // rollover, so the professional season begins in August again.
  const date = addDays(previous.date, next.season > previous.season ?
    (Math.max(0, ...previous.world.divisions[1].fixtures.map(f => f.week)) > 38 ? 7 : 63) : 7)
  let world = advanceProWorldTo(previous.backgroundWorld, date)
  const residence = previous.residence
  let money = player.money ?? 0
  let grossEarnings = player.careerEarnings ?? 0
  let feesPaid = player.agentFeesPaid ?? 0
  let bonus = previous.pendingBonus ?? 0
  const payStatements = [...(previous.payStatements ?? [])]
  for (let month = monthIndex(previous.date) + 1; month <= monthIndex(date); month++) {
    const year = Math.floor(month / 12), monthNumber = month % 12 + 1
    const stillSigned = !!player.contract && previous.freeAgentSinceWeek === undefined &&
      player.contract.expiresWeek > (player.totalWeeksElapsed ?? 0)
    const gross = stillSigned ? Math.round(player.contract!.terms.weeklyWage * 52 / 12) : 0
    const withholding = Math.round((gross + bonus) * gameWithholdingBps(residence?.countryId ?? 'eng') / 10000)
    const agentFee = Math.round((gross + bonus) * (getAgent(player.agentId)?.commission ?? 0) / 100)
    const housing = residence?.monthlyRent ?? housingFor(player)
    const statement: ProPayStatement = { season: previous.season, month: `${year}-${String(monthNumber).padStart(2, '0')}`, gross, bonus,
      estimatedWithholding: withholding, agentFee, housing, net: gross + bonus - withholding - agentFee - housing }
    payStatements.push(statement)
    money += statement.net; grossEarnings += gross + bonus; feesPaid += agentFee
    bonus = 0
  }
  let worldTeamId = next.world.playerTeamId
  let loan = previous.loan
  if (loan && next.season >= loan.returnSeason) {
    worldTeamId = loan.parentTeamId
    world = returnProLoan(world, `career-${player.id}`, { parentClubId: loan.parentWorldClubId, borrowingClubId: loan.borrowingClubId, ends: loan.ends, originalWage: loan.originalWage })
    loan = null
  }
  const news = gatherProNews(world, player, previous.season, previous.week, previous.news ?? [])
  const interim: ProCareerState = { ...next,
    world: { ...next.world, playerTeamId: worldTeamId },
    backgroundWorld: world, date,
    payStatements: payStatements.slice(-36), pendingBonus: bonus, loan, news,
    marketOffers: (previous.marketOffers ?? []).filter(offer => offer.expiresWeek > (player.totalWeeksElapsed ?? 0)),
    talks: previous.talks }
  // Promotion, relegation and the Scottish post-split schedule may change the
  // human club's opponents. Follow federation membership after each season,
  // and add split fixtures without discarding match results.
  const country = interim.associationId ?? 'eng'
  const worldClubId = interim.clubWorldIds?.[worldTeamId]
  const active = worldClubId && Object.values(world.competitions).find(comp =>
    comp.kind === 'league' && comp.associationId === country &&
    comp.entrantIds.includes(worldClubId))
  const newFixtureCount = active ? Object.values(world.fixtures).filter(f =>
    f.competitionId === active.id && f.id.includes(`-${active.seasonId}-`)).length : 0
  const rebuild = !!active && (next.season > previous.season ||
    active.id !== interim.activeCompetitionId || active.seasonId !== interim.activeSeasonId ||
    newFixtureCount > interim.world.divisions[1].fixtures.length)
  const synced = rebuild && previous.freeAgentSinceWeek === undefined
    ? syncPlayableProLeague(interim, world) : interim
  const paidPlayer = { ...player, money, careerEarnings: grossEarnings, agentFeesPaid: feesPaid,
    contract: worldTeamId !== next.world.playerTeamId && player.contract
      ? { ...player.contract, clubName: synced.world.divisions[1].teams.find(team => team.id === synced.world.playerTeamId)?.name ?? player.contract.clubName }
      : player.contract }
  return releaseExpiredProContract(synced, paidPlayer)
}

/** Two-year contract extension, offered during the final 26 weeks.
 * Wage increases must fit the club's available senior squad budget.
 */
/** On the first week after expiry, release the human player into free
 * agency. Preserve their club history, but detach from the squad and remove
 * committed wages. Idempotent across loading and subsequent weekly ticks.
 */
export function releaseExpiredProContract(state: ProCareerState, player: Player):
  { state: ProCareerState; player: Player } {
  const expiry = player.contract?.expiresWeek
  const elapsed = player.totalWeeksElapsed ?? 0
  if (expiry === undefined || elapsed < expiry || state.freeAgentSinceWeek !== undefined ||
      !state.backgroundWorld || !state.clubWorldIds || state.loan) return { state, player }
  const playerId = `career-${player.id}`
  const world = state.backgroundWorld
  const proPlayer = world.players[playerId]
  const clubId = proPlayer?.clubId
  if (!proPlayer || !clubId || !world.clubs[clubId]) {
    return { state: { ...state, freeAgentSinceWeek: elapsed, clubObjective: undefined, marketOffers: [], talks: null },
      player: { ...player, contract: null, squadRole: 'bench' } }
  }
  const club = world.clubs[clubId]
  const updatedWorld: ProWorldState = {
    ...world,
    players: { ...world.players, [playerId]: { ...proPlayer, clubId: null, annualWage: 0 } },
    clubs: { ...world.clubs, [clubId]: {
      ...club, finances: {
        ...club.finances,
        committedAnnualWages: Math.max(0, club.finances.committedAnnualWages - proPlayer.annualWage),
        topPlayerAnnualWage: Math.max(0, ...Object.values(world.players)
          .filter(candidate => candidate.id !== playerId && candidate.clubId === clubId)
          .map(candidate => candidate.annualWage)),
      },
    } },
    recentEvents: [...world.recentEvents, {
      id: `event-contract-expired-${playerId}-${elapsed}`,
      date: state.date ?? world.currentDate,
      kind: 'contract' as const,
      subjectIds: [playerId, clubId],
      details: { status: 'free-agent', expiredAtWeek: expiry },
    }].slice(-240),
  }
  return {
    state: { ...state, backgroundWorld: updatedWorld, freeAgentSinceWeek: elapsed,
      clubObjective: undefined, marketOffers: [], talks: null, loan: null },
    player: { ...player, contract: null, squadRole: 'bench' },
  }
}

export function offerProRenewal(state: ProCareerState, player: Player):
  { state: ProCareerState; player: Player } | null {
  const contract = player.contract
  const world = state.backgroundWorld
  const clubId = state.clubWorldIds?.[state.world.playerTeamId]
  const elapsed = player.totalWeeksElapsed ?? 0
  if (!contract || !world || !clubId || state.loan || state.retired ||
      state.freeAgentSinceWeek !== undefined ||
      state.lastRenewalWeek === elapsed || state.talks ||
      contract.expiresWeek - elapsed > 26 ||
      contract.expiresWeek <= elapsed) return null
  const club = world.clubs[clubId]
  const proPlayer = world.players[`career-${player.id}`]
  if (!club || !proPlayer || proPlayer.clubId !== clubId) return null
  const confidence = state.clubObjective?.boardConfidence ?? 60
  if (confidence < 30) return null
  const oldWage = contract.terms.weeklyWage
  const multiplier = confidence >= 80 ? 1.14 : confidence >= 60 ? 1.09 : 1.04
  const newWage = Math.max(oldWage + 1, Math.round(oldWage * multiplier))
  const extraCost = (newWage - oldWage) * 52
  const available = club.finances.annualSquadCostLimit - club.finances.committedAnnualWages
  if (extraCost > available) return null
  const nextWorld = { ...world,
    clubs: { ...world.clubs, [clubId]: { ...club, finances: { ...club.finances,
      committedAnnualWages: club.finances.committedAnnualWages + extraCost } } },
    players: { ...world.players, [proPlayer.id]: { ...proPlayer, annualWage: newWage * 52 } } }
  const nextContract = { ...contract, terms: { ...contract.terms, weeklyWage: newWage },
    signedWeek: elapsed, expiresWeek: elapsed + 104 }
  return { state: { ...state, backgroundWorld: nextWorld, lastRenewalWeek: elapsed },
    player: { ...player, contract: nextContract } }
}

export function generateMarketOffers(state: ProCareerState, player: Player): ProMarketOffer[] {
  const world = state.backgroundWorld
  if (!world || !state.clubWorldIds || !state.date) return []
  const freeAgent = state.freeAgentSinceWeek !== undefined
  const homeCountry = state.associationId ?? 'eng'
  const offerDate = state.date
  if (!freeAgent && !registrationOpen(homeCountry, offerDate)) return []
  const base = player.contract?.terms.weeklyWage ?? 1200
  const currentWorldClubId = state.clubWorldIds[state.world.playerTeamId]
  // Active professional countries only, top divisions only. Cross-border
  // registrations must be open on both ends.
  const targets = PRO_INTERACTIVE_COUNTRIES.flatMap(country => {
    if (!freeAgent && !registrationOpen(country, offerDate)) return []
    // To avoid discarding matchdays when changing leagues, international
    // offers occur around the opening of the professional season.
    if (!freeAgent && country !== homeCountry && state.week > 3) return []
    return world.competitions[`top-${country}`]?.entrantIds ?? []
  }).filter(id => id !== currentWorldClubId)
  const candidates = targets.map((id): (ProMarketOffer & { foreign: boolean; score: number }) | null => {
    const club = world.clubs[id]
    const localTeam = Object.entries(state.clubWorldIds!).find(([, worldId]) => worldId === id)?.[0]
    const weeklyWage = Math.max(350, Math.round(base * (1 + (club.reputation - 58) * .012 + transferRelationshipModifier(state.relationships, id))))
    const annualWage = weeklyWage * 52
    const affordable = assessProDeal(club.finances, { annualWage, probableAnnualBonuses: Math.round(annualWage * .1),
      annualTransferCost: 0, annualAgentFee: Math.round(annualWage * .05), upfrontTransferPayment: annualWage * 2,
      signingBonus: weeklyWage, role: 'rotation' }).affordable
    return affordable ? { teamId: localTeam ?? id, worldClubId: id, weeklyWage,
      expiresWeek: (player.totalWeeksElapsed ?? 0) + 5, foreign: club.associationId !== homeCountry,
      score: Math.abs(club.reputation - 58) + id.length % 7 } : null
  }).filter((offer): offer is ProMarketOffer & { foreign: boolean; score: number } => offer !== null)
    .sort((a, b) => a.score - b.score || a.worldClubId.localeCompare(b.worldClubId))
  // Always include at least one domestic opportunity if possible.
  const domestic = candidates.filter(item => !item.foreign).slice(0, 1)
  const abroad = candidates.filter(item => item.foreign).slice(0, 2)
  return [...domestic, ...abroad, ...candidates.filter(item => !domestic.includes(item) && !abroad.includes(item))]
    .slice(0, 3).map(({ teamId, worldClubId, weeklyWage, expiresWeek }) =>
      ({ teamId, worldClubId, weeklyWage, expiresWeek }))
}

export function finalizeProMove(state: ProCareerState, player: Player): { state: ProCareerState; player: Player } | null {
  const talks = state.talks
  if (!talks || talks.readyWeek > (player.totalWeeksElapsed ?? 0) || !state.backgroundWorld || !state.date) return null
  const offer = talks.offer
  const annualWage = offer.weeklyWage * 52
  const result = completeProTransfer(state.backgroundWorld, `career-${player.id}`, offer.worldClubId, {
    annualWage, probableAnnualBonuses: Math.round(annualWage * .1), annualTransferCost: 0, annualAgentFee: Math.round(annualWage * .05),
    upfrontTransferPayment: state.freeAgentSinceWeek !== undefined ? 0 : annualWage * 2,
    signingBonus: offer.weeklyWage, role: 'rotation' }, state.date)
  if (!result.ok) return null
  const club = result.world.clubs[offer.worldClubId]
  const destinationCountry = club.associationId
  const isForeign = destinationCountry !== (state.associationId ?? 'eng')
  const local = state.world.divisions[1].teams.find(candidate => candidate.id === offer.teamId)
  const needsRebuild = isForeign || !local
  const rebuilt = needsRebuild ? createProCareer(club.name, Math.max(3, Math.min(6, Math.round(club.reputation / 14))), destinationCountry) : null
  const team = rebuilt?.world.divisions[1].teams[0] ?? local
  if (!team) return null
  const miniWorld = rebuilt?.world ?? { ...state.world, playerTeamId: team.id }
  // The new career's match roster is mapped to the real destination league,
  // with the purchased club at index zero. Existing world fixtures stay intact.
  const destinationIds = result.world.competitions[`top-${destinationCountry}`]?.entrantIds ?? []
  const mappedIds = needsRebuild
    ? [club.id, ...destinationIds.filter(id => id !== club.id)]
    : []
  if (needsRebuild && mappedIds.length !== miniWorld.divisions[1].teams.length) return null
  const clubWorldIds = needsRebuild
    ? Object.fromEntries(miniWorld.divisions[1].teams.map((entry, index) => [entry.id, mappedIds[index]]))
    : state.clubWorldIds
  const nextPlayer = { ...player, squadRole: 'bench' as const, contract: player.contract
    ? { ...player.contract, clubName: club.name, terms: { ...player.contract.terms, weeklyWage: offer.weeklyWage }, signedWeek: player.totalWeeksElapsed ?? 0,
      expiresWeek: (player.totalWeeksElapsed ?? 0) + 88 }
    : { clubName: club.name, terms: { weeklyWage: offer.weeklyWage, years: 2, signingBonus: offer.weeklyWage,
      appearanceFee: Math.round(offer.weeklyWage * .08), goalBonus: Math.round(offer.weeklyWage * .15) },
      signedWeek: player.totalWeeksElapsed ?? 0, expiresWeek: (player.totalWeeksElapsed ?? 0) + 104 },
    turnedPro: player.turnedPro ? { ...player.turnedPro, clubName: club.name } : player.turnedPro }
  const moved: ProCareerState = { ...state, associationId: destinationCountry, world: miniWorld,
    clubWorldIds, freeAgentSinceWeek: undefined, clubObjective: undefined,
    activeCompetitionId: needsRebuild ? undefined : state.activeCompetitionId,
    activeSeasonId: needsRebuild ? undefined : state.activeSeasonId,
    resolvedWeek: undefined, backgroundWorld: result.world,
    shirtNumber: result.world.players[`career-${player.id}`].shirtNumber,
    residence: { countryId: club.associationId, city: club.homeCity, monthlyRent: housingFor(nextPlayer), hotelUntil: addDays(state.date, 21) },
    talks: null, marketOffers: [],
    relationships: recordProRelationship(state.relationships, { id: `signed:${offer.worldClubId}:${state.date}`,
      clubId: offer.worldClubId, kind: 'transfer', description: `Signed for ${club.name}` }) }
  return { state: syncPlayableProLeague(moved, result.world), player: nextPlayer }
}
