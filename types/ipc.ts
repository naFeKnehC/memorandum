export type TaskStatus = 'active' | 'done'

export interface Task {
  id: number
  title: string
  description?: string | null
  due_date?: string | null
  status: TaskStatus
  order_num: number
  created_at: string
  updated_at: string
  completed_at?: string | null
}

export type ListScope = 'today' | 'tomorrow' | 'week' | 'later' | 'none' | 'done'

export interface TodoAddArgs { title: string; description?: string; dueDate?: string; orderNum?: number }
export interface TodoUpdateArgs { id: number; patch: Partial<Pick<Task, 'title' | 'description' | 'due_date' | 'status' | 'order_num'>> }
export interface TodoToggleArgs { id: number }
export interface TodoDeleteArgs { id: number }
export interface TodoListArgs { scope: ListScope; keyword?: string }

export interface SettingsGetArgs { key: string }
export interface SettingsPutArgs { key: string; value: string }

declare global {
  interface Window {
    api: {
      todo: {
        add(args: TodoAddArgs): Promise<Task>
        update(args: TodoUpdateArgs): Promise<Task>
        toggleDone(args: TodoToggleArgs): Promise<Task>
        delete(args: TodoDeleteArgs): Promise<void>
        list(args: TodoListArgs): Promise<Task[]>
      }
      settings: {
        get(args: SettingsGetArgs): Promise<string | undefined>
        put(args: SettingsPutArgs): Promise<void>
      }
      app: {
        setAlwaysOnTop(args: { value: boolean }): Promise<void>
        setLock(args: { value: boolean }): Promise<void>
        setOpacity(args: { value: number }): Promise<void>
      }
    }
  }
}
