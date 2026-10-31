# 进程与接口执行约定

2026-10-31。落实已确认 ADR-001 的接口边界；本轮不实现业务 API。

- preload 暴露固定方法，不暴露 ipcRenderer、任意频道、文件路径或 SQL。主进程验证 senderFrame URL、参数结构、枚举和大小，TS 类型不能替代运行时校验。
- 所有写请求含 requestId、expectedRevision。相同 ID/相同负载返回原结果；同 ID/不同负载返回 VALIDATION；过期 revision 返回 CONFLICT 与当前 revision，调用方重新加载后由用户操作重试。
- Result<T>：成功 `{ok:true,value:T,revision:number}`；失败 `{ok:false,error:{code,message,retryable}}`。文件对话框取消返回 CANCELLED，不记错误或部分成功。
- getSnapshot：Settings、Supplemental[]、VocabularyPair[]、Learning[]、CourseProgress[]、revision；较大内置词库按课程分页查询，不反复广播整个 CSV。
- mutateSupplemental：operations 为 add({word,code,level}) / update({oldPair,newEntry}) / delete({pair}) 的判别联合。返回新增/合并/删除组合及最终受影响课程。
- addVocabularyText：text → addedPairs、duplicateOccurrences、unknownDistinct；不返回旧组合作为新增。
- deleteVocabulary：pairs[] → removedPairs、removedCourseWords。整字删除在主进程按当前快照展开，避免渲染旧快照漏删。
- updateSettings：仅设置字段；返回新 Settings，不能改活动 Session 的 settingsSnapshot。
- saveLearning：course、changes、group、cursor，拒绝不属于该课程的文字；幂等事务避免重试重复累计。
- importCsv/exportCsv：kind='vocabulary'|'supplemental'，主进程系统对话框选择路径；结构错误整份拒绝，行级错误返回行号/原因，验证完成后单事务合并。
- onChanged：返回清理函数，事件为 revision、requestId、affectedCourses、addedPairs、removedPairs、codeReplacements、removedCourseWords。revision 不连续时重取快照。窗口销毁解绑，禁止中间变更通知。

主窗口负责当前会话；托盘窗口仅调用相同主进程服务。词库变更先取消失效当前题再调整显示，统计不回退；游戏同步有效目标集合。暂停/离页/最小化使 generation 失效；恢复必须手动。输入策略的 50 ms 暂存为已实测实验方案，正式实现不得隐藏其快速暂停可能取消刚提交文字的边界风险。

## 阶段 1 已实现范围

固定 bridge：getSnapshot、getResources（五类资源存在性/大小）、updateSettings、openMain、openText、quit、onChanged 与 onPause。updateSettings 的类型签名及请求结构以 src/shared/contracts.ts 为准，使用 requestId/expectedRevision/value；其余业务接口尚未开放。onChanged 仅提交后广播，订阅返回解绑函数。渲染窗口仅能通过指定入口访问，未知窗口及子 frame 请求拒绝。

当前没有可开始的业务局；公共 Session 已可独立使用，onPause 供后续连接。阶段 3/4 接入 Session 后必须补充退出确认、取消后保持现场和候选窗口过滤，不能直接把原始 blur 通知当成已经验证的输入策略。

## 阶段 2 已实现范围

新增固定 bridge 方法 getCourse({course,offset,limit})、mutateSupplemental(Write<SupplementalOperation[]>)、addVocabularyText(Write<string>)、deleteVocabulary(Write<{pairs,words}>)。现有 Write 包装不变，业务类型以 src/shared/contracts.ts 为准。getCourse 按文字聚合返回 total/items，每页 1～200；文本最多100000字符，补充和删除单次最多1000项。整字删除由主进程在当前事务展开。补充修改仅支持编码与分类，编码去首尾空白转小写；内置原码保持不变。

返回新增/删除的生词组合、改码替换、退出课程的文字及受影响课程；补充操作另返回 addedEntries/removedEntries/merged。onChanged 的 addedPairs/removedPairs 为生词组合，补充变更由 affectedCourses 和新快照读取；仅在提交后广播，幂等重放不再次广播。窗口收到通知重取完整快照，不依赖连续事件累积本地数据。练习/游戏接入时还须使用这些最终变更取消失效题和更新提示。

## 阶段 3 已实现范围

saveLearning(Write<LearningWrite>)的value为{course,changes:Learning[],group:string[],cursor}，沿用学习/组同事务和幂等设计。changes最多200条，group最多100个唯一文字，cursor为0～4。主进程事务内验证最终课程归属和记录类型/范围，过期版本不写；已提交请求重放返回原结果，不复活已删除记录。学习写入不重建词库索引；提交后广播revision（affectedCourses为空，避免将学习保存误当词库内容变更）。

setSessionActive(boolean)只同步主窗口内存活动局标记，供退出确认使用，不持久化现场。saveLearning和活动局标记仅主窗口可调用；文本窗口拒绝。主窗口重新加载/渲染进程退出后标记失效。退出未结束局先发pause，再弹系统确认，取消保持暂停。课程/重新开始确认在渲染层执行，确认后才替换局。

渲染层串行提交学习候选，COMMIT成功才替换显示模型；失败暂停，读回当前词库/学习记录并提示。词库通知进入同一操作队列，先使失效当前题的输入代次失效，再按最终集合更新；保持已完成本局统计。原生blur结合窗口焦点/应用激活状态，不监听DOM blur直接暂停，真实候选窗仍待验证。

## 2026-10-31 编码输入变更

旧输入法文字判定、composition 去重及 50ms 缓冲描述仅反映历史实现，已被确认的新编码规则取代，代码整改与本机自动回归已完成，真实键盘验收待补。实施以 [编码整改文档](../plans/phases/phase-03-code-input.md) 为准。保留会话暂停、进度存储与事务边界，未提交编码清空不计错，不自动清空学习记录。

内部 Practice.answer(code: string | null, at) 接受规范化编码，null 独立表示跳过；空串不提交。正确性只比较当前题 codes；输入层按课程长度触发，不改变 IPC 或 SQLite v1。
