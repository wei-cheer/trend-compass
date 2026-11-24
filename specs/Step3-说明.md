# Step 3 说明：建前端工程骨架

> 所属方案：`specs/实施方案-最小可运行骨架.md` · 完成时间：2026-11-24 12:45 · 状态：✅ 完成（M 级 TDD red→green）

## 1. 这一步做了什么

在 `I:\apps\trend-compass\web` 从零建了 Vite + React + TypeScript 前端工程，启动在 5173，页面渲染"热点罗盘"标题。按 M 级走 TDD：先写渲染测试跑出红（渲染结果只有占位的"前端骨架待建"），方案 AI 验收红之后才写实现转绿。本步按约定**未连后端、未加 CORS**，留给 Step 4。

## 2. 改了 / 新增了哪些文件

| 文件路径 | 动作 | 一句话说明 |
| --- | --- | --- |
| `web/package.json` | 新增 | name `trend-compass-web`；scripts 含 dev/build/test；依赖 react 19、Vite 8 等 |
| `web/tests/app-render.test.tsx` | 新增 | node:test + `react-dom/server` 的 `renderToString`，用 `React.createElement` 绕开 JSX 配置，断言渲染含"热点罗盘" |
| `web/src/App.tsx` | 新增（红阶段为占位） | 绿阶段改为渲染 `<h1>热点罗盘</h1>` |
| `web/tsconfig.json` | 新增 | 含 `rootDir: "src"`（TS 7 的 TS5011 预防），未触发该错误 |
| `web/vite.config.ts` | 新增 | vite 插件 + port 5173 |
| `web/index.html` | 新增 | `<title>热点罗盘</title>` + `<div id="root">` |
| `web/src/main.tsx` | 新增 | createRoot 渲染 App |
| `.gitignore` | 修改 | 加 `*.tsbuildinfo`（方案 AI 收尾时补，代码 AI 未擅改配置，符合分工） |

提交：`7bfa2bd feat(web): scaffold vite react app`（只含 web/ 下 8 个文件，未推送）。

## 3. 怎么验收的（方案 AI 逐项实跑）

**红阶段**：`npm test` → `not ok 1`，错误 `渲染结果应包含"热点罗盘"，实际输出：<div>前端骨架待建</div>`。失败原因是标题没渲染，不是模块加载错，红得对，放行绿阶段。

**绿阶段**：
- `npm test` → `ok 1`、`pass 1 / fail 0`
- `npm run build` → `tsc -b && vite build` 退出码 0，15 个模块，`dist/index.html` 0.32 kB、`dist/assets/index-*.js` 219.58 kB（gzip 68.63 kB）
- `npm run dev` → Vite v8.3.8 ready，Local `http://localhost:5173/`
- `curl http://localhost:5173/` → `<title>热点罗盘</title>`、`src="/src/main.tsx"` 命中；5173 有进程监听
- 用户浏览器实测 `document.title` 与 `h1.textContent` 均为"热点罗盘"，非白屏
- 验证后关闭服务，5173 端口已释放
- 结果：✅ 通过

## 4. 踩到的坑 / 和计划的偏差

1. **版本偏差（已裁决，非阻塞）**：装到 Vite 8.3.8 + TS 7.0.2。方案 AI 实测 `node -v` = v22.22.2，Vite 8 引擎 `^20.19.0 || >=22.12.0`，满足。任务说明只写引擎下限未锁主版本，属正常解析。
2. **TS5011 预防生效**：任务说明绿阶段前补了 `rootDir: "src"`，代码 AI 照做，未触发 Step 1 踩过的 TS5011。
3. **tsbuildinfo（已处理）**：`tsc -b` 每次生成 `web/tsconfig.tsbuildinfo`，代码 AI 提交前手动剔掉了它、但没擅自改 `.gitignore`（符合"不改配置"分工），上报给方案 AI。方案 AI 在 `.gitignore` 加 `*.tsbuildinfo`，`git check-ignore -v` 验证生效。**该 .gitignore 改动按用户指令暂不提交。**
4. **Node 版本说法不一致**：代码 AI 报 v22.12.0，方案 AI 实测 v22.22.2；两版都满足 Vite 8，不影响。

## 5. 下一步是什么（给 Step 4 的衔接）

Step 4 前后端联调：让页面真正显示"探针状态：online"，从 `GET http://localhost:3001/api/probe/status` 取数据。

给 Step 4 的提醒：
- 前端 fetch 写完整地址 `http://localhost:3001/api/probe/status`，相对路径不会被 Vite 代理
- 跨域：后端要放行 `http://localhost:5173`（可装 `cors` 或手写响应头）；这是 Step 2/3 都刻意没做的
- 后端 3001、前端 5173 都要起来才能联调；验收时两个端口一起验
- 本步涉及跨端契约，按 M 级走 TDD
