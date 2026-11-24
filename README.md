# trend-compass（热点罗盘）

面向自媒体创作者的**多源热点聚合平台**。

> 文档快照：2026-11-24 · 当前阶段：**骨架搭建中，后端工程骨架（Step 1）已落地，尚无任何业务接口**
> Step 的权威状态以 `specs/实施方案-最小可运行骨架.md` 第 4 节「分步计划」和第 9 节「执行记录」为准，本文件只是摘要，两者冲突时以方案文档为准。

## 定位

把多个信息来源的热点聚合到一处，供内容创作者筛选、追踪并产出视频与图文内容。项目名、目录结构与接口命名均为独立设计，不沿用参考项目。

## 当前进度

| Step | 这一步做什么 | 状态 | 判断依据 |
| --- | --- | --- | --- |
| Step 0 | 初始化本地 Git、建 GitHub 远端、把 README、`.gitignore`、`specs/` 入库 | ✅ 完成 | 截至 2026-11-24 共 3 条提交（`489191a`、`5c7a7b4`、`830afea`）；`git remote -v` 指向 `https://github.com/strange331/trend-compass.git`；详见方案文档第 9 节 |
| Step 1 | 建后端工程骨架（`api/`，Express + TypeScript，3001 端口） | ✅ 完成 | `npm run dev` 打印 `trend-compass api listening on 3001`；`npm run build` 退出码 0；详见 `specs/Step1-说明.md` |
| Step 2 | 加探针状态接口 `GET /api/probe/status`（探针＝只回报服务是否在线的假接口，不查库） | 待做 | 无任何服务代码 |
| Step 3 | 建前端工程骨架（`web/`，Vite + React + TypeScript，5173 端口） | 待做 | `web/` 目录尚不存在 |
| Step 4 | 前后端联调：页面显示“探针状态：online” | 待做 | 依赖 Step 1~3 |

Step 0 的已知偏差：GitHub 建仓接口返回 `403 Resource not accessible by integration`，远端仓库由用户手动创建，之后推送成功——记录见方案文档第 8、9 节。

## 目录结构

### 现状（仓库里真实存在的东西）

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
└── specs/
    ├── 需求规格.md
    ├── 实施方案-最小可运行骨架.md
    ├── 任务说明-Step1-后端骨架.md
    └── Step1-说明.md
```

### 规划中的完整结构（`web/` 尚未创建）

```text
trend-compass/
├── api/       # 后端服务：Express 5 + TypeScript（已存在）
├── web/       # 前端页面：Vite + React + TypeScript（尚未创建，Step 3）
└── specs/     # 需求与实施方案（已存在）
```

## 技术栈（后端已落地，前端仍为规划）

| 层 | 选型 | 落地状态 | 版本口径 |
| --- | --- | --- | --- |
| 后端 | Express 5 + TypeScript，`tsx watch` 启动 | Step 1 已落地（仅启动入口，无业务接口） | Express 5 要求 Node.js 18 及以上；实际安装版本以 `api/package-lock.json` 为准 |
| 前端 | Vite + React + TypeScript | 未创建 | Vite 要求 Node.js 20.19 及以上或 22.12 及以上 |
| 运行时 | Node.js | 本机已装 v22.12.0 | 恰好满足 Vite 的下限，属边界可用；换机器前先 `node -v` 核对 |
| 端口 | 后端 3001，前端 5173 | 后端已监听 3001；前端未实现 | 通用端口约定，见方案文档第 3 节 |

说明：依赖已锁定在 [api/package-lock.json](api/package-lock.json)，实际版本以该文件为准；`node_modules/`、`dist/`、`.env` 均已被 `.gitignore` 排除，不入库。

## 规划接口（未实现）

| 方法 | 路径 | 期望响应 | 所属 Step |
| --- | --- | --- | --- |
| GET | `/api/probe/status` | `200 {"state":"online","checkedAt":"<ISO 时间>"}` | Step 2 |

注意：返回字段是 `state`，不是 `status`。

## 文档

- [specs/需求规格.md](specs/需求规格.md)：目标用户、核心价值、功能点
- [specs/实施方案-最小可运行骨架.md](specs/实施方案-最小可运行骨架.md)：契约口径、Step 0~4 分步、验收清单、风险与执行记录（**状态的唯一准绳**）
- [specs/任务说明-Step1-后端骨架.md](specs/任务说明-Step1-后端骨架.md)：Step 1 的原始任务说明
- [specs/Step1-说明.md](specs/Step1-说明.md)：Step 1 实际做了什么、怎么验收、偏差记录
