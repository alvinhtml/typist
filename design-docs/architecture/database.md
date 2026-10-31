# 持久数据设计

2026-10-31。SQLite 方向已确认；本轮仅验证临时数据库，不创建正式用户数据库。

## 表与约束

| 表 | 主键 | 字段及约束 |
|---|---|---|
| supplemental | word, code | level INTEGER 1～5；文字/编码校验引用需求 |
| vocabulary | word, code | 必须属于最终合并词库，跨内存资源约束由事务协调器校验 |
| learning | course, word | covered 0/1、streak >=0、mistakes >=0、lastAnsweredAt 可空、mastered 0/1 |
| course_progress | course | cursor 0～4、orderedGroupWords JSON 数组，组内文字去重 |
| settings | 固定单行 id=1 | groupSize 5～100、threshold 1～10、duration 1～5、difficulty 三档 |
| metadata | 固定单行 id=1 | schemaVersion、revision >=0 |
| applied_request | requestId | payloadHash、结果 JSON、提交 revision，用于幂等重试 |

内置资源只读，不写入上述表。内存 Map<(word,code), Set<来源与分类>> 保留多来源；按课程文字聚合题目。组合键采用元组或嵌套 Map，不能未经转义拼接字符串。

索引：learning(course,lastAnsweredAt,mistakes)，其余先使用主键；按实际规模测试后再增加。SQLite STRICT 表；外键仅用于真正持久表关系，不对内置索引建立虚假外键。

## 完整事务

主进程串行执行 BEGIN IMMEDIATE；核对 expectedRevision、去重 requestId；构建最终词库并执行补充变更、生词替换与合并；按最终课程归属清理进度和组；更新 revision、幂等结果；COMMIT 后才更新内存索引并通知。失败 ROLLBACK，不广播成功。提交后索引更新失败则重建索引、暂停新操作，不继续使用旧视图。

学习事件与组/轮转位置同事务保存；会话剩余时间、目标坐标、当前局成绩不入库。开局复制设置；计时用单调时钟，复习排序时间戳使用持久 UTC 时间。系统时间倒退不影响局内计时。

迁移先校验版本、备份关闭状态数据库，再事务迁移；高版本拒绝写入，失败保留旧库与诊断，不清空重建。磁盘满、权限和损坏反馈 IO/MIGRATION；只读状态可以查看但不显示保存成功。

## 驱动实验结论

Electron 44.2.0 自带 node:sqlite（SQLite 3.53.4）在主进程可用，已验证唯一约束、关联事务回滚、完整改码保留进度、关闭重开及只读写失败。无需第三方 native ABI 重建，是当前 SQLite 方向下可行的实现候选。同步访问需限批量并测 UI 响应，正式工程可迁到专用 utility process；这不属于本轮实现。发行包内测试留在工程阶段，不能据未打包实验宣称分发验证通过。

## 阶段 1 落地

正式 Store 使用 node:sqlite，schema v1 表结构见 src/main/storage.ts。初始化空库使用事务；已有零版本空库在关闭连接后备份，高版本、未知表结构及损坏拒绝重建。当前无 v1→v2 迁移，未来升级仍须关闭库备份再事务执行，不能将初始化测试视为升级迁移验收。设置写入具备版本检查、请求幂等与回滚；learning/course_progress 表和快照读取已建立，业务写入接口待课程索引建立后接入。
