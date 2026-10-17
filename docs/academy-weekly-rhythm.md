# Academy and weekly rhythm implementation

## Academy model

The academy world now stores two **age squads of one signed club**, not two divisions with club promotion and relegation. The player joins the younger squad, can earn an older-squad call-up with at least eight appearances and a 6.4 season average, and moves when age eligibility requires it. The season boundary records the move in the career inbox. Existing academy saves gain the club's second squad and Spain's longer roster at the next season boundary without erasing their current results.

| Country | Younger squad | Older squad | League fixtures | Domestic cup entry | Continental entry |
| --- | --- | --- | ---: | --- | --- |
| England | U18 Premier League | Premier League 2 U21 | 22 per age group in the playable subset | U18 academy cups | Senior-club qualification or eligible domestic youth championship, next season |
| Spain | Academy U17 development group | División de Honor Juvenil U19 | 30 per age group in one regional subset | U19 top four at week 23 enter Copa Juvenil | Senior-club qualification or U19 group champion at week 34, next season |
| Other European countries | U18 development league | U21 development league | 22 | Academy cups | Senior-club qualification or eligible youth champion, next season |
| Non-European countries | U18 development league | U21 development league | 22 | Academy cups | Continental European competition ineligible |

These are **playable subsets**, not claims that the entire real competition has only 12 or 16 teams. The game now has fictional identities tied to real senior clubs across all 20 available nations. Country and club investment bands affect match strength, scout access and offer quality. A South African player may attract an English trial, but a foreign scholarship cannot be registered until age 18 in this simplified rule. Actual international minor exceptions are not modeled.

Ratings use separate scales: school teams roughly 38–48 with variation, top European academies around 70–73, the strongest South African academy around 51–53, and senior club offer displays around 68–88 depending on country and club. Prestige remains a scouting/selectivity tier, not a match rating. The player's own attributes do not fall on signing; existing academy saves have their team ratings adjusted once on load while preserving results. The professional career is still an end state, so senior club ratings inform offers rather than playable fixtures.

Local league and domestic cup prestige also depend on the host country, separately from match ratings and player nationality. The English school league is 31/100 and South Africa's is 20/100, rather than a common 25/100. Match reputation gain uses this competition visibility, so equal individual performances in different domestic leagues create different scouting reach. A standout player in a lower-visibility league can still build reputation and earn international academy interest. The shared international youth competition keeps a country-neutral prestige.

## Gazette and season awards

The Gazette now keeps its full issue archive and shows a small headline preview each week. World school stories refer to saved simulated match rows for a persistent international cast, with a new graduating class entering as players age out. The player enters the same rankings using their actual match ledger. World Schools Five publishes every four weeks from week 8 through week 32, then goes silent for the final twelve weeks before the annual ceremony. The issue exposes a top scorers list from the same saved rows, so a claim about goals and assists can be checked. Each week with a simulated world fixture includes a specific non-player report. Simulated fixtures are school-world abstractions, not licensed real-school results.

World Schools Player, goalkeeper, young player, Golden Boot, playmaker and an eleven-player Team of the Year are computed from season points and recorded match stats. The local league and Regional Cup awards use their actual saved fixtures and match lines. Academy players have a separate academy league five and academy awards from their domestic academy match records; they do not enter World Schools awards. Award ceremonies are published in the Gazette at the season boundary. Older save histories remain readable; rankings start accumulating when the new world record becomes available.

The Academy Champions Cup draws 32 unique European clubs: 22 from a simulated senior-club path and 10 from a simulated domestic youth champion path. A club eligible for both takes the senior path. The **five-round knockout is playable**. Its 36-club six-game league phase and domestic three two-legged qualifying rounds are represented by the simulated qualification draw, not individually playable matches. This remains a compressed model of the UEFA Youth League, and the club pool is fictional rather than an official roster.

Source references (official):
- Premier League, U18 North/South: https://www.premierleague.com/en/news/4364174/aston-villa-to-start-under-18-title-defence-at-brighton
- Premier League, Premier League 2 U21 format and no relegation: https://www.premierleague.com/en/news/58764/premier-league-2-competition-format-explained/
- RFEF, División de Honor Juvenil groups and Copa de Campeones: https://rfef.es/es/noticias/definidos-los-grupos-y-calendarios-de-division-de-honor-juvenil
- RFEF, Copa del Rey Juvenil qualification: https://rfef.es/es/noticias/el-sorteo-de-la-copa-del-rey-juvenil-2526-se-celebrara-el-7-de-enero
- UEFA, Youth League paths and qualification: https://www.uefa.com/uefayouthleague/news/02a6-20d583385573-6fea9f5cb754-1000--2026-27-uefa-youth-league-calendar-format/

## Weekly rhythm

There is at most one major off-pitch decision per week. Scheduled story beats run three times per season, with first choice, week-three return, and week-nine conclusion. Six stories rotate over two seasons: a family bill, study partner, community pitch, coach film review, teammate practice, and holiday work. Their route is saved and referenced in later dialogue. Other weeks may be quiet. The optional weekly focus is a single no-calendar-day choice before the match: recovery, film study, or a paid community shift. Street and small-sided first-to-five invitations remain optional on non-school-match Thursdays. Their player quality now uses the actual shooting or goalkeeper attributes.

The career record, season objectives, match ledger, and existing saves remain compatible. A final-year school player with an active academy trial or scholarship negotiation gets an eight-week summer window to finish the already-earned opportunity; school match appearances do not continue during that window.
