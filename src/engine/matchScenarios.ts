// ============================================================================
// PHASE 38 — MATCH SCENARIOS (branching key moments)
//
// Requested directly: "I receive the ball at the halfway line, what do I do —
// run at goal, set up a pass? Then if I run and it succeeds, it continues:
// you made it into the box but a defender is right behind you, tight angle —
// shoot (lower chance) or square it to a teammate (higher chance)... it
// should feel like a storyline, not press-4-buttons-and-done."
//
// This is the architecture that makes that possible. A single-shot KeyMoment
// (situation → pick 1 of 3 → resolved) is still the DEFAULT for routine
// chances — not every touch needs three acts. A MatchScenario is a small
// directed graph of BEATS: a situation, a set of options, and each option's
// success/failure either RESOLVES the passage of play (goal, save, turnover,
// same outcomes the engine already knows how to apply) or CONTINUES to
// another beat with new options. The player experiences it as one flowing
// passage of play; the engine experiences it as a graph walk with no special
// casing needed at the drive-loop level — only entry and resolution change.
//
// Content scaling: this is genuinely combinatorial, which is the whole
// point. A single 3-beat scenario with 2-3 options per beat already produces
// 6-15+ distinct playthroughs depending on which branches you take and
// whether they succeed. Twenty or thirty scenarios authored this way reads
// as "hundreds of things that can happen" without needing hundreds of fully
// hand-written linear stories.
// ============================================================================
import type { AnyAttribute } from './matchDecisions'
import type { ChanceTier } from './match'

export type ScenarioCategory = 'attack' | 'defend' | 'gk-defend' | 'gk-distribution'

/**
 * What happens when a beat's option resolves. TERMINAL outcomes reuse the
 * exact resolution the single-shot engine already has (goal/assist/save/
 * beaten/distribution) — nothing new to balance there. 'continue' is the only
 * new kind, and it just names which beat comes next.
 */
export type BeatOutcome =
  | { kind: 'goal' }
  | { kind: 'assist' }
  | { kind: 'chance-missed' } // attacking failure, no goal conceded either way
  | { kind: 'save' }          // defensive success — the danger is stopped
  | { kind: 'beaten' }        // defensive failure — concede
  | { kind: 'distribution-good' }
  | { kind: 'distribution-poor'; canConcedeDirectly?: boolean }
  | { kind: 'continue'; beatId: string }

export interface ScenarioOption {
  label: string
  hint: string
  baseCeiling: number
  keyAttributes: AnyAttribute[]
  reward: number // feeds rating exactly like a single-shot option's reward tier
  onSuccess: BeatOutcome
  onFailure: BeatOutcome
  /** The line pushed to the commentary feed the instant this option resolves, before any terminal/continue text. */
  successText: string
  failureText: string
  /**
   * P40 — the probability (independent of the football success/fail roll)
   * that choosing this option draws a disciplinary consequence. Only makes
   * sense on genuinely reckless defensive challenges — "slide in hard" carries
   * cardRisk, "stay on your feet" doesn't. Rolled AFTER the football outcome,
   * as its own separate event, exactly like a real tackle can be a good
   * defensive read AND still catch the striker's ankle.
   */
  cardRisk?: number
  /** P52 — what a real scout is actually counting when this option succeeds.
      Reputation used to read only goals/assists/rating — structurally
      biased toward attackers. This is what makes a defender's tackles and
      a keeper's saves count for something real instead of nothing. */
  statTag?: 'tackle' | 'interception' | 'header' | 'keyPass' | 'save'
}

export interface ScenarioBeat {
  id: string
  situation: string
  options: ScenarioOption[]
}

export interface MatchScenario {
  id: string
  category: ScenarioCategory
  /** Which chance tiers this can be drawn for. A 'half' chance rarely deserves a 3-act saga. */
  tiers: ChanceTier[]
  entryBeatId: string
  beats: Record<string, ScenarioBeat>
}

function beat(id: string, situation: string, options: ScenarioOption[]): ScenarioBeat {
  return { id, situation, options }
}
function opt(
  label: string, hint: string, baseCeiling: number, keyAttributes: AnyAttribute[], reward: number,
  onSuccess: BeatOutcome, successText: string, onFailure: BeatOutcome, failureText: string, cardRisk?: number,
  statTag?: 'tackle' | 'interception' | 'header' | 'keyPass' | 'save',
): ScenarioOption {
  return { label, hint, baseCeiling, keyAttributes, reward, onSuccess, successText, onFailure, failureText, cardRisk, statTag }
}
function scenario(id: string, category: ScenarioCategory, tiers: ChanceTier[], entryBeatId: string, beats: ScenarioBeat[]): MatchScenario {
  return { id, category, tiers, entryBeatId, beats: Object.fromEntries(beats.map((b) => [b.id, b])) }
}

// ---------------------------------------------------------------------------
// ATTACK scenarios
// ---------------------------------------------------------------------------
const halfwayCarry = scenario('halfway-carry', 'attack', ['clear', 'good'], 'start', [
  beat('start', 'You pick the ball up on the halfway line. Space in front of you.', [
    opt('run at goal', 'take them on', 0.55, ['pace', 'dribbling'], 2,
      { kind: 'continue', beatId: 'box' }, 'You drive forward and the defence starts to backpedal.',
      { kind: 'chance-missed' }, 'You get shut down before you can build any speed.'),
    opt('set up a pass', 'bring others into it', 0.75, ['vision', 'passing'], 1,
      { kind: 'continue', beatId: 'through-ball' }, 'You spot the run and shape to play it in.',
      { kind: 'chance-missed' }, 'The pass is read and cut out before it goes anywhere.'),
    opt('knock it long', 'switch the play', 0.68, ['passing', 'vision'], 1,
      { kind: 'continue', beatId: 'wide' }, 'A crossfield ball finds space out wide.',
      { kind: 'chance-missed' }, 'Overhit — straight out for a goal kick.'),
  ]),
  beat('box', 'You made it into the box, but an {opp} defender is right on your shoulder. The angle is tight.', [
    opt('shoot', 'low percentage, high reward', 0.42, ['shooting', 'composure'], 3,
      { kind: 'goal' }, 'You squeeze it through the gap and in!',
      { kind: 'chance-missed' }, 'Blocked. The angle was too tight after all.'),
    opt('square it', 'higher percentage', 0.78, ['vision', 'passing'], 2,
      { kind: 'assist' }, 'Cut back perfectly — tucked away first time.',
      { kind: 'chance-missed' }, 'The pass is a fraction behind and the chance is gone.'),
    opt('take a touch first', 'buy half a yard', 0.6, ['dribbling', 'composure'], 2,
      { kind: 'continue', beatId: 'box-second-look' }, 'You buy yourself a fraction more room.',
      { kind: 'chance-missed' }, 'The touch is heavy and the danger is snuffed out.'),
  ]),
  beat('box-second-look', 'The defender recovers, but you\'ve still got a sight of goal.', [
    opt('go early', 'catch the keeper off guard', 0.48, ['shooting', 'composure'], 3,
      { kind: 'goal' }, 'Caught him cold — that\'s in before anyone can react!',
      { kind: 'chance-missed' }, 'Rushed it, and it flies well off target.'),
    opt('composed finish', 'pick a corner', 0.6, ['composure', 'shooting'], 2,
      { kind: 'goal' }, 'Ice cold — side-footed into the corner.',
      { kind: 'chance-missed' }, 'A good save from the keeper keeps it out.'),
  ]),
  beat('through-ball', 'The pass splits the defence — a teammate is bearing down on goal.', [
    opt('trust the run', 'commit to it', 0.72, ['vision', 'passing'], 2,
      { kind: 'assist' }, 'Perfect weight — he is clean through and finishes well.',
      { kind: 'chance-missed' }, 'Just behind him. The keeper gathers.'),
  ]),
  beat('wide', 'The ball is switched wide with space to attack the byline.', [
    opt('whip in a cross', 'go for the far post', 0.58, ['passing', 'vision'], 2,
      { kind: 'assist' }, 'A brilliant ball across goal — met first time!',
      { kind: 'chance-missed' }, 'Overhit and away for a goal kick.'),
    opt('cut inside', 'go it alone', 0.5, ['dribbling', 'agility'], 3,
      { kind: 'continue', beatId: 'box' }, 'You beat your man and cut back inside the box.',
      { kind: 'chance-missed' }, 'Crowded out before you can get a shot away.'),
  ]),
])

const counterAttack = scenario('counter-attack', 'attack', ['clear'], 'break', [
  beat('break', 'A turnover! {team} break with numbers forward and space ahead of the {opp} defence.', [
    opt('sprint into the space', 'lead the break', 0.6, ['pace', 'agility'], 2,
      { kind: 'continue', beatId: 'one-on-one' }, 'You outpace the last defender and it\'s just you and the keeper.',
      { kind: 'chance-missed' }, 'The defence recovers just in time to snuff it out.'),
    opt('hold it up', 'bring support into play', 0.8, ['strength', 'vision'], 1,
      { kind: 'continue', beatId: 'numbers' }, 'You shield the ball and teammates arrive in numbers.',
      { kind: 'chance-missed' }, 'Muscled off the ball before support gets there.'),
  ]),
  beat('one-on-one', 'It\'s just you and the {opp} goalkeeper now.', [
    opt('round the keeper', 'needs a clean touch', 0.5, ['dribbling', 'composure'], 3,
      { kind: 'goal' }, 'Beautiful — you take it round him and slot into the empty net!',
      { kind: 'chance-missed' }, 'He gets a hand to it and smothers the danger.'),
    opt('side-foot early', 'before he can set', 0.6, ['composure', 'shooting'], 3,
      { kind: 'goal' }, 'Placed calmly into the corner before he can react.',
      { kind: 'chance-missed' }, 'He guesses right and makes a superb save.'),
  ]),
  beat('numbers', 'You have two teammates alongside you against a scrambling defence.', [
    opt('slide the pass', 'unselfish', 0.78, ['vision', 'passing'], 2,
      { kind: 'assist' }, 'Perfectly weighted — tucked away with ease.',
      { kind: 'chance-missed' }, 'A defender reads it and blocks the pass.'),
    opt('go alone', 'back yourself', 0.5, ['shooting', 'composure'], 3,
      { kind: 'goal' }, 'You ignore the options and finish it yourself. Get in!',
      { kind: 'chance-missed' }, 'Should have passed — the shot is well off target.'),
  ]),
])

const setPieceAttack = scenario('set-piece-attack', 'attack', ['good', 'clear'], 'delivery', [
  beat('delivery', 'The {opp} corner is about to come in, and you\'ve found space in the box.', [
    opt('attack the near post', 'get there first', 0.55, ['positioning', 'strength'], 2,
      { kind: 'continue', beatId: 'header' }, 'You lose your marker and meet it at the near post.',
      { kind: 'chance-missed' }, 'Your run is tracked and the ball is cleared.'),
    opt('hang back for the second ball', 'patient', 0.7, ['positioning', 'concentration'], 1,
      { kind: 'continue', beatId: 'edge-of-box' }, 'It\'s only half cleared, and it drops invitingly.',
      { kind: 'chance-missed' }, 'The danger is cleared properly this time.'),
  ]),
  beat('header', 'The cross is inswinging and right in your zone.', [
    opt('power header', 'go for placement', 0.5, ['strength', 'positioning'], 3,
      { kind: 'goal' }, 'Thumped home! The keeper had no chance.',
      { kind: 'chance-missed' }, 'Glanced wide of the far post.'),
    opt('nod it down', 'for a teammate', 0.72, ['positioning', 'concentration'], 1,
      { kind: 'assist' }, 'Flicked into the danger area — turned in from close range!',
      { kind: 'chance-missed' }, 'The flick-on finds nobody in a white shirt.'),
  ]),
  beat('edge-of-box', 'The loose ball sits up nicely on the edge of the area.', [
    opt('first-time volley', 'high risk', 0.42, ['shooting', 'composure'], 3,
      { kind: 'goal' }, 'What a strike! Dead centre of the target, unstoppable.',
      { kind: 'chance-missed' }, 'Skewed well over the bar.'),
    opt('take a touch, then shoot', 'controlled', 0.62, ['dribbling', 'composure'], 2,
      { kind: 'goal' }, 'Set yourself and finished it calmly.',
      { kind: 'chance-missed' }, 'A last-ditch block turns it behind for a corner.'),
  ]),
])

// ---------------------------------------------------------------------------
// DEFENSIVE scenarios (outfield — CB/FB, the tackle/last-man situation)
// ---------------------------------------------------------------------------
const lastManRace = scenario('last-man-race', 'defend', ['clear'], 'chase', [
  beat('chase', 'The {opp} striker gets in behind and it\'s a foot race to the ball.', [
    opt('sprint and win it', 'pure pace', 0.55, ['pace', 'strength'], 2,
      { kind: 'continue', beatId: 'won-it' }, 'You get there first and knock it clear.',
      { kind: 'continue', beatId: 'lost-race' }, 'He just wins the race to the ball.'),
    opt('jockey and delay', 'buy time for cover', 0.75, ['positioning', 'concentration'], 1,
      { kind: 'save' }, 'You hold him up just long enough for a teammate to recover and clear.',
      { kind: 'continue', beatId: 'lost-race' }, 'He shifts it past you and is away.'),
  ]),
  beat('won-it', 'You reach it first but the striker is still right on you.', [
    opt('clear it first time', 'no time to think', 0.72, ['strength', 'positioning'], 1,
      { kind: 'save' }, 'Hoofed clear — danger over, for now.',
      { kind: 'beaten' }, 'Under pressure, you slice it straight to him and he finishes.'),
  ]),
  beat('lost-race', 'He gets there ahead of you and it\'s now just him and the keeper.', [
    opt('recover and slide', 'last-ditch effort — real card risk', 0.4, ['tackling', 'agility'], 2,
      { kind: 'save' }, 'An incredible recovery challenge — you win it clean!',
      { kind: 'beaten' }, 'The tackle doesn\'t arrive in time. He finishes with the keeper stranded.', 0.35),
  ]),
])

const boxScramble = scenario('box-scramble', 'defend', ['clear', 'good'], 'cross', [
  beat('cross', 'A dangerous {opp} cross comes in and there are bodies everywhere in the box.', [
    opt('attack the ball', 'be first to it', 0.55, ['strength', 'positioning'], 2,
      { kind: 'save' }, 'You get up highest and head it clear of danger.',
      { kind: 'continue', beatId: 'scramble' }, 'You\'re beaten in the air and it drops loose.'),
    opt('mark your man', 'stay goal-side', 0.7, ['positioning', 'concentration'], 1,
      { kind: 'continue', beatId: 'scramble' }, 'You stick tight, but the ball still needs dealing with.',
      { kind: 'continue', beatId: 'scramble' }, 'Your man loses you for a fraction of a second.'),
  ]),
  beat('scramble', 'The ball is loose in a crowded six-yard box. Total chaos.', [
    opt('throw yourself at it', 'block on the line — some card risk', 0.48, ['positioning', 'strength'], 3,
      { kind: 'save' }, 'You get something on it — cleared off the line!',
      { kind: 'beaten' }, 'You can\'t reach it. It\'s bundled home from close range.', 0.27),
  ]),
])

// ---------------------------------------------------------------------------
// GOALKEEPER scenarios
// ---------------------------------------------------------------------------
const goalkeeperOneOnOne = scenario('gk-one-on-one', 'gk-defend', ['clear'], 'approach', [
  beat('approach', 'The {opp} striker is through, one on one. He is closing fast.', [
    opt('rush and narrow the angle', 'commit early', 0.5, ['reflexes', 'handling'], 3,
      { kind: 'continue', beatId: 'commit' }, 'You close the angle down fast and force a rushed decision.',
      { kind: 'beaten' }, 'You misjudge the approach and he goes round you.'),
    opt('stand tall, wait him out', 'make yourself big', 0.62, ['gkPositioning', 'reflexes'], 2,
      { kind: 'continue', beatId: 'shot-decision' }, 'You hold your ground and make yourself a wall.',
      { kind: 'beaten' }, 'He picks his spot and finishes calmly around you.'),
  ]),
  beat('commit', 'He has to make a decision RIGHT now with you bearing down on him.', [
    opt('stay big, don\'t dive', 'discipline', 0.68, ['gkPositioning', 'concentration'], 2,
      { kind: 'save' }, 'He panics and drills it straight into you!',
      { kind: 'beaten' }, 'He calmly dinks it over you and in.'),
  ]),
  beat('shot-decision', 'He shapes to shoot from a tight angle.', [
    opt('block with your body', 'narrow it further', 0.65, ['gkPositioning'], 2,
      { kind: 'save' }, 'You get your body behind it — brilliant stop!',
      { kind: 'beaten' }, 'He finds the tiny gap and it\'s in.'),
  ]),
])

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// SECOND WAVE — content expansion. Same architecture, more storylines.
// ---------------------------------------------------------------------------
const wingerRun = scenario('winger-run', 'attack', ['clear', 'good'], 'byline', [
  beat('byline', 'You get to the byline with the full-back scrambling to recover.', [
    opt('cut it back', 'low, along the ground', 0.68, ['passing', 'vision'], 2,
      { kind: 'assist' }, 'Perfect cutback — buried first time!',
      { kind: 'chance-missed' }, 'Cut out just before it reaches anyone.'),
    opt('whip an early cross', 'first time, no touch', 0.55, ['passing'], 2,
      { kind: 'continue', beatId: 'far-post' }, 'The ball is flashed across the face of goal.',
      { kind: 'chance-missed' }, 'Overhit, out for a goal kick.'),
    opt('go for the near post yourself', 'shoot at a tight angle', 0.4, ['shooting', 'composure'], 3,
      { kind: 'goal' }, 'Unbelievable finish from the tightest of angles!',
      { kind: 'chance-missed' }, 'The keeper is equal to it and parries away.'),
  ]),
  beat('far-post', 'It drops at the far post with a defender arriving late.', [
    opt('first-time finish', 'no time to think', 0.5, ['shooting', 'composure'], 3,
      { kind: 'goal' }, 'Met it perfectly — in off the underside of the bar!',
      { kind: 'chance-missed' }, 'Snatched at it and it flies over.'),
  ]),
])

const midfieldDribble = scenario('midfield-dribble', 'attack', ['good'], 'pickup', [
  beat('pickup', 'You collect the ball in a pocket of space, two markers converging.', [
    opt('spin away from pressure', 'first touch out', 0.6, ['dribbling', 'agility'], 2,
      { kind: 'continue', beatId: 'space' }, 'A gorgeous turn takes both markers out of the game.',
      { kind: 'chance-missed' }, 'Dispossessed as you try to turn.'),
    opt('lay it off simply', 'keep it ticking', 0.85, ['passing'], 1,
      { kind: 'continue', beatId: 'reset' }, 'Simple and effective, the move continues.',
      { kind: 'chance-missed' }, 'Even the simple pass goes astray under pressure.'),
  ]),
  beat('space', 'Space opens up ahead of you.', [
    opt('drive forward', 'carry it yourself', 0.58, ['dribbling', 'pace'], 2,
      { kind: 'continue', beatId: 'edge' }, 'You surge forward into dangerous territory.',
      { kind: 'chance-missed' }, 'Crowded out before you can get anywhere.'),
    opt('play it early', 'find a runner', 0.72, ['vision', 'passing'], 2,
      { kind: 'assist' }, 'Superb ball into the run — finished with real composure.',
      { kind: 'chance-missed' }, 'The runner is flagged offside.'),
  ]),
  beat('edge', 'You reach the edge of the box with a sight of goal.', [
    opt('curl one into the corner', 'top bins', 0.45, ['shooting', 'composure'], 3,
      { kind: 'goal' }, 'What a strike! Curled perfectly into the top corner!',
      { kind: 'chance-missed' }, 'Fractionally wide of the post.'),
  ]),
  beat('reset', 'The move resets and comes back to you with a bit more space.', [
    opt('have a go', 'shoot from distance', 0.4, ['shooting'], 3,
      { kind: 'goal' }, 'From nowhere — that has flown in!',
      { kind: 'chance-missed' }, 'Well over the bar.'),
    opt('recycle possession', 'keep patient', 0.85, ['passing', 'vision'], 1,
      { kind: 'chance-missed' }, 'The move fizzles out, but at least you keep the ball.',
      { kind: 'chance-missed' }, 'Possession is lost cheaply.'),
  ]),
])

const penaltyBoxCross = scenario('penalty-box-cross', 'attack', ['clear'], 'whipped-in', [
  beat('whipped-in', 'A dangerous ball is whipped into the six-yard box.', [
    opt('attack it first time', 'meet it early', 0.52, ['positioning', 'strength'], 3,
      { kind: 'goal' }, 'Powered home! No goalkeeper on earth was saving that.',
      { kind: 'chance-missed' }, 'Glanced narrowly wide.'),
    opt('let it run across you', 'better angle', 0.62, ['positioning', 'concentration'], 2,
      { kind: 'continue', beatId: 'second-touch' }, 'You let it run and get a better angle on it.',
      { kind: 'chance-missed' }, 'It runs through to the keeper.'),
  ]),
  beat('second-touch', 'You have a clean sight of goal now.', [
    opt('side-foot it home', 'placement', 0.65, ['composure', 'shooting'], 2,
      { kind: 'goal' }, 'Composed as you like — side-footed into the corner.',
      { kind: 'chance-missed' }, 'The keeper somehow gets down to save it.'),
  ]),
])

const throughBallRace = scenario('through-ball-race', 'attack', ['clear'], 'played-in', [
  beat('played-in', 'A ball is played over the top and it\'s a straight race with the last defender.', [
    opt('time your run', 'stay onside, sprint', 0.55, ['pace', 'concentration'], 2,
      { kind: 'continue', beatId: 'through' }, 'Perfect timing — you\'re through on goal.',
      { kind: 'chance-missed' }, 'Just strays offside. Flag up.'),
  ]),
  beat('through', 'Clean through, keeper advancing.', [
    opt('lob it', 'audacious', 0.38, ['composure', 'shooting'], 3,
      { kind: 'goal' }, 'Absolutely outrageous — chipped him from the edge of the box!',
      { kind: 'chance-missed' }, 'Dragged wide of the far post.'),
    opt('go round him', 'take the safer route', 0.52, ['dribbling', 'composure'], 3,
      { kind: 'goal' }, 'Rounds the keeper and slots home with ease.',
      { kind: 'chance-missed' }, 'He gets a strong hand to it and denies you.'),
  ]),
])

// ---------------------------------------------------------------------------
// SECOND WAVE — defensive
// ---------------------------------------------------------------------------
const midfieldPress = scenario('midfield-press', 'defend', ['good', 'clear'], 'closing-down', [
  beat('closing-down', '{opp}\'s playmaker has time on the ball in a dangerous area.', [
    opt('close him down fast', 'press aggressively — minor card risk', 0.55, ['pace', 'positioning'], 2,
      { kind: 'continue', beatId: 'forced-error' }, 'You close the space down and force a rushed decision.',
      { kind: 'continue', beatId: 'played-through' }, 'He shifts the ball past you before you get close.', 0.1),
    opt('hold your position', 'stay disciplined', 0.75, ['positioning', 'concentration'], 1,
      { kind: 'save' }, 'You stay patient and the pass has nowhere to go.',
      { kind: 'continue', beatId: 'played-through' }, 'He finds a pass through the space you left.'),
  ]),
  beat('forced-error', 'Under pressure, he tries to force a pass through a tight gap.', [
    opt('step in and intercept', 'read it', 0.55, ['positioning', 'concentration'], 2,
      { kind: 'save' }, 'You read it perfectly and cut the pass out!',
      { kind: 'continue', beatId: 'played-through' }, 'You get a touch but it breaks kindly for them anyway.'),
  ]),
  beat('played-through', 'The ball breaks into space behind your midfield.', [
    opt('sprint back and recover', 'get goal-side', 0.5, ['pace', 'concentration'], 2,
      { kind: 'save' }, 'A brilliant recovery run snuffs the danger out.',
      { kind: 'beaten' }, 'You can\'t get back in time. They\'re in on goal and finish.'),
  ]),
])

const setPieceDefend = scenario('set-piece-defend', 'defend', ['good', 'clear'], 'marking', [
  beat('marking', 'The corner is about to come in and you\'re marking their biggest threat.', [
    opt('stay tight', 'goal-side, physical', 0.65, ['strength', 'positioning'], 2,
      { kind: 'continue', beatId: 'contest' }, 'You get right up close, giving him nothing easy.',
      { kind: 'continue', beatId: 'lost-man' }, 'He shrugs you off at the crucial moment.'),
    opt('zonal — cover the space', 'trust the system', 0.72, ['positioning', 'concentration'], 1,
      { kind: 'continue', beatId: 'contest' }, 'You cover your zone as the ball comes in.',
      { kind: 'continue', beatId: 'lost-man' }, 'The ball drops into a gap nobody covers.'),
  ]),
  beat('contest', 'The ball is delivered right into the mixer.', [
    opt('attack it', 'win the header', 0.55, ['strength', 'positioning'], 2,
      { kind: 'save' }, 'You rise highest and head the danger clear!',
      { kind: 'continue', beatId: 'lost-man' }, 'Beaten in the air at the crucial moment.'),
  ]),
  beat('lost-man', 'Your man gets a free header at goal.', [
    opt('block on the line', 'desperate defending', 0.42, ['positioning', 'agility'], 3,
      { kind: 'save' }, 'Somehow cleared off the line! Incredible defending.',
      { kind: 'beaten' }, 'Nodded home. Nothing more you could do.'),
  ]),
])

const counterDefend = scenario('counter-defend', 'defend', ['clear'], 'outnumbered', [
  beat('outnumbered', '{opp} break quickly and you\'re outnumbered at the back.', [
    opt('delay and show him wide', 'buy time', 0.68, ['positioning', 'concentration'], 1,
      { kind: 'continue', beatId: 'cover-arrives' }, 'You shepherd him away from goal and cover starts to arrive.',
      { kind: 'continue', beatId: 'decision' }, 'He cuts inside before your cover can get there.'),
    opt('commit to the tackle', 'end it now — real card risk', 0.45, ['tackling'], 2,
      { kind: 'save' }, 'A perfectly timed tackle — danger over!',
      { kind: 'continue', beatId: 'decision' }, 'Missed it completely. He\'s away with only the keeper to beat.', 0.38),
  ]),
  beat('cover-arrives', 'A teammate arrives to help just as he tries to thread a pass.', [
    opt('intercept together', 'trust the partnership', 0.7, ['positioning', 'concentration'], 1,
      { kind: 'save' }, 'Between you, the danger is snuffed out completely.',
      { kind: 'continue', beatId: 'decision' }, 'The pass squeezes through regardless.'),
  ]),
  beat('decision', 'It\'s down to a last, desperate covering challenge.', [
    opt('throw yourself in', 'all or nothing — real card risk', 0.4, ['tackling', 'agility'], 3,
      { kind: 'save' }, 'A last-ditch, last-man tackle. Unbelievable defending.',
      { kind: 'beaten' }, 'The tackle doesn\'t come off. They finish with ease.', 0.32),
  ]),
])

// ---------------------------------------------------------------------------
// SECOND WAVE — goalkeeper
// ---------------------------------------------------------------------------
const gkPenalty = scenario('gk-penalty', 'gk-defend', ['clear'], 'spot-kick', [
  beat('spot-kick', 'A penalty to {opp}. The ground falls silent as he places the ball down.', [
    opt('guess a side and commit early', 'high risk', 0.42, ['reflexes'], 3,
      { kind: 'save' }, 'You guess right and get down to save it! Incredible!',
      { kind: 'beaten' }, 'You guess wrong. He rolls it calmly the other way.'),
    opt('stay central, react late', 'read his eyes', 0.5, ['gkPositioning', 'concentration'], 2,
      { kind: 'save' }, 'You hold your ground and react brilliantly to save it!',
      { kind: 'beaten' }, 'He picks his spot perfectly and you\'re left with no chance.'),
  ]),
])

const gkCrossCommand = scenario('gk-cross-command', 'gk-defend', ['good', 'clear'], 'incoming', [
  beat('incoming', 'A cross floats into the box with attackers queuing up.', [
    opt('come and claim it', 'command your box', 0.5, ['handling', 'gkPositioning'], 3,
      { kind: 'save' }, 'You come and pluck it out of the air with total authority!',
      { kind: 'continue', beatId: 'punched-clear' }, 'You misjudge the flight and it drops dangerously.'),
    opt('stay on your line', 'let the defence deal with it', 0.7, ['gkPositioning', 'concentration'], 1,
      { kind: 'continue', beatId: 'punched-clear' }, 'You trust your defenders to deal with it.',
      { kind: 'continue', beatId: 'punched-clear' }, 'Nobody deals with it properly and it stays live.'),
  ]),
  beat('punched-clear', 'The ball is still loose and dangerous in the box.', [
    opt('come out and punch it clear', 'no catching this one', 0.6, ['handling', 'reflexes'], 2,
      { kind: 'save' }, 'Punched clear of everyone — danger dealt with.',
      { kind: 'beaten' }, 'Punched straight to an attacker, who finishes.'),
  ]),
])

// ---------------------------------------------------------------------------
// THIRD WAVE — GK distribution scenarios (was ZERO coverage — a keeper's own
// build-up play had no branching depth at all), plus more attack/defend/GK.
// ---------------------------------------------------------------------------
const gkBuildFromBack = scenario('gk-build-from-back', 'gk-distribution', ['clear', 'good'], 'under-press', [
  beat('under-press', 'The centre-backs are pressed high and the ball comes back to you under real pressure.', [
    opt('play it short, calmly', 'trust your touch', 0.55, ['distribution', 'composure'], 2,
      { kind: 'continue', beatId: 'progressing' }, 'You stay ice cool and find a way out under pressure.',
      { kind: 'distribution-poor', canConcedeDirectly: true }, 'Panicked under the press and it goes straight to {opp}.'),
    opt('go long and clear the danger', 'take no risks', 0.75, ['distribution'], 1,
      { kind: 'distribution-good' }, 'A big clearance takes the pressure off completely.',
      { kind: 'distribution-poor' }, 'Skewed badly and possession is lost cheaply anyway.'),
  ]),
  beat('progressing', 'You\'ve bought a moment — now where does it go?', [
    opt('switch it to the far side', 'find the space', 0.62, ['distribution', 'vision'], 2,
      { kind: 'distribution-good' }, 'A lovely raking pass finds acres of space out wide.',
      { kind: 'distribution-poor' }, 'Overhit, and {team} lose the ball needlessly.'),
    opt('roll it to the nearest man', 'keep it simple', 0.8, ['distribution'], 1,
      { kind: 'distribution-good' }, 'Simple, tidy, effective. The press is beaten.',
      { kind: 'distribution-poor' }, 'Even the simple option goes astray.'),
  ]),
])

const gkQuickCounter = scenario('gk-quick-counter', 'gk-distribution', ['clear'], 'saved-it', [
  beat('saved-it', 'You\'ve just gathered the ball and {opp} are still scrambling back into shape.', [
    opt('throw it out fast', 'catch them cold', 0.5, ['distribution', 'reflexes'], 3,
      { kind: 'distribution-good' }, 'A rapid throw catches {opp} completely unprepared. Dangerous!',
      { kind: 'distribution-poor' }, 'Rushed and inaccurate — the counter never gets going.'),
    opt('take your time, reset', 'let the team get organised', 0.82, ['distribution', 'concentration'], 1,
      { kind: 'distribution-good' }, 'Composed. {team} get the ball back under control properly.',
      { kind: 'distribution-poor' }, 'Even the patient option goes wrong under the referee\'s countdown.'),
  ]),
])

const gkGoalKickPressure = scenario('gk-goal-kick', 'gk-distribution', ['good'], 'lined-up', [
  beat('lined-up', '{opp} press high up the pitch, leaving almost no space, as you take the goal kick.', [
    opt('go short, build it out', 'play through the press', 0.5, ['distribution', 'composure'], 2,
      { kind: 'continue', beatId: 'pressed-again' }, 'Brave, and it draws {opp} further out of position.',
      { kind: 'distribution-poor', canConcedeDirectly: true }, 'Intercepted immediately, right in front of goal.'),
    opt('go long over the press', 'the safe option', 0.72, ['distribution'], 1,
      { kind: 'distribution-good' }, 'Straight over the press and into space. Simple and effective.',
      { kind: 'distribution-poor' }, 'Miscued and it barely clears the first man.'),
  ]),
  beat('pressed-again', 'The move has bought a yard, but {opp} are already closing again.', [
    opt('play out one more pass', 'commit to the plan', 0.6, ['distribution', 'vision'], 2,
      { kind: 'distribution-good' }, 'The press is finally broken — {team} are away.',
      { kind: 'distribution-poor', canConcedeDirectly: true }, 'The second pass is the one that gets cut out.'),
  ]),
])

const attackWonderGoal = scenario('attack-wonder-strike', 'attack', ['clear'], 'pickup', [
  beat('pickup', 'The ball drops to you thirty yards out, with a pocket of space to work in.', [
    opt('take a touch and unleash', 'have a real go', 0.35, ['shooting', 'composure'], 3,
      { kind: 'goal' }, 'UNBELIEVABLE! That has flown into the top corner from thirty yards!',
      { kind: 'chance-missed' }, 'Well over the bar. Ambitious, but it doesn\'t come off.'),
    opt('carry it closer first', 'be sensible', 0.6, ['dribbling', 'composure'], 2,
      { kind: 'continue', beatId: 'closer' }, 'You advance with the ball, closing the angle down.',
      { kind: 'chance-missed' }, 'Dispossessed as you try to carry it forward.'),
  ]),
  beat('closer', 'Twenty yards out now, still with a sight of goal.', [
    opt('curl one in', 'bend it', 0.48, ['shooting', 'composure'], 2,
      { kind: 'goal' }, 'What a strike! Curled beautifully beyond the keeper\'s reach.',
      { kind: 'chance-missed' }, 'Just wide of the far post.'),
  ]),
])

const attackOverlap = scenario('attack-overlap', 'attack', ['good', 'clear'], 'wide-option', [
  beat('wide-option', 'A teammate overlaps down the wing, dragging a defender with him.', [
    opt('release him early', 'unselfish', 0.72, ['vision', 'passing'], 1,
      { kind: 'continue', beatId: 'awaiting-cross' }, 'Perfectly timed — he\'s away down the line.',
      { kind: 'chance-missed' }, 'The pass is a fraction too heavy and it runs through to the keeper.'),
    opt('keep it and go inside', 'back yourself', 0.5, ['dribbling', 'agility'], 2,
      { kind: 'continue', beatId: 'cutting-in' }, 'You cut inside instead, into space {opp} didn\'t expect.',
      { kind: 'chance-missed' }, 'Crowded out — the move breaks down.'),
  ]),
  beat('awaiting-cross', 'The ball comes back in from the byline.', [
    opt('attack the near post', 'get across your marker', 0.55, ['positioning', 'pace'], 2,
      { kind: 'goal' }, 'Beat everyone to it — turned home at the near post!',
      { kind: 'chance-missed' }, 'Just can\'t get there in time.'),
  ]),
  beat('cutting-in', 'You\'re central now, twenty yards out.', [
    opt('go for goal', 'shoot on sight', 0.45, ['shooting', 'composure'], 3,
      { kind: 'goal' }, 'Hit sweetly — that\'s in off the underside of the bar!',
      { kind: 'chance-missed' }, 'Blazed over. Should have done better.'),
  ]),
])

const attackDeepCross = scenario('attack-deep-cross', 'attack', ['good'], 'deep-ball', [
  beat('deep-ball', 'A deep cross drifts to the back post, right into your path.', [
    opt('volley it first time', 'no time to control it', 0.42, ['shooting', 'agility'], 3,
      { kind: 'goal' }, 'What a volley! Absolutely thumped into the roof of the net!',
      { kind: 'chance-missed' }, 'Skied it well over. Difficult connection, but a chance nonetheless.'),
    opt('take it down first', 'control before you shoot', 0.65, ['dribbling', 'composure'], 2,
      { kind: 'continue', beatId: 'settled' }, 'Killed dead with a lovely first touch.',
      { kind: 'chance-missed' }, 'The touch runs away from you and the danger is gone.'),
  ]),
  beat('settled', 'The ball is under control now, with the goal at a good angle.', [
    opt('side-foot it home', 'pick your spot', 0.68, ['composure', 'shooting'], 2,
      { kind: 'goal' }, 'Composed finish. Textbook.',
      { kind: 'chance-missed' }, 'The keeper reads it and saves comfortably.'),
  ]),
])

const defendOneVsTwo = scenario('defend-outnumbered-wide', 'defend', ['good', 'clear'], 'two-on-one', [
  beat('two-on-one', 'Two {opp} attackers break down the wing against you alone.', [
    opt('show him inside', 'force the pass', 0.62, ['positioning', 'concentration'], 1,
      { kind: 'continue', beatId: 'pass-comes' }, 'You force the situation exactly where you want it.',
      { kind: 'beaten' }, 'He goes the way you didn\'t want and it opens up badly.'),
    opt('commit to the ball carrier', 'end it now — some card risk', 0.45, ['tackling'], 2,
      { kind: 'save' }, 'A brave, well-timed tackle ends the danger completely.',
      { kind: 'continue', beatId: 'pass-comes' }, 'Missed the tackle and now it\'s worse than before.', 0.34),
  ]),
  beat('pass-comes', 'The pass is threaded across to the second man.', [
    opt('scramble across and block', 'desperate recovery', 0.45, ['pace', 'positioning'], 2,
      { kind: 'save' }, 'You somehow get across to smother the shot!',
      { kind: 'beaten' }, 'Can\'t get there. Finished with the goal at his mercy.'),
  ]),
])

const defendHighLine = scenario('defend-high-line', 'defend', ['clear'], 'ball-over-top', [
  beat('ball-over-top', 'A ball is threaded over your high line and {opp} is sprinting through.', [
    opt('appeal for offside, keep running', 'trust the flag', 0.4, ['concentration', 'positioning'], 1,
      { kind: 'save' }, 'The flag goes up! Offside — danger over.',
      { kind: 'continue', beatId: 'foot-race' }, 'No flag. You\'re now in a straight foot race.'),
    opt('turn and sprint immediately', 'don\'t wait for the flag', 0.55, ['pace'], 2,
      { kind: 'continue', beatId: 'foot-race' }, 'You react instantly and give chase.',
      { kind: 'continue', beatId: 'foot-race' }, 'A slow start costs you a yard you can\'t get back.'),
  ]),
  beat('foot-race', 'Pure pace now, side by side with the last defender.', [
    opt('use your body', 'don\'t let him past', 0.48, ['strength', 'pace'], 2,
      { kind: 'save' }, 'You hold him off just enough. Cleared behind for a corner.',
      { kind: 'beaten' }, 'Muscled off the ball and he finishes coolly.'),
  ]),
])

const defendCornerClearance = scenario('defend-corner-clearance', 'defend', ['good'], 'in-flight', [
  beat('in-flight', 'The corner is in flight, and it\'s a genuine 50-50 in a crowded box.', [
    opt('attack it aggressively', 'win the physical battle', 0.55, ['strength', 'positioning'], 2,
      { kind: 'save' }, 'You win the header emphatically and clear your lines.',
      { kind: 'continue', beatId: 'second-ball' }, 'Beaten to it, and now it\'s scrappy.'),
    opt('block the run instead', 'stop him jumping', 0.65, ['strength', 'concentration'], 1,
      { kind: 'continue', beatId: 'second-ball' }, 'You disrupt his jump enough to make it messy.',
      { kind: 'continue', beatId: 'second-ball' }, 'He shrugs the block off easily.'),
  ]),
  beat('second-ball', 'The ball is still dangerously loose.', [
    opt('hack it clear', 'no finesse needed', 0.7, ['strength'], 1,
      { kind: 'save' }, 'Hoofed to safety. Ugly, but effective.',
      { kind: 'beaten' }, 'Sliced it and it drops for an easy finish.'),
  ]),
])

const gkReactionSave = scenario('gk-reaction-save', 'gk-defend', ['clear'], 'deflection', [
  beat('deflection', 'A shot takes a wicked deflection and is suddenly flying at you from close range.', [
    opt('react on instinct', 'trust your reflexes', 0.42, ['reflexes'], 3,
      { kind: 'save' }, 'Lightning reactions! You somehow claw it away!',
      { kind: 'beaten' }, 'No time to react. It\'s in before you can move.'),
    opt('narrow your stance and brace', 'give yourself the best chance', 0.55, ['gkPositioning', 'reflexes'], 2,
      { kind: 'save' }, 'Well set, and the deflection cannons straight off you.',
      { kind: 'beaten' }, 'It deflects the wrong side of you. Nothing to be done.'),
  ]),
])

// ---------------------------------------------------------------------------
// FOURTH WAVE — pushing toward real breadth across every category.
// ---------------------------------------------------------------------------
const attackFreeKick = scenario('attack-free-kick', 'attack', ['good', 'clear'], 'setup', [
  beat('setup', 'A free kick in a dangerous position, right on the edge of the box.', [
    opt('go direct', 'have a shot yourself', 0.4, ['shooting', 'composure'], 3,
      { kind: 'goal' }, 'Over the wall and into the top corner! An absolute belter!',
      { kind: 'chance-missed' }, 'Cannons off the wall. Nothing comes of it.'),
    opt('play it short', 'work an opening', 0.68, ['passing', 'vision'], 1,
      { kind: 'continue', beatId: 'reworked' }, 'A clever short routine catches {opp} unprepared.',
      { kind: 'chance-missed' }, 'The routine breaks down before it goes anywhere.'),
  ]),
  beat('reworked', 'The set piece has been reworked and there\'s a sight of goal.', [
    opt('shoot from the edge', 'strike it clean', 0.5, ['shooting', 'composure'], 2,
      { kind: 'goal' }, 'Guided perfectly into the corner. Clinical.',
      { kind: 'chance-missed' }, 'Straight at the keeper. A soft way to waste it.'),
  ]),
])

const attackDribbleBox = scenario('attack-box-dribble', 'attack', ['clear'], 'entering-box', [
  beat('entering-box', 'You dance past one challenge and enter the box with real momentum.', [
    opt('keep going, beat another', 'greedy but dangerous', 0.42, ['dribbling', 'agility'], 3,
      { kind: 'continue', beatId: 'clean-through' }, 'Beaten again! You\'re in on goal with real belief now.',
      { kind: 'chance-missed' }, 'This time the tackle comes and the move is over.'),
    opt('shift it wide and cross', 'don\'t overcomplicate it', 0.6, ['dribbling', 'passing'], 2,
      { kind: 'assist' }, 'Cut it back perfectly. Tucked away with ease.',
      { kind: 'chance-missed' }, 'The cutback is a fraction too heavy.'),
  ]),
  beat('clean-through', 'Nothing but the goalkeeper between you and glory.', [
    opt('finish first time', 'no hesitation', 0.55, ['composure', 'shooting'], 3,
      { kind: 'goal' }, 'Ice cold. Slotted through his legs!',
      { kind: 'chance-missed' }, 'The keeper reads it and smothers it well.'),
  ]),
])

const attackHeaderChance = scenario('attack-far-post-header', 'attack', ['good'], 'delivery', [
  beat('delivery', 'A whipped ball arrives at the far post and you\'ve snuck in behind your marker.', [
    opt('glance it goalward', 'placement over power', 0.6, ['positioning', 'concentration'], 2,
      { kind: 'goal' }, 'Beautifully placed header, right in the corner!',
      { kind: 'chance-missed' }, 'Just wide of the far post.'),
    opt('nod it back across goal', 'give a teammate the chance', 0.65, ['positioning', 'vision'], 1,
      { kind: 'assist' }, 'A clever header across goal — turned in at the back stick!',
      { kind: 'chance-missed' }, 'Nobody is there to finish it off.'),
  ]),
])

const defendTrackingRun = scenario('defend-tracking-run', 'defend', ['good'], 'runner', [
  beat('runner', 'A midfielder makes a late run into the box and you have to track it.', [
    opt('stay tight all the way', 'don\'t give an inch', 0.68, ['positioning', 'concentration'], 1,
      { kind: 'save' }, 'You track the run perfectly. Nothing on offer for him.',
      { kind: 'continue', beatId: 'lost-in-box' }, 'You lose him for a split second at the crucial moment.'),
  ]),
  beat('lost-in-box', 'He\'s gained half a yard on you inside the box.', [
    opt('recover with a shirt-pull... no, a clean challenge', 'do it properly', 0.5, ['tackling', 'pace'], 2,
      { kind: 'save' }, 'You get back and win the ball cleanly. Excellent recovery.',
      { kind: 'beaten' }, 'Can\'t recover in time. He finishes well.'),
  ]),
])

const defendShieldingBall = scenario('defend-shield-out', 'defend', ['half', 'good'], 'chasing-back', [
  beat('chasing-back', 'The ball is running out of play and you\'re racing an {opp} attacker to it.', [
    opt('get there first, shield it out', 'win the race', 0.6, ['pace', 'strength'], 1,
      { kind: 'save' }, 'You get there first and shepherd it out for a goal kick.',
      { kind: 'continue', beatId: 'contested' }, 'It\'s neck and neck as the ball nears the line.'),
  ]),
  beat('contested', 'A physical battle right on the touchline as the ball threatens to go out.', [
    opt('use your body legally', 'stay strong', 0.55, ['strength', 'positioning'], 2,
      { kind: 'save' }, 'You win the physical battle. Ball out for a goal kick.',
      { kind: 'beaten' }, 'Beaten to it. {opp} keep the ball alive and it costs you.'),
  ]),
])

const gkClaimOrPunch = scenario('gk-claim-or-punch', 'gk-defend', ['good', 'clear'], 'floated-ball', [
  beat('floated-ball', 'A floated ball into the box leaves you with a split-second decision.', [
    opt('come and catch it', 'take control completely', 0.5, ['handling', 'gkPositioning'], 3,
      { kind: 'save' }, 'Plucked cleanly out of the air. Total command of your box.',
      { kind: 'continue', beatId: 'mishandled' }, 'You misjudge the flight of it slightly.'),
    opt('punch it clear', 'the safer option', 0.68, ['handling', 'reflexes'], 1,
      { kind: 'save' }, 'Punched confidently clear of any danger.',
      { kind: 'continue', beatId: 'mishandled' }, 'A poor connection and it stays live.'),
  ]),
  beat('mishandled', 'The ball is loose in a dangerous area now.', [
    opt('scramble to smother it', 'make amends immediately', 0.5, ['reflexes', 'concentration'], 2,
      { kind: 'save' }, 'You recover well and smother the loose ball.',
      { kind: 'beaten' }, 'Can\'t recover. It\'s turned home from close range.'),
  ]),
])

const gkOneOnOneCoolHead = scenario('gk-cool-head-1v1', 'gk-defend', ['clear'], 'bearing-down', [
  beat('bearing-down', 'An attacker bears down on you with real pace, defenders trailing behind.', [
    opt('advance to meet him', 'shrink the target', 0.48, ['gkPositioning', 'reflexes'], 3,
      { kind: 'save' }, 'Perfectly timed advance — you smother the danger completely!',
      { kind: 'beaten' }, 'Advance too far, too early. He dinks it over you.'),
    opt('hold your line and read it', 'patience', 0.58, ['concentration', 'gkPositioning'], 2,
      { kind: 'save' }, 'Your patience pays off — he shoots straight at you.',
      { kind: 'beaten' }, 'He waits you out and slides it past your left hand.'),
  ]),
])

const gkShortBuildUp = scenario('gk-short-build-up', 'gk-distribution', ['good'], 'to-defender', [
  beat('to-defender', 'The ball comes back to you and your centre-backs are spread wide, inviting the pass.', [
    opt('roll it out short', 'trust the build-up', 0.72, ['distribution'], 1,
      { kind: 'distribution-good' }, 'A simple, composed start to the move.',
      { kind: 'distribution-poor' }, 'Under-hit and it nearly causes a real scare.'),
    opt('drive it long into midfield', 'skip the build-up', 0.6, ['distribution'], 2,
      { kind: 'distribution-good' }, 'A firm, accurate ball straight into midfield feet.',
      { kind: 'distribution-poor' }, 'Overhit and possession is surrendered cheaply.'),
  ]),
])

const gkSwitchPlay = scenario('gk-switch-play', 'gk-distribution', ['good', 'clear'], 'one-side-packed', [
  beat('one-side-packed', '{opp} have packed one side of the pitch, leaving space for an easy pass on the other.', [
    opt('go long diagonal to the space', 'exploit it', 0.5, ['distribution', 'vision'], 3,
      { kind: 'distribution-good' }, 'A gorgeous, raking diagonal — the switch is perfect.',
      { kind: 'distribution-poor' }, 'The distance is too much and it drifts out of play.'),
    opt('build it patiently instead', 'don\'t force it', 0.75, ['distribution'], 1,
      { kind: 'distribution-good' }, 'Patient and sensible. Possession is kept.',
      { kind: 'distribution-poor' }, 'Even the safe option goes astray under pressure.'),
  ]),
])

// ---------------------------------------------------------------------------
// FIFTH WAVE — pushing toward 50 scenarios, keeping every category balanced.
// ---------------------------------------------------------------------------
const attackQuickCounter = scenario('attack-quick-break', 'attack', ['clear'], 'loose-ball', [
  beat('loose-ball', 'A loose ball breaks kindly and {opp} are badly out of shape.', [
    opt('sprint straight at goal', 'no delay', 0.5, ['pace', 'agility'], 3,
      { kind: 'continue', beatId: 'closing-in' }, 'You burst clear before {opp} can organise.',
      { kind: 'chance-missed' }, 'A recovering defender gets across just in time.'),
    opt('bring a teammate into it', 'combination play', 0.68, ['vision', 'passing'], 1,
      { kind: 'continue', beatId: 'two-up' }, 'A quick one-two and you\'re both away.',
      { kind: 'chance-missed' }, 'The pass is cut out before it goes anywhere.'),
  ]),
  beat('closing-in', 'Just the last defender to beat now.', [
    opt('go past him', 'trust your feet', 0.45, ['dribbling', 'agility'], 3,
      { kind: 'goal' }, 'Beautiful skill — through and finished with real composure!',
      { kind: 'chance-missed' }, 'He recovers well and the chance is snuffed out.'),
  ]),
  beat('two-up', 'Two against the scrambling defence.', [
    opt('square it across', 'unselfish finish', 0.7, ['passing', 'vision'], 2,
      { kind: 'assist' }, 'Perfect ball across — tucked away with ease!',
      { kind: 'chance-missed' }, 'Slightly behind him and the chance is gone.'),
  ]),
])

const attackCutback = scenario('attack-byline-cutback', 'attack', ['good'], 'byline-run', [
  beat('byline-run', 'You reach the byline with a low cutback on.', [
    opt('cut it back low and hard', 'first-time finish on', 0.6, ['passing', 'vision'], 2,
      { kind: 'assist' }, 'Perfect low ball — smashed home first time!',
      { kind: 'chance-missed' }, 'Cut out just before it reaches the box.'),
    opt('go for the near post yourself', 'shoot on the angle', 0.4, ['shooting', 'composure'], 3,
      { kind: 'goal' }, 'An outrageous finish from the tightest angle!',
      { kind: 'chance-missed' }, 'The keeper is equal to it.'),
  ]),
])

const attackLongShot = scenario('attack-long-range', 'attack', ['good'], 'edge-of-area', [
  beat('edge-of-area', 'The ball sits up invitingly just outside the box.', [
    opt('hit it early', 'catch the keeper off guard', 0.4, ['shooting'], 3,
      { kind: 'goal' }, 'Unstoppable! In off the underside of the bar!',
      { kind: 'chance-missed' }, 'Well over. Ambitious but wasteful.'),
    opt('work it closer first', 'improve the angle', 0.62, ['dribbling', 'composure'], 1,
      { kind: 'continue', beatId: 'closer-look' }, 'A neat touch buys you a better sight of goal.',
      { kind: 'chance-missed' }, 'Crowded out before you can advance.'),
  ]),
  beat('closer-look', 'Inside the box now with a clearer look.', [
    opt('finish calmly', 'take your time', 0.65, ['composure', 'shooting'], 2,
      { kind: 'goal' }, 'Composed and clinical. In off the post.',
      { kind: 'chance-missed' }, 'The keeper reads it and saves well.'),
  ]),
])

const attackFlickOn = scenario('attack-flick-on', 'attack', ['good'], 'long-ball', [
  beat('long-ball', 'A long ball is played toward you with a defender tight behind.', [
    opt('flick it on', 'let it run', 0.55, ['positioning', 'composure'], 2,
      { kind: 'continue', beatId: 'chasing' }, 'A clever flick sends it spinning into space behind the defence.',
      { kind: 'chance-missed' }, 'The flick doesn\'t come off and possession is lost.'),
  ]),
  beat('chasing', 'The race is on for the flicked-on ball.', [
    opt('win the race', 'outpace your marker', 0.5, ['pace'], 2,
      { kind: 'goal' }, 'You win the race and finish coolly!',
      { kind: 'chance-missed' }, 'Just beaten to it by the recovering defender.'),
  ]),
])

const defendGoalLineClearance = scenario('defend-goal-line', 'defend', ['clear'], 'goal-bound', [
  beat('goal-bound', 'The ball is goal-bound and you are the only cover on the line.', [
    opt('dive to block it', 'commit everything', 0.42, ['positioning', 'agility'], 3,
      { kind: 'save' }, 'INCREDIBLE clearance! Off the line and away from danger!',
      { kind: 'beaten' }, 'You get a touch but it still creeps in. Devastating.'),
  ]),
])

const defendInterception = scenario('defend-read-the-pass', 'defend', ['good'], 'passing-lane', [
  beat('passing-lane', 'You spot the passing lane a split second before it opens.', [
    opt('step in and intercept', 'read it early', 0.58, ['positioning', 'concentration'], 2,
      { kind: 'save' }, 'Intercepted perfectly. Danger snuffed out before it began.',
      { kind: 'continue', beatId: 'recover' }, 'You jump the gun slightly and it slips through.'),
  ]),
  beat('recover', 'You need to recover quickly now.', [
    opt('sprint back into position', 'don\'t panic', 0.6, ['pace', 'concentration'], 1,
      { kind: 'save' }, 'You get back in time to smother the danger.',
      { kind: 'beaten' }, 'Can\'t recover — {opp} punish the gap.'),
  ]),
])

const defendPhysicalBattle = scenario('defend-physical-duel', 'defend', ['good'], 'shoulder-to-shoulder', [
  beat('shoulder-to-shoulder', 'A physical battle for the ball, shoulder to shoulder with your marker.', [
    opt('win it fair and strong', 'stand your ground', 0.55, ['strength', 'positioning'], 2,
      { kind: 'save' }, 'You win the battle cleanly and the danger passes.',
      { kind: 'continue', beatId: 'knocked-off' }, 'You\'re knocked off balance in the challenge.'),
  ]),
  beat('knocked-off', 'You scramble to get back into the contest.', [
    opt('recover the position', 'get back in the game', 0.5, ['agility', 'concentration'], 2,
      { kind: 'save' }, 'A scrambling recovery keeps the danger at bay.',
      { kind: 'beaten' }, 'Can\'t get back and {opp} take full advantage.'),
  ]),
])

const gkLowDrivenShot = scenario('gk-low-driven-shot', 'gk-defend', ['good', 'clear'], 'skidding-in', [
  beat('skidding-in', 'A low, driven shot skids awkwardly toward the corner of your goal.', [
    opt('get down early', 'commit to the dive', 0.5, ['reflexes', 'gkPositioning'], 3,
      { kind: 'save' }, 'Superb save, low to your right!',
      { kind: 'beaten' }, 'The bounce deceives you and it squeezes in.'),
  ]),
])

const gkHighShot = scenario('gk-top-corner-effort', 'gk-defend', ['clear'], 'dipping-effort', [
  beat('dipping-effort', 'A powerful, dipping effort flies toward the top corner.', [
    opt('stretch and tip it over', 'full extension', 0.4, ['reflexes'], 3,
      { kind: 'save' }, 'What a save! Tipped over the bar at full stretch!',
      { kind: 'beaten' }, 'Just out of reach. A goal you could do little about.'),
  ]),
])

const gkOneVsOnePanic = scenario('gk-narrow-angle', 'gk-defend', ['good'], 'tight-angle', [
  beat('tight-angle', 'The attacker has the ball at a tight angle, right by the byline.', [
    opt('stand your ground', 'protect the near post', 0.62, ['gkPositioning', 'concentration'], 2,
      { kind: 'save' }, 'You cover your angle perfectly. Nothing doing for the attacker.',
      { kind: 'beaten' }, 'Somehow finds the gap at the near post.'),
  ]),
])

const gkDeepRestart = scenario('gk-deep-restart', 'gk-distribution', ['half', 'good'], 'own-box', [
  beat('own-box', 'The ball is worked back to you deep in your own box.', [
    opt('play out calmly', 'stay composed', 0.72, ['distribution', 'composure'], 1,
      { kind: 'distribution-good' }, 'Composed and simple. The build-up continues.',
      { kind: 'distribution-poor' }, 'A heavy touch under no real pressure gives it away.'),
    opt('clear your lines', 'don\'t take the risk', 0.85, ['distribution'], 1,
      { kind: 'distribution-good' }, 'Sensible. Distance put between you and any danger.',
      { kind: 'distribution-poor' }, 'Even the safe option goes wrong.'),
  ]),
])

const gkCounterAttackStart = scenario('gk-launch-counter', 'gk-distribution', ['clear'], 'ball-won', [
  beat('ball-won', 'You\'ve just won the ball back and {team} have real space to counter into.', [
    opt('launch it long immediately', 'catch them cold', 0.48, ['distribution'], 3,
      { kind: 'distribution-good' }, 'A perfectly weighted long ball starts a dangerous counter!',
      { kind: 'distribution-poor' }, 'Overhit and the counter never materialises.'),
    opt('find the nearest option', 'keep it simple', 0.75, ['distribution'], 1,
      { kind: 'distribution-good' }, 'Simple and sensible. Possession retained.',
      { kind: 'distribution-poor' }, 'Even the simple option is fumbled away.'),
  ]),
])

const attackHeaderFromCorner = scenario('attack-corner-header-duel', 'attack', ['good', 'clear'], 'aerial-duel', [
  beat('aerial-duel', 'The corner is delivered and you rise for a genuine aerial contest.', [
    opt('attack it with full commitment', 'go for power', 0.52, ['strength', 'positioning'], 3,
      { kind: 'goal' }, 'Thundering header — right into the top corner!',
      { kind: 'chance-missed' }, 'Glanced just wide. So close.'),
    opt('glance it goalward', 'placement', 0.6, ['positioning', 'concentration'], 2,
      { kind: 'goal' }, 'Perfectly placed header, in off the post!',
      { kind: 'chance-missed' }, 'Straight at the keeper.'),
  ]),
])

const defendLastGaspBlock = scenario('defend-last-gasp', 'defend', ['clear'], 'shot-incoming', [
  beat('shot-incoming', 'The shot is on its way and you\'re the only body between it and goal.', [
    opt('block it any way you can', 'throw your body in', 0.45, ['positioning', 'strength'], 3,
      { kind: 'save' }, 'An heroic block! You take the full force of it!',
      { kind: 'beaten' }, 'You can\'t get there. In it goes.'),
  ]),
])

const defendSweeperRead = scenario('defend-sweeper-read', 'defend', ['good', 'clear'], 'through-ball-danger', [
  beat('through-ball-danger', 'A ball is threaded in behind and you have to sweep up before {opp} reaches it.', [
    opt('sprint out and clear it', 'get there first', 0.55, ['pace', 'positioning'], 2,
      { kind: 'save' }, 'You reach it well before danger and clear comfortably.',
      { kind: 'continue', beatId: 'foot-race-2' }, 'It\'s tighter than expected — a genuine race now.'),
  ]),
  beat('foot-race-2', 'Neck and neck with the onrushing striker.', [
    opt('slide it away first', 'win the touch', 0.48, ['tackling', 'agility'], 2,
      { kind: 'save' }, 'You get there first and slide it clear!',
      { kind: 'beaten' }, 'He wins the touch and finishes well.'),
  ]),
])

const gkCommandingClaim = scenario('gk-commanding-claim', 'gk-defend', ['good'], 'crowded-box', [
  beat('crowded-box', 'The box is crowded and a cross floats in right through the middle of the chaos.', [
    opt('shout and claim it', 'take total charge', 0.55, ['handling', 'concentration'], 2,
      { kind: 'save' }, 'A commanding claim right through the traffic. Total authority.',
      { kind: 'beaten' }, 'You\'re beaten to it in the crowd and it\'s turned home.'),
  ]),
])

// ============================================================================
// SINGLE MOMENTS — one decision, resolved immediately. No branching, no
// continue outcomes. These are the "just one decision" pool Joel asked for
// as a DISTINCT category from the multi-beat scenarios above — corners, free
// kicks and penalties as their own dedicated single-event moments (separate
// from the fuller multi-beat set-piece SCENARIOS already built), plus a wide
// spread of routine attacking/defending/goalkeeping situations so a match
// never runs out of fresh single-shot content either.
// ============================================================================

// ---- set pieces, as dedicated single-event moments ----
const cornerAttack1 = scenario('moment-corner-near-post', 'attack', ['good'], 'x', [
  beat('x', 'The corner whips in toward the near post and you\'ve found a yard of space.', [
    opt('flick it goalward', 'glance it in', 0.55, ['positioning', 'concentration'], 2,
      { kind: 'goal' }, 'Glanced in at the near post! Beautiful technique.',
      { kind: 'chance-missed' }, 'Just wide of the target.'),
    opt('nod it across for a teammate', 'unselfish', 0.65, ['positioning', 'vision'], 1,
      { kind: 'assist' }, 'Flicked into the danger zone — turned home!',
      { kind: 'chance-missed' }, 'Nobody is there to finish it.'),
  ]),
])
const cornerAttack2 = scenario('moment-corner-far-post', 'attack', ['good', 'clear'], 'x', [
  beat('x', 'The corner is delivered long, all the way to the back post where you\'re waiting.', [
    opt('power header down', 'aim for the ground', 0.5, ['strength', 'positioning'], 3,
      { kind: 'goal' }, 'Thundered downward, impossible to keep out!',
      { kind: 'chance-missed' }, 'Glanced over the bar.'),
  ]),
])
const freeKickDirect1 = scenario('moment-free-kick-edge', 'attack', ['good', 'clear'], 'x', [
  beat('x', 'A free kick right on the edge of the box, a clear sight of goal.', [
    opt('curl it over the wall', 'classic technique', 0.42, ['shooting', 'composure'], 3,
      { kind: 'goal' }, 'Over the wall and into the top corner! Textbook free kick.',
      { kind: 'chance-missed' }, 'Cannons off the wall.'),
    opt('drive it under the wall', 'low and hard', 0.45, ['shooting'], 3,
      { kind: 'goal' }, 'Fired low under the jumping wall — in!',
      { kind: 'chance-missed' }, 'Blocked by a diving defender.'),
  ]),
])
const freeKickDirect2 = scenario('moment-free-kick-wide', 'attack', ['good'], 'x', [
  beat('x', 'A free kick from a wide position, more a cross than a shot really.', [
    opt('whip it into the box', 'find a head', 0.6, ['passing', 'vision'], 1,
      { kind: 'assist' }, 'Perfect delivery — met powerfully!',
      { kind: 'chance-missed' }, 'Cleared by the defence.'),
  ]),
])
const penaltyMoment1 = scenario('moment-penalty-cool', 'attack', ['clear'], 'x', [
  beat('x', 'A penalty. Everything stops. It\'s just you, the ball, and the goalkeeper.', [
    opt('pick your corner early', 'commit to the side', 0.62, ['composure', 'shooting'], 2,
      { kind: 'goal' }, 'Ice cold. Sent the keeper the wrong way.',
      { kind: 'chance-missed' }, 'He guesses right and saves it.'),
    opt('wait and react to the keeper', 'read him', 0.55, ['composure', 'concentration'], 2,
      { kind: 'goal' }, 'Waited him out and rolled it the other way. Composed.',
      { kind: 'chance-missed' }, 'He stays central and blocks it.'),
  ]),
])
const penaltyMoment2 = scenario('moment-penalty-pressure', 'attack', ['clear'], 'x', [
  beat('x', 'A penalty in the last minute, with the whole match riding on it.', [
    opt('go with your gut', 'trust instinct', 0.5, ['composure', 'shooting'], 3,
      { kind: 'goal' }, 'Buried under the most intense pressure imaginable!',
      { kind: 'chance-missed' }, 'The weight of the moment gets to you. Saved.'),
  ]),
])

// ---- attacking single moments ----
const m1 = scenario('moment-cushioned-volley', 'attack', ['good'], 'x', [
  beat('x', 'A dropping ball invites a first-time volley just inside the box.', [
    opt('volley it first time', 'no control needed', 0.45, ['shooting', 'agility'], 3,
      { kind: 'goal' }, 'Struck beautifully on the volley!',
      { kind: 'chance-missed' }, 'Miscued it well over.'),
    opt('cushion it down first', 'control it', 0.6, ['composure'], 2,
      { kind: 'goal' }, 'A lovely cushioned touch, then finished calmly.',
      { kind: 'chance-missed' }, 'The touch runs away from you.'),
  ]),
])
const m2 = scenario('moment-one-touch-finish', 'attack', ['clear'], 'x', [
  beat('x', 'The ball is played across the six-yard box, begging for a first-time finish.', [
    opt('side-foot it in', 'don\'t overthink it', 0.6, ['composure', 'shooting'], 2,
      { kind: 'goal' }, 'Simple as you like. Tucked in first time.',
      { kind: 'chance-missed' }, 'Somehow skewed it wide.'),
  ]),
])
const m3 = scenario('moment-dinked-finish', 'attack', ['good'], 'x', [
  beat('x', 'The keeper is off his line and there\'s a sight of an open net.', [
    opt('dink it over him', 'audacious lob', 0.4, ['composure', 'shooting'], 3,
      { kind: 'goal' }, 'Delightfully dinked over the keeper!',
      { kind: 'chance-missed' }, 'Overhit and it drifts wide.'),
  ]),
])
const m4 = scenario('moment-mazy-dribble', 'attack', ['good'], 'x', [
  beat('x', 'Space in front of you and a defence not yet set.', [
    opt('run at them directly', 'take them all on', 0.42, ['dribbling', 'agility'], 3,
      { kind: 'goal' }, 'A mazy run beats three men — finished with real style!',
      { kind: 'chance-missed' }, 'Eventually crowded out.'),
  ]),
])
const m5 = scenario('moment-rebound-pounce', 'attack', ['clear'], 'x', [
  beat('x', 'The keeper spills it and the rebound falls right at your feet.', [
    opt('pounce on it instantly', 'no hesitation', 0.65, ['composure'], 2,
      { kind: 'goal' }, 'Never in doubt. Tucked away from the rebound.',
      { kind: 'chance-missed' }, 'Somehow scuffed the simplest of chances.'),
  ]),
])
const m6 = scenario('moment-outside-boot', 'attack', ['good'], 'x', [
  beat('x', 'An awkward bouncing ball with no time to set yourself properly.', [
    opt('try the outside of the boot', 'improvise', 0.4, ['dribbling', 'composure'], 3,
      { kind: 'goal' }, 'Outrageous technique — curled in with the outside of the boot!',
      { kind: 'chance-missed' }, 'The connection is never clean enough.'),
  ]),
])
const m7 = scenario('moment-give-and-go', 'attack', ['good'], 'x', [
  beat('x', 'A quick give-and-go opens up a sliver of space in the box.', [
    opt('take the return pass on', 'trust the move', 0.58, ['vision', 'composure'], 2,
      { kind: 'goal' }, 'The one-two works to perfection. Finished with ease!',
      { kind: 'chance-missed' }, 'The return pass is a fraction off.'),
  ]),
])
const m8 = scenario('moment-square-ball', 'attack', ['good'], 'x', [
  beat('x', 'A teammate is completely unmarked in a better position than you.', [
    opt('square it across', 'the unselfish choice', 0.75, ['vision', 'passing'], 1,
      { kind: 'assist' }, 'Generous and correct — tapped in gratefully.',
      { kind: 'chance-missed' }, 'The pass is cut out at the last second.'),
  ]),
])
const m9 = scenario('moment-half-volley', 'attack', ['good'], 'x', [
  beat('x', 'The ball bounces up perfectly for a half-volley on the edge of the area.', [
    opt('strike it clean', 'meet it on the bounce', 0.44, ['shooting', 'composure'], 3,
      { kind: 'goal' }, 'A thunderous half-volley — in off the crossbar!',
      { kind: 'chance-missed' }, 'Struck the side netting.'),
  ]),
])
const m10 = scenario('moment-back-post-tap-in', 'attack', ['clear'], 'x', [
  beat('x', 'You\'ve ghosted in at the back post completely unmarked.', [
    opt('finish it off', 'simple as it comes', 0.72, ['composure'], 1,
      { kind: 'goal' }, 'Couldn\'t miss that if you tried. Tucked away.',
      { kind: 'chance-missed' }, 'Somehow contrives to miss an open goal.'),
  ]),
])

// ---- defending single moments ----
const d1 = scenario('moment-sliding-tackle', 'defend', ['good'], 'x', [
  beat('x', 'A winger is bearing down and a sliding tackle is your best option.', [
    opt('slide in cleanly', 'time it right', 0.5, ['tackling', 'agility'], 2,
      { kind: 'save' }, 'Perfectly timed — won the ball clean!',
      { kind: 'beaten' }, 'Mistimed it and he skips past.'),
  ]),
])
const d2 = scenario('moment-aerial-duel', 'defend', ['good'], 'x', [
  beat('x', 'A long ball is played and you\'re first to challenge in the air.', [
    opt('attack the header', 'go for it fully', 0.58, ['strength', 'positioning'], 2,
      { kind: 'save' }, 'Won the header comfortably. Danger cleared.',
      { kind: 'beaten' }, 'Beaten in the air and it costs you.'),
  ]),
])
const d3 = scenario('moment-track-the-run', 'defend', ['good'], 'x', [
  beat('x', 'A runner tries to sneak in behind your line.', [
    opt('stay tight and track it', 'discipline', 0.65, ['positioning', 'concentration'], 1,
      { kind: 'save' }, 'You track it perfectly. Nothing on offer.',
      { kind: 'beaten' }, 'You lose him for just long enough.'),
  ]),
])
const d4 = scenario('moment-block-the-cross', 'defend', ['good'], 'x', [
  beat('x', 'A winger shapes to cross and you close him down fast.', [
    opt('block it down', 'commit to the block', 0.52, ['positioning', 'agility'], 2,
      { kind: 'save' }, 'Blocked it down before it becomes dangerous!',
      { kind: 'beaten' }, 'The cross gets through and causes real problems.'),
  ]),
])
const d5 = scenario('moment-last-ditch-clearance', 'defend', ['clear'], 'x', [
  beat('x', 'The ball is dangerously loose right in your own six-yard box.', [
    opt('hack it clear', 'no time for finesse', 0.68, ['strength'], 1,
      { kind: 'save' }, 'Cleared to safety. Not pretty, but effective.',
      { kind: 'beaten' }, 'Sliced it and it drops for an easy finish.'),
  ]),
])
const d6 = scenario('moment-shepherd-out', 'defend', ['half', 'good'], 'x', [
  beat('x', 'The ball is running toward the touchline with an attacker chasing.', [
    opt('shepherd it out calmly', 'use your body', 0.7, ['strength', 'positioning'], 1,
      { kind: 'save' }, 'Shepherded out for a throw-in. Simple and effective.',
      { kind: 'beaten' }, 'Beaten to it and the danger continues.'),
  ]),
])
const d7 = scenario('moment-reading-danger', 'defend', ['good'], 'x', [
  beat('x', 'You sense danger building before anyone else seems to.', [
    opt('step up and cut it out', 'trust your instincts', 0.6, ['concentration', 'positioning'], 2,
      { kind: 'save' }, 'Read it perfectly. Danger dealt with before it started.',
      { kind: 'beaten' }, 'Your instinct is a fraction too early.'),
  ]),
])
const d8 = scenario('moment-covering-run', 'defend', ['good'], 'x', [
  beat('x', 'A teammate is beaten and you\'re the covering defender.', [
    opt('sprint across to cover', 'make up the ground', 0.55, ['pace', 'concentration'], 2,
      { kind: 'save' }, 'You cover brilliantly and snuff out the danger.',
      { kind: 'beaten' }, 'Can\'t make up the ground in time.'),
  ]),
])
const d9 = scenario('moment-closing-down-shooter', 'defend', ['good'], 'x', [
  beat('x', 'An attacker winds up to shoot and you have half a second to close him down.', [
    opt('rush out and block', 'get a body in the way', 0.5, ['pace', 'positioning'], 2,
      { kind: 'save' }, 'Charged down brilliantly before the shot could threaten.',
      { kind: 'beaten' }, 'Too slow to close the gap. In it goes.'),
  ]),
])
const d10 = scenario('moment-defending-set-piece-header', 'defend', ['good'], 'x', [
  beat('x', 'A set piece delivery arrives and your marker is right beside you.', [
    opt('win the first contact', 'attack the ball', 0.55, ['strength', 'positioning'], 2,
      { kind: 'save' }, 'You win the first contact and the danger is cleared.',
      { kind: 'beaten' }, 'Beaten to the first contact.'),
  ]),
])
const d11 = scenario('moment-cut-out-through-ball', 'defend', ['good'], 'x', [
  beat('x', 'A dangerous through-ball threatens to split your defensive line.', [
    opt('step up and intercept', 'read the pass', 0.55, ['concentration', 'positioning'], 2,
      { kind: 'save' }, 'Stepped up perfectly to cut it out.',
      { kind: 'beaten' }, 'The timing is off and it splits you open.'),
  ]),
])
const d12 = scenario('moment-recovery-run', 'defend', ['good', 'clear'], 'x', [
  beat('x', 'You\'ve been caught upfield and now have to sprint the length of the pitch to recover.', [
    opt('give everything to get back', 'full effort', 0.5, ['pace', 'stamina'], 2,
      { kind: 'save' }, 'An incredible recovery run saves the situation.',
      { kind: 'beaten' }, 'You simply cannot make it back in time.'),
  ]),
])

// ---- goalkeeper defending single moments ----
const gk1 = scenario('moment-low-save', 'gk-defend', ['good'], 'x', [
  beat('x', 'A low shot skims toward the corner of the goal.', [
    opt('get down quickly', 'commit early', 0.55, ['reflexes'], 2,
      { kind: 'save' }, 'Solid save, comfortably gathered.',
      { kind: 'beaten' }, 'Just too late to get down.'),
  ]),
])
const gk2 = scenario('moment-high-save', 'gk-defend', ['good'], 'x', [
  beat('x', 'A header flies toward the top corner.', [
    opt('leap and tip it over', 'full stretch', 0.5, ['reflexes', 'gkPositioning'], 2,
      { kind: 'save' }, 'Superb leap — tipped over the bar!',
      { kind: 'beaten' }, 'Just out of reach.'),
  ]),
])
const gk3 = scenario('moment-cross-under-pressure', 'gk-defend', ['good'], 'x', [
  beat('x', 'A cross comes in with attackers bearing down on you.', [
    opt('come and claim it', 'take charge of your box', 0.5, ['handling', 'gkPositioning'], 2,
      { kind: 'save' }, 'Claimed with total authority despite the pressure.',
      { kind: 'beaten' }, 'Caught in no man\'s land. Costly.'),
  ]),
])
const gk4 = scenario('moment-deflected-shot', 'gk-defend', ['good'], 'x', [
  beat('x', 'A shot takes a deflection and changes direction suddenly.', [
    opt('react on instinct', 'trust your reflexes', 0.45, ['reflexes'], 3,
      { kind: 'save' }, 'Lightning reactions — somehow kept it out!',
      { kind: 'beaten' }, 'No chance to react to the deflection.'),
  ]),
])
const gk5 = scenario('moment-back-pass-pressure', 'gk-distribution', ['good'], 'x', [
  beat('x', 'A back-pass arrives with an attacker closing you down fast.', [
    opt('clear it first time', 'no time to think', 0.65, ['distribution'], 1,
      { kind: 'distribution-good' }, 'Cleared calmly under real pressure.',
      { kind: 'distribution-poor', canConcedeDirectly: true }, 'Panicked and it goes horribly wrong.'),
  ]),
])
const gk6 = scenario('moment-command-the-box', 'gk-defend', ['good'], 'x', [
  beat('x', 'A corner is swung in and it\'s a genuine contest in a crowded box.', [
    opt('shout and come for it', 'be decisive', 0.55, ['handling', 'concentration'], 2,
      { kind: 'save' }, 'A decisive, commanding claim.',
      { kind: 'beaten' }, 'Indecision costs you dearly.'),
  ]),
])

// ---- goalkeeper distribution single moments ----
const gd1 = scenario('moment-quick-throw', 'gk-distribution', ['good'], 'x', [
  beat('x', 'You have the ball in hand and space to exploit with a quick throw.', [
    opt('throw it out fast', 'catch them cold', 0.6, ['distribution', 'reflexes'], 2,
      { kind: 'distribution-good' }, 'Quick thinking starts a promising move.',
      { kind: 'distribution-poor' }, 'Rushed and inaccurate.'),
  ]),
])
const gd2 = scenario('moment-long-goal-kick', 'gk-distribution', ['good'], 'x', [
  beat('x', 'A routine goal kick, but the wind makes it hard to judge the pass.', [
    opt('go long as normal', 'trust your technique', 0.72, ['distribution'], 1,
      { kind: 'distribution-good' }, 'A good, clean strike despite the conditions.',
      { kind: 'distribution-poor' }, 'The wind catches it awkwardly.'),
  ]),
])
const gd3 = scenario('moment-short-build', 'gk-distribution', ['good'], 'x', [
  beat('x', 'Your centre-back offers a simple passing option to build from the back.', [
    opt('roll it out short', 'keep it simple', 0.8, ['distribution'], 1,
      { kind: 'distribution-good' }, 'Simple, composed, effective.',
      { kind: 'distribution-poor' }, 'Even this simple pass goes astray.'),
  ]),
])
const gd4 = scenario('moment-drop-kick', 'gk-distribution', ['good'], 'x', [
  beat('x', 'You catch it clean and have space to pick out a good drop-kick.', [
    opt('drive it long', 'go for distance', 0.6, ['distribution'], 2,
      { kind: 'distribution-good' }, 'A booming drop-kick finds a teammate in space.',
      { kind: 'distribution-poor' }, 'Miscued and possession is lost.'),
  ]),
])
const gd5 = scenario('moment-under-pressure-clearance', 'gk-distribution', ['good'], 'x', [
  beat('x', 'An attacker is closing you down as you receive the ball at your feet.', [
    opt('clear it under pressure', 'don\'t panic', 0.58, ['distribution', 'composure'], 2,
      { kind: 'distribution-good' }, 'Composed under real pressure.',
      { kind: 'distribution-poor', canConcedeDirectly: true }, 'The pressure gets to you badly.'),
  ]),
])
const gd6 = scenario('moment-switch-the-play', 'gk-distribution', ['good'], 'x', [
  beat('x', 'One flank is completely overloaded — the other has space for an easy pass.', [
    opt('switch it long', 'exploit the space', 0.52, ['distribution', 'vision'], 2,
      { kind: 'distribution-good' }, 'A raking switch finds the space perfectly.',
      { kind: 'distribution-poor' }, 'The distance is too much to control.'),
  ]),
])

export const SCENARIOS: MatchScenario[] = [
  halfwayCarry, counterAttack, setPieceAttack, lastManRace, boxScramble, goalkeeperOneOnOne,
  wingerRun, midfieldDribble, penaltyBoxCross, throughBallRace,
  midfieldPress, setPieceDefend, counterDefend,
  gkPenalty, gkCrossCommand,
  gkBuildFromBack, gkQuickCounter, gkGoalKickPressure,
  attackWonderGoal, attackOverlap, attackDeepCross,
  defendOneVsTwo, defendHighLine, defendCornerClearance,
  gkReactionSave,
  attackFreeKick, attackDribbleBox, attackHeaderChance,
  defendTrackingRun, defendShieldingBall,
  gkClaimOrPunch, gkOneOnOneCoolHead,
  gkShortBuildUp, gkSwitchPlay,
  attackQuickCounter, attackCutback, attackLongShot, attackFlickOn,
  defendGoalLineClearance, defendInterception, defendPhysicalBattle,
  gkLowDrivenShot, gkHighShot, gkOneVsOnePanic,
  gkDeepRestart, gkCounterAttackStart,
  attackHeaderFromCorner, defendLastGaspBlock,
  defendSweeperRead, gkCommandingClaim,
]

/** P41 — the "single moment" pool: 1-beat entries, no branching. Distinct
 * from SCENARIOS above (which are the 2+ beat storylines) but built on the
 * exact same data shape and engine — nothing new to wire up. */
// ---- second wave of single moments — filling out gk-defend/gk-distribution
// (the thinnest categories) plus more attack/defend depth ----
const gk7 = scenario('moment-point-blank-save', 'gk-defend', ['clear'], 'x', [
  beat('x', 'A close-range effort is fired at you from almost point-blank.', [
    opt('block instinctively', 'no time to think', 0.42, ['reflexes'], 3,
      { kind: 'save' }, 'An unbelievable reaction save at point-blank range!',
      { kind: 'beaten' }, 'Too close, too fast. No chance.'),
  ]),
])
const gk8 = scenario('moment-diving-stop', 'gk-defend', ['good', 'clear'], 'x', [
  beat('x', 'A curling effort heads for the far corner of your goal.', [
    opt('dive full length', 'commit early', 0.48, ['reflexes', 'gkPositioning'], 3,
      { kind: 'save' }, 'A full-length dive — brilliantly saved!',
      { kind: 'beaten' }, 'Gets a fingertip to it but it still creeps in.'),
  ]),
])
const gk9 = scenario('moment-one-on-one-block', 'gk-defend', ['clear'], 'x', [
  beat('x', 'The striker rounds the last defender and it\'s just the two of you.', [
    opt('narrow the angle fast', 'come off your line', 0.5, ['gkPositioning', 'reflexes'], 3,
      { kind: 'save' }, 'You close him down perfectly and smother the effort!',
      { kind: 'beaten' }, 'He finds the gap you left. Clinical finish.'),
  ]),
])
const gk10 = scenario('moment-free-kick-wall-save', 'gk-defend', ['good'], 'x', [
  beat('x', 'A direct free kick swerves unpredictably around your defensive wall.', [
    opt('adjust and dive', 'trust your read', 0.45, ['reflexes', 'concentration'], 3,
      { kind: 'save' }, 'A brilliant late adjustment — tipped around the post!',
      { kind: 'beaten' }, 'The late swerve deceives you completely.'),
  ]),
])
const gk11 = scenario('moment-scramble-save', 'gk-defend', ['clear'], 'x', [
  beat('x', 'The ball bobbles dangerously around your six-yard box.', [
    opt('smother it on the ground', 'get down fast', 0.5, ['reflexes', 'handling'], 2,
      { kind: 'save' }, 'Smothered safely despite the chaos.',
      { kind: 'beaten' }, 'It squirms free and is bundled home.'),
  ]),
])
const gd7 = scenario('moment-half-clearance-under-press', 'gk-distribution', ['good'], 'x', [
  beat('x', 'The ball comes back to you with an attacker closing fast, no easy option on.', [
    opt('boot it long, no risk', 'safety first', 0.78, ['distribution'], 1,
      { kind: 'distribution-good' }, 'Sensible under pressure. Danger cleared.',
      { kind: 'distribution-poor' }, 'Rushed and it goes straight out for a throw.'),
  ]),
])
const gd8 = scenario('moment-throw-to-fullback', 'gk-distribution', ['good'], 'x', [
  beat('x', 'Your full-back peels off into space, offering a simple pass out.', [
    opt('find him with a throw', 'trust the pass', 0.75, ['distribution'], 1,
      { kind: 'distribution-good' }, 'Picked out perfectly. The build-up continues calmly.',
      { kind: 'distribution-poor' }, 'Underhit and it nearly causes a real scare.'),
  ]),
])
const gd9 = scenario('moment-first-time-clearance', 'gk-distribution', ['good'], 'x', [
  beat('x', 'A back-pass arrives fast and you need to deal with it in one motion.', [
    opt('clear it first time', 'no second touch', 0.62, ['distribution', 'composure'], 2,
      { kind: 'distribution-good' }, 'Dealt with cleanly under pressure.',
      { kind: 'distribution-poor', canConcedeDirectly: true }, 'Mishit horribly under the pressure.'),
  ]),
])

// ---- more attack single moments ----
const m11 = scenario('moment-toe-poke-finish', 'attack', ['clear'], 'x', [
  beat('x', 'A scramble in the box leaves the ball loose right at your toes.', [
    opt('poke it home', 'no time for technique', 0.65, ['composure'], 2,
      { kind: 'goal' }, 'Scrappy but it counts! Bundled over the line.',
      { kind: 'chance-missed' }, 'Somehow scuffs it wide from close range.'),
  ]),
])
const m12 = scenario('moment-driven-low-shot', 'attack', ['good'], 'x', [
  beat('x', 'Space opens up on the edge of the box for a low, driven effort.', [
    opt('drive it low and hard', 'along the ground', 0.48, ['shooting'], 3,
      { kind: 'goal' }, 'Fizzed in low, no chance for the keeper!',
      { kind: 'chance-missed' }, 'Straight at the keeper, well saved.'),
  ]),
])
const m13 = scenario('moment-near-post-run', 'attack', ['good'], 'x', [
  beat('x', 'You time a run to the near post as the cross comes in.', [
    opt('meet it first time', 'get there early', 0.55, ['positioning', 'pace'], 2,
      { kind: 'goal' }, 'Beat your marker to the near post — in!',
      { kind: 'chance-missed' }, 'Just cannot connect properly.'),
  ]),
])
const m14 = scenario('moment-backheel-flick', 'attack', ['good'], 'x', [
  beat('x', 'An outrageous backheel opportunity presents itself in the box.', [
    opt('try the backheel', 'pure audacity', 0.32, ['dribbling', 'composure'], 3,
      { kind: 'goal' }, 'UNBELIEVABLE! The backheel goes in!',
      { kind: 'chance-missed' }, 'Doesn\'t come off — a brave attempt though.'),
  ]),
])
const m15 = scenario('moment-far-post-tap', 'attack', ['clear'], 'x', [
  beat('x', 'You arrive completely free at the far post.', [
    opt('side-foot it home', 'simple finish', 0.72, ['composure'], 1,
      { kind: 'goal' }, 'Couldn\'t miss. Tapped in at the far post.',
      { kind: 'chance-missed' }, 'Somehow contrives to miss.'),
  ]),
])
const m16 = scenario('moment-swivel-and-shoot', 'attack', ['good'], 'x', [
  beat('x', 'The ball arrives with your back to goal, tightly marked.', [
    opt('swivel and shoot', 'turn on a sixpence', 0.4, ['agility', 'shooting'], 3,
      { kind: 'goal' }, 'A brilliant turn and finish in one movement!',
      { kind: 'chance-missed' }, 'The connection is never clean enough.'),
  ]),
])

// ---- more defend single moments ----
const d13 = scenario('moment-blocking-a-shot', 'defend', ['good', 'clear'], 'x', [
  beat('x', 'A shot is about to be unleashed and you\'re in the firing line.', [
    opt('get your body behind it', 'commit fully', 0.5, ['positioning', 'strength'], 2,
      { kind: 'save' }, 'Bravely blocked. The danger is cleared.',
      { kind: 'beaten' }, 'You can\'t get across in time.'),
  ]),
])
const d14 = scenario('moment-recovering-tackle', 'defend', ['good'], 'x', [
  beat('x', 'You\'ve been beaten once but there\'s still a chance to recover.', [
    opt('chase back and tackle', 'never stop working', 0.48, ['pace', 'tackling'], 2,
      { kind: 'save' }, 'A brilliant recovery tackle wins the ball back!',
      { kind: 'beaten' }, 'Can\'t make up the ground.'),
  ]),
])
const d15 = scenario('moment-marking-the-set-piece', 'defend', ['good'], 'x', [
  beat('x', 'You\'re man-marking their most dangerous player at a set piece.', [
    opt('stay glued to him', 'total focus', 0.62, ['concentration', 'positioning'], 1,
      { kind: 'save' }, 'You give him absolutely nothing. Job done.',
      { kind: 'beaten' }, 'He loses you for just a moment — enough.'),
  ]),
])
const d16 = scenario('moment-tracking-overlap', 'defend', ['good'], 'x', [
  beat('x', 'An overlapping run threatens to get in behind you.', [
    opt('track the run all the way', 'stay disciplined', 0.55, ['pace', 'positioning'], 2,
      { kind: 'save' }, 'Tracked perfectly. The overlap comes to nothing.',
      { kind: 'beaten' }, 'Loses the race and it costs your side.'),
  ]),
])

const d17 = scenario('moment-desperate-tackle', 'defend', ['good', 'clear'], 'x', [
  beat('x', 'You\'ve been turned and there\'s only a desperate lunge left to stop the danger.', [
    opt('go to ground for it', 'commit everything — real card risk', 0.42, ['tackling', 'agility'], 3,
      { kind: 'save' }, 'A brilliant desperate tackle wins the ball clean!',
      { kind: 'beaten' }, 'The lunge doesn\'t connect and the danger continues.', 0.3),
  ]),
])
const m17 = scenario('moment-instinctive-poacher', 'attack', ['clear'], 'x', [
  beat('x', 'A poacher\'s instinct puts you in exactly the right place at exactly the right time.', [
    opt('react first', 'trust your instincts', 0.6, ['positioning', 'composure'], 2,
      { kind: 'goal' }, 'A true poacher\'s finish — first to react, and it\'s in!',
      { kind: 'chance-missed' }, 'Your first touch lets you down at the crucial moment.'),
  ]),
])

/* V3.2 creation expansion — assist-first attacking passages.
   These deliberately make the final action a pass/cross/cutback rather than
   another disguised shooting opportunity. Position-aware routing in match.ts
   can weight this pool heavily for midfielders, wide players and full-backs. */
const creationSlipPass = scenario('creation-slip-pass', 'attack', ['good','clear'], 'x', [
  beat('x','A runner darts between centre-back and full-back and you have a split-second window.',[
    opt('thread the through ball','split the line',0.68,['vision','passing'],2,{kind:'assist'},'Perfectly threaded — your teammate takes it in stride and finishes!',{kind:'chance-missed'},'The gap closes and the pass is intercepted.',undefined,'keyPass'),
    opt('delay then disguise it','wait for the lane',0.60,['composure','vision'],2,{kind:'assist'},'You freeze the defence, disguise the pass and the finish is clinical.',{kind:'chance-missed'},'You wait a fraction too long and the run is tracked.',undefined,'keyPass'),
  ]),
])
const creationCutback = scenario('creation-cutback', 'attack', ['good','clear'], 'x', [
  beat('x','You reach the byline with two teammates arriving around the penalty spot.',[
    opt('cut it back low','pick the late runner',0.72,['passing','vision'],2,{kind:'assist'},'Pulled back perfectly — swept into the corner!',{kind:'chance-missed'},'A defender gets a toe to the cutback.',undefined,'keyPass'),
    opt('drill it across goal','make the striker attack it',0.62,['passing','composure'],2,{kind:'assist'},'Driven across the six-yard box and turned home!',{kind:'chance-missed'},'The ball flashes through everyone.',undefined,'keyPass'),
  ]),
])
const creationOverlap = scenario('creation-overlap-cross', 'attack', ['half','good'], 'x', [
  beat('x','Your overlap gives you a yard of space outside the box and runners are attacking the area.',[
    opt('cross early','bend it behind the defence',0.60,['passing','vision'],2,{kind:'assist'},'A beautiful early cross drops onto the striker\'s run — goal!',{kind:'chance-missed'},'Too close to the keeper, who claims it.',undefined,'keyPass'),
    opt('drive to the byline','improve the angle',0.66,['pace','dribbling'],1,{kind:'continue',beatId:'delivery'},'You burst beyond the full-back and look up.',{kind:'chance-missed'},'The full-back recovers and blocks your route.'),
  ]),
  beat('delivery','You have time for one delivery before the defence resets.',[
    opt('stand it to the back post','find the far-side runner',0.64,['passing','vision'],2,{kind:'assist'},'Hung up beautifully — headed home at the back post!',{kind:'chance-missed'},'The cross sails just beyond the runner.',undefined,'keyPass'),
    opt('low ball across six yards','attack the corridor',0.70,['passing','composure'],2,{kind:'assist'},'Right through the danger zone — tapped in!',{kind:'chance-missed'},'A centre-back stretches to clear.',undefined,'keyPass'),
  ]),
])
const creationWallPass = scenario('creation-wall-pass', 'attack', ['half','good'], 'x', [
  beat('x','You receive between the lines with a teammate making a sharp run beyond you.',[
    opt('one-touch return','play the give-and-go',0.72,['passing','vision'],2,{kind:'assist'},'One touch splits them open — your teammate finishes the move!',{kind:'chance-missed'},'The return pass is slightly underhit.',undefined,'keyPass'),
    opt('turn and release the runner','draw a defender first',0.64,['dribbling','vision'],2,{kind:'assist'},'You draw the defender and release the runner at exactly the right moment — goal!',{kind:'chance-missed'},'The defender reads your intention and cuts it out.',undefined,'keyPass'),
  ]),
])
const creationSwitch = scenario('creation-switch-and-cross', 'attack', ['half','good'], 'x', [
  beat('x','The defence has collapsed to your side and the opposite flank is completely free.',[
    opt('switch it first time','attack the weak side',0.76,['passing','vision'],1,{kind:'continue',beatId:'finish'},'The switch lands perfectly and the defence has to sprint across.',{kind:'chance-missed'},'The switch hangs too long and is intercepted.',undefined,'keyPass'),
  ]),
  beat('finish','Your teammate attacks the space and you continue forward for the return phase.',[
    opt('slide the final pass','find the inside run',0.68,['vision','passing'],2,{kind:'assist'},'The return opens the defence and your final pass is converted!',{kind:'chance-missed'},'The final ball is cut out.',undefined,'keyPass'),
  ]),
])
const creationCounter = scenario('creation-counter-release', 'attack', ['good','clear'], 'x', [
  beat('x','You win space on the counter with a teammate sprinting beyond the last defender.',[
    opt('release him early','use the open grass',0.70,['vision','passing'],2,{kind:'assist'},'Released at exactly the right time — one touch, finish, goal!',{kind:'chance-missed'},'The pass sends him too wide and the chance dies.',undefined,'keyPass'),
    opt('carry then slip it','commit the defender first',0.60,['dribbling','vision'],2,{kind:'assist'},'You commit the defender and slip your teammate through for the finish!',{kind:'chance-missed'},'The defender times his challenge and stops the break.',undefined,'keyPass'),
  ]),
])
const creationCrossfield = scenario('creation-crossfield-delivery', 'attack', ['good'], 'x', [
  beat('x','You have possession in the half-space while three teammates attack the back line.',[
    opt('clip it behind the full-back','find the blind-side run',0.65,['passing','vision'],2,{kind:'assist'},'Clipped into the blind side — controlled and finished!',{kind:'chance-missed'},'A fraction too much on it and it runs through.',undefined,'keyPass'),
    opt('reverse pass inside','catch them looking outward',0.62,['vision','composure'],2,{kind:'assist'},'A gorgeous reverse pass opens the box — finished first time!',{kind:'chance-missed'},'The centre-back anticipates it.',undefined,'keyPass'),
  ]),
])
const creationSetPiece = scenario('creation-set-piece-delivery', 'attack', ['good','clear'], 'x', [
  beat('x','A wide free kick gives you the chance to deliver into a packed penalty area.',[
    opt('whip it across the keeper','invite the first touch',0.61,['passing','vision'],2,{kind:'assist'},'Whipped into the perfect corridor — glanced home!',{kind:'chance-missed'},'The keeper punches through the crowd.',undefined,'keyPass'),
    opt('float it to the far post','target the aerial mismatch',0.66,['passing','composure'],2,{kind:'assist'},'Dropped onto the far-post runner — powered home!',{kind:'chance-missed'},'The header is won by the defence.',undefined,'keyPass'),
  ]),
])
const CREATION_MOMENTS: MatchScenario[] = [creationSlipPass,creationCutback,creationOverlap,creationWallPass,creationSwitch,creationCounter,creationCrossfield,creationSetPiece]

export const SINGLE_MOMENTS: MatchScenario[] = [
  cornerAttack1, cornerAttack2, freeKickDirect1, freeKickDirect2, penaltyMoment1, penaltyMoment2,
  m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12, m13, m14, m15, m16, m17,
  d1, d2, d3, d4, d5, d6, d7, d8, d9, d10, d11, d12, d13, d14, d15, d16, d17,
  gk1, gk2, gk3, gk4, gk6, gk7, gk8, gk9, gk10, gk11,
  gd1, gd2, gd3, gd4, gd5, gd6, gd7, gd8, gd9, gk5,
]

export type AttackMomentRole = 'finishing' | 'creation' | 'progression'

export function scenariosForAttackRole(tier: ChanceTier, role: AttackMomentRole): MatchScenario[] {
  const base = [...SCENARIOS, ...SINGLE_MOMENTS].filter((s) => s.category === 'attack' && s.tiers.includes(tier))
  const creation = CREATION_MOMENTS.filter((s) => s.tiers.includes(tier))
  if (role === 'creation') return creation.length ? [...creation, ...base.filter(s => /cross|pass|overlap|give-and-go|square|flick|midfield|byline/.test(s.id))] : base
  if (role === 'finishing') return base.filter(s => !/deep-cross|overlap|midfield-dribble|give-and-go|square-ball|flick-on/.test(s.id))
  return [...base.filter(s => /dribble|quick-break|overlap|give-and-go|midfield|long-range/.test(s.id)), ...creation.slice(0,3)]
}

export function scenariosFor(category: ScenarioCategory, tier: ChanceTier): MatchScenario[] {
  // P41: single moments were being authored into a pool nothing ever drew
  // from — SCENARIOS and SINGLE_MOMENTS are combined here so both the
  // multi-beat storylines and the one-decision moments are live content,
  // not just data sitting unused.
  return [...SCENARIOS, ...SINGLE_MOMENTS, ...CREATION_MOMENTS].filter((s) => s.category === category && s.tiers.includes(tier))
}

export function scenarioById(id: string): MatchScenario | undefined {
  return SCENARIOS.find((s) => s.id === id) ?? SINGLE_MOMENTS.find((s) => s.id === id) ?? CREATION_MOMENTS.find((s) => s.id === id)
}

/** Structural sanity: every 'continue' target must exist within the same scenario. */
export function validateScenario(s: MatchScenario): string[] {
  const problems: string[] = []
  if (!s.beats[s.entryBeatId]) problems.push(`${s.id}: entry beat '${s.entryBeatId}' does not exist`)
  for (const b of Object.values(s.beats)) {
    if (b.options.length === 0) problems.push(`${s.id}/${b.id}: no options`)
    for (const o of b.options) {
      for (const outcome of [o.onSuccess, o.onFailure]) {
        if (outcome.kind === 'continue' && !s.beats[outcome.beatId]) {
          problems.push(`${s.id}/${b.id}: dangling continue to '${outcome.beatId}'`)
        }
      }
    }
  }
  return problems
}
