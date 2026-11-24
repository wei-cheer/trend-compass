# Step 2 说明：加探针状态接口

> 所属方案：`specs/实施方案-最小可运行骨架.md` · 完成时间：2026-11-24 12:30 · 状态：✅ 完成（走 TDD red→green，含 1 处阶段偏差已裁决）

## 1. 这一步做了什么

给后端加了探针接口 `GET /api/probe/status`，返回 `{"state":"online","checkedAt":"<ISO时间>"}`。按 M 级走 TDD：先写失败测试跑出红（404），方案 AI 验收红之后才写实现转绿。同时把 `main.ts` 的 `app` 导出、"仅直接运行时 listen" 的可测性改造提前到红阶段——否则测试 import 不到 app，红就不是 404 而是 import 报错。

## 2. 改了 / 新增了哪些文件

| 文件路径 | 动作 | 一句话说明 |
| --- | --- | --- |
| `api/src/modules/probe/router.ts` | 新增 | `express.Router()` 定义 `GET /status`，返回 `state`/`checkedAt`，导出 router |
| `api/src/main.ts` | 修改 | 导入并挂载 `app.use('/api/probe', probeRouter)`；导出 `app`；`listen` 包进入口判断（保留启动日志） |
| `api/tests/probe-status.test.ts` | 新增 | node:test 测试，`app.listen(0)` 随机端口 fetch，四条断言（200 / state / checkedAt 可解析 / 无 status 字段） |
| `api/package.json` | 修改 | 加 `"test": "node --import tsx --test tests/*.test.ts"`，零新依赖 |

提交：`f8ff9ff feat(api): add probe status endpoint`

## 3. 怎么验收的（方案 AI 实跑，不是采信代码 AI 自述）

**红阶段**（实现前）：
- 实跑 `npm test` → `not ok 1`、`404 !== 200`、`fail 1`。红因是"接口不存在 → 404"，红得对，放行绿阶段。

**绿阶段**（实现后，方案 AI 逐项实跑）：
- `npm test` → `ok 1`、`pass 1 / fail 0`。
- `npm run build` → 退出码 0。
- `npm run dev` → 控制台 `trend-compass api listening on 3001`。
- `curl http://localhost:3001/api/probe/status` → `{"state":"online","checkedAt":"2026-11-24T04:36:11.093Z"}`；重复调用 checkedAt 从 `.093Z` 变 `.210Z`，确认每次调用都取当前时间；`grep '"status"'` 无匹配，字段名无写串。
- 验证后关闭服务，3001 端口已释放。
- 结果：✅ 通过

## 4. 踩到的坑 / 和计划的偏差

1. **TDD 口径打架（已裁决）**：`开发路线说明.md` §5 原把 Step 2 归 S 级不强制 TDD，但规范第 3 条定义"新增/修改接口 = M 级要 TDD"。代码 AI 发现矛盾后未擅改、上报。方案 AI 拍板：**Step 2 按 M 级走 TDD**，冲突时以"是否涉及接口契约"为准（字段名写串 curl 看不出来，前端联调才崩，符合"看一眼发现不了就先写测试"）。
2. **测试框架零依赖**：用 Node 内置 `node:test` + 已有 `tsx`，不装 vitest/supertest，未撞规范第 13 条"代码 AI 不得自行加依赖"红线。
3. **阶段偏差（已裁决，不必回退）**：代码 AI 在红阶段提前做了 `main.ts` 的 `export default app` + `listen` 入口判断。这是必要可测性改造（否则 import 报错、红不对），未加路由未改端口。根因是任务说明原把"导出 app"错划到绿阶段，已修正为红阶段并记录（提交 `24accd7`）。
4. **提交推送**：代码 AI 只提交不推送（符合分工）；方案 AI 的文档提交与代码提交一起待推，当前本地 `ahead 4`。

## 5. 下一步是什么（给 Step 3 的衔接）

Step 3 建前端工程骨架（`web/`，Vite + React + TypeScript，5173 端口）。按 `开发路线说明.md` §5 属 M 级，**要走 TDD**（先写一个会失败的渲染断言）。

给 Step 3 的提醒：
- 前端 fetch 要写完整 `http://localhost:3001/api/probe/status`，不要写相对路径（Vite dev 不代理到 3001）
- Step 4 联调才加 CORS，本步别提前加
- 后端已可用，Step 3 的渲染测试可以先不依赖后端，用假数据断言渲染
