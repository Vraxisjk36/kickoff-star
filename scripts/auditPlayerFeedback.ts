import { initCupWorld, knockoutRoundLabel } from '../src/engine/cup'
import { friendlyOpponent } from '../src/engine/friendlies'
import { generateTeam } from '../src/engine/teams'
import { decideSelection, playerForMatch } from '../src/engine/selection'
import { drillToDecision, generateSession } from '../src/engine/training'
import { useCareerStore } from '../src/store/careerStore'
import type { Player } from '../src/types/player'
import type { Division } from '../src/engine/league'

function check(value: unknown, message: string) { if (!value) throw new Error(message) }
const playerTeam = generateTeam(3)
const cup = initCupWorld({ competitionId:'schoolCup', label:'Regional Schools Cup', groupSize:0, fieldSize:16, prestigeRange:[2,6] }, playerTeam)
check(cup.knockoutRounds[0].length === 8, '16 entrants start with eight ties')
check(knockoutRoundLabel(cup) === 'Round of 16', 'opening draw must not say semifinal')
check(knockoutRoundLabel({ ...cup, knockoutRounds:[cup.knockoutRounds[0],cup.knockoutRounds[0].slice(0,4)], currentKnockoutRound:2 }) === 'Quarter-final', 'later round uses actual ties')

const teams = [playerTeam,generateTeam(3),generateTeam(3),generateTeam(3)]
const division = { teams } as Division
const first = friendlyOpponent(division,playerTeam.id,4,1)
check(first && first.id === friendlyOpponent(division,playerTeam.id,4,1)?.id, 'friendly opponent is stable before matchday')
check(first?.id !== friendlyOpponent(division,playerTeam.id,5,1)?.id, 'two preseason friendlies have different opponents')

const p = {
  position:'GK', attributes:{kind:'goalkeeper', values:{reflexes:8,handling:8,gkPositioning:8,distribution:8}},
  confidence:{value:0,baseline:0}, fitness:{stamina:90}, coachTrust:9, reputation:30,
  career:{appearances:0}, squadRole:'reserves', squadRoleSetAppearances:0, matchRatings:[],
} as unknown as Player
check(decideSelection(p,[]).role === 'reserves', 'trust alone cannot promote an unused reserve')
check(playerForMatch(p,'schoolReserveLeague').squadRole === 'starting-xi', 'reserve fixture gives actual match minutes')
check(playerForMatch(p,'schoolLeague').squadRole === 'reserves', 'reserve fixture does not change senior status')
const withGames = { ...p, career:{...p.career!,appearances:2}, matchRatings:[7.2,7.1] }
check(decideSelection(withGames,[]).role === 'bench', 'two good reserve performances earn one step')
const nextRole = { ...withGames, squadRole:'bench' as const, squadRoleSetAppearances:2, career:{...p.career!,appearances:5}, matchRatings:[7.2,7.1,7,7.2,7.1] }
check(decideSelection(nextRole,[]).role === 'starting-xi', 'three good bench appearances can earn a start')
const safe = drillToDecision(p,generateSession(p,'gk-reactions')).options.map(o => o.successChance)
check(Math.max(...safe) >= .68, 'safe youth trial approach is reasonably reliable')
check(safe.every(chance => chance > 0 && chance < 1), 'trial choices still have genuine outcomes')
useCareerStore.setState({ player:p, calendar:{ currentWeek:{ weekNumber:4, seasonYear:1, events:[{ id:'friendly',day:'sat',type:'match',title:'friendly',resolved:false }] }, history:[] }, activeSlot:null })
useCareerStore.getState().applyMatchResult(0,0,0,90,null,teams[1].id,2,1,true,undefined,teams[1].name,'schoolFriendlies',undefined,false,undefined,false,{ minutes:0,started:false })
check(useCareerStore.getState().player?.friendlyResults?.[0]?.goalsFor === 2, 'team friendly result survives even when a reserve did not play')
check((useCareerStore.getState().player?.career?.appearances ?? 0) === 0, 'unused reserve does not gain a playing appearance')
console.log('Player feedback: cup rounds, friendlies, earned selection, goalkeeper training odds passed')
