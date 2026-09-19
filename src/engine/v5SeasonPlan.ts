// V4 -> V5 rebuild season contract.
//
// IMPORTANT: this is deliberately a V4-native blueprint, not a copy of the
// merged V5 YouthWorld calendar. The existing V4 calendar/match/league engines
// remain authoritative. Batches wire these blocks into those engines.
//
// Weeks remain 1..44 so the V4 weekly life/training/rest loop is preserved.
export type YouthRoute = 'school' | 'grassroots'
export type SeasonBlockKind =
  | 'trials' | 'friendly' | 'league' | 'cup' | 'development'
  | 'regional-selection' | 'national' | 'october' | 'festival' | 'closing'

export interface SeasonBlock {
  kind: SeasonBlockKind
  weeks: number[]
  matches: number
  matchMinutes: number
  optional?: boolean
  replaces?: SeasonBlockKind
  note: string
}

const range=(from:number,to:number)=>Array.from({length:to-from+1},(_,i)=>from+i)

export const SCHOOL_V5_BLOCKS: SeasonBlock[] = [
  { kind:'trials', weeks:[1,2,3], matches:3, matchMinutes:90, note:'Opening three-week school selection trial.' },
  { kind:'friendly', weeks:[4,5], matches:2, matchMinutes:90, note:'Two preseason school friendlies.' },
  { kind:'league', weeks:range(6,23), matches:18, matchMinutes:90, note:'10-school local league, home and away.' },
  { kind:'cup', weeks:range(24,28), matches:5, matchMinutes:90, note:'Regional Cup entrants receive five group matches before knockouts.' },
  { kind:'development', weeks:range(24,28), matches:5, matchMinutes:90, replaces:'cup', note:'Schools outside the local top three still play five development matches.' },
  { kind:'regional-selection', weeks:[29,30,31], matches:0, matchMinutes:90, optional:true, note:'Persistent 60 -> 35 -> 23 regional selection camp.' },
  { kind:'national', weeks:range(32,35), matches:0, matchMinutes:90, optional:true, note:'Regional representatives progress to the National Schools Championship.' },
  { kind:'october', weeks:range(36,40), matches:4, matchMinutes:90, optional:true, note:'Five-team October group: four matches and one bye; academy assessment can replace it.' },
  { kind:'closing', weeks:range(41,44), matches:0, matchMinutes:90, note:'International/optional local football, awards and recovery. Exact events depend on qualification.' },
]

export const GRASSROOTS_V5_BLOCKS: SeasonBlock[] = [
  { kind:'trials', weeks:[1,2,3], matches:3, matchMinutes:90, note:'Opening three-week grassroots club trial.' },
  { kind:'friendly', weeks:[4,5], matches:2, matchMinutes:90, note:'Two preseason club friendlies.' },
  { kind:'league', weeks:range(6,27), matches:22, matchMinutes:90, note:'12-club grassroots league, home and away.' },
  { kind:'cup', weeks:[9,13,17,21,25], matches:5, matchMinutes:90, note:'Grassroots Cup rounds run alongside the league.' },
  { kind:'october', weeks:range(36,40), matches:4, matchMinutes:90, optional:true, note:'Five-team October Development League: four matches and one bye; academy assessment can replace it.' },
  { kind:'festival', weeks:[41,42,43], matches:3, matchMinutes:40, optional:true, note:'Optional three-day festival: one 2x20-minute match per day.' },
  { kind:'closing', weeks:[44], matches:0, matchMinutes:90, note:'Awards, contracts and recovery.' },
]

export function seasonBlocks(route:YouthRoute){ return route==='school' ? SCHOOL_V5_BLOCKS : GRASSROOTS_V5_BLOCKS }
export function block(route:YouthRoute,kind:SeasonBlockKind){ return seasonBlocks(route).find(x=>x.kind===kind) }
export function routeLeagueRounds(route:YouthRoute){ return block(route,'league')?.matches ?? 0 }
export const V4_DEFAULT_MATCH_MINUTES = 90
export const FESTIVAL_MATCH_MINUTES = 40
export const V4_SEASON_WEEKS = 44
