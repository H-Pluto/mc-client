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

## 打包桌面程序

```bash
npm run pack:win
```

产物在 `release/` 目录：

- `MC RCON-Setup-<version>.exe`：NSIS 安装包，可选择安装目录并创建桌面快捷方式
- `MC RCON-Portable-<version>.exe`：免安装便携版
- `win-unpacked/`：未压缩的应用目录，可直接运行其中的 `MC RCON.exe`

只生成未压缩目录（调试打包问题时更快的选择）：

```bash
npm run pack:dir
```

版本号取 `package.json` 的 `version`；应用图标使用 `public/favicon.ico`。当前未配置代码签名证书，Windows 可能提示“未知发布者”，正式分发前可以补上签名配置。打包工具与 Electron 二进制均通过 npmmirror 镜像下载，配置见 `.npmrc` 和 `electron-builder.yml`。

## 服务器要求

在服务器的 `server.properties` 中开启 RCON 并重启：

```properties
enable-rcon=true
rcon.port=25575
rcon.password=换成你自己的密码
```

RCON 为明文协议，请勿将端口暴露到公网；建议仅在局域网或本机使用。
