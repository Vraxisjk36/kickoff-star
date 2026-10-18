# Professional league structure audit (2026/27)

The existing school game and playable pro UI remain in place. This page describes the simulated world. The 30 “playable” labels in the registry are planned career destinations; full match interaction currently exists for the English pro chapter only. See [the 30-country pyramid plan](PRO_COUNTRY_PYRAMID_PLAN.md).

| Area | Implemented | Remaining rules work |
| --- | --- | --- |
| World leagues | 100 top divisions with persistent fixtures, tables, title archives, finances and squads | Most association formats are provisional double round robins; exact calendars and tiebreakers need federation review. |
| Second divisions | England 24/46, Spain 22/42, Germany 18/34, France 18/34, Italy 20/38, Netherlands 20/38, Portugal 18/34, Brazil 20/38, South Africa 16/30, Scotland 10/18 | Third tiers, second-tier relegation and lower-tier splits are not simulated. |
| Promotion/relegation | England has two direct Championship places plus a saved six-team playoff from the 2026/27 season; earlier seasons retain the four-team bracket. South Africa has one direct place plus a six-match, three-club mini league. Spain's third promotion place is decided by a two-legged four-club playoff; Germany's 16th top-flight club meets the second tier's third in two legs; France's 4th/5th then 3rd-place qualifying ties lead to a two-legged tie against the top-flight 16th. Scotland's 3rd/4th, then 2nd-place challenger plays the top flight's 11th club in three two-legged rounds. Results determine next-season membership and remain in promotion history. Other second divisions exchange clubs directly. | Netherlands and Italy still need their edition-specific playoff routes; relegation from the second tier and additional professional tiers remain pending. |
| Scottish Premiership | Twelve clubs play 33 games, split top/bottom six and play five more each, for 38 total. | Venue balancing after the split and league-specific tiebreakers are provisional. |
| Domestic cups | Lower-tier clubs enter national cups where a second division exists. England has a 44-club simulated national cup and league cup; South Africa has a 32-club national cup, plus top-eight and league cups. Cup winners are archived without a history cutoff. | The actual English FA Cup has many more pyramid entrants; qualifying rounds and specific calendars are not modelled. South Africa's amateur entrants are not represented. |
| Continental routes | Existing English and South African league/cup pass-downs work in the simulated world. | UEFA coefficient spots, titleholder slots, other association allocations and playable-club results feeding the world draw are provisional. |
| Existing saves | New lower tiers are added on the next world advance without replacing existing clubs, players, current fixtures or title history. | Old saves with a prior fictional top-flight size retain it until a future migration. |
| Trophy history | League and cup winners persist and can be inspected by association in World Football. | Historical pre-game trophies are not invented; records begin when the simulation completes. |

Fictional clubs and names are not real fixtures or a licensed database. Do not advertise all 100 as faithfully modelled until governing-body rules, cup entrants and continental allocations are verified per edition.

The `auditAllProLeagues` script checks all 110 currently modelled divisions for complete pairings, home/away balance, double bookings, standings integrity, two season rollovers and direct versus resumed save parity. Passing it establishes simulation consistency, not real-world format parity or interactive career availability.

## Organizer references

- Premier League 2026/27 fixtures: https://www.premierleague.com/en/news/4675097/all-380-fixtures-for-202627-premier-league-season
- EFL Championship playoff change: https://www.efl.com/news/2026/march/05/efl-statement--sky-bet-championship-play-off-format/
- Premier League European qualification: https://www.premierleague.com/en/european-qualification-explained
- PSL league/cup calendar: https://www.psl.co.za/news/article/5615294-psl-confirms-the-202627-season-calend
- PSL national cup field: https://www.psl.co.za/news/article/5613244-nedbank-cup-2026-participating-clubs
- Bundesliga promotion/relegation: https://www.bundesliga.com/en/bundesliga/news/how-does-promotion-and-relegation-work-in-the-bundesliga-10645
- Spanish second-division promotion playoff: https://www.laliga.com/noticias/quienes-juegan-el-play-off-de-ascenso
- French 2026/27 promotion playoff calendar: https://ligue1.com/en/articles/l1_article_3812-
- French Ligue 2 qualification route: https://ligue1.com/en/articles/l1_article_5074-
- Scottish split: https://spfl.co.uk/pages/premiership
- Scottish Premiership playoff schedule: https://spfl.co.uk/news/play-off-schedule-confirmed

- PSL promotion playoff fixtures: https://www.psl.co.za/news/article/5614854-promotion-play-off-draw-on-thursday
