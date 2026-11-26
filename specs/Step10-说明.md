# Step 10 说明：定时巡检（双存储模式 + 前端热切换）

> 验收日期：2026-11-26 · 关联：`specs/任务说明-Step10-定时巡检.md`
> 「多源聚合」切片第五步。从"打开页面才现抓"升级为"后台定时抓好、打开页面直接看"，一次巡检算出快照（抓 → 匹配 → 审核），三类数据天然对齐。同时修掉 Step 6 留的 `Promise.all` 技术债。

## 1. 这一步做了什么

后端新增 `api/src/modules/sweep/`：4 个接口（`GET /api/sweep/latest`、`GET|POST /api/sweep/settings`、`POST /api/sweep/run`）、巡检 runner（五依赖全注入）、文件/内存双存储、可注入假 timer 的定时器。启动后端时立刻跑一次巡检，之后每 30 分钟一次；撞车跳过（`isRunning` + `finally` 重置），手动触发撞车回 409。

**三模式热切换**：`memory`（只内存最新一份）/ `file`（只写 `api/data/sweep-history.json`，最多 50 条）/ `both`（内存最新 + 文件历史）。模式存模块级变量、前端下拉即时切换，不落盘、重启回默认。

前端 `App.tsx` 从"三个现抓 useEffect"改成"一个 `loadSweep()` 读快照"——单一数据源，热点/命中/AI 判定不再各抓各的。巡检设置区含模式下拉、"立即巡检"按钮、上次巡检时间、历史条数；模型切换改调 `POST /api/sweep/run` 带 `{model}`。

**Step 6 技术债已还**：`collectBeacons` 的 `Promise.all` → `allSettled` + 过滤 rejected + `flatMap`，一处信息源挂了不再拖垮整批。

## 2. 改了 / 新增了哪些文件

代码 `3fb536a`，12 文件、+927/-67（只包含 `api/src`、`api/tests`、`web/src`、`web/tests`）：

| 文件 | 动作 |
| --- | --- |
| `api/src/modules/sweep/types.ts` | 新增 · `SweepMode` / `SweepSnapshot` + 三个结构类型（`SweepRunner` / `MemorySweepStore` / `FileSweepStore`） |
| `api/src/modules/sweep/store.ts` | 新增 · `getSweepMode/setSweepMode` + 四个 live binding/setter + 内存/文件 store（坏文件兜底、50 条上限） |
| `api/src/modules/sweep/runner.ts` | 新增 · `createSweepRunner`（五依赖注入、最多审 5 条、逐条容错降级）+ `startSweepScheduler` + `resolveSweepIntervalMs`（默认 30 分钟） |
| `api/src/modules/sweep/router.ts` | 新增 · 4 个接口；每次请求读 binding，撞车 409 |
| `api/src/modules/beacon/registry.ts` | 修改 · `Promise.all` → `allSettled` + 过滤 + `flatMap`，签名/返回结构不变 |
| `api/src/main.ts` | 修改 · 挂载 `/api/sweep`；直接运行块内构造 runner + 注入 + 启动即跑一次 + 注册定时器（测试 import 不触发） |
| `api/tests/sweep-{store,runner,contract}.test.ts` | 新增 · 全离线：假 collect/match/audit/store/timer，临时目录，不抓网不调 AI |
| `web/src/App.tsx` | 修改 · 三个 useEffect 合为一个 `loadSweep()`；巡检设置区；模型切换走 `/api/sweep/run`；保留探针/关键词/水墨 className |
| `web/src/index.css` | 修改 · `.sweep-panel` 等样式，沿用令牌 |
| `web/tests/sweep-panel.test.tsx` | 新增 · 回归锁（写完即绿），SSR 测不到数据到达后的快照，靠截图验 |

## 3. 怎么验收的（方案 AI 逐项实跑）

**红阶段**：代码 AI 回报 `tests 25 / pass 17 / fail 8`，8 条全 `ERR_ASSERTION`（contract 2：501 未实现；runner 3：空快照/sweptAt 不可解析、内存未写、isRunning 假；store 3：内存 get 为 null、文件 append 后读 0 条、坏文件未 warn）。方案 AI 现场 `git status` 核实改动范围只有 sweep 模块 + 3 测试，未动 `main.ts`/`registry.ts`/前端、未提交。→ 放行绿阶段。

**绿阶段自动化测试（方案 AI 亲自复跑）**：
- `api npm test` → **25/25 全绿**；`npm run build` → 退出码 0
- `web npm test` → **9/9 全绿**；`vite build` → 退出码 0（web 契约测试需 API 3001 在跑，已起本地服务再跑）
- 既有 17 条 + 新增 8 条全绿，`allSettled` 改造没破坏 Step 6/8/9 的既有断言

**代码核对（方案 AI 逐段看 diff）**：
- `registry.ts`：`allSettled` + `filter(status === 'fulfilled')` + `flatMap`，签名与返回结构未变
- `main.ts`：runner 构造、`setSweepRunner`、`void sweepRunner.run()`、`startSweepScheduler` **全在直接运行块内**，测试 import 不会联网/挂死
- `router.ts`：`getSweepMode()`/`setSweepMode()` 每次请求读，不读死；`isRunning()` → 409；POST run 把 model 透传给 runner

**真调实测（代码 AI 做，方案 AI 复核证据）**：代理端口当场实测 13051（curl 与 node 都 200）；启动即跑一次拿到 10 条真实 HN；临时加词 `Why` 后 memory 巡检 `audits=2`、两条都 `isReal:true / degraded:false` 且理由为中文（`Why` 是当时 HN 标题里的词，沿用 Step 9 的"演示词跟着热点走"手法）。三模式各跑一次巡检，`history` 条数 **0 → 1 → 2**，`latest` 与 `mode` 跟着变——热切换生效的铁证。

**浏览器截图（代码 AI 落盘，方案 AI 打开复核）**：`specs/验收截图-Step10.jpg`（45KB）——顶部探针 online、巡检设置区"烽火台·双开 / 立即巡检 / 上次巡检 xx:16:49 / 历史 2 条"、模型区 Qwen2.5-7B、两条 `命中：Why` 卡片带中文理由与"本次模型"、关键词区 `Why`/`率土之滨`、墨黑底烫金标题未破，Console 0 error。

**收尾核实（方案 AI 亲自查）**：`api/data/watch-terms.json` 只剩"率土之滨"、`isActive:false`（Step 8 原状）；验证产生的 `sweep-history.json` 已删除、未污染；两个 dev server 已停；提交 `3fb536a` 的 12 文件里没有 `specs/`、`api/.env`、`api/data/*.json`。

## 4. 踩到的坑 / 偏差

1. **演示词换 `Why`**：这批 10 条 HN 没有含 `AI` 的标题（代码 AI 核对过），用 `AI` 会 0 命中、截图看不到判定；换 `Why` 命中 2 条，验完已删。与 Step 9 用 `Notetaking` 同理。
2. **红测试期望值改了一处**：`sweep-store` 50 条上限用例，红阶段把第一个保留项算成 27T06:00，按"保留最新 50 条"应为 27T05:00——是测试自己算错，改的是期望值而非让实现迁就测试，**不掩盖真 bug**。
3. **curl 首报 400**：PowerShell 吃掉单引号导致 body 变成 `{mode:file}`，后端正确返回 400；换 `--data-binary` + 临时文件后通过，代码没动。
4. **删了 `api/data/sweep-history.json`**：本步验证产生的文件，已删回原状；`watch-terms.json` 保留（用户真实配置）。

## 5. 下一步是什么

「多源聚合」切片到此五步全通：信息源 → 关键词 → 匹配 → AI 审核 → 定时巡检。路线后续是通知 → Agent Skills。当前三模式"重启回默认"是刻意设计，若要持久化设置留到后续单独一步。

**技术债状态**：Step 6 的 `Promise.all` 已还；Step 9 的 router/client 重复解析模型仍未统一（只在 `.env` 配 `AI_MODEL` 且前端传空白字符串时有风险），下次动审核模块时一并处理。

## 6. Git 状态

代码 AI 已提交 `3fb536a`（只提交未推送）。方案 AI 本次追加本说明 + 更新路线锚点。工作区未提交项：`specs/Step10-说明.md`、`specs/开发路线说明.md`、`specs/任务说明-Step10-定时巡检.md`、`specs/验收截图-Step10.jpg`。**待你确认后再统一提交推送。**

**验收结论：通过**（自动化全绿、三模式真调证据链完整、截图复核无误、收尾干净；四点偏差均属测试/脚本层面，不涉及功能缺陷）。
