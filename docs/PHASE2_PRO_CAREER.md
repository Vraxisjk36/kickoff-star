# Kickoff Star — Professional Career Phase 2

## Implemented in this development pass
- Ten interactive professional entry destinations: England, Spain, Germany, France, Italy, Netherlands, Portugal, Brazil, South Africa and Scotland.
- Trial club offers vary by selected destination.
- A national top-flight match roster uses the country's actual modeled first-division size, rather than hard-coding an English 20-team league.
- The professional save records a country ID, while old saves without the field continue in England.
- The living pro world attaches the player to a real top-flight club in that country, without changing the youth save.
- The transfer desk uses domestic registration dates, finds eligible top-flight offers in other selectable countries, and can sign a cross-border move.
- A cross-border move carries the living-world history into a local league match roster for the new country, plus updates residence, wages and contract club.
- Senior seasons progress until retirement at age 38, followed by the Hall of Fame career record screen.
- Automated country-coverage and league-schedule checks run in GitHub Actions along with the existing pro-pyramid audits.

## Remaining before Phase 2 is feature-complete
- **Single-source match simulation**: the interactive local league calendar and the background world league calendar are not yet fully unified. They currently share club identity, but the player's match results do not update all real-world league standings and qualification outcomes.
- **Every domestic format**: Scottish split fixtures and league-specific cup calendars need to drive interactive matchday, not just the world simulator.
- **Promotion/relegation of the human player's club**: the top-division local UI still needs playable second and lower tiers when a club is relegated.
- **Full international player selection**: international call-ups need integration into the human playable fixture flow.
- **Transfer windows and finances**: exchange rates, contractual release/renewal disputes, international work permit and agent interactions need more depth.
- **Player development**: season-on-season trait, playing-time and club-reputation curves, senior injuries and individual awards need to be tied to the active career.
- **Hall of Fame detail**: club-by-club history, domestic/continental trophies, international caps, records and selectable retirement age.
- **QA**: multi-seed 20-year journeys in every country, stress tests on mobile, travel across countries, loans, contract expiry and save upgrades.

Never label Phase 2 finished solely on ten-country selection or build success. Keep it on the active development branch until the above are implemented and verified.
