# 任务说明-Step7：关键词管理（WatchTerm CRUD + JSON 持久化）

> 直接转发给写代码的 AI。目标、文件、验收命令都在下面，照着做即可。
> 前置：Step 0~6 已完成并验收（页面有真实 HackerNews 热点列表，测试全绿）。
> 本步按 **M 级走 TDD**（新增 4 个接口 + 存储层 + 跨端契约），红→绿分两次贴回。
> 本步是「多源聚合」切片第二步：让用户能配置"要盯哪些词"，为后续关键词匹配 / AI 审核打基础。

## 一句话目标

用户能在页面上**增删监控词、切换启用状态、选分类**（官方更新 / 其他游戏 / 圈外热点），数据存到项目内 JSON 文件里，重启服务不丢。

**名词当场解释**：
- **WatchTerm（观察词）**：就是你说的"要监控的关键词"。内部叫 WatchTerm、接口叫 `/api/watch-terms`，是为了不沿用参考仓库的 `Keyword` / `/api/keywords`（项目原创要求）；**页面显示仍写"关键词"**，别把内部名暴露给用户。
- **持久化**：数据写进磁盘文件，服务重启后还在。本步用零依赖的 `node:fs` 实现，不引数据库。

## 硬性约束（必须遵守，否则验收不通过）

1. **只在 `I:\apps\trend-compass` 里写文件**，不要碰 `I:\apps\yupi-hot-monitor`（只读参考）。
2. **命名独立原创**：统一结构 `WatchTerm`、接口前缀 `/api/watch-terms`、源文件放 `api/src/modules/watchterm/`。**不要**用参考项目的 `Keyword`、`/api/keywords`、`prisma`、`schema.prisma` 等命名或依赖。
3. **零新依赖**：`api/package.json`、`web/package.json` 的 `dependencies` **一个都不加**。只用 Node 内置 `node:fs`、`node:path`、`node:crypto`（`randomUUID`）。不装 sqlite / lowdb / prisma / uuid 包。规范第 13 条红线继续生效。
4. **数据文件不提交**：关键词是你的个人配置，写进 `.gitignore` 一行 `api/data/*.json`。代码要能在文件不存在时自动创建空库；**不要**把 `api/data/watch-terms.json` 提交或 add。
5. **存储路径必须可注入**（测试红线）：存储模块导出 `createWatchTermStore(filePath)`，所有读写用传入的路径，**不要**在模块里写死 `api/data/watch-terms.json`。测试注入临时目录路径，全程不碰真实数据文件。这是本步能离线测试的前提。
6. **CORS 必须扩展方法（易漏）**：Step 4 的手写 CORS 中间件现在只允许 `GET,OPTIONS`。本步要放行 `POST,DELETE,PATCH`——把 `Access-Control-Allow-Methods` 改成 `GET,POST,PATCH,DELETE,OPTIONS`，`Access-Control-Allow-Headers` 保留 `Content-Type`。前后端不同源（5173 → 3001），漏了这条浏览器会全部 CORS 报错。
7. **`main.ts` 必须加 `express.json()`（易漏）**：Express 5 默认不解析 JSON body，不加这条 POST 的 `req.body` 恒为 `undefined`，所有新增走 400。这是 Express 内置能力，不算新依赖（不违反约束 3）。测试文件里已自行 `app.use(express.json())`，所以这条只在 `main.ts` 需要补——红阶段测试不会替你发现它，浏览器实测才会暴露。
8. **自动化测试全部离线**：存储测试用 `node:os` 临时目录（`mkdtempSync`）+ 传路径；接口测试注入临时 store；页面渲染测试只做 SSR 结构断言。**不碰真实数据文件、不连外网**。
9. **只提交不推送**（push 由方案 AI 统一做）；**不要 add `specs/` 文档**。
10. 提交信息固定为 `feat(api): add watch-term management (step7)`。
11. **本步不做**：不做关键词与热点匹配、不做 AI 审核、不做通知、不做定时任务、不做 update 接口（改词用"删除重建"代替）、不做登录鉴权。只做 CRUD + 前端界面。

## 数据结构（正确值来源，别自己猜）

`WatchTerm`：

```ts
{
  id: string,         // crypto.randomUUID()，如 '3f2a...'
  text: string,       // 关键词文本，trim 后非空，如 '率土之滨'
  category: string,   // 'official' | 'other-game' | 'outside' 三选一
  isActive: boolean,  // 默认 true
  createdAt: string,  // new Date().toISOString()
}
```

磁盘文件 `api/data/watch-terms.json`：

```json
{ "version": 1, "terms": [ /* WatchTerm 数组 */ ] }
```

**接口一览**（4 个，全部在 `/api/watch-terms` 前缀下）：

| 方法 | 路径 | 请求体 | 成功 | 失败 |
| --- | --- | --- | --- | --- |
| GET | `/` | — | 200 `{ terms: [...] }` | — |
| POST | `/` | `{ text, category }` | 201 `{ term }` | 400 参数错 / 409 文本重复 |
| DELETE | `/:id` | — | 204 无响应体 | 404 不存在 |
| PATCH | `/:id/toggle` | — | 200 `{ term }` | 404 不存在 |

**校验规则**：
- `text` 必须是非空字符串，`trim()` 后不能为空 → 否则 400。
- `category` 必须是 `'official' | 'other-game' | 'outside'` 之一 → 否则 400。
- `text` 重复（trim 后精确比较）→ 409，不覆盖原词。
- `list()` 按 `createdAt` **倒序**（最新添加在前）。

**坏文件兜底**：JSON 解析失败或结构不对（不是数组）→ 打一条 `console.warn`，返回空数组，**不要删改用户的原文件**（避免数据丢失）；下次正常写入时再重建结构。

**并发写入**：Node 单线程，用 `writeFileSync` 写临时文件 `${filePath}.tmp` 再 `renameSync` 原子替换，避免半截文件。

## 要改 / 新增的文件

| 文件 | 动作 | 阶段 | 内容要点 |
| --- | --- | --- | --- |
| `api/tests/watch-term-store.test.ts` | 新增 | 红 | 临时目录注入路径，测：首建空库、add 写入、重复 409、list 倒序、remove、toggle、坏文件兜底返回空且文件未被删 |
| `api/tests/watch-term-contract.test.ts` | 新增 | 红 | 起 `app.listen(0)`，注入临时 store，fetch 四条接口断言状态码与字段；测完关 server、清临时目录 |
| `api/src/modules/watchterm/types.ts` | 新增 | 红（占位） | `WatchTerm` interface + `WatchCategory` 联合类型定义 |
| `api/src/modules/watchterm/store.ts` | 新增 | 红（占位）→绿 | 红阶段导出 `createWatchTermStore(filePath)` 空实现（list 返回 `[]`、add 抛错等），让测试能 import 并因断言失败而红 |
| `api/src/modules/watchterm/router.ts` | 新增 | 红（占位路由）→绿 | 红阶段四个方法都返回 501，让契约测试红在"状态码不对"而非 404 |
| `api/src/main.ts` | 修改 | 绿 | 挂载 `app.use('/api/watch-terms', watchTermRouter)`；**加 `app.use(express.json())`**（否则 POST body 全 undefined）；**扩展 CORS 方法**为 `GET,POST,PATCH,DELETE,OPTIONS`；保留 probe/beacons 挂载 |
| `.gitignore` | 修改 | 绿 | 加一行 `api/data/*.json` |
| `web/src/App.tsx` | 修改 | 绿 | 保留探针 / 热点列表 / 全部水墨 className 与逻辑；新增关键词区：输入框 + 分类下拉 + 添加按钮 + 列表（每项显示 text/category、删除按钮、启用开关）；fetch 完整地址 `http://localhost:3001/api/watch-terms`，增删改后重新拉取列表 |
| `web/src/index.css` | 修改 | 绿 | 新增 `.watchterm-board` / `.watchterm-form` / `.watchterm-item` / `.watchterm-item--off` 样式，沿用现有令牌（`--paper` / `--gold` / `--ink-line`），禁态降低透明度 |
| `web/tests/watch-term-list.test.tsx` | 新增 | 红 | `renderToString(<App />)` 断言输出含 `watchterm-board` / `watchterm-form` 容器钩子（SSR 不执行 useEffect，只测结构） |

**红阶段"占位"是允许的**：让红因是"断言失败"（expected 201, got 501 / expected 1, got 0）而不是 `Cannot find module`。这和 Step 6 的 registry 空壳同一性质，方案 AI 验收红阶段时会放行。

**测试注入方式（2026-11-25 裁决，修正原说明的循环依赖错误）**：原说明写"main.ts 里放可替换实例、router 从模块读"是错的——`main.ts` 已经 import router，router 再 import main 会循环依赖。改为**下移一层到 `store.ts`**：

```ts
// store.ts
export let activeStore: WatchTermStore = createWatchTermStore(defaultPath)
export function setWatchTermStore(store: WatchTermStore) { activeStore = store }
```

router **每次请求时**读 `activeStore`（ES module 的 live binding，set 之后自动是新的），**不要**在模块顶层读死。测试里 `setWatchTermStore(createWatchTermStore(临时路径))` 即可注入。效果和原说明一致，但不产生循环依赖。

**store 层怎么表达"重复/不存在"（2026-11-25 裁决，选 P 方案）**：store 不感知 HTTP，用带 `code` 的错误 + 返回值表达，router 负责映射状态码：
- `add()` 遇重复 → `throw Object.assign(new Error('duplicate'), { code: 'DUPLICATE' })` → router 映射 409
- `remove(id)` → 返回 `boolean`（false → 404）
- `toggle(id)` → 返回 `WatchTerm | null`（null → 404）
- `'DUPLICATE'` 等 code 字符串导出为常量，别散落魔法字符串

**不选 Q 方案**（统一返回 `{ ok, reason?, term? }` 永不抛错）：对每个方法都包一层结果对象，对当前阶段的收益撑不起这份仪式感；`assert.throws(..., { code: 'DUPLICATE' })` 是标准断言，更好写更好读。

**前端 fetch 地址**（跟 Step 4 的坑一样）：必须写完整 `http://localhost:3001/api/watch-terms`，**不要**写相对路径——Vite 不代理到 3001，相对路径会打到 5173 然后 404。

## 验收命令（red → green 两次贴回）

**阶段一 · 红（贴给我确认后才准写实现）**：只新增 3 个测试文件 + types.ts 占位 + store/router 空壳，**不要**写真实存储、不要动 `main.ts`、不要碰前端。

```bash
cd /i/apps/trend-compass/api && npm test
```

期望红阶段结果：**pass 4 / fail 4~6**——（代码 AI 实测基线是 4 条绿：probe 1 + beacon-source 2 + beacon-contract 1；我原说明写 3 是按"文件数"误算，已按实测修正）
- `probe-status` / `beacon-source` / `beacon-contract`（Step 2/6 已有）**本来就该绿**，是基线
- `watch-term-store` / `watch-term-contract` / `watch-term-list`（web 测试另跑）红，红因是断言失败（expected 201/1/字段，实际 501/0/undefined）

**红因必须是断言失败，不是 `Cannot find module` / TS 编译错**——types.ts / store.ts / router.ts 占位必须建好。贴出完整统计和红输出。

> 验收四要素：①命令 `npm test`（web 另跑）；②期望 pass 4 / fail 4~6；③正确值来源 = 本文 §数据结构；④失败长什么样 = expected 201/字段 vs 实际 501/空。

**阶段二 · 绿（我放行后再做）**：填真实存储 + 路由 + CORS + 前端，然后：

```bash
# 终端 A：起后端（本步不需要外网，无需代理变量！）
cd /i/apps/trend-compass/api && npm run dev
# 终端 B：测试 + 构建
cd /i/apps/trend-compass/api && npm test          # 全绿
cd /i/apps/trend-compass/api && npm run build     # 退出码 0
cd /i/apps/trend-compass/web && npm test          # 全绿（probe-contract 需 3001 在跑）
cd /i/apps/trend-compass/web && npm run build     # 退出码 0
```

**接口实测（curl，含重复/删除/切换）**：

```bash
curl -s -X POST http://localhost:3001/api/watch-terms -H 'Content-Type: application/json' -d '{"text":"率土之滨","category":"official"}'
curl -s -X POST http://localhost:3001/api/watch-terms -H 'Content-Type: application/json' -d '{"text":"率土之滨","category":"official"}'   # 期望 409
curl -s http://localhost:3001/api/watch-terms
curl -s -o /dev/null -w '%{http_code}' -X PATCH http://localhost:3001/api/watch-terms/<上一步的id>/toggle
curl -s -o /dev/null -w '%{http_code}' -X DELETE http://localhost:3001/api/watch-terms/<id>
```

**看到什么算对**：POST 返回 201 + `term`（id 是 UUID、isActive true）；重复 POST 返回 409；GET 列出数据；PATCH/DELETE 返回 200/204；数据文件 `api/data/watch-terms.json` 生成且已被 gitignore 忽略。

**浏览器实测（必须做，贴截图落盘到 `specs/验收截图-Step7.jpg`）**：前端 5173 + 后端 3001 都起，打开 `http://localhost:5173`：
- [ ] 页面有关键词区：输入框 + 分类下拉 + 添加按钮 + 列表
- [ ] 添加"率土之滨"后列表出现该词；刷新页面后仍在（持久化生效）
- [ ] 点启用开关：禁态样式（透明度降低）生效；再点恢复
- [ ] 删除后列表移除该词
- [ ] 三国水墨风格未破坏（墨黑底 / 烫金标题 / 热点列表还在）
- [ ] Console 无报错（尤其无 CORS 错——本步扩展了 Allow-Methods）

**常见失败**：
- 浏览器报 CORS / `Method POST not allowed` → `Access-Control-Allow-Methods` 没加 POST/PATCH/DELETE
- 测试报 `Cannot find module` → 红阶段占位没建全
- 重启后关键词丢失 → 路径没写对，或 store 用了内存没落盘
- 数据文件被 git status 看到 → `.gitignore` 漏加 `api/data/*.json`
- 刷新后列表空 → 前端 fetch 地址写成相对路径，或漏了"增删改后重新拉取"
- 坏文件测试失败 → 代码把用户的坏文件删了/覆盖了，应只 warn + 返回空数组、不删原文件

## 提交（只提交，不推送）

```bash
cd /i/apps/trend-compass
git status              # 确认只有 api/src api/tests web/src web/tests .gitignore 的改动
git add api/src api/tests web/src web/tests .gitignore
git commit -m "feat(api): add watch-term management (step7)"
git log -1 --oneline
```

**注意**：`git status` 里若出现 `specs/` 文档或 `api/data/watch-terms.json`，**都不要 add**。也不要 `git push`。

## 交付要求（分两次）

**第一次（红）**：`api npm test` 的失败输出（红在断言值，不是加载错）。我确认后放行绿阶段。

**第二次（绿）**：六项——
1. `api npm test` 全绿 + `api npm run build` 退出码 0
2. `web npm test` 全绿 + `web npm run build` 退出码 0
3. curl 四接口实测输出（含 409 重复）
4. **浏览器截图落盘到 `specs/验收截图-Step7.jpg`**（关键词区 + 添加 + 刷新后仍在）
5. `git status` 确认 `api/data/*.json` 被忽略、无 specs 文档混入
6. `git log -1 --oneline`

**本步做完就停**，不要开始关键词匹配 / AI 审核 / 通知。等我验收后再定下一步。
