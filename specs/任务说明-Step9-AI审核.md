# 任务说明-Step9：AI 审核（真假判定 + 一句话理由 + 动态切换模型，零依赖接硅基流动）

> 直接转发给写代码的 AI。目标、文件、验收命令都在下面，照着做即可。
> 前置：Step 0~8 已完成并验收（热点列表 + 关键词 CRUD + 关键词命中标记都在，测试全绿）。
> 本步按 **M 级走 TDD**（新增 1 个接口 + AI 客户端 + 离线可测的构造/解析纯函数），红→绿分两次贴回。
> 本步是「多源聚合」切片第四步：从"这条热点命中了我的词"升级为"AI 帮我判断它是不是真有价值"。

## 一句话目标

对**命中了关键词**的热点，调硅基流动的 AI 做真假判定（是不是标题党/假内容/营销软文）+ 给一句"跟你的词什么关系"的理由，前端在命中的卡片上显示 AI 判定。**模型可前端动态切换**（预设 + 自定义 ID），换一个模型就重新审核一次，卡片上标出"本次用哪个模型判的"，方便你对比不同模型的结论差异。

**名词当场解释**：
- **审核（Audit）**：本步让 AI 回答两个问题——"这条内容真实有价值吗"（`isReal`）+ "它跟我的关键词什么关系"（`reason`）。内部叫 `BeaconAudit`、接口 `/api/beacon-audit`，原创命名，不沿用参考仓库的 `AIAnalysis` / `aiRelevance`。
- **OpenAI 兼容接口**：硅基流动提供的一种 API 格式，请求/返回跟 OpenAI 一样，所以用 Node 自带 `fetch` 直接发 HTTP 就能调，不用装任何 SDK。这就是本步"零依赖真接"的含义（见 §零依赖澄清）。
- **动态切换模型**：同一次审核，用户可在页面选不同大模型（预设几个常见的 + 手填任意模型 ID），每次切换重新审一遍。因为不同模型的判断可能不一样——这正是你要的价值。模型 ID 通过请求体传给后端，**不写死在 `.env`、不改代码、不重启服务**。

## 零依赖澄清（别误判为要装包）

"零依赖"= **不 `npm install` 任何新包**，`package.json` 的 `dependencies` 一个都不加。

- ✅ 用 Node 22 **自带**的全局 `fetch` 发 HTTP → 不算依赖（Step 6 抓 HackerNews 就是这么干的）
- ❌ 不装 `openai` / `@openrouter/sdk` → 那些是 npm 包，装了就破红线
- 硅基流动是**外部服务**，不是依赖——跟 HackerNews 不是依赖一个道理，只是要 key 才能调

判断口诀：**要不要 `npm install`？要，就是依赖；不要，就不是。**

## 硬性约束（必须遵守，否则验收不通过）

1. **只在 `I:\apps\trend-compass` 里写文件**，不要碰 `I:\apps\yupi-hot-monitor`（只读参考）。
2. **命名独立原创**：结构 `BeaconAudit`、接口 `/api/beacon-audit`、源文件放 `api/src/modules/beaconaudit/`。**不要**用参考项目的 `AIAnalysis` / `analyzeContent` / `aiRelevance` 命名或依赖。
3. **零新依赖**：`api/package.json`、`web/package.json` 的 `dependencies` **一个都不加**。只用 Node 内置 `fetch` / `node:fs`（读 .env 已由 dotenv 负责）。规范第 13 条红线继续生效。
4. **key 从 `process.env` 读，绝不硬编码**：读 `SILICONFLOW_API_KEY`，可选 `AI_BASE_URL`（默认 `https://api.siliconflow.cn/v1`）、`AI_MODEL`（默认 `Qwen/Qwen2.5-7B-Instruct`，官方文档 2026 年仍列它且免费）。**在函数内部读，不要在模块顶层读**——`dotenv.config()` 在 `main.ts` 模块体里执行，子模块顶层代码先跑完，顶层读只会拿到 `undefined`（参考仓库 ai.ts 踩过，注释写得很清楚）。
   - **模型优先级（动态切换的核心）**：`请求体传入的 model` > `AI_MODEL`(.env) > 硬编码默认 `Qwen/Qwen2.5-7B-Instruct`。前端选了模型就传 `model` 字段，后端用它；没传（或空字符串）才回落到 `.env` 默认。**这样切换模型不用改代码、不用重启，纯运行时参数**。
   - **模型 ID 不校验白名单**：允许任意字符串（用户可能填硅基流动上新模型），只做非空 trim。模型不存在时硅基流动会返回错误码 → 走降级（见约束 6），页面不崩。
5. **`.env` 不提交**：真实 key 放 `api/.env`（已被 `.gitignore` 的 `.env.*` 挡住）；只更新 `api/.env.example` 写占位说明（`SILICONFLOW_API_KEY=sk-你的key`、base_url、model 三行）。**不要**把真实 key 写进任何会被 add 的文件，也不要打印到日志/交付输出。
6. **容错降级是硬要求**：没配 key / 调用失败 / 返回解析失败 → **不能让接口 500、不能让页面崩**。降级返回一个 `degraded: true` 的结果（理由写"AI 未配置或调用失败"），前端照常显示。这是本步最容易漏的约束。
7. **自动化测试全部离线**：AI 客户端用**注入的假 fetch**（返回预设响应），构造 prompt / 解析返回 / 降级逻辑都用假数据测，**不真调硅基流动、不花 token、不需要 key**。真调只在最后浏览器实测那一次。
8. **只审命中词的热点**：接口内部复用 Step 8 的 `collectBeacons()` + `matchBeacons()` + `activeStore.list()`，只审 `matchedTerms.length > 0` 的条目；没命中的不调 AI（省 token）。本步最多审 5 条（限制成本），**超过 5 条的命中项不进 `audits`、前端不显示 AI 判定**（没审就不显示，别留空壳）。
9. **结果存内存不落盘**：用模块级数组/Map 缓存最近一次审核结果，重启即失效（AI 判断会过期，没必要持久化）。测试注入方式沿用前面裁决——导出可替换实例 + setter。
10. **联网说明（重要，已实测 2026-11-26）**：真调硅基流动的链路跟 Step 6/8 抓 HackerNews **不完全一样**——本机实测三种情况：
    - 直连 → Windows `CRYPT_E_REVOCATION_OFFLINE`（证书撤销检查失败），不通。
    - 环境变量代理（`HTTPS_PROXY`，端口一直在漂）→ 同样报证书错，不通。
    - **系统代理 `http://127.0.0.1:29290` + curl 加 `--ssl-no-revoke`** → HTTP 200，最小真调成功（key 有效、Qwen2.5-7B-Instruct 可用、回复 OK）。
    所以绿阶段起后端用 `NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:29290 ... npm run dev`；**curl 实测命令必须加 `--ssl-no-revoke`**，否则证书检查失败。端口以当场实测为准（系统代理见注册表 `HKCU\...\Internet Settings` 的 `ProxyServer`），不写死、不进 `.env`。自动化测试离线、不需要代理。
    > 已核验 key 可用（方案 AI 只读验证：非空、`sk-` 开头、未被 git 跟踪、真调 HTTP 200）。
11. **CORS / body 解析已就位**：Step 7 已扩 `Allow-Methods`、已加 `express.json()`，本步复用，**不要动**。
12. **只提交不推送**（push 由方案 AI 统一做）；**不要 add `specs/` 文档、不要 add `api/.env`、不要 add `api/data/*.json`**。
13. 提交信息固定为 `feat(api): add AI beacon audit (step9)`。
14. **本步不做**：不做通知、不做定时任务、不做 AI 查询扩展、不做批量并发审核（一条一条审即可）、不做独立审核页面、不做中文源。只做"对命中热点做真假判定 + 前端显示 + 动态切换模型"。
15. **模型选项清单（已查官方文档 2026-11-26，别自己编 ID）**：预设几个常见模型供下拉选择，至少包含——`Qwen/Qwen2.5-7B-Instruct`（免费默认）、`deepseek-ai/DeepSeek-V3`、`zai-org/GLM-4.6`（免费）。再加一个「自定义」选项：输入框让用户填任意模型 ID。前端提示文案要写明"完整模型名称从硅基流动模型广场复制"（官方原话）。这份清单只作**前端下拉预设**，不设后端白名单（见约束 4）。

## 硅基流动接口（正确值来源，已查官方文档 2026-11-26）

**请求**：
```
POST https://api.siliconflow.cn/v1/chat/completions
Header: Content-Type: application/json
Header: Authorization: Bearer <SILICONFLOW_API_KEY>
Body: {
  "model": "Qwen/Qwen2.5-7B-Instruct",
  "messages": [
    {"role": "system", "content": "<审核指令，要求输出 JSON>"},
    {"role": "user", "content": "<热点标题 + 命中的关键词>"}
  ],
  "temperature": 0.2,
  "max_tokens": 300
}
```

**返回**：AI 文本在 `choices[0].message.content`（是个字符串，里面是 JSON，要解析）。

**错误码**：401 = key 错 / 403 = 需实名认证 / 429 = 限流 / 503/504 = 模型过载。这些都要走降级，不要抛出未捕获异常。

**让 AI 输出的 JSON 结构**（在 system prompt 里写清楚）：
```json
{ "isReal": true, "reason": "一句话说这条内容与关键词的关系" }
```
> 只用两个字段，别照参考仓库搞 relevance/importance/summary 一大套——本步最小切片，贴你"识别假内容 + 知道跟我的词什么关系"的需求。

## 数据结构

`BeaconAudit`：
```ts
{
  beaconId: string,       // 对应 Beacon.id
  matchedTerms: string[], // 命中的词（从 Step 8 结果带过来）
  isReal: boolean,        // AI 判定是否真实有价值
  reason: string,         // 一句话理由
  degraded: boolean,      // true = AI 未配置/失败，用了降级值
}
```

**接口**（1 个）：
| 方法 | 路径 | 请求体 | 成功 | 失败 |
| --- | --- | --- | --- | --- |
| POST | `/api/beacon-audit` | `{ model?: string }`（可选；传了就用该模型审核，不传用 `.env` 默认） | 200 `{ audits: BeaconAudit[], model: string, fetchedAt: string }`（`model` = 本次实际用的模型 ID，回传给前端显示） | 任何异常都降级为 `degraded` 结果，不返回 5xx |

**纯函数签名**（测试直接 import，全离线）：
```ts
export function buildAuditPrompt(title: string, matchedTerms: string[]): { system: string; user: string }
export function parseAuditResponse(raw: string): { isReal: boolean; reason: string } | null  // null = 解析失败，触发降级
```

**AI 客户端签名**（注入 fetch 才能离线测试）：
```ts
export function createAuditClient(options: {
  fetchFn?: typeof fetch         // 默认用全局 fetch；测试注入假 fetch
  getConfig?: () => { apiKey: string; baseUrl: string; model: string }  // 默认从 process.env 读；测试注入假配置
}): {
  // model 可选：传了（非空）优先用它，没传回落到 getConfig().model
  audit(title: string, matchedTerms: string[], model?: string): Promise<{ isReal: boolean; reason: string; degraded: boolean }>
}
```

**模型解析做成纯函数**（方便离线测优先级，别藏在 client 里）：
```ts
// 优先级：requestedModel(trim 后非空) > config.model > 硬编码默认
export function resolveAuditModel(requestedModel: string | undefined, configModel: string | undefined): string
```
> 测试要覆盖：传了 model 用传的、没传用 config、两者都没有用硬编码默认、传空字符串/空白回落默认。这样"动态切换"的核心逻辑离线就能锁住。

## 要改 / 新增的文件

| 文件 | 动作 | 阶段 | 内容要点 |
| --- | --- | --- | --- |
| `api/tests/beacon-audit-prompt.test.ts` | 新增 | 红 | 测 `buildAuditPrompt`：标题和命中词都进 prompt、要求 JSON 输出；测 `parseAuditResponse`：正常 JSON 解析、带 ```json 代码块包裹也能解析、非法 JSON 返回 null；测 `resolveAuditModel`：传 model 用传的 / 没传用 config / 都没有用默认 / 空串回落 |
| `api/tests/beacon-audit-client.test.ts` | 新增 | 红 | 注入假 fetch + 假配置：正常判定、401 走降级、假 fetch 抛错走降级、无 key 走降级（根本不发请求）；**验证传 model 时请求体 `model` 字段是传入值（动态切换真的生效）** |
| `api/tests/beacon-audit-contract.test.ts` | 新增 | 红 | 起 `app.listen(0)`，注入假 source + 临时 store + 假 AI client，POST 断言 200 + `audits` 结构 + `model` 回传 + 只审命中词 + 降级字段；关 server 清临时目录 |
| `api/src/modules/beaconaudit/types.ts` | 新增 | 红（占位） | `BeaconAudit` interface |
| `api/src/modules/beaconaudit/prompt.ts` | 新增 | 红（占位）→绿 | 红阶段导出 `buildAuditPrompt` / `parseAuditResponse` / `resolveAuditModel` 空实现，让测试 import 后因断言失败而红 |
| `api/src/modules/beaconaudit/client.ts` | 新增 | 红（占位）→绿 | 红阶段导出 `createAuditClient` 空实现；绿阶段真发 fetch + 读传来的 model + 降级 |
| `api/src/modules/beaconaudit/store.ts` | 新增 | 红（占位）→绿 | 已裁决补入（原文件表漏列）：导 `activeAuditClient` + `setAuditClient()` + `latestAudits` + `setLatestAudits()`，与 `watchterm/store.ts` 同构。router 每次请求读 live binding，**不要在模块顶层读死**（Step 7 踩过注入失效的坑） |
| `api/src/modules/beaconaudit/router.ts` | 新增 | 红（占位路由）→绿 | 红阶段 POST 返回 501，绿阶段读 `req.body.model` 传给 client、回传实际用的 model |
| `api/src/main.ts` | 修改 | 绿 | 挂载 `app.use('/api/beacon-audit', beaconAuditRouter)`；保留其他挂载；不要动 CORS / express.json() |
| `api/.env.example` | 修改 | 绿 | 加 `SILICONFLOW_API_KEY=sk-你的key`、`AI_BASE_URL=https://api.siliconflow.cn/v1`、`AI_MODEL=Qwen/Qwen2.5-7B-Instruct` 三行及注释；**不要写真实 key**。注明 `AI_MODEL` 只是**默认值**，前端可覆盖 |
| `web/src/App.tsx` | 修改 | 绿 | ①模型选择区：下拉预设（Qwen2.5-7B / DeepSeek-V3 / GLM-4.6）+「自定义」输入框填任意 ID；切换/点"审核"时用选中的 model 发 `AUDIT_URL`（完整地址 `http://localhost:3001/api/beacon-audit`）POST `{model}`。②把 `audits` 按 beaconId 合并，在**有命中标记且已审核**的卡片上显示 AI 判定（真实/存疑 + 理由 + "本次模型：xxx"），沿用命中卡片样式钩子；失败静默不影响列表。③保留探针/关键词区/全部水墨 className |
| `web/src/index.css` | 修改 | 绿 | 新增 `.beacon-audit` / `.beacon-audit--degraded` / 模型选择区样式，沿用令牌（`--paper` / `--gold` / `--ink-line`），禁蓝紫渐变 |
| `web/tests/beacon-audit.test.tsx` | 新增 | 绿（回归锁，写完即绿，非红） | SSR 断言热点容器结构还在；注意 AI 判定和模型标记是数据到达后才渲染，SSR 测不到 → 靠浏览器截图验 |

**红阶段"占位"是允许的**：让红因是"断言失败"而不是 `Cannot find module`。Step 8 已验证这条流程可行。

**双注入点是本步测试能离线的关键**（照抄，别自创）：
- 假 AI 响应：`createAuditClient({ fetchFn: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{"isReal":true,"reason":"..."}' } }] }) }) as Response })`
- 假配置：`getConfig: () => ({ apiKey: 'test-key', baseUrl: 'https://fake', model: 'fake-model' })`
- 假热点/假词源：Step 8 的 `beaconSources.length=0; push(fakeSource)` + `setWatchTermStore(临时store)`
- **动态切换的验证**：client 测试里调用 `audit(title, terms, 'custom-model-x')`，断言假 fetch 收到的请求体 `model === 'custom-model-x'`；再调一次不传 model，断言用的是 config 里的 `fake-model`。这样"切换真的生效"离线就锁住了。

**`dotenv.config()` 时机坑（必看）**：参考仓库 ai.ts 原话——"必须函数内读取 `process.env`，不能模块顶层取值，因为 `main.ts` 里 `dotenv.config()` 在模块体里执行，子模块顶层代码会在它之前跑完，顶层读取只会拿到 undefined"。所以 `createAuditClient` 的默认 `getConfig` 必须是函数内读 env，不能提到模块顶层。

## 验收命令（red → green 两次贴回）

**阶段一 · 红（贴给我确认后才准写实现）**：只新增 3 个 api 测试文件 + types/prompt/client/router 占位，**不要**写真调用、不要动 `main.ts`、不要碰前端和 `.env.example`。

```bash
cd /i/apps/trend-compass/api && npm test
```

期望红阶段结果：**pass 12 / fail 3~5**——（Step 8 结束时 api 基线 12 条绿）
- 已有 12 条本来就该绿，是基线
- 新增 3 个测试文件红，红因是断言失败（expected 段落/字段/200, got 空/null/501）
- 已放行代码 AI 按 **fail 5** 设计：prompt 2 条 + client 2 条 + contract 1 条（在 3~5 范围内，红因仍须是断言失败，不是加载错）

**红因必须是断言失败，不是 `Cannot find module` / TS 编译错**。贴出完整统计和红输出。

> 验收四要素：①命令 `npm test`；②期望 pass 12 / fail 3~5；③正确值来源 = 本文 §硅基流动接口 + §数据结构；④失败长什么样 = expected 字段/200 vs 实际 空/null/501。

**阶段二 · 绿（我放行后再做）**：填真实 prompt/解析/client/路由 + 前端，然后：

```bash
# 终端 A：起后端（本步要真调 AI，必须带代理；key 先填进 api/.env）
cd /i/apps/trend-compass/api && NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:<当场实测端口> npm run dev
# 终端 B：测试 + 构建（自动化测试全离线，不用代理、不用 key）
cd /i/apps/trend-compass/api && npm test          # 全绿
cd /i/apps/trend-compass/api && npm run build     # 退出码 0
cd /i/apps/trend-compass/web && npm test          # 全绿（probe-contract 需 3001 在跑）
cd /i/apps/trend-compass/web && npm run build     # 退出码 0
```

**key 怎么填（你自己做，别让代码 AI 碰真实 key）**：把硅基流动 key 写进 `api/.env` 一行 `SILICONFLOW_API_KEY=sk-xxxx`。文件已被 gitignore，不会进仓库。代码 AI 只负责写读 env 的代码和 `.env.example` 占位，**不接触真实 key**。

**接口实测（curl，key 填好后）**：
```bash
# 1. 临时加英文命中词（如果还没有）
curl -s -X POST http://localhost:3001/api/watch-terms -H 'Content-Type: application/json' -d '{"text":"AI","category":"outside"}'
# 2. 调审核接口（默认模型，真调硅基流动，观察 isReal / reason / 顶层 model 回传）
curl -s --max-time 60 -X POST http://localhost:3001/api/beacon-audit
# 3. 动态切换：传 model 换一个模型重审，确认顶层 model 回传变成了传入值
curl -s --max-time 60 -X POST http://localhost:3001/api/beacon-audit \
  -H 'Content-Type: application/json' \
  -d '{"model":"deepseek-ai/DeepSeek-V3"}'
# 4. 验完删演示词，确认 api/data/watch-terms.json 恢复原状（只剩"率土之滨"、isActive false）
curl -s -o /dev/null -w '%{http_code}' -X DELETE http://localhost:3001/api/watch-terms/<演示词id>
```

**看到什么算对**：第 2 步返回 200 + `audits` + 顶层 `model`（应是默认 `Qwen/Qwen2.5-7B-Instruct`），命中词的热点有 AI 判定（`isReal` 布尔值 + 中文 `reason` 一句话），`degraded` 为 false；第 3 步返回 200 且顶层 `model` 变成 `deepseek-ai/DeepSeek-V3`（证明动态切换生效）。若 key 没填或调用失败，`degraded` 为 true、reason 写降级说明，接口**仍是 200 不崩**。最后一步后真实配置原样恢复。

**浏览器实测（必须做，截图落盘 `specs/验收截图-Step9.jpg`）**：前后端都起、key 填好，打开 `http://localhost:5173`：
- [ ] 命中卡片上出现 AI 判定（真实/存疑 + 一句话理由 + "本次模型：xxx"），金色系、水墨未破
- [ ] 页面有模型选择区：预设下拉（Qwen2.5-7B / DeepSeek-V3 / GLM-4.6）+ 自定义输入框
- [ ] **切换模型（如选 DeepSeek-V3）后重新审核，卡片上的"本次模型"跟着变** —— 这是动态切换的关键证据，截图要能看出换过模型
- [ ] 未命中/未审核的卡片没有 AI 判定
- [ ] 探针 online、关键词区、命中标记都还在
- [ ] Console 无报错
- [ ] 验完删演示词，确认真实配置恢复

**常见失败**：
- 401 / "Invalid token" → key 填错或没填，检查 `api/.env`
- 403 → 账号未实名，硅基流动要求实名才能调部分模型
- 429 → 限流，等一会或在前端换一个模型重审（运行时切换，不用改 `.env`）
- key 读成 undefined → 在模块顶层读了 env；改成函数内读（见坑）
- 换模型后无效果 → 前端没把选中的 model 放进 POST body，或 router 没读 `req.body.model`，或 client 没用它（优先级写错）；按"动态切换的验证"那条测试定位
- 自定义模型报错 400/404 → 模型 ID 不完整或该账号无权限；提示用户去硅基流动模型广场复制完整名称，代码走降级不崩
- AI 返回解析失败 → 模型没按 JSON 输出；检查 system prompt 是否明确要求 JSON，解析失败要降级而不是崩
- 测试真去联网了 → 假 fetch 没注入成功，或 client 里写死了全局 fetch
- 没 key 时接口 500 → 降级没做，违反约束 6

## 提交（只提交，不推送）

```bash
cd /i/apps/trend-compass
git status              # 确认只有 api/src api/tests web/src web/tests 和 api/.env.example 的改动
git add api/src api/tests web/src web/tests api/.env.example
git commit -m "feat(api): add AI beacon audit (step9)"
git log -1 --oneline
```

**注意**：`git status` 里若出现 `specs/` 文档、`api/.env`（真实 key）、`api/data/*.json`，**都不要 add**。也不要 `git push`。

## 交付要求（分两次）

**第一次（红）**：`api npm test` 失败输出（红在断言值，不是加载错）。我确认后放行绿阶段。

**第二次（绿）**：六项——
1. `api npm test` 全绿 + `api npm run build` 退出码 0
2. `web npm test` 全绿 + `web npm run build` 退出码 0
3. curl 实测输出（加词 → 默认模型审核 → 传 model 换模型重审 → 删词 → 配置恢复）；**不要贴完整 key**
4. **浏览器截图落盘 `specs/验收截图-Step9.jpg`**（AI 判定显示 + 模型选择区 + 换模型后"本次模型"变化 + 水墨未破），不要 add / 不要提交
5. `git status` 确认无 specs / 无 `api/.env` / 无 `api/data/*.json` 混入
6. `git log -1 --oneline`

**本步做完就停**，不要开始通知 / 定时任务 / Agent Skills。等我验收后再定下一步。
