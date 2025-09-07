// Minimal CommonJS preload bridge for dev fallback
const { contextBridge, ipcRenderer } = require('electron')
try { console.log('[preload-bridge] loaded (CJS)') } catch {}

contextBridge.exposeInMainWorld('api', {
  todo: {
    add: (args) => ipcRenderer.invoke('todo:add', args),
    update: (args) => ipcRenderer.invoke('todo:update', args),
    toggleDone: (args) => ipcRenderer.invoke('todo:toggleDone', args),
    delete: (args) => ipcRenderer.invoke('todo:delete', args),
    list: (args) => ipcRenderer.invoke('todo:list', args),
  },
  settings: {
    get: (args) => ipcRenderer.invoke('settings:get', args),
    put: (args) => ipcRenderer.invoke('settings:put', args),
  },
  app: {
    setAlwaysOnTop: (args) => ipcRenderer.invoke('app:setAlwaysOnTop', args),
    setLock: (args) => ipcRenderer.invoke('app:setLock', args),
  }
})

