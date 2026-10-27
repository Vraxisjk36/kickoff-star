import assert from 'node:assert/strict'
import { careerLegacyMoments, nextCareerLegacyMoment } from '../src/engine/proCareerLegacy'
import type { ProCareerState } from '../src/engine/proCareer'
const state = { seasonRecords: [{ season: 1, associationId: 'eng', clubName: 'Manchester Sky', leaguePosition: 1, clubs: 20, appearances: 30, goals: 15, assists: 12, leagueChampion: true, competitionId: 'top-eng' }], seenMilestones: [] } as ProCareerState
const events = careerLegacyMoments(state)
assert.ok(events.some(e => e.id === 'legacy:appearances:25'))
assert.ok(events.some(e => e.id === 'legacy:goals:10'))
assert.ok(events.some(e => e.id === 'legacy:titles:1'))
assert.equal(events.some(e => e.id === 'legacy:goals:50'), false)
const first = nextCareerLegacyMoment(state)!
assert.notEqual(nextCareerLegacyMoment({ ...state, seenMilestones: [first.id] })?.id, first.id)
console.log('Phase 3 career legacy thresholds and persistence pass')
