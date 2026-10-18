# Pro world: 30 career countries and a simulated international world

This is the target architecture. The current playable pro chapter is England only. A registry flag is not a claim that a country is currently playable.

## Career countries (30)

| Confederation | Countries | Count |
| --- | --- | ---: |
| UEFA | England, Spain, Germany, France, Italy, Portugal, Netherlands, Belgium, Scotland, Türkiye | 10 |
| CAF | South Africa, Nigeria, Morocco, Egypt, Tunisia, Algeria, Ghana | 7 |
| CONMEBOL | Brazil, Argentina, Colombia, Uruguay, Chile | 5 |
| CONCACAF | United States, Mexico | 2 |
| AFC | Japan, South Korea, Saudi Arabia, India, China, Australia | 6 |

The other 70 countries with club leagues remain simulated. The 118 additional associations currently have national sides only. The world retains 218 association IDs in total. An association's domestic mode, continental eligibility, and ability to sign the human player are distinct flags; never infer one from another. Some associations have different membership for regional tournaments and world qualification, which must be encoded per competition and edition.

## Complete pyramid contract

A career country is complete only when all of these work together:

1. Its actual professional divisions for the chosen season have correct membership, calendars, league phases, playoffs or splits, tiebreakers and points deductions where applicable. “Full pyramid” means the supported professional levels down to a defined boundary, with a feeder pool at the bottom; it does not imply thousands of amateur teams are individually modelled.
2. Promotion and relegation are resolved from completed results, including playoff fixtures, with stable club IDs. The next season draws from the new membership. A promoted simulated club is immediately a valid career club if its country and division are playable.
3. National and league cups draw the correct tiers and qualifying entrants. Super cups, top-eight cups and continental berths consume actual prior winners and league standings, including pass-down and disqualification rules.
4. Transfers, wages, squad registration, loans, injuries, academy intake and retirement work for the human player in every playable division. The match engine and club UI use the same fixtures and table as the background world. No duplicate “player league” can disagree with world results.
5. Season archives preserve tables, titles, promotions, relegations, cup brackets and club records. Old saves migrate without rewriting historic results or replacing clubs.
6. Representative and continental competitions have edition-specific association eligibility, entries and qualification rounds. Simulated countries can qualify, win and send clubs without becoming human career destinations.

## Performance levels

- **Career simulation:** full player match flow and detailed squad/economy/event systems in all 30 career countries.
- **Club background:** 70 countries with season results, rosters, transfers, domestic winners and continental entries. Their clubs are not human transfer destinations.
- **National background:** association strength and national-team participation; no fabricated domestic league required.

The first ten countries with simulated top/second-tier boundaries are England, Spain, Germany, France, Italy, Netherlands, Portugal, Brazil, South Africa and Scotland. Promotion playoffs now roll into the following season and survive saves. They are not yet complete pyramids: second-tier relegation, third/fourth tiers where applicable, accurate cup entrants, division-specific calendars and player career integration remain. The English pro league is the only interactive chapter, and its player league is not yet the same table as the simulated English league. Most continental eligibility rules are provisional. Promote a country to actual career availability only after its integrated season audits pass.

## Save migration and release gate

Keep stable association and club IDs. Introduce an explicit career-availability flag separate from the league registry's planned mode. Existing saves should retain their club, competition, fixture, contract and history IDs. The first release with cross-country careers must test promotion into a playable division, relegation below it, cross-border transfer, cup qualification, continental qualification and a ten-season resumed save for each format family.

## Background expansion checkpoint

The 25 added club countries are Ukraine, Romania, Hungary, Bulgaria, Ireland, Finland; Zimbabwe, Ethiopia, Rwanda, Libya, Benin, Burkina Faso; Haiti, Curaçao, Dominican Republic, Suriname, Guyana; Jordan, Oman, Bahrain, Kuwait, Malaysia, Philippines; Solomon Islands and Papua New Guinea. They are background top flights only. Their club counts and formats remain provisional, not federation-verified.

The 100-country world benchmark on the development runtime: 1,812 clubs, 43,488 players, 28,576 initial league fixtures and 27.5 MiB after 20 years. This is not an Android WebView performance guarantee. A 32 MiB serialized-world audit ceiling remains in place; test lower-memory Android devices and save/reload before shipping.
