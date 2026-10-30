# AI 开发效率提升文档


## 目录结构

```
project/
├── AGENTS.md                      # AI 开发入口与核心规则
├── README.md                      # 项目介绍、启动方式
├── design-docs/
│   ├── README.md                  # 文档索引、阅读顺序、权威性规则
│   │
│   ├── principles/
│   │   └── ai-development.md      # 通用 AI 开发原则
│   │
│   ├── requirements/
│   │   ├── overview.md            # 项目目标、范围、非目标
│   │   ├── modules.md             # 功能模块总表、模块边界
│   │   └── modules/               # 复杂模块的详细规格
│   │       ├── module-a.md
│   │       └── module-b.md
│   │
│   ├── architecture/
│   │   ├── overview.md            # 系统架构、模块依赖
│   │   ├── database.md            # 数据库设计
│   │   ├── api.md                 # API 和接口约定
│   │   └── decisions/             # 已确认的技术决策
│   │       └── ADR-001.md
│   │
│   ├── plans/
│   │   ├── roadmap.md             # 总体开发阶段
│   │   └── phases/
│   │       ├── phase-01.md        # 第一阶段任务
│   │       └── phase-02.md        # 第二阶段任务
│   │
│   ├── state/
│   │   ├── current.md             # 当前进度与下一步
│   │   ├── issues.md              # 待确认问题、阻塞事项
│   │   └── changelog.md            # 重要变更记录
│   │
│   └── templates/                 # 可复用的文档模板
│       ├── module-template.md
│       ├── task-template.md
│       ├── issue-template.md
│       └── decision-template.md
│
├── src/                           # 项目源代码
├── tests/                         # 测试
└── ...```