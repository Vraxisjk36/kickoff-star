import assert from 'node:assert/strict'
import { createYouthWorld, calendarBlockForWeek } from '../src/engine/youthWorld'
import {
  applyTrialOutcome, evaluateRegionalSelection, generateSundayApproaches,
  pathwayOptions, recordYouthPerformance, reviewSchoolPath,
} from '../src/engine/youthPathways'

const seedWorld = createYouthWorld('audit-career', null, 1, 'school', 'eng')
const selectedId = seedWorld.schools[1].id
const base = createYouthWorld('audit-career', selectedId, 1, 'school', 'eng')

assert.equal(base.schools.length, 640)
assert.equal(new Set(base.schools.map(s => s.id)).size, 640)
assert.equal(base.sundayClubs.length, 16)
assert(base.schools.some(s => s.id === selectedId))
assert.equal(base.selectedSchoolId, selectedId)
assert.equal(new Set(base.schools.map(s=>s.districtId)).size, 8)
for (const district of new Set(base.schools.map(s=>s.districtId))) assert.equal(base.schools.filter(s=>s.districtId===district).length,80)
const rsa = createYouthWorld('audit-career', null, 1, 'school', 'rsa')
assert.notDeepEqual(rsa.schools.slice(0,10).map(s=>s.name),base.schools.slice(0,10).map(s=>s.name))

for (const school of base.schools) {
  const squads = base.schoolSquads[school.id]
  assert(squads)
  assert.equal(squads.firstTeam.length, 20)
  assert.equal(squads.reserve.length, 18)
  assert.equal(squads.development.length, 14)
  assert(school.rivalId)
  assert(base.schools.some(s => s.id === school.rivalId))
}

// Calendar must cover every game week exactly once.
for (let week = 1; week <= 48; week++) {
  const hits = base.calendar.filter(b => week >= b.weeks[0] && week <= b.weeks[1])
  assert.equal(hits.length, 1, `week ${week} must have exactly one calendar block`)
  assert(calendarBlockForWeek(base, week))
}

// Every trial band has a live next route. Nobody can fall into a dead career.
const bands = [0.82, 0.53, 0.42, 0.29, 0.15, 0.03]
const outcomes = bands.map(p => applyTrialOutcome(base, p).world)
assert.deepEqual(outcomes.map(w => w.pathway.schoolTier), ['first-team','first-team','first-team','reserve','development','cut'])
for (const world of outcomes) assert(pathwayOptions(world).length > 0)

// Development -> reserves -> first team must be reachable through sustained form.
let ladder = applyTrialOutcome(base, .15).world
ladder = reviewSchoolPath(ladder, { week:7, recentForm:8.2, coachTrust:7, energy:88, trainingForm:3, abilityEdge:12 })
assert.equal(ladder.pathway.schoolTier, 'reserve')
ladder = reviewSchoolPath(ladder, { week:11, recentForm:8.4, coachTrust:8, energy:91, trainingForm:3, abilityEdge:14 })
assert.equal(ladder.pathway.schoolTier, 'first-team')

// A cut player can still create a Sunday League route once visible locally.
let cut = applyTrialOutcome(base, .03).world
cut = recordYouthPerformance(cut, { week:8, competition:'friendly', rating:8.5, minutes:90, scoutsPresent:true })
cut = generateSundayApproaches(cut, 8)
assert(cut.pathway.pendingSundayApproaches.length > 0)

// School elimination does not block individual representative selection.
let standout = applyTrialOutcome(base, .72).world
for (let i = 0; i < 5; i++) {
  standout = recordYouthPerformance(standout, {
    week:13+i, competition:'regional', rating:8.1, minutes:90,
    goalContributions:1, scoutsPresent:true,
  })
}
standout = evaluateRegionalSelection(standout, {
  week:21, regionalMatches:5, averageRating:8.1, minutes:450, positionRankPercentile:.9,
})
assert.equal(standout.pathway.representative, 'regional-squad')

// Academy monitoring emerges from evidence rather than raw OVR.
let academy = standout
for (let i = 0; i < 3; i++) {
  academy = recordYouthPerformance(academy, {
    week:38+i, competition:'showcase', rating:8.2, minutes:90,
    goalContributions:1, scoutsPresent:true,
  })
}
assert(['monitored','trial-invited'].includes(academy.pathway.academyStatus))

console.log('V5 Youth World audit passed')
console.log({
  schools: base.schools.length,
  persistentPlayers: Object.values(base.schoolSquads).reduce((n,s) => n+s.firstTeam.length+s.reserve.length+s.development.length,0),
  sundayClubs: base.sundayClubs.length,
  calendarWeeks: 48,
  trialOutcomes: outcomes.map(w => w.pathway.schoolTier),
  ladderEnd: ladder.pathway,
  sundayApproaches: cut.pathway.pendingSundayApproaches.length,
  representative: standout.pathway.representative,
  academyStatus: academy.pathway.academyStatus,
})
