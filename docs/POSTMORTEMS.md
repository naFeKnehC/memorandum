# 事后记录（Postmortems）

## 2025-09-07 输入回车后无法添加到列表（“添加失败”）

- 症状
  - 在输入框输入后按回车，列表各分组均无新条目出现。
  - 渲染层控制台报错：`TypeError: Cannot read properties of undefined (reading 'todo')`（`window.api` 未定义）。
  - 并非存储或展示分组逻辑的问题（JSON 未写入/Today 过滤），而是调用未抵达主进程。

- 排查路径
  1) 逐段加日志：渲染层（doAdd、add、reload）、IPC（todo:add/list）、存储（addTask/listTasks）。
  2) 开启 DevTools 并在终端观察主进程日志，确认调用链是否贯通。
  3) 明确链路：输入→渲染→preload 窗口桥（`window.api`）→主进程 IPC→存储→list→渲染展示。

- 根因
  - 预加载脚本（preload）未被 Electron 成功加载，导致 `window.api` 未注入。
  - 具体表现与原因：
    1) 构建产物为 ESM（`dist/preload/index.js` + `"type": "module"`），而 Electron 以 `require()` 加载 preload，报 `ERR_REQUIRE_ESM`，导致 preload 根本没执行。
    2) 开发环境产物为 `index.mjs`，而主进程最初指向 `index.js`，路径/格式不匹配进一步放大了问题概率。

- 伴随问题（非根因但影响体验）
  - IME 输入组合期间按回车被误提交；回车后默认日期未完全兜底到“今天”。

- 修复
  1) 预加载构建改为 CommonJS：electron-vite 产出 `dist/preload/index.cjs`。
  2) 主进程 preload 解析顺序：`index.cjs → index.js → index.mjs → src/preload/bridge.cjs`（兜底桥），保证始终可加载。
  3) 开发期临时兜底：曾短暂启用 `nodeIntegration` 并在渲染层注入 fallback（用于验证链路），随后恢复禁用，统一走 `preload + contextBridge`（与生产一致）。
  4) 渲染层引入统一 IPC 包装器（`@renderer/lib/ipc`），避免直接依赖 `window.api`，便于切换桥实现。
  5) 输入改进：
     - 回车提交对 IME 组合态安全判断（`isComposing`），避免误触发。
     - 提交时若日期为空/未定义，回落到本地“今天”。
  6) 调试便利：开发模式窗口加宽、DevTools 右侧停靠；增加必要日志点定位问题（后已移除噪声日志）。

- 验证
  - 渲染层日志出现 `todo.add ok`，随后 `reload lists` 中 Today 计数递增。
  - 主进程日志能看到 `todo:add` 与 `list` 调用；JSON 文件写入成功。
  - 交互验证：回车添加默认进入“今天”，切换日期/无日期均正确归组。

- 预防与改进
  - 规范：预加载脚本固定输出为 CJS；主进程容错解析多种后缀。
  - 开发安全与一致性：禁用 `nodeIntegration`，只用 `preload + contextBridge`。
  - 检测：
    - 在预提交中已加入 `tsc --noEmit` 和 ESLint 以降低类型/语法回归。
    - 可考虑增加一个启动自检：若 `window.api` 缺失，渲染层弹出明显错误提示。
  - 测试：后续可加一个简单的端到端冒烟（打开应用 → 通过 IPC 添加 → 读取列表应 ≥1）。

- 相关改动（关键文件）
  - 预加载与主进程：
    - `electron.vite.config.ts`（preload 输出为 CJS）
    - `src/main/index.ts`（preload 路径解析、DevTools 停靠、禁用 nodeIntegration）
    - `src/preload/index.ts`、`src/preload/bridge.cjs`
  - 渲染层：
    - `src/renderer/src/lib/ipc.ts`（统一 IPC 包装）
    - `src/renderer/src/ui/App.tsx`（IME 安全回车、日期兜底、使用 IPC 包装器）

