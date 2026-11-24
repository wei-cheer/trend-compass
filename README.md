# trend-compass（热点罗盘）

面向自媒体创作者的**多源热点聚合平台**。

## 项目定位

把多个信息来源的热点聚合到一处，供内容创作者筛选、追踪并产出视频与图文内容。项目名、目录结构与接口命名均为独立设计，不沿用参考项目。

## 当前进度

Step 0（仓库初始化）与 Step 1（后端骨架，可在 3001 启动）已完成；Step 2 探针接口、Step 3 前端骨架、Step 4 联调尚未开始。各 Step 的详细状态、验收与偏差以方案文档第 4 节「分步计划」和第 9 节「执行记录」为准，本文件不再重复。

## 目录结构

仓库里实际存在的文件：

```text
trend-compass/
├── README.md
├── .gitignore
├── api/                          # Express 5 + TypeScript 后端（Step 1 已建，无业务接口）
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── .env.example              # 只有 PORT=3001 占位
│   └── src/main.ts               # 启动入口，监听 3001
└── specs/                        # 需求、方案与 Step 说明
    ├── 需求规格.md
    ├── 实施方案-最小可运行骨架.md
    ├── 任务说明-Step1-后端骨架.md
    └── Step1-说明.md
```

`node_modules/`、`dist/`、`.env` 不入库（见 `.gitignore`）；前端 `web/` 尚未创建。

## 文档

- [specs/需求规格.md](specs/需求规格.md)：目标用户、核心价值、功能点
- [specs/实施方案-最小可运行骨架.md](specs/实施方案-最小可运行骨架.md)：契约口径、技术栈与运行时、Step 0~4 分步、验收清单、风险与执行记录（**状态的唯一准绳**）
- [specs/任务说明-Step1-后端骨架.md](specs/任务说明-Step1-后端骨架.md)：Step 1 的原始任务说明
- [specs/Step1-说明.md](specs/Step1-说明.md)：Step 1 实际做了什么、怎么验收、偏差记录
