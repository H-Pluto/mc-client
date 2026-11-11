import { describe, expect, it } from 'vitest'

import { compileFlow } from '../lib/flow/compile'
import {
  createCommandData,
  createConditionData,
  createContextData,
  type CommandNodeData,
  type ConditionNodeData,
  type ContextNodeData,
  type FlowNode,
  type FlowNodeType,
} from '../lib/flow/types'

function node(
  id: string,
  type: FlowNodeType,
  data: ContextNodeData | ConditionNodeData | CommandNodeData,
  y = 0,
): FlowNode {
  return { id, type, position: { x: 0, y }, data }
}

function link(source: string, target: string) {
  return { id: `${source}-${target}`, source, target }
}

function texts(nodes: FlowNode[], edges: Array<{ id: string; source: string; target: string }>) {
  return compileFlow(nodes, edges).commands.map((command) => command.text)
}

describe('compileFlow', () => {
  it('compiles the default gift flow', () => {
    const nodes = [
      node('role', 'context', createContextData('role'), 0),
      node('at', 'context', createContextData('position'), 100),
      node('give', 'command', createCommandData('give'), 200),
    ]

    expect(texts(nodes, [link('role', 'at'), link('at', 'give')])).toEqual([
      'execute as @a at @s run give @s minecraft:diamond 1',
    ])
  })

  it('shares one context with forked command branches', () => {
    const nodes = [
      node('role', 'context', createContextData('role')),
      node('at', 'context', createContextData('position'), 100),
      node('give', 'command', createCommandData('give'), 200),
      node('effect', 'command', createCommandData('effect'), 300),
    ]

    const edges = [link('role', 'at'), link('at', 'give'), link('role', 'effect')]

    expect(texts(nodes, edges)).toEqual([
      'execute as @a at @s run give @s minecraft:diamond 1',
      'execute as @a run effect give @s minecraft:speed 30 0 true',
    ])
  })

  it('chains conditions and converts score operators into ranges', () => {
    const score = createConditionData('score')
    if (score.kind !== 'score') throw new Error('unexpected condition')
    score.objective = 'kills'
    score.operator = '>='
    score.value = '10'

    const nodes = [
      node('role', 'context', createContextData('role')),
      node('block', 'condition', createConditionData('block'), 100),
      node('score', 'condition', score, 200),
      node('give', 'command', createCommandData('give'), 300),
    ]

    expect(
      texts(nodes, [
        link('role', 'block'),
        link('block', 'score'),
        link('score', 'give'),
      ]),
    ).toEqual([
      'execute as @a if block ~ ~-1 ~ minecraft:stone if score @s kills matches 10.. run give @s minecraft:diamond 1',
    ])
  })

  it('does not wrap a broadcast in execute context', () => {
    const say = createCommandData('say')
    if (say.command !== 'say') throw new Error('unexpected command')
    say.message = '礼包已发放'

    const nodes = [
      node('role', 'context', createContextData('role')),
      node('say', 'command', say, 100),
    ]

    expect(texts(nodes, [link('role', 'say')])).toEqual(['say 礼包已发放'])
  })

  it('orders separate chains from top to bottom', () => {
    const nodes = [
      node('lower', 'command', createCommandData('give'), 500),
      node('upper', 'command', createCommandData('give'), 10),
    ]

    expect(texts(nodes, [])).toEqual(['give @p minecraft:diamond 1', 'give @p minecraft:diamond 1'])
  })

  it('reports incomplete fields instead of building a broken command', () => {
    const position = createContextData('position')
    if (position.kind !== 'position') throw new Error('unexpected context')
    position.value = 'coords'
    position.x = ''
    position.y = ''
    position.z = ''

    const nodes = [
      node('at', 'context', position),
      node('give', 'command', createCommandData('give'), 100),
    ]

    const result = compileFlow(nodes, [link('at', 'give')])
    expect(result.commands).toHaveLength(0)
    expect(result.errors).toContain('位置上下文还没填写完整')
  })
})
