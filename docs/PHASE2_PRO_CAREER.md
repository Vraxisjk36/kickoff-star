# Kickoff Star — Professional Career Phase 2

## Implemented in this development pass
- Ten interactive professional entry destinations: England, Spain, Germany, France, Italy, Netherlands, Portugal, Brazil, South Africa and Scotland.
- Trial club offers vary by selected destination.
- A national top-flight match roster uses the country's actual modeled first-division size, rather than hard-coding an English 20-team league.
- The professional save records a country ID, while old saves without the field continue in England.
- The living pro world attaches the player to a real top-flight club in that country, without changing the youth save.
- The transfer desk uses domestic registration dates, finds eligible top-flight offers in other selectable countries, and can sign a cross-border move.
- A cross-border move carries the living-world history into a local league match roster for the new country, plus updates residence, wages and contract club.
- Senior seasons progress until retirement at age 38, with club-by-club results and a Hall of Fame career record screen.
- Human-controlled league scores reconcile with the **exact same federation fixture ID** and persistent world standings (including adjustment if the background sim already generated a result).
- After relegation or promotion, the playable squad and fixtures rebase to the club's new real division, preserving geographic and club identity.
- Forty-six-round English lower divisions and 36-round Scottish lower divisions have extended playable calendars without ending the season prematurely.
- Academy-to-pro contracts retain the destination country where supported; legacy and unsupported destinations fail over safely.
- Automated country-coverage and league-schedule checks run in GitHub Actions along with the existing pro-pyramid audits.

## Senior club and contract systems — October 2026

- A club objective is generated from its standing by reputation in the **actual active division**. The four objective types are title contention, continental qualification territory, top-half finish and survival. Each includes a target position, board confidence, club ID and season ID.
- Completing or missing the objective moves board confidence by +15 or -18 at season end. The archived season keeps that assessment. A change of club, promotion or relegation generates the correct new division objective.
- Senior players may request a two-year contract extension during the final 26 weeks of the current deal. Renewal eligibility requires an attached active world club, sufficient board confidence and remaining wage-budget headroom. Renewals increase the world player's wage obligation and update the player's expiration date.
- At the end of each senior season, appearances, goals, assists and age drive a bounded reputation change; coach trust also adjusts based on playing time. Effects are applied once per season, not every match.
- The professional hub exposes current board expectations, standing, confidence, weeks remaining and contract-extension controls.
- New automated tests check the objective, wage updates, renewal lockout, annual progression and saved-career compatibility.

**Remaining detail:** A real free-agency pathway at contract expiry, formal employer-initiated renewals, salary exchange rates, performance bonuses, work permits, personal transfer requests, and multi-year contract disputes have not yet been implemented. The board objective labels are simplified simulation rules, not literal qualification rules for each federation.

## Free agency and contract expiry — October 2026

- The first senior weekly tick reaching the contract's expiry releases the human player from their club, clears the contract, ends wages and removes the world player's club assignment and annual wage commitment.
- Release is idempotent and saved as `freeAgentSinceWeek`; old saves without that field still load as normal attached careers.
- The former club continues its league fixtures via background simulation, while the free agent cannot participate in club or cup matchdays or receive a prior club's title.
- While unattached, players may seek agent offers from supported top-flight countries without a domestic transfer-window restriction. Signing uses **zero outgoing transfer fee**, updates the player's new 2-year contract and persistent world roster, assigns a new club and rebuilds that country's playable fixture calendar. This is a streamlined gameplay rule, not an exact reproduction of each nation's free-agent registration deadlines.
- Squad wages and bonus statements do not continue beyond expiry. A new club contract resumes pay only when signed.
- The professional UI shows an unattached-player panel, a transfer search, and disables renewing a contract that already expired.
- New regression cases check payroll detachment, idempotency, transfer completion, saved club mapping, no unsigned matchdays and zero unsigned wages.

**Still to do:** Employer decisions on releases, detailed Bosman/pre-contract negotiations, international registration restrictions, free-agent agents initiating offers automatically, career choices to retire early, and deeper international caps/competitions.

## Senior international career — October 2026

- Senior call-ups occur at three selected national duty windows in each professional season. The call-up score combines senior appearances, goals, assists, form and reputation; previously capped players have a lower repeat-selection threshold.
- Eligibility follows the player's saved **nationality**, never the country where the player signed a professional contract. The current senior match engine uses the 24 nations in the existing `NATIONS` catalogue and chooses a similarly rated opponent deterministically.
- A pending call-up takes precedence over a club match or cup fixture on the playable matchday. The same interactive match screens are used with national team identities, and the post-match result saves caps, goals and assists separately from club statistics.
- Skipped duty is archived as a missed appearance, **not** a national-team cap; save/reload cannot duplicate the same duty fixture.
- A player's senior caps and goals appear in the professional home panel and Hall of Fame; competition career records track their international contribution.

**Remaining international realism:** Official national qualifying groups, tournament brackets, call-up squads beyond the user, exact FIFA windows and eligibility criteria, club postponements when dates clash, international injuries and suspensions, and proper ranking/Elo progression are not yet implemented. This is a first playable international-career layer, not a claim that the full national-team calendar is complete.

## Four-season international championship — October 2026

- The senior international layer now runs a repeatable **four-season International Championship** using the established 24-national-team catalogue. It is a clearly fictional competition format, not a representation of the official FIFA World Cup calendar.
- Twenty-four nations are assigned to **six qualifying groups of four**. Each group plays a home-and-away round robin over six windows in the first two seasons of the cycle, with standings computed from wins, draws, goal difference and goals scored.
- The six group winners and two best runners-up qualify for the eight-nation finals. In season three, the finalists enter two groups of four and play three group fixtures. Two teams per group qualify for the semifinals.
- Season four features two semifinals, a title final and a third-place fixture. Players whose nation is eliminated still receive friendly fixtures when selected.
- Other national teams' games are simulated deterministically from nation strengths. The user's actual played international results override the matching simulated score and can change qualification, knockout entrants, opponents and tournament champions.
- A completed player's caps, goals, assists and earned International Championship honours are visible in the pro hub and Hall of Fame. Qualifying standings and finals membership are derived from saved international fixtures, so they survive save/load.
- Regression coverage spans five separate four-season cycles (**20 international seasons**) and checks group uniqueness, home-and-away opponents, finalists, knockout participation and whether winning or losing the player's qualifiers changes finals access.
- A separate senior-career regression advances **20 full seasons in England and South Africa**, checking chronological seasons, consistent club counts, ageing to 38, archived seasons and no progression after retirement. This is an automated engine stress test, not a substitute for Android device performance QA.

**Not yet official-format realism:** The simulated tournament has 24 rather than the real World Cup field; there are no confederation-specific World Cup qualifying paths, confederation championships, national-team squad lists, exact FIFA windows or official rankings. The 20-season audit covers international competition scheduling and bracket generation, not yet 20 years of full mobile gameplay or Android-device performance.

## Regional national-team squads and competitions — October 2026

- Every senior international call-up now records a stable **23-player national squad**. Players are selected from the simulated world's eligible nationals by role and ability; vacant roles are filled with stable fictional national-team players. Injured or foreign-national players are ineligible, and the human player is assigned only if fit and selected.
- Squad snapshots, position balance and captain selection are stored in the pending fixture. The professional hub displays the whole national squad, with the user's selected place highlighted.
- Alongside the four-year fictional International Championship, countries now take part in separate **two-season confederation Nations Series**, with regional opponents only: Europe (UEFA), Africa (CAF), South America (CONMEBOL), North America (CONCACAF) and Asia (AFC). Smaller national-team pools may repeat opponents, and odd-sized groups have genuine byes.
- Regional fixtures occupy the additional international weeks **8, 20 and 32**. Reciprocal fixtures update both opponents' standings consistently; human-controlled results override simulated scores. The professional hub shows regional tables and the champion after the cycle finishes.
- New integration audits cover all 24 selectable senior nationalities, deterministic 23-player squads, foreign/injured disqualification, geographical opponent validity, odd-sized group byes and consistent score totals.

**Limitations:** These are *fictional, confederation-based nations leagues*, not official UEFA Nations League, AFCON, Copa América or Asian Cup editions. They do not model real-life qualifying rules, all worldwide nations, formal squad-registration deadlines or FIFA player-eligibility decisions. The adult squads still use fictional filler players where the wider professional world lacks enough eligible domestic players.

## International ranking, availability and save integrity — October 2026

- A new **fictional senior nation rating index** seeds 24 playable national teams by existing nation strength. Completed player-controlled matches move points between both national sides using strength-based expected results and competition weighting (qualifiers, finals, regional fixtures and friendlies).
- Rating tables are derived from saved match histories, with duplicate national game results ignored. Future fixtures and missed international duty cannot change rankings; the professional hub shows the player's national rank and points movement.
- National-team call-up selection now respects active player injury status, including old saves with an absent position field. A default midfield role prevents crashes when a legacy profile has incomplete position information.
- Tournament and regional standings explicitly ignore 0-minute missed appearances instead of interpreting a skipped national-team call-up as a real 0–0 draw.
- New regression tests cover ranking conservation, idempotency, past/future match filtering, injury exclusion, and safe national duty for legacy saves.

**Limitations:** The new ratings are intentionally **not** FIFA rankings or its officially calibrated SUM method. This system currently reacts to recorded human international fixtures, not every simulated NPC fixture across all national competitions.

## Simulated national ranking world and mobile performance — October 2026

- Senior rankings now include **all 24 modeled national teams**, not just results played by the human player. The ranking engine synthesizes deterministic scores for the elapsed Regional Nations Series and International Championship match windows, replacing individual simulated scores with the player's completed matches when available.
- Only elapsed fixtures affect the table. Missed duty never inserts a fabricated 0–0 score, duplicate records cannot count twice, and the simulated fixture list is derived rather than written into every save.
- The senior hub shows the updated rating table and points movement. The calculation is memoized by season, week and international-result history so React rerenders do not resimulate the national world.
- Automated tests include national fixture uniqueness, exact player-score overrides, no future-result leakage, finite national ranking values and a 20-season bounded reconstruction check.

**Scope:** This ranks the 24 nations currently represented in the senior match system. It does not yet create full squads or qualification calendars for all 100 country associations modeled in professional club competitions. This is a fictional strength-weighted rating system, not FIFA ranking methodology. Mobile rendering still requires device-based profiling in addition to CI timing.

## Original-game training, seven-day calendar and senior strength — October 2026

- The **original school match screen** remains the professional match engine. No second engine has been introduced. Senior matches additionally provide the opponent's OVR to decision resolution, so a young 60-rated player faces tougher football decisions against an 85–90-rated senior side. All school matches retain their previous action probabilities.
- Professional graduation now normalises abnormally low academy graduates into the **60+ initial professional OVR band** by adjusting underlying 1–20 attributes rather than faking a display-only rating. Their career, specialisms, XP costs, contract and ongoing progress remain intact. Early legacy professional saves are migrated once, without restarting.
- Existing playable top-flight teams and simulated professional clubs throughout the federation database have been independently calibrated using **FC-style rating ranges as a reference, not exact EA Sports ratings**. Major European top-flight teams occupy roughly 74–84+, with reduced bands for lower divisions and other leagues according to competitiveness. Professional teammates also receive credible first-team attributes. School leagues retain the original youth rating scale.
- Professional Home once again exposes **Monday–Sunday**. The current weekday, training slots, recovery and matchday appear in the week view; month and year views show real stored league fixtures. League matches are on Saturdays, regional/national dates have separate slots, European cup markers fall on Tuesday–Thursday, and detected finals use Saturdays. Further calendar synchronization with all persistent background-world tournament kickoff dates is still required.
- The professional training button launches the **existing interactive school drill engine** and the **existing attribute XP allocation screen**, enabling multiple training sessions per week instead of a single coach-trust increment. Completed weekdays are saved in the pro state and reset at the start of each new week. Advancing the senior calendar now moves one day at a time, with league simulation and salary processing at week's end.
- The player can rest on a day instead of training. Team news, original Player/People/Club/Shop visuals, injury data and professional contracts remain part of the same career.

**Remaining realism and QA:** League and European cup kickoff dates are not yet fully unified with the persistent simulated world, monthly views do not yet model complete media/sponsor schedules, and the rating-to-goals relationship requires multi-season gameplay balancing and mobile-device testing. Sponsorship deals, photo shoots and additional weekly-life interactions are a subsequent pass rather than part of this calendar/ratings restoration.

## Professional season polish: recognizable identities, nine trial drills, consistent calendars — October 2026

- A consistent fictional club-identity registry supplies recognizable equivalents of major football clubs across the ten interactive top divisions; other federations receive location-based identities. Lower tiers use readable city and neighbourhood names rather than numbered placeholders such as **"Paris 17"**. Existing save migrations now upgrade numbered clubs, including an anonymous player-owned club when necessary, while preserving explicitly chosen club identities and stable world club IDs.
- The league table's stored row labels now follow the newly named clubs, without discarding existing points, goals, fixtures or trophies. Full names appear during professional match lineups, commentary and final-score summaries, and all newly created cup opponents use the actual reputation from the persistent professional world.
- The first senior contract trial is **three weeks with three live mini-games per week**: nine interactive challenges, with coaching reactions after every drill, and a scouting score at the end of each week. The existing school mini-game assets are reused, not replaced by silent text choices.
- **Preseason comes before competitive league football**, including training and two friendly match weeks. The original match screen drives friendlies; they don't change league standings. A dedicated league-opening ceremony describes the title race, domestic/continental qualification and relegation, using each federation's implemented rules when available. Scotland explicitly displays its 38-match league split rather than an incorrect ordinary 22-match schedule.
- The professional daily/weekly/monthly/year calendar uses actual dated cup fixtures, with continental ties preferring Tuesday–Thursday and knockout finals scheduled on Saturdays in the persistent professional world. League games, coaching/training and recovery remain in the shared career Home.
- Pro match decision chances continue using the original school match engine with a **senior-only opponent OVR difficulty adjustment**. Seeded balance tests check 60-ish vs 88-rated mismatches remain meaningfully lopsided without hard score caps. Missed senior matchdays now record deterministic club results with zero playing minutes instead of silently leaving standings unchanged.

**Not a full real-world licensed simulation:** Club names and badge graphics remain fictional; recognizable cues are an original game-world convention. Some federation-specific European qualification berth allocations are still provisional. Actual Android device profiling, extended balancing against human match decisions and conflict-heavy 20-year schedules remain further QA; passing CI is not a guarantee of physical-device performance.

## Remaining before Phase 2 is feature-complete
- **Date-aligned play**: playable matchday fixture IDs and opponents now originate from the persistent league calendar; the weekly career UI still abstracts actual dates into a 44- or 52-week season. It must eventually support all exact event dates, reschedules and multiple matchdays in one week.
- **Every domestic format**: Scottish split fixtures and league-specific cup calendars need to drive interactive matchday, not just the world simulator.
- **Promotion/relegation**: club membership and playable league rebuild now follow the real modeled division; implement deeper group-specific awards, club objectives, board expectations and cup eligibility messaging for every tier.
- **Full international player selection**: international call-ups need integration into the human playable fixture flow.
- **Transfer windows and finances**: exchange rates, contractual release/renewal disputes, international work permit and agent interactions need more depth.
- **Player development**: season-on-season trait, playing-time and club-reputation curves, senior injuries and individual awards need to be tied to the active career.
- **Hall of Fame detail**: club-by-club history, domestic/continental trophies, international caps, records and selectable retirement age.
- **QA**: multi-seed 20-year journeys in every country, stress tests on mobile, travel across countries, loans, contract expiry and save upgrades.

Never label Phase 2 finished solely on ten-country selection or build success. Keep it on the active development branch until the above are implemented and verified.
