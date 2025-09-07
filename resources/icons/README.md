Place your application icons in this folder.

Recommended filenames and sizes:

- system.png
  - Shared icon for Menu Bar (tray) and Taskbar (Windows/Linux window/taskbar icon).
  - Suggested base: 512×512 or 1024×1024 PNG with transparency.

- app.png
  - App/Dock icon (macOS Dock set via code). Can be different from `system.png`.
  - Suggested base: 512×512 or 1024×1024 PNG with transparency.

Packaging with electron-builder (optional):

- For production builds, electron-builder uses `build/icon.*` by default. 本项目提供 `npm run icons:sync` 会把以下文件复制到 `build/`：
  - `resources/icons/system.png` -> `build/icon.png`（Linux 使用）
  - `resources/icons/system.icns` -> `build/icon.icns`（macOS 使用）
  - `resources/icons/system.ico` -> `build/icon.ico`（Windows 使用）
  请将你的 `system.png` 同步导出为 `.icns` 与 `.ico` 放在同目录，以便安装包/应用图标在各平台正确显示。

Notes:

- The runtime code will automatically pick these files in dev if present.
- On macOS, `BrowserWindow`'s `icon` field is ignored; Dock icon is set via `app.dock.setIcon`.
