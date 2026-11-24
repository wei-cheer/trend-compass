# 任务说明：Step 3 建前端工程骨架

> 直接转发给写代码的 AI。目标、文件、验收命令都在下面，照着做即可。
> 前置：Step 2 已完成（后端探针接口 `GET /api/probe/status` 可用，见 `specs/Step2-说明.md`）。
> 本步按 M 级走 TDD（red→green），分两次贴回，同 Step 2 的节奏。

## 一句话目标

在 `I:\apps\trend-compass\web` 从零建一个 Vite + React + TypeScript 前端工程，启动在 5173，页面显示标题"热点罗盘"。**本步只做骨架和一次渲染测试，不连后端、不加 CORS**——联调是 Step 4。

## 硬性约束（必须遵守，否则验收不通过）

1. **只在 `I:\apps\trend-compass` 里写文件**，不要碰 `I:\apps\yupi-hot-monitor`（只读参考）。
2. **命名独立原创**：目录 `web/`（不是 `client/`），页面标题"热点罗盘"，不沿用参考项目的命名。
3. **测试零新依赖**：沿用后端的 `node:test` 思路。前端渲染测试用 React 自带的 `react-dom/server` 做 `renderToString`，断言输出含"热点罗盘"——**不要**装 vitest / @testing-library / jsdom / jest（规范第 13 条红线）。
4. **本步不连后端**：页面里不要写 fetch，不要显示"探针状态"，那是 Step 4 的事。CORS 也留到 Step 4。
5. 依赖用国内镜像：`npm install --registry=https://registry.npmmirror.com`。
6. **只提交不推送**（push 由方案 AI 统一做）；不要 add `specs/` 下的文档。
7. 提交信息固定为 `feat(web): scaffold vite react app`。
8. **Node 版本**：方案 AI 实测 `node -v` = **v22.22.2**，满足 Vite 8 引擎（`^20.19.0 || >=22.12.0`）。代码 AI 若测到 v22.12.0，以自己 `node -v` 为准，只要 ≥22.12 即可——两版都满足，不是阻塞。
9. **实际解析到 Vite 8 / TypeScript 7**：任务说明写的是引擎下限，未锁主版本，装到 Vite 8.3.8 + TS 7.0.2 属正常。但 **TS 7 有 `TS5011` 坑**（Step 1 踩过）：`tsconfig.json` 必须显式写 `rootDir: "src"`，否则 `npm run build` 报 "common source directory ... must be explicitly set"。绿阶段写 tsconfig 时直接加上，别等报错。

## 工作流：先红后绿，分两次贴回（TDD）

- **第 1 次贴回（红）**：只交付渲染测试文件 + test script，跑出红（因为 App 组件还没写或没渲染出"热点罗盘"），贴失败输出。我确认红得对才放行。
- **第 2 次贴回（绿）**：写实现，贴 `npm test` 全绿 + `npm run dev` 启动 + 浏览器/HTTP 看到的标题，再贴 git 输出。

> 为什么先红：证明这个测试真的在测"页面渲染出标题"这件事，而不是写错了永远绿。

## 要改 / 新增的文件

| 文件 | 动作 | 阶段 | 内容要点 |
| --- | --- | --- | --- |
| `web/package.json` | 新增 | 红 | name 用 `trend-compass-web`；type module；scripts 含 `dev`（`vite`）、`build`（`tsc -b && vite build`）、`test`（`node --import tsx --test tests/*.test.tsx`）；依赖 `react`、`react-dom`；devDeps `vite`、`typescript`、`@vitejs/plugin-react`、`@types/react`、`@types/react-dom`、`tsx` |
| `web/tests/app-render.test.tsx` | 新增 | 红 | 用 `node:test` + `node:assert/strict`；`import { renderToString } from 'react-dom/server'`；`import App from '../src/App'`；断言 `renderToString(<App />)` 的输出包含 `热点罗盘`。**用 .tsx 后缀**，测试里如用 JSX 需确认 tsx 能解析（不确定就贴出来问我，别猜） |
| `web/tsconfig.json` | 新增 | 绿 | JSX `react-jsx`、module ESNext、moduleResolution bundler、strict、**`rootDir: "src"`**（TS 7 的 TS5011，必须显式写） |
| `web/vite.config.ts` | 新增 | 绿 | 用 `defineConfig` + `react()` 插件；`server.port` 设 5173 |
| `web/index.html` | 新增 | 绿 | 标准 Vite 模板，`<div id="root">`，`<script type="module" src="/src/main.tsx">`，`<title>热点罗盘</title>` |
| `web/src/main.tsx` | 新增 | 绿 | `createRoot(document.getElementById('root')!)` 渲染 `<App />` |
| `web/src/App.tsx` | 新增 | 绿 | 导出默认组件，渲染一个含"热点罗盘"标题的页面（简单 `<h1>` 即可，不用样式） |

**JSX 测试的两个坑**（不确定就贴出来问，别猜）：
- 测试文件是 `.tsx`，test script 用 `tests/*.test.tsx` glob 别写成 `.test.ts`
- `tsx` 对 JSX 的编译依赖 tsconfig 的 `jsx` 设置；若 `renderToString(<App />)` 在测试里报 JSX 解析错，可在测试文件里改用 `React.createElement(App)` 绕开 JSX，效果一样

## 验收命令

**红阶段**（写完测试就跑，此时 App 还没渲染出标题）：

```bash
cd /i/apps/trend-compass/web
npm install --registry=https://registry.npmmirror.com
npm test
```

**看到什么算对**：测试**失败**（因为渲染输出里没有"热点罗盘"或 App 不存在）。失败原因是"标题找不到"而不是模块加载报错。若测试竟然通过，说明写错了，别往下走。

**绿阶段**（写完实现再跑）：

```bash
cd /i/apps/trend-compass/web
npm test                    # 全绿
npm run build               # 退出码 0
npm run dev                 # 启动在 5173
curl -s http://localhost:5173/ | grep -o '热点罗盘'   # 应匹配到
```

**看到什么算对**：`npm test` 全绿；`npm run build` 退出码 0；dev 启动后访问 `http://localhost:5173` 页面标题"热点罗盘"可见。

**常见失败**：
- `npm test` 报找不到 `.test.tsx` → glob 写错了，检查 script 里的后缀
- Vite 引擎版本报错 → `node -v` 核对，低于 20.19 或 22.12 要换 Node
- 5173 端口占用 → `netstat -ano | findstr :5173` 查 PID

## 提交（只提交，不推送）

```bash
cd /i/apps/trend-compass
git status              # api/ 无改动；web/ 是新增；specs/ 文档不要 add
git add web
git commit -m "feat(web): scaffold vite react app"
git log -1 --oneline
```

## 交付要求

- **第 1 次贴回（红）**：`npm test` 的失败输出。
- **第 2 次贴回（绿）**：① `npm test` 全绿输出；② `npm run build` 退出码；③ `curl ... | grep 热点罗盘` 的结果或浏览器截图；④ `git log -1 --oneline`。

**本步做完就停**，不要提前连后端、不要加 CORS。等我验收后再给 Step 4 任务。
