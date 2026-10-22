import { GROUPED_FOURTH, GROUPED_FIFTH, GROUPED_THIRD, LOWER_DIVISIONS, PRO_GROUPED_FOURTH_LEAGUE_PLAN, PRO_GROUPED_FIFTH_LEAGUE_PLAN, PRO_FIFTH_LEAGUE_PLAN, PRO_DEEP_LEAGUE_PLAN, PRO_GROUPED_LEAGUE_PLAN, PRO_LEAGUE_PLAN, PRO_LOWER_LEAGUE_PLAN, PRO_PYRAMID_FLOORS } from './proLeagueRegistry'
import { advancePromotionPlayoff } from './proPromotionPlayoffs'
import { advanceDeepPlayoff } from './proDeepPlayoffs'
import { feederQualification } from './proFeederPlayoffs'
import { nationalLeagueQualification } from './proFifthPlayoffs'
import { germanRegionalQualification } from './proGermanRegionalliga'
import { scottishRegionalQualification } from './proScottishRegional'
import { brazilSerieDQualification } from './proBrazilSerieD'
import { spanishSegundaFederacion, italianSerieD, portugueseCampeonato, southAfricaProvincial, promotionEligible } from './proRegionalRules'
import { createAcademyIntake, hydrateDeepDivisions, hydrateFifthDivisions, hydrateGroupedFourthDivisions, hydrateGroupedFifthDivisions, hydrateGroupedDivisions, hydrateLowerDivisions, hydrateNewBackgroundLeagues, createProWorld, newProLeagueSeason, proRoll } from './proWorldFactory'
import { ageOf, growOrDecline, nextShirtNumber, seasonalInjury, shouldRetire, signBackgroundReplacement } from './proLifecycle'
import { advanceTournamentsTo, beginClubWorldSeason, beginContinentalSeason, beginNationsLeague, beginWorldQualifiers, beginDomesticSeason, beginNationalSeason, beginWorldSeason, beginSouthAfricanTopEight, beginPreseasonInvitational, invalidateTournamentCalendar } from './proTournaments'
import type { IsoDate, ProClub, ProFixture, ProPlayer, ProStandingRow, ProWorldState } from './proWorld'

function ordered(rows: ProStandingRow[]): ProStandingRow[] {
  return [...rows].sort((a, b) => b.points - a.points ||
    (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) ||
    b.goalsFor - a.goalsFor || a.clubId.localeCompare(b.clubId))
}

function score(world: ProWorldState, fixture: ProFixture, home: boolean,
  strengths: ReadonlyMap<string, number>): number {
  const side = world.clubs[home ? fixture.homeId : fixture.awayId]
  const opponent = world.clubs[home ? fixture.awayId : fixture.homeId]
  const ourStyle = world.managers[`manager-${side.id}`]?.tacticalStyle ?? 'balanced'
  const theirStyle = world.managers[`manager-${opponent.id}`]?.tacticalStyle ?? 'balanced'
  // Rock-paper-scissors tactical matchups provide a modest edge, never enough
  // to override the underlying gulf between professional divisions.
  const matchup: Record<string, string> = { pressing: 'possession', counter: 'pressing', possession: 'counter' }
  const tacticalEdge = matchup[ourStyle] === theirStyle ? .18
    : matchup[theirStyle] === ourStyle ? -.18 : 0
  const tempo = ourStyle === 'pressing' ? .14 : ourStyle === 'counter' ? -.08 : 0
  // Current playing strength, not a club's historical prestige, drives results.
  // Keep a small reputation factor for institutional experience and stability.
  const strengthGap = (strengths.get(side.id) ?? side.reputation) -
    (strengths.get(opponent.id) ?? opponent.reputation)
  const edge = strengthGap * .038 + (side.reputation - opponent.reputation) * .004 +
    (home ? .32 : 0) + tacticalEdge + tempo
  const chance = proRoll(world.seed, `${fixture.id}:${home ? 'home' : 'away'}`)
  return Math.max(0, Math.min(7, Math.floor(1.55 + edge + (chance - .5) * 3.6)))
}

function play(world: ProWorldState, fixture: ProFixture,
  strengths: ReadonlyMap<string, number>): void {
  if (fixture.result) return
  const homeGoals = score(world, fixture, true, strengths)
  const awayGoals = score(world, fixture, false, strengths)
  fixture.result = { homeGoals, awayGoals }
  const rows = world.standings[fixture.competitionId]
  const home = rows.find(row => row.clubId === fixture.homeId)!
  const away = rows.find(row => row.clubId === fixture.awayId)!
  home.played++; away.played++
  home.goalsFor += homeGoals; home.goalsAgainst += awayGoals
  away.goalsFor += awayGoals; away.goalsAgainst += homeGoals
  if (homeGoals > awayGoals) { home.won++; away.lost++; home.points += 3 }
  else if (awayGoals > homeGoals) { away.won++; home.lost++; away.points += 3 }
  else { home.drawn++; away.drawn++; home.points++; away.points++ }
  world.recentEvents.push({ id: `event-${fixture.id}`, date: fixture.kickoffDate, kind: 'match',
    subjectIds: [fixture.homeId, fixture.awayId], details: { competitionId: fixture.competitionId,
      homeGoals, awayGoals } })
}

/** Reconcile the human player's completed league match into the persistent
 * world table. If the background sim already processed this fixture, reverse
 * its deterministic score first and apply the actual human result.
 */
export function recordHumanProLeagueMatch(source: ProWorldState, country: string,
  homeId: string, awayId: string, homeGoals: number, awayGoals: number,
  fixtureId?: string, activeCompetitionId?: string): ProWorldState {
  const competitionId = activeCompetitionId ?? `top-${country}`
  // Always bind the human result to the current season's exact fixture.
  // A home/away pair can recur in every season, and Scotland can repeat pairs.
  const fixture = fixtureId ? source.fixtures[fixtureId] : Object.values(source.fixtures)
    .filter(game => game.competitionId === competitionId &&
      game.homeId === homeId && game.awayId === awayId &&
      game.id.includes(`-${source.competitions[competitionId]?.seasonId}-`))
    .sort((a, b) => a.kickoffDate.localeCompare(b.kickoffDate))
    .find(game => !game.result)
  if (fixture && (fixture.competitionId !== competitionId || fixture.homeId !== homeId ||
    fixture.awayId !== awayId || !fixture.id.includes(`-${source.competitions[competitionId]?.seasonId}-`)))
    return source
  if (!fixture || !source.standings[competitionId] ||
      !Number.isInteger(homeGoals) || !Number.isInteger(awayGoals) ||
      homeGoals < 0 || awayGoals < 0) return source
  if (fixture.result?.homeGoals === homeGoals && fixture.result.awayGoals === awayGoals) return source

  const standings = source.standings[competitionId].map(row => ({ ...row }))
  const home = standings.find(row => row.clubId === homeId)
  const away = standings.find(row => row.clubId === awayId)
  if (!home || !away) return source
  const apply = (h: number, a: number, weight: 1 | -1) => {
    home.played += weight; away.played += weight
    home.goalsFor += h * weight; home.goalsAgainst += a * weight
    away.goalsFor += a * weight; away.goalsAgainst += h * weight
    if (h > a) { home.won += weight; away.lost += weight; home.points += 3 * weight }
    else if (a > h) { away.won += weight; home.lost += weight; away.points += 3 * weight }
    else { home.drawn += weight; away.drawn += weight; home.points += weight; away.points += weight }
  }
  if (fixture.result) apply(fixture.result.homeGoals, fixture.result.awayGoals, -1)
  apply(homeGoals, awayGoals, 1)
  if (standings.some(row => row.played < 0 || row.won < 0 || row.drawn < 0 ||
    row.lost < 0 || row.points < 0 || row.goalsFor < 0 || row.goalsAgainst < 0))
    throw new Error('Human match reconciliation corrupted professional standings')
  const newFixture = { ...fixture, result: { homeGoals, awayGoals } }
  const events = source.recentEvents.filter(event => event.id !== `event-${fixture.id}`)
  events.push({ id: `event-${fixture.id}`, date: fixture.kickoffDate, kind: 'match',
    subjectIds: [homeId, awayId], details: { competitionId, homeGoals, awayGoals, playedByHuman: true } })
  return { ...source,
    fixtures: { ...source.fixtures, [fixture.id]: newFixture },
    standings: { ...source.standings, [competitionId]: standings },
    recentEvents: events.slice(-240),
  }
}

function seasonFinances(world: ProWorldState, club: ProClub, roster: ProPlayer[], rank: number, leagueSize: number,
  nextYear: number, archiveDate: IsoDate, prospects: Map<string, string[]>): ProPlayer[] {
  const finance = club.finances
  const gain = Math.round(((leagueSize - rank) / Math.max(1, leagueSize - 1) - .5) * .12 * finance.annualRevenue)
  const nextRevenue = Math.max(Math.floor((finance.baselineAnnualRevenue ?? finance.annualRevenue) * .9), finance.annualRevenue + gain)
  const expenses = finance.committedAnnualWages + finance.committedAnnualBonuses +
    finance.committedAnnualTransferCosts + finance.committedAnnualAgentFees +
    Math.floor(finance.annualRevenue * .43)
  const balance = finance.cash + finance.annualRevenue - expenses
  if (balance < 0) { finance.debt = (finance.debt ?? 0) - balance; finance.cash = 0 }
  else { const repayment = Math.min(balance, finance.debt ?? 0); finance.debt = (finance.debt ?? 0) - repayment; finance.cash = balance - repayment }
  finance.annualRevenue = nextRevenue
  finance.annualSquadCostLimit = Math.floor(nextRevenue * .58)
  // Each club considers academy promotions and market signings separately.
  // Ability and shirt numbers never copy the outgoing player.
  const arrivals: ProPlayer[] = []
  const academy = (prospects.get(club.id) ?? []).map(id => world.academyProspects[id]).filter(prospect => !!prospect)
    .sort((a, b) => b.potential - a.potential || a.id.localeCompare(b.id))
  for (const player of roster) {
    const age = ageOf(player, nextYear)
    // The human career is governed by its own injury/retirement decisions.
    if (!player.id.startsWith('career-') && shouldRetire(player, nextYear, world.seed)) {
      if (world.loans[player.id]) delete world.loans[player.id]
      delete world.players[player.id]
      world.retirementCount = (world.retirementCount ?? 0) + 1
      world.retirementHistory.push({ id: player.id, name: player.name, clubId: club.id, date: archiveDate,
        age, finalOverall: player.overall, reason: player.retirementChoice ? 'player-choice' : player.careerEndingInjury || age < 33 ? 'injury' : 'age' })
      world.retirementHistory = world.retirementHistory.slice(-500)
      const prospect = academy.find(candidate => candidate.position === player.position)
      const promote = !!prospect && prospect.potential >= club.reputation - 10 &&
        proRoll(world.seed, `${club.id}:${player.id}:succession:${nextYear}`) < .28
      let incoming: ProPlayer
      if (promote) {
        academy.splice(academy.indexOf(prospect), 1)
        incoming = { id: prospect.id, name: prospect.name, birthDate: prospect.birthDate,
          nationalityIds: prospect.nationalityIds, position: prospect.position, overall: prospect.overall,
          potential: prospect.potential, clubId: club.id,
          shirtNumber: nextShirtNumber([...roster.filter(item => !!world.players[item.id]), player, ...arrivals], club.id,
            25 + Math.floor(proRoll(world.seed, `${prospect.id}:shirt`) * 60)),
          annualWage: Math.max(1, Math.floor(player.annualWage * .5)), origin: 'academy' }
        world.academyGraduateCount = (world.academyGraduateCount ?? 0) + 1
      } else {
        incoming = signBackgroundReplacement(world, club, player, nextYear, archiveDate,
          [...roster.filter(item => !!world.players[item.id]), player, ...arrivals])
        world.transferIntakeCount = (world.transferIntakeCount ?? 0) + 1
      }
      world.players[incoming.id] = incoming
      arrivals.push(incoming)
      if (promote) world.recentEvents.push({ id: `event-${incoming.id}`, date: archiveDate, kind: 'contract',
        subjectIds: [incoming.id, club.id], details: { action: 'academy-graduation' } })
    } else if (!player.id.startsWith('career-')) { growOrDecline(player, nextYear, world.seed); seasonalInjury(world, player, nextYear, archiveDate) }
  }
  for (const id of prospects.get(club.id) ?? []) delete world.academyProspects[id]
  // Fresh IDs for the next intake; never recreate a cohort already promoted.
  const intake = createAcademyIntake(club, world.seed, nextYear + 1)
  for (const prospect of intake) world.academyProspects[prospect.id] = prospect
  prospects.set(club.id, intake.map(prospect => prospect.id))
  const active = [...roster.filter(player => !!world.players[player.id] && player.clubId === club.id), ...arrivals]
  finance.committedAnnualWages = active.reduce((sum, player) => sum + (world.loans[player.id] ? Math.ceil(player.annualWage / 2) : player.annualWage), 0)
    + Object.values(world.loans).filter(loan => loan.parentClubId === club.id).reduce((sum, loan) => sum + Math.floor(loan.originalWage / 2), 0)
  finance.topPlayerAnnualWage = active.length ? Math.max(...active.map(player => player.annualWage)) : 0
  return active
}

function archive(world: ProWorldState, competitionId: string, fixtures: ProFixture[], rosters: Map<string, ProPlayer[]>, prospects: Map<string, string[]>): void {
  const competition = world.competitions[competitionId]
  const table = ordered(world.standings[competitionId])
  const championId = table[0].clubId
  world.championHistory.push({ competitionId, seasonId: competition.seasonId, championId })
  world.seasonHistory.push({ competitionId, seasonId: competition.seasonId, championId, table })
  // Keep two detailed editions on device; title and promotion history remain for long careers.
  world.seasonHistory = world.seasonHistory.filter(row =>
    row.competitionId !== competitionId || Number(competition.seasonId) - Number(row.seasonId) < 2)
  const nextYear = Number(competition.seasonId) + 1
  const archiveDate = fixtures.reduce((last, fixture) => fixture.kickoffDate > last ? fixture.kickoffDate : last, '0000-01-01')
  table.forEach((row, index) => rosters.set(row.clubId,
    seasonFinances(world, world.clubs[row.clubId], rosters.get(row.clubId)!, index + 1, table.length, nextYear, archiveDate, prospects)))
  world.recentEvents.push({ id: `event-title-${competitionId}-${competition.seasonId}`,
    date: archiveDate,
    kind: 'award', subjectIds: [championId], details: { competitionId, seasonId: competition.seasonId } })
  for (const fixture of fixtures) delete world.fixtures[fixture.id]
  void nextYear
}

function exchangeDivisions(world: ProWorldState, associationId: string, playoffWinner?: string): void {
  const rule = LOWER_DIVISIONS[associationId]
  const top = ordered(world.seasonHistory.filter(row => row.competitionId === `top-${associationId}`).at(-1)!.table)
  const second = ordered(world.seasonHistory.filter(row => row.competitionId === `second-${associationId}`).at(-1)!.table)
  let relegated = top.slice(-rule.relegated).map(row => row.clubId)
  let promoted = second.slice(0, rule.promoted).map(row => row.clubId)
  if (['eng', 'esp', 'ita'].includes(associationId) && playoffWinner)
    promoted = [...second.slice(0, 2).map(row => row.clubId), playoffWinner]
  if (['ger', 'fra', 'sco', 'ned'].includes(associationId) && playoffWinner &&
      playoffWinner !== top.at(associationId === 'sco' ? -2 : -3)!.clubId) {
    promoted = [...promoted, playoffWinner]
    relegated = [...relegated, top.at(associationId === 'sco' ? -2 : -3)!.clubId]
  }
  if (associationId === 'por' && playoffWinner && playoffWinner !== top.at(-3)!.clubId) {
    promoted = [...promoted, playoffWinner]
    relegated = [...relegated, top.at(-3)!.clubId]
  }
  if (associationId === 'bra' && playoffWinner && Number(world.competitions['top-bra'].seasonId) >= 2026) {
    const otherWinner = world.promotionPlayoffs?.['promotion-bra']?.secondWinnerId
    if (!otherWinner || otherWinner === playoffWinner) throw new Error('Incomplete Brazilian promotion playoff')
    promoted = [second[0].clubId, second[1].clubId, playoffWinner, otherWinner]
  }
  if (associationId === 'rsa' && playoffWinner) {
    promoted = [second[0].clubId]
    if (playoffWinner !== top.at(-2)!.clubId) {
      promoted.push(playoffWinner)
      relegated = [...relegated, top.at(-2)!.clubId]
    }
  }
  // Never silently duplicate a promoted side, swap unequal numbers of clubs,
  // or move a club that was not in the completed division.
  if (promoted.length !== relegated.length ||
      new Set(promoted).size !== promoted.length ||
      new Set(relegated).size !== relegated.length ||
      promoted.some(id => !second.some(row => row.clubId === id)) ||
      relegated.some(id => !top.some(row => row.clubId === id)))
    throw new Error(`Invalid ${associationId} top-flight promotion/relegation exchange`)
  for (const id of relegated) world.clubs[id].tier = 2
  for (const id of promoted) world.clubs[id].tier = 1
  const playoff = world.promotionPlayoffs?.[`promotion-${associationId}`]
  const fixtures = playoff?.fixtureIds.map(id => world.fixtures[id]).filter(Boolean) ?? []
  const date = fixtures.reduce((last, fixture) => fixture.kickoffDate > last ? fixture.kickoffDate : last,
    `${world.competitions[`top-${associationId}`].seasonId}-01-01`)
  world.promotionHistory ??= []
  world.promotionHistory.push({ associationId, seasonId: world.competitions[`top-${associationId}`].seasonId,
    promotedIds: promoted, relegatedIds: relegated, fixtures: structuredClone(fixtures) })
  for (const fixture of fixtures) delete world.fixtures[fixture.id]
  if (playoff) delete world.promotionPlayoffs![`promotion-${associationId}`]
  world.recentEvents.push({ id: `event-promotion-${associationId}-${world.seasonHistory.at(-1)!.seasonId}`,
    date, kind: 'award', subjectIds: [...promoted, ...relegated],
    details: { action: 'promotion-relegation', associationId, promoted: promoted.length, relegated: relegated.length } })
}

function exchangeDeepDivisions(world: ProWorldState, associationId: 'eng' | 'ger' | 'sco', upperTier: 2 | 3,
  playoffWinner: string): void {
  const upperId = `${upperTier === 2 ? 'second' : 'third'}-${associationId}`
  const lowerId = `${upperTier === 2 ? 'third' : 'fourth'}-${associationId}`
  const upper = ordered(world.seasonHistory.filter(row => row.competitionId === upperId).at(-1)!.table)
  const lower = ordered(world.seasonHistory.filter(row => row.competitionId === lowerId).at(-1)!.table)
  const direct = associationId === 'eng' ? upperTier === 2 ? 2 : 3 : associationId === 'ger' ? 2 : 1
  const demoted = associationId === 'eng' ? upperTier === 2 ? 3 : 4 : associationId === 'ger' ? 2 : 1
  const promoted = lower.slice(0, direct).map(row => row.clubId)
  const relegated = upper.slice(-demoted).map(row => row.clubId)
  const incumbent = associationId === 'ger' ? upper.at(-3)!.clubId : associationId === 'sco' ? upper.at(-2)!.clubId : null
  if (incumbent !== playoffWinner) {
    promoted.push(playoffWinner)
    if (incumbent) relegated.push(incumbent)
  }
  if (promoted.length !== relegated.length || new Set(promoted).size !== promoted.length || new Set(relegated).size !== relegated.length)
    throw new Error(`Invalid ${associationId} tier ${upperTier} exchange`)
  for (const id of promoted) world.clubs[id].tier = upperTier
  for (const id of relegated) world.clubs[id].tier = upperTier + 1 as 3 | 4
  const key = `promotion-${associationId}-${upperTier}`
  const state = world.promotionPlayoffs![key]
  const fixtures = state.fixtureIds.map(id => world.fixtures[id])
  world.promotionHistory ??= []
  world.promotionHistory.push({ associationId: `${associationId}-${upperTier}`,
    seasonId: world.competitions[upperId].seasonId, promotedIds: promoted, relegatedIds: relegated,
    fixtures: structuredClone(fixtures) })
  for (const fixture of fixtures) delete world.fixtures[fixture.id]
  delete world.promotionPlayoffs![key]
}

/** Fill precisely the vacant regional places while minimizing home-region
 * displacement. Permanent geographic affiliation never changes on promotion.
 */
function assignRegionalVacancies(world: ProWorldState, ids: string[], vacancies: number[],
  tier: 3 | 4 | 5, regions: number): void {
  const available = [...vacancies]
  if (available.length !== ids.length || available.some(group => group < 1 || group > regions))
    throw new Error('Invalid regional vacancy allocation')
  const affinity = (id: string): number => {
    const club = world.clubs[id]
    const source = club.homeRegion ?? club.feederGroup ?? 1
    const count = club.homeRegionCount ?? regions
    return (source - .5) / count
  }
  for (const id of [...ids].sort((a, b) => affinity(a) - affinity(b) || a.localeCompare(b))) {
    const origin = affinity(id)
    let index = -1, distance = Infinity
    available.forEach((group, candidate) => {
      const delta = Math.abs(origin - (group - .5) / regions)
      if (delta < distance) { distance = delta; index = candidate }
    })
    const [assigned] = available.splice(index, 1)
    world.clubs[id].tier = tier
    world.clubs[id].feederGroup = assigned
  }
  if (available.length) throw new Error('Unfilled regional vacancies')
}

function exchangeGroupedDivisions(world: ProWorldState, associationId: string,
  qualification: ReturnType<typeof feederQualification>): void {
  const format = GROUPED_THIRD[associationId]
  const upper = ordered(world.seasonHistory.filter(row => row.competitionId === `second-${associationId}`).at(-1)!.table)
  const promoted = qualification.promotedIds
  if (promoted.length !== format.promoted || new Set(promoted).size !== promoted.length)
    throw new Error(`Invalid ${associationId} feeder qualification`)
  const relegated = upper.slice(-format.promoted).map(row => row.clubId)
  const feederEntrants = Array.from({ length: format.groups }, (_, index) =>
    world.seasonHistory.filter(row => row.competitionId === `third-${associationId}-${index + 1}`).at(-1)?.table ?? [])
    .flat().map(row => row.clubId)
  if (relegated.length !== promoted.length ||
      new Set(relegated).size !== relegated.length ||
      promoted.some(id => !feederEntrants.includes(id)) ||
      relegated.some(id => !upper.some(row => row.clubId === id)))
    throw new Error(`Invalid ${associationId} grouped third-tier exchange`)
  for (const id of promoted) world.clubs[id].tier = 2
  // Preserve group size by assigning each incoming club to a promoted vacancy.
  const vacancies = promoted.map(id => world.clubs[id].feederGroup ?? 1)
  assignRegionalVacancies(world, relegated, vacancies, 3, format.groups)
  world.promotionHistory ??= []
  world.promotionHistory.push({ associationId: `${associationId}-2`, seasonId: world.competitions[`second-${associationId}`].seasonId,
    promotedIds: promoted, relegatedIds: relegated, fixtures: qualification.fixtures })
}

function exchangeNationalThird(world: ProWorldState, associationId: 'fra' | 'bra',
  qualification?: ReturnType<typeof feederQualification>): void {
  const upper = ordered(world.seasonHistory.filter(row => row.competitionId === `second-${associationId}`).at(-1)!.table)
  const lower = ordered(world.seasonHistory.filter(row => row.competitionId === `third-${associationId}`).at(-1)!.table)
  const count = associationId === 'bra' ? 4 : 2
  // Brazil Série C promotes the top two of each final group, not simply
  // the four highest finishers in the opening-stage table.
  const promoted = associationId === 'bra'
    ? qualification?.promotedIds ?? (() => { throw new Error('Brazil Série C final groups missing') })()
    : lower.slice(0, count).map(row => row.clubId)
  if (promoted.length !== count || new Set(promoted).size !== count)
    throw new Error(`Invalid ${associationId} national third-tier promotion`)
  const relegated = upper.slice(-count).map(row => row.clubId)
  if (relegated.length !== promoted.length ||
      new Set(relegated).size !== relegated.length ||
      promoted.some(id => !lower.some(row => row.clubId === id)))
    throw new Error(`Invalid ${associationId} national third-tier exchange`)
  for (const id of promoted) world.clubs[id].tier = 2
  for (const id of relegated) world.clubs[id].tier = 3
  world.promotionHistory ??= []
  world.promotionHistory.push({ associationId: `${associationId}-2`, seasonId: world.competitions[`second-${associationId}`].seasonId,
    promotedIds: promoted, relegatedIds: relegated, fixtures: qualification?.fixtures ?? [] })
}

/** Exchange two clubs between the EFL and National League without changing league sizes. */
function exchangeEnglishNationalLeague(world: ProWorldState,
  qualification: ReturnType<typeof nationalLeagueQualification>): void {
  const upper = ordered(world.seasonHistory.filter(row => row.competitionId === 'fourth-eng').at(-1)!.table)
  const lower = ordered(world.seasonHistory.filter(row => row.competitionId === 'fifth-eng').at(-1)!.table)
  const promoted = qualification.promotedIds
  const relegated = upper.slice(-2).map(row => row.clubId)
  if (promoted.length !== 2 || new Set(promoted).size !== 2 ||
      promoted.some(id => !lower.some(row => row.clubId === id)) ||
      new Set(relegated).size !== 2)
    throw new Error('Invalid English National League promotion')
  for (const id of promoted) world.clubs[id].tier = 4
  for (const id of relegated) world.clubs[id].tier = 5
  world.promotionHistory ??= []
  world.promotionHistory.push({ associationId: 'eng-4',
    seasonId: world.competitions['fourth-eng'].seasonId,
    promotedIds: promoted, relegatedIds: relegated,
    fixtures: structuredClone(qualification.fixtures) })
}

/** The five Regionalliga champions contest four places in the national 3. Liga. */
/** Six Série D promotion qualifiers replace six outgoing clubs in the fixed-size Série C simulation. */
function exchangeBrazilSerieD(world: ProWorldState,
  qualification: ReturnType<typeof brazilSerieDQualification>): void {
  const third = ordered(world.seasonHistory.filter(row => row.competitionId === 'third-bra').at(-1)!.table)
  const promoted = qualification.promotedIds
  const relegated = third.slice(-GROUPED_FOURTH.bra.promoted).map(row => row.clubId)
  const vacated = promoted.map(id => world.clubs[id].feederGroup!)
  if (promoted.length !== GROUPED_FOURTH.bra.promoted || relegated.length !== GROUPED_FOURTH.bra.promoted ||
      new Set(promoted).size !== promoted.length || new Set(relegated).size !== relegated.length ||
      promoted.some(id => world.clubs[id].tier !== 4) ||
      relegated.some(id => world.clubs[id].tier !== 3) ||
      vacated.some(group => !group || group > GROUPED_FOURTH.bra.groups))
    throw new Error('Invalid Brazilian Série D promotions')
  promoted.forEach(id => { world.clubs[id].tier = 3; world.clubs[id].feederGroup = undefined })
  assignRegionalVacancies(world, relegated, vacated, 4, GROUPED_FOURTH.bra.groups)
  world.promotionHistory ??= []
  world.promotionHistory.push({ associationId: 'bra-3', seasonId: world.competitions['third-bra'].seasonId,
    promotedIds: promoted, relegatedIds: relegated, fixtures: structuredClone(qualification.fixtures) })
}

/** Match regional fourth-tier promotion slots to the relegation places in each
 * grouped third tier. Real geography remains abstracted, but group sizes,
 * movement, club identities, and deterministic season histories stay correct.
 */
function exchangeRegionalFourth(world: ProWorldState, country: 'esp' | 'ita' | 'por' | 'rsa',
  qualification: { promotedIds: string[]; fixtures: ProFixture[] }): void {
  const format = GROUPED_FOURTH[country]
  const third = GROUPED_THIRD[country]
  const promoted = qualification.promotedIds
  const relegated = Array.from({ length: third.groups }, (_, index) => {
    const rows = world.seasonHistory.filter(record =>
      record.competitionId === `third-${country}-${index + 1}`).at(-1)?.table
    if (!rows || rows.length !== third.clubsPerGroup)
      throw new Error(`Missing ${country} regional third-tier group ${index + 1}`)
    return ordered(rows).slice(-(format.promoted / third.groups)).map(row => row.clubId)
  }).flat()
  if (promoted.length !== format.promoted || relegated.length !== format.promoted ||
      new Set(promoted).size !== promoted.length || new Set(relegated).size !== relegated.length ||
      promoted.some(id => world.clubs[id]?.tier !== 4) ||
      relegated.some(id => world.clubs[id]?.tier !== 3))
    throw new Error(`Invalid ${country} regional promotion exchange`)

  // Each promoted club leaves a fourth-tier vacancy in its own geographical
  // group, while each relegated third-tier club leaves a third-tier vacancy.
  // Reassign those vacancies by the club's permanent geographic affiliation,
  // not by its position in a random array. No group may grow or shrink.
  const fourthVacancies = promoted.map(id => world.clubs[id].feederGroup!)
  const thirdVacancies = relegated.map(id => world.clubs[id].feederGroup!)
  assignRegionalVacancies(world, promoted, thirdVacancies, 3, third.groups)
  assignRegionalVacancies(world, relegated, fourthVacancies, 4, format.groups)
  world.promotionHistory ??= []
  world.promotionHistory.push({ associationId: `${country}-3`,
    seasonId: world.competitions[`second-${country}`].seasonId,
    promotedIds: promoted, relegatedIds: relegated, fixtures: structuredClone(qualification.fixtures) })
}

/** National 2 regional champions enter France's third tier; three places go back down. */
function exchangeFrenchNationalTwo(world: ProWorldState): void {
  const upper = ordered(world.seasonHistory.filter(row => row.competitionId === 'third-fra').at(-1)!.table)
  const promoted = Array.from({ length: GROUPED_FOURTH.fra.groups }, (_, index) => {
    const groupId = `fourth-fra-${index + 1}`
    const group = world.seasonHistory.filter(row => row.competitionId === groupId).at(-1)?.table
    if (!group || group.length !== GROUPED_FOURTH.fra.clubsPerGroup)
      throw new Error(`Missing French National 2 group ${index + 1}`)
    const candidate = ordered(group).find(row => promotionEligible(world,row.clubId,3))
    if (!candidate) throw new Error('French National 2 group has no eligible licensed promotion candidate')
    return candidate.clubId
  })
  const relegated = upper.slice(-GROUPED_FOURTH.fra.promoted).map(row => row.clubId)
  if (promoted.length !== relegated.length || new Set(promoted).size !== promoted.length)
    throw new Error('Unbalanced French National 2 promotion')
  promoted.forEach(id => { world.clubs[id].tier = 3; world.clubs[id].feederGroup = undefined })
  assignRegionalVacancies(world, relegated, [1, 2, 3], 4, GROUPED_FOURTH.fra.groups)
  world.promotionHistory ??= []
  world.promotionHistory.push({ associationId: 'fra-3',
    seasonId: world.competitions['third-fra'].seasonId,
    promotedIds: promoted, relegatedIds: relegated, fixtures: [] })
}

function exchangeGermanRegionalliga(world: ProWorldState,
  qualification: ReturnType<typeof germanRegionalQualification>): void {
  const upper = ordered(world.seasonHistory.filter(row => row.competitionId === 'third-ger').at(-1)!.table)
  const promoted = qualification.promotedIds
  const feederEntrants = Array.from({ length: GROUPED_FOURTH.ger.groups }, (_, index) =>
    world.seasonHistory.filter(row => row.competitionId === `fourth-ger-${index + 1}`).at(-1)?.table ?? [])
    .flat().map(row => row.clubId)
  const relegated = upper.slice(-4).map(row => row.clubId)
  if (promoted.length !== 4 || relegated.length !== 4 ||
      new Set(promoted).size !== 4 || new Set(relegated).size !== 4 ||
      promoted.some(id => !feederEntrants.includes(id)))
    throw new Error('Invalid German Regionalliga promotion/relegation')
  // Assign relegated clubs to the vacated regional places; keep all groups at 18.
  const vacated = promoted.map(id => world.clubs[id].feederGroup ?? 1)
  promoted.forEach(id => { world.clubs[id].tier = 3; world.clubs[id].feederGroup = undefined })
  assignRegionalVacancies(world, relegated, vacated as number[], 4, GROUPED_FOURTH.ger.groups)
  world.promotionHistory ??= []
  world.promotionHistory.push({ associationId: 'ger-3',
    seasonId: world.competitions['third-ger'].seasonId,
    promotedIds: promoted, relegatedIds: relegated,
    fixtures: structuredClone(qualification.fixtures) })
}

/** Only exchange League Two with the fifth tier if a regional champion beats the incumbent. */
function exchangeScottishRegional(world: ProWorldState,
  qualification: ReturnType<typeof scottishRegionalQualification>): void {
  const promoted = qualification.promotedIds, relegated = qualification.relegatedIds
  if (promoted.length !== relegated.length || promoted.length > 1)
    throw new Error('Unbalanced Scottish regional playoff outcome')
  if (promoted.length) {
    const outgoingRegion = world.clubs[promoted[0]].feederGroup
    if (!outgoingRegion || outgoingRegion > GROUPED_FIFTH.sco.groups ||
        world.clubs[promoted[0]].tier !== 5 || world.clubs[relegated[0]].tier !== 4)
      throw new Error('Invalid Scottish fifth-tier club exchange')
    world.clubs[promoted[0]].tier = 4
    world.clubs[promoted[0]].feederGroup = undefined
    world.clubs[relegated[0]].tier = 5
    world.clubs[relegated[0]].feederGroup = outgoingRegion
  }
  world.promotionHistory ??= []
  world.promotionHistory.push({ associationId: 'sco-4', seasonId: world.competitions['fourth-sco'].seasonId,
    promotedIds: promoted, relegatedIds: relegated, fixtures: structuredClone(qualification.fixtures) })
}

function scheduleScottishSplit(world: ProWorldState, fixtures: ProFixture[]): ProFixture[] {
  const competition = world.competitions['top-sco']
  if (competition.splitScheduled || fixtures.length !== 198 || !fixtures.every(fixture => fixture.result)) return fixtures
  const groups = [ordered(world.standings['top-sco']).slice(0, 6), ordered(world.standings['top-sco']).slice(6)]
  const finalDate = fixtures.reduce((latest, fixture) => fixture.kickoffDate > latest ? fixture.kickoffDate : latest, '0000-01-01')
  const extra: ProFixture[] = []
  groups.forEach((group, half) => {
    const rotation = group.map(row => row.clubId)
    if (rotation.length !== 6 || new Set(rotation).size !== 6)
      throw new Error('Scottish split requires six distinct clubs in each half')
    // A single round-robin within each half: five matches per club, each
    // opponent exactly once. The fixed first club is the circle-method pivot.
    for (let round = 0; round < 5; round++) {
      for (let pair = 0; pair < 3; pair++) {
        const a = rotation[pair], b = rotation[5 - pair]
        const homeId = (round + pair) % 2 ? a : b
        const awayId = (round + pair) % 2 ? b : a
        const id = `fixture-top-sco-${competition.seasonId}-split-${half}-${round}-${pair}`
        const kickoffDate = new Date(Date.parse(`${finalDate}T00:00:00Z`) + (round + 1) * 7 * 86_400_000).toISOString().slice(0, 10)
        world.fixtures[id] = { id, competitionId: 'top-sco', kickoffDate, homeId, awayId }
        extra.push(world.fixtures[id])
      }
      rotation.splice(1, 0, rotation.pop()!)
    }
  })
  competition.splitScheduled = true
  return [...fixtures, ...extra]
}

/** Assert that promotion/relegation stays inside the frozen pyramid and
 * that every existing club still has exactly one competition next season.
 */
function assertClosedPyramid(world: ProWorldState, associationId: string,
  divisions: readonly { id: string }[], expectedSizes: readonly number[]): void {
  const floor = PRO_PYRAMID_FLOORS[associationId]
  if (!floor) return
  const entrants = new Set<string>()
  divisions.forEach((division, index) => {
    const competition = world.competitions[division.id]
    if (!competition || competition.entrantIds.length !== expectedSizes[index])
      throw new Error(`Unbalanced ${associationId} pyramid: ${division.id} changed league size`)
    for (const id of competition.entrantIds) {
      const club = world.clubs[id]
      const tier = division.id.startsWith('top-') ? 1 :
        division.id.startsWith('second-') ? 2 :
        division.id.startsWith('third-') ? 3 :
        division.id.startsWith('fourth-') ? 4 : 5
      const group = division.id.match(/-(\d+)$/)?.[1]
      if (!club || club.associationId !== associationId || club.tier !== tier ||
          group && club.feederGroup !== Number(group) || entrants.has(id))
        throw new Error(`Invalid ${associationId} post-promotion membership: ${id} in ${division.id}`)
      entrants.add(id)
    }
  })
  const clubs = Object.values(world.clubs).filter(club => club.associationId === associationId)
  if (clubs.length !== entrants.size ||
      clubs.some(club => !club.tier || club.tier > floor || !entrants.has(club.id)))
    throw new Error(`Club disappeared or was relegated below ${associationId}'s tier ${floor} floor`)
}

function advanceLeaguesTo(world: ProWorldState, targetDate: IsoDate): void {
  invalidateTournamentCalendar(world)
  const rosters = new Map<string, ProPlayer[]>()
  const prospects = new Map<string, string[]>()
  for (const prospect of Object.values(world.academyProspects)) {
    const group = prospects.get(prospect.clubId) ?? []
    group.push(prospect.id)
    prospects.set(prospect.clubId, group)
  }
  for (const player of Object.values(world.players)) if (player.clubId) {
    const group = rosters.get(player.clubId) ?? []
    group.push(player)
    rosters.set(player.clubId, group)
  }
  // One cached squad-strength lookup per advance rather than scanning every
  // player for every match. Starting-quality players count more than reserves.
  const strengths = new Map<string, number>()
  for (const [clubId, players] of rosters) {
    const best = [...players].sort((a, b) => b.overall - a.overall).slice(0, 11)
    if (best.length) strengths.set(clubId,
      best.reduce((sum, player) => sum + player.overall, 0) / best.length)
  }
  const fixtureIndex = new Map<string, ProFixture[]>()
  for (const fixture of Object.values(world.fixtures)) {
    const group = fixtureIndex.get(fixture.competitionId) ?? []
    group.push(fixture)
    fixtureIndex.set(fixture.competitionId, group)
  }
  for (const league of PRO_LEAGUE_PLAN) {
    const lower = PRO_LOWER_LEAGUE_PLAN.find(item => item.associationId === league.associationId)
    const divisions = [league, ...(lower ? [lower] : []),
      ...PRO_DEEP_LEAGUE_PLAN.filter(item => item.associationId === league.associationId),
      ...PRO_GROUPED_LEAGUE_PLAN.filter(item => item.associationId === league.associationId),
      ...PRO_FIFTH_LEAGUE_PLAN.filter(item => item.associationId === league.associationId),
      ...PRO_GROUPED_FOURTH_LEAGUE_PLAN.filter(item => item.associationId === league.associationId),
      ...PRO_GROUPED_FIFTH_LEAGUE_PLAN.filter(item => item.associationId === league.associationId)]
    for (let season = 0; season < 60; season++) {
      const batches = divisions.map(item => (fixtureIndex.get(item.id) ?? [])
        .sort((a, b) => a.kickoffDate.localeCompare(b.kickoffDate) || a.id.localeCompare(b.id)))
      if (batches.some(fixtures => !fixtures.length)) throw new Error(`Missing fixtures for ${league.associationId}`)
      for (const fixtures of batches) for (const fixture of fixtures)
        if (!fixture.result && fixture.kickoffDate < targetDate) play(world, fixture, strengths)
      if (league.associationId === 'sco' && batches[0].every(fixture => fixture.result)) {
        const extended = scheduleScottishSplit(world, batches[0])
        if (extended !== batches[0]) { fixtureIndex.set('top-sco', extended); continue }
      }
      // Série B finishes before Série A. Its two promotion ties must exist in
      // November even while top-flight league fixtures remain on the calendar.
      if (league.associationId === 'bra' && Number(world.competitions[league.id].seasonId) >= 2026 &&
          batches[1].every(fixture => !!fixture.result)) {
        const lastLowerDate = batches[1].at(-1)!.kickoffDate
        advancePromotionPlayoff(world, 'bra', world.competitions[league.id].seasonId, lastLowerDate,
          targetDate, world.standings[league.id], world.standings[lower!.id])
      }
      if (!batches.every(fixtures => fixtures.every(fixture => !!fixture.result))) break
      let playoffWinner: string | undefined
      if (['eng', 'rsa', 'esp', 'ger', 'fra', 'sco', 'por', 'ita', 'ned'].includes(league.associationId) ||
          league.associationId === 'bra' && Number(world.competitions[league.id].seasonId) >= 2026) {
        const playoffBatches = league.associationId === 'bra' ? batches[1] : batches.flat()
        const lastDate = playoffBatches.reduce((latest, fixture) => fixture.kickoffDate > latest ? fixture.kickoffDate : latest, '0000-01-01')
        playoffWinner = advancePromotionPlayoff(world, league.associationId as 'eng' | 'rsa' | 'esp' | 'ger' | 'fra' | 'sco' | 'por' | 'bra' | 'ita' | 'ned', world.competitions[league.id].seasonId,
          lastDate, targetDate, world.standings[league.id], world.standings[lower!.id]) ?? undefined
        if (!playoffWinner) break
      }
      const deepResults: { upperTier: 2 | 3; winner: string }[] = []
      let nationalLeagueResult: ReturnType<typeof nationalLeagueQualification> | undefined
      let germanRegionalResult: ReturnType<typeof germanRegionalQualification> | undefined
      let scottishRegionalResult: ReturnType<typeof scottishRegionalQualification> | undefined
      let brazilFourthResult: ReturnType<typeof brazilSerieDQualification> | undefined
      let regionalResult: {promotedIds: string[]; fixtures: ProFixture[]; readyDate: IsoDate} | undefined
      let feederResult: ReturnType<typeof feederQualification> | undefined
      if (league.associationId in GROUPED_THIRD || league.associationId === 'bra') {
        const lastDate = batches.slice(2).flat().reduce((latest, fixture) => fixture.kickoffDate > latest ? fixture.kickoffDate : latest, '0000-01-01')
        feederResult = feederQualification(world, league.associationId, lastDate)
        if (targetDate <= feederResult.readyDate) break
      }
      if (['eng', 'ger', 'sco'].includes(league.associationId)) {
        const lastDate = batches.flat().reduce((latest, fixture) => fixture.kickoffDate > latest ? fixture.kickoffDate : latest, '0000-01-01')
        for (const upperTier of ([2, 3] as const)) {
          const upper = divisions.find(item => item.id === `${upperTier === 2 ? 'second' : 'third'}-${league.associationId}`)
          const next = divisions.find(item => item.id === `${upperTier === 2 ? 'third' : 'fourth'}-${league.associationId}`)
          if (!upper || !next) continue
          const winner = advanceDeepPlayoff(world, league.associationId as 'eng' | 'ger' | 'sco', upperTier,
            world.competitions[upper.id].seasonId, lastDate, targetDate, world.standings[upper.id], world.standings[next.id])
          if (!winner) break
          deepResults.push({ upperTier, winner })
        }
        const expectedDeep = league.associationId === 'eng' ? 2 : league.associationId === 'ger' ? 1 : 2
        if (deepResults.length !== expectedDeep) break
      }
      if (league.associationId === 'eng') {
        const lastDate = batches.flat().reduce((latest, fixture) =>
          fixture.kickoffDate > latest ? fixture.kickoffDate : latest, '0000-01-01')
        nationalLeagueResult = nationalLeagueQualification(world, lastDate)
        if (targetDate <= nationalLeagueResult.readyDate) break
      }
      if (league.associationId === 'ger') {
        const lastDate = batches.flat().reduce((latest, fixture) =>
          fixture.kickoffDate > latest ? fixture.kickoffDate : latest, '0000-01-01')
        germanRegionalResult = germanRegionalQualification(world, lastDate)
        if (targetDate <= germanRegionalResult.readyDate) break
      }
      if (league.associationId === 'sco') {
        const lastDate = batches.flat().reduce((latest, fixture) =>
          fixture.kickoffDate > latest ? fixture.kickoffDate : latest, '0000-01-01')
        scottishRegionalResult = scottishRegionalQualification(world, lastDate)
        if (targetDate <= scottishRegionalResult.readyDate) break
      }
      if (league.associationId === 'bra') {
        const lastDate = batches.flat().reduce((latest, fixture) =>
          fixture.kickoffDate > latest ? fixture.kickoffDate : latest, '0000-01-01')
        brazilFourthResult = brazilSerieDQualification(world, lastDate)
        if (targetDate <= brazilFourthResult.readyDate) break
      }
      const expectedSizes = divisions.map(item => world.competitions[item.id].entrantIds.length)
      if (['esp', 'ita', 'por', 'rsa'].includes(league.associationId)) {
        const lastDate = batches.flat().reduce((latest, fixture) =>
          fixture.kickoffDate > latest ? fixture.kickoffDate : latest, '0000-01-01')
        regionalResult = league.associationId === 'esp'
          ? spanishSegundaFederacion(world, lastDate)
          : league.associationId === 'ita'
            ? italianSerieD(world)
            : league.associationId === 'por'
              ? portugueseCampeonato(world, lastDate)
              : southAfricaProvincial(world)
        if (targetDate <= regionalResult.readyDate) break
      }
      const nextYear = Number(world.competitions[league.id].seasonId) + 1
      divisions.forEach((item, index) => archive(world, item.id, batches[index], rosters, prospects))
      if (lower) exchangeDivisions(world, league.associationId, playoffWinner)
      for (const { upperTier, winner } of deepResults)
        exchangeDeepDivisions(world, league.associationId as 'eng' | 'ger' | 'sco', upperTier, winner)
      if (nationalLeagueResult) exchangeEnglishNationalLeague(world, nationalLeagueResult)
      if (germanRegionalResult) exchangeGermanRegionalliga(world, germanRegionalResult)
      if (league.associationId === 'fra') exchangeFrenchNationalTwo(world)
      if (regionalResult && ['esp', 'ita', 'por', 'rsa'].includes(league.associationId))
        exchangeRegionalFourth(world, league.associationId as 'esp' | 'ita' | 'por' | 'rsa', regionalResult)
      if (scottishRegionalResult) exchangeScottishRegional(world, scottishRegionalResult)
      if (brazilFourthResult) exchangeBrazilSerieD(world, brazilFourthResult)
      if (feederResult && league.associationId in GROUPED_THIRD)
        exchangeGroupedDivisions(world, league.associationId, feederResult)
      if (league.associationId === 'fra' || league.associationId === 'bra')
        exchangeNationalThird(world, league.associationId, league.associationId === 'bra' ? feederResult : undefined)
      divisions.forEach(item => fixtureIndex.set(item.id, newProLeagueSeason(world, item, nextYear)))
      assertClosedPyramid(world, league.associationId, divisions, expectedSizes)
    }
  }
}

/** Advance by dated milestones so qualification uses the world as it stood at the draw. */
export function advanceProWorldTo(source: ProWorldState, targetDate: IsoDate): ProWorldState {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate) ||
      new Date(`${targetDate}T00:00:00Z`).toISOString().slice(0, 10) !== targetDate)
    throw new Error('Invalid target date')
  if (targetDate < source.currentDate) throw new Error('Cannot rewind the pro world')
  if (targetDate === source.currentDate) return source
  const world = structuredClone(source)
  world.academyProspects ??= {}
  world.retirementCount ??= 0
  world.academyGraduateCount ??= 0
  world.transferIntakeCount ??= 0
  world.retirementHistory ??= []
  world.loans ??= {}
  // An old save may be missing several newly modelled tiers. Generate the
  // complete template once, instead of cloning 100 countries per missing tier.
  const allPlans = [...PRO_LEAGUE_PLAN, ...PRO_LOWER_LEAGUE_PLAN, ...PRO_DEEP_LEAGUE_PLAN,
    ...PRO_GROUPED_LEAGUE_PLAN, ...PRO_FIFTH_LEAGUE_PLAN,
    ...PRO_GROUPED_FOURTH_LEAGUE_PLAN, ...PRO_GROUPED_FIFTH_LEAGUE_PLAN]
  const template = allPlans.some(plan => !world.competitions[plan.id])
    ? createProWorld(world.seed, world.currentDate) : undefined
  hydrateNewBackgroundLeagues(world, template)
  hydrateLowerDivisions(world, template)
  hydrateDeepDivisions(world, template)
  hydrateGroupedDivisions(world, template)
  hydrateFifthDivisions(world, template)
  hydrateGroupedFourthDivisions(world, template)
  hydrateGroupedFifthDivisions(world, template)
  const milestones: { date: IsoDate; kind: 'national' | 'continental' | 'summer-cups' | 'domestic' }[] = []
  for (let year = Number(source.currentDate.slice(0, 4)); year <= Number(targetDate.slice(0, 4)); year++) {
    milestones.push({ date: `${year}-01-01`, kind: 'national' }, { date: `${year}-07-01`, kind: 'summer-cups' }, { date: `${year}-08-01`, kind: 'domestic' }, { date: `${year}-09-01`, kind: 'continental' })
  }
  for (const milestone of milestones.filter(item => item.date >= source.currentDate && item.date <= targetDate)
    .sort((a, b) => a.date.localeCompare(b.date))) {
    advanceLeaguesTo(world, milestone.date)
    advanceTournamentsTo(world, milestone.date)
    world.currentDate = milestone.date
    if (milestone.kind === 'national') {
      beginNationalSeason(world, Number(milestone.date.slice(0, 4)))
      beginWorldQualifiers(world, Number(milestone.date.slice(0, 4)))
      beginWorldSeason(world, Number(milestone.date.slice(0, 4)))
      beginClubWorldSeason(world, Number(milestone.date.slice(0, 4)))
    }
    if (milestone.kind === 'domestic' && world.competitions['cup-eng']?.seasonId !== milestone.date.slice(0, 4))
      beginDomesticSeason(world, Number(milestone.date.slice(0, 4)))
    if (milestone.kind === 'summer-cups') {
      if (world.competitions['mtn8-rsa']?.seasonId !== milestone.date.slice(0, 4))
        beginSouthAfricanTopEight(world, Number(milestone.date.slice(0, 4)))
      beginPreseasonInvitational(world, Number(milestone.date.slice(0, 4)))
    }
    if (milestone.kind === 'continental' && world.competitions['continental-uefa']?.seasonId !== milestone.date.slice(0, 4)) {
      beginContinentalSeason(world, Number(milestone.date.slice(0, 4)))
      beginNationsLeague(world, Number(milestone.date.slice(0, 4)))
    }
  }
  advanceLeaguesTo(world, targetDate)
  advanceTournamentsTo(world, targetDate)
  world.recentEvents = world.recentEvents.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).slice(-240)
  world.championHistory.sort((a, b) => a.seasonId.localeCompare(b.seasonId) || a.competitionId.localeCompare(b.competitionId))
  world.seasonHistory = world.seasonHistory.filter(record => Number(targetDate.slice(0, 4)) - Number(record.seasonId) <= 8)
    .sort((a, b) => a.seasonId.localeCompare(b.seasonId) || a.competitionId.localeCompare(b.competitionId))
  world.currentDate = targetDate
  return world
}
