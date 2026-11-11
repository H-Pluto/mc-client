import { blockLabel, effectLabel, entityLabel, itemLabel } from '@/lib/flow/catalog'
import type {
  CommandNodeData,
  CommandType,
  ConditionKind,
  ConditionNodeData,
  PositionContextData,
  PositionValue,
  RoleContextData,
  RoleValue,
  ScoreOperator,
} from '@/lib/flow/types'

export interface LabeledChoice<T extends string> {
  value: T
  label: string
}

export const ROLE_OPTIONS: LabeledChoice<RoleValue>[] = [
  { value: 'all_players', label: '所有玩家' },
  { value: 'nearest_player', label: '最近的玩家' },
  { value: 'specific_player', label: '指定玩家' },
  { value: 'entity_type', label: '某种实体' },
]

export const POSITION_OPTIONS: LabeledChoice<PositionValue>[] = [
  { value: 'self', label: '他们自己的位置' },
  { value: 'my_position', label: '最近的玩家位置' },
  { value: 'first_player', label: '第一位在线玩家' },
  { value: 'coords', label: '指定坐标' },
]

export const CONDITION_OPTIONS: LabeledChoice<ConditionKind>[] = [
  { value: 'block', label: '脚下方块' },
  { value: 'score', label: '计分板分数' },
  { value: 'holding', label: '手里拿着的物品' },
  { value: 'player_online', label: '有玩家在线' },
]

export const OPERATOR_OPTIONS: LabeledChoice<ScoreOperator>[] = [
  { value: '>=', label: '至少' },
  { value: '<=', label: '至多' },
  { value: '=', label: '正好' },
  { value: '>', label: '大于' },
  { value: '<', label: '小于' },
]

export const COMMAND_OPTIONS: LabeledChoice<CommandType>[] = [
  { value: 'give', label: '给予物品' },
  { value: 'effect', label: '施加状态效果' },
  { value: 'summon', label: '生成生物' },
  { value: 'fill', label: '填充方块' },
  { value: 'say', label: '全服广播' },
  { value: 'tp', label: '传送' },
]

function choiceLabel<T extends string>(choices: LabeledChoice<T>[], value: T): string {
  return choices.find((choice) => choice.value === value)?.label ?? value
}

export function rolePhrase(data: RoleContextData): string {
  switch (data.value) {
    case 'all_players':
      return '以所有玩家身份'
    case 'nearest_player':
      return '以最近的玩家身份'
    case 'specific_player':
      return data.player.trim() ? `以玩家「${data.player.trim()}」身份` : '以指定玩家身份'
    case 'entity_type':
      return `以所有「${entityLabel(data.entityType)}」身份`
    default:
      return '以所有玩家身份'
  }
}

export function positionPhrase(data: PositionContextData): string {
  switch (data.value) {
    case 'self':
      return '在他们自己的位置'
    case 'my_position':
      return '在最近的玩家位置'
    case 'first_player':
      return '在第一位在线玩家的位置'
    case 'coords':
      return `在坐标 ${coordsText(data)}`
    default:
      return '在他们自己的位置'
  }
}

function coordsText(data: PositionContextData): string {
  const parts = [data.x, data.y, data.z].map((part) => part.trim() || '?')
  return `(${parts.join(', ')})`
}

export function conditionPhrase(data: ConditionNodeData): string {
  switch (data.kind) {
    case 'score': {
      const objective = data.objective.trim() || '未填写'
      const value = data.value.trim() || '?'
      return `计分板「${objective}」${choiceLabel(OPERATOR_OPTIONS, data.operator)} ${value}`
    }
    case 'block':
      return `脚下方块是「${blockLabel(data.block)}」`
    case 'holding':
      return `手里拿着「${itemLabel(data.item)}」`
    case 'player_online':
      return '只要有玩家在线'
    default:
      return '条件'
  }
}

export function commandPhrase(data: CommandNodeData): string {
  switch (data.command) {
    case 'give':
      return `给予「${itemLabel(data.item)}」× ${data.count.trim() || '?'}`
    case 'effect':
      return `施加「${effectLabel(data.effect)}」${data.seconds.trim() || '?'} 秒 · ${data.level.trim() || '?'} 级`
    case 'summon':
      return data.positionMode === 'coords'
        ? `在指定坐标生成「${entityLabel(data.entity)}」`
        : `生成「${entityLabel(data.entity)}」`
    case 'fill':
      return `把一片区域填充成「${blockLabel(data.block)}」`
    case 'say':
      return data.message.trim() ? `全服广播「${data.message.trim()}」` : '全服广播'
    case 'tp':
      return data.mode === 'entity'
        ? `传送到玩家「${data.target.trim() || '?'}」`
        : `传送到坐标 (${[data.x, data.y, data.z].map((part) => part.trim() || '?').join(', ')})`
    default:
      return '执行指令'
  }
}

