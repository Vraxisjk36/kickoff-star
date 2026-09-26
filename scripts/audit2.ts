// AUDIT PASS 2 — independent checks that careerSim.ts (pass 1) doesn't cover:
//  A. v1 -> v2 save migration (old saves must load, gain cups/international)
//  B. shootout/bracket consistency: for EVERY drawn knockout tie the player's
//     eliminated flag must agree with knockoutWinners() on the nudged score
//  C. cup round-count vs calendar budget: every cup must finish within its
//     scheduled weeks for its exact field size
//  D. international full campaign: qualify -> finals -> final, winners flag
// Run: npx tsx scripts/audit2.ts
import 'fake-indexeddb/auto'
import { set as idbSet } from 'idb-keyval'
import { reseed, rand } from '../src/engine/rng'
import { readSave, SAVE_SCHEMA_VERSION } from '../src/engine/save'
import { initCupById, recordCupPlayerResult, advanceCupStage, batchSimCupStage, playerCupFixture } from '../src/engine/cup'
import { knockoutWinners } from '../src/engine/competitions'
import { initInternationalWorld, batchSimQualifyingRound, advanceInternationalStage, recordNationResult, batchSimFinalsRound, nationFixture } from '../src/engine/international'
import { generateTeam } from '../src/engine/teams'
import { SCHOOL_SEASON_SCHEDULE, SUNDAY_SEASON_SCHEDULE, ACADEMY_SEASON_SCHEDULE } from '../src/engine/calendar'

reseed(20260727)
let failures = 0
function assert(cond: boolean, msg: string) {
  if (!cond) { failures++; console.error('  ✗ FAIL:', msg) }
  else console.log('  ✓', msg)
}

async function auditA_migration() {
  console.log('\n[A] v1 save migration')
  const v1 = {
    slotId: 1, savedAt: new Date().toISOString(),
    player: { name: 'Legacy' }, calendar: { currentWeek: { weekNumber: 5, seasonYear: 1, events: [] }, history: [] },
    league: null, academyLeague: null,
    // deliberately NO schemaVersion / cups / international — the v1 shape
  }
  await idbSet('kickoff-star-save-1', v1)
  const loaded = await readSave(1)
  assert(!!loaded, 'v1 save loads')
  assert(loaded!.schemaVersion === SAVE_SCHEMA_VERSION, `migrated schemaVersion is current (${SAVE_SCHEMA_VERSION}), got ${loaded!.schemaVersion}`)
  assert(loaded!.cups !== undefined && loaded!.cups.schoolCup === null, 'migration adds empty cup worlds')
  assert(loaded!.international === null, 'migration adds null international')
}

function auditB_shootoutConsistency() {
  console.log('\n[B] shootout/bracket consistency (400 adversarial drawn KO ties)')
  let mismatches = 0
  for (let i = 0; i < 400; i++) {
    const playerTeam = generateTeam(4)
    let world = initCupById('sundayCup', playerTeam) // pure knockout
    // walk the player through the bracket, drawing EVERY tie, random shootouts
    let guard = 0
    while (world.stage === 'knockout' && !world.playerEliminated && guard++ < 10) {
      const fx = playerCupFixture(world)
      if (!fx) break
      const isHome = fx.homeTeamId === world.playerTeamId
      const oppId = isHome ? fx.awayTeamId : fx.homeTeamId
      const shootoutWon = rand() < 0.5
      world = recordCupPlayerResult(world, oppId, 1, 1, isHome, shootoutWon)
      // bracket must agree with the player's fate
      const round = world.knockoutRounds[world.currentKnockoutRound - 1]
      const winners = knockoutWinners(round.filter((f) => f.played))
      const playerAdvances = winners.includes(world.playerTeamId)
      if (shootoutWon !== playerAdvances || world.playerEliminated === shootoutWon) mismatches++
      world = batchSimCupStage(world, world.currentKnockoutRound)
      world = advanceCupStage(world)
    }
  }
  assert(mismatches === 0, `bracket vs eliminated-flag mismatches: ${mismatches}`)
}

function auditC_roundBudgets() {
  console.log('\n[C] cup round counts fit their scheduled calendar weeks')
  const expectations: Record<string, number> = {
    schoolCup: SCHOOL_SEASON_SCHEDULE.schoolCup.length,
    sundayCup: SUNDAY_SEASON_SCHEDULE.sundayCup.length,
    academyLeagueCup: ACADEMY_SEASON_SCHEDULE.academyLeagueCup.length,
    academyKnockoutCup: ACADEMY_SEASON_SCHEDULE.academyKnockoutCup.length,
  }
  for (const [cupId, weeksBudget] of Object.entries(expectations)) {
    // sim the whole cup NPC-only (player treated as NPC) counting stages
    let world = initCupById(cupId, generateTeam(4))
    let roundsUsed = 0
    let guard = 0
    while (world.stage !== 'complete' && guard++ < 20) {
      roundsUsed++
      world = batchSimCupStage(world, world.stage === 'group' ? roundsUsed : world.currentKnockoutRound, true)
      world = advanceCupStage(world)
    }
    assert(world.stage === 'complete', `${cupId} completes (stage=${world.stage})`)
    assert(roundsUsed <= weeksBudget, `${cupId}: ${roundsUsed} rounds fit in ${weeksBudget} scheduled weeks`)
  }
}

function auditD_internationalCampaign() {
  console.log('\n[D] full international campaign')
  let sawFinals = 0, sawTrophy = 0
  for (let i = 0; i < 40; i++) {
    let world = initInternationalWorld('Simland')
    const byId = new Map(world.qualifyingGroup.teams.map((t) => [t.id, t]))
    // qualifiers: 5 rounds of RR — nation wins everything to force qualification
    let guard = 0
    while (world.stage === 'qualifiers' && guard++ < 12) {
      const fx = nationFixture(world)
      if (fx) {
        const nationHome = fx.homeTeamId === world.nationTeamId
        world = recordNationResult(world, nationHome ? fx.awayTeamId : fx.homeTeamId, 2, 0, nationHome)
      }
      world = batchSimQualifyingRound(world, guard, byId)
      world = advanceInternationalStage(world)
    }
    assert(world.stage !== 'qualifiers', `run ${i}: qualifiers resolve`)
    if (world.stage === 'finals') {
      sawFinals++
      assert(world.finalsTeams.length === 8, `run ${i}: finals teams retrievable (${world.finalsTeams.length}/8) — the P23 unretrievable-teams bug`)
      let g2 = 0
      while (world.stage === 'finals' && !world.eliminated && g2++ < 6) {
        const fx = nationFixture(world)
        if (!fx) break
        const nationHome = fx.homeTeamId === world.nationTeamId
        world = recordNationResult(world, nationHome ? fx.awayTeamId : fx.homeTeamId, 1, 1, nationHome, true) // draw, win pens
        world = batchSimFinalsRound(world)
        world = advanceInternationalStage(world)
      }
      if (world.wonTournament) sawTrophy++
      assert(world.stage === 'complete' || world.eliminated, `run ${i}: finals resolve`)
    }
  }
  assert(sawFinals > 0, `at least one run reaches finals (${sawFinals}/40)`)
  assert(sawTrophy > 0, `winning the trophy is reachable (${sawTrophy}/40) — nation wins every shootout, so this must happen`)
}

async function main() {
  await auditA_migration()
  auditB_shootoutConsistency()
  auditC_roundBudgets()
  auditD_internationalCampaign()
  console.log(failures === 0 ? '\n✅ AUDIT 2: ALL CHECKS PASSED' : `\n❌ AUDIT 2: ${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
void main()
