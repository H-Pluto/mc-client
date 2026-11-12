import type { IpcResult } from '@/services/rcon'

export interface FlowRunResult {
  command: string
  ok: boolean
  response?: string
  message?: string
}

export interface FlowFilePayload {
  path: string
  content: string
}

export interface FlowApi {
  run(commands: string[]): Promise<IpcResult<FlowRunResult[]>>
  save(content: string, path?: string): Promise<IpcResult<{ path: string } | null>>
  load(): Promise<IpcResult<FlowFilePayload | null>>
}

declare global {
  interface Window {
    flow?: FlowApi
  }
}

export function getFlowApi(): FlowApi | undefined {
  return typeof window === 'undefined' ? undefined : window.flow
}
