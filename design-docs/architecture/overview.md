# 技术架构与验证状态

更新时间：2026-10-30。推荐方向经用户确认，兼容性与实现仍需验证。

## 已确认

- Electron 44.2.0 实验基线，Vue 3、TypeScript strict；Vite 构建、Forge 打包方向。
- macOS 与 Windows 10、离线、本机数据；内置 data 只读，补充数据独立保存。
- 主进程统一写入，预加载暴露类型化方法，渲染只管理视图和内存会话；SQLite 事务存储方向。
- Vue 原生组件/CSS，文字与组合索引、Trie 最长匹配，DOM 游戏实验方向。
- 数据和接口约定见 [ADR-001](decisions/ADR-001-phase-0.md)，需求见 [项目概览](../requirements/overview.md)。

## 待验证

- 精确依赖安装、构建与打包；SQLite 驱动选择与目标系统兼容。
- 目标 macOS 最低版本/芯片及 Windows 10 实机输入法。
- 输入事件顺序、候选窗失焦、暂停取消组合；见 [输入矩阵](../../test-results/ime-matrix.md)。
- 布局、字体、长词与游戏参数尚未验收。

当前仅建立隔离 prototypes/ime-lab，不是阶段 1 正式工程或业务实现。

## 细化设计与实验

见 [数据库](database.md)、[接口](api.md) 和 [阶段报告](../../test-results/phase0-report.md)。SQLite 临时实验与关键页面布局已运行通过；正式存储服务、打包和业务尚未实现。

## 阶段 1 实现（2026-10-31）

根目录正式工程采用 Electron 44.2.0、Vue 3.5.44、TypeScript 5.9.3、Vite 7.3.7、Forge 8.0.1（精确版本及传递依赖见 lockfile）。主进程使用 node:sqlite，初始化 v1 STRICT 数据表；设置事务已接入，业务关联修改仍留后续阶段。sandbox/contextIsolation 开启，禁止新窗口、导航和权限请求；固定 preload 接口验证窗口与主 frame 来源。正式工程与阶段 0 原型独立。

公共 Session 为内存类，提供 idle/countdown/running/paused/ended、单调计时、设置快照和输入 generation；尚无活动业务会话，退出确认及候选窗失焦过滤须在阶段 3/4 接入。检查结果与发行限制以 [阶段 1 报告](../../test-results/phase1-report.md) 为准；以上旧待验证记录属于阶段 0 历史。

## 阶段 2 实现（2026-10-31）

正式词库服务位于 src/main/dictionary.ts，主进程启动加载五类资源，保留组合多分类来源、全编码及 Trie 最长匹配。Store 协调完整补充/生词事务、最终课程清理和提交后索引交换。固定 IPC 接入主窗口及文本窗口，管理列表按文字/编码搜索、每页100项。未改变 Electron 基线或数据库版本；相关验证与限制见 [阶段 2 报告](../../test-results/phase2-report.md)。

## 阶段 3 实现（2026-10-31）

src/shared/practice.ts为可注入随机源的纯练习模型，Session负责单调时钟和内存生命周期。PracticePanel在主窗口保持挂载，离页只隐藏并暂停；ResizeObserver独立决定当前显示批次。answer-input仅监听作答框逐键字母，按课程长度同步提交编码；拒绝粘贴/拖入及中文上屏，暂停重建节点并清空缓冲。无延迟提交或到时flush。完整答案在接收时检查时钟，队列按已提交模型依次克隆并事务保存，成功后公布计分；暂停/结束不丢弃已完整提交的答案，词库变更或保存失败使后续排队答案失效。主进程落地saveLearning及活动局退出标记，不将现场存入SQLite。实际验证见阶段3报告。

## 2026-10-31 编码输入变更

旧输入法文字判定、composition 去重及 50ms 缓冲描述仅反映历史实现，已被确认的新编码规则取代，代码整改与本机自动回归已完成，真实键盘验收待补。实施以 [编码整改文档](../plans/phases/phase-03-code-input.md) 为准。保留会话暂停、进度存储与事务边界，未提交编码清空不计错，不自动清空学习记录。

## 阶段5游戏实现

shared/game.ts为可注入时钟和随机源的独立内存模型，复用Session；位置按有效时间推进，暂停冻结，悬停只冻结一个目标。独立列使用420px逻辑路径，显示高度随窗口调整，长词换行。GamePanel复用answer-input的词组模式（四码自动提交、短码空格），忽略空提交。App通过开局前回调协调练习/游戏，结束另一活动局需确认，取消保留暂停现场。词库通知重新按版本读取课程并同步有效目标；不调用saveLearning，不新增IPC和数据库。

## 渲染界面主题（2026-10-31）

CSS语义变量统一浅色/深色；theme.ts在Vue挂载前应用本机偏好，跟随系统时监听prefers-color-scheme，ThemeSwitch提供原生select的键盘操作。外观偏好仅保存localStorage并通过storage事件同步窗口，不新增业务IPC、数据库或依赖。读取不可用时回退系统。页面及原生外观边界见 [界面规范](../requirements/interface-design.md)。
