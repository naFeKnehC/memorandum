// Thin wrapper to access IPC from renderer in both cases:
// - Preferred: window.api exposed via preload (production)
// - Dev fallback: window.require('electron').ipcRenderer when nodeIntegration is enabled

type AnyObj = Record<string, any>

function getIpc(): { invoke: (channel: string, args?: any) => Promise<any> } | null {
  const w = window as AnyObj
  if (w.api && typeof w.api === 'object') {
    // Wrap window.api to a uniform invoke interface
    return {
      invoke: (channel: string, args?: any) => {
        const [ns, name] = channel.split(':')
        const group = (w.api as AnyObj)[ns]
        if (!group) return Promise.reject(new Error(`API namespace missing: ${ns}`))
        const fn = group[name]
        if (!fn) return Promise.reject(new Error(`API method missing: ${channel}`))
        return fn(args)
      }
    }
  }
  // Dev fallback using nodeIntegration
  if ((w as AnyObj).require) {
    try {
      const { ipcRenderer } = (w as AnyObj).require('electron')
      return { invoke: (channel: string, args?: any) => ipcRenderer.invoke(channel, args) }
    } catch (e) {
      console.warn('[ipc] fallback require failed', e)
    }
  }
  return null
}
let cached: ReturnType<typeof getIpc> | null = null
function ensure() {
  if (!cached) cached = getIpc()
  if (!cached) throw new Error('IPC bridge not available (preload missing and no dev fallback)')
  return cached
}

export const api = {
  todo: {
    add: (args: any) => ensure()!.invoke('todo:add', args),
    update: (args: any) => ensure()!.invoke('todo:update', args),
    toggleDone: (args: any) => ensure()!.invoke('todo:toggleDone', args),
    delete: (args: any) => ensure()!.invoke('todo:delete', args),
    list: (args: any) => ensure()!.invoke('todo:list', args)
  },
  settings: {
    get: (args: any) => ensure()!.invoke('settings:get', args),
    put: (args: any) => ensure()!.invoke('settings:put', args)
  },
  app: {
    setAlwaysOnTop: (args: any) => ensure()!.invoke('app:setAlwaysOnTop', args),
    setLock: (args: any) => ensure()!.invoke('app:setLock', args)
  }
}
