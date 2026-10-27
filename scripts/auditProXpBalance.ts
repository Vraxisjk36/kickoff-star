import assert from 'node:assert/strict'
import { matchXpEarned, spendXp, positionCostMultiplier } from '../src/engine/xp'
for (const position of ['ST','GK']) {
 const mult=positionCostMultiplier(position==='GK')
 const attrs=Array(position==='GK'?4:12).fill(10)
 let pool=0,earnedTotal=0
 for(let season=0;season<18;season++) {
  for(let match=0;match<40;match++) {
   const earned=matchXpEarned(match%8===0?'international':match%5===0?'cup':'grassroots',season<3?6.7:season<8?7.6:8.5,0,0)
   pool+=earned;earnedTotal+=earned
   const index=match%attrs.length
   const spent=spendXp(attrs[index],pool/mult,19)
   attrs[index]=spent.newLevel
   pool-=spent.xpUsed*mult
   assert.ok(pool>=-0.01,'negative XP pool')
  }
 }
 assert.ok(attrs.every(v=>v<=19))
 console.log('PRO_XP_18_SEASONS',JSON.stringify({position,levels:attrs,earnedTotal,remainingXp:pool}))
}
