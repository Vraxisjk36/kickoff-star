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
