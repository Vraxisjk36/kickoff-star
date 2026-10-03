import { getNation } from './nations'
import { sortStandings, type Division } from './league'
import type { GazetteArticle } from './gazette'
import type { WorldLeagues, WorldStory } from './worldLeagues'

const SPONSORS = ['Northbridge Community Trust', 'Harbour Youth Fund', 'Rising Stars Foundation', 'First Step Sports']
const DATES = { donation: [9, 13, 18], eligibility: [16, 20, 24], sponsor: [27, 31, 37] } as const
type Kind = WorldStory['kind']
function teamPoints(division: Division, id: string): number { return division.standings.find(row => row.teamId === id)?.points ?? 0 }
function adjust(division: Division, teamId: string, amount: number): Division {
  return { ...division, teams: division.teams.map(team => team.id !== teamId ? team : {
    ...team, ratings: { attack: Math.max(20, Math.min(86, team.ratings.attack + amount)),
      midfield: Math.max(20, Math.min(86, team.ratings.midfield + amount)),
      defense: Math.max(20, Math.min(86, team.ratings.defense + amount)) },
  }) }
}
function pick(world: WorldLeagues, kind: Kind): { countryId: string; division: Division } | null {
  const countries = Object.keys(world.divisions).sort()
  if (!countries.length) return null
  const index = kind === 'donation' ? 0 : kind === 'eligibility' ? 1 : 2
  const countryId = countries[(world.season * 7 + index * 5) % countries.length]
  return { countryId, division: world.divisions[countryId] }
}
/** Three saved background arcs. Every match claim reads the same country table
 * used in the World tab; the donation and audit change future team strength. */
export function advanceWorldNews(world: WorldLeagues, completedWeek: number): { world: WorldLeagues; article?: GazetteArticle } {
  const current = (Object.keys(DATES) as Kind[]).find(kind => (DATES[kind] as readonly number[]).includes(completedWeek))
  if (!current) return { world }
  const [start, follow] = DATES[current]
  const storyId = `${world.season}:${current}`
  let story = world.stories?.find(entry => entry.id === storyId)
  if (story?.issuedWeeks?.includes(completedWeek)) return { world }
  let updated = world
  if (completedWeek === start && !story) {
    const selected = pick(world, current)
    if (!selected) return { world }
    const standings = sortStandings(selected.division.standings)
    const selectedRow = current === 'donation' ? standings.at(-2) : current === 'eligibility' ? standings[0] : standings[2]
    if (!selectedRow) return { world }
    story = { id: storyId, season: world.season, kind: current, countryId: selected.countryId,
      teamId: selectedRow.teamId, teamName: selectedRow.teamName, pointsAtStart: selectedRow.points,
      ...(current === 'sponsor' ? { sponsor: SPONSORS[world.season % SPONSORS.length] } : {}) }
    updated = { ...world, stories: [...(world.stories ?? []), story] }
    if (current !== 'sponsor') updated = { ...updated, divisions: { ...updated.divisions,
      [story.countryId]: adjust(selected.division, story.teamId, current === 'donation' ? 2 : -2) } }
    else updated = { ...updated, leagueNames: { ...updated.leagueNames,
      [story.countryId]: `${story.sponsor} Schools League` } }
  }
  if (!story) return { world }
  updated = { ...updated, stories: updated.stories?.map(entry => entry.id === storyId
    ? { ...entry, issuedWeeks: [...(entry.issuedWeeks ?? []), completedWeek] } : entry) }
  const nation = getNation(story.countryId).name
  const division = updated.divisions[story.countryId]
  const points = teamPoints(division, story.teamId)
  const place = sortStandings(division.standings).findIndex(row => row.teamId === story.teamId) + 1
  if (current === 'donation') {
    if (completedWeek === start) return { world: updated, article: { kind: 'world', headline: `${story.teamName.toUpperCase()} BACKED BY LOCAL FUND`,
      body: `A community donation has paid for training equipment at ${story.teamName} in ${nation}. They began the week on ${points} league points; the improved setup will be tested in the remaining fixtures.` } }
    if (completedWeek === follow) return { world: updated, article: { kind: 'world', headline: `${story.teamName.toUpperCase()} PUTS SUPPORT TO WORK`,
      body: `${story.teamName} have collected ${points - story.pointsAtStart} league points since the donation. They sit ${place}${ordinal(place)} in the ${nation} school division.` } }
    return { world: updated, article: { kind: 'world', headline: `THE FUND'S IMPACT AT ${story.teamName.toUpperCase()}`,
      body: `${story.teamName} stand ${place}${ordinal(place)} on ${points} points after another stretch of league fixtures. The donation's training equipment stays with the school.` } }
  }
  if (current === 'eligibility') {
    if (completedWeek === start) return { world: updated, article: { kind: 'world', headline: `${story.teamName.toUpperCase()} FACES ELIGIBILITY REVIEW`,
      body: `${nation} school organisers are reviewing a registration error involving ${story.teamName}. The school keeps its earned points while the review runs, but staff changes have disrupted preparation.` } }
    if (completedWeek === follow) return { world: updated, article: { kind: 'world', headline: `${story.teamName.toUpperCase()} REVIEW CONTINUES`,
      body: `The eligibility review remains open. ${story.teamName} have earned ${points - story.pointsAtStart} points since it began and sit ${place}${ordinal(place)}; no results have been rewritten.` } }
    updated = { ...updated, divisions: { ...updated.divisions, [story.countryId]: adjust(division, story.teamId, 1) } }
    return { world: updated, article: { kind: 'world', headline: `${story.teamName.toUpperCase()} TIGHTENS REGISTRATION RULES`,
      body: `The review found an administrative eligibility breach at ${story.teamName}. Organisers kept played results intact; the school replaced its registration process and finished on ${points} points.` } }
  }
  if (completedWeek === start) return { world: updated, article: { kind: 'world', headline: `${nation.toUpperCase()} SCHOOL LEAGUE GETS NEW BACKER`,
    body: `${story.sponsor} has agreed to support the ${nation} school division. Next season it will compete as the ${updated.leagueNames?.[story.countryId]}.` } }
  if (completedWeek === follow) return { world: updated, article: { kind: 'world', headline: `${story.sponsor!.toUpperCase()} SETS OUT LEAGUE PLAN`,
    body: `Organisers confirmed the ${updated.leagueNames?.[story.countryId]} name for next season. ${story.teamName}, who finished ${place}${ordinal(place)} on ${points} points, are among the returning schools.` } }
  return { world: updated, article: { kind: 'world', headline: `${nation.toUpperCase()} SCHOOLS PREPARE FOR RENAMED LEAGUE`,
    body: `The ${updated.leagueNames?.[story.countryId]} will open next season. ${story.teamName} and the rest of the division retain their results from this year.` } }
}

function ordinal(position: number): string { return position % 100 >= 11 && position % 100 <= 13 ? 'th' : position % 10 === 1 ? 'st' : position % 10 === 2 ? 'nd' : position % 10 === 3 ? 'rd' : 'th' }
