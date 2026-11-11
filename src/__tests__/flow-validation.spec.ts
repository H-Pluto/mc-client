import { describe, expect, it } from 'vitest'

import { canConnect } from '../lib/flow/validation'
import {
  createCommandData,
  createConditionData,
  createContextData,
  type FlowNode,
  type FlowNodeType,
} from '../lib/flow/types'

function node(id: string, type: FlowNodeType): FlowNode {
  const data =
    type === 'context'
      ? createContextData('role')
      : type === 'condition'
        ? createConditionData('block')
        : createCommandData('give')
  return { id, type, position: { x: 0, y: 0 }, data }
}

const nodes = [
  node('role', 'context'),
  node('at', 'context'),
  node('check', 'condition'),
  node('give', 'command'),
]

describe('canConnect', () => {
  it('allows context, condition and command targets', () => {
    expect(canConnect(nodes, [], 'role', 'at')).toBe(true)
    expect(canConnect(nodes, [], 'role', 'check')).toBe(true)
    expect(canConnect(nodes, [], 'check', 'give')).toBe(true)
  })

  it('never lets a command node connect out', () => {
    expect(canConnect(nodes, [], 'give', 'role')).toBe(false)
    expect(canConnect(nodes, [], 'give', 'check')).toBe(false)
  })

  it('rejects self connections and a second upstream', () => {
    const edges = [{ id: 'e1', source: 'role', target: 'at' }]

    expect(canConnect(nodes, edges, 'at', 'at')).toBe(false)
    expect(canConnect(nodes, edges, 'check', 'at')).toBe(false)
  })

  it('rejects connections that would create a cycle', () => {
    const edges = [
      { id: 'e1', source: 'role', target: 'at' },
      { id: 'e2', source: 'at', target: 'check' },
    ]

    expect(canConnect(nodes, edges, 'check', 'role')).toBe(false)
  })

  it('allows forking from one context to two commands', () => {
    const edges = [{ id: 'e1', source: 'role', target: 'at' }]

    expect(canConnect(nodes, edges, 'at', 'give')).toBe(true)
    expect(canConnect(nodes, edges, 'role', 'give')).toBe(true)
  })
})
