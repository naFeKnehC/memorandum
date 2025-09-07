import { app, BrowserWindow, ipcMain, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { repo } from './storage'
import { z } from 'zod'

let win: BrowserWindow | null = null

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
    width: isDev ? 960 : 360,
    height: isDev ? 800 : 700,
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
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

ipcMain.handle('app:setAlwaysOnTop', (_e, { value }) => { win?.setAlwaysOnTop(!!value); return })
ipcMain.handle('app:setLock', (_e, { value }) => { win?.setIgnoreMouseEvents(!!value, { forward: true }); return })
