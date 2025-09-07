import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export interface Task {
  id: number
  title: string
  description?: string | null
  due_date?: string | null
  status: 'active' | 'done'
  order_num: number
  created_at: string
  updated_at: string
  completed_at?: string | null
}

interface DataFile {
  tasks: Task[]
  settings: Record<string, string>
  seq: number // id 自增计数
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
}

function getFilePath() {
  const dir = app.getPath('userData')
  ensureDir(dir)
  return path.join(dir, 'memorandum.json')
}

function readData(): DataFile {
  const file = getFilePath()
  if (!fs.existsSync(file)) {
    const initial: DataFile = { tasks: [], settings: {}, seq: 0 }
    fs.writeFileSync(file, JSON.stringify(initial, null, 2), 'utf-8')
    return initial
  }
  try {
    const raw = fs.readFileSync(file, 'utf-8')
    const parsed = JSON.parse(raw)
    // 兼容缺省字段
    parsed.tasks ??= []
    parsed.settings ??= {}
    parsed.seq ??= parsed.tasks.reduce((m: number, t: Task) => Math.max(m, t.id), 0)
    return parsed as DataFile
  } catch (e) {
    // 文件损坏兜底：备份并重建
    const bak = file + '.corrupt-' + Date.now()
    try { fs.copyFileSync(file, bak) } catch {}
    const initial: DataFile = { tasks: [], settings: {}, seq: 0 }
    fs.writeFileSync(file, JSON.stringify(initial, null, 2), 'utf-8')
    return initial
  }
}

function atomicWrite(data: DataFile) {
  const file = getFilePath()
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmp, file)
}

// Format to local date YYYY-MM-DD (not UTC) to keep renderer/main consistent
const fmtDate = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)

export const repo = {
  addTask(args: { title: string; description?: string; dueDate?: string; orderNum?: number }) {
    const data = readData()
    const now = new Date().toISOString()
    const id = ++data.seq
    const task: Task = {
      id,
      title: args.title,
      description: args.description ?? null,
      due_date: args.dueDate ?? null,
      status: 'active',
      order_num: args.orderNum ?? 0,
      created_at: now,
      updated_at: now,
      completed_at: null
    }
    data.tasks.push(task)
    atomicWrite(data)
    return task
  },
  updateTask(args: { id: number; patch: Partial<Task> }) {
    const data = readData()
    const idx = data.tasks.findIndex(t => t.id === args.id)
    if (idx < 0) throw new Error('Task not found')
    const now = new Date().toISOString()
    const old = data.tasks[idx]
    const next: Task = { ...old, ...args.patch, updated_at: now }
    data.tasks[idx] = next
    atomicWrite(data)
    return next
  },
  toggleDone(id: number) {
    const data = readData()
    const t = data.tasks.find(x => x.id === id)
    if (!t) throw new Error('Task not found')
    const now = new Date().toISOString()
    if (t.status === 'done') {
      t.status = 'active'
      t.completed_at = null
    } else {
      t.status = 'done'
      t.completed_at = now
    }
    t.updated_at = now
    atomicWrite(data)
    return t
  },
  deleteTask(id: number) {
    const data = readData()
    data.tasks = data.tasks.filter(t => t.id !== id)
    atomicWrite(data)
  },
  listTasks({ scope, keyword }: { scope: string; keyword?: string }) {
    const data = readData()
    const kw = keyword?.toLowerCase()
    const today = new Date()
    const todayStr = fmtDate(today)
    const dt = new Date(today)
    dt.setDate(dt.getDate() + 1)
    const tomorrowStr = fmtDate(dt)
    const end = new Date(today)
    // 周日为 0，算到周日
    end.setDate(end.getDate() + ((7 - end.getDay()) % 7))
    const endOfWeekStr = fmtDate(end)

    const matchKw = (t: Task) => !kw || t.title.toLowerCase().includes(kw)

    let list = data.tasks.filter(matchKw)
    switch (scope) {
      case 'today':
        list = list.filter(t => t.status === 'active' && t.due_date === todayStr)
        break
      case 'tomorrow':
        list = list.filter(t => t.status === 'active' && t.due_date === tomorrowStr)
        break
      case 'week':
        list = list.filter(t => t.status === 'active' && t.due_date! > todayStr && t.due_date! <= endOfWeekStr)
        break
      case 'later':
        list = list.filter(t => t.status === 'active' && !!t.due_date && t.due_date > endOfWeekStr)
        break
      case 'none':
        list = list.filter(t => t.status === 'active' && (!t.due_date || t.due_date === ''))
        break
      case 'done':
        list = list.filter(t => t.status === 'done')
        break
      default:
        // all
        break
    }
    return list.sort((a, b) => a.order_num - b.order_num || b.id - a.id)
  },
  getSetting(key: string) {
    const data = readData()
    return data.settings[key]
  },
  setSetting(key: string, value: string) {
    const data = readData()
    data.settings[key] = value
    atomicWrite(data)
  }
}
