# Phase 2 worldwide national-team verification (2026-10-21)

## Verified source architecture

- The world factory declares 100 club-league associations plus 118 background-only associations = **218 unique national associations** across six confederations.
- The original `NATIONS` list is the **24-nation youth onboarding catalog**. It must stay at 24 to preserve youth regions, schools, save IDs and gameplay performance.
- The new `SENIOR_NATIONS` derives 218 senior identities from the professional-world registries. The existing 24 keep their authored names, flags and strength ratings. Additional teams have stable generated fallback strengths and a generic globe flag until bespoke identities are authored.
- `proInternationalTournament` and `proContinentalNations` now use senior identities, with 2–4 team legacy qualifier groups instead of the hardcoded six groups of four.
- Background-only nations are now recognized by `confederationForNation` and `nationalCallupFixture`.
- `auditWorldwideInternational.ts` validates all 218 IDs, worldwide draw coverage, confederation membership, 23-player squads, 48-team professional World Cup entry and exactly nine interactive club-career countries.

## Known release-blocking differences

**Do not call international football fully realistic or fully unified yet.**

1. The player-facing `proInternationalTournament` still has a legacy **eight-finalist International Championship** and its own simulated results, whereas the background `proTournaments` has a 48-team World Cup. They are separate simulations; they need to become a single authoritative competition fixture and result history.
2. Player-facing continental windows currently model a short round-robin points series, not full AFCON/EURO/Copa América/Gold Cup/Asian Cup/OFC qualification and knockout formats. They must be driven by the same edition records as the background world.
3. The background World Cup selection uses a simplified confederation quota allocation and league-like qualifier results. Edition-specific regional qualifying stages, intercontinental playoffs and confederation allocations still need implementation.
4. Background-only associations have generated national squad stand-ins but no actual domestic player pool; international squads must be eligible and positionally balanced without treating missing league data as disqualification.
5. Interactive international match results must update the same persisted fixture, standings, nation ranking, qualification and champion history used by the background simulation. A saved/reloaded career must never produce different opponents or titles.
6. 218-team draw and simulation performance must be profiled on a mid-range Android device; the 24-nation youth career catalog must remain unchanged.
7. Verify actual federation membership, country names, flags, and official competition schedules before claiming FIFA-equivalent global coverage.

## Initial release boundary

- Professional club contracts: **England, Spain, Germany, France, Italy, Netherlands, Portugal, South Africa, Scotland**.
- Brazil remains a simulated domestic league and international national team.
- All 218 world associations remain in the international simulation; this is the game's fictional association roster, not a claim of 218 FIFA members.
- UEFA and CAF are the deep club-competition realism priority, but international national teams span all six confederations.
