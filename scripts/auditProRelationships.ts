import assert from 'node:assert/strict'
import { emptyProRelationships, recordProRelationship, transferRelationshipModifier } from '../src/engine/proRelationships'

const empty = emptyProRelationships()
const talk = { id: 'talk:sky:4', clubId: 'sky', kind: 'negotiation' as const, description: 'Talks opened' }
const opened = recordProRelationship(empty, talk)
assert.equal(opened.clubs.sky.affinity, 54)
assert.equal(recordProRelationship(opened, talk), opened, 'reloaded saves must not duplicate events')
const signed = recordProRelationship(opened, { id: 'signed:sky:5', clubId: 'sky', kind: 'transfer', description: 'Joined Sky' })
assert.equal(signed.clubs.sky.affinity, 78)
assert.ok(transferRelationshipModifier(signed, 'sky') > 0)
const hostile = recordProRelationship(signed, { id: 'rejected:sky:6', clubId: 'sky', kind: 'rejection', description: 'Contract rejected' })
assert.ok(hostile.clubs.sky.rivalry > 0)
const win = recordProRelationship(hostile, { id: 'fixture:sky:7', clubId: 'sky', kind: 'fixture', description: 'Derby win' }, 'win')
assert.equal(win.clubs.sky.wins, 1)
assert.equal(win.clubs.sky.meetings, 1)
assert.equal(win.clubs.sky.losses, 0)
assert.equal(empty.clubs.sky, undefined, 'original ledger must not mutate')
console.log('Phase 3 relationships: persistence, idempotence, negotiation, transfers and rivalries pass')
