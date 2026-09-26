// ============================================================================
// PHASE 28 — RELATIONSHIP EVENTS
//
// These are the events that make the cast matter. Every one is built AROUND a
// specific person drawn from the player's actual relationship list, so the
// text names them, the outcome moves that person's bond, and the gate reads
// that person's current bond. A single template therefore produces genuinely
// different situations depending on who it lands on and where you stand with
// them — which is where the variety needed for a 6-season career comes from
// without writing thousands of one-shot strings.
//
// Kept in its own file so lifeEvents.ts stays the general pool and this stays
// the relational one; pickLifeEvent draws from both.
// ============================================================================
import { rand } from './rng'
import type { Player } from '../types/player'
import type { Decision, DecisionOption } from '../types/decision'
import type { Relationship, RelationshipKind } from './relationships'
import { activeCast } from './relationships'

function id() { return crypto.randomUUID() }

const opt = (
  label: string, hint: string, successChance: number,
  onSuccess: DecisionOption['onSuccess'], onFailure?: DecisionOption['onFailure'],
): DecisionOption => ({ id: id(), label, hint, successChance, onSuccess, onFailure })

export interface RelationshipEvent {
  key: string
  weight: number
  /** Which kinds of person this event can be about. */
  kinds: RelationshipKind[]
  /** Extra gate on the chosen person and the player. */
  when?: (r: Relationship, p: Player, week: number) => boolean
  build: (r: Relationship, p: Player) => Decision
}

const decision = (r: Relationship, situation: string, meta: string, options: DecisionOption[]): Decision =>
  ({ id: id(), context: 'event', situation, meta, options, relationshipId: r.id, relationshipName: r.name })

const warm = (r: Relationship) => r.bond >= 25
const cold = (r: Relationship) => r.bond <= -10
const neutralish = (r: Relationship) => r.bond > -25 && r.bond < 55

// ---------------------------------------------------------------------------
export const RELATIONSHIP_EVENTS: RelationshipEvent[] = [
  // ---- conflict & repair ----
  {
    key: 'rel-fallout-blame', weight: 3, kinds: ['teammate', 'rival', 'bestFriend'],
    when: (_r, p) => (p.matchRatings ?? []).length > 0,
    build: (r) => decision(r,
      `${r.name} blames you publicly for Saturday's goal. The group chat is going.`, 'conflict',
      [
        opt('own it and move on', 'defuse it', 0.75,
          { confidence: 1, relationshipDelta: 6, narrative: `${r.name} backs off once you take it on the chin.` },
          { confidence: -1, relationshipDelta: -4, narrative: `He takes your apology as an admission and runs with it.` }),
        opt('point out his part in it', 'stand your ground', 0.5,
          { confidence: 2, relationshipDelta: -3, narrative: `You're right, and everyone knows it. He goes quiet.` },
          { confidence: -2, relationshipDelta: -12, narrative: `It turns into a proper row. The coach hears about it.`, coachTrust: -1 }),
        opt('say nothing at all', 'let it die', 0.6,
          { relationshipDelta: -2, narrative: 'It blows over by Wednesday. Mostly.' },
          { confidence: -1, relationshipDelta: -6, narrative: 'Your silence reads as guilt and the story sticks.' }),
      ]),
  },
  {
    key: 'rel-cold-shoulder', weight: 3, kinds: ['teammate', 'bestFriend', 'sibling', 'partner'],
    when: (r) => cold(r),
    build: (r) => decision(r,
      `${r.name} has barely spoken to you in weeks. You see them alone after training.`, 'conflict',
      [
        opt('go over and talk', 'make the first move', 0.6,
          { confidence: 2, relationshipDelta: 14, narrative: `It's awkward for a minute, then it isn't. You're alright again.` },
          { confidence: -1, relationshipDelta: -3, narrative: `They're not ready. "Not now," is all you get.` }),
        opt('give it more time', 'let it breathe', 0.5,
          { relationshipDelta: -2, narrative: 'Nothing changes, but nothing gets worse.' },
          { relationshipDelta: -8, narrative: 'The gap widens. Silence has its own momentum.' }),
      ]),
  },
  {
    key: 'rel-coach-doubt', weight: 3, kinds: ['coach'],
    when: (r, p) => cold(r) || (p.coachTrust ?? 0) < 0,
    build: (r) => decision(r,
      `${r.name} pulls you aside: "I'm not sure you want this as much as the others."`, 'coach',
      [
        opt('ask what he wants to see', 'get specific', 0.8,
          { coachTrust: 1, relationshipDelta: 10, narrative: `He gives you three things. Clear, brutal, useful.` },
          { relationshipDelta: -2, narrative: `"Figure it out." Not much to go on.` }),
        opt('tell him he\'s wrong', 'push back hard', 0.4,
          { confidence: 2, coachTrust: 1, relationshipDelta: 6, narrative: `He likes the fire. "Show me, then."` },
          { confidence: -2, coachTrust: -1, relationshipDelta: -12, narrative: `That was the wrong week to do that.` }),
        opt('take it quietly', 'absorb it', 1,
          { confidence: -1, relationshipDelta: 2, narrative: `You say nothing and train like a man possessed on Tuesday.` }),
      ]),
  },
  {
    key: 'rel-rival-needle', weight: 3, kinds: ['rival'],
    build: (r) => decision(r,
      `${r.name} has been telling people he's ahead of you in the pecking order.`, 'rivalry',
      [
        opt('challenge him to settle it in training', 'prove it', 0.55,
          { confidence: 3, relationshipDelta: 8, energy: -8, narrative: `You edge it. He shakes your hand, which costs him something.` },
          { confidence: -2, relationshipDelta: -6, energy: -8, narrative: `He does you twice in a row. It's a long walk to the changing room.` }),
        opt('ignore it completely', 'let form talk', 1,
          { relationshipDelta: -2, narrative: 'You get on with your week. He keeps talking.' }),
        opt('spread something back', 'fight fire with fire', 0.45,
          { relationshipDelta: -8, narrative: 'It lands. He goes quiet for a fortnight.' },
          { confidence: -1, coachTrust: -1, relationshipDelta: -14, narrative: 'It gets back to the coach and he is not impressed.' }),
      ]),
  },

  // ---- support & closeness ----
  {
    key: 'rel-parent-sacrifice', weight: 3, kinds: ['parent'],
    build: (r) => decision(r,
      `${r.name} has been picking up extra shifts to cover your kit and travel.`, 'family',
      [
        opt('say thank you properly', 'acknowledge it', 1,
          { confidence: 2, relationshipDelta: 12, narrative: `They wave it off, but you can tell it mattered.` }),
        opt('offer to get a weekend job', 'share the load', 0.55,
          { relationshipDelta: 8, energy: -6, narrative: `They accept a compromise: one shift a fortnight.` },
          { confidence: -1, relationshipDelta: 4, energy: -12, narrative: `You take on too much and it eats your recovery.` }),
        opt('promise to make it worth it', 'aim high', 0.6,
          { confidence: 3, relationshipDelta: 10, narrative: `"I know you will." No pressure, then.` },
          { confidence: -1, relationshipDelta: 5, narrative: `The words come out hollow and you both hear it.` }),
      ]),
  },
  {
    key: 'rel-friend-drift', weight: 3, kinds: ['bestFriend'],
    when: (r) => r.weeksSinceContact >= 4,
    build: (r) => decision(r,
      `You haven't seen ${r.name} outside of school in over a month. Football ate it.`, 'friendship',
      [
        opt('clear a whole evening for them', 'invest in it', 0.85,
          { confidence: 2, relationshipDelta: 16, energy: -4, narrative: `Like nothing changed. You needed that more than you knew.` },
          { relationshipDelta: 4, energy: -6, narrative: `Nice enough, but there's a distance now.` }),
        opt('quick catch-up between sessions', 'squeeze it in', 0.7,
          { relationshipDelta: 6, narrative: `Twenty minutes, but it counts.` },
          { relationshipDelta: -3, narrative: `They can tell you're half-listening.` }),
        opt('leave it until the off-season', 'football first', 1,
          { relationshipDelta: -10, narrative: `The reply comes back one word long.` }),
      ]),
  },
  {
    key: 'rel-teammate-lift', weight: 3, kinds: ['teammate'],
    when: (r) => warm(r),
    build: (r) => decision(r,
      `${r.name} is having a nightmare run and asks if you'll stay behind to work on his finishing.`, 'squad',
      [
        opt('stay as long as it takes', 'be that teammate', 0.8,
          { confidence: 1, relationshipDelta: 14, energy: -10, coachTrust: 1, narrative: `He scores twice on Saturday and points at you both times.` },
          { relationshipDelta: 6, energy: -12, narrative: `No breakthrough, but he won't forget you stayed.` }),
        opt('half an hour, then home', 'balance it', 1,
          { relationshipDelta: 5, energy: -5, narrative: `Useful session. Both of you get your rest in too.` }),
        opt('tell him to ask the coach', 'not your job', 1,
          { relationshipDelta: -8, narrative: `He does. And he mentions who told him to.` }),
      ]),
  },
  {
    key: 'rel-mentor-session', weight: 2, kinds: ['mentor', 'coach'],
    when: (r) => warm(r),
    build: (r) => decision(r,
      `${r.name} offers you an extra one-to-one on your weakest foot. 6am, before school.`, 'development',
      [
        opt('every single morning', 'all in', 0.6,
          { confidence: 2, coachTrust: 1, relationshipDelta: 12, energy: -14, narrative: `Brutal fortnight. Your weak foot stops being a weakness.` },
          { confidence: -1, relationshipDelta: 4, energy: -18, narrative: `You burn out by day four and he notices.` }),
        opt('twice a week', 'sustainable', 1,
          { coachTrust: 1, relationshipDelta: 8, energy: -6, narrative: `Steady progress and you keep your legs.` }),
        opt('decline politely', 'protect your recovery', 1,
          { relationshipDelta: -6, energy: 3, narrative: `He shrugs. The offer doesn't come round again soon.` }),
      ]),
  },

  // ---- new people entering the cast ----
  {
    key: 'rel-meet-partner', weight: 2, kinds: ['bestFriend', 'teammate'],
    when: (r, p, week) => week > 8 && warm(r) && !(p.relationships ?? []).some((x) => !x.ended && x.kind === 'partner'),
    build: (r) => decision(r,
      `${r.name} keeps trying to set you up with someone from the year above.`, 'life',
      [
        opt('go for it', 'life is more than football', 0.65,
          { confidence: 3, relationshipDelta: 6, addPerson: { kind: 'partner', note: 'met through a friend — makes the hard weeks lighter', bond: 35 }, narrative: `It goes well. Really well.` },
          { confidence: -1, relationshipDelta: 2, narrative: `Awkward from the first minute. You both know within ten.` }),
        opt('not this season', 'stay focused', 1,
          { relationshipDelta: -2, confidence: -1, narrative: `He calls you boring. He's probably right.` }),
      ]),
  },
  {
    key: 'rel-agent-approach', weight: 2, kinds: ['parent', 'coach'],
    when: (_r, p) => (p.reputation ?? 0) >= 30 && !(p.relationships ?? []).some((x) => !x.ended && x.kind === 'agent'),
    build: (r) => decision(r,
      `A man with business cards approached ${r.name} after the match, offering to "handle things".`, 'career',
      [
        opt('take the meeting together', 'due diligence', 0.7,
          { reputation: 1, relationshipDelta: 8, addPerson: { kind: 'agent', note: 'says he can open doors — jury is out', bond: 15 }, narrative: `He's legitimate enough. Cautious yes.` },
          { relationshipDelta: 4, narrative: `Two minutes in, the questions stop adding up. You walk.` }),
        opt('let your parent handle it alone', 'delegate', 0.45,
          { relationshipDelta: -4, addPerson: { kind: 'agent', note: 'signed on a handshake you were not part of', bond: 5 }, narrative: `It's done before you've read anything.` },
          { relationshipDelta: 6, narrative: `They tell him to come back when you're older. Wise.` }),
        opt('no agents at fifteen', 'too soon', 1,
          { relationshipDelta: 4, confidence: 1, narrative: `Everyone in the car agrees it was the right call.` }),
      ]),
  },
  {
    key: 'rel-new-signing', weight: 3, kinds: ['coach'],
    when: (_r, p, week) => week > 6 && (p.squad ?? []).length > 0,
    build: (r) => decision(r,
      `${r.name} has brought in a new lad who plays your position. He's good.`, 'squad',
      [
        opt('make him welcome', 'bigger than you', 0.8,
          { relationshipDelta: 8, coachTrust: 1, addPerson: { kind: 'teammate', note: 'signed to compete with you — you welcomed him anyway', bond: 30 }, narrative: `He's grateful. The coach notices who did that.` },
          { relationshipDelta: 2, addPerson: { kind: 'rival', note: 'arrived to take your place, and you both know it', bond: -10 }, narrative: `The handshake is stiff. It's competition from day one.` }),
        opt('outwork him from day one', 'no free shirts', 0.6,
          { confidence: 2, coachTrust: 1, energy: -8, addPerson: { kind: 'rival', note: 'the new signing you refuse to be replaced by', bond: -15 }, narrative: `You set the tempo all week. He's chasing.` },
          { confidence: -2, energy: -10, addPerson: { kind: 'rival', note: 'the new signing who is currently ahead of you', bond: -20 }, narrative: `He matches you and then some. Sobering.` }),
      ]),
  },

  // ---- pressure & consequence ----
  {
    key: 'rel-teacher-warning', weight: 3, kinds: ['teacher'],
    build: (r) => decision(r,
      `${r.name} threatens to write home unless your coursework improves this month.`, 'school',
      [
        opt('put the hours in', 'sort it properly', 0.8,
          { relationshipDelta: 12, energy: -8, narrative: `Handed in on time. They actually apologise for doubting you.` },
          { confidence: -1, relationshipDelta: 2, energy: -10, narrative: `You try, and it's still not enough. The letter goes home.` }),
        opt('ask for an extension', 'buy time', 0.55,
          { relationshipDelta: 6, narrative: `Granted, grudgingly. You've got a fortnight.` },
          { relationshipDelta: -8, narrative: `"You've had your extension." The letter goes home.` }),
        opt('let it slide', 'football only', 1,
          { relationshipDelta: -14, confidence: -1, narrative: `It goes home. There's a conversation waiting for you.` }),
      ]),
  },
  {
    key: 'rel-sibling-shadow', weight: 2, kinds: ['sibling'],
    build: (r) => decision(r,
      `${r.name} is fed up of being "the other one" every time someone mentions your name.`, 'family',
      [
        opt('go and watch their next game', 'show up for them', 0.9,
          { confidence: 1, relationshipDelta: 15, narrative: `You're the loudest voice on the touchline. It means everything.` },
          { relationshipDelta: 5, narrative: `You go, but you're on your phone half of it. Noticed.` }),
        opt('tell them to work harder', 'blunt honesty', 0.35,
          { relationshipDelta: 4, narrative: `It lands as motivation. Barely.` },
          { confidence: -1, relationshipDelta: -16, narrative: `That was cruel and you knew it as you said it.` }),
        opt('play it down at home', 'take up less space', 1,
          { relationshipDelta: 8, confidence: -1, narrative: `Things ease at home. You feel smaller for a week.` }),
      ]),
  },
  {
    key: 'rel-partner-clash', weight: 3, kinds: ['partner'],
    when: (r) => neutralish(r),
    build: (r) => decision(r,
      `${r.name}'s birthday is the same night as the away trip. You can't do both.`, 'life',
      [
        opt('travel with the squad', 'football comes first', 1,
          { coachTrust: 1, relationshipDelta: -16, confidence: -1, narrative: `The coach approves. The texts do not.` }),
        opt('skip the trip', 'be there for them', 1,
          { coachTrust: -2, relationshipDelta: 18, confidence: 1, narrative: `Best night in months. The coach names a different sub.` }),
        opt('go to both, badly', 'try to have it all', 0.4,
          { relationshipDelta: 6, energy: -12, narrative: `Somehow you pull it off. You are exhausted.` },
          { confidence: -2, relationshipDelta: -10, energy: -14, coachTrust: -1, narrative: `You do neither properly and annoy everyone.` }),
      ]),
  },
  {
    key: 'rel-coach-favour', weight: 2, kinds: ['coach'],
    when: (r) => warm(r),
    build: (r) => decision(r,
      `${r.name} asks you to have a word with a young lad who's losing his way.`, 'coach',
      [
        opt('take him under your wing', 'lead', 0.75,
          { coachTrust: 2, confidence: 2, relationshipDelta: 10, energy: -5, narrative: `He turns a corner. The coach saw exactly who fixed it.` },
          { relationshipDelta: 4, energy: -5, narrative: `You try. Some people you can't reach at fifteen.` }),
        opt('say you\'re not the right person', 'stay in your lane', 1,
          { relationshipDelta: -6, narrative: `He nods, and asks somebody else.` }),
      ]),
  },
  {
    key: 'rel-agent-pressure', weight: 2, kinds: ['agent'],
    build: (r) => decision(r,
      `${r.name} wants you to push for a move now, while "the interest is hot".`, 'career',
      [
        opt('trust him', 'ride the momentum', 0.5,
          { reputation: 2, relationshipDelta: 10, narrative: `Doors open. Two clubs are suddenly asking about you.` },
          { confidence: -2, relationshipDelta: -6, coachTrust: -1, narrative: `Word gets back to your club that you're agitating. Bad look.` }),
        opt('tell him you\'re staying put', 'develop first', 1,
          { coachTrust: 1, relationshipDelta: -8, confidence: 1, narrative: `He's frustrated. Your coach hears you turned it down and says nothing — but he heard.` }),
      ]),
  },
  {
    key: 'rel-teammate-secret', weight: 2, kinds: ['teammate', 'bestFriend'],
    when: (r) => warm(r),
    build: (r) => decision(r,
      `${r.name} tells you he's been drinking before matches. He asks you not to say anything.`, 'squad',
      [
        opt('keep it quiet, help him yourself', 'loyalty', 0.5,
          { relationshipDelta: 16, confidence: 1, narrative: `You get him through it. Nobody else ever knows.` },
          { confidence: -2, coachTrust: -1, relationshipDelta: -6, narrative: `It comes out anyway, and you knew. That's the part that stings.` }),
        opt('tell the coach', 'he needs real help', 0.6,
          { coachTrust: 2, relationshipDelta: -20, narrative: `He gets support. He doesn't speak to you for a month.` },
          { coachTrust: 1, relationshipDelta: -25, narrative: `He denies everything and turns the room against you.` }),
      ]),
  },
  {
    key: 'rel-parent-pressure', weight: 3, kinds: ['parent'],
    when: (_r, p) => (p.matchRatings ?? []).slice(-3).some((x) => x < 6),
    build: (r) => decision(r,
      `${r.name} has started analysing your matches on the drive home. Every single one.`, 'family',
      [
        opt('ask them to just be a parent', 'set a boundary', 0.6,
          { confidence: 2, relationshipDelta: 6, narrative: `They stop. The car rides get much better.` },
          { confidence: -1, relationshipDelta: -12, narrative: `They take it badly. "I'm trying to help you."` }),
        opt('listen and take notes', 'find the value', 0.5,
          { confidence: -1, relationshipDelta: 10, narrative: `Half of it is nonsense. The other half is sharp.` },
          { confidence: -2, relationshipDelta: 4, narrative: `You absorb every word and take it into training with you.` }),
        opt('put headphones in', 'shut it out', 1,
          { relationshipDelta: -10, confidence: 1, narrative: `Silence the whole way home. Peaceful, in a bleak way.` }),
      ]),
  },// --- second wave (P28b). Added after scripts/audit4.ts measured the actual
  // six-season variety and found the first wave too thin. Each template
  // multiplies across everyone it can apply to, so breadth of `kinds` matters
  // as much as template count. ---
  {
    key: 'rel-big-game-ticket', weight: 3, kinds: ['parent', 'sibling', 'bestFriend', 'partner'],
    build: (r) => decision(r,
      `You've got one spare ticket for the biggest game of your season. ${r.name} is hinting hard.`, 'life',
      [
        opt('give it to them', 'they have earned it', 1,
          { relationshipDelta: 14, confidence: 1, narrative: `They are the loudest voice in the ground.` }),
        opt('give it to someone who can help your career', 'be strategic', 0.5,
          { reputation: 1, relationshipDelta: -12, narrative: `Useful contact made. ${r.name} does not mention it, which is worse.` },
          { relationshipDelta: -14, narrative: `The contact does not even turn up. Brilliant.` }),
      ]),
  },
  {
    key: 'rel-borrowed-money', weight: 2, kinds: ['teammate', 'bestFriend', 'sibling'],
    build: (r) => decision(r,
      `${r.name} borrowed money off you weeks ago and has gone quiet about it.`, 'conflict',
      [
        opt('ask for it back straight', 'be direct', 0.6,
          { relationshipDelta: 4, narrative: `Paid back that evening with an apology.` },
          { relationshipDelta: -10, narrative: `They get defensive. It becomes a whole thing.` }),
        opt('write it off', 'not worth it', 1,
          { relationshipDelta: 6, confidence: -1, narrative: `You let it go. They never mention it, and you always remember.` }),
      ]),
  },
  {
    key: 'rel-praised-publicly', weight: 3, kinds: ['coach', 'mentor', 'teacher'],
    when: (_r, p) => (p.matchRatings ?? []).slice(-3).some((x) => x >= 7.5),
    build: (r) => decision(r,
      `${r.name} held you up in front of everyone as the example to follow.`, 'coach',
      [
        opt('deflect it to the team', 'stay level', 1,
          { relationshipDelta: 8, coachTrust: 1, narrative: `Exactly the right answer. The room warms to you.` }),
        opt('take the praise', 'enjoy it', 0.6,
          { confidence: 3, relationshipDelta: 5, narrative: `You have earned it and everyone knows it.` },
          { confidence: 1, relationshipDelta: -3, narrative: `A couple of the older lads roll their eyes.` }),
      ]),
  },
  {
    key: 'rel-training-nutmeg', weight: 3, kinds: ['rival', 'teammate'],
    build: (r) => decision(r,
      `${r.name} nutmegged you in a small-sided game and the whole squad saw it.`, 'squad',
      [
        opt('laugh it off', 'let it go', 1,
          { relationshipDelta: 6, confidence: -1, narrative: `You take it well. It dies immediately.` }),
        opt('get it back before the whistle', 'answer it', 0.5,
          { confidence: 3, relationshipDelta: 4, narrative: `You do him twice. Honour restored, loudly.` },
          { confidence: -2, relationshipDelta: -6, narrative: `You chase it for twenty minutes and look worse each time.` }),
      ]),
  },
  {
    key: 'rel-asks-for-help', weight: 3, kinds: ['sibling', 'bestFriend', 'teammate'],
    build: (r) => decision(r,
      `${r.name} is in trouble at school and asks you to cover for them.`, 'conflict',
      [
        opt('cover for them', 'loyalty first', 0.55,
          { relationshipDelta: 14, narrative: `It holds. They owe you and they know it.` },
          { relationshipDelta: 4, confidence: -2, narrative: `It unravels and you are dragged into it too.` }),
        opt('refuse but help them sort it', 'honest support', 0.8,
          { relationshipDelta: 8, confidence: 1, narrative: `Harder conversation, better outcome.` },
          { relationshipDelta: -6, narrative: `They wanted cover, not advice.` }),
        opt('stay out of it', 'not your problem', 1,
          { relationshipDelta: -12, narrative: `They handle it alone and remember that you let them.` }),
      ]),
  },
  {
    key: 'rel-missed-milestone', weight: 3, kinds: ['parent', 'sibling', 'partner', 'bestFriend'],
    when: (r) => r.weeksSinceContact >= 3,
    build: (r) => decision(r,
      `You missed something that mattered to ${r.name} because of a fixture. Again.`, 'life',
      [
        opt('make it up properly', 'do something real', 0.8,
          { relationshipDelta: 12, energy: -5, narrative: `An entire day, phone off. It repairs more than you expected.` },
          { relationshipDelta: 2, energy: -6, narrative: `Nice gesture, but the point had already been made.` }),
        opt('apologise and explain', 'be honest about it', 0.6,
          { relationshipDelta: 6, narrative: `They get it. They always do, which is its own problem.` },
          { relationshipDelta: -8, narrative: `"You always have a reason." Hard to argue with.` }),
        opt('act like it was nothing', 'move on', 1,
          { relationshipDelta: -14, narrative: `Something cools between you and does not warm back up quickly.` }),
      ]),
  },
  {
    key: 'rel-coach-drops-you', weight: 3, kinds: ['coach'],
    when: (_r, p) => p.squadRole === 'bench' || p.squadRole === 'reserves',
    build: (r) => decision(r,
      `${r.name} names the side and you are not in it. He does not look at you once.`, 'coach',
      [
        opt('demand a reason after training', 'confront it', 0.5,
          { coachTrust: 1, confidence: 2, relationshipDelta: 6, narrative: `He respects that you came to him. You get a route back.` },
          { coachTrust: -2, confidence: -2, relationshipDelta: -14, narrative: `He does not take being challenged in front of others.` }),
        opt('be the best trainer all week', 'answer with work', 0.7,
          { coachTrust: 2, relationshipDelta: 8, energy: -10, narrative: `He names you Saturday without a word about it.` },
          { confidence: -1, energy: -12, relationshipDelta: -2, narrative: `You graft all week and stay on the bench anyway.` }),
        opt('sulk', 'let it show', 1,
          { coachTrust: -2, relationshipDelta: -12, confidence: -1, narrative: `Everyone notices. It is the worst possible look.` }),
      ]),
  },
  {
    key: 'rel-defended-you', weight: 2, kinds: ['teammate', 'bestFriend', 'coach', 'parent'],
    build: (r) => decision(r,
      `Someone was slating you and ${r.name} shut them down on your behalf.`, 'loyalty',
      [
        opt('thank them properly', 'acknowledge it', 1,
          { relationshipDelta: 12, confidence: 2, narrative: `They shrug it off. The bond is obvious to both of you.` }),
        opt('tell them you can fight your own battles', 'independence', 0.4,
          { confidence: 2, relationshipDelta: -8, narrative: `Fair enough, they say. But they are hurt.` },
          { relationshipDelta: -14, narrative: `That was ungrateful and it lands badly.` }),
      ]),
  },
  {
    key: 'rel-jealousy', weight: 3, kinds: ['teammate', 'rival', 'sibling'],
    when: (_r, p) => (p.reputation ?? 0) >= 25,
    build: (r) => decision(r,
      `${r.name} has started making digs about the attention you have been getting.`, 'conflict',
      [
        opt('address it privately', 'head it off', 0.7,
          { relationshipDelta: 10, confidence: 1, narrative: `Turns out it was insecurity, not malice. Sorted.` },
          { relationshipDelta: -8, narrative: `They deny there is any issue while clearly having one.` }),
        opt('play it down publicly', 'shrink yourself', 1,
          { relationshipDelta: 6, confidence: -2, narrative: `The digs stop. So does a bit of your enjoyment.` }),
        opt('let your football answer it', 'ignore it', 0.6,
          { confidence: 2, relationshipDelta: -4, narrative: `You have a blinder on Saturday. Nothing more is said.` },
          { confidence: -1, relationshipDelta: -8, narrative: `You have a quiet game and the digs get louder.` }),
      ]),
  },
  {
    key: 'rel-advice-crossroads', weight: 2, kinds: ['parent', 'coach', 'mentor', 'agent', 'teacher'],
    when: (_r, _p, week) => week > 15,
    build: (r) => decision(r,
      `${r.name} sits you down about where all this is actually heading.`, 'career',
      [
        opt('be honest about your doubts', 'open up', 0.75,
          { confidence: 2, relationshipDelta: 12, narrative: `Saying it out loud to someone who cares changes its weight.` },
          { confidence: -1, relationshipDelta: 4, narrative: `They do not really know what to say. The silence sits there.` }),
        opt('tell them you have never been more sure', 'project certainty', 0.6,
          { confidence: 2, relationshipDelta: 6, narrative: `They believe you. You almost believe you.` },
          { confidence: -1, relationshipDelta: -2, narrative: `They can tell it is bravado.` }),
      ]),
  },
  {
    key: 'rel-partner-supportive', weight: 2, kinds: ['partner'],
    when: (r) => warm(r),
    build: (r) => decision(r,
      `${r.name} has quietly reorganised their week around your fixtures.`, 'life',
      [
        opt('protect one evening a week for them', 'give something back', 0.85,
          { confidence: 2, relationshipDelta: 14, energy: -3, narrative: `It becomes the best part of your week.` },
          { relationshipDelta: 6, energy: -5, narrative: `You keep it for a fortnight before football eats it again.` }),
        opt('accept it gratefully', 'let them', 1,
          { relationshipDelta: 4, confidence: 1, narrative: `They do not mind. You should probably still do something.` }),
      ]),
  },
  {
    key: 'rel-old-coach', weight: 2, kinds: ['mentor', 'coach'],
    when: (_r, p) => (p.career?.appearances ?? 0) > 15,
    build: (r) => decision(r,
      `${r.name} says you have plateaued and need to change something fundamental.`, 'development',
      [
        opt('rebuild the weak part of your game', 'go back to basics', 0.6,
          { confidence: -1, coachTrust: 2, relationshipDelta: 10, energy: -12, narrative: `Six ugly weeks. Then it clicks and you are a better player.` },
          { confidence: -2, energy: -14, relationshipDelta: 4, narrative: `You take it apart and cannot put it back together this season.` }),
        opt('trust what already works', 'back your strengths', 0.55,
          { confidence: 2, relationshipDelta: -4, narrative: `You double down and it keeps producing. For now.` },
          { confidence: -2, relationshipDelta: -8, narrative: `The plateau turns into a decline and he was right.` }),
      ]),
  },
  {
    key: 'rel-family-move', weight: 1, kinds: ['bestFriend', 'teammate', 'partner'],
    when: (_r, _p, week) => week > 25,
    build: (r) => decision(r,
      `${r.name} is moving away at the end of the season.`, 'life',
      [
        opt('make the most of the time left', 'be present', 1,
          { confidence: 1, relationshipDelta: 16, narrative: `A season you will both talk about for years.` }),
        opt('start pulling away now', 'protect yourself', 1,
          { confidence: -2, relationshipDelta: -18, narrative: `You save yourself nothing and lose the time you had.` }),
      ]),
  },
  {
    key: 'rel-shared-success', weight: 3, kinds: ['teammate', 'bestFriend', 'rival', 'coach'],
    when: (_r, p) => (p.matchRatings ?? []).slice(-2).some((x) => x >= 8),
    build: (r) => decision(r,
      `After the win, ${r.name} wants the whole squad out to celebrate properly.`, 'squad',
      [
        opt('go and enjoy it', 'moments like this', 0.7,
          { confidence: 2, relationshipDelta: 12, energy: -10, narrative: `Best night of the season. Worth every bit of the tiredness.` },
          { confidence: 1, relationshipDelta: 8, energy: -16, narrative: `Great night. Wednesday's session is a write-off.` }),
        opt('one hour then home', 'balance', 1,
          { relationshipDelta: 6, energy: -4, narrative: `You show your face and get your sleep. Sensible.` }),
        opt('skip it entirely', 'recovery first', 1,
          { relationshipDelta: -10, energy: 4, coachTrust: 1, narrative: `Fresh on Wednesday. Slightly outside the group by Thursday.` }),
      ]),
  },
]

// ---------------------------------------------------------------------------

/**
 * Pick a relationship event. Chooses a PERSON first (weighted toward whoever
 * you've neglected or fallen out with — those are the interesting stories),
 * then an event that fits them.
 */
export function pickRelationshipEvent(player: Player, week: number, recentKeys: string[]): { event: RelationshipEvent; person: Relationship; decision: Decision } | null {
  const cast = activeCast(player.relationships ?? [])
  if (cast.length === 0) return null

  const candidates: { event: RelationshipEvent; person: Relationship; weight: number }[] = []
  for (const person of cast) {
    for (const event of RELATIONSHIP_EVENTS) {
      if (!event.kinds.includes(person.kind)) continue
      if (event.when && !event.when(person, player, week)) continue
      // same widening as the general pool: an event about a SPECIFIC person
      // should not come back around for a long time
      if (recentKeys.slice(-24).includes(`${event.key}:${person.id}`)) continue
      // neglected or strained people are more likely to generate a story
      const tension = person.bond < 0 ? 1.6 : person.weeksSinceContact >= 5 ? 1.4 : 1
      candidates.push({ event, person, weight: event.weight * tension })
    }
  }
  if (candidates.length === 0) return null

  const total = candidates.reduce((a, c) => a + c.weight, 0)
  let roll = rand() * total
  const chosen = candidates.find((c) => (roll -= c.weight) <= 0) ?? candidates[0]
  return { event: chosen.event, person: chosen.person, decision: chosen.event.build(chosen.person, player) }
}
