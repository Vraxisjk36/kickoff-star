import assert from 'node:assert/strict'
import fs from 'node:fs'

const player=fs.readFileSync('src/types/player.ts','utf8')
const store=fs.readFileSync('src/store/careerStore.ts','utf8')
const app=fs.readFileSync('src/App.tsx','utf8')
const trials=fs.readFileSync('src/screens/TrialsScreen.tsx','utf8')
const league=fs.readFileSync('src/engine/league.ts','utf8')
const calendar=fs.readFileSync('src/engine/calendar.ts','utf8')
let n=0
const ok=(v:unknown,m:string)=>{assert.ok(v,m);n++;console.log('✓',m)}

ok(player.includes("youthRoute?: 'school' | 'grassroots'"),'player has one explicit youth-route source of truth')
ok(app.includes("<RouteSelection")&&app.includes("<GrassrootsSelection")&&app.includes("<SchoolSelection"),'onboarding offers both routes before trials')
ok(store.includes("setYouthRoute: (route: 'school' | 'grassroots')"),'store owns route selection')
ok(store.includes("setGrassrootsClub: (clubId: string, clubName: string)"),'grassroots club identity persists in V4 player state')
ok(store.includes("player.youthRoute === 'grassroots' ? 'sunday' : 'school'"),'legacy V4 grassrootsPath is retained only as route adapter')
ok(!store.includes("grassrootsPath: role === 'released' ? 'sunday' : 'school'"),'trial failure no longer silently changes route')
ok(trials.includes("route?: 'school' | 'grassroots'"),'the proven V4 three-week trial UI is reused by both routes')
ok(league.includes('initSchoolLeagueWorld')&&league.includes('initLeagueWorld'), 'both routes reuse V4 league authority')
ok(league.includes('generateFixtures(teams, 2)'), 'V4 home-and-away fixture generation is preserved')
ok(calendar.includes('SEASON_WEEKS = 44'),'V4 44-week weekly loop is preserved')
ok(store.includes('recordPlayerMatchResult')&&store.includes('batchSimDivisionRound'),'V4 result/table simulation pipeline remains in careerStore')
ok(store.includes('seasonGoals: (player.seasonGoals ?? 0) + goals')&&store.includes('seasonAssists: (player.seasonAssists ?? 0) + assists'),'V4 player goal/assist accounting remains intact')
console.log('\nBatch 2 route-separation audit:',n,'checks passed')
