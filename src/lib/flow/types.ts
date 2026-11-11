import type { Node } from '@vue-flow/core'

export type FlowNodeType = 'context' | 'condition' | 'command'

export type RoleValue = 'all_players' | 'nearest_player' | 'specific_player' | 'entity_type'
export type PositionValue = 'self' | 'my_position' | 'first_player' | 'coords'

export interface RoleContextData {
  kind: 'role'
  value: RoleValue
  player: string
  entityType: string
}

export interface PositionContextData {
  kind: 'position'
  value: PositionValue
  x: string
  y: string
  z: string
}

export type ContextNodeData = RoleContextData | PositionContextData

export type ConditionKind = 'score' | 'block' | 'holding' | 'player_online'
export type ScoreOperator = '>=' | '<=' | '=' | '>' | '<'

export interface ScoreConditionData {
  kind: 'score'
  objective: string
  operator: ScoreOperator
  value: string
}

export interface BlockConditionData {
  kind: 'block'
  block: string
}

export interface HoldingConditionData {
  kind: 'holding'
  item: string
}

export interface PlayerOnlineConditionData {
  kind: 'player_online'
}

export type ConditionNodeData =
  | ScoreConditionData
  | BlockConditionData
  | HoldingConditionData
  | PlayerOnlineConditionData

export type CommandType = 'give' | 'effect' | 'summon' | 'fill' | 'say' | 'tp'

export interface GiveCommandData {
  command: 'give'
  item: string
  count: string
}

export interface EffectCommandData {
  command: 'effect'
  effect: string
  seconds: string
  level: string
}

export interface SummonCommandData {
  command: 'summon'
  entity: string
  positionMode: 'context' | 'coords'
  x: string
  y: string
  z: string
}

export interface FillCommandData {
  command: 'fill'
  x1: string
  y1: string
  z1: string
  x2: string
  y2: string
  z2: string
  block: string
}

export interface SayCommandData {
  command: 'say'
  message: string
}

export interface TpCommandData {
  command: 'tp'
  mode: 'coords' | 'entity'
  x: string
  y: string
  z: string
  target: string
}

export type CommandNodeData =
  | GiveCommandData
  | EffectCommandData
  | SummonCommandData
  | FillCommandData
  | SayCommandData
  | TpCommandData

export type FlowNodeData = ContextNodeData | ConditionNodeData | CommandNodeData

export type FlowNode = Node<FlowNodeData>

export function createContextData(kind: 'role' | 'position'): ContextNodeData {
  if (kind === 'role') {
    return { kind: 'role', value: 'all_players', player: '', entityType: 'zombie' }
  }
  return { kind: 'position', value: 'self', x: '~', y: '~', z: '~' }
}

export function createConditionData(kind: ConditionKind = 'block'): ConditionNodeData {
  switch (kind) {
    case 'score':
      return { kind: 'score', objective: 'points', operator: '>=', value: '10' }
    case 'block':
      return { kind: 'block', block: 'stone' }
    case 'holding':
      return { kind: 'holding', item: 'diamond' }
    case 'player_online':
      return { kind: 'player_online' }
    default:
      return { kind: 'block', block: 'stone' }
  }
}

export function createCommandData(command: CommandType = 'give'): CommandNodeData {
  switch (command) {
    case 'give':
      return { command: 'give', item: 'diamond', count: '1' }
    case 'effect':
      return { command: 'effect', effect: 'speed', seconds: '30', level: '1' }
    case 'summon':
      return { command: 'summon', entity: 'zombie', positionMode: 'context', x: '~', y: '~', z: '~' }
    case 'fill':
      return {
        command: 'fill',
        x1: '~-2',
        y1: '~-1',
        z1: '~-2',
        x2: '~2',
        y2: '~-1',
        z2: '~2',
        block: 'stone',
      }
    case 'say':
      return { command: 'say', message: '' }
    case 'tp':
      return { command: 'tp', mode: 'coords', x: '~', y: '~', z: '~', target: '' }
    default:
      return { command: 'give', item: 'diamond', count: '1' }
  }
}
