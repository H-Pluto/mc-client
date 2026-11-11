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
