# Typist

基于 Electron、Vue 3 与 TypeScript 的离线五笔 86 练习工具。阶段 3 普通与生词练习已接入：六类课程、输入反馈、覆盖与熟练进度、分组复习、暂停和本局成绩。词库和生词管理可用；CSV 迁移与下落游戏留后续阶段。真实输入法与双平台整体验收仍待完成。

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
npm run smoke:business
npm run smoke:practice
npm run package
npm run make
```

- `test`：练习规则、输入事件、学习和词库事务、存储与内存会话测试，临时目录自动清理。
- `smoke`：真实 Electron 窗口、IPC 和生命周期检查，需要桌面环境。
- `smoke:business`：真实 Electron 表单、文本结果、改码、删除与双窗口通知，使用临时数据库。
- `smoke:practice`：真实 Electron 合成输入、可控时钟、暂停、成绩、删除同步与确认取消；不代替真实输入法人工验收。
- `make`：在 macOS 生成 DMG/ZIP，在 Windows 生成 Squirrel 安装包/ZIP，输出在 `out/`。macOS 本地打包模块需要 Xcode Command Line Tools；若安装时跳过了脚本，运行 `npm rebuild macos-alias fs-xattr`。
- 本轮 macOS arm64 已验证；Windows、Intel 与最低 macOS 支持范围仍待实机检查。安装包未签名或公证。

## 数据与代码

- `src/main`：主进程窗口、IPC 与 SQLite 服务，唯一持久写入者。
- `src/preload`：沙箱固定接口，不暴露任意 SQL、路径或频道。
- `src/shared`：类型约定与内存会话接口。
- `src/renderer`：Vue 练习页面，设置、文本添加、生词和补充词库管理。
- `data/level1.csv`～`level5.csv`：只读内置资源，打包复制到 resources/data；额外 words.csv 保留但不作为课程。
- 用户数据库为 Electron `app.getPath('userData')/typist.sqlite`；macOS 默认在 `~/Library/Application Support/typist/`。不保存未结束的一局。
- `prototypes/ime-lab`：阶段 0 隔离原型，继续独立保留。

关闭窗口会隐藏到托盘。托盘菜单可恢复主窗口、打开文本窗口或退出。

项目规则见 [AGENTS.md](AGENTS.md)，当前进度见 [设计文档](design-docs/state/current.md)，实际验证与限制见 [阶段 3 报告](test-results/phase3-report.md)。

## 练习

在“分级练习”选择一级至四级、词组或“生词专项”，选择时长后开始。固定3秒准备；完整文字一次判定，直接空格跳过，作答框拒绝粘贴。显示批次按窗口宽度自适应，组内题序不因缩放改变。暂停、离页、最小化或切换应用后需手动继续。关闭收到托盘，重启保留课程进度和组，不保留本局现场或成绩。

## 测试产物

截图、报告和临时结果统一放在根目录 `test-results/`（Git 忽略，可删除，脚本自动创建）。需要保存命令日志时，可运行：

```sh
mkdir -p test-results
npm test > test-results/tests.log 2>&1
```

测试用的隔离数据库和用户目录仍使用系统临时目录并在退出后清理，避免混入实际学习数据。
