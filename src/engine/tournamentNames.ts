/** Six named editions of the under-16 October competition. The calendar's
 * internal event key stays stable so older saves remain playable. */
export const OCTOBER_SPONSORS = [
  'Northstar Youth Series',
  'Meridian Futures Cup',
  'Apex Rising Stars League',
  'Summit Next XI Series',
  'Atlas Youth Invitational',
  'Pioneer Futures League',
] as const

export function octoberTournamentName(season: number): string {
  return OCTOBER_SPONSORS[Math.max(0, Math.min(OCTOBER_SPONSORS.length - 1, season - 1))]
}
