# 技术方案（Electron + React + Vite + SQLite）

本文件用于约束实现细节与落地步骤。你更新本文件后，我将按最新内容直接实施。

## 1. 目标与范围
- 跨平台桌面端：Electron（Windows/macOS/Linux）。
- 前端：React + Vite + TypeScript + Tailwind + Zustand。
- 数据：本地 JSON（暂用，后续可迁移 SQLite）。
- 样式参考：偏便签风的淡黄色卡片列表，顶部工具栏含搜索/置顶/锁定等控件，列表项有勾选框、标题、副信息行、轻阴影与圆角。

## 2. 运行环境与工具
- Node >= 18、pnpm（或 npm/yarn）。
- Electron 集成：electron-vite（开发/构建）+ electron-builder（打包）。
- TypeScript 全量开启严格模式。

## 3. 目录结构
- `src/main/` 主进程：窗口、菜单、托盘、全局快捷键、DB、IPC。
- `src/preload/` 预加载脚本：受控暴露 API（contextBridge）。
- `src/renderer/` 渲染：React 组件、路由、状态、样式与视图。
- `src/main/db/` 数据库初始化、迁移、DAO/Repository。
- `resources/migrations/` SQL 迁移脚本（`001_init.sql` 等）。
- `types/ipc.ts` IPC 通道与参数/返回类型定义（配合 zod）。

## 4. 关键依赖
- 主进程：`electron`, `better-sqlite3`, `zod`。
- 渲染层：`react`, `react-dom`, `zustand`, `date-fns`, `tailwindcss`。
- 构建：`electron-vite`, `electron-builder`, `@types/node`。

## 5. 安全基线
- BrowserWindow：`{ contextIsolation: true, nodeIntegration: false, sandbox: true, preload }`。
- 仅通过 `contextBridge.exposeInMainWorld` 暴露白名单 API。
- 所有渲染->主进程的 IPC 参数以 zod 校验。
- Content-Security-Policy：限制 `script-src 'self'`、禁用 `eval`；网络默认不出站。

## 6. 数据存储（当前采用 JSON）
- 位置：`app.getPath('userData')/memorandum.json`。
- 结构：
  - `tasks: Task[]`、`settings: Record<string,string>`、`seq: number`（自增 id）
  - Task 字段同 PRD 草案（`id/title/description/due_date/status/order_num/...`）
- 写入策略：原子写（`.tmp` 写入后 `rename` 覆盖），崩溃安全。
- 迁移到 SQLite：后续增加导入器，将 JSON 内容一次性导入 SQLite。

## 7. IPC API 约定（示例）
- 命名空间：`todo.*`, `settings.*`, `app.*`。
- 规范：请求/响应均有类型，入参 zod 校验，错误统一 `{ code, message }`。
- 列表：
  - `todo.add({ title, description?, dueDate?, orderNum? }) -> Task`
  - `todo.update({ id, patch }) -> Task`
  - `todo.toggleDone({ id }) -> Task`
  - `todo.delete({ id }) -> void`
  - `todo.list({ scope: 'today'|'tomorrow'|'week'|'later'|'none'|'done', keyword? }) -> Task[]`
  - `todo.reorder({ group, fromId, toId }) -> void`
  - `settings.get({ key }) -> string | undefined`
  - `settings.put({ key, value }) -> void`
  - `app.setAlwaysOnTop({ value: boolean }) -> void`
  - `app.setLock({ value: boolean }) -> void`

## 8. UI 风格与组件（样式参考：淡黄色便签卡片）
- 设计令牌（Tailwind 自定义变量）：
  - 颜色：
    - `--bg-app: #f7f3ea`（整体浅米黄）
    - `--card: #fff6d5`（便签卡片黄）
    - `--card-hover: #fff1bf`
    - `--text: #2b2b2b`
    - `--muted: #8a8a8a`
    - 标签色（示例）：青 `#60c6bf`、紫 `#b59ce6`、粉 `#f59ac1`、蓝 `#7db4ff`、绿 `#9ad783`
    - 状态：完成线与勾选 `#c1c1c1`
  - 圆角：卡片 `12px`，输入框 `10px`，按钮 `8px`
  - 阴影：`0 2px 8px rgba(0,0,0,0.08)`；悬浮态加深到 `0 6px 16px rgba(0,0,0,0.12)`
  - 边框：`1px solid rgba(0,0,0,0.06)`
  - 排版：
    - 标题字重 600，字号 15–16px；副信息 12–13px，行高 1.2–1.3
    - 组标题使用小标签+文字（如“今天”）
- 组件树：
  - `TopBar`：左侧筛选与分组切换；右侧 搜索、置顶、锁定、设置。
  - `QuickInput`：默认聚焦于“今天”组；Enter 添加，Shift+Enter 换行。
  - `GroupSection`：分组标题、计数、折叠；内部渲染任务卡片列表。
  - `TaskItem`：复选框、标题、标签/日期副信息、更多菜单（编辑/删除/推迟）。
  - `UndoBar`：底部延时撤销条。
  - `TrayMenu`（后续）：快速添加、开关置顶/锁定。
- 交互：
  - “今天”启动聚焦、滚动到锚点；完成/删除提供撤销条。
  - 锁定模式：禁用点击/拖拽/编辑，仅允许滚动与复制；快捷键 `Cmd/Ctrl+L` 切换。
  - 置顶：按钮切换 + 状态持久化。
  - 拖拽排序：仅同分组内，锁定时禁用。

## 9. 快捷键
- `Cmd/Ctrl+N` 快速添加（唤起并聚焦输入）。
- `Cmd/Ctrl+K` 搜索。
- `Cmd/Ctrl+L` 锁定/解锁。
- `Cmd/Ctrl+T` 置顶开关。

## 10. 实施步骤（用于执行）
1) 脚手架 Electron+React+Vite+TS 基础工程（electron-vite 模板）。
2) 配置主/预加载/渲染三层安全选项与 CSP。
3) 接入 Tailwind 与主题令牌（便签风外观）。
4) 使用 JSON 存储：主进程实现原子读写与 CRUD（已完成）。
5) 定义 `types/ipc.ts` 与 zod 校验；实现 `todo.* / settings.* / app.*` IPC（已完成）。
6) 实现任务基础：添加/编辑/完成/删除；分组视图与“今天”自动定位（已完成样例）。
7) 置顶与锁定：主进程窗口 API + 渲染状态联动并持久化（已完成样例）。
8) 搜索与关键词高亮；拖拽排序；撤销条。
9) 打包配置（electron-builder）与平台测试。

## 11. 验收清单
- App 启动即定位“今天”，可快速添加并立即可见。
- 置顶可切换并重启保持；锁定后编辑/拖拽被禁用。
- 分组正确且跨日自动刷新；搜索能高亮匹配；撤销可用。
- 均通过 IPC 类型校验；数据库写入具备 WAL 与超时配置。

## 12. 约定
- 代码风格遵循 TypeScript 严格模式，变量/函数命名清晰。
- 不在渲染进程中直接使用 Node/数据库；一切通过 IPC。
- PRD 为产品来源，TECH 为实现来源；两者若冲突，以 PRD 为准。

（你可在此文档上改动颜色/组件/API/步骤等，我将以最新版本为准执行。）
