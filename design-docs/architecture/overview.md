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
