# ADR-001 阶段 0 技术方案

2026-10-30；状态：用户已确认推荐方向；具体兼容性与实验仍待验证。

## 推荐方案与备选

1. Electron 44.2.0 作为首轮实验基线（用户确认替换，npm registry 可查询），Vue 3、TypeScript strict；Vite 构建渲染端，Electron Forge 打包。精确工具依赖在批准后核对 engines 并锁定 lockfile；不使用浮动 latest。备选 Electron 45，需额外检查新主版本变化。发布前重新检查受支持版本，不长期冻结实验版本。
2. 主进程作为唯一数据写入者及变更协调者；预加载只暴露逐项类型化方法；Vue 渲染负责视图与内存会话，不直接访问文件。contextIsolation、sandbox 开启，nodeIntegration 关闭，校验 IPC sender 和输入，禁止任意路径/频道透传。窗口通知带 revision，遗漏后重取快照。
3. 推荐 SQLite 事务存储用户数据；内置 CSV 只读加载为索引。备选 JSON 快照实现简单，但完整关联修改、崩溃恢复和并发写入更难。SQLite 驱动及原生打包兼容必须另做实验，未选定驱动前不初始化数据库。
4. UI 使用 Vue 原生组件与 CSS，暂不引入组件库和 Pinia；需要时再评估。词库按文字/组合索引，最长匹配采用 Trie；游戏采用 DOM + requestAnimationFrame，先验证排版与性能。

## 数据结构草案

- DictionaryPair：复合键 (word, code)，sources 为来源集合（内置文件、level 或补充记录）；不得因组合去重丢失跨课程来源。内置值原样保留。
- Supplemental：主键 (word, code)，level 1～5；增改前校验与内置、已有补充的重复及分类冲突。
- Vocabulary：主键 (word, code)，必须存在于最终合并词库。
- Learning：主键 (courseId, word)，covered、streak、mistakes、lastAnsweredAt、mastered；不同课程独立。
- CourseProgress：courseId、orderedGroupWords、replacementCursor（0～4）；覆盖由 Learning 推导，避免双份计数。
- Settings：schemaVersion、groupSize、masteryThreshold、lastDuration、lastDifficulty。
- Session（仅内存）：id、generation、course、settingsSnapshot、phase、remainingMs、当前轮/题、已完成统计；游戏另有目标坐标/悬停状态，不写 Learning。
- 所有字数使用 Unicode code point 计数；是否需要字素簇另用罕见字样本验证。

完整修改先构造最终词库 → 替换生词旧码并去重 → 移除无来源组合 → 清理退出课程的文字进度/组 → 同一事务提交 → revision 增加 → 发布完整变更。失败回滚且不通知成功；活动当前题失效取消不计错，下一轮补位。磁盘提交失败不得先向用户显示成功。迁移版本化，迁移失败保留原文件并停止写入，不静默重置。

## 接口草案

统一 Result<T> = {ok:true,value:T,revision:number} | {ok:false,error:{code,message,retryable}}。

- getSnapshot()：设置、用户词库、生词与进度快照。
- mutateSupplemental({requestId,expectedRevision,operations})：完整批量增改删；返回最终变更集。
- addVocabularyText({requestId,text})：返回新增组合、重复出现次数、未知内容。
- deleteVocabulary({requestId,pairs})：按组合或调用方展开后的整字集合删除。
- updateSettings({requestId,settings})：仅影响下一局。
- importCsv({kind}) / exportCsv({kind})：主进程打开系统对话框，不接受渲染提供任意路径；取消作为独立结果。
- saveLearning({requestId,expectedRevision,courseId,changes,group,cursor})：单事务保存；请求去重防止重试重复累计。
- onChanged(callback)：返回 unsubscribe；事件包含 revision、受影响课程与完整组合变化。

错误码：VALIDATION、CONFLICT、IO、MIGRATION、CANCELLED；冲突重取快照，不盲目覆盖。主进程串行写入；跨窗口不能维护各自可写副本。

## 输入与状态草案

idle → countdown → running → paused → running / ended。计时使用单调时钟累计有效时间；暂停、到时和取消递增 generation，丢弃旧输入。composition 期间仅记录事件，不能按 keydown 判答案；最终提交走统一入口，以一次提交为完整字符串。直接空格在普通模式跳过、游戏忽略；组合选字空格必须与最终提交去重。粘贴在 paste/beforeinput 双入口拦截。暂停重建输入节点并取消组合，验证延迟 compositionend 不污染恢复后的会话。不能仅凭 DOM blur 推断应用失焦，应联合主窗口事件检查候选窗行为。

## 兼容依据与待验证

核查日期 2026-10-30：Electron 官方仓库列出 Windows 10+ 二进制支持，说明存在可行技术路径，不代表本项目实测通过：
- https://github.com/electron/electron
- https://releases.electronjs.org/
- https://www.electronjs.org/docs/latest/tutorial/security

推荐首轮测试 Windows 10 22H2 x64、微软五笔与用户实际五笔输入法；macOS 最低版本和 Intel 支持范围待用户确认。本机为 Darwin 25.5.0 arm64，Node 24.19.0、npm 11.17.0；没有确认可用 Windows 实机。不能用本机构建代替 Windows 验收。

## 批准后实验边界

只建立独立 prototypes/ime-lab：Electron 窗口 + Vue/TS 输入框、原始事件记录、模式切换、暂停/恢复及 JSON 日志导出。不连接业务数据；记录系统、输入法版本、Electron/Chromium 版本、事件序列与期望/实际。覆盖选字空格/数字/鼠标、完整词组、连续相同提交、英文数字标点、粘贴、组合时暂停/失焦/最小化、候选窗点击。关键页面先用静态样本验证尺寸和长词，游戏数量速度仅作为实验参数。

## 执行证据冲突

2026-10-30 实际 npm registry 查询 electron@44.10.0 返回 E404。此前网页结果不能作为可安装证据；该版本基线暂停采用，待核实替代版本并确认。其余已批准架构方向不受影响。

实际 npm view electron version 返回 45.1.0。建议将实验基线替换为 45.1.0，安装后核查 Windows 10 支持与事件行为；这是对已批准精确版本的变更，待确认。

2026-10-30 用户明确确认改用 Electron 45.1.0；此前版本待确认项已解决，兼容性仍待实测。

## 版本对应证据

已安装 electron@45.1.0 的 README 明确列出 Windows 10+（x64/arm64）、macOS Ventura+（Intel/Apple Silicon）；package.json 要求构建宿主 Node >=22.12.0，本机 Node 24.19.0 满足。用户最低 macOS 与测试环境仍待确认，不能宣称更旧系统支持。Vue 3.5.44、Vite 7.3.7 修复原候选版本的审计问题，已锁定依赖且类型检查/构建通过，审计 0。

## 当前有效基线

用户批准复用本地 Electron 44.2.0，取代前述 45.1.0 实验基线。macOS arm64 ZIP 与该 npm 包 checksums.json 的 SHA-256 一致；安装后实际运行版本为 44.2.0、Chromium 152.0.7977.76。类型检查、构建和合成输入冒烟通过。Windows x64 缓存存在但未运行，真实输入法仍待验证。
