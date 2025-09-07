import React, { useEffect, useRef, useState } from 'react'
import type { Task } from '@types/ipc'
import { api } from '@renderer/lib/ipc'
import { addDays, format } from 'date-fns'

function TopBar(props: {
  alwaysOnTop: boolean
  onToggleTop: () => void
  locked: boolean
  onToggleLock: () => void
  onSearch: (q: string) => void
}) {
  return (
    <div className="flex items-center justify-between px-2 py-1 gap-2 sticky top-0 bg-appbg/80 backdrop-blur z-20 border-b border-black/5">
      <div className="text-sm font-semibold">Memorandum</div>
      <div className="flex items-center gap-2">
        <input
          placeholder="搜索"
          className="rounded-input px-2 py-1 text-sm border border-black/10 bg-white/70 focus:outline-none"
          onChange={(e) => props.onSearch(e.target.value)}
        />
        <button className="icon-btn" title="置顶" onClick={props.onToggleTop}>
          {props.alwaysOnTop ? '📌' : '📍'}
        </button>
        <button className="icon-btn" title="锁定/解锁" onClick={props.onToggleLock}>
          {props.locked ? '🔒' : '🔓'}
        </button>
      </div>
    </div>
  )
}

function toISODate(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function QuickInput(props: {
  disabled?: boolean
  onAdd: (title: string, date: string | null) => void
}) {
  const [v, setV] = useState('')
  const [date, setDate] = useState<string | null>(toISODate(new Date()))
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  const todayISO = toISODate(new Date())
  const tomorrowISO = toISODate(addDays(new Date(), 1))
  const selected =
    date === null
      ? 'none'
      : date === todayISO
        ? 'today'
        : date === tomorrowISO
          ? 'tomorrow'
          : 'custom'
  const btn = (active: boolean) => `btn ${active ? 'bg-yellow-200 ring-1 ring-amber-300' : ''}`
  const doAdd = () => {
    const title = v.trim()
    if (!title) return
    // 默认加到今天；若用户明确选择“无日期”，则保持 null
    const chosen = date === '' || (date as any) === undefined ? toISODate(new Date()) : date
    props.onAdd(title, chosen)
    setV('')
  }
  return (
    <div className="p-2">
      <input
        ref={ref}
        disabled={props.disabled}
        placeholder="要做什么… 回车添加"
        className="w-full rounded-input px-3 py-2 border border-black/10 bg-white/80 shadow-sm focus:outline-none"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const ne: any = e.nativeEvent as any
            const composing = (e as any).isComposing || (ne && ne.isComposing)
            if (composing) return
            e.preventDefault()
            doAdd()
          }
        }}
      />
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="muted">日期:</span>
        <button
          className={btn(selected === 'today')}
          aria-pressed={selected === 'today'}
          onClick={() => setDate(todayISO)}
        >
          今天
        </button>
        <button
          className={btn(selected === 'tomorrow')}
          aria-pressed={selected === 'tomorrow'}
          onClick={() => setDate(tomorrowISO)}
        >
          明天
        </button>
        <button
          className={btn(selected === 'none')}
          aria-pressed={selected === 'none'}
          onClick={() => setDate(null)}
        >
          无日期
        </button>
        <input
          type="date"
          className="rounded-input px-2 py-1 border border-black/10 bg-white/70"
          value={date ?? ''}
          onChange={(e) => setDate(e.target.value || null)}
        />
        <span className="muted">
          {selected === 'today'
            ? '今天'
            : selected === 'tomorrow'
              ? '明天'
              : selected === 'none'
                ? '无日期'
                : date}
        </span>
      </div>
    </div>
  )
}

function Highlight({ text, kw }: { text: string; kw: string }) {
  if (!kw) return <>{text}</>
  const i = text.toLowerCase().indexOf(kw.toLowerCase())
  if (i < 0) return <>{text}</>
  const pre = text.slice(0, i)
  const mid = text.slice(i, i + kw.length)
  const suf = text.slice(i + kw.length)
  return (
    <>
      {pre}
      <mark className="bg-yellow-200 rounded px-0.5">{mid}</mark>
      {suf}
    </>
  )
}

function TaskItem({
  t,
  disabled,
  onToggle,
  onDelete,
  kw,
  onEdit,
  onEditDate,
}: {
  t: Task
  disabled?: boolean
  onToggle: () => void
  onDelete: () => void
  kw: string
  onEdit: (title: string) => void
  onEditDate: (date: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(t.title)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (editing) {
      setVal(t.title)
      inputRef.current?.focus()
    }
  }, [editing, t.title])
  const save = () => {
    const v = val.trim()
    if (v && v !== t.title) onEdit(v)
    setEditing(false)
  }
  const [dateEditing, setDateEditing] = useState(false)
  const [dateVal, setDateVal] = useState<string | ''>(t.due_date ?? '')
  return (
    <div className="card p-3 flex items-start gap-2 hover:shadow-card-lg">
      <input
        type="checkbox"
        checked={t.status === 'done'}
        onChange={onToggle}
        disabled={disabled}
      />
      <div className="flex-1">
        {editing ? (
          <input
            ref={inputRef}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') {
                setEditing(false)
                setVal(t.title)
              }
            }}
            className="w-full rounded-input px-2 py-1 border border-black/10 bg-white focus:outline-none"
            disabled={disabled}
          />
        ) : (
          <div
            className="task-title"
            style={{
              textDecoration: t.status === 'done' ? 'line-through' : undefined,
              color: t.status === 'done' ? 'var(--muted)' : undefined,
            }}
            onDoubleClick={() => !disabled && setEditing(true)}
          >
            <Highlight text={t.title} kw={kw} />
          </div>
        )}
        <div className="text-xs muted mt-0.5">
          {dateEditing ? (
            <span className="inline-flex items-center gap-1">
              <input
                type="date"
                value={dateVal}
                onChange={(e) => setDateVal(e.target.value)}
                className="rounded-input px-1 py-0.5 border border-black/10"
              />
              <button
                className="btn"
                onClick={() => {
                  onEditDate(dateVal || null)
                  setDateEditing(false)
                }}
              >
                保存
              </button>
              <button
                className="btn"
                onClick={() => {
                  setDateEditing(false)
                  setDateVal(t.due_date ?? '')
                }}
              >
                取消
              </button>
            </span>
          ) : (
            <span
              className="cursor-pointer"
              onClick={() => !disabled && setDateEditing(true)}
              title="点击修改日期"
            >
              {t.due_date ? `到期 ${t.due_date}` : '无日期'}
            </span>
          )}
        </div>
      </div>
      <button className="icon-btn" onClick={onDelete} disabled={disabled} title="删除">
        🗑️
      </button>
    </div>
  )
}

function GroupSection({
  title,
  tasks,
  disabled,
  onToggle,
  onDelete,
  kw,
  onEdit,
  onEditDate,
}: {
  title: string
  tasks: Task[]
  disabled?: boolean
  onToggle: (id: number) => void
  onDelete: (id: number) => void
  kw: string
  onEdit: (id: number, title: string) => void
  onEditDate: (id: number, d: string | null) => void
}) {
  return (
    <section>
      <div className="group-title">
        {title} <span className="muted">({tasks.length})</span>
      </div>
      <div className="px-2 space-y-2 py-2">
        {tasks.map((t) => (
          <TaskItem
            key={t.id}
            t={t}
            kw={kw}
            disabled={disabled}
            onToggle={() => onToggle(t.id)}
            onDelete={() => onDelete(t.id)}
            onEdit={(title) => onEdit(t.id, title)}
            onEditDate={(d) => onEditDate(t.id, d)}
          />
        ))}
      </div>
    </section>
  )
}

export default function App() {
  const [alwaysOnTop, setAlwaysOnTop] = useState(false)
  const [locked, setLocked] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [today, setToday] = useState<Task[]>([])
  const [tomorrow, setTomorrow] = useState<Task[]>([])
  const [week, setWeek] = useState<Task[]>([])
  const [later, setLater] = useState<Task[]>([])
  const [none, setNone] = useState<Task[]>([])
  const [done, setDone] = useState<Task[]>([])

  const reload = async () => {
    try {
      const [t0, t1, tw, tl, tn, td] = await Promise.all([
        api.todo.list({ scope: 'today', keyword }),
        api.todo.list({ scope: 'tomorrow', keyword }),
        api.todo.list({ scope: 'week', keyword }),
        api.todo.list({ scope: 'later', keyword }),
        api.todo.list({ scope: 'none', keyword }),
        api.todo.list({ scope: 'done', keyword }),
      ])
      setToday(t0)
      setTomorrow(t1)
      setWeek(tw)
      setLater(tl)
      setNone(tn)
      setDone(td)
    } catch (e) {
      console.warn('list failed', e)
      setToday([])
      setTomorrow([])
      setWeek([])
      setLater([])
      setNone([])
      setDone([])
    }
  }

  useEffect(() => {
    reload()
  }, [keyword])
  useEffect(() => {
    // load persisted settings
    ;(async () => {
      try {
        const atop = await window.api.settings.get({ key: 'alwaysOnTop' })
        const lockv = await window.api.settings.get({ key: 'lock' })
        const atopBool = atop === '1' || atop === 'true'
        const lockBool = lockv === '1' || lockv === 'true'
        setAlwaysOnTop(atopBool)
        setLocked(lockBool)
        await window.api.app.setAlwaysOnTop({ value: atopBool })
        await window.api.app.setLock({ value: lockBool })
      } catch (e) {
        /* ignore */
      }
    })()
  }, [])

  const add = async (title: string, date: string | null) => {
    try {
      const t = await api.todo.add({ title, dueDate: date ?? undefined })
      await reload()
    } catch (e) {
      console.warn('add failed', e)
    }
  }
  const toggle = async (id: number) => {
    try {
      await api.todo.toggleDone({ id })
      await reload()
    } catch (e) {
      console.warn(e)
    }
  }
  const del = async (id: number) => {
    try {
      if (!window.confirm('确定删除该任务？')) return
      await api.todo.delete({ id })
      await reload()
    } catch (e) {
      console.warn(e)
    }
  }
  const edit = async (id: number, title: string) => {
    try {
      await api.todo.update({ id, patch: { title } })
      await reload()
    } catch (e) {
      console.warn(e)
    }
  }
  const editDate = async (id: number, date: string | null) => {
    try {
      await api.todo.update({ id, patch: { due_date: date ?? undefined } })
      await reload()
    } catch (e) {
      console.warn(e)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <TopBar
        alwaysOnTop={alwaysOnTop}
        onToggleTop={async () => {
          const v = !alwaysOnTop
          setAlwaysOnTop(v)
          await window.api.app.setAlwaysOnTop({ value: v })
          await window.api.settings.put({
            key: 'alwaysOnTop',
            value: v ? '1' : '0',
          })
        }}
        locked={locked}
        onToggleLock={async () => {
          const v = !locked
          setLocked(v)
          await window.api.app.setLock({ value: v })
          await window.api.settings.put({ key: 'lock', value: v ? '1' : '0' })
        }}
        onSearch={setKeyword}
      />
      <QuickInput disabled={locked} onAdd={add} />
      <div className="overflow-auto pb-4">
        <GroupSection
          title="今天"
          tasks={today}
          kw={keyword}
          disabled={locked}
          onToggle={toggle}
          onDelete={del}
          onEdit={edit}
          onEditDate={editDate}
        />
        <GroupSection
          title="明天"
          tasks={tomorrow}
          kw={keyword}
          disabled={locked}
          onToggle={toggle}
          onDelete={del}
          onEdit={edit}
          onEditDate={editDate}
        />
        <GroupSection
          title="本周"
          tasks={week}
          kw={keyword}
          disabled={locked}
          onToggle={toggle}
          onDelete={del}
          onEdit={edit}
          onEditDate={editDate}
        />
        <GroupSection
          title="以后"
          tasks={later}
          kw={keyword}
          disabled={locked}
          onToggle={toggle}
          onDelete={del}
          onEdit={edit}
          onEditDate={editDate}
        />
        <GroupSection
          title="无日期"
          tasks={none}
          kw={keyword}
          disabled={locked}
          onToggle={toggle}
          onDelete={del}
          onEdit={edit}
          onEditDate={editDate}
        />
        <GroupSection
          title="已完成"
          tasks={done}
          kw={keyword}
          disabled={locked}
          onToggle={toggle}
          onDelete={del}
          onEdit={edit}
          onEditDate={editDate}
        />
      </div>
    </div>
  )
}
