import fs from 'node:fs/promises'
import path from 'node:path'

import { app } from 'electron'

const LEVEL_WEIGHT = { debug: 10, info: 20, warn: 30, error: 40 }
const LEVEL_LABEL = { debug: 'DEBUG', info: 'INFO', warn: 'WARN', error: 'ERROR' }
const DEFAULT_LEVEL = 'info'
const MAX_CONTEXT_LENGTH = 4000

const configuredLevel = String(process.env.MC_LOG_LEVEL ?? '').toLowerCase()
const fileLevel = LEVEL_WEIGHT[configuredLevel] ?? LEVEL_WEIGHT[DEFAULT_LEVEL]
const consoleLevel = LEVEL_WEIGHT[configuredLevel] ?? (app.isPackaged ? null : LEVEL_WEIGHT[DEFAULT_LEVEL])

let activeFile = ''
let pending = Promise.resolve()

function pad(value, length = 2) {
  return String(value).padStart(length, '0')
}

function dateStamp(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function timeStamp(date) {
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  return `${dateStamp(date)} ${time}.${pad(date.getMilliseconds(), 3)}`
}

export function logDirectory() {
  return path.join(app.getPath('userData'), 'logs')
}

export function logFileFor(date = new Date()) {
  const year = String(date.getFullYear())
  const month = pad(date.getMonth() + 1)
  return path.join(logDirectory(), year, month, `${dateStamp(date)}.log`)
}

function stringify(value) {
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`
  if (value === undefined) return ''

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function formatLine(level, scope, message, context) {
  const parts = [timeStamp(new Date()), `[${LEVEL_LABEL[level]}]`, `[${scope}]`, stringify(message)]

  if (context !== undefined && context !== null) {
    parts.push(stringify(context).slice(0, MAX_CONTEXT_LENGTH))
  }

  return `${parts.join(' ')}\n`
}

async function appendLine(line, date) {
  const file = logFileFor(date)

  if (file !== activeFile) {
    await fs.mkdir(path.dirname(file), { recursive: true })
    activeFile = file
  }

  await fs.appendFile(file, line, 'utf8')
}

function write(level, scope, message, context) {
  if (consoleLevel !== null && LEVEL_WEIGHT[level] >= consoleLevel) {
    const contextText = context === undefined || context === null ? '' : ` ${stringify(context)}`
    console[level === 'debug' ? 'log' : level](`[${scope}] ${stringify(message)}${contextText}`)
  }

  if (LEVEL_WEIGHT[level] < fileLevel) return pending

  const line = formatLine(level, scope, message, context)
  const date = new Date()

  pending = pending.then(() => appendLine(line, date)).catch((error) => {
    console.error(`[logger] 日志写入失败: ${error instanceof Error ? error.message : error}`)
  })

  return pending
}

export function createLogger(scope) {
  return {
    debug: (message, context) => write('debug', scope, message, context),
    info: (message, context) => write('info', scope, message, context),
    warn: (message, context) => write('warn', scope, message, context),
    error: (message, context) => write('error', scope, message, context),
  }
}

export function flushLogs() {
  return pending
}
