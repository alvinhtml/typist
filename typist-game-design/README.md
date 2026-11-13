# Typist 太空打字防御战 — AI 开发文档包

本包用于将现有 Typist「下落消除游戏」**原位升级替换**为半写实 2D 俯视太空打字防御战。不是新建项目或增加并列游戏模式。

## 阅读顺序
1. `design-docs/requirements/game-overview.md`：目标、范围、已确认规则及待决策项
2. `design-docs/requirements/gameplay-rules.md`：战斗、敌机、弹药、难度
3. `design-docs/requirements/input-system.md`：五笔 86 编码与自由选敌
4. `design-docs/requirements/game-ui.md`：页面与交互
5. `design-docs/art/art-direction.md`：视觉设计
6. `design-docs/art/asset-manifest.md`：素材交付清单
7. `design-docs/art/animation-spec.md`：动画与反馈
8. `design-docs/architecture/game-engine.md`：建议架构及集成约束
9. `design-docs/plans/implementation-plan.md`：Codex 执行步骤
10. `design-docs/plans/milestones.md`：验收与里程碑

## 重要边界
- 本文档依据用户提供的项目架构与需求对话编制，**尚未实际读取项目源代码**。所有文件路径和模块职责均须在 Codex 仓库审查阶段验证。
- 「已确认」与「建议默认值 / 待确认」严格区分。未确认的玩法不得被当成既定需求。
- 先完成可玩的纵向切片，再制作全部高精度素材；先保留现有测试与功能，再重构游戏实现。

## 交付给 Codex 的启动提示
请先阅读本包所有文档，再检查现有 `design-docs/requirements/typing-game.md`、游戏组件、共享编码判定模块、设置/成绩持久化及测试。以实际代码为准建立复用清单、冲突清单和变更计划。仅修改原有下落消除游戏，不影响分级练习、生词本、补充词库、托盘及其他业务。对文档中 `待确认` 的规则先提出问题或设计可替换策略接口，不要猜测实现。先提交审查报告和第一阶段任务计划，再开始修改代码。
