export interface IpcResult<T = null> {
  ok: boolean
  data?: T
  message?: string
}

export interface UpdaterInfo {
  version: string
  packaged: boolean
  portable: boolean
}

export interface UpdateSummary {
  version: string | null
  releaseName: string | null
  releaseNotes: string
  releaseDate: string | null
}

export interface UpdateProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

export type UpdaterEvent =
  | { type: 'checking'; payload: null }
  | { type: 'available'; payload: UpdateSummary }
  | { type: 'not-available'; payload: { version: string | null } }
  | { type: 'progress'; payload: UpdateProgress }
  | { type: 'downloaded'; payload: UpdateSummary }
  | { type: 'error'; payload: { message: string } }

export interface UpdaterApi {
  info(): Promise<IpcResult<UpdaterInfo>>
  check(): Promise<IpcResult>
  download(): Promise<IpcResult>
  install(): Promise<IpcResult>
  openReleasePage(): Promise<IpcResult>
  onEvent(callback: (event: UpdaterEvent) => void): () => void
}

declare global {
  interface Window {
    updater?: UpdaterApi
  }
}

export function getUpdaterApi(): UpdaterApi | undefined {
  return typeof window === 'undefined' ? undefined : window.updater
}
