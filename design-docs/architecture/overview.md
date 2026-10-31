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
- 输入事件顺序、候选窗失焦、暂停取消组合；见 [输入矩阵](../validation/ime-matrix.md)。
- 布局、字体、长词与游戏参数尚未验收。

当前仅建立隔离 prototypes/ime-lab，不是阶段 1 正式工程或业务实现。

## 细化设计与实验

见 [数据库](database.md)、[接口](api.md) 和 [阶段报告](../validation/phase0-report.md)。SQLite 临时实验与关键页面布局已运行通过；正式存储服务、打包和业务尚未实现。

## 阶段 1 实现（2026-10-31）

根目录正式工程采用 Electron 44.2.0、Vue 3.5.44、TypeScript 5.9.3、Vite 7.3.7、Forge 8.0.1（精确版本及传递依赖见 lockfile）。主进程使用 node:sqlite，初始化 v1 STRICT 数据表；设置事务已接入，业务关联修改仍留后续阶段。sandbox/contextIsolation 开启，禁止新窗口、导航和权限请求；固定 preload 接口验证窗口与主 frame 来源。正式工程与阶段 0 原型独立。

公共 Session 为内存类，提供 idle/countdown/running/paused/ended、单调计时、设置快照和输入 generation；尚无活动业务会话，退出确认及候选窗失焦过滤须在阶段 3/4 接入。检查结果与发行限制以 [阶段 1 报告](../validation/phase1-report.md) 为准；以上旧待验证记录属于阶段 0 历史。
