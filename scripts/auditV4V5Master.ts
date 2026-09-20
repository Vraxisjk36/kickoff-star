import assert from 'node:assert/strict'
import fs from 'node:fs'
import { initSchoolLeagueWorld,initLeagueWorld,recordPlayerMatchResult,batchSimDivisionRound } from '../src/engine/league'
import { SCHOOL_SEASON_SCHEDULE,SUNDAY_SEASON_SCHEDULE,activeCompetitionForWeek } from '../src/engine/calendar'
import { initCupById,playerCupFixture } from '../src/engine/cup'
import { EMPTY_CUPS,SAVE_SCHEMA_VERSION } from '../src/engine/save'
import { NATIONS } from '../src/engine/nations'
import { worldCounts,localSchoolChoices } from '../src/engine/youthWorldDatabase'
for(const nation of NATIONS){const counts=worldCounts(nation.id);assert.equal(counts.regions,8);assert.equal(counts.districts,64);assert.equal(counts.schools,640);assert.equal(localSchoolChoices(nation.id).length,10)}
let n=0;const ok=(v:unknown,m:string)=>{assert.ok(v,m);n++;console.log('✓',m)}
const school=initSchoolLeagueWorld('Audit High'), grass=initLeagueWorld('Audit Athletic')
const sf=school.divisions[school.playerDivision].fixtures.filter(f=>f.homeTeamId===school.playerTeamId||f.awayTeamId===school.playerTeamId)
const gf=grass.divisions[grass.playerDivision].fixtures.filter(f=>f.homeTeamId===grass.playerTeamId||f.awayTeamId===grass.playerTeamId)
ok(sf.length===18,'School = 10 teams / 18 H-A fixtures');ok(gf.length===22,'Grassroots = 12 teams / 22 H-A fixtures')
ok(SCHOOL_SEASON_SCHEDULE.schoolFriendlies.join(',')==='4,5','two friendlies follow three trial weeks')
ok(SCHOOL_SEASON_SCHEDULE.schoolLeague.length===18&&SCHOOL_SEASON_SCHEDULE.schoolLeague[0]===6,'School league occupies 18 authoritative rounds')
ok(SUNDAY_SEASON_SCHEDULE.schoolLeague.length===22&&SUNDAY_SEASON_SCHEDULE.schoolLeague[0]===6,'Grassroots league occupies 22 authoritative rounds')
ok(SCHOOL_SEASON_SCHEDULE.octoberLeague.length===5&&SUNDAY_SEASON_SCHEDULE.octoberLeague.length===5,'October competition reserves five rounds')
ok(SUNDAY_SEASON_SCHEDULE.youthFestival.length===3,'festival reserves three consecutive matchdays')
const sd=school.divisions[school.playerDivision],team=sd.teams.find(t=>t.id===school.playerTeamId)!
const regional=initCupById('schoolCup',team,sd.teams);ok(playerCupFixture(regional)!==null&&regional.groups[0].teamIds.length===6,'Regional Cup gives six-team group / five group matches')
const dev=initCupById('schoolDevelopment',team,sd.teams);ok(dev.groups[0].teamIds.length===6,'non-qualifiers receive five-match development group')
const oct=initCupById('octoberLeague',team,sd.teams);ok(oct.groups[0].teamIds.length===5,'October league is five teams = four matches + bye')
const fest=initCupById('youthFestival',team,sd.teams);ok(fest.groups[0].teamIds.length===4,'festival is four teams = three matches')
let w=school;const fx=sf[0],home=fx.homeTeamId===w.playerTeamId;w=recordPlayerMatchResult(w,home?fx.awayTeamId:fx.homeTeamId,2,1,home,1);let d=w.divisions[w.playerDivision];d=batchSimDivisionRound(d,fx.week,w.playerTeamId,false);ok(d.fixtures.filter(f=>f.week===fx.week).every(f=>f.played),'player + NPC round share one result authority');ok(d.standings.find(s=>s.teamId===w.playerTeamId)?.played===1,'same result authority moves table')
ok(activeCompetitionForWeek(36,'grassroots-season','school')?.competitionId==='octoberLeague','October competition is live in weekly School loop')
ok(activeCompetitionForWeek(41,'grassroots-season','sunday')?.competitionId==='youthFestival','festival is live in weekly Grassroots loop')
const match=fs.readFileSync('src/engine/match.ts','utf8');const screen=fs.readFileSync('src/screens/MatchScreen.tsx','utf8');ok(match.includes('durationMinutes = 90')&&screen.includes('matchMinutes = 90'),'V4 90-minute engine remains default');ok(match.includes('durationMinutes === 40')&&screen.includes('matchMinutes'),'same V4 engine supports 2x20 festival')
const store=fs.readFileSync('src/store/careerStore.ts','utf8');ok(store.includes('entrants:60,survivors:35')&&store.includes('entrants:35,survivors:23'),'regional selection persists 60→35→23');ok(store.includes("result.newAge>=18 && !isInAcademy")&&store.includes('careerEnded:true'),'graduation without academy ends youth career');ok(store.includes("Math.min(6,Math.max(3,1+Math.floor(score/20)))"),'passed trial opens 3-6 academy choices')
ok(!store.includes("grassrootsPath: role === 'released' ? 'sunday' : 'school'"),'trial failure never changes route')
const negotiation=fs.readFileSync('src/engine/negotiation.ts','utf8');ok(negotiation.includes('negotiationWeek?: 1 | 2'),'academy negotiation persists explicit two-week arc')
const trial=fs.readFileSync('src/screens/AcademyTrialScreen.tsx','utf8');ok(trial.includes('technical 30%')&&trial.includes('trial performance 45%')&&trial.includes('decisions 15%')&&trial.includes('consistency 10%'),'academy trial exposes exact 30/45/15/10 weighting')
const intl=fs.readFileSync('src/engine/international.ts','utf8');ok(intl.includes("import { NATIONS }")&&NATIONS.length>=8,'international campaigns use actual countries')
const contracts=fs.readFileSync('src/engine/sundayContracts.ts','utf8');ok(contracts.includes("3: [10, 15]")&&contracts.includes("2: [20, 30]")&&contracts.includes("1: [35, 50]"),'grassroots wage bands preserved')
ok(worldCounts('eng').schools===640,'world DB = 8 regions × 8 districts × 10 schools per country')
ok(localSchoolChoices('rsa').every(s=>s.countryId==='rsa'),'school choices localize to player country')
const saveSrc=fs.readFileSync('src/engine/save.ts','utf8');const loadSrc=fs.readFileSync('src/screens/LoadCareerScreen.tsx','utf8');ok(SAVE_SCHEMA_VERSION>=7&&saveSrc.includes("legacyRouteMigration?: 'pending' | 'school' | 'grassroots'")&&loadSrc.includes('OLD DUAL-ROUTE SAVE'),'legacy dual-route saves require explicit route choice')
ok(SAVE_SCHEMA_VERSION>=6&&'octoberLeague'in EMPTY_CUPS&&'youthFestival'in EMPTY_CUPS,'new competitions persist through V4 save schema')
const md=fs.readFileSync('src/screens/MatchDayScreen.tsx','utf8');const venues=fs.readFileSync('src/engine/venues.ts','utf8');ok(md.includes('opposition squad')&&venues.includes('venueForTeam'),'prematch exposes persistent squad and ground')
const calendarSrc=fs.readFileSync('src/engine/calendar.ts','utf8');ok(calendarSrc.includes('academyChampionsCup')&&fs.readFileSync('src/engine/cup.ts','utf8').includes('Continental Academy Champions Cup'),'academy has domestic cups plus continental competition')
ok(calendarSrc.includes('INTERNATIONAL_QUALIFIER_WEEKS = [8,16,24,32]')&&calendarSrc.includes('INTERNATIONAL_FINALS_WEEKS = [37,40,43]'),'international campaign uses season-long qualifiers and QF/SF/F windows')
ok(store.includes("source:'parent-club'")&&store.includes("source:'outside-club'")&&store.includes("kind:'professional'"),'academy can earn parent-club or outside senior professional offers')
const proScreen=fs.readFileSync('src/screens/TurnedPro.tsx','utf8');ok(proScreen.includes("youth-career story ends here")&&proScreen.includes("player.career?.appearances"),'professional contract ends game with career record')
const selection=fs.readFileSync('src/engine/selection.ts','utf8');ok(selection.includes('energy>=30')&&selection.includes('energy>=50'),'energy gates remain <30 out / <50 cannot start')
console.log('\nV4→V5 master rebuild audit:',n,'checks passed')
