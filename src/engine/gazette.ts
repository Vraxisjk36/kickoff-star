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
import type { SchoolMatch, SchoolStar } from './worldSchools'
import { sortStandings } from './league'
import type { WorldLeagues } from './worldLeagues'

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
    return { kind: 'spotlight', headline: `${surname.toUpperCase()} IN RED-HOT FORM`, body: `${player.name} has delivered three straight performances above 7.5. The run is now part of the season record.`, detail: `${player.name} has ratings of ${recent.slice(-3).map(rating => rating.toFixed(1)).join(', ')} across the last three matches. Those numbers are the reason the Gazette is watching this run. The next fixture will show whether the form continues.` }
  }
  if (recent.length >= 3 && recent.slice(-3).every((r) => r < 5.5)) {
    return { kind: 'spotlight', headline: `QUIET SPELL FOR ${surname.toUpperCase()}`, body: `${player.name} has had three matches below 5.5. Selection and form are under pressure as the season moves on.`, detail: `${player.name}'s last three recorded ratings were ${recent.slice(-3).map(rating => rating.toFixed(1)).join(', ')}. The coach has real match evidence to consider; training can help, but the next appearance is the chance to change the story.` }
  }
  if (last >= 8.5) {
    return { kind: 'spotlight', headline: `${surname.toUpperCase()} STEALS THE HEADLINES`, body: `${player.name} earned a ${last.toFixed(1)} rating in the last outing. The performance adds to their recorded season form.`, detail: `${player.name}'s most recent match rating was ${last.toFixed(1)}. A single game does not decide a season, but the performance gives the coach and scouts something concrete to review. The Gazette will follow the next result rather than assuming the run continues.` }
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
  const isBigGame = fixture.isRivalOrCup || Math.abs(gap) >= 3

  if (!isBigGame) {
    return { kind: 'preview', headline: 'ROUTINE FIXTURE AHEAD', body: `${fixture.competitionLabel} continues this week against ${fixture.opponentName}. Business as usual.` }
  }
  if (fixture.isRivalOrCup) {
    return { kind: 'preview', headline: 'BIG GAME ON THE HORIZON', body: `${fixture.competitionLabel} throws up a huge test against ${fixture.opponentName} this week. The whole town will be watching.` }
  }
  if (gap >= 3) {
    return { kind: 'preview', headline: 'DAVID VS GOLIATH', body: `${fixture.opponentName} arrive as heavy favourites in ${fixture.competitionLabel}. A result here would turn heads.` }
  }
  return { kind: 'preview', headline: 'A CHANCE TO MAKE A STATEMENT', body: `${fixture.opponentName} come in below par in ${fixture.competitionLabel} — a real opportunity to press home the advantage.` }
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
    headline: `${outcome} AGAINST ${result.opponentName.toUpperCase()}`,
    body: `${playerName} and their side finished ${result.playerScore}-${result.opponentScore} against ${result.opponentName}. ${playerName} earned a ${result.playerRating.toFixed(1)} rating${contribution}`,
    detail: `${playerName} featured in a ${result.playerScore}-${result.opponentScore} result against ${result.opponentName}. Their match rating was ${result.playerRating.toFixed(1)}. ${result.playerGoals} goal${result.playerGoals === 1 ? '' : 's'} and ${result.playerAssists} assist${result.playerAssists === 1 ? '' : 's'} were credited in the saved match report. The team result and individual performance now form part of the season record.`,
  }
}

export function competitionOpening(player: Player, week: number, season: number, division: Division | null): GazetteArticle | null {
  if (!player.careerClock) return null // older audit fixtures and partial migrated saves
  const academy = player.careerClock.phase === 'academy'
  const first = academy ? !player.gazetteIssues?.some(issue => issue.seasonYear < season && issue.articles.some(article => article.headline.includes('ACADEMY SEASON OPENS'))) : season === 1
  const specs: Partial<Record<number, string[]>> = academy
    ? { 1: ['academyLeague', 'ACADEMY SEASON OPENS', 'The academy league is the weekly test. Domestic cups add knockout pressure, and qualifying clubs can enter continental competition. Your minutes, training, and match record all feed selection and scouting.'],
        25: ['academyChampionsCup', 'THE CONTINENTAL ROAD', 'The Academy Champions Cup brings qualified European academy sides together. Qualification and the knockout draw are determined by actual results; your club must earn its place.'] }
    : { 4: ['schoolFriendlies', 'A NEW SCHOOL FOOTBALL YEAR', 'Two friendlies in weeks four and five give coaches their first match evidence. The local league starts in week six, followed by the regional cup, national championship for qualifying sides, and the autumn development series.'],
        6: ['schoolLeague', 'THE LOCAL CHAMPIONSHIP BEGINS', 'Ten schools play home and away across eighteen league rounds. Every point and goal is saved to the table. League position shapes the route into regional football; form and selection determine your own minutes.'],
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
    body: `${first ? explanation : `The ${competitionDefinition(competitionId).name} returns this week. The fixture list and saved results will tell the story from here.`} ${history}`,
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
  const previous = matches.filter(entry => entry.country === country).length
  const starHistory = biggest.division.matchRecords?.filter(entry => entry.season === season && entry.week <= week)
    .flatMap(entry => entry.lines).filter(line => line.playerId === star?.playerId) ?? []
  const cumulative = starHistory.reduce((total, line) => total + line.goals, 0)
  const score = `${match.homeTeamName} ${match.homeGoals}–${match.awayGoals} ${match.awayTeamName}`
  const lead: GazetteArticle = { kind: 'world', headline: `${score.toUpperCase()} · ${country.toUpperCase()}`,
    byline: 'World football desk', body: `${score}. ${star?.goals ? `${star.name} scored ${star.goals} and now has ${cumulative} in recorded league matches this season.` : 'The result is in the world league record.'}`,
    detail: `${score}. This was one of ${previous} recorded fixtures in the ${country.toUpperCase()} featured division this week. ${star ? `${star.name} of ${biggest.division.teams.find(team => team.id === star.teamId)?.name ?? 'the featured division'} recorded ${star.goals} goal${star.goals === 1 ? '' : 's'} and ${star.assists} assist${star.assists === 1 ? '' : 's'} in this match. Across ${starHistory.length} recorded appearances this season, ${star.name} has ${cumulative} league goals. ` : ''}The league table and scorer list now reflect the played result.`,
  }
  const leading = divisions.map(([countryId, division]) => ({ countryId, standings: sortStandings(division.standings), division }))
    .filter(entry => entry.standings[0]?.played > 0).sort((a, b) => b.standings[0].points - a.standings[0].points)[0]
  if (!leading) return [lead]
  const leader = leading.standings[0]
  const second = leading.standings[1]
  return [lead, { kind: 'league', headline: `${leader.teamName.toUpperCase()} SET THE PACE`, byline: 'League watch',
    body: `${leader.teamName} lead the ${leading.countryId.toUpperCase()} featured division on ${leader.points} points from ${leader.played} games. ${second ? `${second.teamName} sit behind them on ${second.points}.` : ''}`,
    detail: `The table after ${leader.played} matches shows ${leader.teamName} with ${leader.won} wins, ${leader.drawn} draws and ${leader.lost} defeats. Their goal record is ${leader.goalsFor} scored and ${leader.goalsAgainst} conceded. ${second ? `${second.teamName} follow on ${second.points} points. The gap is ${leader.points - second.points} points, with plenty of fixtures still to play.` : ''} These figures come from completed league fixtures, not a prediction.` }]
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
    body: `${competition}: ${match.homeTeamName} and ${match.awayTeamName} finished ${match.homeGoals}–${match.awayGoals}. ${leader?.goals ? `${leader.name} scored ${leader.goals} of those goals.` : 'The result moves the tournament forward.'}` }
}

function fillerArticle(): GazetteArticle {
  return { kind: 'filler', headline: 'WHAT WE ARE FOLLOWING', byline: 'The Gazette sports desk',
    body: 'The fixtures, tables, young players, and academy routes will shape the weeks ahead. This issue is the beginning of a season-long record.',
    detail: 'Each issue follows completed matches and saved league tables. The world ranking is built from recorded performances; competition previews will name confirmed winners from past seasons when that history exists. Return to the issue archive to trace how a player or team changed over the year.' }
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
  worldResult?: { match: SchoolMatch; star: SchoolStar },
  worldStory?: GazetteArticle,
  world?: WorldLeagues,
): GazetteIssue {
  const articles: GazetteArticle[] = []

  const opening = competitionOpening(player, weekNumber, seasonYear, schoolDivision)
  if (opening) articles.push(opening)
  articles.push(...seasonGuideArticles(player, weekNumber, schoolDivision, world))

  if (worldStory) {
    const arc = world?.stories?.find(story => story.season === seasonYear && story.issuedWeeks?.includes(completedWeek))
    const division = arc && world?.divisions[arc.countryId]
    const recent = division?.matchRecords?.filter(match => match.season === seasonYear &&
      (match.homeTeamId === arc?.teamId || match.awayTeamId === arc?.teamId) && match.week <= completedWeek)
      .sort((a, b) => b.week - a.week).slice(0, 2) ?? []
    articles.push({ ...worldStory, byline: 'World football desk',
      detail: `${worldStory.body}\n\n${arc ? `This is chapter ${(arc.issuedWeeks?.length ?? 1)} of the ${arc.teamName} story. The school's standing and future match results remain visible in the ${arc.countryId.toUpperCase()} world league tracker.` : 'The world league tracker keeps the played results.'}${recent.length ? `\n\nRecent recorded results: ${recent.map(match => `${match.homeTeamName} ${match.homeGoals}–${match.awayGoals} ${match.awayTeamName} (week ${match.week})`).join('; ')}.` : ''}` })
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
    body: 'Four fixtures offer under-16 players another route to be seen this October. The saved league table will follow every result.' })
  if (weekNumber === (player.academyCountryId === 'esp' ? 37 : 25) && player.careerClock?.phase === 'academy') articles.push({ kind: 'league', headline: 'ACADEMY CHAMPIONS CUP KNOCKOUT DRAW',
    body: 'The continental qualifiers have decided the 32-club field. Five knockout rounds lead to the Academy Champions Cup final.' })
  if (worldResult) {
    const { match, star } = worldResult
    articles.push({ kind: 'world', headline: match.goals >= 2 ? `${star.name.toUpperCase()} HITS TWO` : match.cleanSheet && star.position === 'GK'
      ? `${star.name.toUpperCase()} SHUTS THE DOOR` : `${star.school.toUpperCase()} IN THE SPOTLIGHT`,
    body: `${star.name} of ${star.school} faced ${match.opponent} this week: ${match.goals} goals, ${match.assists} assists${star.position === 'GK' ? `, ${match.saves} saves` : ''}, and a ${match.rating.toFixed(1)} rating. The result enters the season's world school record.` })
  }

  articles.push(...transferArticles(departures, arrivals))
  const injury = injuryArticle(player)
  if (injury) articles.push(injury)
  const recap = recapArticle(lastResult, player.name)
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
  const masthead = opening?.headline ?? priority.map((k) => articles.find((a) => a.kind === k)).find(Boolean)?.headline ?? articles[0].headline

  return { id: id(), weekNumber, seasonYear, masthead, articles, ranking, scorers, awards }
}
