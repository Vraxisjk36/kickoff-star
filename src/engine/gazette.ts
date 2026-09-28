// Phase 25 — THE GAZETTE. A local-paper-style weekly digest that drops every
// Monday, pulling together threads that otherwise live scattered across tabs
// (or, in the case of squad departures, don't surface anywhere at all — see
// P22b's known gap). Pure content generation: reads state, produces articles,
// touches nothing. Same "observe, never grant" discipline as Phase 16's
// achievements, for the same reason — a newspaper shouldn't be a stat lever.
import type { Player } from '../types/player'
import type { SquadPlayer } from './squad'
import type { DepartureEvent } from './squadLifecycle'
import { surnameOf } from './commentary'
import type { Division } from './league'
import type { MatchRecord } from './matchLedger'
import { competitionDefinition } from './competitionCareer'
import type { SchoolsRanking, SchoolsAwards, SchoolsRankingRow } from './worldSchools'
import type { SchoolMatch } from './worldSchools'
import { sortStandings } from './league'
import type { WorldLeagues, SchoolPowerRanking } from './worldLeagues'
import { schoolRival } from './friendlies'

export type ArticleKind = 'transfer' | 'spotlight' | 'preview' | 'injury' | 'recap' | 'league' | 'filler' | 'world' | 'awards'

export interface GazetteArticle {
  kind: ArticleKind
  headline: string
  body: string
  detail?: string
  byline?: string
  quote?: string
}

export interface GazetteIssue {
  id: string
  weekNumber: number
  seasonYear: number
  masthead: string // the "big story" headline, shown first/largest
  articles: GazetteArticle[]
  ranking?: SchoolsRanking
  scorers?: SchoolsRankingRow[]
  awards?: SchoolsAwards
  schoolRanking?: SchoolPowerRanking
}

function id() { return crypto.randomUUID() }

// --- individual article builders -------------------------------------------------

function transferArticles(departures: DepartureEvent[], arrivals: SquadPlayer[]): GazetteArticle[] {
  const out: GazetteArticle[] = []
  for (const d of departures) {
    const verb = d.reason === 'transfer' ? 'completes a transfer away from the club' : d.reason === 'graduated' ? 'has graduated on from the squad' : 'has left the club'
    out.push({
      kind: 'transfer',
      headline: d.reason === 'transfer' ? `${surnameOf(d.playerName)} ON THE MOVE` : `${surnameOf(d.playerName)} MOVES ON`,
      body: `${d.playerName} ${verb}. The dressing room will need to adjust.`,
    })
  }
  if (arrivals.length > 0 && departures.length > 0) {
    out.push({
      kind: 'transfer',
      headline: 'NEW FACES IN TRAINING',
      body: `${arrivals.map((a) => a.name).join(' and ')} ${arrivals.length > 1 ? 'have' : 'has'} joined the squad, filling the gap left behind.`,
    })
  }
  return out
}

function spotlightArticle(player: Player): GazetteArticle | null {
  const recent = player.matchRatings ?? []
  if (recent.length === 0) return null
  const last = recent[recent.length - 1]
  const surname = surnameOf(player.name)

  if (recent.length >= 3 && recent.slice(-3).every((r) => r >= 7.5)) {
    return { kind: 'spotlight', headline: `${surname.toUpperCase()} IN RED-HOT FORM`, body: `${player.name} has delivered three straight performances above 7.5. Opponents are beginning to take notice.`, detail: `${player.name} has ratings of ${recent.slice(-3).map(rating => rating.toFixed(1)).join(', ')} across the last three matches. It is a run that has opponents taking notice. The next fixture is another chance to keep it alive.` }
  }
  if (recent.length >= 3 && recent.slice(-3).every((r) => r < 5.5)) {
    return { kind: 'spotlight', headline: `QUIET SPELL FOR ${surname.toUpperCase()}`, body: `${player.name} has had three matches below 5.5. Selection and form are under pressure as the season moves on.`, detail: `${player.name}'s last three recorded ratings were ${recent.slice(-3).map(rating => rating.toFixed(1)).join(', ')}. The next appearance is a chance to quiet the doubts and change the story.` }
  }
  if (last >= 8.5) {
    return { kind: 'spotlight', headline: `${surname.toUpperCase()} STEALS THE HEADLINES`, body: `${player.name} earned a ${last.toFixed(1)} rating in the last outing. The performance has the school talking.`, detail: `${player.name}'s most recent match rating was ${last.toFixed(1)}. One performance cannot decide a season, but it can lift a whole dressing room. Now comes the harder part: doing it again.` }
  }
  return null
}

export interface UpcomingFixtureInfo {
  opponentName: string
  opponentPrestige: number
  ownPrestige: number
  competitionLabel: string
  isRivalOrCup: boolean
}

function previewArticle(fixture: UpcomingFixtureInfo | null): GazetteArticle | null {
  if (!fixture) return null
  const gap = fixture.opponentPrestige - fixture.ownPrestige
  if (fixture.isRivalOrCup) {
    return { kind: 'preview', headline: `${fixture.opponentName.toUpperCase()} AWAIT IN THE BIG ONE`, body: `${fixture.competitionLabel} brings ${fixture.opponentName} into focus. There is more at stake than another result when these schools meet.`, detail: `Some fixtures get circled before the season begins. ${fixture.opponentName} are next, and ${fixture.competitionLabel} gives this meeting its edge.\n\nThe teams have their own strengths, but reputations will not decide the score. The players will have to do that on the pitch.\n\nThe last few results have built toward this meeting. A win would give the squad something to carry into the following week; a defeat would leave plenty to answer.\n\nKickoff is still ahead. We will have the score, the scorers and the fallout in the next edition.` }
  }
  if (gap >= 3) {
    return { kind: 'preview', headline: `${fixture.opponentName.toUpperCase()} SET A SERIOUS TEST`, body: `${fixture.opponentName} look stronger on paper, but the only result that matters comes after kickoff in ${fixture.competitionLabel}.` }
  }
  return { kind: 'preview', headline: `${fixture.opponentName.toUpperCase()} UP NEXT`, body: `${fixture.competitionLabel} returns with a meeting against ${fixture.opponentName}. The squad has a chance to put another result on the board.` }
}

function injuryArticle(player: Player): GazetteArticle | null {
  if (!player.injury) return null
  const surname = surnameOf(player.name)
  return {
    kind: 'injury',
    headline: `INJURY UPDATE: ${surname.toUpperCase()}`,
    body: `${player.name}: ${player.injury.description} Expected return in around ${player.injury.weeksRemaining} week${player.injury.weeksRemaining === 1 ? '' : 's'}.`,
  }
}

export interface LastResultInfo {
  opponentName: string
  playerScore: number
  opponentScore: number
  playerGoals: number
  playerAssists: number
  playerRating: number
}

function recapArticle(result: LastResultInfo | null, playerName: string): GazetteArticle | null {
  if (!result) return null
  const outcome = result.playerScore > result.opponentScore ? 'WIN' : result.playerScore < result.opponentScore ? 'DEFEAT' : 'DRAW'
  const contribution = result.playerGoals > 0 || result.playerAssists > 0
    ? ` ${result.playerGoals > 0 ? `${result.playerGoals} goal${result.playerGoals > 1 ? 's' : ''}` : ''}${result.playerGoals > 0 && result.playerAssists > 0 ? ' and ' : ''}${result.playerAssists > 0 ? `${result.playerAssists} assist${result.playerAssists > 1 ? 's' : ''}` : ''} to show for it.`
    : ''
  return {
    kind: 'recap',
    headline: result.playerGoals >= 3 ? `${playerName.toUpperCase()} IS THE HAT-TRICK HERO` : result.playerGoals === 2 ? `${playerName.toUpperCase()} AT THE DOUBLE` : `${outcome} AGAINST ${result.opponentName.toUpperCase()}`,
    body: `${playerName} and their side finished ${result.playerScore}–${result.opponentScore} against ${result.opponentName}.${result.playerGoals >= 3 ? ` Three goals from ${playerName} made this a day to remember.` : contribution}`,
    detail: `${playerName} took on ${result.opponentName} in a match that finished ${result.playerScore}–${result.opponentScore}. ${result.playerGoals >= 3 ? `A hat-trick from ${playerName} gave the opposition a night they will want to forget.` : `${playerName} was right in the thick of it.`}\n\n${result.playerGoals ? `${playerName} scored ${result.playerGoals} ${result.playerGoals === 1 ? 'goal' : 'goals'}` : `${playerName} did not score`}${result.playerAssists ? ` and set up ${result.playerAssists} more` : ''}. ${result.playerGoals >= 3 ? 'Not once, not twice, but three times: a performance that changed the conversation around the match.' : `The final score tells the story of a ${outcome.toLowerCase()}.`}\n\n${playerName}'s ${result.playerRating.toFixed(1)} performance was ${result.playerRating >= 8 ? 'one of the standouts of the day' : 'part of a hard-fought afternoon'}. ${result.opponentName} will remember the score; this squad will remember the contribution.\n\nThe next opponent is already on the horizon. ${playerName} now has a chance to turn one good afternoon into a run that matters.`,
  }
}

/** The saved result and player line provide every number in this report. */
export function playerMatchArticle(record: MatchRecord, player: Player, seasonRecords: MatchRecord[], schoolDivision?: Division | null): GazetteArticle | null {
  const line = record.lines.find(entry => entry.playerId === player.id)
  if (!line) return null
  const own = line.teamId === record.homeTeamId ? record.homeTeamName : record.awayTeamName
  const opponent = line.teamId === record.homeTeamId ? record.awayTeamName : record.homeTeamName
  const ownGoals = line.teamId === record.homeTeamId ? record.homeGoals : record.awayGoals
  const against = line.teamId === record.homeTeamId ? record.awayGoals : record.homeGoals
  const outcome = ownGoals > against ? 'win' : ownGoals < against ? 'defeat' : 'draw'
  const leagueMatch = record.competitionId === 'schoolLeague' || record.competitionId === 'academyLeague'
  const appearances = seasonRecords.filter(entry => entry.season === record.season && entry.week <= record.week && entry.lines.some(person => person.playerId === player.id))
  const goals = appearances.flatMap(entry => entry.lines.filter(person => person.playerId === player.id)).reduce((sum, person) => sum + person.goals, 0)
  const ownTeam = schoolDivision?.teams.find(team => team.id === line.teamId)
  const opposing = schoolDivision?.teams.find(team => team.id === (line.teamId === record.homeTeamId ? record.awayTeamId : record.homeTeamId))
  const underdogs = ownTeam && opposing && ownTeam.prestige < opposing.prestige
  const headline = line.goals >= 3 ? `${player.name.toUpperCase()} — HAT-TRICK HERO` : line.goals === 2 ? `${player.name.toUpperCase()} FIRES TWICE` : line.goals === 1 ? `${player.name.toUpperCase()} FINDS THE NET` : line.position === 'GK' && against === 0 ? `${player.name.toUpperCase()} KEEPS THEM OUT` : `${own.toUpperCase()} ${ownGoals}–${against} ${opponent.toUpperCase()}`
  const achievement = line.goals >= 3 ? `Not once, not twice, but ${line.goals} times: ${player.name} put their name all over this match.` : line.goals ? `${player.name} scored ${line.goals} ${line.goals === 1 ? 'goal' : 'goals'} in the ${outcome}.` : line.position === 'GK' ? `${player.name} made ${line.saves} saves${against === 0 ? ' and kept a clean sheet' : ''}.` : `${player.name} contributed ${line.assists} ${line.assists === 1 ? 'assist' : 'assists'} and earned a ${line.rating.toFixed(1)} rating.`
  return { kind: 'recap', headline, byline: 'The Gazette · match report',
    body: `${underdogs ? `The odds favoured ${opponent} on paper. ` : ''}${achievement} ${own} came away with a ${ownGoals}–${against} ${outcome}${goals ? `, and ${player.name} now has ${goals} goals in ${appearances.length} ${appearances.length === 1 ? 'appearance' : 'appearances'} this season` : ''}.`,
    detail: `${underdogs ? `${own} arrived with a point to prove against the more fancied ${opponent}.` : `${own} met ${opponent} with another important result on the line.`} By the end, it was ${own} ${ownGoals}–${against} ${opponent}. ${ownGoals > against ? leagueMatch ? 'The three points were theirs.' : 'The win was theirs.' : ownGoals === against ? 'Neither side found a winner.' : leagueMatch ? `${opponent} took the points.` : `${opponent} took the win.`}\n\n${achievement} ${line.assists ? `They also set up ${line.assists} ${line.assists === 1 ? 'goal' : 'goals'}.` : ''} ${line.goals >= 3 ? 'A hat-trick in a school fixture is the kind of afternoon teammates talk about long after the final whistle.' : `The ${line.rating.toFixed(1)} match rating reflects a performance that caught the eye.`}\n\n${goals ? `${player.name} has ${goals} goals from ${appearances.length} ${appearances.length === 1 ? 'appearance' : 'appearances'} this season. ` : `${player.name} has now made ${appearances.length} ${appearances.length === 1 ? 'appearance' : 'appearances'} this season. `}${line.goals >= 2 ? 'That is form opponents cannot ignore.' : `The next match is a chance to build on this ${outcome}.`} ${own} have another fixture to prepare for, but this one belongs to the players who delivered.\n\n${opponent} will have their own view of the score. For ${own}, it is a result to carry forward${line.goals >= 3 ? `, with ${player.name}'s ${line.goals} goals at the centre of it` : ''}. The next game will tell us whether this was a single big day or the start of something bigger.` }
}

export function competitionOpening(player: Player, week: number, season: number, division: Division | null): GazetteArticle | null {
  if (!player.careerClock) return null // older audit fixtures and partial migrated saves
  const academy = player.careerClock.phase === 'academy'
  const first = academy ? !player.gazetteIssues?.some(issue => issue.seasonYear < season && issue.articles.some(article => article.headline.includes('ACADEMY SEASON OPENS'))) : season === 1
  const specs: Partial<Record<number, string[]>> = academy
    ? { 1: ['academyLeague', 'ACADEMY SEASON OPENS', 'The academy league is the weekly test. Domestic cups add knockout pressure, and qualifying clubs can enter continental competition. Your minutes, training, and match record all feed selection and scouting.'],
        25: ['academyChampionsCup', 'THE CONTINENTAL ROAD', 'The Academy Champions Cup brings qualified European academy sides together. Qualification and the knockout draw are determined by actual results; your club must earn its place.'] }
    : { 4: ['schoolFriendlies', 'A NEW SCHOOL FOOTBALL YEAR', 'Two friendlies in weeks four and five give coaches their first match evidence. The local league starts in week six, followed by the regional cup, national championship for qualifying sides, and the autumn development series.'],
        6: ['schoolLeague', 'THE LOCAL CHAMPIONSHIP BEGINS', 'Ten schools, eighteen rounds, home and away. The title is there to be won, and every meeting can change who gets a shot at regional football.'],
        24: ['schoolCup', 'THE REGIONAL CUP OPENS', 'The regional schools competition is knockout football: one result can end a run. Follow the draw, the scorers, and the road toward the national stage.'],
        32: ['nationalChampionship', 'THE NATIONAL STAGE', 'Regional finalists meet in the National Schools Championship. The round of sixteen narrows through four rounds, with the national squad and the wider world watching.'],
        36: ['octoberDevelopment', 'OCTOBER OFFERS ANOTHER STAGE', 'Four autumn fixtures give younger players another competitive record. Every result goes into the development table and can become part of the scouting conversation.'],
        37: ['international', 'THE INTERNATIONAL WINDOW', 'Selected national school players begin with qualifying matches. The strongest sides reach the finals in weeks forty-two to forty-four. Selection, draws, and results determine who continues; the international fixture list carries the actual scores.'] }
  const spec = specs[week]
  if (!spec) return null
  const [competitionId, headline, explanation] = spec
  const winners = (player.gazetteHonours ?? []).filter(entry => entry.competitionId === competitionId && entry.season < season)
    .sort((a, b) => b.season - a.season).slice(0, 2)
  const history = winners.length ? `Previous champions: ${winners.map(entry => `Season ${entry.season} — ${entry.winner}`).join('; ')}.` : 'No confirmed champion is in the record yet.'
  const contenders = division && week <= 6 ? [...division.teams].sort((a, b) => b.prestige - a.prestige).slice(0, 3)
    .map(team => team.name).join(', ') : ''
  return { kind: 'league', headline, byline: 'The Gazette · season guide',
    body: `${first ? explanation : `The ${competitionDefinition(competitionId).name} returns this week. A new run at silverware begins now.`} ${history}`,
    detail: first ? `${explanation}\n\n${contenders ? `Teams to watch on pre-season strength: ${contenders}. Reputation makes them early favourites, but only played results decide the title.\n\n` : ''}${history} The upcoming fixtures and the standings are available in the competition centre.`
      : `The ${competitionDefinition(competitionId).name} returns this week. ${history} Follow the live draw, fixtures, and standings in the competition centre.`,
  }
}

function worldDispatch(world: WorldLeagues | undefined, season: number, week: number): GazetteArticle[] {
  if (!world || week < 6) return []
  const divisions = Object.entries(world.divisions)
  const matches = divisions.flatMap(([country, division]) => (division.matchRecords ?? [])
    .filter(match => match.season === season && match.week === week)
    .map(match => ({ match, country, division })))
  if (!matches.length) return []
  const biggest = [...matches].sort((a, b) => b.match.homeGoals + b.match.awayGoals - a.match.homeGoals - a.match.awayGoals)[0]
  const { match, country } = biggest
  const star = [...match.lines].sort((a, b) => b.goals - a.goals || b.assists - a.assists)[0]
  const starHistory = biggest.division.matchRecords?.filter(entry => entry.season === season && entry.week <= week)
    .flatMap(entry => entry.lines).filter(line => line.playerId === star?.playerId) ?? []
  const cumulative = starHistory.reduce((total, line) => total + line.goals, 0)
  const score = `${match.homeTeamName} ${match.homeGoals}–${match.awayGoals} ${match.awayTeamName}`
  const winner = match.homeGoals > match.awayGoals ? match.homeTeamName : match.awayGoals > match.homeGoals ? match.awayTeamName : null
  const hero = star?.goals ? star.name : winner ?? match.homeTeamName
  const lead: GazetteArticle = { kind: 'world', headline: star?.goals >= 3 ? `${star.name.toUpperCase()} — HAT-TRICK HERO` : star?.goals === 2 ? `${star.name.toUpperCase()} AT THE DOUBLE` : `${score.toUpperCase()} · ${country.toUpperCase()}`,
    byline: 'World football desk', body: `${star?.goals >= 3 ? `${star.name} struck ${star.goals} times as ${match.homeTeamName} and ${match.awayTeamName} served up a match to remember.` : `${score}. ${star?.goals ? `${star.name} scored ${star.goals}.` : winner ? `${winner} took the points.` : 'Neither side could find a winner.'}`} ${star?.goals ? `${cumulative} league goals in ${starHistory.length} appearances now for ${hero}.` : ''}`,
    detail: `${match.homeTeamName} and ${match.awayTeamName} met in a ${country.toUpperCase()} school league fixture with points to play for. By the end it was ${score}. ${winner ? `${winner} came out on top.` : 'The teams shared the points.'}\n\n${star?.goals >= 3 ? `Not once, not twice, but ${star.goals} times: ${star.name} made the difference in front of goal.` : star?.goals ? `${star.name} struck ${star.goals} ${star.goals === 1 ? 'goal' : 'goals'} in a performance the opposition could not ignore.` : `The final score belonged to the whole side rather than one headline scorer.`} ${star?.assists ? `${star.name} also set up ${star.assists}.` : ''}\n\n${star?.goals ? `${star.name} now has ${cumulative} league goals from ${starHistory.length} appearances this season. ` : ''}${winner ? `${winner} can take real belief from this result.` : 'Both sides will feel they had a chance to take more.'} The next league round will show what each school makes of it.\n\n${score} is the result that stays with these two schools. ${star?.goals >= 3 ? `${star.name}'s hat-trick gives this one a face and a name.` : winner ? `${winner} have the points; ${winner === match.homeTeamName ? match.awayTeamName : match.homeTeamName} have a response to find.` : 'Their next meeting has a draw to settle.'}`,
  }
  const leading = divisions.map(([countryId, division]) => ({ countryId, standings: sortStandings(division.standings), division }))
    .filter(entry => entry.standings[0]?.played > 0).sort((a, b) => b.standings[0].points - a.standings[0].points)[0]
  if (!leading) return [lead]
  const leader = leading.standings[0]
  const second = leading.standings[1]
  return [lead, { kind: 'league', headline: `${leader.teamName.toUpperCase()} SET THE PACE`, byline: 'League watch',
    body: `${leader.teamName} lead the ${leading.countryId.toUpperCase()} featured division on ${leader.points} points from ${leader.played} games. ${second ? `${second.teamName} sit behind them on ${second.points}.` : ''}`,
    detail: `${leader.teamName} have made a habit of finding a result. ${leader.won} wins in ${leader.played} matches put them top of the ${leading.countryId.toUpperCase()} division.\n\nThey have scored ${leader.goalsFor} and conceded ${leader.goalsAgainst}. ${second ? `${second.teamName} sit ${leader.points - second.points} points back, close enough to keep the leaders looking over their shoulders.` : 'No challenger has closed the gap yet.'}\n\nThere is still football to play. One poor result can change the mood quickly; another win can make the lead look daunting.\n\nFor now, ${leader.teamName} set the pace. The chasing schools know exactly who they have to catch.` }]
}

function schoolPowerStories(world: WorldLeagues | undefined, home: Division | null, season: number, week: number): GazetteArticle[] {
  if (!world) return []
  const rankings = world.schoolRankings ?? []
  const published = rankings.find(entry => entry.season === season && entry.week === week)
  const latest = rankings.filter(entry => entry.season === season && entry.week <= week).at(-1)
  const articles: GazetteArticle[] = []
  if (published?.rows.length) {
    const [leader, second] = published.rows
    const mover = published.rows.slice(0, 5).find((row, index) => row.previousRank && row.previousRank > index + 1)
    articles.push({ kind: 'world', headline: `${leader.name.toUpperCase()} TOP THE WORLD SCHOOL TABLE`, byline: 'Global schools desk',
      body: `${leader.name} lead on ${leader.score} ranking points after ${leader.played} league games. ${second ? `${second.name} trail by ${(leader.score - second.score).toFixed(1)}.` : ''}${mover ? ` ${mover.name} climb from ${mover.previousRank} to ${published.rows.indexOf(mover) + 1}.` : ''}`,
      detail: `Reputation opened the conversation. Results have taken over. ${leader.name} stand first with ${leader.points} league points and a goal difference of ${leader.goalDifference} after ${leader.played} matches.\n\n${second ? `${second.name} are second on ${second.score} ranking points, ${(leader.score - second.score).toFixed(1)} behind the leaders. ` : ''}${mover ? `${mover.name} have moved up from ${mover.previousRank} to ${published.rows.indexOf(mover) + 1}; the climb is visible in the archive, not a reset each month.` : 'The order will change when the next round of results is recorded.'}\n\nThe five at the top now: ${published.rows.slice(0, 5).map((row, index) => `${index + 1}. ${row.name} (${row.countryId.toUpperCase()}, ${row.score})`).join('; ')}. Those scores are cumulative for this season.\n\nNext month's edition will compare the same schools against new match results. There are plenty more schools close enough to upset the order.` })
  }
  if (!latest) return articles
  const top = new Set(latest.rows.slice(0, 5).map(row => row.teamId))
  const divisions = [...Object.values(world.divisions), ...(home ? [home] : [])]
  const next = divisions.flatMap(division => division.fixtures.filter(fixture => !fixture.played && fixture.week === week - 4 && fixture.homeTeamId && fixture.awayTeamId)
    .map(fixture => ({ fixture, division }))).find(({ fixture }) => top.has(fixture.homeTeamId) && top.has(fixture.awayTeamId))
  if (next) {
    const a = latest.rows.find(row => row.teamId === next.fixture.homeTeamId)!
    const b = latest.rows.find(row => row.teamId === next.fixture.awayTeamId)!
    const meetings = next.division.matchRecords?.filter(record => [a.teamId, b.teamId].includes(record.homeTeamId) && [a.teamId, b.teamId].includes(record.awayTeamId)) ?? []
    articles.push({ kind: 'preview', headline: `TOP-FIVE COLLISION: ${a.name.toUpperCase()} v ${b.name.toUpperCase()}`, byline: 'Global schools desk',
      body: `Two schools in the world five meet in league play. ${a.name} bring ${a.score} ranking points; ${b.name} have ${b.score}. This one changes more than a local table.`,
      detail: `${a.name} and ${b.name} have made the world five by collecting results all season. They now share a league fixture, with ${a.points} and ${b.points} domestic points respectively.\n\nThe gap in the global race is ${Math.abs(a.score - b.score).toFixed(1)} ranking points. A win changes league points and goal difference for both sides, so next month's ranking can tell a different story.\n\n${meetings.length ? `Their recorded meeting earlier this season finished ${meetings.at(-1)!.homeTeamName} ${meetings.at(-1)!.homeGoals}–${meetings.at(-1)!.awayGoals} ${meetings.at(-1)!.awayTeamName}.` : 'There is no recorded meeting between these sides this season yet.'} Neither side gets to claim this one before kickoff.\n\nThe next whistle will decide who gets to celebrate and who has to chase.` })
  }
  return articles
}

function gameOfWeek(world: WorldLeagues | undefined, home: Division | null, season: number, week: number): GazetteArticle | null {
  const divisions = [...Object.values(world?.divisions ?? {}), ...(home ? [home] : [])]
  const candidates = divisions.flatMap(division => [...(division.matchRecords ?? []), ...(world?.rivalryRecords ?? []).filter(record => division.teams.some(team => team.id === record.homeTeamId))].filter(record => record.season === season && record.week === week)
    .map(match => ({ match, division })))
  if (!candidates.length) return null
  const ranking = world?.schoolRankings?.filter(entry => entry.season === season && entry.week <= week).at(-1)
  const rank = (id: string) => ranking?.rows.findIndex(row => row.teamId === id) ?? -1
  const chosen = candidates.sort((a, b) => {
    const value = ({ match, division }: typeof candidates[number]) => match.homeGoals + match.awayGoals +
      (schoolRival(division, match.homeTeamId)?.id === match.awayTeamId ? 5 : 0) +
      (rank(match.homeTeamId) >= 0 && rank(match.homeTeamId) < 5 ? 3 : 0) + (rank(match.awayTeamId) >= 0 && rank(match.awayTeamId) < 5 ? 3 : 0)
    return value(b) - value(a) || a.match.id.localeCompare(b.match.id)
  })[0]
  const { match, division } = chosen
  const homeScorers = match.lines.filter(line => line.teamId === match.homeTeamId && line.goals > 0)
  const awayScorers = match.lines.filter(line => line.teamId === match.awayTeamId && line.goals > 0)
  const scorers = (lines: typeof homeScorers) => lines.map(line => `${line.name}${line.goals > 1 ? ` (${line.goals})` : ''}`).join(', ')
  const derby = schoolRival(division, match.homeTeamId)?.id === match.awayTeamId
  const leagueMatch = match.competitionId === 'schoolLeague'
  const table = sortStandings(division.standings)
  const homeStanding = table.find(row => row.teamId === match.homeTeamId)
  const away = table.find(row => row.teamId === match.awayTeamId)
  const past = division.matchRecords?.filter(record => record.season === season && record.week < week &&
    [match.homeTeamId, match.awayTeamId].includes(record.homeTeamId) && [match.homeTeamId, match.awayTeamId].includes(record.awayTeamId)).at(-1)
  const hero = [...homeScorers, ...awayScorers].sort((a, b) => b.goals - a.goals)[0]
  const winner = match.homeGoals > match.awayGoals ? match.homeTeamName : match.homeGoals < match.awayGoals ? match.awayTeamName : null
  return { kind: 'recap', headline: `GAME OF THE WEEK: ${match.homeTeamName.toUpperCase()} ${match.homeGoals}–${match.awayGoals} ${match.awayTeamName.toUpperCase()}`,
    byline: 'The Gazette match desk', body: `${winner ? `${winner} won` : leagueMatch ? 'The points were shared' : 'Neither side won'} in a ${match.homeGoals + match.awayGoals}-goal ${derby ? 'derby' : 'school clash'}. ${hero?.goals >= 3 ? `${hero.name} scored a hat-trick.` : hero?.goals ? `${hero.name} was among the scorers.` : ''}`,
    detail: `${derby ? `There is history between ${match.homeTeamName} and ${match.awayTeamName}.` : `${match.homeTeamName} welcomed ${match.awayTeamName} with ${leagueMatch ? 'league points' : 'local pride'} on the line.`} ${past ? `Their earlier meeting finished ${past.homeTeamName} ${past.homeGoals}–${past.awayGoals} ${past.awayTeamName}. This was the chance to answer it.` : 'The first meeting had a story still to write.'}

The score: ${match.homeTeamName} ${match.homeGoals}–${match.awayGoals} ${match.awayTeamName}. ${homeScorers.length ? `${scorers(homeScorers)} scored for the hosts.` : 'The home side could not find the net.'} ${awayScorers.length ? `${scorers(awayScorers)} answered for the visitors.` : 'The visitors went without a goal.'} ${hero?.goals >= 3 ? `For ${hero.name}, three goals made it a day to remember.` : ''}

${winner ? `${winner} had the final say.` : 'Neither side found the winner.'} ${derby ? 'That result adds another chapter to a rivalry that will not be forgotten by the next meeting.' : leagueMatch ? 'The result matters to both sides as the league race moves on.' : 'The result carries into their next meeting.'} ${past ? `The scoreline is a fresh answer to that earlier ${past.homeGoals}–${past.awayGoals} meeting.` : 'They will have another chance to settle it if the fixture list brings them together again.'}

${match.homeTeamName} have ${homeStanding?.points ?? 0} league points; ${match.awayTeamName} have ${away?.points ?? 0}. ${winner ? `${winner} carry the momentum into the next round.` : 'Both teams have work to do before the next round.'} ${hero?.goals ? `${hero.name}'s name will follow this result wherever the season goes.` : ''}` }

}

function seasonGuideArticles(player: Player, week: number, division: Division | null, world?: WorldLeagues): GazetteArticle[] {
  if (player.careerClock?.phase === 'academy' && week === 1) return [
    { kind: 'preview', headline: 'THE ACADEMY CALENDAR, EXPLAINED', byline: 'Academy football desk',
      body: 'League fixtures establish the weekly rhythm. Cup ties test the squad in a different format, and continental football is reserved for clubs that qualify.',
      detail: 'An academy place is the next stage of the career, not a professional contract. The coaching staff evaluate training, availability, and match performances. League games provide regular evidence; domestic cup fixtures can bring group and knockout pressure. If the club earns a continental place, its qualifying route and later bracket are recorded separately. Selection for each match still matters: your place has to be earned.' },
    { kind: 'spotlight', headline: `${player.name.toUpperCase()} BEGINS THE NEXT CHAPTER`, byline: 'The Gazette profile desk',
      body: `${player.name} enters academy football as a ${player.position}. The first appearances will show how the school record translates to a stronger level.`,
      detail: `${player.name} has reached the academy stage. The club, squad, and competition schedule now shape the route toward a professional offer. Training can improve attributes, but performances against academy opponents and the coaches’ selection decisions provide the match evidence. This opening issue records the start of that chapter; later editions will follow what actually happens on the pitch.` },
  ]
  if (week !== 4 || player.careerClock?.phase === 'academy') return []
  const favourites = division ? [...division.teams].sort((a, b) => b.prestige - a.prestige).slice(0, 3) : []
  return [
    { kind: 'league', headline: 'THE SCHOOLS TO BEAT', byline: 'Local league desk',
      body: favourites.length ? `${favourites.map(team => team.name).join(', ')} begin among the strongest sides on paper. The table is still blank; these are pre-season favourites, not predicted champions.` : 'The local field will reveal itself when the league opens.',
      detail: favourites.length ? `${favourites.map((team, index) => `${index + 1}. ${team.name}: pre-season strength ${team.prestige}, with attack ${team.ratings.attack}, midfield ${team.ratings.midfield}, and defence ${team.ratings.defense}.`).join('\n\n')}\n\nThese are starting strengths. Results, goals, and the league table are decided only by fixtures played from week six.` : 'The local league starts in week six. Each completed fixture will update the standings and the scoring list.' },
    { kind: 'preview', headline: 'TWO FRIENDLIES, THEN THE REAL POINTS', byline: 'The Gazette match guide',
      body: `${player.name} and the squad have friendlies in weeks four and five. The eighteen-round local league begins in week six. The friendlies count as match performances, but they do not add league points.`,
      detail: `The first two dates are pre-season friendlies. They give ${player.name}, a ${player.position}, a chance to show the coach what training alone cannot: decisions and execution in a match. Goals, assists, ratings, and availability are part of the player's record. League points start in week six, when the ten-school home-and-away championship opens. A reserve player can earn a stronger place through actual appearances and form.` },
    { kind: 'world', headline: 'THE WORLD BEYOND YOUR SCHOOL', byline: 'World football desk',
      body: `The Gazette is tracking ${Object.keys(world?.divisions ?? {}).length + (division && !world?.divisions[division.teams[0]?.countryId ?? ''] ? 1 : 0)} featured school divisions across the world. Their results and named scorers will begin appearing with the league fixtures.`,
      detail: `Every featured division has its own saved fixture list, standings, match reports, and named player lines. A player mentioned here can be found again in the recorded scoring list. The monthly World Schools Five will draw from those matches and the player's own record. The list is a season-long race: a strong month helps, but the previous months still count. The published ranking later closes ahead of the awards, leaving the final result for the ceremony.` },
    { kind: 'league', headline: 'THE ROAD AFTER THE LOCAL LEAGUE', byline: 'Competition guide',
      body: 'Regional knockout football follows the local campaign. The national championship, October development fixtures, and international selection each have their own qualification rules.',
      detail: 'The local season runs through week twenty-three. Regional cup football begins after the league; the cup is knockout rather than a second league table. Qualifying regional sides move toward the national championship. Younger players may have four development fixtures in October, while selected national school players can enter the international window. Your position, form, eligibility, and actual results determine which of these stages you play. The competition centre will show the draw and saved scores as each event arrives.' },
  ]
}

function schoolLeagueArticle(division: Division | null, season: number, week: number, playerId: string): GazetteArticle | null {
  const records = division?.matchRecords?.filter(record => record.season === season && record.competitionId === 'schoolLeague') ?? []
  if (!records.length || records.length !== division?.fixtures.filter(fixture => fixture.played).length) return null
  if (!records.some(record => record.week === week)) return null
  const scorers = new Map<string, { name: string; team: string; goals: number; recent: number }>()
  for (const record of records) for (const line of record.lines) {
    if (line.playerId === playerId || line.goals <= 0) continue
    const current = scorers.get(line.playerId)
    const team = division!.teams.find(entry => entry.id === line.teamId)
    scorers.set(line.playerId, { name: line.name, team: team?.name ?? 'Local school',
      goals: (current?.goals ?? 0) + line.goals, recent: (current?.recent ?? 0) + (record.week >= week - 4 ? line.goals : 0) })
  }
  const leader = [...scorers.values()].sort((a, b) => b.goals - a.goals)[0]
  if (!leader) return null
  return { kind: 'league', headline: `${surnameOf(leader.name).toUpperCase()} SETS THE PACE`,
    body: `${leader.name} of ${leader.team} has ${leader.goals} league goals this season, including ${leader.recent} in the last four weeks. The local scoring race is taking shape.` }
}

function cupArticle(records: MatchRecord[], season: number, week: number, playerId: string): GazetteArticle | null {
  const match = records.filter(record => record.season === season && record.week === week &&
    !record.lines.some(line => line.playerId === playerId)).sort((a, b) =>
    (b.homeGoals + b.awayGoals) - (a.homeGoals + a.awayGoals))[0]
  if (!match) return null
  const leader = [...match.lines].sort((a, b) => b.goals - a.goals)[0]
  const competition = competitionDefinition(match.competitionId).name
  return { kind: 'league', headline: `${match.homeTeamName.toUpperCase()} ${match.homeGoals}–${match.awayGoals} ${match.awayTeamName.toUpperCase()}`,
    body: `${competition}: ${match.homeTeamName} and ${match.awayTeamName} finished ${match.homeGoals}–${match.awayGoals}. ${leader?.goals ? `${leader.name} scored ${leader.goals} of those goals.` : 'The winner has taken another step toward the trophy.'}` }
}

function fillerArticle(): GazetteArticle {
  return { kind: 'filler', headline: 'WHAT WE ARE FOLLOWING', byline: 'The Gazette sports desk',
    body: 'The fixtures, tables, young players, and academy routes will shape the weeks ahead. This issue is the beginning of a season-long record.',
    detail: 'The season has room for a new name to break through, an old rivalry to flare up, and a cup run no one saw coming. The fixtures will decide whose story comes next.' }
}

// --- assembly ----------------------------------------------------------------

export function generateGazetteIssue(
  weekNumber: number,
  seasonYear: number,
  player: Player,
  departures: DepartureEvent[],
  arrivals: SquadPlayer[],
  upcomingFixture: UpcomingFixtureInfo | null,
  lastResult: LastResultInfo | null,
  schoolDivision: Division | null = null,
  playerId = player.id,
  completedWeek = weekNumber - 1,
  cupRecords: MatchRecord[] = [],
  ranking?: SchoolsRanking,
  scorers?: SchoolsRankingRow[],
  awards?: SchoolsAwards,
  worldResult?: { match: SchoolMatch; star: SchoolsRankingRow },
  worldStory?: GazetteArticle,
  world?: WorldLeagues,
): GazetteIssue {
  const articles: GazetteArticle[] = []

  const opening = competitionOpening(player, weekNumber, seasonYear, schoolDivision)
  if (opening) articles.push(opening)
  const featuredMatch = gameOfWeek(world, schoolDivision, seasonYear, completedWeek)
  if (featuredMatch) articles.push(featuredMatch)
  const derbyRecord = completedWeek === 29 ? player.matchLedger?.find(record => record.season === seasonYear && record.week === 29 && record.competitionId === 'schoolFriendlies') : undefined
  if (derbyRecord) {
    const names = `${derbyRecord.homeTeamName} ${derbyRecord.homeGoals}–${derbyRecord.awayGoals} ${derbyRecord.awayTeamName}`
    const goalLines = derbyRecord.lines.filter(line => line.goals > 0)
    articles.push({ kind: 'recap', headline: `ANNUAL SCHOOL RIVALRY: ${names.toUpperCase()}`, byline: 'Local football desk',
      body: `${names}. The annual derby has a result, and both schools will remember which side took the bragging rights.`,
      detail: `Week 29 brought ${derbyRecord.homeTeamName} and ${derbyRecord.awayTeamName} together for their annual school rivalry match. This fixture has its own place in the calendar; league points were already settled.\n\nIt finished ${names}. ${goalLines.length ? `The goals came from ${goalLines.map(line => `${line.name} of ${line.teamId === derbyRecord.homeTeamId ? derbyRecord.homeTeamName : derbyRecord.awayTeamName} with ${line.goals}`).join('; ')}.` : 'No one took the scoring headlines.'} That score, not school reputation, is this year's answer.\n\n${derbyRecord.homeGoals === derbyRecord.awayGoals ? 'Neither side won the argument on the pitch this year.' : `${derbyRecord.homeGoals > derbyRecord.awayGoals ? derbyRecord.homeTeamName : derbyRecord.awayTeamName} can carry the win into next season.`} The earlier league meetings may have told a different story; the derby gives the rivalry another chapter.\n\nNext year, these two schools will remember exactly what happened here.` })
  }
  articles.push(...seasonGuideArticles(player, weekNumber, schoolDivision, world))
  articles.push(...schoolPowerStories(world, schoolDivision, seasonYear, completedWeek))

  if (worldStory) {
    const arc = world?.stories?.find(story => story.season === seasonYear && story.issuedWeeks?.includes(completedWeek))
    const division = arc && world?.divisions[arc.countryId]
    const recent = division?.matchRecords?.filter(match => match.season === seasonYear &&
      (match.homeTeamId === arc?.teamId || match.awayTeamId === arc?.teamId) && match.week <= completedWeek)
      .sort((a, b) => b.week - a.week).slice(0, 2) ?? []
    articles.push({ ...worldStory, byline: 'World football desk',
      detail: `${worldStory.body}\n\n${arc ? `The ${arc.teamName} story has another turn. How they answer it on the pitch is the question now.` : 'Another result will soon change the conversation.'}${recent.length ? `\n\nRecent scorelines: ${recent.map(match => `${match.homeTeamName} ${match.homeGoals}–${match.awayGoals} ${match.awayTeamName} (week ${match.week})`).join('; ')}.` : ''}` })
  }

  if (awards) articles.push({ kind: 'awards', headline: `${awards.season} ${awards.scope === 'academy' ? 'ACADEMY' : 'WORLD SCHOOLS'} AWARDS`,
    body: `${awards.winners[0]?.winnerName ?? 'The winner'} takes ${awards.winners[0]?.name ?? 'the top award'}. See the recorded winners and Team of the Year in this issue.` })
  if (ranking?.rows.length) {
    const leader = ranking.rows[0]
    const newcomer = ranking.rows.find(row => !row.previousRank)
    articles.push({ kind: 'world', headline: newcomer ? `${newcomer.name.toUpperCase()} ENTERS THE ${ranking.scope === 'academy' ? 'ACADEMY' : 'WORLD'} FIVE` : `${leader.name.toUpperCase()} LEADS THE ${ranking.scope === 'academy' ? 'ACADEMY' : 'WORLD'} FIVE`,
      body: `${leader.name} of ${leader.school} leads on ${leader.points} season points after ${leader.goals} goals and ${leader.assists} assists. ` +
        `${leader.monthGoals} goals and ${leader.monthAssists} assists came in the latest four-week period.` })
  }
  if (weekNumber === 33 && !ranking && player.careerClock.phase !== 'academy') articles.push({ kind: 'world', headline: 'THE WORLD FIVE GOES DARK',
    body: 'The final public schools ranking is locked. Performances still count toward the year-end awards, but the contenders will not be revealed until the ceremony.' })
  if (weekNumber === 24) articles.push({ kind: 'league', headline: 'LOCAL TITLES SET, CUP ROAD AHEAD',
    body: 'Local school seasons have closed. Regional knockout football and the development competition now decide the next chapter.' })
  if (weekNumber === 32 && player.careerClock?.phase !== 'academy') articles.push({ kind: 'league', headline: 'NATIONAL SCHOOLS CHAMPIONSHIP DRAW',
    body: 'The National Schools Championship opens with a round of 16. Regional finalists now face schools from across the country; the draw and results appear in the competition hub.' })
  if (weekNumber === 36 && player.careerClock?.phase !== 'academy') articles.push({ kind: 'league', headline: 'OCTOBER DEVELOPMENT SERIES OPENS',
    body: 'Four October matches await the under-16s. For some, this is the chance they have been waiting for all year.' })
  if (weekNumber === (player.academyCountryId === 'esp' ? 37 : 25) && player.careerClock?.phase === 'academy') articles.push({ kind: 'league', headline: 'ACADEMY CHAMPIONS CUP KNOCKOUT DRAW',
    body: 'The continental qualifiers have decided the 32-club field. Five knockout rounds lead to the Academy Champions Cup final.' })
  if (worldResult) {
    const { match, star } = worldResult
    const fixture = Object.values(world?.divisions ?? {}).flatMap(division => division.matchRecords ?? [])
      .find(record => record.season === seasonYear && record.week === completedWeek && record.lines.some(line => line.playerId === star.id))
    if (fixture) {
      const own = fixture.homeTeamId === fixture.lines.find(line => line.playerId === star.id)?.teamId ? fixture.homeTeamName : fixture.awayTeamName
      const opponent = own === fixture.homeTeamName ? fixture.awayTeamName : fixture.homeTeamName
      const ownGoals = own === fixture.homeTeamName ? fixture.homeGoals : fixture.awayGoals
      const against = own === fixture.homeTeamName ? fixture.awayGoals : fixture.homeGoals
      articles.push({ kind: 'world', headline: match.goals >= 3 ? `${star.name.toUpperCase()} — HAT-TRICK HERO` : match.goals === 2 ? `${star.name.toUpperCase()} STRIKES TWICE` : match.cleanSheet && star.position === 'GK' ? `${star.name.toUpperCase()} SLAMS THE DOOR` : `${own.toUpperCase()} ${ownGoals}–${against} ${opponent.toUpperCase()}`,
        body: `${star.name} ${match.goals >= 3 ? `scored a hat-trick as ${own} beat ${opponent} ${ownGoals}–${against}` : `played a leading role in ${own}'s ${ownGoals}–${against} meeting with ${opponent}`}. ${star.goals} goals in ${star.appearances} appearances this season.`,
        detail: `${own} met ${opponent} in a game that finished ${ownGoals}–${against}. ${ownGoals > against ? `${own} took the points.` : ownGoals === against ? 'The points were shared.' : `${opponent} took the points.`}\n\n${match.goals >= 3 ? `Three goals for ${star.name}. A hat-trick demands attention, and ${opponent} had no answer for that contribution.` : match.goals ? `${star.name} scored ${match.goals} ${match.goals === 1 ? 'goal' : 'goals'}.` : star.position === 'GK' ? `${star.name} made ${match.saves} saves${match.cleanSheet ? ' on the way to a clean sheet' : ''}.` : `${star.name} gave the team a ${match.rating.toFixed(1)} performance.`}\n\nAcross ${star.appearances} league appearances, ${star.name} has ${star.goals} goals and ${star.assists} assists. ${match.goals >= 2 ? 'This was the week that run demanded a headline.' : 'There is still plenty of the season left to shape.'}\n\n${own} take the ${ownGoals}–${against} result into the next round. ${star.name} has set a standard that the rest of the league will notice.` })
    }
  }

  articles.push(...transferArticles(departures, arrivals))
  const injury = injuryArticle(player)
  if (injury) articles.push(injury)
  const playerRecord = player.matchLedger?.find(record => record.season === seasonYear && record.week === completedWeek && record.lines.some(line => line.playerId === player.id))
  const recap = playerRecord ? playerMatchArticle(playerRecord, player, player.matchLedger ?? [], schoolDivision) : recapArticle(lastResult, player.name)
  if (recap) articles.push(recap)
  const preview = previewArticle(upcomingFixture)
  if (preview) articles.push(preview)
  const spotlight = spotlightArticle(player)
  if (spotlight) articles.push(spotlight)
  const league = schoolLeagueArticle(schoolDivision, seasonYear, completedWeek, playerId)
  if (league) articles.push(league)
  const cup = cupArticle(cupRecords, seasonYear, completedWeek, playerId)
  if (cup) articles.push(cup)
  articles.push(...worldDispatch(world, seasonYear, completedWeek))

  // Always at least 2 articles so an early-career issue (nothing has
  // happened yet) doesn't read as a broken/empty page.
  if (articles.length === 0) {
    articles.push({ kind: 'filler', headline: 'A NEW SEASON BEGINS', body: 'All eyes on the weeks ahead. The Gazette will be here every Monday with the full story.' })
  }
  if (articles.length < 2) articles.push(fillerArticle())

  // Masthead priority: injury > transfer > preview (big game) > recap > spotlight
  const priority: ArticleKind[] = ['awards', 'world', 'league', 'injury', 'transfer', 'preview', 'recap', 'spotlight', 'filler']
  const playerGoals = playerRecord?.lines.find(line => line.playerId === player.id)?.goals ?? 0
  if (playerGoals >= 2 && recap) {
    const index = articles.indexOf(recap)
    if (index > 0 && !opening) articles.unshift(...articles.splice(index, 1))
  }
  const masthead = opening?.headline ?? (playerGoals >= 2 && recap ? recap.headline : undefined) ??
    (featuredMatch ? featuredMatch.headline : undefined) ?? priority.map((k) => articles.find((a) => a.kind === k)).find(Boolean)?.headline ?? articles[0].headline

  return { id: id(), weekNumber, seasonYear, masthead, articles, ranking, scorers, awards,
    schoolRanking: world?.schoolRankings?.find(entry => entry.season === seasonYear && entry.week === completedWeek) }
}

/** Present older saved editions in the new editorial voice without altering match history. */
export function presentGazetteIssue(issue: GazetteIssue, player: Player, division: Division | null): GazetteIssue {
  const week = issue.weekNumber - 1
  const record = player.matchLedger?.find(entry => entry.season === issue.seasonYear && entry.week === week && entry.lines.some(line => line.playerId === player.id))
  const playerFeature = record && playerMatchArticle(record, player, player.matchLedger ?? [], division)
  const articles = issue.articles.map(article => {
    if (article.kind === 'recap' && article.headline.startsWith('WIN AGAINST') || article.kind === 'recap' && article.headline.startsWith('DEFEAT AGAINST') || article.kind === 'recap' && article.headline.startsWith('DRAW AGAINST')) return playerFeature ?? article
    if (article.headline === 'ROUTINE FIXTURE AHEAD') {
      const opponent = article.body.match(/against (.+?)\./)?.[1]
      return opponent ? { ...article, headline: `${opponent.toUpperCase()} UP NEXT`, body: `${opponent} are next on the fixture list. Another school, another chance to show what this side can do.`, detail: `${opponent} are the next opposition. The squad goes into the match knowing that last week's form is only useful if they carry it onto the pitch again.\n\nNeither school has the points from this fixture yet. The players still have to earn them.\n\nFor now, the question is whose game will stand up when the teams meet.\n\nThe next issue will have the score and the names behind it.` } : article
    }
    if (article.kind === 'world' && / HITS TWO$/.test(article.headline) && player.worldLeagues) {
      const lineAndRecord = Object.values(player.worldLeagues.divisions).flatMap(entry => entry.matchRecords ?? [])
        .filter(entry => entry.week === week && entry.season === issue.seasonYear).flatMap(entry => entry.lines.map(line => ({ line, entry })))
        .find(({ line }) => article.headline.startsWith(line.name.toUpperCase()))
      if (lineAndRecord) {
        const { line, entry } = lineAndRecord
        const team = line.teamId === entry.homeTeamId ? entry.homeTeamName : entry.awayTeamName
        const opponent = line.teamId === entry.homeTeamId ? entry.awayTeamName : entry.homeTeamName
        const ownGoals = line.teamId === entry.homeTeamId ? entry.homeGoals : entry.awayGoals
        const against = line.teamId === entry.homeTeamId ? entry.awayGoals : entry.homeGoals
        return { ...article, headline: line.goals >= 3 ? `${line.name.toUpperCase()} — HAT-TRICK HERO` : line.goals === 2 ? `${line.name.toUpperCase()} AT THE DOUBLE` : `${team.toUpperCase()} ${ownGoals}–${against} ${opponent.toUpperCase()}`,
          body: `${line.name} scored ${line.goals} as ${team} met ${opponent}. The final score: ${ownGoals}–${against}.`,
          detail: `${team} went into their meeting with ${opponent} looking for a result. They came away with a ${ownGoals}–${against} scoreline.\n\n${line.goals >= 3 ? `Not once, not twice, but ${line.goals} times: ${line.name} had an afternoon to remember.` : `${line.name} scored ${line.goals} ${line.goals === 1 ? 'goal' : 'goals'}.`} ${team} had a player to turn to when it mattered.\n\n${ownGoals > against ? `${team} took the points.` : ownGoals === against ? 'The teams shared the points.' : `${opponent} took the points.`} The next match will tell us whether they can build on it.\n\nFor ${line.name}, this was a performance that deserves its own headline. ${opponent} will remember the score, and the scorer.` }
      }
    }
    return article
  })
  const standout = record?.lines.find(line => line.playerId === player.id)?.goals ?? 0
  if (standout >= 2 && playerFeature && !articles.some(article => article.headline === playerFeature.headline)) articles.unshift(playerFeature)
  const masthead = standout >= 2 && playerFeature ? playerFeature.headline : issue.masthead.endsWith(' HITS TWO') ? articles.find(article => article.headline.includes('HAT-TRICK HERO') || article.headline.includes('AT THE DOUBLE'))?.headline ?? issue.masthead : issue.masthead
  return { ...issue, articles, masthead }
}
