# Typist - 打字练习软件

一个使用 Electron + Vue + TypeScript 开发的跨平台打字练习软件。

## 功能特点

- 跨平台支持 (Windows, macOS, Linux)
- 自动更新功能
- 打字练习和测速
- 练习数据统计
- 自定义练习文本

## 开发环境要求

- Node.js >= 16
- npm >= 8

## 开发指南

1. 安装依赖：
```bash
npm install
```

2. 开发模式：
```bash
npm run electron:dev
```

3. 构建应用：
```bash
npm run electron:build
```

## 技术栈

- Electron
- Vue 3
- TypeScript
- Vite
- electron-builder (打包)
- electron-updater (自动更新)

## 项目结构

```
├── README.md
├── config.json
├── data
│   ├── primary_shorthand_code.csv
│   ├── secondary_shorthand_code.csv
│   ├── tertiary_shorthand_code.csv
│   ├── phrases.csv
│   ├── vocabulary_notebook.csv
├── electron
├── index.html
├── main.js
├── package.json
├── src
│   ├── App.vue
│   ├── env.d.ts
│   ├── main.ts
│   └── views
│       ├── index.vue
│       ├── game.vue
│       ├── import.vue
│       ├── practice_menu.vue
│       └── practice.vue
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

