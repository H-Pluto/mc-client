import type { Edge } from '@vue-flow/core'

import type { FlowNode } from './types'

export function canReach(edges: Edge[], fromId: string, targetId: string): boolean {
  return reach(edges, fromId, targetId, new Set())
}

function reach(
  edges: Edge[],
  fromId: string,
  targetId: string,
  seen: Set<string>,
): boolean {
  if (fromId === targetId) return true
  if (seen.has(fromId)) return false
  seen.add(fromId)
  return edges.some((edge) => edge.source === fromId && reach(edges, edge.target, targetId, seen))
}

export function canConnect(
  nodes: FlowNode[],
  edges: Edge[],
  sourceId: string,
  targetId: string,
): boolean {
  if (!sourceId || !targetId || sourceId === targetId) return false

  const source = nodes.find((node) => node.id === sourceId)
  const target = nodes.find((node) => node.id === targetId)
  if (!source || !target) return false

  // 指令节点是链路终点，不能再连出。
  if (source.type === 'command') return false

  // 每个节点最多只有一个上游，保证流程图是一条条可读的链。
  if (edges.some((edge) => edge.target === targetId)) return false

  return !canReach(edges, targetId, sourceId)
}
