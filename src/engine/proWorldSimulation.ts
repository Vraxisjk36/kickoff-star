import { PRO_LEAGUE_PLAN } from './proLeagueRegistry'
import { createAcademyIntake, newProLeagueSeason, proRoll } from './proWorldFactory'
import { ageOf, growOrDecline, nextShirtNumber, seasonalInjury, shouldRetire, signBackgroundReplacement } from './proLifecycle'
import { advanceTournamentsTo, beginClubWorldSeason, beginContinentalSeason, beginNationsLeague, beginWorldQualifiers, beginDomesticSeason, beginNationalSeason, beginWorldSeason, invalidateTournamentCalendar } from './proTournaments'
import type { IsoDate, ProClub, ProFixture, ProPlayer, ProStandingRow, ProWorldState } from './proWorld'

function ordered(rows: ProStandingRow[]): ProStandingRow[] {
  return [...rows].sort((a, b) => b.points - a.points ||
    (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) ||
    b.goalsFor - a.goalsFor || a.clubId.localeCompare(b.clubId))
}

function score(world: ProWorldState, fixture: ProFixture, home: boolean): number {
  const side = world.clubs[home ? fixture.homeId : fixture.awayId]
  const opponent = world.clubs[home ? fixture.awayId : fixture.homeId]
  const edge = (side.reputation - opponent.reputation) * .042 + (home ? .32 : 0)
  const chance = proRoll(world.seed, `${fixture.id}:${home ? 'home' : 'away'}`)
  return Math.max(0, Math.min(7, Math.floor(1.55 + edge + (chance - .5) * 3.6)))
}

function play(world: ProWorldState, fixture: ProFixture): void {
  if (fixture.result) return
  const homeGoals = score(world, fixture, true)
  const awayGoals = score(world, fixture, false)
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
    if (shouldRetire(player, nextYear, world.seed)) {
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
    } else { growOrDecline(player, nextYear, world.seed); seasonalInjury(world, player, nextYear, archiveDate) }
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

function archive(world: ProWorldState, competitionId: string, fixtures: ProFixture[], rosters: Map<string, ProPlayer[]>, prospects: Map<string, string[]>): ProFixture[] {
  const competition = world.competitions[competitionId]
  const table = ordered(world.standings[competitionId])
  const championId = table[0].clubId
  world.championHistory.push({ competitionId, seasonId: competition.seasonId, championId })
  world.seasonHistory.push({ competitionId, seasonId: competition.seasonId, championId, table })
  // Full old tables are bounded; title history remains for long careers.
  world.seasonHistory = world.seasonHistory.filter(row =>
    row.competitionId !== competitionId || Number(competition.seasonId) - Number(row.seasonId) < 8)
  const nextYear = Number(competition.seasonId) + 1
  const archiveDate = fixtures.reduce((last, fixture) => fixture.kickoffDate > last ? fixture.kickoffDate : last, '0000-01-01')
  table.forEach((row, index) => rosters.set(row.clubId,
    seasonFinances(world, world.clubs[row.clubId], rosters.get(row.clubId)!, index + 1, table.length, nextYear, archiveDate, prospects)))
  world.recentEvents.push({ id: `event-title-${competitionId}-${competition.seasonId}`,
    date: archiveDate,
    kind: 'award', subjectIds: [championId], details: { competitionId, seasonId: competition.seasonId } })
  for (const fixture of fixtures) delete world.fixtures[fixture.id]
  const league = PRO_LEAGUE_PLAN.find(row => row.id === competitionId)!
  return newProLeagueSeason(world, league, nextYear)
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
  const fixtureIndex = new Map<string, ProFixture[]>()
  for (const fixture of Object.values(world.fixtures)) {
    const group = fixtureIndex.get(fixture.competitionId) ?? []
    group.push(fixture)
    fixtureIndex.set(fixture.competitionId, group)
  }
  for (const league of PRO_LEAGUE_PLAN) {
    for (let season = 0; season < 60; season++) {
      const competitionId = league.id
      const fixtures = (fixtureIndex.get(competitionId) ?? [])
        .sort((a, b) => a.kickoffDate.localeCompare(b.kickoffDate) || a.id.localeCompare(b.id))
      if (!fixtures.length) throw new Error(`Missing fixtures for ${competitionId}`)
      for (const fixture of fixtures) if (!fixture.result && fixture.kickoffDate < targetDate) play(world, fixture)
      if (fixtures.every(fixture => !!fixture.result)) fixtureIndex.set(competitionId, archive(world, competitionId, fixtures, rosters, prospects))
      else break
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
  const milestones: { date: IsoDate; kind: 'national' | 'continental' }[] = []
  for (let year = Number(source.currentDate.slice(0, 4)); year <= Number(targetDate.slice(0, 4)); year++) {
    milestones.push({ date: `${year}-01-01`, kind: 'national' }, { date: `${year}-09-01`, kind: 'continental' })
  }
  for (const milestone of milestones.filter(item => item.date >= source.currentDate && item.date <= targetDate)
    .sort((a, b) => a.date.localeCompare(b.date))) {
    advanceLeaguesTo(world, milestone.date)
    advanceTournamentsTo(world, milestone.date)
    world.currentDate = milestone.date
    if (milestone.kind === 'national' && world.competitions['cup-eng']?.seasonId !== milestone.date.slice(0, 4)) {
      beginDomesticSeason(world, Number(milestone.date.slice(0, 4)))
      beginNationalSeason(world, Number(milestone.date.slice(0, 4)))
      beginWorldQualifiers(world, Number(milestone.date.slice(0, 4)))
      beginWorldSeason(world, Number(milestone.date.slice(0, 4)))
      beginClubWorldSeason(world, Number(milestone.date.slice(0, 4)))
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
