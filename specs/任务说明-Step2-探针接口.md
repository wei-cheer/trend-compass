# 任务说明：Step 2 加探针状态接口

> 直接转发给写代码的 AI。目标、文件、验收命令都在下面，照着做即可。
> 前置：Step 1 已完成（`api/` 能在 3001 启动，但还没有任何路由）。
> 更新（2026-11-24 12:20）：本步按 M 级走 TDD（red→green），测试用零新依赖方案。提交口径已修正——见文末。

## 工作流：先红后绿，分两次贴回（TDD）

这一步**必须先写一个会失败的测试，跑出红，贴给我确认，再写实现让它转绿**。不要一口气把测试和实现都写完再贴。

- **第 1 次贴回（红）**：只交付测试文件和 test script，贴"失败的运行输出"（应是因为 404 或字段不对而失败）。我确认红得对，才放行下一步。
- **第 2 次贴回（绿）**：写实现，贴 curl 返回体 + git 输出。

> 为什么要先红：先看到测试因为「接口不存在」而失败，才能证明这个测试真的在测那个接口。直接写实现再补测试，测试可能写错了一直是绿的，等于没测。

## 一句话目标

给后端加一个**探针接口** `GET /api/probe/status`，返回 `{"state":"online","checkedAt":"<ISO时间>"}`。

> 名词当场解释：**探针接口**就是一个"报平安"的假接口——不查数据库、不接信息源，只回一句"我活着，时间是 X"。它的作用是让前端和后续的监控逻辑有个能测通的目标。真正的数据接口后面才做。

## 硬性约束（必须遵守，否则验收不通过）

1. **只在 `I:\apps\trend-compass` 里写文件**，不要碰 `I:\apps\yupi-hot-monitor`（只读参考）。
2. **命名独立原创**：路由文件放 `api/src/modules/probe/router.ts`，接口路径 `/api/probe/status`，**不要**照搬参考项目的 `/api/health`。
3. **字段名是 `state`，不是 `status`**——外层对象里有 `state`，别写成 `{"status":"online"}`。这是最容易写串的地方。
4. **本步只做这一个接口**：不加 CORS、不加数据库、不加 AI、不接信息源。CORS 留到 Step 4 联调时再做。
5. 时间用 `new Date().toISOString()`，例如 `2026-11-24T03:50:00.000Z`。
6. 提交信息固定为 `feat(api): add probe status endpoint`。
7. **测试零新依赖**：用 Node 内置 `node:test` + 已有的 `tsx`，**不要**安装 vitest / supertest / jest 等任何新包（规范第 13 条红线，代码 AI 不得自行加依赖）。
8. **本步只提交代码**：不要推送（push），推送由方案 AI 统一做；也不要动 `specs/` 下的文档。

## 要改 / 新增的文件

| 文件 | 动作 | 阶段 | 内容要点 |
| --- | --- | --- | --- |
| `api/tests/probe-status.test.ts` | 新增 | 红 | 用 `node:test` + `node:assert/strict`；起一个临时端口的 app 实例（别用 3001，会和 dev 冲突）；`fetch('/api/probe/status')` 断言：HTTP 200、`state === 'online'`、`checkedAt` 能被 `Date.parse` 解析、**不含 `status` 字段**。跑完关闭 server |
| `api/package.json` | 修改 | 红 | 加一行 `"test": "node --import tsx --test tests/*.test.ts"`（Node 22 用 `--import tsx` 加载 TS）。只加这一行，不动其他字段 |
| `api/src/modules/probe/router.ts` | 新增 | 绿 | 用 `express.Router()`；定义 `GET /status`，返回 `res.json({ state: 'online', checkedAt: new Date().toISOString() })`；导出 router |
| `api/src/main.ts` | 修改 | 红（可测性改造） | **把 `app` 导出**（`export default app`），并把 `app.listen(...)` 包进"仅直接运行时执行"的判断（`import.meta.url === pathToFileURL(process.argv[1]).href`）；启动日志原样保留。不这么做，测试 `import app` 会报 `does not provide an export named 'default'`，红就不对 |
| `api/src/main.ts` | 修改（同一文件） | 绿 | 导入 probe router，用 `app.use('/api/probe', probeRouter)` 挂载。**保留**红阶段的可测性改造和启动日志 |

挂载前缀是 `/api/probe`，路由内部是 `/status`，拼起来才是 `/api/probe/status`。别把前缀写成 `/api/probe/status` 又在路由里再写 `/status`（会变成 `/api/probe/status/status`）。

**测试起实例的坑**：`main.ts` 现在一 import 就 `listen(3001)`，测试直接 import 会占用端口。所以**红阶段就要**把 `app` 抽出来导出，并让"直接运行时才 listen"（判断 `import.meta.url` 是否等于入口）。测试里拿到 `app` 后 `app.listen(0)` 用随机端口，从 `server.address()` 取真实端口再 fetch，跑完 `server.close()`。

**裁决记录（2026-11-24 12:28）**：代码 AI 在红阶段提前做了 `main.ts` 的导出改造，属于必要的可测性改造（否则 import 报错、红不对），未加路由未改端口——**方案 AI 已验收通过，不必回退**。原任务说明把导出归到绿阶段是划分失误，已修正到上表红阶段。

## 验收命令

**红阶段**（写完测试就跑，此时还没有实现）：

```bash
cd /i/apps/trend-compass/api
npm test
```

**看到什么算对**：测试**失败**，失败原因是接口还不存在（404）或取不到字段。这就是"红得对"。若测试竟然通过，说明测试写错了，别往下走。

**绿阶段**（写完实现再跑，两个都要过）：

```bash
cd /i/apps/trend-compass/api
npm test                              # 全绿
npm run dev                           # 另开终端起服务
curl http://localhost:3001/api/probe/status
```

**看到什么算对**：`npm test` 全绿；curl 返回体是 JSON，包含 `"state":"online"` 和一个 ISO 时间字符串，例如：

```json
{"state":"online","checkedAt":"2026-11-24T03:50:00.000Z"}
```

**常见失败**：
- 测试阶段起服务报端口占用 → `app.listen(0)` 用随机端口，别写死 3001
- 返回 404 → 前缀和路由拼错了，检查 `app.use('/api/probe', ...)` 和 router 里的 `/status`
- 返回 `{"status":"online"}` → 字段名写串了，改成 `state`

## 提交（只提交，不推送）

```bash
cd /i/apps/trend-compass
git status              # 会看到 api/ 下的代码改动 + 两份未跟踪的 specs/ 文档
git add api/src api/tests api/package.json
git commit -m "feat(api): add probe status endpoint"
git log -1 --oneline    # 应显示 feat(api): add probe status endpoint
```

**注意**：`git status` 里若出现 `specs/任务说明-Step2-探针接口.md` 和 `specs/开发路线说明.md` 两份未跟踪文档，**不要 add 它们**（那是方案 AI 的文档，由我处理）。也不要 `git push`——推送统一由我做。

## 交付要求

- **第 1 次贴回（红）**：`npm test` 的失败输出（证明接口不存在时测试会红）。
- **第 2 次贴回（绿）**：① `npm test` 全绿的输出；② `curl http://localhost:3001/api/probe/status` 的完整返回体；③ `git log -1 --oneline` 的输出。

**本步做完就停**，不要提前加 CORS 或写前端。等我验收后再给 Step 3 任务。
