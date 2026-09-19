import assert from 'node:assert/strict'
import { SCHOOL_V5_BLOCKS, GRASSROOTS_V5_BLOCKS, V4_DEFAULT_MATCH_MINUTES, FESTIVAL_MATCH_MINUTES, V4_SEASON_WEEKS, block } from '../src/engine/v5SeasonPlan'

let checks=0
const ok=(v:unknown,msg:string)=>{assert.ok(v,msg);checks++;console.log('✓',msg)}
ok(V4_SEASON_WEEKS===44,'V4 44-week season is preserved')
ok(V4_DEFAULT_MATCH_MINUTES===90,'V4 full matches remain 90 minutes')
for(const route of ['school','grassroots'] as const){
  const blocks=route==='school'?SCHOOL_V5_BLOCKS:GRASSROOTS_V5_BLOCKS
  ok(blocks.every(b=>b.weeks.every(w=>w>=1&&w<=44)),route+' blocks stay inside V4 season')
  ok(block(route,'trials')?.weeks.length===3,route+' opens with three trial weeks')
  ok(block(route,'friendly')?.matches===2,route+' has two preseason friendlies')
  ok(block(route,'october')?.weeks.length===5&&block(route,'october')?.matches===4,route+' October group has five rounds, four matches and one bye')
}
ok(block('school','league')?.matches===18,'school local league has 18 matches')
ok(block('school','development')?.matches===5,'eliminated/non-qualified schools still get five development matches')
ok(block('school','cup')?.matches===5,'Regional Cup guarantees five group matches before knockouts')
ok(block('grassroots','league')?.matches===22,'grassroots league has 22 matches')
ok(block('grassroots','cup')?.matches===5,'grassroots cup has five scheduled rounds')
ok(block('grassroots','festival')?.matches===3,'grassroots festival has three matchdays')
ok(block('grassroots','festival')?.matchMinutes===FESTIVAL_MATCH_MINUTES&&FESTIVAL_MATCH_MINUTES===40,'festival matches are 40 minutes while V4 matches stay 90')
console.log('\nV4→V5 foundation audit:',checks,'checks passed')
