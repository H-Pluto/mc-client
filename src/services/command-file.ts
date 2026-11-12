import type { IpcResult } from './rcon'

export interface CommandFileSource {
  path: string
  content: string
}

export interface CommandFileApi {
  load(): Promise<IpcResult<CommandFileSource>>
}

declare global {
  interface Window {
    commandFile?: CommandFileApi
  }
}

export function getCommandFileApi(): CommandFileApi | undefined {
  return typeof window === 'undefined' ? undefined : window.commandFile
}
