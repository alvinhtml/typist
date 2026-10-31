# 界面改版验证报告

2026-10-31。状态：正式界面已实施，本机自动检查通过；人工体验及跨平台验收待补。

用户已确认「静墨」设计稿并要求修改现有界面，最终强调色为 #237A60。原实施记录见 [界面改版计划](../plans/phases/ui-redesign.md)，有效行为已同步 [项目需求](../requirements/overview.md) 与 [练习需求](../requirements/practice.md)。

## 实现

- App.vue：移除侧栏，默认居中首页；分级、生词、游戏主入口，生词本、添加文本、设置轻入口；各页面返回首页，原生文本小窗口仍可打开。
- PracticePanel.vue：保留一个挂载实例，分级入口接续最近分级课程，生词入口复用已有生词课程；有活动局时跨课程选择仍需确认。顶部课程/时长/时钟/暂停/继续/结束/重开，中央题目、对齐反馈及实时编码，底部五项成绩/进度。
- 保留真实作答控件和原编码适配器，以细下划线表示当前题与输入焦点，不用全页按键监听。作答节点在普通切题时稳定，仅按当前题槽位定位，避免异步保存后丢失快速输入的下一题半截编码；暂停/失效/切课/结束仍通过旧规则清空和解绑。
- 未开始、倒计时、运行、暂停、空课程、保存错误和结束成绩均有实际状态展示。上一轮默认收起，展开和缩放通过文档滚动访问，不悬浮覆盖题目或控件。切课确认支持焦点约束、Tab 循环及 Escape 取消。
- style.css：暖白、深墨、深绿统一变量；首页移入上浮 5px、局部光晕、按下缩放和波纹；导航不等待动画，减少动态效果禁用位移和波纹。管理页与托盘文本页共用样式，无新增依赖或网络字体。
- tests：更新原冒烟的导航路径及新布局定位，保留原有业务断言；新增 ui-smoke.cjs 和 npm run smoke:ui。未改动数据库、共享模型、编码匹配或主进程生命周期。

## 实际检查

环境：macOS arm64，Electron 44.2.0。

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm run build` | 通过，含类型检查 |
| `npm test` | 构建通过，43 项自动测试全部通过；[日志](ui-redesign-tests.log) |
| `electron tests/smoke.cjs` | 5 组基础检查通过；[日志](ui-redesign-base.log) |
| `electron tests/business-smoke.cjs` | 5 组词库/文本/跨窗口检查通过；[日志](ui-redesign-business.log) |
| `electron tests/practice-smoke.cjs` | 14 组练习回归通过；[日志](ui-redesign-practice.log) |
| `electron tests/ui-smoke.cjs` | 4 组界面与键盘检查通过；[日志](ui-redesign-smoke.log) |
| `git diff --check` | 通过 |

以上 Electron 命令实际使用仓库的 `node_modules/electron/dist/Electron.app/Contents/MacOS/Electron`，按顺序执行以避免窗口抢焦点。初次并行运行时练习被其他测试窗口触发自动暂停，单独运行后通过。实验性的导航等待曾导致后台窗口冒烟时序失败，已移除动画等待并重新通过词库、练习及界面检查，未降低业务断言。

新增界面检查使用 Electron sendInputEvent 验证空格键激活首页入口、编码缓冲、退格、跳过、连续切题聚焦，以及控件空格不作答；另外验证异步切题保留半截编码、离页取消缓冲并保留分数、手动继续、切课确认键盘操作、上一轮默认收起、空课程/游戏占位、原生文本窗口、减少动态效果与波纹清理。

窗口缩至产品允许的 800px 并放大 150% 后，长词组、罕见字和多码无横向页面溢出。上轮长词组可折行，成绩与按钮随文档滚动访问。罕见字在本机有字体回退，不推及其他系统。

## 截图

已查看首页、练习、暂停、窄窗口、缩放、设置、文本及结束页面。全部截图为本次运行的正式 Electron 界面，词库和统计为隔离测试数据。

- [首页](ui-redesign-home.png)
- [练习](ui-redesign-practice.png) · [倒计时](ui-redesign-countdown.png) · [暂停](ui-redesign-paused.png)
- [窄窗口](ui-redesign-narrow.png) · [150% 缩放](ui-redesign-zoom.png)
- [设置](ui-redesign-settings.png) · [生词本](ui-redesign-vocabulary.png) · [添加文本](ui-redesign-text.png) · [结束](ui-redesign-result.png)

## 验证边界与下一步

截图和合成按键不等同于真人操作系统输入验收。本次未执行 Windows、安装包、不同系统字体、真实输入法误开启、真实托盘菜单和连续输入人工验收；原有发行/安全风险仍见 [问题记录](../state/issues.md)。游戏仅保留入口与未实现状态，CSV 未提前开发。

下一步启动正式应用，人工检查菜单动效、直接编码/退格/暂停恢复、返回首页及切课确认、长词组与缩放体验。完成后再记录用户环境和人工验收结论。
