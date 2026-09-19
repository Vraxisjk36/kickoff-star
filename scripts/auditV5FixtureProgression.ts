import assert from 'node:assert/strict'
import { createYouthWorld } from '../src/engine/youthWorld'
import { initializeCompetitionWorld, recordLeagueResult, simulateLeagueRound } from '../src/engine/youthCompetitionsV4'
import { emptyStatBook, recordCompetitionStats } from '../src/engine/competitionStatsV4'

const seedWorld=createYouthWorld('fixture-audit',undefined,1,'school','zaf')
const selectedSchool=seedWorld.schools[0].id
let world=initializeCompetitionWorld(createYouthWorld('fixture-audit',selectedSchool,1,'school','zaf'))
const comp=world.competitionWorld.interSchools
const teamId=world.selectedSchoolId!
let state=comp
let book=emptyStatBook(comp.id)
for(let game=0;game<4;game++){
 const fx=state.fixtures.find(f=>!f.played&&(f.homeTeamId===teamId||f.awayTeamId===teamId))
 assert.ok(fx,`game ${game+1} must have a pending player fixture`)
 const home=fx.homeTeamId===teamId
 state=recordLeagueResult(state,fx.id,home?2:1,home?1:2)
 state=simulateLeagueRound(state,`audit|${fx.id}`,teamId)
 book=recordCompetitionStats(book,[{playerId:'user',name:'Audit Player',teamId,position:'ST',started:true,minutes:90,goals:1,assists:game%2,cleanSheet:false,saves:0,tackles:0,keyPasses:1,rating:7.1,potm:false}])
}
const own=state.standings.find(s=>s.teamId===teamId)!
assert.equal(own.played,4,'player team table row must advance after four played matches')
assert.equal(state.fixtures.filter(f=>f.played&&(f.homeTeamId===teamId||f.awayTeamId===teamId)).length,4,'four recent player fixtures must be persisted')
assert.ok(state.standings.every(s=>s.played===4),'the rest of the league round must advance with the player')
assert.equal(book.players.user.apps,4)
assert.equal(book.players.user.goals,4)
assert.equal(book.players.user.assists,2)
console.log('V5 fixture progression PASS', {played:own.played,recent:4,goals:book.players.user.goals,assists:book.players.user.assists})
