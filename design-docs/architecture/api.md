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
