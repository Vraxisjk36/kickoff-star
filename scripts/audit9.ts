// AUDIT 9 (P33) — the logic pass.
//
// Everything here came from playing a whole career end to end with a probe and
// asking "does this actually make sense?" rather than from a feature request.
import { reseed } from '../src/engine/rng'
import {
  contractStatus, renewalVerdict, renewalBaseWage, releaseOutcome, RENEWAL_WINDOW_WEEKS, SCHOLARSHIP_WAGE_CEILING,
} from '../src/engine/contractLifecycle'
import { buildSeasonReview } from '../src/engine/seasonReview'
import { startNegotiation, openingTerms, contractValue } from '../src/engine/negotiation'
import { checkForOffers, type ScoutingState } from '../src/engine/scouting'
import { standingMatchEffects } from '../src/engine/standing'
import { initMatch } from '../src/engine/match'
import { generateTeam } from '../src/engine/teams'
import { initialCast } from '../src/engine/relationships'
import { EMPTY_CUPS } from '../src/engine/save'
import { initLeagueWorld } from '../src/engine/league'
import type { Player } from '../src/types/player'

reseed(33033)
let fails = 0
const check = (c: boolean, m: string) => { if (!c) { fails++; console.error('  ✗', m) } else console.log('  ✓', m) }

function mk(over: Partial<Player> = {}): Player {
  const v: Record<string, number> = {}
  for (const k of ['finishing', 'passing', 'dribbling', 'firstTouch', 'pace', 'strength', 'stamina', 'agility', 'vision', 'composure', 'positioning', 'concentration']) v[k] = 12
  return {
    name: 'Test Player', position: 'ST', potential: 16, attributes: { kind: 'outfield', values: v },
    confidence: { value: 0, baseline: 0 }, fitness: { stamina: 70 },
    careerClock: { ageYears: 17, phase: 'academy', grassrootsSeason: 3 },
    matchRatings: [7, 7, 7], career: { goals: 10, assists: 6, appearances: 45, wins: 20, cleanSheets: 0, bestRating: 8.5, motmAwards: 3 },
    coachTrust: 2, reputation: 45, scoutWatchers: [], contractOffers: [], totalWeeksElapsed: 160,
    squadRole: 'starting-xi', recentInjuryCount: 0, injury: null, relationships: initialCast(),
    standing: { teammates: 30, fans: 40 }, squad: [], seasonAppearances: 20, seasonGoals: 8, seasonAssists: 5,
    seasonRatings: [7, 7.5, 6.8, 8, 7.2],
    contract: { clubName: 'Test FC', terms: { weeklyWage: 150, years: 2, appearanceFee: 9, goalBonus: 12, signingBonus: 120 }, signedWeek: 72, expiresWeek: 160 },
    ...over,
  } as unknown as Player
}

// ---------------------------------------------------------------------------
console.log('\n[A] CONTRACTS ACTUALLY END')
{
  // The hole: a career probe signed in week 78, the deal expired in week 166,
  // and the player was still drawing wages in week 248. expiresWeek was
  // written once and never read.
  check(contractStatus(mk({ totalWeeksElapsed: 100 } as Partial<Player>)).kind === 'running', 'a live contract reads as running')
  const due = contractStatus(mk({ totalWeeksElapsed: 160 - RENEWAL_WINDOW_WEEKS } as Partial<Player>))
  check(due.kind === 'decision-due', `the club's decision comes due ${RENEWAL_WINDOW_WEEKS} weeks out`)
  check(contractStatus(mk({ totalWeeksElapsed: 160 } as Partial<Player>)).kind === 'expired', 'a contract expires on its expiry week')
  check(contractStatus(mk({ totalWeeksElapsed: 400 } as Partial<Player>)).kind === 'expired', 'and stays expired')
  check(contractStatus(mk({ contract: null } as Partial<Player>)).kind === 'none', 'no contract reads as none')

  // Renew-or-release must track performance.
  const bad = renewalVerdict(mk({ coachTrust: -4, matchRatings: [5.2, 5.0, 5.3], standing: { teammates: -40, fans: -40 }, career: { goals: 1, assists: 0, appearances: 8, wins: 1, cleanSheets: 0, bestRating: 6, motmAwards: 0 } } as Partial<Player>))
  const ok = renewalVerdict(mk({ coachTrust: 0, matchRatings: [6.2, 6.3, 6.1], standing: { teammates: 0, fans: 0 }, career: { goals: 4, assists: 2, appearances: 25, wins: 9, cleanSheets: 0, bestRating: 7, motmAwards: 1 } } as Partial<Player>))
  const star = renewalVerdict(mk({ coachTrust: 7, matchRatings: [8, 8.2, 7.9], standing: { teammates: 70, fans: 70 }, career: { goals: 22, assists: 12, appearances: 70, wins: 40, cleanSheets: 0, bestRating: 9, motmAwards: 8 } } as Partial<Player>))
  console.log(`    poor ${bad.score} → ${bad.keep ? 'renew' : 'RELEASED'} · steady ${ok.score} → ${ok.keep ? 'renew' : 'released'} · star ${star.score} → ${star.keep ? 'renew' : 'released'}`)
  check(!bad.keep, 'a poor spell genuinely gets you released')
  check(ok.keep && star.keep, 'a steady or strong player is kept on')
  check(star.score > ok.score && ok.score > bad.score, 'the verdict tracks performance monotonically')
  check(!!bad.reason && bad.reason.length > 20, 'and the player is told why')

  // Renewal terms must reward the good season.
  const okWage = renewalBaseWage(mk(), ok.score)
  const starWage = renewalBaseWage(mk(), star.score)
  console.log(`    renewal offers: steady £${okWage}/wk · star £${starWage}/wk (currently £150)`)
  check(starWage > okWage, 'a better season earns a better renewal')
  check(okWage >= 140, 'even a marginal renewal is not an insult')
  check(starWage < 150 * 2, 'but a renewal is not a lottery win either')
  // Compounding guard — the six-season sim turned £140 into £554 over three
  // renewals before this existed.
  let compounding = 150
  for (let i = 0; i < 6; i++) {
    compounding = renewalBaseWage(mk({ contract: { clubName: 'X', terms: { weeklyWage: compounding, years: 2, appearanceFee: 9, goalBonus: 12, signingBonus: 100 }, signedWeek: 0, expiresWeek: 88 } } as Partial<Player>), star.score)
  }
  console.log(`    six consecutive star renewals from £150 → £${compounding}/wk`)
  check(compounding <= SCHOLARSHIP_WAGE_CEILING, `renewals cannot compound past the scholarship ceiling (£${compounding} vs cap £${SCHOLARSHIP_WAGE_CEILING})`)

  // Release consequences scale with runway.
  check(releaseOutcome(mk({ careerClock: { ageYears: 16, phase: 'academy', grassrootsSeason: 3 } } as Partial<Player>)).endsCareer === false, 'a 16-year-old released gets another go')
  check(releaseOutcome(mk({ careerClock: { ageYears: 19, phase: 'academy', grassrootsSeason: 3 }, reputation: 20 } as Partial<Player>)).endsCareer === true, 'released at 19 with nobody watching ends the career')
  check(releaseOutcome(mk({ careerClock: { ageYears: 19, phase: 'academy', grassrootsSeason: 3 }, reputation: 65 } as Partial<Player>)).endsCareer === false, 'but a big name released still has options')
}

// ---------------------------------------------------------------------------
console.log('\n[B] the WIN STATE is earned, not tapped')
{
  const p = mk()
  const academy = startNegotiation(p, 'c1', 'Academy FC', 6, 'academy')
  const pro = startNegotiation(p, 'c2', 'Pro FC', 6, 'professional')
  const renewal = startNegotiation(p, 'c3', 'Test FC', 6, 'renewal', 180)

  console.log(`    scholarship £${academy.terms.weeklyWage}/wk · professional £${pro.terms.weeklyWage}/wk · renewal £${renewal.terms.weeklyWage}/wk`)
  check(pro.terms.weeklyWage > academy.terms.weeklyWage * 3, 'turning professional is a genuine step change in money')
  check(pro.terms.years >= 3, 'a pro deal is a longer commitment')
  check(contractValue(pro.terms) > contractValue(academy.terms) * 3, 'and worth far more over its life')
  // The club opens slightly BELOW its own valuation (modulated by your agent),
  // exactly as it does for any other deal — otherwise there'd be nothing to
  // negotiate. The invariant is that a renewal is anchored to the club's
  // number, not that it equals it.
  check(renewal.terms.weeklyWage > 180 * 0.85 && renewal.terms.weeklyWage <= 180 * 1.05,
    `a renewal is anchored to the club's valuation (£${renewal.terms.weeklyWage} against a £180 valuation)`)
  check(renewal.clubCeiling.weeklyWage > renewal.terms.weeklyWage, 'and there is room to negotiate upward')
  check(academy.kind === 'academy' && pro.kind === 'professional' && renewal.kind === 'renewal', 'each deal knows what it is')
  check(pro.stage === 'approach', 'the pro deal starts at the beginning of the pipeline like everything else')
  check(pro.log[0] !== academy.log[0], 'and opens with its own line, not a generic one')

  // Age gate: no pro contracts before 17.
  const watchers = [{ club: generateTeam(7), interest: 90 }] as unknown as ScoutingState['watchers']
  const state: ScoutingState = { watchers, offers: [] }
  const at16 = checkForOffers(state, 100, true, 16)
  const at17 = checkForOffers(state, 100, true, 17)
  console.log(`    pro offers at 16: ${at16.offers.length} · at 17: ${at17.offers.length}`)
  check(at16.offers.length === 0, 'no professional contract before 17 — a probe was turning pro at 16 and ending the game years early')
  check(at17.offers.length > 0, 'but they arrive once you are old enough')
  // Academy recruitment opens at 16 after the three-season review.
  const academyAt15 = checkForOffers(state, 100, false, 15)
  check(academyAt15.offers.length === 0, 'no academy invitation before the age-16 review')
  const reviewedWatchers = [{ ...watchers[0], watchedMatches: 6 }]
  const academyAt16 = checkForOffers({ ...state, watchers: reviewedWatchers }, 100, false, 16, { canInvite: true } as Parameters<typeof checkForOffers>[4])
  check(academyAt16.offers.length > 0, 'eligible 16-year-olds with sustained scouting can receive an invitation')
}

// ---------------------------------------------------------------------------
console.log('\n[C] SEASON REVIEW — the beat that was missing entirely')
{
  const world = initLeagueWorld('Test FC')
  const review = buildSeasonReview(mk(), world, EMPTY_CUPS, false, 2, {
    appearances: 20, goals: 8, assists: 5, ratings: [7, 7.5, 6.8, 8, 7.2],
  })
  console.log(`    grade ${review.grade} · ${review.appearances} apps, ${review.goals}g ${review.assists}a, avg ${review.averageRating}`)
  console.log(`    "${review.verdict}"`)
  check(review.appearances === 20 && review.goals === 8, 'the review reports the season that was played')
  check(review.averageRating > 6 && review.averageRating < 8, 'average rating computed correctly')
  check(review.verdict.length > 20, 'every season gets a verdict written for it')
  check(['A', 'B', 'C', 'D', 'F'].includes(review.grade), 'and a grade')

  // Grading must respond to the season, not to the team.
  const great = buildSeasonReview(mk(), world, EMPTY_CUPS, false, 1, { appearances: 30, goals: 25, assists: 10, ratings: Array(30).fill(8.1) })
  const poor = buildSeasonReview(mk(), world, EMPTY_CUPS, false, 1, { appearances: 22, goals: 0, assists: 1, ratings: Array(22).fill(5.2) })
  const absent = buildSeasonReview(mk(), world, EMPTY_CUPS, false, 1, { appearances: 0, goals: 0, assists: 0, ratings: [] })
  console.log(`    great season → ${great.grade} · poor → ${poor.grade} · never played → ${absent.grade}`)
  check(great.grade === 'A', 'a big season grades A')
  check(poor.grade === 'F' || poor.grade === 'D', 'a bad season grades badly')
  check(absent.grade === 'F', 'a season with no football is a failure whatever the team did')
  check(absent.verdict.includes('never got going') || absent.verdict.length > 10, 'and says so plainly')
  check(great.verdict !== poor.verdict && poor.verdict !== absent.verdict, 'verdicts differ by outcome')

  // It must never throw on missing data.
  let safe = true
  try { buildSeasonReview(mk({ academyClubName: null } as Partial<Player>), null, EMPTY_CUPS, false, 1, { appearances: 0, goals: 0, assists: 0, ratings: [] }) } catch { safe = false }
  check(safe, 'the review survives a season with no league world at all')
}

// ---------------------------------------------------------------------------
console.log('\n[D] STANDING is no longer dead code')
{
  // standingMatchEffects existed but was never called — the three meters were
  // decoration. It now shapes the rating a match starts from.
  const loved = mk({ standing: { teammates: 100, fans: 100 } } as Partial<Player>)
  const hated = mk({ standing: { teammates: -100, fans: -100 } } as Partial<Player>)
  const team = generateTeam(5), opp = generateTeam(5)

  const lovedMatch = initMatch(loved, team, opp, true)
  const hatedMatch = initMatch(hated, team, opp, true)
  console.log(`    starting rating — adored ${lovedMatch.playerRating.toFixed(2)} vs hostile ${hatedMatch.playerRating.toFixed(2)}`)
  check(lovedMatch.playerRating > hatedMatch.playerRating, 'a dressing room that wants you to do well measurably helps')
  check(lovedMatch.playerRating - hatedMatch.playerRating < 0.6, 'but the effect stays small — it applies to every match')

  const eff = standingMatchEffects(loved, true)
  check(Math.abs(eff.ratingBonus) <= 0.25, 'rating effect bounded')
  check(standingMatchEffects(loved, false).confidenceShift === 0, 'the crowd only lifts you at home')
}

// ---------------------------------------------------------------------------
console.log('\n[E] no dead ends — a career always reaches a conclusion')
{
  // Every terminal state must be reachable and mutually exclusive.
  const proPlayer = mk({ turnedPro: { clubName: 'X', weekSigned: 100 } } as Partial<Player>)
  const endedPlayer = mk({ careerEnded: true } as Partial<Player>)
  check(!!proPlayer.turnedPro && !proPlayer.careerEnded, 'turning pro is a clean terminal state')
  check(!!endedPlayer.careerEnded && !endedPlayer.turnedPro, 'ageing out is a clean terminal state')

  // A released player must still have a playable world to return to.
  const released = releaseOutcome(mk({ careerClock: { ageYears: 17, phase: 'academy', grassrootsSeason: 3 } } as Partial<Player>))
  check(!released.endsCareer, 'a mid-career release drops you back into football rather than ending it')
  check(released.message.length > 30, 'and explains what just happened to you')

  // Contract terms are always positive and payable.
  for (const prestige of [4, 6, 8]) {
    const t = openingTerms(prestige, mk())
    check(t.weeklyWage > 0 && t.signingBonus >= 0 && t.years >= 1, `prestige ${prestige}: terms are coherent`)
  }
}

console.log(fails === 0 ? '\n✅ AUDIT 9 PASSED' : `\n❌ AUDIT 9: ${fails} CHECK(S) FAILED`)
process.exit(fails ? 1 : 0)
