import { rand } from './rng'
// Phase 23 — youth international layer. Reputation/stat-threshold call-up,
// then a real tournament shape (qualifiers -> finals), not just friendlies.
// Reuses competitions.ts's knockout generator for the finals bracket rather
// than a fourth copy of bracket math.
import { generateTeam, type Team } from './teams'
import { NATIONS, type Nation } from './nations'
import { generateRoundRobin, generateKnockoutRound, knockoutWinners, type GenericFixture } from './competitions'

export type CallUpTier = 'none' | 'friendly' | 'qualifiers' | 'finals'

// P56 — Joel: loosen this, and make it feel like real international
// selection instead of one hidden reputation number. Redesigned in two
// layers, matching how real youth call-ups actually work:
//   1. ELIGIBILITY — you have to be good enough to be in the conversation
//      at all. Now based on your actual overall rating (something you can
//      see and chase yourself), not an invisible reputation stat.
//   2. SELECTION — being eligible doesn't mean automatic caps. Each
//      fixture, the manager looks at your recent FORM (last 5 match
//      ratings) — perform well and you get picked for that game; a dip in
//      form and you're left out of THAT one, even though you're still
//      eligible overall. This is what makes it feel like real competition
//      for a place, not a one-time unlock.
//
// Threshold picked from real simulated careers (see scripts/careerReport.ts):
// OVR runs roughly 46-50 at grassroots exit, 63-70 through mid-academy,
// 74-76 by pro. 58 sits solidly in "proven academy player, not yet the
// finished article" — reachable by most careers around season 2-3, not
// locked to the very last season the way the old rep-55 gate effectively was.
export const CALL_UP_OVR_THRESHOLD = 58

// Recent-form bar for actually being picked, once eligible. 7.0 average
// over the last 5 games is genuinely good form — clearly above the ~6.5-6.9
// average a typical run of matches sits at in real simulated careers, not
// just "showed up."
export const SELECTION_FORM_THRESHOLD = 7.0
export const SELECTION_FORM_WINDOW = 5

export function isCallUpEligible(overallRating: number): boolean {
  return overallRating >= CALL_UP_OVR_THRESHOLD
}

/** Once eligible for the squad, this is what decides whether you're picked for a SPECIFIC upcoming fixture. */
export function formQualifiesForSelection(recentRatings: number[]): boolean {
  const window = recentRatings.slice(-SELECTION_FORM_WINDOW)
  if (window.length < SELECTION_FORM_WINDOW) return false
  const avg = window.reduce((a, b) => a + b, 0) / window.length
  return avg >= SELECTION_FORM_THRESHOLD
}

export interface QualifyingGroup {
  groupId: string
  teams: Team[]
  fixtures: GenericFixture[]
}

export interface InternationalWorld {
  nationTeamId: string
  qualifyingGroup: QualifyingGroup
  qualified: boolean
  finalsRounds: GenericFixture[][]
  currentFinalsRound: number
  // Finals opponents must be resolvable by id later (the player plays them
  // through the real match engine) — the original version generated them and
  // threw the Team objects away, leaving finals fixtures with unresolvable ids.
  finalsTeams: Team[]
  stage: 'qualifiers' | 'finals' | 'complete' | 'not-qualified'
  wonTournament: boolean
  eliminated: boolean
}

function standing(teams: Team[]) {
  return teams.map((t) => ({ teamId: t.id, points: 0, goalsFor: 0, goalsAgainst: 0 }))
}

function nationTeam(nation: Nation): Team {
  return { ...generateTeam(nation.strength), name: nation.name, short: nation.short, countryId: nation.id }
}

// Qualifying group of 5 nations (player's nation + 4 others), single
// round-robin (4 rounds) — small enough to fit the season budget alongside
// everything else, big enough to feel like a real qualifying campaign.
export function initInternationalWorld(playerNationName: string, playerNationId?: string): InternationalWorld {
  const selected = NATIONS.find(n => n.id === playerNationId || n.name === playerNationName)
  const others: Team[] = selected
    ? [...NATIONS.filter(n => n.id !== selected.id)].sort(() => rand() - 0.5).slice(0, 4).map(nationTeam)
    : Array.from({ length: 4 }, () => generateTeam(4 + Math.floor(rand() * 5)))
  const nation = selected ? nationTeam(selected) : { ...generateTeam(6), name: playerNationName, short: playerNationName.slice(0, 3).toUpperCase() }
  const teams = [nation, ...others]
  const fixtures = generateRoundRobin(teams.map((t) => t.id), 1)
  return {
    nationTeamId: nation.id,
    qualifyingGroup: { groupId: 'QUAL', teams, fixtures },
    qualified: false,
    finalsRounds: [],
    currentFinalsRound: 0,
    finalsTeams: [],
    stage: 'qualifiers',
    wonTournament: false,
    eliminated: false,
  }
}

function simpleScore(attack: number, defense: number): number {
  const expected = Math.max(0.2, (attack - defense) / 40 + 1.3)
  let goals = 0
  let p = rand() * expected * 1.8
  while (p > 1) { goals++; p -= 1 }
  if (rand() < (p % 1)) goals++
  return Math.min(goals, 7)
}

// Batch-sim every qualifying fixture except the nation's own (mirrors the
// club-level batch-sim pattern) — the nation's own results come from the
// real match engine when the player is actually called up to play them.
export function batchSimQualifyingRound(world: InternationalWorld, round: number, teamById: Map<string, Team>): InternationalWorld {
  const fixtures = world.qualifyingGroup.fixtures.map((f) => {
    if (f.played || f.round !== round) return f
    if (f.homeTeamId === world.nationTeamId || f.awayTeamId === world.nationTeamId) return f
    const home = teamById.get(f.homeTeamId), away = teamById.get(f.awayTeamId)
    if (!home || !away) return f
    const hg = simpleScore(home.ratings.attack, away.ratings.defense)
    const ag = simpleScore(away.ratings.attack, home.ratings.defense)
    return { ...f, played: true, homeGoals: hg, awayGoals: ag }
  })
  return { ...world, qualifyingGroup: { ...world.qualifyingGroup, fixtures } }
}

function tableFor(world: InternationalWorld) {
  const table = standing(world.qualifyingGroup.teams)
  for (const f of world.qualifyingGroup.fixtures) {
    if (!f.played || f.homeGoals === null || f.awayGoals === null) continue
    const h = table.find((t) => t.teamId === f.homeTeamId)!
    const a = table.find((t) => t.teamId === f.awayTeamId)!
    h.goalsFor += f.homeGoals; h.goalsAgainst += f.awayGoals
    a.goalsFor += f.awayGoals; a.goalsAgainst += f.homeGoals
    if (f.homeGoals > f.awayGoals) h.points += 3
    else if (f.homeGoals < f.awayGoals) a.points += 3
    else { h.points += 1; a.points += 1 }
  }
  return table.sort((x, y) => y.points - x.points || (y.goalsFor - y.goalsAgainst) - (x.goalsFor - x.goalsAgainst))
}

// Top 2 of the 5-team qualifying group go through to the finals — advance
// once every qualifying fixture is played.
export function advanceInternationalStage(world: InternationalWorld): InternationalWorld {
  if (world.stage === 'qualifiers') {
    const done = world.qualifyingGroup.fixtures.every((f) => f.played)
    if (!done) return world
    const top2 = tableFor(world).slice(0, 2).map((t) => t.teamId)
    if (!top2.includes(world.nationTeamId)) {
      return { ...world, stage: 'not-qualified', qualified: false }
    }
    const nation = world.qualifyingGroup.teams.find((t) => t.id === world.nationTeamId)!
    const otherQualifier = world.qualifyingGroup.teams.find(t => t.id === top2.find(id => id !== nation.id))
    const used = new Set([nation.countryId, otherQualifier?.countryId])
    const finalists = [...NATIONS.filter(n => !used.has(n.id))].sort(() => rand() - 0.5).slice(0, 7 - (otherQualifier ? 1 : 0))
    const others: Team[] = nation.countryId
      ? [...(otherQualifier ? [otherQualifier] : []), ...finalists.map(nationTeam)]
      : Array.from({ length: 7 }, () => generateTeam(5 + Math.floor(rand() * 5)))
    const round1 = generateKnockoutRound([nation.id, ...others.map((t) => t.id)], 1)
    return { ...world, stage: 'finals', qualified: true, finalsRounds: [round1], currentFinalsRound: 1, finalsTeams: [nation, ...others] }
  }

  if (world.stage === 'finals') {
    const round = world.finalsRounds[world.currentFinalsRound - 1]
    if (!round.every((f) => f.played)) return world
    const winners = knockoutWinners(round)
    if (winners.length <= 1) {
      return { ...world, stage: 'complete', wonTournament: winners[0] === world.nationTeamId }
    }
    const nextRound = generateKnockoutRound(winners, world.currentFinalsRound + 1)
    return { ...world, finalsRounds: [...world.finalsRounds, nextRound], currentFinalsRound: world.currentFinalsRound + 1 }
  }

  return world
}


// Every team in the world, resolvable by id regardless of stage.
export function internationalTeamById(world: InternationalWorld): Map<string, Team> {
  const m = new Map<string, Team>()
  for (const t of world.qualifyingGroup.teams) m.set(t.id, t)
  for (const t of world.finalsTeams) m.set(t.id, t)
  return m
}

// The nation's next unplayed fixture in the current stage, if any.
export function nationFixture(world: InternationalWorld): GenericFixture | null {
  if (world.stage === 'qualifiers') {
    return world.qualifyingGroup.fixtures.find((f) => !f.played && (f.homeTeamId === world.nationTeamId || f.awayTeamId === world.nationTeamId)) ?? null
  }
  if (world.stage === 'finals' && !world.eliminated) {
    const round = world.finalsRounds[world.currentFinalsRound - 1]
    return round?.find((f) => !f.played && (f.homeTeamId === world.nationTeamId || f.awayTeamId === world.nationTeamId)) ?? null
  }
  return null
}

// Record the player's own international, played through the real match engine.
// Finals draws are settled by shootout (rolled by the caller) exactly like cups.
export function recordNationResult(world: InternationalWorld, opponentId: string, nationScored: number, opponentScored: number, nationWasHome: boolean, shootoutWonByNation?: boolean): InternationalWorld {
  const homeId = nationWasHome ? world.nationTeamId : opponentId
  const awayId = nationWasHome ? opponentId : world.nationTeamId
  let hg = nationWasHome ? nationScored : opponentScored
  let ag = nationWasHome ? opponentScored : nationScored

  if (world.stage === 'qualifiers') {
    const fixtures = world.qualifyingGroup.fixtures.map((f) =>
      !f.played && f.homeTeamId === homeId && f.awayTeamId === awayId ? { ...f, played: true, homeGoals: hg, awayGoals: ag } : f
    )
    return { ...world, qualifyingGroup: { ...world.qualifyingGroup, fixtures } }
  }

  if (world.stage === 'finals') {
    const drew = hg === ag
    const nationOut = drew ? !(shootoutWonByNation ?? false) : (nationWasHome ? hg < ag : ag < hg)
    if (drew) {
      const nationWins = shootoutWonByNation ?? false
      const homeWins = nationWasHome ? nationWins : !nationWins
      if (homeWins) hg += 0 // home already advances on level goals in knockoutWinners
      else ag += 1
    }
    const round = world.finalsRounds[world.currentFinalsRound - 1].map((f) =>
      !f.played && f.homeTeamId === homeId && f.awayTeamId === awayId ? { ...f, played: true, homeGoals: hg, awayGoals: ag } : f
    )
    const rounds = [...world.finalsRounds]
    rounds[world.currentFinalsRound - 1] = round
    return { ...world, finalsRounds: rounds, eliminated: world.eliminated || nationOut }
  }
  return world
}

// Sim the rest of the current finals round (NPC ties), settling draws by a
// midfield-weighted shootout so brackets always produce a winner.
export function batchSimFinalsRound(world: InternationalWorld): InternationalWorld {
  if (world.stage !== 'finals') return world
  const byId = internationalTeamById(world)
  const round = world.finalsRounds[world.currentFinalsRound - 1].map((f) => {
    if (f.played) return f
    if (f.homeTeamId === world.nationTeamId || f.awayTeamId === world.nationTeamId) return f
    const home = byId.get(f.homeTeamId), away = byId.get(f.awayTeamId)
    if (!home || !away) return f
    let hg = simpleScore(home.ratings.attack, away.ratings.defense)
    let ag = simpleScore(away.ratings.attack, home.ratings.defense)
    if (hg === ag) {
      if (rand() < 0.5 + (home.ratings.midfield - away.ratings.midfield) / 200) hg += 1
      else ag += 1
    }
    return { ...f, played: true, homeGoals: hg, awayGoals: ag }
  })
  const rounds = [...world.finalsRounds]
  rounds[world.currentFinalsRound - 1] = round
  return { ...world, finalsRounds: rounds }
}
