# 任务说明-Step10：定时巡检（双存储模式 + 前端热切换）

> 直接转发给写代码的 AI。目标、文件、验收命令都在下面，照着做即可。
> 前置：Step 0~9 已完成并验收（热点列表 + 关键词 CRUD + 命中标记 + AI 审核 + 模型切换都在，测试全绿）。
> 本步按 **M 级走 TDD**（新增 4 个接口 + 巡检编排 + 双存储 + 定时器），红→绿分两次贴回。
> 本步是「多源聚合」切片第五步：从"打开页面才现抓"升级为"后台定时抓好、打开页面直接看"。

## 一句话目标

后台每 30 分钟自动跑一次「抓热点 → 关键词匹配 → AI 审核」，把一次算齐的结果存成**快照**；前端打开页面只读快照（秒开，且三类数据天然对齐）。存储模式用**前端设置区热切换**：`仅内存` / `仅文件` / `双开`，切换即时生效、不重启。

**名词当场解释**：
- **巡检（Sweep）**：一次完整的"抓 → 匹配 → 审核"流程，只跑一遍，结果打包成一个 `SweepSnapshot`。内部叫 `Sweep`、接口前缀 `/api/sweep`，原创命名，不沿用参考仓库的 `hotspotChecker` / `runHotspotCheck`。
- **快照（Snapshot）**：某一时刻的完整结果对象（`sweptAt` + `beacons` + `matches` + `audits` + `model` + `status`）。一次巡检产出一个，像拍照定格。
- **双存储**：`memory` = 只存最新一份在进程内存（重启清空）；`file` = 只写 `api/data/sweep-history.json` 存历次巡检（重启不丢）；`both` = 内存存最新、文件存历史，各司其职。
- **热切换**：前端选完模式点一下，后端运行时变量立即改变，下一次巡检按新模式写——不改代码、不改 `.env`、不重启。

## 硬性约束（必须遵守，否则验收不通过）

1. **只在 `I:\apps\trend-compass` 里写文件**，不要碰 `I:\apps\yupi-hot-monitor`（只读参考）。
2. **命名独立原创**：模块放 `api/src/modules/sweep/`，接口 `/api/sweep/*`。**不要**用参考项目的 `HotspotChecker` / `runHotspotCheck` / `scheduleHotspotCheck` 命名。
3. **零新依赖**：`api/package.json`、`web/package.json` 的 `dependencies` **一个都不加**。定时器用 Node 内置 `setInterval`，文件读写用内置 `node:fs`，不装 `node-cron` 或任何调度库。判断口诀：要不要 `npm install`？要，就是依赖；不要，就不是。
4. **定时器只在直接运行时启动**：`startSweepScheduler()` 的调用**必须**放在 `api/src/main.ts` 的 `if (import.meta.url === pathToFileURL(process.argv[1]).href)` 块内（跟 `app.listen` 一起）。测试 `import app` 时绝不能触发真抓取或定时器——否则所有测试都会联网、挂死。
5. **启动即跑一次**：直接运行后端时，注册定时器之前先执行一次 `runSweep()`（不 await，失败不阻塞启动）。否则服务刚起来快照是空的，用户要等 30 分钟才有数据。
6. **防重叠**：runner 内部用 `isRunning` 标志，上一次没跑完就跳过新一次触发（定时器 tick 和手动触发都走这个保护）。`finally` 里必须重置标志，否则一次异常后永远不再跑。
7. **模式存内存、重启回默认**：模块级 `let currentMode: SweepMode = 'memory'` + `getSweepMode()` / `setSweepMode()`，与 `watchterm/store.ts` 的 live binding 同构。**不写进 `.env`、不落盘**（这是选项 1 的刻意取舍：热切换但不持久）。router 和 runner 每次读函数，**不要在模块顶层读死**——Step 7 踩过注入失效的坑。
8. **切换不迁移数据**：切到哪边看哪边的历史，不把旧数据搬来搬去。`memory` 模式下 `history` 返回 `[]`；`file` 模式下 `latest` = 文件历史最后一条；`both` 模式下 `latest` = 内存最新、`history` = 文件全部。
9. **文件存储路径可注入**：`createFileSweepStore(filePath)`，默认 `api/data/sweep-history.json`。测试传 `node:os` 临时目录路径，**不碰真实数据文件**。坏文件（JSON 解析失败）只 `console.warn` + 当空历史返回，**不删用户原文件**；下次写入时重建。历史最多保留 **50 条**，超出丢最旧的，防止无限增长。
10. **自动化测试全部离线**：巡检 runner 的依赖（抓热点 / 匹配 / 审核 / 存储 / 定时器）全部注入假的；契约测试注入假 runner + 临时文件 store。**不真抓 HackerNews、不真调硅基流动、不花 token、不需要 key**。真调只在最后浏览器实测那一次。
11. **修 Step 6 技术债（只改这一处）**：`api/src/modules/beacon/registry.ts` 里 `collectBeacons` 的 `Promise.all` 改成 `Promise.allSettled`，过滤掉 rejected，把 fulfilled 的结果 `flat()`。**不改函数签名、不改返回结构**——Step 6/8/9 的既有测试必须保持全绿。这样一处信息源挂了不会让整批 10 条全空，后台巡检才稳。
12. **审核模型**：巡检任务调 `activeAuditClient.audit(title, terms, model)`，`model` 来自 `POST /api/sweep/run` 的可选 body（没有则用 `resolveAuditModel(undefined, process.env.AI_MODEL)` 的默认值），快照里回传本次实际用的 model。**Step 9 的 `/api/beacon-audit` 接口保持原样不动**（它的契约测试还在）。
13. **CORS / body 解析已就位**：Step 7 已扩 `Allow-Methods`（含 POST）、已加 `express.json()`，本步复用，**不要动**。
14. **`.gitignore` 已挡住** `api/data/*.json`（Step 7 加的），确认即可，不用改。
15. **只提交不推送**（push 由方案 AI 统一做）；**不要 add `specs/` 文档、不要 add `api/.env`、不要 add `api/data/*.json`**。
16. 提交信息固定为 `feat(api): add scheduled sweep with hot-swappable storage (step10)`。
17. **本步不做**：不做通知、不做邮件、不做 WebSocket 推送、不做 Agent Skills、不做中文信息源、不做设置持久化（重启回默认是刻意设计）。只做"定时巡检 + 双存储 + 前端热切换 + 快照展示"。

## 数据结构

`SweepMode`：
```ts
export type SweepMode = 'memory' | 'file' | 'both'
```

`SweepSnapshot`：
```ts
{
  sweptAt: string,          // 本次巡检完成时间，ISO 字符串
  beacons: Beacon[],        // 复用 Step 6 的 Beacon 结构
  matches: Array<{ beaconId: string; matchedTerms: string[] }>,  // 复用 Step 8
  audits: BeaconAudit[],    // 复用 Step 9（只含被审的，最多 5 条）
  model: string,            // 本次审核实际用的模型 ID
  status: 'ok' | 'degraded'
}
```

**接口**（4 个，全在 `/api/sweep` 下）：

| 方法 | 路径 | 请求体 | 成功 | 失败 |
| --- | --- | --- | --- | --- |
| GET | `/api/sweep/latest` | — | 200 `{ mode: SweepMode, latest: SweepSnapshot \| null, history: SweepSnapshot[] }` | 不返回 5xx；无快照时 `latest: null` |
| GET | `/api/sweep/settings` | — | 200 `{ mode: SweepMode, intervalMs: number }` | — |
| POST | `/api/sweep/settings` | `{ mode: SweepMode }` | 200 `{ mode: SweepMode }` | 非法 mode → 400 |
| POST | `/api/sweep/run` | `{ model?: string }`（可选） | 200 `{ snapshot: SweepSnapshot }` | 巡检正在跑 → 409 `{ error: 'sweep running' }`；抓热点失败 → 200 + `status: 'degraded'` 的空快照，不 5xx |

> **撞车选 a**：`POST /api/sweep/run` 进来时 router 先读 `activeSweepRunner.isRunning()`，为 true 立刻回 409 + `{ error: 'sweep running' }`，**不调用 run()、不排队、不等待**（契约测试假 runner 的 `isRunning()` 返回 false，另在既有 POST run 用例里补一条 true→409 的断言；测试总数仍是 8）。理由：约束 6 的语义就是跳过新触发，409 能让调用方马上知道"这次没跑"，b 的 `null` 与 `{snapshot}` 类型不符，c 会让请求挂几十秒。定时器 tick 撞车照旧直接跳过，不经过 HTTP。

**intervalMs**：从 `SWEEP_INTERVAL_MS` 环境变量读，默认 `1800000`（30 分钟）；非法值回落默认。前端设置区只读展示，不提供修改（改间隔要改 `.env` 重启，本步不做热改间隔）。

**巡检 runner 签名**（依赖全注入才能离线测）：
```ts
export function createSweepRunner(options: {
  collectBeacons: () => Promise<Beacon[]>        // Step 6 的 collectBeacons
  matchBeacons: (b: Beacon[], t: WatchTerm[]) => Array<{ beaconId: string; matchedTerms: string[] }>  // Step 8
  audit: (title: string, terms: string[], model?: string) => Promise<{ isReal: boolean; reason: string; degraded: boolean }>  // Step 9
  listTerms: () => WatchTerm[]                   // Step 7 的 activeStore.list
  resolveModel: (requested: string | undefined) => string  // Step 9 的 resolveAuditModel 包一层
  getMode: () => SweepMode                       // 读当前模式
  memoryStore: { setLatest(s: SweepSnapshot): void; getLatest(): SweepSnapshot | null }
  fileStore: { append(s: SweepSnapshot): void; list(): SweepSnapshot[] }
}): {
  run(requestedModel?: string): Promise<SweepSnapshot>
  isRunning(): boolean
}
```
> 最多审 5 条命中项（沿用 Step 9 约束），超出的不进 `audits`。逐条 `try/catch`，一条审核失败不影响其余，快照 `status` 标 `degraded`。

**定时器签名**（可注入假 timer 才能离线测）：
```ts
export function startSweepScheduler(options: {
  run: (model?: string) => Promise<unknown>
  intervalMs: number
  setIntervalFn?: typeof setInterval   // 默认全局；测试注入假的
}): () => void   // 返回停止函数
```

**存储签名**：
```ts
export function createMemorySweepStore(): { setLatest(s: SweepSnapshot): void; getLatest(): SweepSnapshot | null }
export function createFileSweepStore(filePath: string): { append(s: SweepSnapshot): void; list(): SweepSnapshot[] }
```

**模块级 live binding（注入面，必做——照抄，别自创）**：约束 7 和契约测试都要求 router 能注入假实例，光有工厂函数不够。`types.ts` 补三个结构类型，`store.ts` 补四个 binding + setter：

```ts
// types.ts：
export interface SweepRunner { run(model?: string): Promise<SweepSnapshot>; isRunning(): boolean }
export interface MemorySweepStore { setLatest(s: SweepSnapshot): void; getLatest(): SweepSnapshot | null }
export interface FileSweepStore { append(s: SweepSnapshot): void; list(): SweepSnapshot[] }

// store.ts：默认值用工厂建好，测试/启动时用 setter 覆盖
export let activeSweepRunner: SweepRunner | null = null
export function setSweepRunner(runner: SweepRunner): void { activeSweepRunner = runner }
export let activeMemoryStore: MemorySweepStore = createMemorySweepStore()
export function setMemoryStore(store: MemorySweepStore): void { activeMemoryStore = store }
export let activeFileStore: FileSweepStore = createFileSweepStore(<默认路径，resolve 写法照 watchterm/store.ts>)
export function setFileStore(store: FileSweepStore): void { activeFileStore = store }
```

router 每次请求读这四个 binding（别在模块顶层读死）；契约测试用 setter 注入假 runner + 临时文件 store；`main.ts` 直接运行块里用真依赖构造 runner 后 `setSweepRunner(...)`。与 `watchterm/store.ts` 的 live binding 同构，Step 7 的注入失效坑不重踩。

## 要改 / 新增的文件

| 文件 | 动作 | 阶段 | 内容要点 |
| --- | --- | --- | --- |
| `api/tests/sweep-store.test.ts` | 新增 | 红 | 测内存 store 的 set/get；测文件 store 用临时路径：append+list、文件不存在建空、坏文件 warn 不删原文件、50 条上限；测 mode 默认 memory + set/get |
| `api/tests/sweep-runner.test.ts` | 新增 | 红 | 注入假 collect/match/audit/terms/stores：断言快照字段齐全 + `sweptAt` 可解析 + model 回传；三种模式各自写入正确（both 两边都写）；一处 collect 失败其余照常（`allSettled` 语义）；`isRunning` 防重叠 + 异常后 finally 重置；定时器注入假 setInterval，断言 intervalMs 正确、callback 调 run |
| `api/tests/sweep-contract.test.ts` | 新增 | 红 | 起 `app.listen(0)`，注入假 runner + 临时文件 store：GET latest 返回 `{mode, latest, history}`；POST settings 切 mode 后 GET 回读变化；非法 mode 400；POST run body 带 model 时假 runner 收到该 model；关 server 清临时目录 |
| `api/src/modules/sweep/types.ts` | 新增 | 红（占位） | `SweepMode` / `SweepSnapshot` interface |
| `api/src/modules/sweep/store.ts` | 新增 | 红（占位）→绿 | 导出 `getSweepMode()` / `setSweepMode()`（唯一命名，不要写成 `setCurrentMode`）+ 上面四个 live binding/setter + `createMemorySweepStore` + `createFileSweepStore` 空实现；绿阶段填真实 |
| `api/src/modules/sweep/runner.ts` | 新增 | 红（占位）→绿 | 导出 `createSweepRunner` + `startSweepScheduler` 空实现 |
| `api/src/modules/sweep/router.ts` | 新增 | 红（占位路由）→绿 | 红阶段 4 个接口全返回 501，绿阶段按上表实现；读 live binding 的 mode/runner，别在模块顶层读死 |
| `api/src/modules/beacon/registry.ts` | 修改 | 绿 | `collectBeacons` 的 `Promise.all` → `allSettled` + 过滤 rejected（约束 11），既有测试保持全绿 |
| `api/src/main.ts` | 修改 | 绿 | 挂载 `app.use('/api/sweep', sweepRouter)`；在直接运行块内加 `void runSweep()` + `startSweepScheduler(...)`；不要动 CORS / express.json() |
| `web/src/App.tsx` | 修改 | 绿 | ①删掉现有 3 个现抓 useEffect（beacons/match/audit），改成一个 `loadSweep()` 读 `GET /api/sweep/latest`，把快照里的 beacons/matches/audits 合并成现有渲染状态（卡片渲染 JSX 基本不动）。②新增巡检设置区：模式下拉（仅内存/仅文件/双开）+ "立即巡检"按钮 + 上次巡检时间 + 双开/文件模式下的历史条数。③模型选择区保留，切换时改调 `POST /api/sweep/run` 带 `{model}` 再 `loadSweep()`。④保留探针/关键词区/全部水墨 className |
| `web/src/index.css` | 修改 | 绿 | 新增 `.sweep-panel` / `.sweep-panel__select` / `.sweep-panel__history` 等样式，沿用令牌（`--paper` / `--gold` / `--ink-line`），禁蓝紫渐变 |
| `web/tests/sweep-panel.test.tsx` | 新增 | 绿（回归锁，写完即绿，非红） | SSR 断言热点容器结构还在；快照数据是数据到达后才渲染，SSR 测不到 → 靠浏览器截图验 |

**红阶段"占位"是允许的**：让红因是"断言失败"而不是 `Cannot find module`。Step 8/9 已验证这条流程可行。

**注入点是本步测试能离线的关键**（照抄，别自创）：
- 假 collect：`async () => [{ id: 'hn-1', title: 'AI news', url: '...', source: 'hackernews', score: 10, publishedAt: '...' }]`
- 假 match：`() => [{ beaconId: 'hn-1', matchedTerms: ['AI'] }]`
- 假 audit：`async () => ({ isReal: true, reason: '相关', degraded: false })`
- 假 store：内存 store 真对象 + 文件 store 传 `mkdtempSync(join(tmpdir(), 'sweep-'))` 下的路径
- 假 timer：`setIntervalFn: ((cb, ms) => { captured = { cb, ms }; return 0 as unknown as NodeJS.Timeout }) as typeof setInterval`
- 契约测试：`setSweepMode('memory')` + `setSweepRunner(假 runner)` + `setFileStore(假/临时文件 store)`（live binding），**不真抓网、不真调 AI**

## 验收命令（red → green 两次贴回）

**阶段一 · 红（贴给我确认后才准写实现）**：只新增 3 个 api 测试文件 + types/store/runner/router 占位，**不要**写真实巡检、不要动 `main.ts` / `registry.ts`、不要碰前端。

```bash
cd /i/apps/trend-compass/api && npm test
```

期望红阶段结果：**pass 17 / fail 6~9**——（Step 9 结束时 api 基线 17 条绿）
- 已有 17 条本来就该绿，是基线
- 新增 3 个测试文件红，红因是断言失败（expected 快照字段/mode 变化/200, got 空/undefined/501）

**红因必须是断言失败，不是 `Cannot find module` / TS 编译错**。贴出完整统计和红输出。

> 验收四要素：①命令 `npm test`；②期望 pass 17 / fail 6~9；③正确值来源 = 本文 §数据结构；④失败长什么样 = expected 字段/200 vs 实际 空/501。

**阶段二 · 绿（我放行后再做）**：填真实实现，然后：

```bash
# 终端 A：起后端（本步要真抓 HN + 真调 AI，必须带代理；key 已填在 api/.env）
cd /i/apps/trend-compass/api && NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:<当场实测端口> npm run dev
# 终端 B：测试 + 构建（自动化测试全离线，不用代理、不用 key）
cd /i/apps/trend-compass/api && npm test          # 全绿
cd /i/apps/trend-compass/api && npm run build     # 退出码 0
cd /i/apps/trend-compass/web && npm test          # 全绿（probe-contract 需 3001 在跑）
cd /i/apps/trend-compass/web && npm run build     # 退出码 0
```

**接口实测（curl，注意代理与证书坑）**：
```bash
# 0. 现场确认代理端口活着（端口以当场实测为准，别写死）
curl -sS -o /dev/null -w '%{http_code}\n' --max-time 12 -x http://127.0.0.1:<端口> https://github.com
# 1. 临时加英文命中词
curl -s -X POST http://localhost:3001/api/watch-terms -H 'Content-Type: application/json' -d '{"text":"AI","category":"outside"}'
# 2. 手动触发一次巡检（真抓 HN + 真调 AI，可能要几十秒）
curl -s --ssl-no-revoke --max-time 120 -X POST http://localhost:3001/api/sweep/run -H 'Content-Type: application/json' -d '{}'
# 3. 读快照（默认 memory 模式，history 应为 []）
curl -s http://localhost:3001/api/sweep/latest
# 4. 热切换到 file 模式，再巡检一次
curl -s -X POST http://localhost:3001/api/sweep/settings -H 'Content-Type: application/json' -d '{"mode":"file"}'
curl -s --ssl-no-revoke --max-time 120 -X POST http://localhost:3001/api/sweep/run -H 'Content-Type: application/json' -d '{}'
curl -s http://localhost:3001/api/sweep/latest   # 这次 history 应有 1 条
# 5. 切到 both，再巡检一次，确认 latest 来自内存、history 来自文件
curl -s -X POST http://localhost:3001/api/sweep/settings -H 'Content-Type: application/json' -d '{"mode":"both"}'
curl -s --ssl-no-revoke --max-time 120 -X POST http://localhost:3001/api/sweep/run -H 'Content-Type: application/json' -d '{}'
curl -s http://localhost:3001/api/sweep/latest   # latest + history 都有
# 6. 验完删演示词，确认 api/data/watch-terms.json 恢复原状
curl -s -o /dev/null -w '%{http_code}' -X DELETE http://localhost:3001/api/watch-terms/<演示词id>
```

**看到什么算对**：第 2 步返回 200 + `snapshot`，`sweptAt` 可解析、`beacons` 10 条、`audits` 有命中项的真实 AI 判定（`degraded: false`）；第 3 步 `mode: memory` + `history: []`；第 4 步切 `file` 后 `history` 有 1 条；第 5 步切 `both` 后 `latest` 和 `history` 都有。**三次巡检的模式变化就是热切换生效的铁证**。若网络/key 失败，快照 `status: 'degraded'` 但接口仍 200 不崩。

**浏览器实测（必须做，截图落盘 `specs/验收截图-Step10.jpg`）**：前后端都起、key 填好，打开 `http://localhost:5173`：
- [ ] 页面打开即显示热点（不再卡在"热点加载中…"等现抓），顶部有"上次巡检：xx:xx"
- [ ] 巡检设置区：模式下拉（仅内存/仅文件/双开）+ "立即巡检"按钮
- [ ] 切换模式后快照展示跟着变：切 `file`/`both` 时显示历史条数，切回 `memory` 历史消失
- [ ] 模型选择区还在，切换模型触发重新巡检后"本次模型"跟着变
- [ ] 命中标记、AI 判定、探针 online、关键词区、全部水墨风格未破
- [ ] Console 无报错
- [ ] 验完删演示词，确认真实配置恢复

**常见失败**：
- 测试真去联网了 → 假依赖没注入成功，或 runner 里写死了真实模块
- 所有测试挂死 → 定时器在模块顶层启动了；必须放进 main.ts 的直接运行块（约束 4）
- 切模式后没生效 → router/runner 在模块顶层读死了 mode；改成每次读 `getSweepMode()`（live binding）
- 一次异常后再也不巡检 → `isRunning` 没在 `finally` 里重置（约束 6）
- 坏 JSON 导致启动崩 → 文件 store 没做解析失败兜底（约束 9）
- 快照三类数据对不上 → 前端没改成从同一份快照读，还在分别调 Step 6/8/9 三个接口（本步要求改成单一数据源）
- curl 报证书错 → 加 `--ssl-no-revoke`；Node fetch 不通 → 带 `NODE_USE_ENV_PROXY=1` + 当场实测端口
- `git status` 出现 `api/data/sweep-history.json` → 不要 add，它应被 gitignore 挡住

## 提交（只提交，不推送）

```bash
cd /i/apps/trend-compass
git status              # 确认只有 api/src api/tests web/src web/tests 的改动
git add api/src api/tests web/src web/tests
git commit -m "feat(api): add scheduled sweep with hot-swappable storage (step10)"
git log -1 --oneline
```

**注意**：`git status` 里若出现 `specs/` 文档、`api/.env`（真实 key）、`api/data/*.json`，**都不要 add**。也不要 `git push`。

## 交付要求（分两次）

**第一次（红）**：`api npm test` 失败输出（红在断言值，不是加载错）。我确认后放行绿阶段。

**第二次（绿）**：六项——
1. `api npm test` 全绿 + `api npm run build` 退出码 0
2. `web npm test` 全绿 + `web npm run build` 退出码 0
3. curl 实测输出（加词 → memory 巡检 → 切 file 巡检 → 切 both 巡检 → 删词恢复）；**不要贴完整 key**
4. **浏览器截图落盘 `specs/验收截图-Step10.jpg`**（快照秒开 + 设置区 + 模式切换后历史变化 + 水墨未破），不要 add / 不要提交
5. `git status` 确认无 specs / 无 `api/.env` / 无 `api/data/*.json` 混入
6. `git log -1 --oneline`

**本步做完就停**，不要开始通知 / 邮件 / Agent Skills。等我验收后再定下一步。
