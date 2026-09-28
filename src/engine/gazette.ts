import { rand } from './rng'
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

export type ArticleKind = 'transfer' | 'spotlight' | 'preview' | 'injury' | 'recap' | 'league' | 'filler' | 'world' | 'awards'

export interface GazetteArticle {
  kind: ArticleKind
  headline: string
  body: string
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
    return { kind: 'spotlight', headline: `${surname.toUpperCase()} IN RED-HOT FORM`, body: `Three straight performances above 7.5 — the kind of run that gets noticed. Keep it going.` }
  }
  if (recent.length >= 3 && recent.slice(-3).every((r) => r < 5.5)) {
    return { kind: 'spotlight', headline: `QUIET SPELL FOR ${surname.toUpperCase()}`, body: `A tougher few weeks on the pitch. Every career has them — the response is what counts.` }
  }
  if (last >= 8.5) {
    return { kind: 'spotlight', headline: `${surname.toUpperCase()} STEALS THE HEADLINES`, body: `A rating of ${last.toFixed(1)} in the last outing. Performances like that don't go unnoticed.` }
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
    body: `${player.injury.description} Expected return in around ${player.injury.weeksRemaining} week${player.injury.weeksRemaining === 1 ? '' : 's'}.`,
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

function recapArticle(result: LastResultInfo | null): GazetteArticle | null {
  if (!result) return null
  const outcome = result.playerScore > result.opponentScore ? 'WIN' : result.playerScore < result.opponentScore ? 'DEFEAT' : 'DRAW'
  const contribution = result.playerGoals > 0 || result.playerAssists > 0
    ? ` ${result.playerGoals > 0 ? `${result.playerGoals} goal${result.playerGoals > 1 ? 's' : ''}` : ''}${result.playerGoals > 0 && result.playerAssists > 0 ? ' and ' : ''}${result.playerAssists > 0 ? `${result.playerAssists} assist${result.playerAssists > 1 ? 's' : ''}` : ''} to show for it.`
    : ''
  return {
    kind: 'recap',
    headline: `${outcome} AGAINST ${result.opponentName.toUpperCase()}`,
    body: `Final score ${result.playerScore}-${result.opponentScore}. A ${result.playerRating.toFixed(1)} rating on the day.${contribution}`,
  }
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

const FILLER_LINES = [
  'The clubhouse tea urn remains, against all odds, still functional.',
  'Local pitch conditions described as "character-building" by anyone who trained on them this week.',
  'Groundskeeper reports the grass is, in fact, greener on this side.',
  'Nobody has yet worked out who keeps moving the cones.',
]

function fillerArticle(): GazetteArticle {
  const line = FILLER_LINES[Math.floor(rand() * FILLER_LINES.length)]
  return { kind: 'filler', headline: 'AROUND THE CLUB', body: line }
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
): GazetteIssue {
  const articles: GazetteArticle[] = []

  if (worldStory) articles.push(worldStory)

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
  const recap = recapArticle(lastResult)
  if (recap) articles.push(recap)
  const preview = previewArticle(upcomingFixture)
  if (preview) articles.push(preview)
  const spotlight = spotlightArticle(player)
  if (spotlight) articles.push(spotlight)
  const league = schoolLeagueArticle(schoolDivision, seasonYear, completedWeek, playerId)
  if (league) articles.push(league)
  const cup = cupArticle(cupRecords, seasonYear, completedWeek, playerId)
  if (cup) articles.push(cup)

  // Always at least 2 articles so an early-career issue (nothing has
  // happened yet) doesn't read as a broken/empty page.
  if (articles.length === 0) {
    articles.push({ kind: 'filler', headline: 'A NEW SEASON BEGINS', body: 'All eyes on the weeks ahead. The Gazette will be here every Monday with the full story.' })
  }
  if (articles.length < 2) articles.push(fillerArticle())

  // Masthead priority: injury > transfer > preview (big game) > recap > spotlight
  const priority: ArticleKind[] = ['awards', 'world', 'league', 'injury', 'transfer', 'preview', 'recap', 'spotlight', 'filler']
  const masthead = priority.map((k) => articles.find((a) => a.kind === k)).find(Boolean)?.headline ?? articles[0].headline

  return { id: id(), weekNumber, seasonYear, masthead, articles, ranking, scorers, awards }
}
