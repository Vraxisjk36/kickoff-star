import type { ProWorldState } from './proWorld'
import type { Player } from '../types/player'

export interface ProNewsArticle { id: string; week: number; season: number; section: 'Club' | 'Country' | 'World'; headline: string; paragraphs: string[] }

/** Every line is tied to a recorded result, transaction or title. */
export function gatherProNews(world: ProWorldState, player: Player, season: number, week: number, previous: ProNewsArticle[]): ProNewsArticle[] {
  const known = new Set(previous.map(article => article.id))
  const articles = [...previous]
  if (player.lastMatchResult && week === player.proCareer?.resolvedWeek) {
    const match = player.lastMatchResult
    const id = `club:${season}:${week}`
    if (!known.has(id)) articles.push({ id, week, season, section: 'Club', headline: `${player.proCareer?.world.divisions[1].teams.find(team => team.id === player.proCareer?.world.playerTeamId)?.name ?? 'Your club'} ${match.playerScore}–${match.opponentScore} ${match.opponentName}`,
      paragraphs: [`${player.name} played against ${match.opponentName} and finished with a ${match.playerRating.toFixed(1)} rating. The score was ${match.playerScore}–${match.opponentScore}.`,
        `${match.playerGoals} goal${match.playerGoals === 1 ? '' : 's'} and ${match.playerAssists} assist${match.playerAssists === 1 ? '' : 's'} went into the career record. The league table reflects this result.`] })
  }
  const recent = world.recentEvents.filter(event => event.date >= new Date(Date.parse(`${world.currentDate}T00:00:00Z`) - 28 * 86400000).toISOString().slice(0, 10))
  for (const event of recent.reverse()) {
    if (known.has(event.id) || articles.some(article => article.id === event.id)) continue
    if (event.kind === 'award') {
      const champion = world.clubs[event.subjectIds[0]]
      if (!champion) continue
      const competition = String(event.details.competitionId ?? '')
      articles.push({ id: event.id, week, season, section: champion.associationId === 'eng' ? 'Country' : 'World', headline: `${champion.name} take the title`,
        paragraphs: [`${champion.name} finished first in ${competition.replace(/-/g, ' ')}. The recorded final table gives them the trophy.`,
          `The club enters the next campaign with a title on its record. Its squad, finances and academy continue into the new season.`] })
    } else if (event.kind === 'transfer' && event.details.action) {
      const person = world.players[event.subjectIds[0]]
      const club = world.clubs[event.subjectIds[1]]
      if (!club) continue
      const action = String(event.details.action).replace(/-/g, ' ')
      articles.push({ id: event.id, week, season, section: club.associationId === 'eng' ? 'Country' : 'World', headline: `${club.name}: ${action}`,
        paragraphs: [`${person?.name ?? 'A squad player'} is part of ${club.name}'s latest ${action}. The move is recorded in the club's season history.`,
          `The shirt allocation and squad budget are updated for the next fixtures.`] })
    }
    if (articles.length - previous.length >= 5) break
  }
  return articles.slice(-100)
}
