import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createYouthWorld } from '../src/engine/youthWorld'
import { initializeCompetitionWorld } from '../src/engine/youthCompetitionsV4'

const england=initializeCompetitionWorld(createYouthWorld('visual-audit',null,1,'school','eng'))
const southAfrica=initializeCompetitionWorld(createYouthWorld('visual-audit',null,1,'school','rsa'))

// Country choice must materially change the football world, not just a flag.
const engSchools=england.schools.slice(0,10).map(s=>s.name)
const rsaSchools=southAfrica.schools.slice(0,10).map(s=>s.name)
assert.notDeepEqual(rsaSchools,engSchools,'RSA and England generated the same schools')
assert(!rsaSchools.some(n=>/Westview|Greenwood|Riverside/.test(n)),'RSA career leaked England starter schools')
assert.notDeepEqual(southAfrica.sundayClubs.slice(0,12).map(c=>c.name),england.sundayClubs.slice(0,12).map(c=>c.name),'grassroots clubs are cloned across countries')

// The actual league must be built from that country's local world.
const rsaLeague=southAfrica.competitionWorld.interSchools!
const engLeague=england.competitionWorld.interSchools!
assert.equal(rsaLeague.teams.length,10)
assert.equal(rsaLeague.fixtures.filter(f=>f.homeTeamId===rsaLeague.teams[0].id||f.awayTeamId===rsaLeague.teams[0].id).length,18)
assert.notDeepEqual(rsaLeague.teams.map(t=>t.name),engLeague.teams.map(t=>t.name),'RSA league opponents cloned England')
assert(rsaLeague.teams.every(t=>rsaSchools.includes(t.name)),'RSA league contains a non-RSA local school')

// Youth balance: no school should present as a senior/pro-level 65-80 OVR side.
const ratings=southAfrica.schools.map(s=>s.footballRating)
assert(Math.max(...ratings)<=58,'school OVR exceeded youth ceiling')
assert(Math.min(...ratings)>=36,'school OVR fell below youth floor')
const squad=Object.values(southAfrica.schoolSquads).flatMap(s=>s.firstTeam)
assert(Math.max(...squad.map(p=>p.overall))<=66,'age-14/15 school player exceeded youth ceiling')

// Player-facing ownership: Club owns teammates, League owns league-wide data.
const club=fs.readFileSync('src/screens/tabs/ClubTab.tsx','utf8')
const league=fs.readFileSync('src/screens/tabs/YouthLeagueTab.tsx','utf8')
assert(club.includes('schoolSquads')&&club.includes('teammates'),'Club no longer exposes persistent teammates')
assert(!club.toLowerCase().includes('top scorers'),'league-wide scorers leaked into Club')
assert(league.includes('competition leaders'),'League lost competition-wide leaders')

// Selection screen must use the generated live world, never a static three-school constant.
const store=fs.readFileSync('src/store/careerStore.ts','utf8')
assert(store.includes("createYouthWorld(player.id, cleanPlayer.schoolId, 1, route, player.nationality??'eng')"),'pathway selection drops nationality and rebuilds the wrong country world')

const schoolScreen=fs.readFileSync('src/screens/SchoolSelection.tsx','utf8')
assert(schoolScreen.includes('world?.schools'),'School selection is not driven by live Youth World')
assert(!schoolScreen.includes('SCHOOLS.map'),'School selection regressed to static starter schools')

console.log('V5 behavioral player-world audit passed',{
 rsaSchools:rsaSchools.slice(0,3),
 rsaLeague:rsaLeague.teams.slice(0,3).map(t=>t.name),
 schoolRatingRange:[Math.min(...ratings),Math.max(...ratings)],
 teammates:southAfrica.schoolSquads[southAfrica.schools[0].id].firstTeam.length,
})
