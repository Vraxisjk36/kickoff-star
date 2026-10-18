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
