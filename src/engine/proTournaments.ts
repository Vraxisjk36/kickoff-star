import { PRO_LEAGUE_PLAN, type ProConfederation } from './proLeagueRegistry'
import { proRoll } from './proWorldFactory'
import type { IsoDate, ProCompetition, ProFixture, ProStandingRow, ProWorldState } from './proWorld'

const DAY = 86_400_000
const addDays = (date: IsoDate, days: number): IsoDate => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)
const confederations: ProConfederation[] = ['uefa', 'caf', 'conmebol', 'concacaf', 'afc', 'ofc']
const competitionNames: Record<ProConfederation, [string, string, string]> = {
  uefa: ['European Champions Series', 'European Union Cup', 'European Nations Championship'],
  caf: ['African Champions Series', 'African Confederation Trophy', 'African Nations Championship'],
  conmebol: ['South American Libertadores Series', 'South American Union Cup', 'South American Nations Championship'],
  concacaf: ['North American Champions Series', 'North American Union Cup', 'North American Nations Championship'],
  afc: ['Asian Champions Series', 'Asian Union Cup', 'Asian Nations Championship'],
  ofc: ['Oceanian Champions Series', 'Oceanian Union Cup', 'Oceanian Nations Championship'],
}
export function proCompetitionName(id: string): string {
  if (id === 'world-national') return 'World Nations Championship'
  if (id === 'world-club') return 'World Club Championship'
  if (id.startsWith('top-')) return `${PRO_LEAGUE_PLAN.find(item => item.associationId === id.slice(4))?.associationName ?? 'Domestic'} Elite League`
  if (id === 'conference-uefa') return 'European Conference Series'
  if (id === 'nations-uefa') return 'European Nations League'
  if (id === 'nations-concacaf') return 'North American Nations League'
  if (id.startsWith('qualifiers-')) return `${({ uefa: 'European', caf: 'African', conmebol: 'South American', concacaf: 'North American', afc: 'Asian', ofc: 'Oceanian' } as Record<string, string>)[id.slice(11)] ?? 'World'} World Qualifiers`
  if (id.startsWith('league-cup-')) return `${PRO_LEAGUE_PLAN.find(item => item.associationId === id.slice(11))?.associationName ?? 'Domestic'} League Cup`
  if (id.startsWith('super-cup-')) return `${PRO_LEAGUE_PLAN.find(item => item.associationId === id.slice(10))?.associationName ?? 'Domestic'} Super Cup`
  if (id.startsWith('cup-')) return `${PRO_LEAGUE_PLAN.find(item => item.associationId === id.slice(4))?.associationName ?? 'Domestic'} Cup`
  const [kind, confederation] = id.split('-') as [string, ProConfederation]
  return competitionNames[confederation]?.[kind === 'continental' ? 0 : kind === 'union' ? 1 : 2] ?? id
}
/** The current top 23 eligible players are selected from their association's active pool. */
export function nationalCallupFixture(world: ProWorldState, playerId: string, nationId: string, date: IsoDate): ProFixture | null {
  const player = world.players[playerId]
  if (world.associations[nationId]?.domesticMode !== 'full' || !player || !player.nationalityIds.includes(nationId) || player.injuredUntil && player.injuredUntil >= date) return null
  const fixture = Object.values(world.fixtures).find(item => item.kickoffDate === date &&
    world.competitions[item.competitionId]?.kind === 'national-team' &&
    (item.homeId === nationId || item.awayId === nationId))
  if (!fixture) return null
  const selected = Object.values(world.players).filter(candidate => candidate.nationalityIds.includes(nationId) &&
    candidate.clubId && (!candidate.injuredUntil || candidate.injuredUntil < date))
    .sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id)).slice(0, 23)
  return selected.some(candidate => candidate.id === playerId) ? fixture : null
}
const row = (clubId: string): ProStandingRow => ({ clubId, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 })
const calendarCache = new WeakMap<ProWorldState, Map<IsoDate, Set<string>>>()
export function invalidateTournamentCalendar(world: ProWorldState): void { calendarCache.delete(world) }
function calendar(world: ProWorldState): Map<IsoDate, Set<string>> {
  const cached = calendarCache.get(world)
  if (cached) return cached
  const dates = new Map<IsoDate, Set<string>>()
  for (const fixture of Object.values(world.fixtures)) {
    const busy = dates.get(fixture.kickoffDate) ?? new Set<string>()
    busy.add(fixture.homeId); busy.add(fixture.awayId)
    dates.set(fixture.kickoffDate, busy)
  }
  calendarCache.set(world, dates)
  return dates
}
const tableOrder = (a: ProStandingRow, b: ProStandingRow) => b.points - a.points ||
  (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor || a.clubId.localeCompare(b.clubId)
function leagueOrder(world: ProWorldState, associationId: string): string[] {
  const id = `top-${associationId}`
  const latest = world.seasonHistory.filter(record => record.competitionId === id).at(-1)
  const rows = latest?.table ?? world.standings[id] ?? []
  return [...rows].sort(tableOrder).map(record => record.clubId)
}
function isClubFixture(competition: ProCompetition): boolean { return competition.kind !== 'national-team' }
function occupied(world: ProWorldState, entrantId: string, date: IsoDate): boolean {
  return calendar(world).get(date)?.has(entrantId) ?? false
}
function shortRest(world: ProWorldState, entrantId: string, date: IsoDate): boolean {
  return [-2, -1, 1, 2].some(offset => occupied(world, entrantId, addDays(date, offset)))
}
function findDate(world: ProWorldState, comp: ProCompetition, a: string, b: string, desired: IsoDate): IsoDate {
  for (let shift = 0; shift < 28; shift++) {
    const date = addDays(desired, shift)
    if (!occupied(world, a, date) && !occupied(world, b, date) &&
      (!isClubFixture(comp) || !shortRest(world, a, date) && !shortRest(world, b, date)) &&
      (!isClubFixture(comp) || ![0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay()))) return date
  }
  throw new Error(`No tournament date for ${a} and ${b} near ${desired}`)
}
function schedule(world: ProWorldState, comp: ProCompetition, pairs: [string, string][], start: IsoDate, round: number): ProFixture[] {
  const scheduled: ProFixture[] = []
  for (let index = 0; index < pairs.length; index++) {
    const [homeId, awayId] = pairs[index]
    const kickoffDate = findDate(world, comp, homeId, awayId, start)
    const id = `fixture-${comp.id}-${comp.seasonId}-${comp.tournament!.stage}-${round}-${index}`
    world.fixtures[id] = { id, competitionId: comp.id, kickoffDate, homeId, awayId }
    scheduled.push(world.fixtures[id])
    const busy = calendar(world).get(kickoffDate) ?? new Set<string>()
    busy.add(homeId); busy.add(awayId)
    calendar(world).set(kickoffDate, busy)
  }
  return scheduled
}
function createCompetition(world: ProWorldState, id: string, kind: ProCompetition['kind'], year: number,
  entrants: string[], stage: NonNullable<ProCompetition['tournament']>['stage'], start: IsoDate): void {
  if (world.competitions[id] && !world.competitions[id].tournament?.completed) throw new Error(`Active tournament ${id}`)
  const comp: ProCompetition = { id, associationId: kind === 'domestic-cup' ? id.split('-').at(-1)! : null,
    kind, seasonId: String(year), entrantIds: entrants,
    format: { legs: 1, scheduledRounds: 0 }, tournament: { stage, round: 0 } }
  world.competitions[id] = comp
  world.standings[id] = entrants.map(row)
  if (stage === 'knockout') scheduleKnockout(world, comp, entrants, start)
  else scheduleGroups(world, comp, entrants, start)
}
function scheduleGroups(world: ProWorldState, comp: ProCompetition, entrants: string[], start: IsoDate): void {
  const count = comp.tournament!.stage === 'league-phase' ? comp.id === 'conference-uefa' ? 6 : 8 : comp.kind === 'national-team' || comp.id === 'world-club' ? 3 : 6
  const northAmerican = comp.id === 'nations-concacaf'
  const groups = comp.tournament!.stage === 'groups' ? northAmerican ? 11 : Math.ceil(entrants.length / 4) : 1
  comp.tournament!.groupByEntrant = Object.fromEntries(entrants.map((id, index) =>
    [id, northAmerican && index >= 32 ? 8 + Math.floor((index - 32) / 3) : Math.floor(index / 4)]))
  for (let round = 0; round < count; round++) {
    const pairs: [string, string][] = []
    if (comp.tournament!.stage === 'league-phase') {
      // Circle rotation gives each of 36 clubs eight different opponents.
      const arranged = [entrants[0], ...entrants.slice(1 + round).concat(entrants.slice(1, 1 + round))]
      for (let i = 0; i < arranged.length / 2; i++) pairs.push(round % 2 ? [arranged[i], arranged[arranged.length - 1 - i]] : [arranged[arranged.length - 1 - i], arranged[i]])
    } else for (let group = 0; group < groups; group++) {
      const members = entrants.filter(id => comp.tournament!.groupByEntrant?.[id] === group)
      if (members.length === 2) { if (round === 0 || round === 3) pairs.push(round === 0 ? [members[0], members[1]] : [members[1], members[0]]); continue }
      if (members.length === 3) {
        const three: [number, number][] = [[0, 1], [1, 2], [2, 0]]
        const [a, b] = three[round % 3]
        pairs.push(round < 3 ? [members[a], members[b]] : [members[b], members[a]]); continue
      }
      if (members.length < 2) continue
      const indexes: [number, number][] = round % 3 === 0 ? [[0, 3], [1, 2]] : round % 3 === 1 ? [[0, 2], [3, 1]] : [[0, 1], [2, 3]]
      for (const [a, b] of indexes) pairs.push(round < 3 ? [members[a], members[b]] : [members[b], members[a]])
    }
    schedule(world, comp, pairs, addDays(start, round * (comp.id === 'nations-uefa' ? 8 : count === 8 ? 17 : count === 6 ? 21 : 8)), round)
  }
  comp.format.scheduledRounds = count
}
function scheduleKnockout(world: ProWorldState, comp: ProCompetition, entrants: string[], date: IsoDate): ProFixture[] {
  const size = 2 ** Math.floor(Math.log2(entrants.length))
  if (entrants.length < 2) throw new Error('Tournament needs two entrants')
  const playIn = entrants.length === size ? size / 2 : entrants.length - size
  const byes = entrants.slice(0, entrants.length - playIn * 2)
  const competing = entrants.slice(byes.length)
  const pairs: [string, string][] = []
  for (let index = 0; index < competing.length / 2; index++) pairs.push([competing[index], competing[competing.length - 1 - index]])
  comp.tournament!.groupByEntrant = undefined
  comp.tournament!.remainingIds = entrants
  comp.format.scheduledRounds += 1
  comp.tournament!.round += 1
  // Bye recipients remain in entrantIds and are included in the next draw.
  return schedule(world, comp, pairs, date, comp.tournament!.round)
}
function tierEntrants(world: ProWorldState, confederation: ProConfederation, tier: number, slots: number): string[] {
  const leagues = PRO_LEAGUE_PLAN.filter(item => item.confederation === confederation)
  const orders = leagues.map(item => leagueOrder(world, item.associationId))
  const candidates: string[] = []
  for (let rank = tier === 0 ? 0 : tier === 1 ? 1 : 3; rank < 12 && candidates.length < slots; rank++)
    for (const order of orders) if (order[rank] && !candidates.includes(order[rank])) candidates.push(order[rank])
  return candidates.slice(0, slots)
}
export function beginDomesticSeason(world: ProWorldState, year: number): void {
  const leagueCups = new Set(['eng','sco','por','jpn','rsa'])
  const superCups = new Set(['eng','fra','esp','ita','ger','por','ned','bel','tur','rsa','bra','arg','jpn'])
  for (const league of PRO_LEAGUE_PLAN) {
    const id = league.associationId
    const entrants = leagueOrder(world, id)
    createCompetition(world, `cup-${id}`, 'domestic-cup', year, entrants, 'knockout', `${year}-02-04`)
    if (leagueCups.has(id)) createCompetition(world, `league-cup-${id}`, 'domestic-cup', year,
      entrants, 'knockout', `${year}-04-09`)
    if (superCups.has(id)) {
      const leagueWinner = world.championHistory.filter(item => item.competitionId === `top-${id}`).at(-1)?.championId
      const cupWinner = world.championHistory.filter(item => item.competitionId === `cup-${id}`).at(-1)?.championId
      const finalists = [leagueWinner, cupWinner, ...entrants].filter((candidate, index, all): candidate is string =>
        !!candidate && all.indexOf(candidate) === index).slice(0, 2)
      createCompetition(world, `super-cup-${id}`, 'domestic-cup', year, finalists, 'knockout', `${year}-08-03`)
    }
  }
}
export function beginContinentalSeason(world: ProWorldState, year: number): void {
  for (const confederation of confederations) {
    const slots = { uefa: 36, caf: 16, conmebol: 32, concacaf: 16, afc: 24, ofc: 8 }[confederation]
    const top = tierEntrants(world, confederation, 0, slots)
    const lower = tierEntrants(world, confederation, 1, slots * 2).filter(id => !top.includes(id)).slice(0, slots)
    const third = confederation === 'uefa' ? tierEntrants(world, confederation, 3, 80).filter(id => !top.includes(id) && !lower.includes(id)).slice(0, 36) : []
    for (const [id, entrants] of [...[[`continental-${confederation}`, top], [`union-${confederation}`, lower]],
      ...(confederation === 'uefa' ? [['conference-uefa', third]] : [])] as [string, string[]][])
      createCompetition(world, id, 'continental-club', year, entrants, confederation === 'uefa' ? 'league-phase' : 'groups', `${year}-09-10`)
  }
}
export function beginNationsLeague(world: ProWorldState, year: number): void {
  if (year % 2 !== 0) return
  for (const confederation of ['uefa', 'concacaf'] as const) {
    const entries = Object.values(world.associations).filter(item => item.confederation === confederation)
      .sort((a, b) => strength(world, b.id) - strength(world, a.id) || a.id.localeCompare(b.id))
    const key = confederation === 'uefa' ? 'nationsTier' : 'concacafNationsTier'
    world[key] ??= Object.fromEntries(entries.map((entry, index) => [entry.id,
      Math.min(confederation === 'uefa' ? 3 : 2, Math.floor(index / 16))]))
    const entrants = entries.sort((a, b) => (world[key]![a.id] ?? 3) - (world[key]![b.id] ?? 3) ||
      strength(world, b.id) - strength(world, a.id) || a.id.localeCompare(b.id)).map(item => item.id)
    createCompetition(world, `nations-${confederation}`, 'national-team', year, entrants, 'groups', `${year}-09-24`)
  }
}
export function beginWorldQualifiers(world: ProWorldState, year: number): void {
  if (year % 4 !== 1) return
  for (const confederation of confederations) {
    const entrants = Object.values(world.associations).filter(item => item.confederation === confederation)
      .sort((a, b) => strength(world, b.id) - strength(world, a.id) || a.id.localeCompare(b.id)).map(item => item.id)
    createCompetition(world, `qualifiers-${confederation}`, 'national-team', year, entrants,
      entrants.length >= 4 ? 'groups' : 'knockout', `${year}-02-04`)
  }
}
export function beginNationalSeason(world: ProWorldState, year: number): void {
  const scheduled: Partial<Record<ProConfederation, boolean>> = {
    uefa: year % 4 === 0,
    caf: year === 2027 || year >= 2028 && year % 4 === 0,
    conmebol: year % 4 === 0,
    concacaf: year >= 2027 && year % 2 === 1,
    afc: year >= 2027 && year % 4 === 3,
    ofc: year % 4 === 0,
  }
  for (const confederation of confederations) {
    if (!scheduled[confederation]) continue
    const entrants = Object.values(world.associations).filter(item => item.confederation === confederation).map(item => item.id)
    createCompetition(world, `national-${confederation}`, 'national-team', year, entrants,
      entrants.length >= 4 ? 'groups' : 'knockout', confederation === 'afc' ? `${year}-01-07` : `${year}-06-03`)
  }
}
function balancedEntrants(quotas: Partial<Record<ProConfederation, number>>,
  candidates: (confederation: ProConfederation) => string[]): string[] {
  return confederations.flatMap(confederation => candidates(confederation).slice(0, quotas[confederation] ?? 0))
}
export function beginWorldSeason(world: ProWorldState, year: number): void {
  if (year % 4 !== 2) return
  const entrants = balancedEntrants({ uefa: 16, caf: 9, conmebol: 7, concacaf: 7, afc: 8, ofc: 1 }, confederation => {
    const qualification = world.seasonHistory.find(item => item.competitionId === `qualifiers-${confederation}` &&
      item.seasonId === String(year - 1))
    const rankings = qualification?.table ?? world.standings[`qualifiers-${confederation}`]
    const byPoints = rankings?.length ? [qualification?.championId, ...[...rankings].sort(tableOrder).map(item => item.clubId)]
      .filter((id, index, all): id is string => !!id && all.indexOf(id) === index) : []
    const remaining = Object.values(world.associations).filter(item => item.confederation === confederation)
      .sort((a, b) => strength(world, b.id) - strength(world, a.id) || a.id.localeCompare(b.id)).map(item => item.id)
    return [...new Set([...byPoints, ...remaining])]
  })
  createCompetition(world, 'world-national', 'national-team', year, entrants, 'groups', `${year}-06-10`)
}
export function beginClubWorldSeason(world: ProWorldState, year: number): void {
  if (year % 4 !== 3) return
  const entrants = balancedEntrants({ uefa: 12, caf: 5, conmebol: 6, concacaf: 4, afc: 4, ofc: 1 }, confederation => {
    const titleWinners = world.championHistory.filter(item => item.competitionId === `continental-${confederation}`)
      .sort((a, b) => b.seasonId.localeCompare(a.seasonId)).map(item => item.championId)
    const clubs = [ ...titleWinners, ...tierEntrants(world, confederation, 0, 36) ]
    return clubs.filter((id, index) => clubs.indexOf(id) === index)
  })
  createCompetition(world, 'world-club', 'continental-club', year, entrants, 'groups', `${year}-06-10`)
}
function strength(world: ProWorldState, entrantId: string): number {
  if (!world.clubs[entrantId] && world.associations[entrantId]?.domesticMode === 'background')
    return 42 + Math.floor(proRoll(world.seed, `background-${entrantId}:strength`) * 22)
  return world.clubs[entrantId]?.reputation ?? Math.round(
    Object.values(world.clubs).filter(club => club.associationId === entrantId).reduce((sum, club) => sum + club.reputation, 0) /
    Math.max(1, Object.values(world.clubs).filter(club => club.associationId === entrantId).length))
}
function settleFixture(world: ProWorldState, fixture: ProFixture, knockout: boolean): void {
  const edge = (strength(world, fixture.homeId) - strength(world, fixture.awayId)) * .035
  const homeGoals = Math.max(0, Math.min(6, Math.floor(1.7 + edge + proRoll(world.seed, `${fixture.id}:home`) * 2.5 - .8)))
  let awayGoals = Math.max(0, Math.min(6, Math.floor(1.5 - edge + proRoll(world.seed, `${fixture.id}:away`) * 2.5 - .8)))
  let adjustedHome = homeGoals
  if (knockout && homeGoals === awayGoals) {
    if (proRoll(world.seed, `${fixture.id}:tiebreak`) < .5) adjustedHome++
    else awayGoals++
  }
  fixture.result = { homeGoals: adjustedHome, awayGoals }
  const comp = world.competitions[fixture.competitionId]
  if (comp.tournament?.stage !== 'knockout') {
    const rows = world.standings[comp.id]
    const a = rows.find(item => item.clubId === fixture.homeId)!
    const b = rows.find(item => item.clubId === fixture.awayId)!
    a.played++; b.played++
    a.goalsFor += adjustedHome; a.goalsAgainst += awayGoals
    b.goalsFor += awayGoals; b.goalsAgainst += adjustedHome
    if (adjustedHome > awayGoals) { a.won++; b.lost++; a.points += 3 }
    else if (adjustedHome < awayGoals) { b.won++; a.lost++; b.points += 3 }
    else { a.drawn++; b.drawn++; a.points++; b.points++ }
  }
  world.recentEvents.push({ id: `event-${fixture.id}`, date: fixture.kickoffDate, kind: 'match',
    subjectIds: [fixture.homeId, fixture.awayId], details: { competitionId: comp.id, homeGoals: adjustedHome, awayGoals } })
}
export function advanceTournamentsTo(world: ProWorldState, target: IsoDate): void {
  const fixtureIndex = new Map<string, ProFixture[]>()
  for (const fixture of Object.values(world.fixtures)) {
    const list = fixtureIndex.get(fixture.competitionId) ?? []
    list.push(fixture)
    fixtureIndex.set(fixture.competitionId, list)
  }
  for (const comp of Object.values(world.competitions)) {
    if (!comp.tournament || comp.tournament.completed) continue
    let fixtures = fixtureIndex.get(comp.id) ?? []
    for (let stage = 0; stage < 12; stage++) {
      if (!fixtures.length) throw new Error(`Missing tournament fixtures ${comp.id}`)
      for (const fixture of fixtures) if (!fixture.result && fixture.kickoffDate < target)
        settleFixture(world, fixture, comp.tournament.stage === 'knockout')
      if (fixtures.some(fixture => !fixture.result)) break
      const lastDate = fixtures.reduce((latest, fixture) => fixture.kickoffDate > latest ? fixture.kickoffDate : latest, fixtures[0].kickoffDate)
      let next: string[]
      if (comp.tournament.stage === 'league-phase') next = [...world.standings[comp.id]].sort(tableOrder).slice(0, 16).map(item => item.clubId)
      else if (comp.tournament.stage === 'groups') {
        const groups = comp.tournament.groupByEntrant!
        const size = comp.kind === 'national-team' ? comp.id === 'world-national' ? 32 : comp.entrantIds.length >= 32 ? 16 : 8 : Math.min(16, comp.entrantIds.length / 2)
        const tables = new Map<number, ProStandingRow[]>()
        for (const record of world.standings[comp.id]) tables.set(groups[record.clubId], [...(tables.get(groups[record.clubId]) ?? []), record])
        const rankedGroups = [...tables.values()].map(rows => rows.sort(tableOrder))
        const winners = rankedGroups.map(rows => rows[0]).sort(tableOrder)
        const remaining = rankedGroups.flatMap(rows => rows.slice(1)).sort(tableOrder)
        if (comp.id === 'world-national') {
          next = [...rankedGroups.flatMap(rows => rows.slice(0, 2)),
            ...rankedGroups.map(rows => rows[2]).sort(tableOrder).slice(0, 8)].map(item => item.clubId)
        } else if (comp.id === 'nations-uefa' || comp.id === 'nations-concacaf') {
          const european = comp.id === 'nations-uefa'
          const tier = european ? world.nationsTier ?? {} : world.concacafNationsTier ?? {}
          // Equal exchanges preserve division sizes between editions.
          for (const [upper, lower, swaps] of (european ? [[0, 1, 4], [1, 2, 4], [2, 3, 2]] : [[0, 1, 4], [1, 2, 3]])) {
            const upperGroups = rankedGroups.slice(upper === 0 ? 0 : upper === 1 ? 4 : 8,
              upper === 0 ? 4 : upper === 1 ? 8 : 12)
            const lowerGroups = rankedGroups.slice(lower === 1 ? 4 : lower === 2 ? 8 : 12,
              lower === 1 ? 8 : lower === 2 ? 12 : 14)
            const relegated = upperGroups.map(rows => rows.at(-1)!).sort((a, b) => a.points - b.points ||
              a.goalsFor - a.goalsAgainst).slice(0, swaps)
            const promoted = lowerGroups.map(rows => rows[0]).sort(tableOrder).slice(0, swaps)
            for (const item of relegated) tier[item.clubId] = lower
            for (const item of promoted) tier[item.clubId] = upper
          }
          if (european) world.nationsTier = tier
          else world.concacafNationsTier = tier
          next = rankedGroups.slice(0, 4).flatMap(rows => rows.slice(0, 2)).map(item => item.clubId)
        } else next = [...winners, ...remaining].slice(0, size).map(item => item.clubId)
      } else {
        const winners = fixtures.map(fixture => fixture.result!.homeGoals > fixture.result!.awayGoals ? fixture.homeId : fixture.awayId)
        const remaining = comp.tournament.remainingIds ?? comp.entrantIds
        const byeCount = remaining.length - fixtures.length * 2
        next = [...remaining.slice(0, byeCount), ...winners]
      }
      for (const fixture of fixtures) delete world.fixtures[fixture.id]
      if (next.length === 1) {
        comp.tournament.completed = true
        world.championHistory.push({ competitionId: comp.id, seasonId: comp.seasonId, championId: next[0] })
        world.seasonHistory.push({ competitionId: comp.id, seasonId: comp.seasonId, championId: next[0], table: [...world.standings[comp.id]].sort(tableOrder) })
        world.recentEvents.push({ id: `event-title-${comp.id}-${comp.seasonId}`, date: lastDate, kind: 'award',
          subjectIds: [next[0]], details: { competitionId: comp.id, seasonId: comp.seasonId } })
        break
      }
      comp.tournament.stage = 'knockout'
      fixtures = scheduleKnockout(world, comp, next, addDays(lastDate, comp.kind === 'national-team' ? 7 : 18))
    }
  }
}
