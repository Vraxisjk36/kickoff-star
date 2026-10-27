# Phase 2 — Continental qualification realism (release scope: 9 career countries)

## Core rule (21 October 2026)

**Career selection is NOT the qualification list.** The initial release enables exactly England, Spain, Germany, France, Italy, Netherlands, Portugal, South Africa and Scotland for the human player's professional club contracts. Brazil is simulated-only for career selection, but its domestic pyramid and Libertadores qualification remain active. Every association with a simulated domestic league remains eligible to send its own clubs to international club competitions. The remaining national-only associations cannot conjure nonexistent league clubs.

The nine selectable leagues have no reserved continental places. Qualification always consumes saved domestic results from ALL eligible domestic associations. The current `beginContinentalSeason` has a first functional two-leg preliminary stage based on all simulated domestic leagues. It is **not yet release-ready continental qualification**: stage counts are provisional, and each confederation still needs its own edition-specific routes and entry allocations. Do not label it completed until the gates below pass.

## Required source-of-truth chain

1. Resolve association-specific domestic league seasons and cups (including playoffs, splits and licensing).
2. Freeze a qualifying snapshot keyed by `competitionEdition`, `associationId`, `domesticSeasonId` and stable club IDs. Never use a midseason table in place of the last completed season.
3. Apply versioned access lists for the specific confederation, competition and year. Include league finishes, domestic cup winners, titleholder berths, transfers of berths through duplicates and eligibility exclusions. Do not assume 'top four' for every country.
4. Allocate **direct main-stage** and **qualifying-round** entries separately. Qualifier winners, not a rating shortcut, claim the remaining main-stage berths.
5. Schedule each qualifying round, with actual two-legged aggregate resolution where called for, extra time/penalties, seeded draws and byes. Resolve fixtures in date order before subsequent rounds or the main stage begin. Match outcomes must determine advancement. No opponent or club may be double-booked.
6. Make the stage and tie state persistent, with deterministic load/resume, safe replays, migration for old saves and no duplicated winner or berth.
7. From qualification onward, preserve game IDs, participants, results, bracket and champion in the season archive. Allow the player to compete against background-country clubs, but never sign for them in this release.

## Different regional competition editions, not one generic bracket

| Confederation | Qualification engine requirement |
| --- | --- |
| UEFA | Versioned association access list; champions path and league path; qualifying and play-off rounds before **36-club** Champions, Europa and Conference league phases; 8 league-phase fixtures for Champions/Europa and 6 for Conference, followed by the appropriate knockout play-offs and last 16. |
| CAF | Country domestic league and cup berths for both Champions and Confederation routes, including 2026/27's **61 Champions League entrants**, first-preliminary exemptions and a 32-club second preliminary round that resolves to 16 group teams; two-legged qualifiers. |
| CONMEBOL | All ten confederation associations, stage 1/2/3 Libertadores preliminaries, with four clubs emerging from stage 3 to join 28 direct places for the **32-team group phase**; preserve Sudamericana routes and champion berths. |
| CONCACAF | Domestic and regional-cup qualifications across the confederation, not an arbitrary 'top 16'; **27-club** Champions Cup, five pre-seeded byes, 22 round-one teams, two-leg ties until a single-match final, plus regional feeder competition results. |
| AFC | Edition-specific league slots, Asian Elite and second-tier allocations, East/West regional scheduling and qualifying paths; keep cross-region knockout rules. |
| OFC | Association champions through Oceania qualifying to the group/knockout competition with an appropriate small-field format. |

Sources to verify with each new edition:
- https://www.cafonline.com/caf-champions-league/news/explainer-draw-procedures-for-totalenergies-caf-champions-league-202627-preliminary-rounds/
- https://gol.conmebol.com/libertadores/en/news/sorteo-de-la-fase-de-grupos-de-la-conmebol-libertadores-2026-fecha-horario-clasificados
- https://www.concacaf.com/competitions/champions-cup/news/concacaf-confirma-fechas-del-sorteo-y-la-final-y-detalles-clave-de-la-copa-de-campeones-concacaf-2026

## Engine objects to introduce

- `accessList[confederation][competition][edition]`: association allocations by direct stage and qualifying path, including titleholder rules.
- `qualificationSnapshots[competitionEdition]`: frozen association/league/cup references to identify WHY a club qualified.
- `qualifyingTies`: stable tie IDs, seeded side, home and away fixture IDs, two-leg aggregates, tiebreak details, advancement.
- `continentalEntry[clubId]`: exactly one active competition tier, qualifier or main stage, and why that slot was awarded.
- `continentalEdition`: stage, entrants, finalist and champion archives; downstream Club World entry.

Avoid recomputing access lists from the human player's country or from `PRO_INTERACTIVE_COUNTRIES`.

## QA / release gates

- Nine selectable countries remain unchanged; a player cannot sign for Brazil or another background-country club.
- Every available background club association can enter its own champion subject to its edition's real access allocation.
- Finish England, South Africa, Brazil, and a simulated non-career association's seasons with intentionally varied champions; verify the next edition's continental selections change accordingly.
- Verify UEFA includes actual qualifiers from non-playable leagues even when ten selectable countries already provide 36+ candidates.
- Verify CAF first preliminary -> second preliminary -> group entrants are traceable through results; the same for three CONMEBOL phases and the CONCACAF 22+5 arrangement.
- Fixture duplicates = 0; entrants across parallel cup tiers never overlap; qualifying clubs neither disappear nor appear twice.
- Domestic cup titleholders already qualified by league pass their displaced spot according to *that country and edition*, not automatically through a global generic rule.
- Same seed + same previous results -> exact same entrants, fixtures, qualifiers and winners after save/reload.
- Simulate 20 seasons with changing winners, records, cup winners, promotion/relegation and human-result overrides; measure CPU, memory and serialized save sizes on a mid-range Android device.
- A test failing any qualification or archive invariant blocks the next release, even if the app builds.

## Immediate known gaps after the first correction

- All-country domestic ranking feeds a functional first-pass two-leg qualifying stage, with aggregates and subsequent main-stage entry. It does not yet reproduce every real preliminary round or the complete actual direct-entry exemptions.
- The current `PLAYABLE_CONTINENTAL_RULES` covers the nine career countries while other associations use generic allocations. There is no preferential treatment of the nine playable countries in candidate ordering.
- The present UEFA league-phase scheduler and advancement do not yet fully follow current competition formats.
- The present CONCACAF and CAF main-stage counts do not reproduce official entry paths.
- Award and historical record improvements are intentionally separate from this first qualification integration pass.

## Initial release focus (revised)

- Prioritize full **UEFA** and **CAF** qualification, tournament stage and league/cup access-list fidelity.
- Retain all other confederations as background simulations, including Brazilian league and CONMEBOL club qualification. They are not in the initial deep-realism QA release gate, but must not regress.
- Keep Brazil's clubs, results, promotions, continental berths and historical records in existing saves; only prohibit choosing a Brazilian professional club as the human player's destination.
- Verify any other signing and trial paths use `canStartInteractiveProCareer` rather than raw league-plan mode flags.
