# Step 8 说明：关键词与热点匹配（Match + 前端命中标记）

> 验收日期：2026-11-25 · 关联：`specs/任务说明-Step8-关键词匹配.md`
> 「多源聚合」切片第三步。**关键词与热点两个已有模块第一次真正连起来**——从"能配置"到"有用"。

## 1. 这一步做了什么

后端新增 `POST /api/beacon-match`：从 `beaconSources` 注册表抓真实 HackerNews 热点、从 `activeStore` 读启用中的关键词，经纯函数 `matchBeacons(beacons, terms)` 做大小写不敏感子串匹配，返回每条热点命中了哪些词。前端把命中结果按 `beaconId` 合并进热点卡片，有命中的显示金色「命中：xxx」标记。

命名原创：`BeaconMatch` / `/api/beacon-match` / `api/src/modules/beaconmatch/`。零新依赖、不调 AI、不做中文分词——参考仓库的 AI 语义打分留给 Step 9。

**核心是纯函数**：`matchBeacons()` 不 fetch、不读文件、不读全局状态，测试直接喂假数据，完全离线。接口运行时才从真实模块取数，两条链路分离。

## 2. 改了 / 新增了哪些文件

代码 AI 提交 `5362a9c feat(api): add keyword-beacon matching (step8)`，9 个文件 +224/-1：

| 文件 | 动作 |
| --- | --- |
| `api/src/modules/beaconmatch/types.ts` | 新增 · `BeaconMatch { beaconId, matchedTerms }` |
| `api/src/modules/beaconmatch/matcher.ts` | 新增 · 纯函数 `matchBeacons`：只取启用词、大小写不敏感子串、保留词原文、无命中保留空数组 |
| `api/src/modules/beaconmatch/router.ts` | 新增 · POST 取 `collectBeacons()` + `activeStore.list()` → 匹配 → `{ matches, fetchedAt }` |
| `api/src/main.ts` | 修改 · 挂载 `/api/beacon-match`；**未动** CORS 与 express.json()（Step 7 已就位） |
| `api/tests/beacon-match.test.ts` | 新增 · 纯函数单测：大小写不敏感、一词多命中、停用词不参与、中文对中文标题命中、无命中保留空数组 |
| `api/tests/beacon-match-contract.test.ts` | 新增 · 假 source + 临时 store 双注入，POST 契约 |
| `web/src/App.tsx` | 修改 · 新增 `BEACON_MATCH_URL` fetch + `matchTags` state，按 beaconId 合并「命中：xxx」标记；失败静默不影响热点列表 |
| `web/src/index.css` | 修改 · `.beacon-match-tag` 金色标记样式（沿用令牌） |
| `web/tests/beacon-match-tag.test.tsx` | 新增 · 回归锁（写完即绿，非红测试，见 §4） |

## 3. 怎么验收的（方案 AI 逐项实跑）

**红阶段**：方案 AI 复跑 `npm test` → `tests 12 / pass 9 / fail 3`，3 条红全是 `ERR_ASSERTION`（POST 501、匹配结果空、中文命中空），无模块加载错。逐文件核对：纯函数测试把大小写不敏感、停用词排除、中文通用性都锁了；契约测试两个注入点（`beaconSources.length=0; push(fakeSource)` + `setWatchTermStore(临时store)`）照抄无误；占位是真占位。没动 `main.ts`/前端、没提交、没碰真实数据文件。→ 放行绿阶段。

**绿阶段自动化测试**：方案 AI 复跑 `api npm test` → **12/12 全绿**、`npm run build` → 退出码 0；带代理起后端后复跑 `web npm test` → **7/7 全绿**、`npm run build` → 退出码 0。

**curl 真抓实测（方案 AI 亲自跑，带代理 29290）**：
1. 临时加英文演示词 `AI` → POST 返回 201 + term
2. `POST /api/beacon-match` → HTTP 200，真抓 10 条，`fetchedAt` 可解析，每条都有 `matchedTerms` 数组，其中 3 条命中 `AI`（`hn-50641476` / `hn-50641464` / `hn-50641420`）
3. 删演示词 → HTTP 204
4. `GET /api/watch-terms` → 只剩"率土之滨"、`isActive: false`；**磁盘数据文件 `api/data/watch-terms.json` 与验收前备份逐字节一致** ✓

**浏览器实测（代码 AI 落盘截图，方案 AI 亲自查看确认）**：截图 `specs/验收截图-Step8.jpg`（173 KB）。墨黑底 + 烫金标题未变、探针 online、"烽火 · 热点列表"下 10 张卡片，其中 4 张带金色「命中：AI」标记（xAI Founders / Using AI to optimize / Do inconsistent does hurt AI coding agents / Claude Code vs. Gato AI Translations）、关键词区仍在、Console 无报错。

> 截图时间点说明：截图拍于**删演示词之前**（那时 AI 词启用中，才能看到命中标记）；curl 实测第 3/4 步随后删掉演示词并逐字节核对恢复。两件事不矛盾——截图是"功能生效时"的证据，数据文件是"验收后已复原"的证据。

## 4. 踩到的坑 / 偏差

1. **方案 AI 的任务说明把 web 测试误列为"红"（代码 AI 指出，已认并更正）**：`beacon-match-tag.test.tsx` 只断言 Step 6 已有的 `beacon-board` 和标题，结构上没改，**写完即绿**，根本造不出红。代码 AI 主动说明"它明确表示不会为了凑红造假断言"——这个诚实值得记。已更正任务说明：文件表标为"绿（回归锁，非红）"、红阶段说明去掉这条、基线改为 9 条绿。**教训：写 TDD 任务说明时，"这条测试能不能真红"要按断言对象判断，不能因为它涉及新功能就默认列进红阶段。**

2. **中英文天然不匹配的现实**（任务说明已写进"必读"）：中文词配 HackerNews 英文标题必然 0 命中，这是数据源现实不是 bug。本步用英文演示词 `AI` 验证链路，中国词等中文源接入后才有意义。严禁为"让中文词命中"现在就引 AI 匹配——那是 Step 9。

3. **代理端口再次漂移**：环境变量这次是 `61518`（不可用），`29290` 到 GitHub 和 HackerNews 均 200，用它起后端。端口每次现场测这条规则继续有效。

4. **数据文件保护做到位**：这是本步唯一会动到用户个人配置的地方。代码 AI 验完删词、方案 AI 独立复测也删词并逐字节比对，确认"率土之滨 + isActive false"原样保留，演示词零残留。

## 5. 下一步是什么

多源聚合切片继续。路线文档后续：AI 审核（真假识别 + 相关性打分）→ 定时任务 → 通知 → Agent Skills。本步只做了纯文本匹配，"AI 识别假内容"是需求规格里明确写的、也是参考仓库 `ai.ts` 的核心能力——Step 9 该接上。Step 6 留的技术债（`Promise.all` 无兜底、代理健壮性）仍可在"定时任务"那步一起补。

## 6. Git 状态

代码提交 `5362a9c`，方案文档（Step8 说明 + 任务说明更正 + 路线文档更新 + 验收截图）待方案 AI 提交推送。本地 ahead 1，工作区剩 `specs/` 下三个未入库项。
