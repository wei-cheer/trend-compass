# 任务说明-Step6：接真实信息源（HackerNews + 可插拔数据源抽象层）

> 直接转发给写代码的 AI。目标、文件、验收命令都在下面，照着做即可。
> 前置：Step 0~5 已完成并验收（页面是三国水墨风，探针显示 online，测试全绿）。
> 本步按 **M 级走 TDD**（新增接口 + 跨端契约 + 数据源抽象），红→绿分两次贴回。
> 本步是「多源聚合」切片的**第一步**：先打通一条真实链路，并为后续插入 B站/微博/官方更新留好插槽。

## 一句话目标

后端真正从外网抓一次 HackerNews 热点，归一化后经 `GET /api/beacons` 返回，前端页面把热点列表渲染出来；同时把"数据源"做成**可插拔接口**，以后加新源只写一个文件、注册一行，不改路由和前端。

**名词当场解释**：
- **数据源抽象层**：定义一个所有信息源都要遵守的接口（`BeaconSource`），HackerNews 只是它的第一个实现。以后 B站、微博、游戏官网各写一个实现，插入到注册表即可——这就是你说的"多个信息来源聚合"的架构底座。
- **归一化**：把各源五花八门的原始字段，统一成我们自己的 `Beacon` 结构。HackerNews 用 `score` 表示热度、微博用转发数、官网没有热度——对外都变成同一个 `score` 字段，前端就不用关心数据来自哪。

## 硬性约束（必须遵守，否则验收不通过）

1. **只在 `I:\apps\trend-compass` 里写文件**，不要碰 `I:\apps\yupi-hot-monitor`（只读参考）。
2. **命名独立原创，不沿用参考仓库**：本项目的统一结构叫 **`Beacon`（烽火/信标）**，接口路径是 **`/api/beacons`**，源文件放 `api/src/modules/beacon/`。**不要**用参考项目的 `Hotspot`、`/api/hotspots`、`services/search.ts` 等命名。
3. **零新依赖**：`api/package.json`、`web/package.json` 的 `dependencies` **一个都不加**。不装 axios / cheerio / node-fetch / rss-parser。抓取用 Node 22 内置 `fetch`，解析用 `response.json()`（HackerNews 有官方 JSON API，不需要爬虫和 HTML 解析）。规范第 13 条红线继续生效。
4. **字段名严格按本文 §「数据结构」写**，尤其 `publishedAt` 是 ISO 字符串、`score` 是数字、`id` 带 `hn-` 前缀——写串了前端和测试都会红。
5. **外网代理坑（本步最大的坑，必读）**：本机 Node 22 的 `fetch` **默认不读代理环境变量**，直连外网会失败。正确姿势：起后端时**在进程命令行临时带两个环境变量** `NODE_USE_ENV_PROXY=1` + `HTTPS_PROXY=<当场实测活着的端口>`。**不要**把代理写进 `.env` 或启动脚本——代理端口会漂移，写进配置文件会造成配置腐化（代码 AI 2026-11-25 实测：用户级/机器级 `HTTPS_PROXY` 都是空，说明里写死的端口不会被持久化）。端口以你当场实测为准：`curl -sS -o /dev/null -w "%{http_code}" https://hacker-news.firebaseio.com/v0/newstories.json`（直连 200 就不需要代理；需要时代理端口现场用 `echo $HTTPS_PROXY` 或系统代理设置确认）。**只要进程级设置，不落任何配置文件**。起后端的命令示例（端口换成你实测的）：
   - Git Bash：`NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:<端口> npm run dev`
   - PowerShell：`$env:NODE_USE_ENV_PROXY=1; $env:HTTPS_PROXY='http://127.0.0.1:<端口>'; npm run dev`
   - **贴回实际用的完整命令**供方案 AI 复现验收。若报 `fetch failed`，先用 `curl -x $HTTPS_PROXY ...` 验代理本身是否活着。
6. **自动化测试全部离线**：测试里**绝不直连外网**（注入假 fetch / 假 source），保证稳定可复现。真实外网只在最后的"浏览器实测"里验证一次。这是本步的设计红线。
7. **只提交不推送**（push 由方案 AI 统一做）；**不要 add `specs/` 文档**。
8. 提交信息固定为 `feat(api): add beacon source aggregation (step6)`。
9. **本步不做**：不做关键词管理、不做 AI 审核、不做定时任务、不做通知、不接数据库、不做自定义风格切换。只打通"抓取→归一化→接口→列表"这一条链。

## 数据结构（正确值来源，别自己猜）

统一结构 `Beacon`（前端后端同名同字段）：

```ts
{
  id: string,          // 'hn-50638932'，格式 `${source}-${原始id}`
  title: string,       // 标题原文，如 'Décor brings back fun widgets to the Mac'
  url: string,         // 原文链接；无 url 时回退 'https://news.ycombinator.com/item?id=' + 原始id
  source: string,      // 固定 'hackernews'
  score: number,       // 热度分，取原始 score，缺失时 0
  publishedAt: string, // new Date(raw.time * 1000).toISOString() —— raw.time 是 Unix 秒，不是毫秒
}
```

HackerNews 官方 API（已实测，字段确凿）：
- 取 id 列表：`GET https://hacker-news.firebaseio.com/v0/newstories.json` → 数组，实测 500 个数字 id
- 取单条：`GET https://hacker-news.firebaseio.com/v0/item/<id>.json` → 对象，实测字段：
  ```json
  { "by": "omsta", "descendants": 0, "id": 50638932, "score": 1, "time": 1795585157, "title": "Décor brings back fun widgets to the Mac", "type": "story", "url": "https://stgm.github.io/decor/" }
  ```
- **只取前 10 条**（`ids.slice(0, 10)`），不要全抓 500 条——会慢到测试超时。
- 过滤：只保留 `type === 'story'` 且有 `title` 的条目。

## 要改 / 新增的文件

| 文件 | 动作 | 阶段 | 内容要点 |
| --- | --- | --- | --- |
| `api/tests/beacon-source.test.ts` | 新增 | 红 | 两条断言：① `normalizeHackerNewsItem(假item)` 输出字段全对；② `createHackerNewsSource(假fetch).collect()` 返回 ≤10 条且字段齐全。假 fetch 按 URL 返回上面那段真实结构的 JSON，**不碰外网** |
| `api/tests/beacon-contract.test.ts` | 新增 | 红 | 起 `app.listen(0)` 随机端口；向 `collectBeacons` 注入 1 个假 source，fetch `/api/beacons`，断言 200、`beacons` 是数组、`fetchedAt` 可被 `Date.parse` 解析。跑完 `server.close()` |
| `api/src/modules/beacon/types.ts` | 新增 | 红（占位） | 只放 `Beacon`、`BeaconSource` 两个 interface 定义 |
| `api/src/modules/beacon/sources/hackernews.ts` | 新增 | 红（占位）→绿 | 红阶段两个导出函数**存在但返回空**（`normalize...` 返回 `{} as Beacon`、`collect` 返回 `[]`），让测试能加载并因断言失败而红；绿阶段填真实实现 |
| `api/src/modules/beacon/registry.ts` | 新增 | 红（空壳）→绿 | 红阶段只导出 `beaconSources: BeaconSource[] = []` 和可被调用的 `collectBeacons`（空实现），让契约测试能 import；绿阶段数组里注册 `createHackerNewsSource()`，路由每次请求读数组，`collectBeacons` 遍历 `Promise.all`、`flat()`、按 `score` 降序。测试里可 `beaconSources.length = 0; beaconSources.push(fakeSource)` 注入假源（各测试文件独立进程，不互相污染） |
| `api/src/modules/beacon/router.ts` | 新增 | 红（占位路由）→绿 | 红阶段 `router.get('/', ...)` 返回 501 占位，让契约测试红在"数据结构不对"而非 404；绿阶段返回 `{ beacons, fetchedAt }` |
| `api/src/main.ts` | 修改 | 绿 | `app.use('/api/beacons', beaconRouter)`，保留现有 probe 挂载和 CORS 中间件 |
| `web/src/App.tsx` | 修改 | 绿 | 保留探针状态、标题、三国水墨全部 className 与逻辑；新增 `useEffect` fetch `http://localhost:3001/api/beacons`，`useState` 存列表，渲染 `<section className="beacon-board">`，每条 `<article className="beacon-card">` |
| `web/tests/beacon-list.test.tsx` | 新增 | 红 | `renderToString(<App />)` 断言输出含 `beacon-board` 容器和加载态文字（SSR 不执行 useEffect，测不到数据行，只测容器钩子） |

**关键代码骨架（照这个写，别自己发明架构）**：

```ts
// types.ts
export interface Beacon {
  id: string; title: string; url: string;
  source: string; score: number; publishedAt: string;
}
export interface BeaconSource {
  name: string;
  collect(): Promise<Beacon[]>;
}
```

```ts
// sources/hackernews.ts —— fetchFn 可注入是离线测试的关键
export function createHackerNewsSource(fetchFn: typeof fetch = globalThis.fetch): BeaconSource {
  return {
    name: 'hackernews',
    async collect() {
      const ids: number[] = await fetchFn('https://hacker-news.firebaseio.com/v0/newstories.json')
        .then(r => r.json());
      const items = await Promise.all(ids.slice(0, 10).map(id =>
        fetchFn(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json())
      ));
      return items
        .filter((it: any) => it?.type === 'story' && it.title)
        .map(normalizeHackerNewsItem);
    },
  };
}
```

**红阶段"占位"是允许的**，别跳过：Step 2 的红阶段也做过必要的可测性改造（`app` 导出）。这里占位是为了让红因是"断言失败"（expected 10, got 0）而不是 `Cannot find module`——后者证明不了测试在测对的东西。占位不算写实现，方案 AI 验收红阶段时会放行。

**前端列表样式**：沿用现有三国水墨令牌（`--paper` 正文、`--gold` 强调、`--ink-line` 边框），不要引新样式库、不要蓝紫渐变。此步只要求"能看出是个列表"，精细排版留后续。

## 验收命令（red → green 两次贴回）

**阶段一 · 红（先做，贴给我确认后才准写实现）**：只新增两个测试文件 + types.ts 占位 + 三个空壳（normalize 返回空、registry 导出空数组与可被调用的 `collectBeacons`、router 返回 501），**不要**写真实抓取、不要注册 source、不要动前端。

```bash
cd /i/apps/trend-compass/api
npm test
```

期望红阶段结果：**pass 1 / fail 2~3**——
- `probe-status.test.ts`（Step 2 已有）**本来就该绿**，这条绿是正常基线，不是异常
- `beacon-source`：期望拿到归一化字段，实际 `{}` / `[]`（红）
- `beacon-contract`：期望 200 + `beacons` 数组，实际 501 占位（红）

**红因必须是断言失败，不是 `Cannot find module` / TS 编译错**——所以 registry.ts 空壳在红阶段必须建好。贴出完整测试统计和两条红输出给我。

> 验收四要素对照：①命令 = `npm test`；②期望结果 = 1 绿 2 红或 2 红；③正确值来源 = 上面 §「数据结构」的实测字段；④失败长什么样 = expected 字段/数组 vs 实际空值/501。

**阶段二 · 绿（我放行后再做）**：填真实抓取 + 注册表 + 路由 + 前端列表，然后：

```bash
# 终端 A：起后端（进程级临时带代理变量，端口以当场实测为准；不写 .env / 不改 package.json）
# 先看直连通不通：curl -sS -o /dev/null -w "%{http_code}" https://hacker-news.firebaseio.com/v0/newstories.json
# 若直连 200 则无需代理；否则带上：NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:<实测端口>
cd /i/apps/trend-compass/api && NODE_USE_ENV_PROXY=1 npm run dev
# 终端 B：离线测试 + 构建（不需要外网）
cd /i/apps/trend-compass/api && npm test
cd /i/apps/trend-compass/api && npm run build
# 终端 C：验证真实外网契约（后端起来了再跑，这条会真去抓 HackerNews）
curl -s http://localhost:3001/api/beacons | head -c 600
```

**看到什么算对**：
- `npm test` 全绿（3 个测试文件都过，含前端渲染测试要另起前端测试命令 `cd web && npm test`，此时**无需**起 3001——`beacon-list` 只做 SSR 结构断言，但 `probe-contract` 仍要 3001 在跑，所以两个终端都留着）
- `npm run build` 退出码 0
- curl 返回体形如（字段齐全、`id` 带 `hn-`、`publishedAt` 是 ISO）：
  ```json
  {"beacons":[{"id":"hn-50638932","title":"Décor brings back...","url":"https://stgm.github.io/decor/","source":"hackernews","score":1,"publishedAt":"2026-11-25T..."}],"fetchedAt":"2026-11-25T..."}
  ```
- curl 首抓约 1~3 秒（10 条并发请求），属正常；超过 15 秒说明代理没生效或抓了全量 id

**浏览器实测（必须做，贴截图）**：前端 5173 + 后端 3001（带代理）都起，打开 `http://localhost:5173`：

```bash
cd /i/apps/trend-compass/web && npm run dev
```

逐条确认：
- [ ] 页面出现热点列表，能看到真实英文标题 + 来源 `hackernews` + 热度分 + 时间
- [ ] 三国水墨风格没被破坏（墨黑底、烫金标题、状态卡边框还在）
- [ ] Console 无报错（尤其无 CORS 错——CORS 中间件 Step 4 已加，`/api/beacons` 同域走 3001 同样放行）
- [ ] 探针状态仍显示 online（本步不能改坏 Step 4 成果）

**常见失败**：
- curl 返回 `{"beacons":[]}` 或后端日志 `fetch failed` → 代理没生效。确认起后端命令带 `NODE_USE_ENV_PROXY=1`，且 `HTTPS_PROXY` 端口活着（用上面的 curl -x 验证）
- 测试报 `Cannot find module './sources/hackernews.js'` → 红阶段占位文件没建或路径大小写不对
- 契约测试红在 404 → 挂载前缀写错，应是 `app.use('/api/beacons', beaconRouter)` + router 里 `router.get('/', ...)`
- 时间字段错（`NaN` 或 1970 年）→ `raw.time` 是 Unix **秒**，必须 `* 1000` 再 `new Date()`
- 抓了 500 条导致超时 → 忘了 `ids.slice(0, 10)`
- 前端列表不显示但接口有数据 → 前端 fetch 地址写成相对路径了，必须写完整 `http://localhost:3001/api/beacons`

## 提交（只提交，不推送）

```bash
cd /i/apps/trend-compass
git status              # 确认只改了 api/src、api/tests、web/src/App.tsx、web/tests
git add api/src api/tests web/src web/tests
git commit -m "feat(api): add beacon source aggregation (step6)"
git log -1 --oneline
```

若 `git status` 出现 `specs/` 下的未跟踪文档，**不要 add**（方案 AI 处理）。也不要 `git push`。

## 交付要求（分两次）

**第一次（红）**：`api npm test` 的失败输出（证明红在断言值不对，不是加载错）。我确认红得对 → 放行绿阶段。

**第二次（绿）**：五项——
1. `api npm test` 全绿输出（3 文件）
2. `api npm run build` 退出码 0
3. `curl -s http://localhost:3001/api/beacons | head -c 600` 的返回体（看到真实 HackerNews 标题）
4. 浏览器截图（列表渲染 + 水墨风格未破坏 + Console 无错）
5. `git log -1 --oneline` 输出

**本步做完就停**，不要开始关键词管理、AI 审核、定时任务或通知——那是后续 Step。等我验收后再定下一步。
