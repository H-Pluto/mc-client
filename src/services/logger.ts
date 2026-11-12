export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LoggerApi {
  write(level: LogLevel, message: string, context?: unknown): Promise<unknown>
}

declare global {
  interface Window {
    logger?: LoggerApi
  }
}

function toContext(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack }
  }
  return value
}

function getLoggerApi(): LoggerApi | undefined {
  return typeof window === 'undefined' ? undefined : window.logger
}

export function log(level: LogLevel, message: string, context?: unknown) {
  void getLoggerApi()?.write(level, message, toContext(context))?.catch(() => {})
}

export function logError(message: string, error: unknown) {
  log('error', message, error)
}
