# Professional league format audit (2026/27)

This records **implemented behavior**, not a promise that every competition mirrors its real-world edition. Fictional club and competition identities remain separate from rule structure.

| Area | Real-world edition | Current game |
| --- | --- | --- |
| England top flight | 20 clubs, 38 home-and-away matches, 380 fixtures; bottom three go down | New playable pro seasons and simulated world use 20/38/380. Relegation is **not implemented**. Older ten-club saves retain their original schedule. |
| English second tier | 24 clubs, 46 matches; top two promoted, 2026/27 play-offs expanded to six clubs | Not yet simulated as a separate division. |
| England continental berths | Four league berths in Champions tier; league and FA Cup Europa routes; League Cup Conference route; pass-down on overlaps; conditional performance spot and titleholder routes | Basic four/two/one routes and domestic cup pass-down implemented for the simulated world. Performance spot, titleholder adjustments, licensing and the user's playable league table feeding the wider European draw remain outstanding. |
| England cups | FA Cup includes lower pyramid; EFL Cup includes Football League | Current two cups are top-flight-only simulations. Entrants and round calendar need expansion. |
| South African top flight | 16 clubs, 30 matches; 16th relegated, 15th in three-club promotion playoff | World uses 16/30. Promotion and relegation are **not implemented**. |
| South African second tier | 16 clubs, 30 matches; champion promoted; second and third join the top-flight 15th in a home-and-away playoff league | Not yet separately simulated. |
| South African cups | Top eight from preceding completed league season; 16-team top-flight knockout; 32-club national cup including lower divisions | Top-eight selection is made after the preceding league season, and 16-club league cup is scheduled. National cup currently contains only top-flight clubs, so its 32-team format is pending. |
| South Africa in CAF | League champion and runner-up in Champions tier; domestic cup route and another eligible representative in Confederation tier | Two/two domestic routes and cup overlap fallback implemented for simulated entries; eligibility and final association confirmation are pending. |
| Other 73 top flights | Each needs its own season edition, split/playoff phases, promotion pool, cup entrants and continental allocation | Double round-robin **provisional simulation**. Some actual leagues use other structures, so these are not labelled verified. |

## Next engine work before claiming real-world parity

1. A versioned association ruleset with effective seasons, clubs, regular and split phases, point rules, tie-breaks, calendar windows, registration rules and explicit promotion pools.
2. Lower divisions with persistent club IDs and rosters. Season-end play-offs must be scheduled and resolved as matches; movement must alter the next season's actual entrants while old save histories remain intact.
3. Federation cup rules: England lower-league entrants, South Africa's 32-club cup, top-eight eligibility and complete draws.
4. Continental allocation based on finalized domestic and cup results, association slots and titleholders; calculate performance spots from recorded coefficients and handle pass-down without double entries. The playable pro league and wider world must use the same table before this route is shown as earned in the UI.
5. Research and test every other association against current organizer publications. Formats change across years, including the English Championship's six-team playoff from 2026/27.

## Organizer references

- Premier League 2026/27 fixtures: https://www.premierleague.com/en/news/4675097/all-380-fixtures-for-202627-premier-league-season
- Premier League relegation: https://www.premierleague.com/en/news/4657245/202526-premier-league-relegation-faq
- Premier League European qualification: https://www.premierleague.com/en/european-qualification-explained
- EFL 2026/27 Championship play-off change: https://www.efl.com/news/2026/march/05/efl-statement--sky-bet-championship-play-off-format/
- PSL top-flight format: https://psl.co.za/content/125534
- PSL 2026/27 dates: https://www.psl.co.za/news/article/5615294-psl-confirms-the-202627-season-calend
- PSL promotion play-off calendar: https://psl.co.za/news/article/5614854-promotion-play-off-draw-on-thursday
- PSL national cup field: https://www.psl.co.za/news/article/5613244-nedbank-cup-2026-participating-clubs
- CAF South African qualification example: https://www.cafonline.com/caf-champions-league/news/top-clubs-on-the-continent-set-to-represent-southern-africa-in-caf-interclub-competitions/
