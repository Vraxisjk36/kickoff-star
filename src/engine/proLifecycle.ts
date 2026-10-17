import { proRoll } from './proWorldFactory'
import type { IsoDate, ProClub, ProInjuryRecord, ProPlayer, ProWorldState } from './proWorld'

export function peakAge(position: string): number {
  if (position === 'GK') return 31
  if (['CB','DM','CM'].includes(position)) return 28
  if (['ST','RW','LW'].includes(position)) return 26
  return 27
}
export function ageOf(player: Pick<ProPlayer, 'birthDate'>, year: number): number { return year - Number(player.birthDate.slice(0, 4)) }
export function nextShirtNumber(players: Iterable<ProPlayer>, clubId: string, preferred?: number): number {
  const used = new Set([...players].filter(player => player.clubId === clubId).map(player => player.shirtNumber))
  if (preferred && preferred >= 1 && preferred <= 99 && !used.has(preferred)) return preferred
  return Array.from({ length: 99 }, (_, index) => index + 1).find(number => !used.has(number)) ?? 100
}
export function shouldRetire(player: ProPlayer, year: number, seed: number): boolean {
  if (player.careerEndingInjury || player.retirementChoice) return true
  const age = ageOf(player, year)
  const severe = (player.injuryHistory ?? []).filter(injury => injury.severity === 'major').length
  if (age >= 41) return true
  if (age < (severe >= 2 ? 29 : 33)) return false
  const probability = Math.min(.9, Math.max(0, age - 32) * .065 + severe * .045)
  return proRoll(seed, `${player.id}:retirement:${year}`) < probability
}
export function rollMatchInjury(world: ProWorldState, player: ProPlayer, date: IsoDate, energy: number): void {
  const previous = player.injuryHistory ?? []
  const recurring = previous.filter(item => item.kind === 'hamstring').length
  const risk = .012 + Math.min(.024, recurring * .007) + (energy < 35 ? .012 : 0)
  const roll = proRoll(world.seed, `${player.id}:${date}:match-injury`)
  if (roll >= risk) return
  const careerEnding = roll < .00005
  const kind: ProInjuryRecord['kind'] = proRoll(world.seed, `${player.id}:${date}:injury-kind`) < .7 ? 'hamstring' : 'knee'
  const severity: ProInjuryRecord['severity'] = careerEnding || roll < .002 ? 'major' : 'moderate'
  const daysOut = careerEnding ? 365 : severity === 'major' ? 100 : kind === 'hamstring' ? 22 : 34
  const until = new Date(Date.parse(`${date}T00:00:00Z`) + daysOut * 86400000).toISOString().slice(0, 10)
  player.injuryHistory = [...previous, { id: `${player.id}-${date}-injury`, kind, severity, date, until, daysOut, careerEnding } satisfies ProInjuryRecord].slice(-12)
  player.injuredUntil = until
  player.careerEndingInjury = careerEnding
  world.recentEvents.push({ id: `event-${player.id}-${date}-injury`, date, kind: 'life', subjectIds: [player.id],
    details: { action: 'injury', kind, days: daysOut, careerEnding } })
}
export function growOrDecline(player: ProPlayer, year: number, seed: number): void {
  const age = ageOf(player, year)
  const peak = peakAge(player.position)
  const roll = proRoll(seed, `${player.id}:growth:${year}`)
  if (age <= peak && player.overall < player.potential && roll < (age < 23 ? .72 : .42)) player.overall++
  if (age > peak + 2 && roll < Math.min(.92, .18 + (age - peak - 2) * .1))
    player.overall = Math.max(30, player.overall - (age > 36 && roll < .3 ? 2 : 1))
}
export function signBackgroundReplacement(world: ProWorldState, club: ProClub, outgoing: ProPlayer, year: number, date: IsoDate, roster: ProPlayer[]): ProPlayer {
  const id = `market-${club.id}-${year}-${outgoing.id}`
  const names = ['Amir','Bongani','Daniel','Emilio','Hiro','Jamal','Kai','Leo','Musa','Noah','Rafael','Santiago']
  const surnames = ['Adebayo','Bennett','Costa','Diallo','Garcia','Kim','Mokoena','Novak','Sato','Silva','Mensah','Reyes']
  const age = 22 + Math.floor(proRoll(world.seed, `${id}:age`) * 9)
  const rating = Math.max(38, Math.min(90, Math.round(club.reputation - 6 + (proRoll(world.seed, `${id}:ovr`) - .5) * 13)))
  const wage = Math.max(1, Math.min(Math.floor(club.finances.topPlayerAnnualWage * .95),
    Math.floor(outgoing.annualWage * (.68 + proRoll(world.seed, `${id}:wage`) * .36))))
  const player: ProPlayer = { id, name: `${names[Math.floor(proRoll(world.seed, `${id}:first`) * names.length)]} ${surnames[Math.floor(proRoll(world.seed, `${id}:last`) * surnames.length)]}`,
    birthDate: `${year - age}-06-15`, nationalityIds: [club.associationId], position: outgoing.position,
    overall: rating, potential: Math.min(94, rating + 3 + Math.floor(proRoll(world.seed, `${id}:potential`) * 10)),
    clubId: club.id, annualWage: wage, shirtNumber: nextShirtNumber(roster, club.id,
      25 + Math.floor(proRoll(world.seed, `${id}:shirt`) * 60)), origin: 'transfer' }
  world.recentEvents.push({ id: `event-${id}`, date, kind: 'transfer', subjectIds: [id, club.id],
    details: { action: 'free-agent-signing', annualWage: wage } })
  return player
}
export function seasonalInjury(world: ProWorldState, player: ProPlayer, year: number, date: IsoDate): void {
  const history = player.injuryHistory ?? []
  const priorHamstrings = history.filter(injury => injury.kind === 'hamstring').length
  const chance = .06 + Math.min(.08, priorHamstrings * .02)
  if (proRoll(world.seed, `${player.id}:injury:${year}`) >= chance) return
  const kind: ProInjuryRecord['kind'] = proRoll(world.seed, `${player.id}:injury-kind:${year}`) < .58 ? 'hamstring' : 'knee'
  const major = proRoll(world.seed, `${player.id}:injury-severity:${year}`) < .09
  const days = major ? 120 : kind === 'hamstring' ? 21 : 35
  const until = new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
  player.injuryHistory = [...history, { id: `${player.id}-${year}-injury`, kind, severity: major ? 'major' : 'moderate', date, until, daysOut: days } satisfies ProInjuryRecord].slice(-12)
  player.injuredUntil = until
  if (major && player.overall > 35) player.overall--
  world.recentEvents.push({ id: `event-${player.id}-${year}-injury`, date, kind: 'life', subjectIds: [player.id], details: { action: 'injury', kind, days } })
}
