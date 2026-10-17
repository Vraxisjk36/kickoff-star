# Pro world specification, Phase 0 (V20 foundation)

The current public career remains a youth game ending at a first professional contract. The expansion is one future public release; Phase 0 defined boundaries and Phase 1 added a dormant generated simulation. `src/engine/proLeagueRegistry.ts` is the machine-readable **proposed** 35 playable + 40 simulated top-flight roster. Names, club counts, formats, clubs and tax profiles need researched content before activation.

## Findings from the V20 code audit

| Existing system | Current behaviour | Pro integration requirement |
| --- | --- | --- |
| Save | IndexedDB, three slots, schema v8 before Phase 0; import/export supports same versioned payload. | Schema v9 added `proWorld: null`; Phase 2 schema v10 adds `proCareer: null` to youth saves. Pro writes preserve both fields. Never convert a youth save merely because it loaded. Reject future-version saves. |
| Career and onboarding | `CareerClock.phase` only accepts trials, school season or academy. Signing a pro contract sets `turnedPro` and the flow stops. | Add a separate, opt-in direct-pro path and a signed-youth handoff. Do not repurpose `turnedPro` until both paths and migration are tested. |
| Calendar | 44 abstract weeks per youth season; one primary competition round each week with fixed weekdays. | Pro calendar uses ISO dates with league-specific season and registration profiles. Several activities can share a date in distinct slots; midweek and weekend fixtures can coexist. Youth schedules remain untouched. |
| World | `worldLeagues` simulates school divisions across 24 nations; it is not a pro-club database. | Stable player, club, manager, stadium, association, competition, fixture and event IDs. Keep school history when moving into the pro world. All existing nation IDs are retained in the 75-league plan. |
| Economy | Youth allowances, scholarship wages, family support and small purchases. | Independent club cash/annual squad cost, pro contract ledger, dated country tax profiles and housing. No mixing youth money units with pro minor-currency units without an explicit conversion. |
| Press | Weekly Gazette consumes youth events and history. | Pro news and social posts render from one persistent event log with bounded hot history and season archives. |
| Tests | Headless career simulations and topic-specific audit scripts exist. | Use `npm run audit:pro-foundation` for registry counts, V20 save migration, calendar collisions and offer affordability; extend with multi-season pro simulations later. |

## World scope

- 75 full top flights: Europe 20, Africa 18, South America 10, North/Central America + Caribbean 11, Asia 14, Oceania 2. Of these, 35 are targeted as playable and 40 as simulated; both need persistent standings and results.
- Satellite associations outside these 75 produce qualifiers, national teams and occasional clubs through a lighter model. Their membership list and continental access rules must be versioned separately. Do not award all qualifying slots to the 75 leagues.
- Club names, players, managers and stadiums require original content and persistent IDs. No EA FC database or ratings copied into the game. Player ratings derive from our own calibrated model.
- A full first division must have researched team counts, local cup entries, promotion rules, eligibility and calendar profile before activation. The roster's `research-pending` value intentionally prevents treating the 75 countries as completed leagues.
- Source-of-truth per competition: identity, owner association, entrant rules, stages, slots, dates, tie rules, squad limits, cup interaction and historical changes. A game season uses a frozen rules edition so a later content update does not rewrite an in-progress save.

## Date and fixture invariants

1. One ISO world date and one ordered event stream; country seasons can cross calendar years or run within one year.
2. Each league profile defines season start/end, breaks and registration windows by season edition. Winter breaks, international windows and cups reserve dates before domestic fixtures are placed.
3. `morning`, `afternoon`, `evening` are slots for player activities; a slot cannot contain two commitments. Travel and recovery can span slots. A match can occupy multiple slots, but fixtures are not assumed to occur only on Saturday.
4. A two-match week is permitted when dates allow recovery; congestion drives training intensity and selection. Hard constraints prevent the player being in different countries simultaneously.
5. Qualifying draws are deterministic from a saved world seed and frozen entrants; resuming a save cannot reroll the draw or duplicate a result.

## Finance and career invariants

1. Every club stores revenue, cash, committed wage/bonus/transfer/agent costs, reserves and a role-sensitive wage hierarchy in its own currency. The pure affordability evaluator is `src/engine/proClubFinance.ts`.
2. Offers use annual recurring cost **and** available upfront cash. Clubs cannot promise bonuses, agent fees or instalments without booking them. Relegation and competition income change later budgets; debt cannot be silently erased at season rollover.
3. A contract has separate guaranteed pay, conditional incentives, signing amount, term, agent arrangement, potential release condition, registration state, role and loan risk. Personal negotiations take dated steps; club budgets remain reserved while a deal is live.
4. Money on the player's screen uses a month-by-month ledger. Tax and social contributions are dated country-specific estimates, with displayed assumptions. Relocation creates a new residence; prior housing stays as an asset or liability.
5. Offers check eligibility, registration periods, existing squad commitments, player value, expected minutes and loan policy. A high rating alone cannot override cash or work-permit constraints.

## Persistence and performance budget

- Target initially **under 32 MB per save**, matching the current import limit; an eventual increase requires an explicit export/import migration. Measure actual size after 2, 10 and 20 world seasons on low-end Android hardware.
- Capacity planning assumption only: at 16 clubs per league, 75 leagues imply ~1,200 clubs and 18,000 double-round-robin domestic league fixtures per world year, before cups. Real club counts differ and must be researched per league. Do not store complete commentary or full individual match lines for all distant fixtures.
- Keep detailed current club, player and relevant rivals hot; store compressed outcomes for distant competitions and summarized season archives for the Gazette. Historical champions, records, transfers, trophies and player progression must survive compaction.
- Use stable IDs and schema migrations. Never derive IDs from display names. Every pro save must have a world rules edition to make old careers deterministic after content updates.

## Phase 0 exit and next dependency

Implemented: typed dormant world, league scope registry, initial date-slot scheduler, financial affordability gate and v8-to-v9 save boundary. The audit checks counts, legacy nation IDs, invalid dates, activity collisions, implausible offers and round-trip migration.

Phase 1 implemented `createProWorld`, `advanceProWorldTo`, and `proposeProTransfer` as dormant modules. A seeded fictional world creates stable associations, stadiums, managers, clubs, players, double-round-robin schedules and standings. Each season records a champion and bounded complete tables, refreshes finances, ages the roster and replaces retirements. Simulating twenty seasons keeps all 29,472 active squad slots filled. Transfers check wages and cash before moving a player and recording the event. The resumability audit compares one-step advancement with a save advanced in stages. `npm run audit:pro-world` checks this and a legacy V20 career save round trip.

The current save format is v10 and youth saves keep `proWorld: null` and `proCareer: null`. Generated content and dates are provisional and do not represent official clubs, memberships or transfer law. Device performance and import/export still require testing. Phase 2 added direct trials, signed youth handoff and continuous academy intakes. Phase 3 added market succession, position-sensitive aging, injury records, dated contract talks, a monthly game ledger, residence, loans, transfers and retirement choice. Fixtures resolve automatically; the existing interactive match engine is not adapted to pro fixtures. Tax coefficients, transfer windows and cross-currency fees are game approximations. Work-permit checks, cups and researched club data remain later work.
