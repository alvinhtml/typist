# Typist

基于 Electron、Vue 3 与 TypeScript 的离线五笔 86 练习工具。当前为阶段 1 工程基础：可启动、读取五类内置资源、保存设置、使用托盘与文本小窗口。练习、生词管理和游戏尚未接入。

## 开发

使用 Node 24 与 npm，运行：

```sh
npm ci
npm run dev
```

`dev` 先编译再启动 Electron，修改源码后需重新运行。`npm start` 直接启动已有构建。

```sh
npm run typecheck
npm test
npm run smoke
npm run package
npm run make
```

- `test`：存储与内存会话测试，临时目录自动清理。
- `smoke`：真实 Electron 窗口、IPC 和生命周期检查，需要桌面环境。
- `make`：在 macOS 生成 DMG/ZIP，在 Windows 生成 Squirrel 安装包/ZIP，输出在 `out/`。macOS 本地打包模块需要 Xcode Command Line Tools；若安装时跳过了脚本，运行 `npm rebuild macos-alias fs-xattr`。
- 本轮 macOS arm64 已验证；Windows、Intel 与最低 macOS 支持范围仍待实机检查。安装包未签名或公证。

## 数据与代码

- `src/main`：主进程窗口、IPC 与 SQLite 服务，唯一持久写入者。
- `src/preload`：沙箱固定接口，不暴露任意 SQL、路径或频道。
- `src/shared`：类型约定与内存会话接口。
- `src/renderer`：Vue 页面，设置保存及后续业务入口。
- `data/level1.csv`～`level5.csv`：只读内置资源，打包复制到 resources/data；额外 words.csv 保留但不作为课程。
- 用户数据库为 Electron `app.getPath('userData')/typist.sqlite`；macOS 默认在 `~/Library/Application Support/typist/`。不保存未结束的一局。
- `prototypes/ime-lab`：阶段 0 隔离原型，继续独立保留。

关闭窗口会隐藏到托盘。托盘菜单可恢复主窗口、打开文本窗口或退出。

项目规则见 [AGENTS.md](AGENTS.md)，当前进度见 [设计文档](design-docs/state/current.md)，实际验证与限制见 [阶段 1 报告](design-docs/validation/phase1-report.md)。
