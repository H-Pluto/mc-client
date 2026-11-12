<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { VueFlow, useVueFlow, type Connection, type Edge } from '@vue-flow/core'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@/components/flow/flow-nodes.css'

import AppBar from '@/components/AppBar.vue'
import UpdateControl from '@/components/UpdateControl.vue'
import CommandNode from '@/components/flow/CommandNode.vue'
import ConditionNode from '@/components/flow/ConditionNode.vue'
import ContextNode from '@/components/flow/ContextNode.vue'
import { compileFlow } from '@/lib/flow/compile'
import {
  createCommandData,
  createConditionData,
  createContextData,
  type CommandNodeData,
  type CommandType,
  type ConditionKind,
  type ConditionNodeData,
  type ContextNodeData,
  type FlowNode,
  type FlowNodeData,
  type FlowNodeType,
} from '@/lib/flow/types'
import { getFlowApi, type FlowRunResult } from '@/services/flow'
import { canConnect } from '@/lib/flow/validation'
import { useConnectionStore } from '@/stores/connection'

interface FlowFileNode {
  id: string
  type: FlowNodeType
  position: { x: number; y: number }
  data: FlowNodeData
}

interface FlowFileEdge {
  id: string
  source: string
  target: string
}

interface FlowFile {
  version: 1
  nodes: FlowFileNode[]
  edges: FlowFileEdge[]
}

interface HistoryEntry {
  id: string
  at: string
  command: string
  ok: boolean
  detail: string
}

const AUTOSAVE_KEY = 'mc-flow-autosave'
const HISTORY_KEY = 'mc-flow-history'
const HISTORY_LIMIT = 30
const CONDITION_KINDS: ConditionKind[] = ['score', 'block', 'holding', 'player_online']
const COMMAND_TYPES: CommandType[] = ['give', 'effect', 'summon', 'fill', 'say', 'tp']

const router = useRouter()
const connection = useConnectionStore()
const {
  nodes,
  edges,
  addNodes,
  addEdges,
  setNodes,
  setEdges,
  fitView,
  screenToFlowCoordinate,
  vueFlowRef,
} = useVueFlow()

const previewOpen = ref(true)
const running = ref(false)
const currentFile = ref<string | null>(null)
const message = ref<{ tone: 'ok' | 'error'; text: string } | null>(null)
const history = ref<HistoryEntry[]>(loadHistory())

const compiled = computed(() => compileFlow(nodes.value as unknown as FlowNode[], edges.value))
const commandList = computed(() => compiled.value.commands)
const canRun = computed(
  () =>
    connection.isConnected &&
    !running.value &&
    commandList.value.length > 0 &&
    compiled.value.errors.length === 0,
)
const barStatus = computed(() =>
  connection.isConnected ? `已连接 · ${connection.address}` : '未连接',
)

let autosaveTimer: number | undefined

watch(
  history,
  (value) => {
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(value))
    } catch {
      // 本地存储不可用时忽略，执行日志仍然保留在内存里。
    }
  },
  { deep: true },
)

watch(
  [nodes, edges],
  () => {
    window.clearTimeout(autosaveTimer)
    autosaveTimer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serializeFlow()))
      } catch {
        // 忽略自动保存失败，用户仍可以手动保存文件。
      }
    }, 500)
  },
  { deep: true },
)

onMounted(() => {
  window.addEventListener('keydown', handleShortcut)

  if (nodes.value.length) return

  const restored = readAutosave()
  if (restored) {
    setNodes(restored.nodes)
    setEdges(restored.edges)
    void nextTick(() => fitView({ padding: 0.2 }))
    return
  }

  applyDefaultFlow()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleShortcut)
  if (autosaveTimer) window.clearTimeout(autosaveTimer)
})

function handleShortcut(event: KeyboardEvent) {
  if (event.repeat) return
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return

  const key = event.key.toLowerCase()
  if (key === 's') {
    event.preventDefault()
    void saveFlow()
  } else if (key === 't') {
    event.preventDefault()
    newFlow()
  } else if (key === 'o') {
    event.preventDefault()
    void openFlow()
  }
}

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function isFlowNodeType(value: unknown): value is FlowNodeType {
  return value === 'context' || value === 'condition' || value === 'command'
}

function isConditionKind(value: unknown): value is ConditionKind {
  return typeof value === 'string' && (CONDITION_KINDS as string[]).includes(value)
}

function isCommandType(value: unknown): value is CommandType {
  return typeof value === 'string' && (COMMAND_TYPES as string[]).includes(value)
}

function normalizeData(type: FlowNodeType, raw: unknown): FlowNodeData {
  const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

  if (type === 'context') {
    const kind = data.kind === 'position' ? 'position' : 'role'
    return { ...createContextData(kind), ...data, kind } as unknown as ContextNodeData
  }

  if (type === 'condition') {
    const kind = isConditionKind(data.kind) ? data.kind : 'block'
    return { ...createConditionData(kind), ...data, kind } as unknown as ConditionNodeData
  }

  const command = isCommandType(data.command) ? data.command : 'give'
  return { ...createCommandData(command), ...data, command } as unknown as CommandNodeData
}

function normalizeNode(raw: unknown): FlowNode | null {
  if (!raw || typeof raw !== 'object') return null
  const node = raw as Record<string, unknown>
  if (typeof node.id !== 'string' || !node.id) return null
  if (!isFlowNodeType(node.type)) return null

  const position = node.position as Record<string, unknown> | undefined
  const x = Number(position?.x)
  const y = Number(position?.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null

  return {
    id: node.id,
    type: node.type,
    position: { x, y },
    data: normalizeData(node.type, node.data),
  }
}

function parseFlowContent(content: string): { nodes: FlowNode[]; edges: Edge[] } {
  const raw: unknown = JSON.parse(content)
  const file = raw as { nodes?: unknown; edges?: unknown } | null
  if (!file || !Array.isArray(file.nodes) || !Array.isArray(file.edges)) {
    throw new Error('这不是有效的流程图文件')
  }

  const parsedNodes = file.nodes
    .map(normalizeNode)
    .filter((node): node is FlowNode => node !== null)
  if (!parsedNodes.length) throw new Error('流程图里没有可用节点')

  const ids = new Set(parsedNodes.map((node) => node.id))
  const parsedEdges: Edge[] = []
  for (const value of file.edges) {
    if (!value || typeof value !== 'object') continue
    const edge = value as Record<string, unknown>
    if (typeof edge.source !== 'string' || typeof edge.target !== 'string') continue
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue
    parsedEdges.push({
      id: typeof edge.id === 'string' && edge.id ? edge.id : randomId('e'),
      source: edge.source,
      target: edge.target,
    })
  }

  return { nodes: parsedNodes, edges: parsedEdges }
}

function serializeFlow(): FlowFile {
  return {
    version: 1,
    nodes: nodes.value.map((node) => ({
      id: node.id,
      type: isFlowNodeType(node.type) ? node.type : 'context',
      position: { x: node.position.x, y: node.position.y },
      data: JSON.parse(JSON.stringify(node.data)) as FlowNodeData,
    })),
    edges: edges.value.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
  }
}

function readAutosave(): { nodes: FlowNode[]; edges: Edge[] } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(AUTOSAVE_KEY)
    if (!raw) return null
    return parseFlowContent(raw)
  } catch {
    return null
  }
}

function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (entry): entry is HistoryEntry =>
          Boolean(entry) &&
          typeof entry === 'object' &&
          typeof (entry as HistoryEntry).command === 'string',
      )
      .slice(0, HISTORY_LIMIT)
  } catch {
    return []
  }
}

function makeNode(type: FlowNodeType, x: number, y: number, data: FlowNodeData): FlowNode {
  return { id: randomId('n'), type, position: { x, y }, data }
}

function applyDefaultFlow() {
  const role = makeNode('context', 80, 40, createContextData('role'))
  const position = makeNode('context', 80, 240, createContextData('position'))
  const action = makeNode('command', 80, 440, createCommandData('give'))

  setNodes([role, position, action])
  setEdges([
    { id: randomId('e'), source: role.id, target: position.id },
    { id: randomId('e'), source: position.id, target: action.id },
  ])
  void nextTick(() => fitView({ padding: 0.2 }))
}

function addNode(type: FlowNodeType) {
  const rect = vueFlowRef.value?.getBoundingClientRect()
  const center = screenToFlowCoordinate({
    x: rect ? rect.x + rect.width / 2 : window.innerWidth / 2,
    y: rect ? rect.y + rect.height / 2 : window.innerHeight / 2,
  })
  const position = {
    x: Math.round(center.x + (Math.random() * 80 - 40)),
    y: Math.round(center.y + (Math.random() * 80 - 40)),
  }
  const data =
    type === 'context'
      ? createContextData('role')
      : type === 'condition'
        ? createConditionData('block')
        : createCommandData('give')

  addNodes([{ id: randomId('n'), type, position, data }])
}

function isValidConnection(connection: Connection): boolean {
  return canConnect(
    nodes.value as unknown as FlowNode[],
    edges.value,
    connection.source,
    connection.target,
  )
}

function handleConnect(connection: Connection) {
  if (!isValidConnection(connection)) return
  addEdges([
    {
      id: randomId('e'),
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle ?? null,
      targetHandle: connection.targetHandle ?? null,
    },
  ])
}

function newFlow() {
  if (nodes.value.length && !window.confirm('新建会清空当前流程图，确定继续吗？')) return
  applyDefaultFlow()
  currentFile.value = null
  message.value = null
}

async function openFlow() {
  const api = getFlowApi()
  if (!api) {
    message.value = { tone: 'error', text: '当前环境不支持打开文件，请使用 Electron 客户端。' }
    return
  }

  try {
    const result = await api.load()
    if (!result.ok) {
      message.value = { tone: 'error', text: result.message }
      return
    }
    if (!result.data) return

    const parsed = parseFlowContent(result.data.content)
    setNodes(parsed.nodes)
    setEdges(parsed.edges)
    currentFile.value = result.data.path
    await nextTick()
    fitView({ padding: 0.2 })
    message.value = { tone: 'ok', text: `已打开 ${result.data.path}` }
  } catch (error) {
    message.value = {
      tone: 'error',
      text: error instanceof Error ? error.message : '打开流程图失败',
    }
  }
}

async function saveFlow() {
  const api = getFlowApi()
  if (!api) {
    message.value = { tone: 'error', text: '当前环境不支持保存文件，请使用 Electron 客户端。' }
    return
  }

  try {
    const result = await api.save(JSON.stringify(serializeFlow(), null, 2), currentFile.value ?? undefined)
    if (!result.ok) {
      message.value = { tone: 'error', text: result.message }
      return
    }
    if (!result.data) return
    currentFile.value = result.data.path
    message.value = { tone: 'ok', text: `已保存到 ${result.data.path}` }
  } catch (error) {
    message.value = {
      tone: 'error',
      text: error instanceof Error ? error.message : '保存流程图失败',
    }
  }
}

function appendHistory(results: FlowRunResult[]) {
  const at = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  const entries: HistoryEntry[] = results.map((result) => ({
    id: randomId('h'),
    at,
    command: result.command,
    ok: result.ok,
    detail: result.ok ? result.response?.trim() || '（无输出）' : result.message ?? '执行失败',
  }))
  history.value = [...entries, ...history.value].slice(0, HISTORY_LIMIT)
}

async function runFlow() {
  if (!canRun.value) return

  const api = getFlowApi()
  if (!api) {
    message.value = { tone: 'error', text: '当前环境不支持执行指令，请使用 Electron 客户端。' }
    return
  }

  running.value = true
  message.value = null

  try {
    const result = await api.run(commandList.value.map((entry) => entry.text))
    if (!result.ok) {
      message.value = { tone: 'error', text: result.message }
      return
    }

    appendHistory(result.data)
    const failed = result.data.filter((entry) => !entry.ok).length
    message.value = failed
      ? {
        tone: 'error',
        text: `执行完成：${result.data.length - failed} 条成功，${failed} 条失败。`,
      }
      : { tone: 'ok', text: `已执行 ${result.data.length} 条指令。` }
  } catch (error) {
    message.value = {
      tone: 'error',
      text: error instanceof Error ? error.message : '执行失败',
    }
  } finally {
    running.value = false
  }
}

async function goConsole() {
  await router.push({ name: connection.isConnected ? 'console' : 'connect' })
}

async function goCommandList() {
  await router.push({ name: 'commandList' })
}
</script>

<template>
  <div class="flow-page">
    <AppBar :tone="connection.isConnected ? 'ready' : 'idle'" :status="barStatus">
      <button class="bar-button" type="button" @click="goConsole">返回控制台</button>
      <button class="bar-button" type="button" @click="goCommandList">指令集</button>
      <UpdateControl />
    </AppBar>

    <main class="flow-page__main">
      <header class="flow-page__head">
        <div class="flow-page__intro">
          <h1 class="flow-page__title">流程图</h1>
          <p class="flow-page__sub">从上往下读：改变身份和位置 → 判断条件 → 执行指令。</p>
        </div>

        <button class="run-button" type="button" :disabled="!canRun" @click="runFlow">
          {{ running ? '执行中…' : `执行全部${commandList.length ? ` (${commandList.length})` : ''}` }}
        </button>
      </header>

      <div class="flow-toolbar">
        <button class="tool-button" type="button" @click="newFlow">新建</button>
        <button class="tool-button" type="button" @click="openFlow">打开</button>
        <button class="tool-button" type="button" @click="saveFlow">保存</button>
        <span class="flow-toolbar__divider" aria-hidden="true"></span>
        <button class="tool-button" type="button" @click="addNode('context')">+ 上下文</button>
        <button class="tool-button" type="button" @click="addNode('condition')">+ 条件</button>
        <button class="tool-button" type="button" @click="addNode('command')">+ 指令</button>
        <span class="flow-toolbar__hint">从节点底部圆点拖到下一个节点顶部连线</span>
      </div>

      <p v-if="!connection.isConnected" class="notice notice--warn" role="status">
        尚未连接服务器，可以先编辑流程图，连接后再执行。
      </p>

      <p v-if="message" class="notice" :data-tone="message.tone" role="status">
        {{ message.text }}
      </p>

      <div class="flow-canvas">
        <VueFlow :is-valid-connection="isValidConnection" :min-zoom="0.35" :max-zoom="1.4" :fit-view-on-init="true"
          :snap-to-grid="true" :snap-grid="[16, 16]" :default-viewport="{ zoom: 0.9 }"
          :delete-key-code="['Backspace', 'Delete']" @connect="handleConnect">
          <Background pattern-color="#2a323d" :gap="20" :size="1" />
          <Controls :show-interactive="false" />

          <template #node-context="{ id, data, connectable }">
            <ContextNode :id="id" :data="data" :connectable="connectable" />
          </template>
          <template #node-condition="{ id, data, connectable }">
            <ConditionNode :id="id" :data="data" :connectable="connectable" />
          </template>
          <template #node-command="{ id, data, connectable }">
            <CommandNode :id="id" :data="data" :connectable="connectable" />
          </template>
        </VueFlow>
      </div>

      <section class="preview">
        <button class="preview__toggle" type="button" :aria-expanded="previewOpen" @click="previewOpen = !previewOpen">
          <span class="preview__chevron" :class="{ 'is-open': previewOpen }" aria-hidden="true"></span>
          命令预览
          <span class="preview__count">{{ commandList.length }} 条</span>
        </button>

        <div v-if="previewOpen" class="preview__body">
          <ul v-if="compiled.errors.length" class="preview__errors">
            <li v-for="error in compiled.errors" :key="error">{{ error }}</li>
          </ul>

          <ol v-if="commandList.length" class="preview__list">
            <li v-for="entry in commandList" :key="entry.nodeId" class="preview__item">
              <code v-if="entry.text" class="preview__code">/{{ entry.text }}</code>
              <span v-else class="preview__invalid">{{ entry.error }}</span>
            </li>
          </ol>
          <p v-else class="preview__empty">
            还没有可执行的指令。添加一个「指令」节点，并用连线接到上下文下面。
          </p>
        </div>
      </section>

      <section v-if="history.length" class="history">
        <header class="history__head">
          <h2 class="history__title">最近执行</h2>
          <button class="history__clear" type="button" @click="history = []">清空记录</button>
        </header>

        <ul class="history__list">
          <li v-for="entry in history" :key="entry.id" class="history__item" :data-tone="entry.ok ? 'ok' : 'error'">
            <span class="history__time">{{ entry.at }}</span>
            <code class="history__command">/{{ entry.command }}</code>
            <span class="history__detail">{{ entry.detail }}</span>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>

<style scoped>
.flow-page {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background-color: var(--bg);
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
  background-size: 36px 36px;
}

.flow-page__main {
  display: grid;
  flex: 1;
  gap: 14px;
  align-content: start;
  width: min(1280px, 100%);
  margin: 0 auto;
  padding: clamp(22px, 3vw, 36px) clamp(20px, 4vw, 40px) 56px;
}

.flow-page__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.flow-page__title {
  font-family: var(--font-display);
  font-size: clamp(24px, 2.6vw, 32px);
  font-weight: 600;
  line-height: 1.2;
}

.flow-page__sub {
  margin-top: 6px;
  color: var(--text-dim);
  font-size: 12px;
}

.run-button {
  height: 38px;
  padding: 0 20px;
  background: var(--gold);
  border: 0;
  border-radius: 2px;
  color: var(--gold-ink);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.run-button:hover:not(:disabled) {
  background: var(--gold-strong);
}

.run-button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.flow-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(22, 27, 34, 0.62);
  border: 1px solid var(--line);
}

.flow-toolbar__divider {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--line);
}

.flow-toolbar__hint {
  margin-left: auto;
  color: var(--text-dim);
  font-size: 11px;
}

.bar-button,
.tool-button {
  flex: none;
  height: 30px;
  padding: 0 12px;
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 2px;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
}

.bar-button:hover:not(:disabled),
.tool-button:hover:not(:disabled) {
  border-color: var(--line-strong);
  color: var(--text);
}

.notice {
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--line);
  color: var(--text-muted);
  font-size: 12px;
}

.notice--warn {
  background: rgba(226, 165, 75, 0.06);
  border-color: rgba(226, 165, 75, 0.4);
  color: var(--gold-strong);
}

.notice[data-tone='ok'] {
  background: rgba(111, 207, 151, 0.06);
  border-color: rgba(111, 207, 151, 0.35);
  color: #9fd9b8;
}

.notice[data-tone='error'] {
  background: rgba(229, 119, 95, 0.08);
  border-color: rgba(229, 119, 95, 0.4);
  color: var(--danger);
}

.flow-canvas {
  height: clamp(420px, 58vh, 760px);
  background: #12171d;
  border: 1px solid var(--line);
}

.flow-canvas :deep(.vue-flow) {
  background: transparent;
  font-family: var(--font-sans);
}

.flow-canvas :deep(.vue-flow__node) {
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 3px;
  box-shadow: none;
  color: var(--text);
  font-size: 13px;
  text-align: left;
}

.flow-canvas :deep(.vue-flow__node:focus),
.flow-canvas :deep(.vue-flow__node:focus-visible) {
  outline: none;
}

.flow-canvas :deep(.vue-flow__controls) {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 2px;
  box-shadow: none;
}

.flow-canvas :deep(.vue-flow__controls-button) {
  background: var(--panel);
  border-bottom: 1px solid var(--line);
  fill: var(--text-muted);
}

.flow-canvas :deep(.vue-flow__controls-button:hover) {
  background: var(--line);
}

.preview {
  background: rgba(22, 27, 34, 0.62);
  border: 1px solid var(--line);
}

.preview__toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 16px;
  background: transparent;
  border: 0;
  color: var(--text);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.preview__chevron {
  width: 7px;
  height: 7px;
  border-right: 1.5px solid var(--text-muted);
  border-bottom: 1.5px solid var(--text-muted);
  transform: rotate(-45deg);
}

.preview__chevron.is-open {
  transform: rotate(45deg);
}

.preview__count {
  margin-left: auto;
  padding: 1px 8px;
  border: 1px solid var(--line);
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 11px;
}

.preview__body {
  padding: 0 16px 14px;
}

.preview__errors {
  display: grid;
  gap: 4px;
  margin: 0 0 10px;
  padding: 8px 10px;
  background: rgba(229, 119, 95, 0.07);
  border: 1px solid rgba(229, 119, 95, 0.35);
  color: var(--danger);
  font-size: 11px;
  list-style: none;
}

.preview__list {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.preview__item {
  display: flex;
  gap: 8px;
}

.preview__item::before {
  content: '›';
  flex: none;
  color: var(--text-dim);
  font-family: var(--font-mono);
}

.preview__code {
  min-width: 0;
  overflow-wrap: anywhere;
  color: #c8d3df;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.6;
}

.preview__invalid {
  color: var(--danger);
  font-size: 11px;
}

.preview__empty {
  color: var(--text-dim);
  font-size: 12px;
}

.history {
  background: rgba(22, 27, 34, 0.62);
  border: 1px solid var(--line);
}

.history__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line);
}

.history__title {
  font-size: 13px;
  font-weight: 600;
}

.history__clear {
  padding: 3px 8px;
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 2px;
  color: var(--text-dim);
  font-size: 11px;
  cursor: pointer;
}

.history__clear:hover {
  border-color: var(--line-strong);
  color: var(--text);
}

.history__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.history__item {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  grid-template-areas:
    'time command'
    'time detail';
  gap: 2px 10px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--line);
  font-size: 11px;
}

.history__item:last-child {
  border-bottom: 0;
}

.history__time {
  grid-area: time;
  color: var(--text-dim);
  font-family: var(--font-mono);
}

.history__command {
  grid-area: command;
  overflow-wrap: anywhere;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.history__detail {
  grid-area: detail;
  color: var(--text-dim);
}

.history__item[data-tone='ok'] .history__detail {
  color: #9fd9b8;
}

.history__item[data-tone='error'] .history__detail {
  color: var(--danger);
}

@media (max-width: 760px) {
  .flow-toolbar__hint {
    display: none;
  }

  .flow-page__head {
    align-items: stretch;
  }

  .run-button {
    width: 100%;
  }
}

@media (prefers-reduced-motion: no-preference) {

  .bar-button,
  .tool-button,
  .run-button,
  .preview__chevron,
  .history__clear,
  .preview__toggle {
    transition:
      border-color 0.15s ease,
      color 0.15s ease,
      background-color 0.15s ease,
      transform 0.15s ease;
  }
}
</style>
