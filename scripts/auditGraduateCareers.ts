import assert from 'node:assert/strict'
import { seniorTrialOffers } from '../src/engine/proTrialOffers'
import { seniorTrialPoints } from '../src/engine/proCareer'

// Deterministic multi-career scouting simulations: low, average, strong and
// standout graduates, across different career identities and trial outcomes.
let simulated=0
const distinct=new Set<string>()
for (const ability of [48,52,56,60,64,68]) {
  for (const points of [0,2,4,6,8,9]) {
    for (let career=0;career<8;career++) {
      const id='career-'+career+'-'+ability+'-'+points
      const offers=seniorTrialOffers(points,ability,id)
      assert.equal(offers.length,4,`Four offers required: ${id}`)
      assert.equal(new Set(offers.map(o=>o.id)).size,4,`Duplicate club: ${id}`)
      assert.ok(offers.every(o=>o.overall<80),`Elite club offered: ${id}`)
      assert.ok(offers.every(o=>o.overall<= (points>=7&&ability>=57?Math.min(79,ability+14):Math.min(76,ability+10))),`Unrealistic offer: ${id}`)
      assert.deepEqual(seniorTrialOffers(points,ability,id),offers,`Unstable scouting: ${id}`)
      distinct.add(offers.map(o=>o.id).join('|'))
      simulated++
    }
  }
}
assert.ok(distinct.size>8,'Different careers should receive varied offers')
assert.ok(seniorTrialPoints(.8,60)>=seniorTrialPoints(.3,60))
console.log(`Graduate scouting simulation: ${simulated} careers, ${distinct.size} unique offer combinations`)
