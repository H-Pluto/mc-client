import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { CommandClient, MinecraftRcon } from 'rcon-mc-command'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const devServerUrl = process.env.VITE_DEV_SERVER_URL
const CONNECT_TIMEOUT = 5000

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

function toFailure(error) {
  return { ok: false, message: error instanceof Error ? error.message : String(error) }
}

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
  try {
    const input = normalizeConnectOptions(options)
    closeRcon()

    const connection = await MinecraftRcon.connect(input)
    rcon = connection
    mc = new CommandClient(connection)
    mcMethods = collectCommandMethods(mc)
    serverInfo = { host: input.host, port: input.port }

    return { ok: true, data: null }
  } catch (error) {
    closeRcon()
    return toFailure(error)
  }
})

ipcMain.handle('rcon:disconnect', () => {
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

    return {
      ok: true,
      data: { list, version, tps, difficulty, time, weather, latency },
    }
  } catch (error) {
    return toFailure(error)
  }
})

ipcMain.handle('mc:call', async (_event, method, args) => {
  if (!mc) return { ok: false, message: 'RCON 未连接' }
  if (typeof method !== 'string' || !mcMethods.has(method)) {
    return { ok: false, message: '不支持的指令方法' }
  }
  if (!Array.isArray(args)) return { ok: false, message: '指令参数无效' }

  try {
    return { ok: true, data: await mc[method](...args) }
  } catch (error) {
    return toFailure(error)
  }
})

ipcMain.handle('rcon:execute', async (_event, command) => {
  if (!rcon) return { ok: false, message: 'RCON 未连接' }
  if (typeof command !== 'string' || !command.trim()) {
    return { ok: false, message: '请输入要执行的指令' }
  }

  try {
    return { ok: true, data: await rcon.send(command.trim()) }
  } catch (error) {
    return toFailure(error)
  }
})

function createWindow() {
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

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeRcon()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', closeRcon)
