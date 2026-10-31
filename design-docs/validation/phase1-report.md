# 阶段 1 工程基础实施与验证

2026-10-31。状态：基础实现和 macOS arm64 开发/打包检查已完成；双平台阶段验收未完成。Windows 实机按此前用户决定延期，未进入阶段 2。

## 交付

- 根目录正式 Electron 44.2.0 / Vue 3.5.44 / TypeScript strict / Vite 7.3.7 / Forge 8.0.1 工程，精确依赖锁文件和开发、类型、构建、测试、打包命令。
- 主窗口五个导航入口、文本小窗口、真实设置保存、统一错误反馈；业务页面明确未接入，不模拟添加成功或练习成绩。
- 主进程独占 SQLite v1、只读资源与用户目录分离、全部设计表初始化及快照读取。设置完整事务、requestId 幂等、revision 冲突、失败回滚、版本保护；尚无后续版本升级迁移。
- 单实例进程、复用主/文本窗口、关闭隐藏到托盘、恢复与显式退出，暂停通知；sandbox/contextIsolation、固定 preload、sender 主 frame 验证、拒绝导航/弹窗/权限请求。
- 公共内存 Session：倒计时、运行、暂停、恢复、结束，单调计时、设置快照和 generation。后续业务写入与活动会话接入留对应阶段。

## 实际验证

环境：Darwin 25.5.0 arm64；Node 24.19.0；Electron 44.2.0。

| 检查 | 结果 |
| --- | --- |
| npm test | 类型检查、主进程编译和 Vite 构建通过；最初 6 个测试通过 |
| node --test tests/*.test.cjs（最终） | 8/8 通过，新增事务中途失败回滚与未知库/空库备份检查 |
| npm run smoke / 最终 electron tests/smoke.cjs | 实际 Electron 5 组检查通过：preload/快照、5 类资源、双窗口通知与复用、关闭隐藏/暂停/恢复、不可信窗口拒绝 |
| npm run make | 最终通过，生成 macOS arm64 .app、DMG 和 ZIP |
| node scripts/packaged-smoke.cjs out/Typist-darwin-arm64/Typist.app/Contents/MacOS/Typist | 打包二进制实际启动两次；临时 userData 创建数据库，修改设置后再次启动仍保留 |
| 资源一致性 | 6 个源 CSV 与 Git HEAD 字节一致；包内 level1～5 与源文件字节一致 |
| 视觉检查 | 实际主窗口截图 phase1-main.png：导航与课程卡片无截断，后续功能状态清晰 |
| git diff --check | 通过 |

存储测试含默认值、设置重启、学习记录/组持久化、唯一约束、幂等重放、不同负载拒绝、过期版本冲突、非法设置拒绝、只读写入失败、事务中途失败回滚、高版本拒绝、损坏数据保留和空库备份。只读/触发器模拟不能等同于物理磁盘满或系统崩溃恢复实测。

初次受限桌面启动 SIGABRT，授权桌面运行后通过。冒烟入口 appPath 修正为项目根目录，并修正 executeJavaScript 返回订阅函数不可克隆的问题；失败退出现在返回非零。DMG 初次因 ignore-scripts 安装缺少 macos-alias/fs-xattr 模块，补建后通过。保留这些失败原因，不将首次执行描述为成功。

## 产物

- out/make/dmg/arm64/Typist-0.1.0-arm64.dmg
- out/make/zip/darwin/arm64/Typist-darwin-arm64-0.1.0.zip

产物未签名/公证，未执行拖入 Applications 后的安装验收。out 与 node_modules 不提交 Git。

## 遗留与边界

- Windows 启动/安装、最低 macOS 和 Intel 实机未验证；不能宣布阶段 1 双平台验收通过。
- 系统托盘菜单真实鼠标点击与系统级二次启动激活仍待人工验证；自动测试已检查窗口关闭/恢复及进程退出路径。
- 阶段 3/4 接入活动会话后，必须完成退出确认、取消保持现场及候选窗口失焦过滤；当前不存在可开始的业务局，未宣称此部分闭环。
- 当前仅初始化 schema v1，没有 v1→v2 迁移；真实磁盘满、崩溃恢复待验证。业务学习写入待有效课程索引，不开放绕过课程校验的临时接口。
- npm audit 报告 22 项（17 moderate、5 high），包括批准基线 Electron 44.2.0 与 Forge/DMG 构建依赖。没有执行 audit fix --force；Electron 精确版本变更需按项目规则另行确认。应用仅加载本地内容、拒绝导航和权限请求，但这不等于消除全部运行时风险。发布前须处理，见 state/issues.md。
- 阶段 0 的 50 ms 输入缓冲边界仍保留，尚未复制为正式作答功能。
