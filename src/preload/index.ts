import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  todo: {
    add: (args: any) => ipcRenderer.invoke('todo:add', args),
    update: (args: any) => ipcRenderer.invoke('todo:update', args),
    toggleDone: (args: any) => ipcRenderer.invoke('todo:toggleDone', args),
    delete: (args: any) => ipcRenderer.invoke('todo:delete', args),
    list: (args: any) => ipcRenderer.invoke('todo:list', args)
  },
  settings: {
    get: (args: any) => ipcRenderer.invoke('settings:get', args),
    put: (args: any) => ipcRenderer.invoke('settings:put', args)
  },
  app: {
    setAlwaysOnTop: (args: any) => ipcRenderer.invoke('app:setAlwaysOnTop', args),
    setLock: (args: any) => ipcRenderer.invoke('app:setLock', args)
  }
})
