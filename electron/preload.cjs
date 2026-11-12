/* eslint-disable @typescript-eslint/no-require-imports -- Electron preload scripts run as CommonJS */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('rcon', {
  connect: (input) => ipcRenderer.invoke('rcon:connect', input),
  disconnect: () => ipcRenderer.invoke('rcon:disconnect'),
  status: () => ipcRenderer.invoke('rcon:status'),
  snapshot: () => ipcRenderer.invoke('rcon:snapshot'),
  execute: (command) => ipcRenderer.invoke('rcon:execute', command),
})

contextBridge.exposeInMainWorld('mc', {
  call: (method, args) => ipcRenderer.invoke('mc:call', method, Array.isArray(args) ? args : []),
})

contextBridge.exposeInMainWorld('flow', {
  run: (commands) => ipcRenderer.invoke('flow:run', commands),
  save: (content, path) => ipcRenderer.invoke('flow:save', content, path),
  load: () => ipcRenderer.invoke('flow:load'),
})

contextBridge.exposeInMainWorld('commandFile', {
  load: () => ipcRenderer.invoke('commands:load'),
})

contextBridge.exposeInMainWorld('updater', {
  info: () => ipcRenderer.invoke('updater:info'),
  check: () => ipcRenderer.invoke('updater:check'),
  download: () => ipcRenderer.invoke('updater:download'),
  install: () => ipcRenderer.invoke('updater:install'),
  openReleasePage: () => ipcRenderer.invoke('updater:open-release-page'),
  onEvent: (callback) => {
    const listener = (_event, event) => callback(event)
    ipcRenderer.on('updater:event', listener)
    return () => ipcRenderer.removeListener('updater:event', listener)
  },
})

contextBridge.exposeInMainWorld('logger', {
  write: (level, message, context) => ipcRenderer.invoke('log:write', level, message, context),
})
