import { app, BrowserWindow, ipcMain, shell, globalShortcut, Tray, Menu, nativeImage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { repo } from './storage'
import { z } from 'zod'

let win: BrowserWindow | null = null
let clickThroughLocked = false
let tray: Tray | null = null
let currentOpacity = 1
let savedOpacityBeforeLock: number | null = null

function trayIcon() {
  // 16x16 transparent PNG with a small black dot
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAALElEQVQoka3MsQkAIBADwYb//5pUjqgYk0F1yQ3y4mKpH0bQW3Pj3yPJE2KcYwP3Q+Q1Xy1mGAAAAABJRU5ErkJggg=='
  const img = nativeImage.createFromBuffer(Buffer.from(base64, 'base64'))
  if (process.platform === 'darwin') img.setTemplateImage(true)
  return img
}

function rebuildTrayMenu() {
  if (!tray || !win) return
  const isTop = win.isAlwaysOnTop()
  const opacityLevels = [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5]
  const menu = Menu.buildFromTemplate([
    { label: '显示窗口', click: () => { if (win) { win.show(); win.focus() } } },
    { type: 'separator' },
    { label: isTop ? '取消置顶' : '置顶', type: 'checkbox', checked: isTop, click: () => { const v = !isTop; win!.setAlwaysOnTop(v); try { repo.setSetting('alwaysOnTop', v ? '1' : '0') } catch {}; rebuildTrayMenu() } },
    { label: clickThroughLocked ? '解除锁定' : '锁定（点击穿透，默认50%）', click: () => {
        clickThroughLocked = !clickThroughLocked
        win!.setIgnoreMouseEvents(clickThroughLocked, { forward: true })
        if (!clickThroughLocked) win!.focus()
        try { repo.setSetting('lock', clickThroughLocked ? '1' : '0') } catch {}
        if (clickThroughLocked) {
          if (savedOpacityBeforeLock == null) savedOpacityBeforeLock = currentOpacity
          currentOpacity = 0.5
          try { win!.setOpacity(currentOpacity) } catch {}
        } else {
          if (savedOpacityBeforeLock != null) {
            currentOpacity = savedOpacityBeforeLock
            savedOpacityBeforeLock = null
            try { win!.setOpacity(currentOpacity) } catch {}
          }
        }
        rebuildTrayMenu()
      }
    },
    { label: '透明度', submenu: opacityLevels.map(v => ({
        label: `${Math.round(v * 100)}%`, type: 'radio', checked: Math.abs(currentOpacity - v) < 1e-6,
        click: () => { currentOpacity = v; try { win!.setOpacity(v) } catch {}; try { repo.setSetting('opacity', String(v)) } catch {}; rebuildTrayMenu() }
      }))
    },
    { type: 'separator' },
    { label: '解锁快捷键: Cmd/Ctrl+Shift+L', enabled: false },
    { type: 'separator' },
    { label: '退出', role: 'quit' }
  ])
  tray.setContextMenu(menu)
}

const createWindow = () => {
  // Resolve preload path in both dev/build and for .js or .mjs outputs
  const preloadCjs = path.join(__dirname, '../preload/index.cjs')
  const preloadJs = path.join(__dirname, '../preload/index.js')
  const preloadMjs = path.join(__dirname, '../preload/index.mjs')
  const fallbackBridge = path.join(__dirname, '../../src/preload/bridge.cjs')
  const preloadPath =
    (fs.existsSync(preloadCjs) && preloadCjs) ||
    (fs.existsSync(preloadJs) && preloadJs) ||
    (fs.existsSync(preloadMjs) && preloadMjs) ||
    (fs.existsSync(fallbackBridge) && fallbackBridge) ||
    preloadJs
  try { /* debug logs removed */ } catch {}

  const isDev = !!process.env.ELECTRON_RENDERER_URL
  win = new BrowserWindow({
    width: isDev ? 800 : 350,
    height: isDev ? 800 : 700,
    minWidth: 350,
    minHeight: 300,
    title: 'Memorandum',
    alwaysOnTop: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false
    }
  })

  if (isDev) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL!)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // Auto-open DevTools in dev, docked to the right
  if (isDev) {
    win.webContents.openDevTools({ mode: 'right' })
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  createWindow()

  // Apply persisted window states (top/lock/opacity)
  try {
    const atop = repo.getSetting('alwaysOnTop')
    const lockv = repo.getSetting('lock')
    const opv = repo.getSetting('opacity')
    const atopBool = atop === '1' || atop === 'true'
    const lockBool = lockv === '1' || lockv === 'true'
    const opNum = opv ? Math.min(1, Math.max(0.5, parseFloat(opv))) : 1
    if (win) {
      win.setAlwaysOnTop(atopBool)
      currentOpacity = opNum
      try { win.setOpacity(opNum) } catch {}
      if (lockBool) {
        clickThroughLocked = true
        if (savedOpacityBeforeLock == null) savedOpacityBeforeLock = currentOpacity
        win.setIgnoreMouseEvents(true, { forward: true })
        currentOpacity = 0.5
        try { win.setOpacity(currentOpacity) } catch {}
      }
    }
  } catch {}

  // Create tray
  try {
    tray = new Tray(trayIcon())
    tray.setToolTip('Memorandum')
    if (process.platform === 'darwin') {
      try { tray.setTitle('Memo') } catch {}
    }
    rebuildTrayMenu()
  } catch {}

  // Global shortcut to force UNLOCK (safety): Cmd/Ctrl+Shift+L
  try {
    globalShortcut.register('CommandOrControl+Shift+L', () => {
      clickThroughLocked = false
      if (win) {
        win.setIgnoreMouseEvents(false)
        if (!win.isFocused()) win.focus()
      }
      rebuildTrayMenu()
    })
  } catch {}

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  try { globalShortcut.unregisterAll() } catch {}
})

// IPC schemas
const AddSchema = z.object({ title: z.string().min(1), description: z.string().optional(), dueDate: z.string().optional(), orderNum: z.number().optional() })
const UpdateSchema = z.object({ id: z.number(), patch: z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  due_date: z.string().optional(),
  status: z.enum(['active','done']).optional(),
  order_num: z.number().optional()
}).passthrough() })
const IdSchema = z.object({ id: z.number() })
const ListSchema = z.object({ scope: z.enum(['today','tomorrow','week','later','none','done']), keyword: z.string().optional() })
const KVGet = z.object({ key: z.string() })
const KVPut = z.object({ key: z.string(), value: z.string() })

ipcMain.handle('todo:add', (_e, args) => repo.addTask(AddSchema.parse(args)))
ipcMain.handle('todo:update', (_e, args) => repo.updateTask(UpdateSchema.parse(args)))
ipcMain.handle('todo:toggleDone', (_e, args) => repo.toggleDone(IdSchema.parse(args).id))
ipcMain.handle('todo:delete', (_e, args) => repo.deleteTask(IdSchema.parse(args).id))
ipcMain.handle('todo:list', (_e, args) => repo.listTasks(ListSchema.parse(args)))

ipcMain.handle('settings:get', (_e, args) => repo.getSetting(KVGet.parse(args).key))
ipcMain.handle('settings:put', (_e, args) => repo.setSetting(KVPut.parse(args).key, KVPut.parse(args).value))

ipcMain.handle('app:setAlwaysOnTop', (_e, { value }) => {
  win?.setAlwaysOnTop(!!value)
  rebuildTrayMenu()
  return
})
// 真·点击穿透锁定；提供全局快捷键 Cmd/Ctrl+Shift+L 解锁
ipcMain.handle('app:setLock', (_e, { value }) => {
  clickThroughLocked = !!value
  win?.setIgnoreMouseEvents(clickThroughLocked, { forward: true })
  if (!clickThroughLocked) win?.focus()
  if (clickThroughLocked) {
    if (savedOpacityBeforeLock == null) savedOpacityBeforeLock = currentOpacity
    currentOpacity = 0.5
    try { win?.setOpacity(currentOpacity) } catch {}
  } else {
    if (savedOpacityBeforeLock != null) {
      currentOpacity = savedOpacityBeforeLock
      savedOpacityBeforeLock = null
      try { win?.setOpacity(currentOpacity) } catch {}
    }
  }
  rebuildTrayMenu()
  return
})
ipcMain.handle('app:setOpacity', (_e, { value }) => {
  const v = typeof value === 'number' ? Math.min(1, Math.max(0.5, value)) : 1
  currentOpacity = v
  try { win?.setOpacity(v) } catch {}
  rebuildTrayMenu()
  return
})
