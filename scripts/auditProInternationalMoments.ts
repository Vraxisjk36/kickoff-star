import assert from 'node:assert/strict'
import { nextInternationalCareerMoment } from '../src/engine/proInternationalMoments'
import type { ProCareerState } from '../src/engine/proCareer'
const state = { seenMilestones: [], international: {
  nationId: 'rsa', caps: 0, goals: 0, assists: 0, starts: 0, fixtures: [],
  pending: { id: 'senior-int-rsa-1-8', nationId: 'rsa', opponentId: 'eng', season: 1, week: 8,
    home: true, competition: 'qualifier' },
} } as unknown as ProCareerState
const debut = nextInternationalCareerMoment(state)
assert.equal(debut?.id, 'national-debut:rsa')
assert.equal(nextInternationalCareerMoment({ ...state, seenMilestones: [debut!.id] })?.id, 'national-selection:senior-int-rsa-1-8')
const caps = { ...state, international: { ...state.international!, caps: 25, goals: 10, pending: null } }
assert.equal(nextInternationalCareerMoment(caps)?.id, 'national-caps:rsa:1')
const seen = ['national-caps:rsa:1','national-caps:rsa:10','national-caps:rsa:25']
assert.equal(nextInternationalCareerMoment({ ...caps, seenMilestones: seen })?.id, 'national-goals:rsa:1')
assert.equal(nextInternationalCareerMoment({ ...caps, seenMilestones: [...seen,'national-goals:rsa:1'] })?.id, 'national-goals:rsa:10')
console.log('Phase 3 international milestones: debut, persistence, caps and goals pass')
