import { readFileSync } from 'fs'
import { competitionDefinition, initCompetitionCareer, recordCompetitionMatch } from '../src/engine/competitionCareer'
import { formatMoney } from '../src/engine/economy'
import { addStoryMoment, createStoryMoment } from '../src/engine/presentation'
import { initYouthFinance, postTransaction } from '../src/engine/youthFinances'
import { emptyMatchStats } from '../src/engine/matchStats'
import { calculatePlayerRating } from '../src/engine/ratingSystemV32'
import { activeCompetitionForWeek, alignOctoberDevelopment, generateWeek, OCTOBER_DEVELOPMENT_TITLE, SEASON_SCHEDULE, SUNDAY_SEASON_SCHEDULE, ACADEMY_SEASON_SCHEDULE } from '../src/engine/calendar'
import { initLeagueWorld, initSchoolLeagueWorld, migrateToSchoolLeagueWorld, resetSchoolLeagueSeason } from '../src/engine/league'
import { initCupById, playerCupFixture } from '../src/engine/cup'

let failures = 0
const check = (condition: boolean, message: string) => {
  if (condition) console.log('  ✓', message)
  else { failures += 1; console.error('  ✗', message) }
}

console.log('\n[A] V4 competition and finance truth survives the V3.2 integration')
let career = initCompetitionCareer()
career = recordCompetitionMatch(career, { competitionId: 'schoolCup', season: 2027, started: true, minutes: 90, rating: 8.4, goals: 2, assists: 1, cleanSheet: false, playerOfMatch: true })
check(career.current.schoolCup.goals === 2 && career.current.schoolCup.averageRating === 8.4, 'competition-specific stats remain exact')
check(competitionDefinition('academyLeague').prestige > competitionDefinition('sundayLeague').prestige, 'academy and Sunday league prestige remain distinct')
check(competitionDefinition('schoolLeague').category === 'school', 'school league has its own competition identity')
let finances = initYouthFinance('grassroots-season')
finances = postTransaction(finances, 'grassroots-season', { week: 1, amount: 10, category: 'allowance', description: 'Allowance', coveredBy: 'family' })
check(finances.currency === 'GBP' && finances.transactions.length === 1 && formatMoney(10) === '£10', 'GBP ledger and visible pound formatting agree')

console.log('\n[B] V4 story moments remain durable and deduplicated')
const reveal = createStoryMoment({ kind: 'qualification', eyebrow: 'School Cup', title: 'QUALIFIED', body: 'Into the next round.', week: 10, season: 2027 })
const inbox = addStoryMoment(addStoryMoment([], reveal), createStoryMoment({ kind: 'qualification', eyebrow: 'School Cup', title: 'QUALIFIED', body: 'Duplicate.', week: 10, season: 2027 }))
check(inbox.length === 1 && !inbox[0].read, 'one real event produces one persistent unread reveal')

console.log('\n[C] the V3.2 match rating is transparent and reproducible')
const stats = emptyMatchStats()
Object.assign(stats, { goals: 1, assists: 1, shots: 3, shotsOnTarget: 2, keyPasses: 3, passesAttempted: 32, passesCompleted: 27 })
const rating = calculatePlayerRating({ position: 'CM', stats, decisionQuality: .82, executionQuality: .78, ratedMoments: 5, minutes: 90 })
const reconstructed = rating.base + rating.decisions + rating.execution + rating.attacking + rating.defending + rating.background + rating.cleanSheet + rating.exceptional + rating.discipline
check(Math.abs(Number(reconstructed.toFixed(1)) - rating.total) < .01, 'displayed rating rows reconstruct the final rating')
check(rating.attacking > 0 && rating.decisions > 0 && rating.execution > 0, 'goals, decisions, and execution contribute independently')

console.log('\n[D] the unified player-facing routes are wired')
const weekly = readFileSync('src/screens/WeeklyHub.tsx', 'utf8')
const home = readFileSync('src/screens/tabs/HomeTab.tsx', 'utf8')
const league = readFileSync('src/screens/tabs/LeagueTab.tsx', 'utf8')
const summary = readFileSync('src/screens/MatchSummary.tsx', 'utf8')
const match = readFileSync('src/engine/match.ts', 'utf8')
const store = readFileSync('src/store/careerStore.ts', 'utf8')
check(weekly.includes('InboxScreen') && weekly.includes('CaptaincyStoryCard') && home.includes('Career inbox'), 'V4 inbox coexists with V3.2 captaincy presentation')
check(league.includes('CompetitionHub'), 'competition hub is reachable from the live career')
check(summary.includes('how your rating was earned') && summary.includes('ratingBreakdown.base'), 'post-match screen exposes baseline and exact rating contributions')
check(match.includes('decisionQualityTotal: carded.decisionQualityTotal + decisionQuality'), 'multi-step scenarios enter the rating ledger')
for (const kind of ['selection', 'squad', 'qualification', 'elimination', 'champion', 'invitation', 'promotion', 'relegation']) {
  check(store.includes(`kind: '${kind}'`), `${kind} reveal is driven by career state`)
}

console.log('\n[E] school football and Sunday football are separate career paths')
const schoolWorld = initSchoolLeagueWorld('Greenwood High')
const schoolDivision = schoolWorld.divisions[schoolWorld.playerDivision]
const schoolTeam = schoolDivision.teams.find((team) => team.id === schoolWorld.playerTeamId)
check(schoolWorld.kind === 'school' && schoolTeam?.name === 'Greenwood High', 'selected player represents the chosen school')
check(schoolDivision.teams.length === 10 && schoolDivision.fixtures.filter((fixture) => fixture.homeTeamId === schoolWorld.playerTeamId || fixture.awayTeamId === schoolWorld.playerTeamId).length === 18, 'local school league is a ten-school home-and-away competition')
check(schoolDivision.teams.every((team) => /(High|School|Secondary|Academy|College)/.test(team.name)), 'school league contains school opponents, not Sunday clubs')
check(new Set(Object.values(schoolWorld.divisions).flatMap((division) => division.teams.map((team) => team.name))).size === 30, 'school identities are unique across all districts')
const leagueWeek = SEASON_SCHEDULE.schoolLeague[0]
check(activeCompetitionForWeek(leagueWeek, 'grassroots-season', 'school')?.competitionId === 'schoolLeague', 'selected route schedules the school league')
check(activeCompetitionForWeek(leagueWeek, 'grassroots-season', 'sunday')?.competitionId === 'sundayLeague', 'released route schedules Sunday League instead')
check(SUNDAY_SEASON_SCHEDULE.sundayCup.every((week, i) => activeCompetitionForWeek(week, 'grassroots-season', 'sunday')?.competitionId === 'sundayCup' && activeCompetitionForWeek(week, 'grassroots-season', 'sunday')?.round === i + 1), 'all four Sunday Cup rounds have playable matchdays')
check(SUNDAY_SEASON_SCHEDULE.sundayCup.every(week => !SUNDAY_SEASON_SCHEDULE.schoolLeague.includes(week)), 'Sunday Cup never collides with the Sunday League')
const excludedCup = initCupById('schoolCup', schoolDivision.teams.find(team => team.id === schoolWorld.playerTeamId)!, schoolDivision.teams)
check(playerCupFixture({ ...excludedCup, playerEliminated: true }) === null, 'development route cannot re-enter Regional Cup group fixtures')
check(ACADEMY_SEASON_SCHEDULE.academyLeagueCup.every(week => activeCompetitionForWeek(week, 'academy')?.competitionId === 'academyLeagueCup') && ACADEMY_SEASON_SCHEDULE.academyKnockoutCup.every(week => activeCompetitionForWeek(week, 'academy')?.competitionId === 'academyKnockoutCup'), 'academy cup rounds also remain reachable')
check(ACADEMY_SEASON_SCHEDULE.academyChampionsCup.every((week, index) => activeCompetitionForWeek(week, 'academy')?.competitionId === 'academyChampionsCup' && activeCompetitionForWeek(week, 'academy')?.round === index + 1), 'three continental academy rounds have their own matchdays')
for (let week = 24; week <= 28; week++) {
  check(activeCompetitionForWeek(week, 'grassroots-season', 'school', true)?.competitionId === 'schoolDevelopment', `development route plays week ${week}`)
  check(activeCompetitionForWeek(week, 'grassroots-season', 'school')?.competitionId === 'schoolCup', `qualified route plays Regional Cup week ${week}`)
}
for (const path of ['school', 'sunday'] as const) {
  for (const week of [36, 37, 38, 39]) {
    const base = { currentWeek: generateWeek(week, 1, 'grassroots-season', false, path), history: [] }
    const aligned = alignOctoberDevelopment(base, 15, 'grassroots-season', path, false)
    const fixtures = aligned.currentWeek.events.filter(e => e.title === OCTOBER_DEVELOPMENT_TITLE)
    check(fixtures.length === 1 && fixtures[0].day === (path === 'school' ? 'sat' : 'sun'), `${path} week ${week} has one October match`)
    check(alignOctoberDevelopment(aligned, 15, 'grassroots-season', path, false).currentWeek.events.filter(e => e.title === OCTOBER_DEVELOPMENT_TITLE).length === 1, 'loading an October week never duplicates its fixture')
    check(aligned.currentWeek.events.filter(e => e.day === fixtures[0].day).length === 1, 'October match replaces same-day rest or unavailable showcase')
    if (week === 37 && path === 'school' || week === 38 && path === 'sunday') check(!aligned.currentWeek.events.some(e => e.title === 'matchday'), 'under-16 showcase slot is removed')
  }
}
check(!alignOctoberDevelopment({ currentWeek: generateWeek(36, 1), history: [] }, 16, 'grassroots-season', 'school', false).currentWeek.events.some(e => e.title === OCTOBER_DEVELOPMENT_TITLE), 'age 16 does not enter the under-16 October series')
const legacy = initLeagueWorld('Greenwood High')
legacy.divisions[legacy.playerDivision].standings[0].points = 7
const migrated = migrateToSchoolLeagueWorld(legacy, 'Greenwood High')
check(migrated.kind === 'school' && migrated.divisions[migrated.playerDivision].standings[0].points === 7, 'legacy careers migrate without losing table progress')
check(migrated.divisions[migrated.playerDivision].teams.find((team) => team.id === migrated.playerTeamId)?.name === 'Greenwood High', 'legacy player team keeps the chosen school identity')
schoolWorld.divisions[schoolWorld.playerDivision].standings[0].points = 9
const nextSchoolSeason = resetSchoolLeagueSeason(schoolWorld)
check(nextSchoolSeason.divisions[nextSchoolSeason.playerDivision].standings.every((standing) => standing.points === 0) && nextSchoolSeason.divisions[nextSchoolSeason.playerDivision].fixtures.length === 90, 'school league resets cleanly for the next 18-match season')

console.log(failures ? `\n❌ V4 INTEGRATION AUDIT: ${failures} FAILURE(S)` : '\n✅ V4 INTEGRATION AUDIT PASSED')
process.exit(failures ? 1 : 0)
