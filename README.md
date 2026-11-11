# mc-client

Vue + TypeScript 编写的 Minecraft RCON 桌面客户端。界面运行在 Electron 渲染进程中，RCON 连接由 Electron 主进程通过 `rcon-mc-command` 建立，两端使用 preload + IPC 通信。

## 开发

```bash
npm install
npm run dev
```

`npm run dev` 会同时启动 Vite 开发服务器和 Electron 窗口。

只预览界面、不连接 RCON 时可以使用：

```bash
npm run dev:web
```

## 构建并运行

```bash
npm run build
npm start
```

`npm run build` 只生成渲染进程产物 `dist/`，`npm start` 用本机 Electron 直接加载它，不会生成安装包。

## 打包桌面程序

一条命令生成安装包和便携版：

```bash
npm run pack:win
```

### 打包时实际执行的命令

`npm run pack:win` 对应 `package.json` 中的：

```bash
npm run build && cross-env ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/ electron-builder --win
```

其中：

1. `npm run build` 并行执行：
   - `vue-tsc --build`：类型检查
   - `vite build`：构建渲染进程，输出到 `dist/`
2. `electron-builder --win` 读取 [electron-builder.yml](electron-builder.yml)，依次完成：
   - 从 `electronDownload.mirror`（npmmirror）检查并下载与 `devDependencies` 中 electron 版本一致的 win32-x64 运行时
   - 执行 `@electron/rebuild`（当前项目没有原生依赖，实际不会重编译）
   - 把 `dist/`、`electron/`、`package.json` 以及生产依赖（`rcon-mc-command`、`vue`、`pinia`、`vue-router`）复制到 `release/win-unpacked/resources/app`
   - 生成 `MC RCON.exe`，应用图标取 `public/favicon.ico`；没有配置证书时跳过代码签名
   - 用 NSIS 压缩生成安装包与便携版，写入 `release/`

### 只生成解压目录

调试打包问题或只想快速验证时：

```bash
npm run pack:dir
```

等价于：

```bash
npm run build && electron-builder --dir
```

只生成 `release/win-unpacked/`，不压缩、不生成安装包，速度快很多。

### 手动分步执行

需要单独控制每一步时，可以按下面顺序执行：

```bash
npm run build
```

```bash
npx electron-builder --dir
```

```bash
npx electron-builder --win
```

`--win` 默认按 `electron-builder.yml` 生成 NSIS 和 portable 两个目标；只构建其中一个时使用：

```bash
npx electron-builder --win nsis
```

```bash
npx electron-builder --win portable
```

如果所在网络无法访问 GitHub，打包时需要设置工具镜像（`pack:win` 已内置这一步）：

```bash
npx cross-env ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/ electron-builder --win
```

首次打包会下载 Electron 运行时、NSIS 和 7zip 等工具并缓存，后续构建会快很多。

### 产物

- `MC RCON-Setup-<version>.exe`：NSIS 安装包，可选择安装目录并创建桌面快捷方式
- `MC RCON-Portable-<version>.exe`：免安装便携版
- `win-unpacked/`：未压缩的应用目录，可直接运行其中的 `MC RCON.exe`
- `*.blockmap`：electron-builder 生成的差分更新索引
- `latest.yml`：自动更新清单，随安装包一起发布到 GitHub Releases

版本号取 `package.json` 的 `version`；应用图标使用 `public/favicon.ico`。当前未配置代码签名证书，Windows 可能提示“未知发布者”，正式分发前可以补上签名配置。为保证 ESM 主进程与 `rcon-mc-command` 正常加载，打包配置中关闭了 asar（`electron-builder.yml` 的 `asar: false`）。

## 自动更新

应用通过 `electron-updater` 从 GitHub Releases 检查更新，更新清单是 Release 中的 `latest.yml`。界面右上角有“检查更新”按钮，应用启动后也会静默检查一次。

- 安装版（NSIS）：确认后应用内下载，下载完成后可重启安装。
- 便携版：不支持应用内安装，检查到新版本后打开 GitHub 发布页手动下载。
- 开发模式（未打包运行）不会检查更新。

### 发布新版本

1. 修改 `package.json` 的 `version`。
2. 准备一个有 `repo` 权限的 GitHub Token，设置为 `GH_TOKEN`（PowerShell：`$env:GH_TOKEN="ghp_xxx"`）。
3. 执行：

```bash
npm run publish:win
```

electron-builder 会生成安装包、`latest.yml` 和 `.blockmap`，并上传到该版本对应的 GitHub Release。默认创建的是草稿（draft）Release，需要到 GitHub Releases 页面确认并发布；发布后旧版本客户端才能检查到更新。

### 用 GitHub Actions 打包

仓库内置工作流 [build-windows.yml](.github/workflows/build-windows.yml)：

- 推送 `v*` 标签时自动构建 NSIS 安装包，并上传安装包、`latest.yml`、`.blockmap` 到该标签对应的草稿 Release。标签版本必须与 `package.json` 的 `version` 一致。
- 在 Actions 页面手动运行「Build Windows Installer」时只构建并生成 artifact，不会创建 Release。

```bash
git tag v1.0.0
```

```bash
git push origin v1.0.0
```

工作流运行完成后，到 GitHub Releases 把草稿发布出去，客户端即可检查到更新。

## 服务器要求

在服务器的 `server.properties` 中开启 RCON 并重启：

```properties
enable-rcon=true
rcon.port=25575
rcon.password=换成你自己的密码
```

RCON 为明文协议，请勿将端口暴露到公网；建议仅在局域网或本机使用。
