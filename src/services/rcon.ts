export interface ConnectInput {
  host: string
  port: number
  password: string
}

export interface SnapshotRaw {
  list: string
  version: string | null
  tps: string | null
  difficulty: string | null
  time: string | null
  weather: string | null
  latency: number
}

export interface ConnectionState {
  connected: boolean
  host: string | null
  port: number | null
}

export type IpcResult<T = null> = { ok: true; data: T } | { ok: false; message: string }

export interface RconApi {
  connect(input: ConnectInput): Promise<IpcResult>
  disconnect(): Promise<IpcResult>
  status(): Promise<IpcResult<ConnectionState>>
  snapshot(): Promise<IpcResult<SnapshotRaw>>
  execute(command: string): Promise<IpcResult<string>>
}

export interface McCall {
  method: string
  args: unknown[]
}

export interface McApi {
  call(method: string, args: unknown[]): Promise<IpcResult<string>>
}

declare global {
  interface Window {
    rcon?: RconApi
    mc?: McApi
  }
}

export function getRconApi(): RconApi | undefined {
  return typeof window === 'undefined' ? undefined : window.rcon
}

export function getMcApi(): McApi | undefined {
  return typeof window === 'undefined' ? undefined : window.mc
}
