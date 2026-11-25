# 任务说明-Step8：关键词与热点匹配（Match + 前端命中标记）

> 直接转发给写代码的 AI。目标、文件、验收命令都在下面，照着做即可。
> 前置：Step 0~7 已完成并验收（页面有真实 HackerNews 热点列表 + 关键词 CRUD + JSON 持久化，测试全绿）。
> 本步按 **M 级走 TDD**（新增 1 个接口 + 纯匹配函数 + 跨端契约），红→绿分两次贴回。
> 本步是「多源聚合」切片第三步：把**已存在的关键词**和**已存在的热点**真正连起来——从"能配置"到"有用"。

## 一句话目标

后端的匹配器拿"启用中的关键词"去比对热点标题，命中就在前端热点卡片上打一个「命中：xxx」标记。你配的词终于开始干活了。

**名词当场解释**：
- **Match（匹配）**：本步把 `WatchTerm`（关键词）+ `Beacon`（热点）配对，产出"这条热点命中了哪些词"。内部叫 `BeaconMatch`、接口叫 `/api/beacon-match`，原创命名，不沿用参考仓库的 `relevance` / `aiRelevance`。
- **纯函数**：给定相同输入永远给相同输出、无副作用的函数。本步核心匹配逻辑写成纯函数，测试就能完全离线——不用起服务、不用连外网、不用碰真实数据文件。

## 为什么中文词现在匹配不到（必读，别误判为 bug）

当前唯一热点源是 **HackerNews 英文标题**，而你配的词是「率土之滨」这类中文。纯文本匹配对它们**天然 0 命中**——这是数据源现实，不是代码坏了。

所以本步的验收演示：临时加一个**英文启用词**（如 `AI`、`Claude`、`Rust`）验证命中链路是真的。任务结束后**删掉演示词、恢复你的真实配置**（只有"率土之滨"一条、isActive false），不要把演示词留在你的个人数据文件里。中文源是后续 Step 的事。

⚠️ **不要**为了"让中文词命中"现在就引 AI 语义匹配或爬虫——那是 Step 9「AI 审核」和后续中文源接入的范围，本步严禁提前做。

## 硬性约束（必须遵守，否则验收不通过）

1. **只在 `I:\apps\trend-compass` 里写文件**，不要碰 `I:\apps\yupi-hot-monitor`（只读参考）。
2. **命名独立原创**：结构 `BeaconMatch`、接口 `/api/beacon-match`、源文件放 `api/src/modules/beaconmatch/`。**不要**用参考项目的 `relevance` / `aiRelevance` / `hotspots` 命名或依赖。
3. **零新依赖**：`api/package.json`、`web/package.json` 的 `dependencies` **一个都不加**。匹配就是字符串 `includes`，不装分词库、不调 AI、不装任何包。规范第 13 条红线继续生效。
4. **核心匹配逻辑写成纯函数**：`matchBeacons(beacons, terms)` 不 fetch、不读文件、不读全局状态——输入什么就返回什么。测试直接喂假数据，完全离线。
5. **接口从真实模块取数据，但测试用注入**：`POST /api/beacon-match` 运行时从 `beaconSources` 注册表抓真实热点、从 `activeStore` 读真实关键词；测试里沿用 Step 6/7 的注入手法（`beaconSources.length=0; push(fakeSource)` + `setWatchTermStore(临时store)`），**全程不连外网、不碰真实数据文件**。
6. **CORS 与 body 解析已就位，不用改**：Step 7 已把 `main.ts` 的 `Allow-Methods` 扩成 `GET,POST,PATCH,DELETE,OPTIONS`、已加 `express.json()`。本步的 POST 直接复用，不要再动这两处。
7. **自动化测试全部离线**：见约束 4/5。**不连外网、不碰 `api/data/watch-terms.json`、不抓 HackerNews**——外网只在最后浏览器实测时真抓一次。
8. **只提交不推送**（push 由方案 AI 统一做）；**不要 add `specs/` 文档**，也不要 add `api/data/*.json`。
9. 提交信息固定为 `feat(api): add keyword-beacon matching (step8)`。
10. **本步不做**：不做 AI 相关性打分 / 真假审核、不做通知、不做定时任务、不做查询扩展、不做中文分词、不做独立匹配页面。只做"启用词 vs 热点标题的文本匹配 + 前端命中标记"。

## 数据结构与接口（正确值来源，别自己猜）

**匹配结果 `BeaconMatch`**：

```ts
{
  beaconId: string,      // 原 Beacon.id，如 'hn-50638932'
  matchedTerms: string[], // 命中的关键词文本数组，如 ['AI', 'Claude']；无命中是 []
}
```

**接口**（1 个）：

| 方法 | 路径 | 请求体 | 成功 | 失败 |
| --- | --- | --- | --- | --- |
| POST | `/api/beacon-match` | —（无请求体） | 200 `{ matches: BeaconMatch[], fetchedAt: string }` | 500 抓取失败时（沿用现有错误处理） |

**匹配规则（写死，别自由发挥）**：
- 只看 `isActive === true` 的关键词，停用的不参与匹配。
- 对 `Beacon.title` 做**大小写不敏感**的子串匹配：`title.toLowerCase().includes(term.toLowerCase())`。
- 关键词文本在存的时候已 `trim`，本步直接用 `term.text`，不要再改。
- `matchedTerms` 里放命中的关键词**原文**（`term.text`，不是小写化后的值）。
- 无命中的热点也要返回（放 `matchedTerms: []`）——前端要能区分"抓到了但没命中"和"没抓到"。
- `fetchedAt` 是 `new Date().toISOString()`。

**纯函数签名**（测试直接 import 它）：

```ts
export function matchBeacons(beacons: Beacon[], terms: WatchTerm[]): BeaconMatch[]
```

**运行时数据流**：`POST /api/beacon-match` → `collectBeacons()`（从 `beaconSources` 抓，Step 6 已有）→ 从 `activeStore.list()` 取词（Step 7 已有）→ `matchBeacons()` → 返回。

## 要改 / 新增的文件

| 文件 | 动作 | 阶段 | 内容要点 |
| --- | --- | --- | --- |
| `api/tests/beacon-match.test.ts` | 新增 | 红 | 纯函数单测：大小写不敏感、多词命中、停用词不参与、无命中返回空数组但保留条目、中文词对中文标题也能命中（证明函数本身通用） |
| `api/tests/beacon-match-contract.test.ts` | 新增 | 红 | 起 `app.listen(0)`，注入假 source（`beaconSources`）+ 临时 store，POST 断言 200 + `matches` 结构 + 命中词正确 + `fetchedAt` 可解析；测完关 server 清临时目录 |
| `api/src/modules/beaconmatch/types.ts` | 新增 | 红（占位） | `BeaconMatch` interface 定义 |
| `api/src/modules/beaconmatch/matcher.ts` | 新增 | 红（占位）→绿 | 红阶段导出 `matchBeacons` 空实现（返回 `[]`），让测试能 import 并因断言失败而红 |
| `api/src/modules/beaconmatch/router.ts` | 新增 | 红（占位路由）→绿 | 红阶段 POST 返回 501，让契约测试红在"状态码不对"而非 404 |
| `api/src/main.ts` | 修改 | 绿 | 挂载 `app.use('/api/beacon-match', beaconMatchRouter)`；保留 probe/beacons/watch-terms 挂载、**不要动 CORS 和 express.json()** |
| `web/src/App.tsx` | 修改 | 绿 | 保留探针 / 热点列表 / 关键词区 / 全部水墨 className；新增 fetch `http://localhost:3001/api/beacon-match`，把 `matches` 按 `beaconId` 合并到已渲染的热点卡片；有命中的卡片显示「命中：xxx」标记（class 钩子 `beacon-match-tag`），无命中不显示 |
| `web/src/index.css` | 修改 | 绿 | 新增 `.beacon-match-tag` 样式，沿用令牌（`--gold` 强调 / `--paper` 底 / `--ink-line` 边框），禁蓝紫渐变 |
| `web/tests/beacon-match-tag.test.tsx` | 新增 | 绿（回归锁，非红） | `renderToString(<App />)` 断言容器结构仍完整（`beacon-board` + "烽火 · 热点列表"标题在）；**只测结构不测标记**——SSR 不执行 useEffect，标记是数据到达后才渲染的，测不到就用浏览器截图验。⚠️ 这条**写完即绿**（断言的结构 Step 6 就有），不是红测试，只是防止绿阶段改造时把热点区改坏的回归锁 |

**红阶段"占位"是允许的**：让红因是"断言失败"（expected 1, got 0 / expected 200, got 501）而不是 `Cannot find module`。这和 Step 6/7 的空壳同一性质，方案 AI 验收红阶段时会放行。

**两个注入点的确切写法**（Step 6/7 已验证可用，照抄别改）：
```ts
// 假热点源注入
beaconSources.length = 0
beaconSources.push(fakeSource)   // fakeSource: { name: 'fake', collect: async () => [...] }

// 临时 store 注入
setWatchTermStore(createWatchTermStore(join(tempDir, 'watch-terms.json')))
```
`node --test` 各测试文件独立进程，文件间不共享状态，不会互相污染。

**前端 fetch 地址**（跟 Step 4 的坑一样）：必须写完整 `http://localhost:3001/api/beacon-match`，**不要**写相对路径——Vite 不代理到 3001，相对路径会打到 5173 然后 404。

## 验收命令（red → green 两次贴回）

**阶段一 · 红（贴给我确认后才准写实现）**：只新增 2 个 api 测试文件（`beacon-match` / `beacon-match-contract`）+ types.ts 占位 + matcher/router 空壳，**不要**写真实匹配、不要动 `main.ts`、不要碰前端。

> 更正（2026-11-25，代码 AI 指出）：`web/tests/beacon-match-tag.test.tsx` 原被列进"红阶段"，但它只断言 Step 6 已有的结构，**写完即绿**，不是红测试。它作为回归锁在绿阶段写即可，不用硬造红。web 测试红阶段不用跑。

```bash
cd /i/apps/trend-compass/api && npm test
```

期望红阶段结果：**pass 9 / fail 2~3**——（代码 AI 实测基线是 9 条绿：probe 1 + beacon-source 2 + beacon-contract 1 + watch-term-store 3 + watch-term-contract 2，Step 7 结束时的全绿状态）
- 以上 9 条**本来就该绿**，是基线
- `beacon-match` / `beacon-match-contract` 红，红因是断言失败（expected 命中词, got [] / expected 200, got 501）

**红因必须是断言失败，不是 `Cannot find module` / TS 编译错**——types.ts / matcher.ts / router.ts 占位必须建好。贴出完整统计和红输出。

> 验收四要素：①命令 `npm test`（web 另跑）；②期望 pass 9 / fail 2~3；③正确值来源 = 本文 §数据结构与接口；④失败长什么样 = expected 命中/200 vs 实际 []/501。

**阶段二 · 绿（我放行后再做）**：填真实匹配 + 路由 + 前端标记，然后：

```bash
# 终端 A：起后端（本步要真抓 HackerNews，必须带代理！见下方代理说明）
cd /i/apps/trend-compass/api && NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:<当场实测端口> npm run dev
# 终端 B：测试 + 构建
cd /i/apps/trend-compass/api && npm test          # 全绿，纯离线
cd /i/apps/trend-compass/api && npm run build     # 退出码 0
cd /i/apps/trend-compass/web && npm test          # 全绿（probe-contract 需 3001 在跑）
cd /i/apps/trend-compass/web && npm run build     # 退出码 0
```

**代理说明（本步唯一要联网的地方）**：Step 6 已验证——Node `fetch` 默认不读代理环境变量，直连 HackerNews 会超时。起后端时必须带 `NODE_USE_ENV_PROXY=1` + 当场可用的 `HTTPS_PROXY` 端口（先 `curl -sS -o /dev/null -w "%{http_code}" -x http://127.0.0.1:<端口> https://github.com` 验端口是否活着，端口每次现场测、不要写死、不要写进 `.env`）。但自动化测试仍然全离线、不带代理也能跑绿——代理只影响浏览器实测那一次真抓。

**接口实测（curl，先临时加英文词再验）**：

```bash
# 1. 临时加一个启用中的英文演示词
curl -s -X POST http://localhost:3001/api/watch-terms -H 'Content-Type: application/json' -d '{"text":"AI","category":"outside"}'
# 2. 调匹配接口
curl -s -X POST http://localhost:3001/api/beacon-match
# 3. 验完删掉演示词（用第 1 步返回的 term.id）
curl -s -o /dev/null -w '%{http_code}' -X DELETE http://localhost:3001/api/watch-terms/<演示词id>
# 4. 确认真实配置已恢复（只剩"率土之滨"一条、isActive false）
curl -s http://localhost:3001/api/watch-terms
```
PowerShell 用 `$env:NODE_USE_ENV_PROXY='1'; $env:HTTPS_PROXY='http://127.0.0.1:<端口>'; npm run dev` 起后端。

**看到什么算对**：第 2 步返回 200 + `matches` 数组，其中至少一条的 `matchedTerms` 含 `AI`（HackerNews 标题里 AI 很常见）；`fetchedAt` 是可解析 ISO 时间；第 4 步确认你的原始配置已恢复，**演示词没留下**。

**浏览器实测（必须做，贴截图落盘到 `specs/验收截图-Step8.jpg`）**：前端 5173 + 带代理的后端 3001 都起，打开 `http://localhost:5173`：
- [ ] 热点卡片上出现「命中：AI」标记（英文演示词生效时），金色系、水墨风格未破
- [ ] 未命中的卡片没有标记（区分"抓到但没命中"和"没抓到"）
- [ ] 探针 online、关键词区仍在、三国水墨整体未破
- [ ] Console 无报错（尤其无 CORS 错）
- [ ] **验完删掉演示词、刷新页面确认标记消失、真实配置未被动过**

**常见失败**：
- 匹配接口总返回空 → 你用的是中文词配英文 HackerNews，改用英文演示词验证（见上方必读）
- 测试报 `Cannot find module` → 红阶段占位没建全
- 契约测试注入无效 → 忘了 `beaconSources.length = 0` 就 push，或 `setWatchTermStore` 没调到
- 浏览器报 CORS → 检查 `main.ts` 的 `Allow-Methods` 是否含 POST（Step 7 应已就位，别覆盖回去）
- 热点列表本身空/加载失败 → 起后端没带代理，Node fetch 超时（见代理说明）
- 演示词留在数据文件里 → 违反约束 8，必须删掉恢复原状

## 提交（只提交，不推送）

```bash
cd /i/apps/trend-compass
git status              # 确认只有 api/src api/tests web/src web/tests 的改动
git add api/src api/tests web/src web/tests
git commit -m "feat(api): add keyword-beacon matching (step8)"
git log -1 --oneline
```

**注意**：`git status` 里若出现 `specs/` 文档或 `api/data/*.json`，**都不要 add**。也不要 `git push`。

## 交付要求（分两次）

**第一次（红）**：`api npm test` 的失败输出（红在断言值，不是加载错）。我确认后放行绿阶段。

**第二次（绿）**：六项——
1. `api npm test` 全绿 + `api npm run build` 退出码 0
2. `web npm test` 全绿 + `web npm run build` 退出码 0
3. curl 实测输出：加英文词 → 匹配接口返回命中 → 删词 → 确认原始配置恢复
4. **浏览器截图落盘到 `specs/验收截图-Step8.jpg`**（热点卡片有「命中：AI」标记 + 水墨未破），不要 add / 不要提交，由我验收后统一提交
5. `git status` 确认无 specs 文档、无 `api/data/*.json` 混入
6. `git log -1 --oneline`

**本步做完就停**，不要开始 AI 审核 / 通知 / 定时任务。等我验收后再定下一步。
