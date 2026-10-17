import type { Player } from '../types/player'
import { effectiveValues } from './economy'
import type { KeyMoment } from './match'
import type { Decision, DecisionOption } from '../types/decision'
import type { OutfieldAttribute, GoalkeeperAttribute } from '../types/attributes'
import { scenarioById } from './matchScenarios'

export type AnyAttribute = OutfieldAttribute | GoalkeeperAttribute
function id() { return crypto.randomUUID() }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

interface MomentOption {
  label: string
  hint: string
  baseCeiling: number
  keyAttributes: AnyAttribute[]
  reward: number
}

const ATTRIBUTE_LABEL: Partial<Record<AnyAttribute, string>> = {
  shooting: 'Shooting', passing: 'Passing', dribbling: 'Dribbling', tackling: 'Tackling',
  pace: 'Pace', strength: 'Strength', stamina: 'Stamina', agility: 'Agility',
  vision: 'Vision', composure: 'Composure', positioning: 'Positioning', concentration: 'Concentration',
  reflexes: 'Reflexes', handling: 'Handling', gkPositioning: 'Positioning', distribution: 'Distribution',
}

function attrValue(player: Player, attr: AnyAttribute): number {
  const values = effectiveValues(player)
  return values[attr] ?? 8
}

// V3.1 fairness pass. Youth attributes used to suppress even sensible options so
// heavily that players could repeatedly make a good read and still feel doomed.
// Attributes still matter strongly, but a football-correct choice now starts from
// a healthier baseline. Half-chances remain meaningfully harder than clear looks.
export function optionChance(player: Player, o: MomentOption, tier: string): number {
  const avg = o.keyAttributes.length ? o.keyAttributes.reduce((s, a) => s + attrValue(player, a), 0) / o.keyAttributes.length : 10
  const attrMod = 0.68 + (avg / 20) * 0.42
  const risk = 1 - o.baseCeiling
  const mentalMod = 1 + (player.confidence.value / 50) * (0.4 + risk * 0.6)
  const tierMod = tier === 'clear' ? 1.08 : tier === 'good' ? 1.0 : 0.90
  // A trained skill has to reward its matching action specifically. Averaging
  // Shooting with Composure/Agility gave a ten-level gap only a small nudge,
  // while safer passing options offered frequent assists. The youth baseline
  // remains intact; developed skills above level 5 add to the relevant roll.
  const specialistBonuses: Partial<Record<AnyAttribute, number>> = {
    shooting: 0.18, tackling: 0.14, reflexes: 0.12,
    passing: 0.10, dribbling: 0.10,
  }
  // One specialist benefit per choice, using its strongest trained skill.
  // This rewards a practiced action without stacking passing+dribbling on
  // the same option or penalising a new player's low starting attributes.
  const specialistBonus = Math.max(0, ...o.keyAttributes.map(attr =>
    clamp((attrValue(player, attr) - 5) / 10, 0, 1) * (specialistBonuses[attr] ?? 0)))
  return clamp(o.baseCeiling * attrMod * mentalMod * tierMod + specialistBonus, 0.08, 0.96)
}

function chanceLabel(chance: number): string {
  if (chance >= 0.78) return 'strong option'
  if (chance >= 0.60) return 'good option'
  if (chance >= 0.42) return 'risky'
  return 'very risky'
}

function optionHint(baseHint: string, attrs: AnyAttribute[], chance: number): string {
  const labels = attrs.slice(0, 2).map((a) => ATTRIBUTE_LABEL[a]).filter(Boolean)
  const tests = labels.length ? ` · tests ${labels.join(' + ')}` : ''
  return `${baseHint} · ${chanceLabel(chance)}${tests}`
}

function buildOptions(player: Player, pool: MomentOption[], tier: string): DecisionOption[] {
  return pool.map((o) => {
    const chance = optionChance(player, o, tier)
    return {
      id: id(),
      label: o.label,
      hint: optionHint(o.hint, o.keyAttributes, chance),
      successChance: chance,
      onSuccess: { narrative: '' },
      onFailure: { narrative: '' },
    }
  })
}

const GK_POOLS: Record<string, MomentOption[]> = {
  onevone: [
    { label: 'stand tall', hint: 'make yourself big', baseCeiling: 0.6, keyAttributes: ['gkPositioning', 'reflexes'], reward: 3 },
    { label: 'rush and smother', hint: 'commit early', baseCeiling: 0.5, keyAttributes: ['reflexes', 'handling'], reward: 3 },
    { label: 'stay back, react', hint: 'safe', baseCeiling: 0.72, keyAttributes: ['reflexes'], reward: 2 },
  ],
  shot: [
    { label: 'catch it', hint: 'no rebound', baseCeiling: 0.55, keyAttributes: ['handling', 'reflexes'], reward: 3 },
    { label: 'parry wide', hint: 'safe hands', baseCeiling: 0.78, keyAttributes: ['reflexes'], reward: 2 },
    { label: 'block with body', hint: 'last resort', baseCeiling: 0.82, keyAttributes: ['gkPositioning'], reward: 1 },
  ],
}

const GK_DISTRIBUTION_POOL: MomentOption[] = [
  { label: 'roll to full-back', hint: 'reliable', baseCeiling: 0.86, keyAttributes: ['distribution'], reward: 1 },
  { label: 'throw to the wing', hint: 'quick, needs accuracy', baseCeiling: 0.7, keyAttributes: ['distribution', 'reflexes'], reward: 2 },
  { label: 'long ball forward', hint: 'ambitious, high reward', baseCeiling: 0.52, keyAttributes: ['distribution'], reward: 3 },
]

const DEF_POOL: MomentOption[] = [
  { label: 'slide tackle', hint: 'all or nothing', baseCeiling: 0.5, keyAttributes: ['tackling', 'agility'], reward: 3 },
  { label: 'jockey and delay', hint: 'buy time for cover', baseCeiling: 0.75, keyAttributes: ['positioning', 'concentration'], reward: 2 },
  { label: 'shepherd wide', hint: 'safe', baseCeiling: 0.82, keyAttributes: ['positioning', 'pace'], reward: 1 },
]

const ROUTINE_ATTACK: MomentOption[] = [
  { label: 'keep possession', hint: 'find the simple pass', baseCeiling: .86, keyAttributes: ['passing', 'vision'], reward: 1 },
  { label: 'carry into space', hint: 'move the defence', baseCeiling: .68, keyAttributes: ['dribbling', 'pace'], reward: 2 },
  { label: 'switch the play', hint: 'move it forward', baseCeiling: .62, keyAttributes: ['passing', 'vision'], reward: 3 },
]
const ROUTINE_DEFEND: MomentOption[] = [
  { label: 'hold your position', hint: 'block the passing lane', baseCeiling: .84, keyAttributes: ['positioning', 'concentration'], reward: 1 },
  { label: 'press the ball', hint: 'close down quickly', baseCeiling: .68, keyAttributes: ['tackling', 'pace'], reward: 2 },
  { label: 'step in early', hint: 'win possession', baseCeiling: .56, keyAttributes: ['tackling', 'positioning'], reward: 3 },
]

const ATT_POOLS: Record<string, MomentOption[]> = {
  clear: [
    { label: 'first-time finish', hint: 'high risk, high reward', baseCeiling: 0.55, keyAttributes: ['shooting', 'composure'], reward: 3 },
    { label: 'take a touch', hint: 'steadier', baseCeiling: 0.72, keyAttributes: ['composure', 'shooting'], reward: 2 },
    { label: 'round the keeper', hint: 'needs quick feet', baseCeiling: 0.6, keyAttributes: ['dribbling', 'agility'], reward: 2 },
  ],
  good: [
    { label: 'header on goal', hint: 'attack the ball', baseCeiling: 0.55, keyAttributes: ['strength', 'positioning'], reward: 3 },
    { label: 'volley it', hint: 'high risk', baseCeiling: 0.45, keyAttributes: ['shooting', 'agility'], reward: 3 },
    { label: 'cushion to teammate', hint: 'safe, team play', baseCeiling: 0.8, keyAttributes: ['vision', 'passing'], reward: 2 },
  ],
  half: [
    { label: 'snatch a shot', hint: 'tight angle', baseCeiling: 0.4, keyAttributes: ['shooting', 'composure'], reward: 3 },
    { label: 'cut it back', hint: 'find support', baseCeiling: 0.7, keyAttributes: ['vision', 'passing'], reward: 2 },
    { label: 'win a corner', hint: 'safe', baseCeiling: 0.85, keyAttributes: ['dribbling'], reward: 1 },
  ],
}

export interface MatchDecisionBundle {
  decision: Decision
  rewards: number[]
  maxReward: number
  ceilings: number[]
  keyAttributes: AnyAttribute[][]
}

export function miniGameKindForMoment(moment: KeyMoment): 'rondo' | 'targets' | 'sprint' | null {
  if ((moment.minute * 7) % 5 < 2) return null
  if (moment.isDistribution) return 'rondo'
  if (moment.isDefensive) return 'sprint'
  return 'targets'
}

export function inferStatTag(label: string, isDefensive: boolean, isDistribution: boolean, isGK: boolean, outcomeIsGoodForPlayer: boolean): 'tackle' | 'interception' | 'header' | 'keyPass' | 'save' | null {
  if (!outcomeIsGoodForPlayer) return null
  const l = label.toLowerCase()
  if (isDistribution) return null
  if (isDefensive && isGK) return 'save'
  if (isDefensive) {
    if (l.includes('intercept') || l.includes('read') || l.includes('step in') || l.includes('cut it out') || l.includes('cut out')) return 'interception'
    if (l.includes('header') || l.includes('aerial') || l.includes('attack it') || l.includes('attack the') || l.includes('jump') || l.includes('win the header')) return 'header'
    return 'tackle'
  }
  if (l.includes('square') || l.includes('cutback') || l.includes('cut it back') || l.includes('cross') || l.includes('through ball') || l.includes('thread') || l.includes('slide the pass') || l.includes('release') || l.includes('lay it off') || l.includes('pick out')) return 'keyPass'
  return null
}

export function momentToDecision(player: Player, moment: KeyMoment, meta: string): MatchDecisionBundle {
  if (moment.isInjuryDecision) {
    return {
      decision: {
        id: id(), context: 'match', situation: moment.situation, meta,
        options: [
          { id: id(), label: 'play through it', hint: 'risk it', successChance: 1, onSuccess: { narrative: '' }, onFailure: { narrative: '' } },
          { id: id(), label: 'ask to come off', hint: 'protect yourself', successChance: 1, onSuccess: { narrative: '' }, onFailure: { narrative: '' } },
        ],
      },
      rewards: [1, 1], maxReward: 1, ceilings: [1, 1], keyAttributes: [[], []],
    }
  }

  if (moment.isRoutine) {
    const pool = moment.isDistribution ? GK_DISTRIBUTION_POOL : moment.isDefensive ? ROUTINE_DEFEND : ROUTINE_ATTACK
    return {
      decision: { id: id(), context: player.position === 'GK' ? 'gk' : 'match', situation: moment.situation, meta,
        options: buildOptions(player, pool, 'half') },
      rewards: pool.map(o => o.reward), maxReward: Math.max(...pool.map(o => o.reward)),
      ceilings: pool.map(o => o.baseCeiling), keyAttributes: pool.map(o => o.keyAttributes),
    }
  }

  if (moment.scenarioId && moment.beatId) {
    const scen = scenarioById(moment.scenarioId)
    const beatDef = scen?.beats[moment.beatId]
    if (scen && beatDef) return scenarioBeatToDecision(player, beatDef.situation, beatDef.options, moment.tier, meta)
  }

  const isGK = player.position === 'GK'
  let pool: MomentOption[]
  if (moment.isDefensive && isGK) pool = moment.tier === 'clear' ? GK_POOLS.onevone : GK_POOLS.shot
  else if (moment.isDistribution) pool = GK_DISTRIBUTION_POOL
  else if (moment.isDefensive) pool = DEF_POOL
  else pool = ATT_POOLS[moment.tier] ?? ATT_POOLS.good

  const options = buildOptions(player, pool, moment.tier)
  return {
    decision: {
      id: id(),
      context: isGK && (moment.isDefensive || moment.isDistribution) ? 'gk' : 'match',
      situation: moment.situation,
      meta,
      options,
    },
    rewards: pool.map((o) => o.reward),
    maxReward: Math.max(...pool.map((o) => o.reward)),
    ceilings: pool.map((o) => o.baseCeiling),
    keyAttributes: pool.map((o) => o.keyAttributes),
  }
}

export function scenarioBeatToDecision(player: Player, beatSituation: string, options: import('./matchScenarios').ScenarioOption[], tier: string, meta: string): MatchDecisionBundle {
  const isGK = player.position === 'GK'
  const decisionOptions = options.map((o) => {
    const chance = optionChance(player, o, tier)
    return {
      id: id(),
      label: o.label,
      hint: optionHint(o.hint, o.keyAttributes, chance),
      successChance: chance,
      onSuccess: { narrative: '' },
      onFailure: { narrative: '' },
    }
  })
  return {
    decision: { id: id(), context: isGK ? 'gk' : 'match', situation: beatSituation, meta, options: decisionOptions },
    rewards: options.map((o) => o.reward),
    maxReward: Math.max(...options.map((o) => o.reward)),
    ceilings: options.map((o) => o.baseCeiling),
    keyAttributes: options.map((o) => o.keyAttributes),
  }
}
