# Step 6 说明：接真实信息源（HackerNews + 可插拔数据源抽象层）

> 验收日期：2026-11-25 · 关联：`specs/任务说明-Step6-接真实信息源.md`
> 「多源聚合」切片第一步。页面第一次有了**真实外网数据**（不再是探针假数据）。

## 1. 这一步做了什么

后端新增 `GET /api/beacons`：从 HackerNews 官方 JSON API 抓 `newstories` 前 10 条，归一化成统一的 `Beacon` 结构返回；前端在三国水墨页面上加了"烽火 · 热点列表"，渲染真实标题、来源、热度、时间。

关键架构：**数据源是可插拔的**——`BeaconSource` 接口 + `beaconSources` 注册表。HackerNews 是第一个实现，以后加 B站/微博/官方更新，只需写一个实现文件、在注册表 push 一行，路由和前端都不用改。这就是"多来源聚合"的架构底座。

## 2. 改了 / 新增了哪些文件

代码 AI 提交 `1eef70c feat(api): add beacon source aggregation (step6)`，10 个文件 +319 行：

| 文件 | 动作 |
| --- | --- |
| `api/src/modules/beacon/types.ts` | 新增 · `Beacon` / `BeaconSource` 两个 interface |
| `api/src/modules/beacon/sources/hackernews.ts` | 新增 · `normalizeHackerNewsItem`（id 带 `hn-`、`time*1000`、`url` 缺失回退）+ `createHackerNewsSource(fetchFn)` 抓前 10 条并发取详情 |
| `api/src/modules/beacon/registry.ts` | 新增 · `beaconSources` 数组 + `collectBeacons`（Promise.all + flat + 按 score 降序） |
| `api/src/modules/beacon/router.ts` | 新增 · `GET /` 返回 `{ beacons, fetchedAt }` |
| `api/src/main.ts` | 修改 · 挂载 `/api/beacons` |
| `api/tests/beacon-source.test.ts` | 新增 · 归一化 6 字段 + 假 fetch 抓前 10 条，全离线 |
| `api/tests/beacon-contract.test.ts` | 新增 · 假 source 注入注册表 + 临时端口契约测试 |
| `web/src/App.tsx` | 修改 · 新增 `BEACONS_URL` fetch + 三态（加载/失败/列表），保留探针和水墨 className |
| `web/src/index.css` | 修改 · 新增 `.beacon-board` / `.beacon-card` 系列样式（沿用现有令牌） |
| `web/tests/beacon-list.test.tsx` | 新增 · SSR 结构断言 |

## 3. 怎么验收的（方案 AI 逐项实跑）

**红阶段**：方案 AI 复跑 `npm test` → `tests 4 / pass 1 / fail 3`，三条红全是断言失败（501 占位、id undefined、collect 返回 0），无模块加载错。逐文件核对测试断言：归一化 6 字段都测了，尤其 `Date.parse(publishedAt) === time*1000` 锁住"秒要乘 1000"这个坑；契约测试用 `beaconSources.length=0; push(fakeSource)` 注入，符合裁决 A 方案。→ 放行绿阶段。

**绿阶段自动化测试**：方案 AI 复跑 `api npm test` → **4/4 全绿**；`npm run build` → 退出码 0。

**真实外网验证**：给后端带可用代理（`NODE_USE_ENV_PROXY=1` + `HTTPS_PROXY=http://127.0.0.1:29290`）起服务，`curl /api/beacons` → HTTP 200、10 条、id 全带 `hn-`、`publishedAt` 全可解析。首条标题 `Investigation uncovers influencers paid to promote Nvidia to China`（真实数据）。

**浏览器实测（方案 AI 亲自截图）**：墨黑底 + 烫金标题未变、探针 online、"烽火 · 热点列表"下 4 张卡片可见（共 10 条）、每张有 source/热度/时间、Console 无报错。截图为方案 AI 自己补拍（代码 AI 未落盘，见 §4），已落盘到 `specs/验收截图-Step6.jpg`。验收后关掉前后端，3001/5173 释放，标签交还用户。

**起服务命令（实测留档，端口以现场为准、不写 `.env`）**：

```powershell
# PowerShell（代码 AI 交付的原始命令里 NODE_USE_ENV_PROXY=1' 多了引号，此处已修正）
$env:NODE_USE_ENV_PROXY='1'; $env:HTTPS_PROXY='http://127.0.0.1:<当场实测端口>'; npm run dev
```

```bash
# Git Bash
NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:<当场实测端口> npm run dev
```

代码 AI 现场测 50220 / 29290 都通、取 50220；方案 AI 验收时 50220 已失效、改用 29290。**端口每次现场验，不固化**（用 `curl -sS -o /dev/null -w "%{http_code}" -x http://127.0.0.1:<端口> https://github.com` 验代理本身是否活着）。

## 4. 踩到的坑 / 偏差

1. **代码 AI 的浏览器截图没落盘**：它自述"看到 10 张卡片、Console 0 error"，但截图只在它自己的临时目录（且是 Step 5 旧图）。方案 AI 不采信自述，自己起服务补拍了截图，确认视觉项属实。**教训写进流程：交付截图必须落在项目内可查路径，不能只口头说"看到了"。**

2. **无代理时 Node fetch 静默超时 —— 本步最大的坑**：我第一次起后端没带代理，Node `fetch` 直连 HackerNews 全部 `ConnectTimeoutError`（10s 超时），路由被 `Promise.all` 一个失败拖垮返回 500，前端则卡在"热点加载中…"。注意**我用 curl 测"直连 200"是假象**——curl 会自动读环境变量 `HTTPS_PROXY`（当时是 `http://127.0.0.1:51538`，沙箱每次换端口），而 Node fetch 默认不读代理环境变量。带 `NODE_USE_ENV_PROXY=1` + 当场可用的代理后才稳定。**结论：验证 Node fetch 的外网连通性，必须用 Node 自己测，不能用 curl 代替。**

3. **10 条并发无兜底**：`collectBeacons` 用 `Promise.all`，任一请求失败整批 500。实测网络抖动时出现过一次 500，随后带代理 6 次连续全 200。这是已知技术债（应改 `Promise.allSettled` + 部分失败降级），本步不修，留给后续稳定性切片。

4. **代理命令不固化**：按裁决，代理只在起服务的进程命令行临时带，不写 `.env` 或启动脚本（端口会漂移）。代码 AI 现场测 50220/29290 都通，最终用 50220；方案 AI 验收时 50220 已失效，改用 29290。**再次印证端口不可写死。**

## 5. 下一步是什么

多源聚合切片第二步。路线文档 §7 的后续：关键词管理 → AI 审核 → 定时任务 → 通知 → Agent Skills。每步仍按双 AI 闸门走。本步留的技术债（`Promise.all` 无兜底、代理健壮性）可在"定时任务"那步一起补——那时会从"手动刷新才抓"变成"定时自动抓",稳定性更重要。

## 6. Git 状态

代码提交 `1eef70c`，方案文档提交待办（`specs/Step6-说明.md` + 路线文档更新）。本地 ahead，待推送。
