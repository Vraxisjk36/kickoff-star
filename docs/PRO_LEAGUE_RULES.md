# Professional league structure audit (2026/27)

The existing school game and playable pro UI remain in place. This page describes the simulated world. The 30 “playable” labels in the registry are planned career destinations; full match interaction currently exists for the English pro chapter only. See [the 30-country pyramid plan](PRO_COUNTRY_PYRAMID_PLAN.md).

| Area | Implemented | Remaining rules work |
| --- | --- | --- |
| World leagues | 100 top divisions with persistent fixtures, tables, title archives, finances and squads | Most association formats are provisional double round robins; exact calendars and tiebreakers need federation review. |
| Second divisions | England 24/46, Spain 22/42, Germany 18/34, France 18/34, Italy 20/38, Netherlands 20/38, Portugal 18/34, Brazil 20/38, South Africa 16/30, Scotland 10/36. The numbers are club count/matches per club. | Every modelled second tier except the Netherlands exchanges with a third tier. The Netherlands currently has no senior exchange below tier two under the 2026/27 rules. Playoff and licensing details at several boundaries remain provisional. |
| National feeder flights | England has 24/46 in tiers three and four; Scotland has 10/36 in tiers three and four; Germany has 20/38 in tier three; France has an 18/34 Ligue 3; Brazil's Série C has a 20-club 19-match opening stage and two four-club, home/away promotion groups. Stable club IDs, seasons, finances, squads, titles and moves survive saves. | France's Ligue 3 second-tier access playoff is not yet integrated. Brazil's Série C expands after 2026 in reality, but the simulation keeps 20 entrants. England's National League boundary, Scotland's Highland/Lowland entry and Germany's Regionalliga groups remain outside the model. |
| Grouped feeder flights | Spain has two 20-club tables with group winners and qualifying playoffs; Italy has three 20-club tables with group winners and a recorded national playoff; Portugal has two 10-club tables and an eight-team championship phase; South Africa has nine provincial groups and a nine-champion qualifying bracket. Second-tier relegated clubs replace promoted clubs in their prior groups. | Exact promotion brackets, regional boundaries, cup preliminary rounds, reserve-team eligibility, playouts and provincial membership need federation-specific implementation. These are functional approximations, not faithful 2026/27 rules. |
| Promotion/relegation | All ten top/second-tier boundaries have saved results that determine next-season club membership. England has two direct places plus a six-team playoff from 2026/27; Spain and Italy have qualifying playoffs; Germany, France, Portugal, Netherlands and Scotland can retain their top-flight playoff incumbent; South Africa has a three-team mini league; Brazil 2026 has two direct promotions plus two separate two-legged ties (3rd v 6th and 4th v 5th). Dutch playoff qualification uses four period tables and two further eligible finishers, excluding the two direct places. | Period champion rules and reserve-team exclusions need real club identities, licensing and eligibility. Italian relegation playout, Portugal's lower survival tie, other second-tier relegation routes and lower professional tiers are pending. |
| Scottish Premiership | Twelve clubs play 33 games, split top/bottom six and play five more each, for 38 total. | Venue balancing after the split and league-specific tiebreakers are provisional. |
| Domestic cups | Modelled lower-tier clubs now enter their national cups. The English league cup has 92 modelled clubs and Scotland's has 42. South Africa has a 32-club national cup, plus top-eight and league cups. Cup winners are archived without a history cutoff. | National cup qualifiers, regional/amateur entrants, byes, exact draws and dates are provisional; the English FA Cup has many more pyramid entrants and South Africa's amateur entrants are not represented. |
| Continental routes | Existing English and South African league/cup pass-downs work in the simulated world. | UEFA coefficient spots, titleholder slots, other association allocations and playable-club results feeding the world draw are provisional. |
| Existing saves | New lower tiers are added on the next world advance without replacing existing clubs, players, current fixtures or title history. | Old saves with a prior fictional top-flight size retain it until a future migration. |
| Trophy history | League and cup winners persist and can be inspected by association in World Football. | Historical pre-game trophies are not invented; records begin when the simulation completes. |

Fictional clubs and names are not real fixtures or a licensed database. Do not advertise all 100 as faithfully modelled until governing-body rules, cup entrants and continental allocations are verified per edition.

The `auditAllProLeagues` script checks all 133 currently modelled divisions for pairings, home/away balance, double bookings, standings integrity, two season rollovers and direct versus resumed save parity. `auditPromotionPlayoffs` verifies the nine countries with top/second-tier playoff routes. `auditDeepPyramids` checks five earlier national feeder flights. `auditGroupedPyramids` checks the new group stages, cups, movements, resume and old-save hydration. `auditProWorld` runs twenty years within the save-size budget. These establish simulation consistency, not complete real-world format parity or interactive career availability.

## Organizer references

- Premier League 2026/27 fixtures: https://www.premierleague.com/en/news/4675097/all-380-fixtures-for-202627-premier-league-season
- EFL Championship playoff change: https://www.efl.com/news/2026/march/05/efl-statement--sky-bet-championship-play-off-format/
- EFL League One/Two playoff places: https://www.efl.com/competitions/sky-bet-play-offs/about-the-play-offs/
- Premier League European qualification: https://www.premierleague.com/en/european-qualification-explained
- PSL league/cup calendar: https://www.psl.co.za/news/article/5615294-psl-confirms-the-202627-season-calend
- PSL national cup field: https://www.psl.co.za/news/article/5613244-nedbank-cup-2026-participating-clubs
- Bundesliga promotion/relegation: https://www.bundesliga.com/en/bundesliga/news/how-does-promotion-and-relegation-work-in-the-bundesliga-10645
- Spanish second-division promotion playoff: https://www.laliga.com/noticias/quienes-juegan-el-play-off-de-ascenso
- French 2026/27 promotion playoff calendar: https://ligue1.com/en/articles/l1_article_3812-
- French Ligue 2 qualification route: https://ligue1.com/en/articles/l1_article_5074-
- Scottish split: https://spfl.co.uk/pages/premiership
- Scottish Premiership playoff schedule: https://spfl.co.uk/news/play-off-schedule-confirmed
- SPFL 2026/27 fixture calendar: https://spfl.co.uk/news/spfl-fixtures-for-202627
- KNVB 2026/27 professional promotion/relegation rules: https://www.knvb.nl/downloads/bestand/30190/doc
- Liga Portugal 2026/27 playoff announcement: https://www.ligaportugal.pt/news/28154/definido-o-emparelhamento-dos-playoffs-202627
- CBF Série B 2026 regulation and playoff: https://www.cbf.com.br/futebol-brasileiro/noticias/undefined/ceara-x-guarani/cbf-divulga-documentos-tecnicos-do-brasileirao-da-serie-b-de-2026
- Lega B playoff scheduling: https://www.legab.it/news/gli-orari-di-playoff-e-playout
- FFF Ligue 3 2026/27 format: https://www.fff.fr/article/16778-la-fff-officialise-la-ligue-3-professionnelle.html
- FPF Liga 3 historical phase format: https://portugalstore.fpf.pt/pt/editorial/tudo-o-que-precisa-de-saber-sobre-a-liga-3
- FIGC Serie C regulation: https://www.figc.it/media/207249/tit3_noif_art_da47a70_-23-06-2023.pdf

- PSL promotion playoff fixtures: https://www.psl.co.za/news/article/5614854-promotion-play-off-draw-on-thursday
