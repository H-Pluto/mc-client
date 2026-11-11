import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  parseDifficulty,
  parseGameTime,
  parsePlayerList,
  parseTps,
  parseVersion,
  parseWeather,
} from '@/lib/rcon-format'
import {
  getMcApi,
  getRconApi,
  type ConnectInput,
  type IpcResult,
  type McCall,
  type SnapshotRaw,
} from '@/services/rcon'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

export interface CommandEntry {
  id: number
  command: string
  response: string
  at: string
}

const UNSUPPORTED_ENV = '当前环境不支持 RCON，请通过 Electron 客户端运行。'

export const useConnectionStore = defineStore('connection', () => {
  const status = ref<ConnectionStatus>('disconnected')
  const server = ref<{ host: string; port: number } | null>(null)
  const connectError = ref('')
  const syncError = ref('')
  const snapshot = ref<SnapshotRaw | null>(null)
  const refreshing = ref(false)
  const lastUpdated = ref<Date | null>(null)
  const commandLog = ref<CommandEntry[]>([])
  let nextCommandId = 1

  const isConnected = computed(() => status.value === 'connected')
  const address = computed(() => (server.value ? `${server.value.host}:${server.value.port}` : ''))
  const players = computed(() => parsePlayerList(snapshot.value?.list ?? null))
  const version = computed(() => parseVersion(snapshot.value?.version ?? null))
  const gameTime = computed(() => parseGameTime(snapshot.value?.time ?? null))
  const tps = computed(() => parseTps(snapshot.value?.tps ?? null))
  const difficulty = computed(() => parseDifficulty(snapshot.value?.difficulty ?? null))
  const weather = computed(() => parseWeather(snapshot.value?.weather ?? null))
  const latency = computed(() => snapshot.value?.latency ?? null)

  async function connect(input: ConnectInput): Promise<boolean> {
    const api = getRconApi()
    if (!api) {
      connectError.value = UNSUPPORTED_ENV
      return false
    }
    if (status.value === 'connecting') return false

    status.value = 'connecting'
    connectError.value = ''

    const result = await api.connect(input)
    if (!result.ok) {
      status.value = 'disconnected'
      connectError.value = result.message
      return false
    }

    server.value = { host: input.host, port: input.port }
    status.value = 'connected'
    syncError.value = ''
    commandLog.value = []
    await refresh()
    return true
  }

  async function disconnect() {
    await getRconApi()?.disconnect()
    status.value = 'disconnected'
    server.value = null
    connectError.value = ''
    syncError.value = ''
    snapshot.value = null
    lastUpdated.value = null
    commandLog.value = []
  }

  async function refresh() {
    const api = getRconApi()
    if (!api || status.value !== 'connected' || refreshing.value) return

    refreshing.value = true
    const result = await api.snapshot()
    refreshing.value = false

    if (!result.ok) {
      syncError.value = result.message
      return
    }

    snapshot.value = result.data
    lastUpdated.value = new Date()
    syncError.value = ''
  }

  async function execute(
    command: string,
    call?: McCall,
  ): Promise<{ ok: boolean; message?: string; response?: string }> {
    const api = getRconApi()
    if (!api) return { ok: false, message: UNSUPPORTED_ENV }

    let result: IpcResult<string>
    const mc = getMcApi()
    if (call && mc) {
      result = await mc.call(call.method, call.args)
    } else {
      result = await api.execute(command)
    }
    if (!result.ok) return { ok: false, message: result.message }

    const response = result.data.trim() || '（无输出）'
    commandLog.value.unshift({
      id: nextCommandId++,
      command,
      response,
      at: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    })
    if (commandLog.value.length > 20) commandLog.value.length = 20

    return { ok: true, response }
  }

  async function restore() {
    const api = getRconApi()
    if (!api) return

    const result = await api.status()
    if (!result.ok || !result.data.connected) return

    const { host, port } = result.data
    if (!host || port === null) return

    server.value = { host, port }
    status.value = 'connected'
    await refresh()
  }

  return {
    status,
    server,
    connectError,
    syncError,
    snapshot,
    refreshing,
    lastUpdated,
    commandLog,
    isConnected,
    address,
    players,
    version,
    gameTime,
    tps,
    difficulty,
    weather,
    latency,
    connect,
    disconnect,
    refresh,
    execute,
    restore,
  }
})
