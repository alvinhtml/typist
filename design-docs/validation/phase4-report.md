# 阶段 4 实施与验证

2026-10-31，macOS arm64 / Electron 44.2.0。用户已确认实施方案。

已实现设置中心生词本/补充词库 CSV 导入导出、UTF-8 BOM 导出与严格解码、CSV 结构预解析、行级失败原因、组合去重及分类保留、严格词库匹配、单事务合并及双窗口提交通知。学习数据不参与交换，原有会话设置快照/确认流程复用。主要文件：src/main/csv.ts、storage.ts、index.ts、shared/contracts.ts、preload/index.ts、renderer/App.vue。

实际验证：

- npm test：类型检查与构建成功，46/46 通过，见 phase4-tests.log。首次新增测试对多行记录起始行误写为5，实际为4，核对输入后修正期望；未修改解析行为。
- npm run smoke、smoke:business、smoke:practice：沙箱内 Electron SIGABRT，沙箱外重跑均退出0；覆盖桌面基础、双窗口业务、设置快照不影响活动局、确认取消及暂停等既有场景。
- Electron tests/csv-smoke.cjs：退出0，覆盖补充→生词迁移、双窗口通知、BOM导出、取消不写入、对话框期间另一窗口提交造成CONFLICT及设置页入口。对话框由测试替身提供路径，真实磁盘读写与IPC未替代。
- 设置页截图已查看（/tmp/typist-phase4-settings.png）；CSV卡片沿用现有视觉样式。
- git diff --quiet b7cb19a -- data：退出0，内置资源未变。

限制：未执行原生文件对话框人工操作、Windows、真实磁盘满/崩溃恢复及大文件压力测试；不宣称双平台整体验收通过。导出文件保存失败会报告IO，系统文件覆盖确认行为仍须人工检查。依赖安全基线、安装与托盘人工遗留延续既有记录。

阶段4实现与本机自动检查交付；下一步人工检查文件选择、保存、取消与双机迁移。阶段5游戏同码选择和提交边界仍需确认后实施。本轮未提交新改动。
