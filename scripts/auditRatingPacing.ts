import assert from 'node:assert/strict'
import { emptyMatchStats } from '../src/engine/matchStats'
import { calculatePlayerRating } from '../src/engine/ratingSystemV32'
import { matchXpEarned, trainingXpForDrill, spendXp } from '../src/engine/xp'

const quiet = calculatePlayerRating({position:'ST',stats:emptyMatchStats(),decisionQuality:.62,executionQuality:.60,ratedMoments:4,minutes:90})
assert.equal(quiet.total,6,'neutral full match stays neutral')
const cameoStats={...emptyMatchStats(),goals:1,assists:1,shotsOnTarget:1,keyPasses:1}
const cameo=calculatePlayerRating({position:'ST',stats:cameoStats,decisionQuality:.84,executionQuality:.78,ratedMoments:2,minutes:25})
assert.ok(cameo.total>=7.5,`goal and assist off the bench deserves a strong score: ${cameo.total}`)
const hatStats={...emptyMatchStats(),goals:3,shotsOnTarget:4,keyPasses:2}
const hat=calculatePlayerRating({position:'ST',stats:hatStats,decisionQuality:.88,executionQuality:.85,ratedMoments:5,minutes:90})
assert.equal(hat.total,10,'excellent hat-trick can reach a 10')
const ordinaryHat=calculatePlayerRating({position:'ST',stats:hatStats,decisionQuality:.62,executionQuality:.60,ratedMoments:4,minutes:90})
assert.ok(ordinaryHat.total>=9 && ordinaryHat.total<10,`hat-trick earns a 9+ without an automatic 10: ${ordinaryHat.total}`)

// One school training session per week (three good drills) and 15 solid
// matches over the opening 19 weeks, spread across twelve outfield skills.
// This is an XP budget check, independent of the calendar's fixture mix.
const skills=Array(12).fill(3)
for(let week=0;week<19;week++){
  const training=3*trainingXpForDrill('good')+(week%5===4?50:0)
  const match=week<15?matchXpEarned('grassroots',7.5,week===7||week===13?1:0,0):0
  const perSkill=(training+match)/skills.length
  for(let i=0;i<skills.length;i++)skills[i]=spendXp(skills[i],perSkill,19).newLevel
}
const ovrGain=(skills.reduce((sum,x)=>sum+x,0)/12-3)*79/20
assert.ok(ovrGain<5,`nineteen weeks should not gain five OVR under regular play: +${ovrGain.toFixed(1)}`)
assert.ok(matchXpEarned('grassroots',8.5,3,0)<500,'a hat-trick cannot flood the early XP pool')
console.log(`Rating and XP pacing passed: cameo ${cameo.total}, hat-trick ${ordinaryHat.total}/${hat.total}, opening 19 weeks +${ovrGain.toFixed(1)} OVR`)
