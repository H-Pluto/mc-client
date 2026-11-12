import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import electronUpdater from 'electron-updater'
import { CommandClient, MinecraftRcon } from 'rcon-mc-command'

import { createLogger, logDirectory } from './logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const devServerUrl = process.env.VITE_DEV_SERVER_URL
const CONNECT_TIMEOUT = 5000
const FLOW_MAX_COMMANDS = 200
const FLOW_MAX_FILE_BYTES = 2 * 1024 * 1024
const FLOW_FILE_FILTERS = [{ name: '流程图 JSON', extensions: ['json'] }]
const COMMAND_FILE_MAX_BYTES = 4 * 1024 * 1024

const { autoUpdater } = electronUpdater
const UPDATER_EVENT = 'updater:event'
const RELEASES_PAGE = 'https://github.com/H-Pluto/mc-client/releases/latest'
const DEV_UPDATE_MESSAGE = '开发模式下不检查更新，请使用打包后的应用。'
const PORTABLE_UPDATE_MESSAGE = '便携版不支持应用内安装，请前往下载页获取新版本。'
const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR)

const appLog = createLogger('app')
const rconLog = createLogger('rcon')
const flowLog = createLogger('flow')
const commandsLog = createLogger('commands')
const updaterLog = createLogger('updater')
const rendererLog = createLogger('renderer')
const RENDERER_LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error'])
const RENDERER_LOG_MAX_LENGTH = 4000

/** @type {BrowserWindow | null} */
let mainWindow = null
/** @type {MinecraftRcon | null} */
let rcon = null
/** @type {CommandClient | null} */
let mc = null
/** @type {Set<string>} */
let mcMethods = new Set()
/** @type {{ host: string, port: number } | null} */
let serverInfo = null
let updaterInitialized = false
let checking = false

function toFailure(error) {
  return { ok: false, message: error instanceof Error ? error.message : String(error) }
}

function normalizeReleaseNotes(notes) {
  if (!notes) return ''
  if (typeof notes === 'string') return notes
  if (!Array.isArray(notes)) return ''

  return notes
    .map((entry) => {
      const heading = entry.version ? `v${entry.version}` : ''
      return [heading, entry.note ?? ''].filter(Boolean).join('\n')
    })
    .join('\n\n')
}

function toUpdateSummary(info) {
  return {
    version: info?.version ?? null,
    releaseName: info?.releaseName ?? null,
    releaseNotes: normalizeReleaseNotes(info?.releaseNotes),
    releaseDate: info?.releaseDate ?? null,
  }
}

function sendUpdaterEvent(type, payload = null) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(UPDATER_EVENT, { type, payload })
  }
}

function initUpdater() {
  if (updaterInitialized) return
  updaterInitialized = true

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    updaterLog.info('开始检查更新')
    sendUpdaterEvent('checking')
  })
  autoUpdater.on('update-available', (info) => {
    updaterLog.info(`发现新版本 v${info?.version ?? '未知'}`)
    sendUpdaterEvent('available', toUpdateSummary(info))
  })
  autoUpdater.on('update-not-available', (info) => {
    updaterLog.info(`已是最新版本 v${info?.version ?? app.getVersion()}`)
    sendUpdaterEvent('not-available', { version: info?.version ?? null })
  })
  autoUpdater.on('download-progress', (progress) => {
    updaterLog.debug(`更新下载进度 ${progress.percent.toFixed(1)}%`)
    sendUpdaterEvent('progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    })
  })
  autoUpdater.on('update-downloaded', (info) => {
    updaterLog.info(`更新下载完成 v${info?.version ?? '未知'}`)
    sendUpdaterEvent('downloaded', toUpdateSummary(info))
  })
  autoUpdater.on('error', (error) => {
    updaterLog.error('更新出错', error)
    sendUpdaterEvent('error', toFailure(error))
  })
}

ipcMain.handle('updater:info', () => ({
  ok: true,
  data: {
    version: app.getVersion(),
    packaged: app.isPackaged,
    portable: isPortable,
  },
}))

ipcMain.handle('updater:check', async () => {
  if (!app.isPackaged) return { ok: false, message: DEV_UPDATE_MESSAGE }
  if (checking) return { ok: true, data: null }

  initUpdater()
  checking = true
  try {
    await autoUpdater.checkForUpdates()
    return { ok: true, data: null }
  } catch (error) {
    updaterLog.error('检查更新失败', error)
    return toFailure(error)
  } finally {
    checking = false
  }
})

ipcMain.handle('updater:download', async () => {
  if (!app.isPackaged) return { ok: false, message: DEV_UPDATE_MESSAGE }
  if (isPortable) return { ok: false, message: PORTABLE_UPDATE_MESSAGE }

  initUpdater()
  updaterLog.info('开始下载更新')
  try {
    await autoUpdater.downloadUpdate()
    return { ok: true, data: null }
  } catch (error) {
    updaterLog.error('下载更新失败', error)
    return toFailure(error)
  }
})

ipcMain.handle('updater:install', () => {
  if (!app.isPackaged) return { ok: false, message: DEV_UPDATE_MESSAGE }
  if (isPortable) return { ok: false, message: PORTABLE_UPDATE_MESSAGE }

  updaterLog.info('安装更新并重启')
  setImmediate(() => autoUpdater.quitAndInstall(false, true))
  return { ok: true, data: null }
})

ipcMain.handle('updater:open-release-page', () => {
  void shell.openExternal(RELEASES_PAGE)
  return { ok: true, data: null }
})

function collectCommandMethods(client) {
  const methods = new Set()

  for (
    let proto = Object.getPrototypeOf(client);
    proto && proto !== Object.prototype;
    proto = Object.getPrototypeOf(proto)
  ) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name !== 'constructor' && typeof client[name] === 'function') methods.add(name)
    }
  }

  for (const name of Object.keys(client)) {
    if (typeof client[name] === 'function') methods.add(name)
  }

  return methods
}

function closeRcon() {
  rcon?.end()
  rcon = null
  mc = null
  mcMethods = new Set()
  serverInfo = null
}

function normalizeConnectOptions(options) {
  if (!options || typeof options !== 'object') throw new Error('连接参数无效')

  const host = typeof options.host === 'string' ? options.host.trim() : ''
  if (!host) throw new Error('请填写服务器地址')

  const port = Number(options.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('端口需为 1 到 65535 之间的整数')
  }

  return {
    host,
    port,
    password: typeof options.password === 'string' ? options.password : '',
    timeout: CONNECT_TIMEOUT,
  }
}

async function query(command) {
  if (!rcon) return null

  try {
    return await rcon.send(command)
  } catch {
    return null
  }
}

ipcMain.handle('rcon:connect', async (_event, options) => {
  let target = '未知地址'
  try {
    const input = normalizeConnectOptions(options)
    target = `${input.host}:${input.port}`
    rconLog.info(`正在连接 ${target}`)
    closeRcon()

    const connection = await MinecraftRcon.connect(input)
    rcon = connection
    mc = new CommandClient(connection)
    mcMethods = collectCommandMethods(mc)
    serverInfo = { host: input.host, port: input.port }

    rconLog.info(`已连接 ${target}`)
    return { ok: true, data: null }
  } catch (error) {
    rconLog.error(`连接 ${target} 失败`, error)
    closeRcon()
    return toFailure(error)
  }
})

ipcMain.handle('rcon:disconnect', () => {
  if (rcon && serverInfo) rconLog.info(`已断开 ${serverInfo.host}:${serverInfo.port}`)
  closeRcon()
  return { ok: true, data: null }
})

ipcMain.handle('rcon:status', () => ({
  ok: true,
  data: {
    connected: rcon !== null,
    host: serverInfo?.host ?? null,
    port: serverInfo?.port ?? null,
  },
}))

ipcMain.handle('rcon:snapshot', async () => {
  if (!rcon || !mc) return { ok: false, message: 'RCON 未连接' }

  try {
    const startedAt = Date.now()
    const list = await mc.list()
    const latency = Date.now() - startedAt

    const version = await query('version')
    const tps = await query('tps')
    const difficulty = await query('difficulty')
    const time = await query('time query gametime')
    const weather = await query('weather query')

    rconLog.debug(`服务器状态已刷新，延迟 ${latency}ms`)
    return {
      ok: true,
      data: { list, version, tps, difficulty, time, weather, latency },
    }
  } catch (error) {
    rconLog.error('刷新服务器状态失败', error)
    return toFailure(error)
  }
})

ipcMain.handle('mc:call', async (_event, method, args) => {
  if (!mc) return { ok: false, message: 'RCON 未连接' }
  if (typeof method !== 'string' || !mcMethods.has(method)) {
    rconLog.warn(`拒绝不支持的指令方法：${String(method)}`)
    return { ok: false, message: '不支持的指令方法' }
  }
  if (!Array.isArray(args)) return { ok: false, message: '指令参数无效' }

  try {
    const data = await mc[method](...args)
    rconLog.info(`调用指令方法 ${method}`, args)
    rconLog.debug(`指令方法 ${method} 返回`, data)
    return { ok: true, data }
  } catch (error) {
    const detail = error instanceof Error ? error.stack || error.message : String(error)
    rconLog.error(`调用指令方法 ${method} 失败`, { args, detail })
    return toFailure(error)
  }
})

ipcMain.handle('rcon:execute', async (_event, command) => {
  if (!rcon) return { ok: false, message: 'RCON 未连接' }
  if (typeof command !== 'string' || !command.trim()) {
    return { ok: false, message: '请输入要执行的指令' }
  }

  const text = command.trim()
  try {
    const data = await rcon.send(text)
    rconLog.info(`执行指令 /${text}`)
    rconLog.debug(`指令 /${text} 返回`, data)
    return { ok: true, data }
  } catch (error) {
    rconLog.error(`执行指令 /${text} 失败`, error)
    return toFailure(error)
  }
})

ipcMain.handle('flow:run', async (_event, commands) => {
  if (!rcon) return { ok: false, message: 'RCON 未连接' }
  if (!Array.isArray(commands) || commands.length === 0) {
    return { ok: false, message: '没有可执行的指令' }
  }
  if (commands.length > FLOW_MAX_COMMANDS) {
    return { ok: false, message: `一次最多执行 ${FLOW_MAX_COMMANDS} 条指令` }
  }

  const results = []
  flowLog.info(`开始执行流程图，共 ${commands.length} 条指令`)
  for (const raw of commands) {
    if (typeof raw !== 'string' || !raw.trim()) {
      flowLog.warn('流程图包含空指令，已跳过')
      results.push({ command: String(raw ?? ''), ok: false, message: '指令为空' })
      continue
    }

    const command = raw.trim()
    try {
      const response = await rcon.send(command)
      flowLog.debug(`执行指令 /${command}`, String(response ?? ''))
      results.push({ command, ok: true, response: String(response ?? '') })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      flowLog.error(`执行指令 /${command} 失败`, message)
      results.push({ command, ok: false, message })
    }
  }

  const failed = results.filter((entry) => !entry.ok).length
  flowLog.info(`流程图执行完成：成功 ${results.length - failed} 条，失败 ${failed} 条`)

  return { ok: true, data: results }
})

function flowWindow(event) {
  return BrowserWindow.fromWebContents(event.sender) ?? mainWindow
}

function defaultFlowFileName() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`
  return `mc-flow-${date}-${time}.json`
}

ipcMain.handle('flow:save', async (event, content, targetPath) => {
  if (typeof content !== 'string' || !content.trim()) {
    return { ok: false, message: '流程图内容为空' }
  }
  if (Buffer.byteLength(content, 'utf8') > FLOW_MAX_FILE_BYTES) {
    return { ok: false, message: '流程图文件过大' }
  }

  try {
    if (typeof targetPath === 'string' && targetPath) {
      await fs.writeFile(targetPath, content, 'utf8')
      flowLog.info(`流程图已保存：${targetPath}`)
      return { ok: true, data: { path: targetPath } }
    }

    const owner = flowWindow(event)
    const options = {
      title: '保存流程图',
      defaultPath: defaultFlowFileName(),
      filters: FLOW_FILE_FILTERS,
    }

    const result = owner
      ? await dialog.showSaveDialog(owner, options)
      : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) {
      flowLog.info('已取消保存流程图')
      return { ok: true, data: null }
    }

    await fs.writeFile(result.filePath, content, 'utf8')
    flowLog.info(`流程图已保存：${result.filePath}`)
    return { ok: true, data: { path: result.filePath } }
  } catch (error) {
    flowLog.error('保存流程图失败', error)
    return toFailure(error)
  }
})

ipcMain.handle('flow:load', async (event) => {
  const owner = flowWindow(event)
  const options = {
    title: '打开流程图',
    properties: ['openFile'],
    filters: FLOW_FILE_FILTERS,
  }

  try {
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options)
    const filePath = result.filePaths?.[0]
    if (result.canceled || !filePath) {
      flowLog.info('已取消打开流程图')
      return { ok: true, data: null }
    }

    const stat = await fs.stat(filePath)
    if (stat.size > FLOW_MAX_FILE_BYTES) {
      flowLog.warn(`流程图文件过大：${filePath}（${stat.size} 字节）`)
      return { ok: false, message: '流程图文件过大' }
    }

    const content = await fs.readFile(filePath, 'utf8')
    flowLog.info(`流程图已打开：${filePath}`)
    return { ok: true, data: { path: filePath, content } }
  } catch (error) {
    flowLog.error('打开流程图失败', error)
    return toFailure(error)
  }
})

function commandFileCandidates() {
  const candidates = []
  // 便携版每次运行都会解压到临时目录，exe 同级目录才是用户可见的位置
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    candidates.push(path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'data', 'command.json'))
  } else if (app.isPackaged) {
    candidates.push(path.join(path.dirname(app.getPath('exe')), 'data', 'command.json'))
  }
  candidates.push(path.join(app.getAppPath(), 'data', 'command.json'))
  return candidates
}

async function commandFilePath() {
  const candidates = commandFileCandidates()

  for (const candidate of candidates) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      // 尝试下一个候选路径
    }
  }

  // 用户目录还没有副本时，从随包文件复制一份，保证安装后可以直接编辑
  if (candidates.length > 1) {
    try {
      await fs.mkdir(path.dirname(candidates[0]), { recursive: true })
      await fs.copyFile(candidates[1], candidates[0])
      commandsLog.info(`已生成指令文件：${candidates[0]}`)
      return candidates[0]
    } catch (error) {
      commandsLog.warn(`无法在 ${path.dirname(candidates[0])} 生成指令文件，改用随包文件`, error)
    }
  }

  return candidates[0]
}

ipcMain.handle('commands:load', async () => {
  const filePath = await commandFilePath()
  try {
    const stat = await fs.stat(filePath)
    if (stat.size > COMMAND_FILE_MAX_BYTES) {
      commandsLog.warn(`指令文件过大：${filePath}（${stat.size} 字节）`)
      return { ok: false, message: 'command.json 文件过大' }
    }

    const content = await fs.readFile(filePath, 'utf8')
    commandsLog.info(`已读取指令文件：${filePath}`)
    return { ok: true, data: { path: filePath, content } }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      commandsLog.warn(`未找到指令文件：${filePath}`)
      return { ok: false, message: `未找到指令文件：${filePath}` }
    }
    commandsLog.error('读取指令文件失败', error)
    return toFailure(error)
  }
})

ipcMain.handle('log:write', (_event, level, message, context) => {
  if (!RENDERER_LOG_LEVELS.has(level)) {
    return { ok: false, message: '日志级别无效' }
  }
  if (typeof message !== 'string' || !message.trim()) {
    return { ok: false, message: '日志内容为空' }
  }

  rendererLog[level](message.slice(0, RENDERER_LOG_MAX_LENGTH), context)
  return { ok: true, data: null }
})

function createWindow() {
  appLog.info('创建主窗口')
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    show: false,
    backgroundColor: '#101419',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

process.on('uncaughtException', (error) => {
  appLog.error('主进程未捕获异常', error)
})

process.on('unhandledRejection', (reason) => {
  appLog.error('主进程未处理的 Promise 异常', reason)
})

app.whenReady().then(() => {
  appLog.info(`应用启动 v${app.getVersion()}（${app.isPackaged ? '打包模式' : '开发模式'}）`)
  appLog.info(`日志目录：${logDirectory()}`)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  appLog.info('所有窗口已关闭')
  closeRcon()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  appLog.info('应用即将退出')
  closeRcon()
})
