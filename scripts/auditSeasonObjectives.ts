import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { createSeasonObjectives, objectiveProgress, completedSeasonObjectives } from '../src/engine/seasonObjectives'
import { useCareerStore } from '../src/store/careerStore'
import { writeSave, EMPTY_CUPS, SAVE_SCHEMA_VERSION } from '../src/engine/save'
import { generateWeek } from '../src/engine/calendar'
import { OUTFIELD_ATTRIBUTES, GOALKEEPER_ATTRIBUTES, type Position } from '../src/types/attributes'
import type { Player } from '../src/types/player'

function player(position: Position): Player {
  return {
    id: `season-${position}`, name: 'Season Audit', position, preferredFoot: 'right', heightCm: 180,
    attributes: { kind: position === 'GK' ? 'goalkeeper' : 'outfield', values: Object.fromEntries((position === 'GK' ? GOALKEEPER_ATTRIBUTES : OUTFIELD_ATTRIBUTES).map(key => [key, 10])) } as Player['attributes'],
    potential: 18, confidence: { value: 0, baseline: 0 }, fitness: { stamina: 100 },
    careerClock: { ageYears: 14, phase: 'grassroots-season', grassrootsSeason: 1 },
    schoolId: null, trialWeekCompleted: 3, squadRole: 'starting-xi', grassrootsPath: 'school',
    seasonGoals: 0, seasonAssists: 0, seasonRatings: [], matchRatings: [],
    coachTrust: 0, reputation: 5, scoutWatchers: [], contractOffers: [],
    totalWeeksElapsed: 4, injury: null, recentInjuryCount: 0, matchesSinceReturn: 3,
    career: { goals: 0, assists: 0, appearances: 0, wins: 0, cleanSheets: 0, bestRating: 0, motmAwards: 0, tacklesWon: 0, interceptions: 0, headersWon: 0, keyPasses: 0, saves: 0 },
  } as Player
}

for (const position of ['GK', 'CB', 'FB', 'CM', 'WM', 'WG', 'ST'] as Position[]) {
  const p = player(position)
  const plan = createSeasonObjectives(p, 1, 4)
  assert.equal(plan.objectives.length, 4)
  assert.equal(new Set(plan.objectives.map(o => o.kind)).size, 4)
  assert.equal(plan.objectives.some(o => o.kind === 'appearances'), true)
  assert.equal(plan.objectives.some(o => o.kind === 'averageRating'), true)
  assert.equal(plan.objectives.some(o => o.kind === 'goals'), position === 'ST' || position === 'WG' || position === 'WM')
  assert.equal(plan.objectives.some(o => o.kind === 'saves'), position === 'GK')
  assert.equal(completedSeasonObjectives(plan, p), 0)
}

const keeper = player('GK')
const plan = createSeasonObjectives(keeper, 1, 4)
const played: Player = { ...keeper, seasonRatings: Array(10).fill(6.8), career: { ...keeper.career!, appearances: 10, saves: 16, cleanSheets: 3, goals: 0 } }
assert.equal(completedSeasonObjectives(plan, played), 4, 'a goalkeeper can meet all four without a goal contribution')
assert.equal(objectiveProgress(plan, plan.objectives[1], played).label, '14/14')
const next = createSeasonObjectives(played, 2)
assert.equal(completedSeasonObjectives(next, played), 0, 'new season starts from current career totals')
assert.ok(createSeasonObjectives(keeper, 1, 35).objectives[0].target < plan.objectives[0].target, 'existing midseason saves have achievable remaining targets')

// An old save with the screenshot's goalkeeper ultimatum must load with no
// active deadline and a position-specific season plan. No weekly verdict can
// later force the player onto the bench.
await writeSave({ schemaVersion: SAVE_SCHEMA_VERSION, slotId: 0, savedAt: new Date().toISOString(),
  player: { ...keeper, activeArcs: [{ id: 'legacy', key: 'coach-ultimatum', title: 'Prove It Or Lose It',
    brief: 'Score goals or lose your place', objective: { kind: 'scoreGoals', count: 2 }, startedWeek: 4, deadlineWeek: 7,
    baseline: { goals: 0, assists: 0, appearances: 0, ratingsCount: 0 },
    onSuccess: { narrative: 'Success' }, onFailure: { setSquadRole: 'bench', narrative: 'Benched' },
  }], recentArcKeys: [] },
  calendar: { currentWeek: generateWeek(20, 1), history: [] }, league: null, academyLeague: null, cups: { ...EMPTY_CUPS }, international: null, pendingTraining: null,
})
await useCareerStore.getState().loadFromSlot(0)
const loaded = useCareerStore.getState().player!
assert.deepEqual(loaded.activeArcs, [])
assert.equal(loaded.squadRole, 'starting-xi')
assert.equal(loaded.seasonObjectives?.objectives.some(o => o.kind === 'goals'), false)
assert.equal(loaded.seasonObjectives?.objectives.length, 4)
console.log('Season objectives: seven positions, progression, rollover, and old-save retirement passed')
