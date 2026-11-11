import type { Edge } from '@vue-flow/core'

import type {
  CommandNodeData,
  ConditionNodeData,
  ContextNodeData,
  FlowNode,
  PositionContextData,
  RoleContextData,
  ScoreOperator,
} from './types'

export interface CompiledCommand {
  nodeId: string
  x: number
  y: number
  text: string
  error?: string
}

export interface CompileOutput {
  commands: CompiledCommand[]
  errors: string[]
}

interface CommandContext {
  as: string | null
  at: string | null
  conditions: string[]
}

interface ClauseResult {
  clause?: string
  error?: string
}

const EMPTY_CONTEXT: CommandContext = { as: null, at: null, conditions: [] }

function isFilled(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function toInt(value: string | undefined): number | null {
  if (!isFilled(value)) return null
  const text = value.trim()
  if (!/^-?\d+$/.test(text)) return null
  const number = Number(text)
  return Number.isSafeInteger(number) ? number : null
}

function withNamespace(id: string): string {
  const text = id.trim()
  if (!text) return text
  return text.includes(':') || text.startsWith('#') ? text : `minecraft:${text}`
}

function roleClause(data: RoleContextData): string | null {
  switch (data.value) {
    case 'all_players':
      return 'as @a'
    case 'nearest_player':
      return 'as @p'
    case 'specific_player':
      return isFilled(data.player) ? `as ${data.player.trim()}` : null
    case 'entity_type':
      return isFilled(data.entityType) ? `as @e[type=${data.entityType.trim()}]` : null
    default:
      return null
  }
}

function positionClause(data: PositionContextData): string | null {
  switch (data.value) {
    case 'self':
      return 'at @s'
    case 'my_position':
      return 'at @p'
    case 'first_player':
      return 'at @a[limit=1]'
    case 'coords': {
      const [x, y, z] = [data.x, data.y, data.z]
      if (!isFilled(x) || !isFilled(y) || !isFilled(z)) return null
      return `positioned ${x.trim()} ${y.trim()} ${z.trim()}`
    }
    default:
      return null
  }
}

function scoreRange(operator: ScoreOperator, value: number): string {
  switch (operator) {
    case '>=':
      return `${value}..`
    case '<=':
      return `..${value}`
    case '=':
      return `${value}`
    case '>':
      return `${value + 1}..`
    case '<':
      return `..${value - 1}`
    default:
      return `${value}`
  }
}

function conditionClause(data: ConditionNodeData): ClauseResult {
  switch (data.kind) {
    case 'score': {
      if (!isFilled(data.objective)) return { error: '计分板条件还没填写计分板名称' }
      const value = toInt(data.value)
      if (value === null) return { error: '计分板条件的数值需为整数' }
      return {
        clause: `if score @s ${data.objective.trim()} matches ${scoreRange(data.operator, value)}`,
      }
    }
    case 'block':
      if (!isFilled(data.block)) return { error: '方块条件还没选择方块' }
      return { clause: `if block ~ ~-1 ~ ${withNamespace(data.block)}` }
    case 'holding':
      if (!isFilled(data.item)) return { error: '手持物品条件还没选择物品' }
      return { clause: `if items entity @s weapon.mainhand ${withNamespace(data.item)}` }
    case 'player_online':
      return { clause: 'if entity @a[limit=1]' }
    default:
      return { error: '条件类型无法识别' }
  }
}

function targetOf(context: CommandContext): string {
  return context.as ? '@s' : '@p'
}

function coordinates(
  values: [string, string, string],
  label: string,
): { text: string } | { error: string } {
  if (!values.every(isFilled)) return { error: `${label}坐标还没填写完整` }
  return { text: values.map((value) => value.trim()).join(' ') }
}

function buildAction(
  data: CommandNodeData,
  context: CommandContext,
): { text?: string; error?: string } {
  switch (data.command) {
    case 'give': {
      if (!isFilled(data.item)) return { error: '指令还没选择物品' }
      const count = toInt(data.count)
      if (count === null || count < 1) return { error: '物品数量需为大于 0 的整数' }
      return { text: `give ${targetOf(context)} ${withNamespace(data.item)} ${count}` }
    }
    case 'effect': {
      if (!isFilled(data.effect)) return { error: '指令还没选择状态效果' }
      const seconds = toInt(data.seconds)
      if (seconds === null || seconds < 1) return { error: '持续时间需为大于 0 的整数' }
      const level = toInt(data.level)
      if (level === null || level < 1 || level > 256) return { error: '等级需为 1 到 256 之间的整数' }
      return {
        text: `effect give ${targetOf(context)} ${withNamespace(data.effect)} ${seconds} ${level - 1} true`,
      }
    }
    case 'summon': {
      if (!isFilled(data.entity)) return { error: '指令还没选择生物' }
      if (data.positionMode === 'coords') {
        const coords = coordinates([data.x, data.y, data.z], '生成位置')
        if ('error' in coords) return coords
        return { text: `summon ${withNamespace(data.entity)} ${coords.text}` }
      }
      return { text: `summon ${withNamespace(data.entity)}` }
    }
    case 'fill': {
      if (!isFilled(data.block)) return { error: '指令还没选择方块' }
      const start = coordinates([data.x1, data.y1, data.z1], '起点')
      if ('error' in start) return start
      const end = coordinates([data.x2, data.y2, data.z2], '终点')
      if ('error' in end) return end
      return { text: `fill ${start.text} ${end.text} ${withNamespace(data.block)}` }
    }
    case 'say':
      if (!isFilled(data.message)) return { error: '广播内容不能为空' }
      return { text: `say ${data.message.trim()}` }
    case 'tp': {
      if (data.mode === 'entity') {
        if (!isFilled(data.target)) return { error: '请填写要传送到哪位玩家' }
        return { text: `tp ${targetOf(context)} ${data.target.trim()}` }
      }
      const coords = coordinates([data.x, data.y, data.z], '传送目标')
      if ('error' in coords) return coords
      return { text: `tp ${targetOf(context)} ${coords.text}` }
    }
    default:
      return { error: '指令类型无法识别' }
  }
}

function wrap(context: CommandContext, action: string): string {
  const parts = [context.as, context.at, ...context.conditions].filter(
    (part): part is string => Boolean(part),
  )
  return parts.length ? `execute ${parts.join(' ')} run ${action}` : action
}

export function compileFlow(nodes: FlowNode[], edges: Edge[]): CompileOutput {
  const nodeById = new Map<string, FlowNode>()
  for (const node of nodes) nodeById.set(node.id, node)

  const children = new Map<string, string[]>()
  const hasParent = new Set<string>()
  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue
    hasParent.add(edge.target)
    const list = children.get(edge.source) ?? []
    list.push(edge.target)
    children.set(edge.source, list)
  }

  const errors: string[] = []
  const commands: CompiledCommand[] = []

  function visit(id: string, context: CommandContext, trail: Set<string>) {
    const node = nodeById.get(id)
    if (!node) return
    if (trail.has(id)) {
      errors.push('流程图里存在循环连线，已跳过重复的节点')
      return
    }

    const nextTrail = new Set(trail).add(id)

    if (node.type === 'command') {
      const data = node.data as CommandNodeData
      const action = buildAction(data, context)
      const entry = { nodeId: node.id, x: node.position.x, y: node.position.y }
      if (action.text) {
        const text = data.command === 'say' ? action.text : wrap(context, action.text)
        commands.push({ ...entry, text })
      } else {
        const error = action.error ?? '指令还没填写完整'
        commands.push({ ...entry, text: '', error })
        errors.push(error)
      }
      return
    }

    if (node.type === 'context') {
      const data = node.data as ContextNodeData
      const next: CommandContext = { ...context, conditions: [...context.conditions] }
      if (data.kind === 'role') {
        const clause = roleClause(data)
        if (!clause) {
          errors.push('身份上下文还没填写完整')
          return
        }
        next.as = clause
      } else {
        const clause = positionClause(data)
        if (!clause) {
          errors.push('位置上下文还没填写完整')
          return
        }
        next.at = clause
      }
      for (const childId of children.get(id) ?? []) visit(childId, next, nextTrail)
      return
    }

    if (node.type === 'condition') {
      const result = conditionClause(node.data as ConditionNodeData)
      if (!result.clause) {
        errors.push(result.error ?? '条件还没填写完整')
        return
      }
      const next: CommandContext = {
        ...context,
        conditions: [...context.conditions, result.clause],
      }
      for (const childId of children.get(id) ?? []) visit(childId, next, nextTrail)
    }
  }

  const roots = nodes.filter((node) => !hasParent.has(node.id))
  roots.sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
  for (const root of roots) visit(root.id, EMPTY_CONTEXT, new Set())

  if (!roots.length && nodes.length > 0) errors.push('流程图里没有起点节点')

  commands.sort((a, b) => a.y - b.y || a.x - b.x)

  return { commands, errors: [...new Set(errors)] }
}
