import assert from 'node:assert/strict'
import fs from 'node:fs'
import { initSchoolLeagueWorld, initLeagueWorld, recordPlayerMatchResult, batchSimDivisionRound } from '../src/engine/league'
import { activeCompetitionForWeek, SCHOOL_SEASON_SCHEDULE, SUNDAY_SEASON_SCHEDULE } from '../src/engine/calendar'

let n=0
const ok=(v:unknown,m:string)=>{assert.ok(v,m);n++;console.log('✓',m)}
const school=initSchoolLeagueWorld('Audit High')
const grass=initLeagueWorld('Audit Athletic')
const sd=school.divisions[school.playerDivision]
const gd=grass.divisions[grass.playerDivision]
ok(sd.teams.length===10,'School authority has exactly 10 teams')
ok(sd.fixtures.filter(f=>f.homeTeamId===school.playerTeamId||f.awayTeamId===school.playerTeamId).length===18,'School player team has exactly 18 H/A league fixtures')
ok(gd.teams.length===12,'Grassroots authority has exactly 12 teams')
ok(gd.fixtures.filter(f=>f.homeTeamId===grass.playerTeamId||f.awayTeamId===grass.playerTeamId).length===22,'Grassroots player team has exactly 22 H/A league fixtures')
ok(SCHOOL_SEASON_SCHEDULE.schoolLeague.length===18,'School calendar exposes 18 league rounds')
ok(SUNDAY_SEASON_SCHEDULE.schoolLeague.length===22,'Grassroots calendar exposes 22 league rounds through V4 adapter')
ok(activeCompetitionForWeek(3,'grassroots-season','school')?.competitionId==='schoolLeague','School weekly loop resolves to schoolLeague')
ok(activeCompetitionForWeek(1,'grassroots-season','sunday')?.competitionId==='sundayLeague','Grassroots weekly loop resolves to sundayLeague')

const fx=sd.fixtures.find(f=>f.homeTeamId===school.playerTeamId||f.awayTeamId===school.playerTeamId)!
const home=fx.homeTeamId===school.playerTeamId
let played=recordPlayerMatchResult(school,home?fx.awayTeamId:fx.homeTeamId,2,1,home,1)
let div=played.divisions[played.playerDivision]
ok(div.fixtures.find(f=>f.id===fx.id)?.played===true,'played result marks the authoritative fixture')
ok(div.standings.find(s=>s.teamId===school.playerTeamId)?.played===1,'played result updates the same authoritative table')
div=batchSimDivisionRound(div,fx.week,school.playerTeamId,false)
const round=div.fixtures.filter(f=>f.week===fx.week)
ok(round.every(f=>f.played),'NPC fixtures in the same round simulate into the same fixture list')
ok(div.standings.reduce((a,s)=>a+s.played,0)===round.length*2,'NPC results update the same authoritative standings')
const leagueTab=fs.readFileSync('src/screens/tabs/LeagueTab.tsx','utf8')
const calendar=fs.readFileSync('src/engine/calendar.ts','utf8')
ok(!leagueTab.includes("setCompetition")&&!leagueTab.includes("player?.sundayLeague"),'League UI cannot switch to a parallel youth league')
ok(!calendar.includes("title:'Sunday league fixture'"),'School calendar no longer injects parallel Sunday fixtures')
console.log('\nBatch 3 competition-authority audit:',n,'checks passed')
