# Step 7 说明：关键词管理（本地 JSON 持久化 + CRUD 界面）

> 验收日期：2026-11-25 · 关联：`specs/任务说明-Step7-关键词管理.md`
> 博主场景第一步。第一次能把自己关心的词（率土之滨/官方更新…）**配置进系统且重启不丢**。

## 1. 这一步做了什么

后端新增 `/api/watch-terms` 四个接口（GET 列表 / POST 新增 / DELETE 删除 / PATCH toggle 启停），数据存 `api/data/watch-terms.json`，零新依赖（`node:fs` + `node:crypto.randomUUID`）。前端在三国水墨页面加"关键词 · 监控清单"：输入框 + 分类下拉（官方更新/其他游戏/圈外热点）+ 添加按钮 + 词条列表（启用开关/删除）。

内部命名 `WatchTerm` / `/api/watch-terms`，原创不沿用参考仓库的 `Keyword` / `/api/keywords`。**本步只做 CRUD + 界面**，不做匹配/AI审核/通知（后续 Step）。

## 2. 改了 / 新增了哪些文件

代码 AI 提交 `b692ab3 feat(api): add watch-term management (step7)`，10 个文件 +607/-1：

| 文件 | 动作 |
| --- | --- |
| `api/src/modules/watchterm/types.ts` | 新增 · `WatchTerm` / `WatchCategory`（official/other-game/outside） |
| `api/src/modules/watchterm/store.ts` | 新增 · `createWatchTermStore(filePath)` 真实读写 + `activeStore` live binding + `setWatchTermStore()` 注入点 + `DUPLICATE_CODE` |
| `api/src/modules/watchterm/router.ts` | 新增 · 四接口，状态码映射 200/201/204/400/404/409 |
| `api/src/main.ts` | 修改 · `express.json()` + 挂载 `/api/watch-terms` + CORS 扩 `GET,POST,PATCH,DELETE,OPTIONS` |
| `.gitignore` | 修改 · 加 `api/data/*.json` |
| `api/tests/watch-term-store.test.ts` | 新增 · 临时目录离线测：空库/add/倒序、trim 去重抛 DUPLICATE、坏文件兜底不删原文件 |
| `api/tests/watch-term-contract.test.ts` | 新增 · 临时 store 注入 + 随机端口，四接口状态码全套 |
| `web/src/App.tsx` | 修改 · 关键词区表单 + 列表 + 删除/开关，保留探针、热点、水墨 className |
| `web/src/index.css` | 修改 · `.watchterm-board` / `.watchterm-form` / `.watchterm-item--off` 等（沿用令牌） |
| `web/tests/watch-term-list.test.tsx` | 新增 · SSR 结构断言锁 `watchterm-board` / `watchterm-form` |

## 3. 怎么验收的（方案 AI 逐项实跑）

**红阶段**：方案 AI 复跑 `npm test` → `tests 9 / pass 4 / fail 5`，五条红全是 `ERR_ASSERTION`（GET 501、POST 501、store add undefined、没抛 DUPLICATE、坏文件重建 undefined），无模块加载错。逐文件核对：测试锁住了 trim 去重、DUPLICATE 常量、坏文件"不删原文件且重建可写"、契约全状态码；占位是真占位（add 返回 `{}`、router 全 501）。→ 放行绿阶段。

**绿阶段自动化测试**：方案 AI 复跑 `api npm test` → **9/9 全绿**、`npm run build` → 退出码 0；`web npm test` → **6/6 全绿**、`npm run build` → 退出码 0。

> ⚠️ web 测试有前置条件：其中 2 条是 fetch 契约测试（探针/CORS），**必须先起后端 3001**。方案 AI 第一次在后端停止时复跑，得到 4 绿 2 红（`fetch failed`，假红）；起后端后复跑 6/6。代码 AI 交付时后端开着所以自述 6/6 属实——但"关掉服务后测试变红"是既有测试设计，不是本步代码缺陷。

**curl 四接口实测（方案 AI 亲自跑）**：POST 新增 → 201 + 完整 term；重复 POST → 409 `该关键词已存在`；GET → 200 列出；PATCH toggle → 200 且 `isActive` 由 true 变 false；DELETE → 204 空体；重复 DELETE → 404。测试用的临时词已删除，`api/data/watch-terms.json` 恢复原状（仅"率土之滨"一条、isActive false）。

**浏览器实测（代码 AI 落盘截图，方案 AI 亲自查看确认）**：截图 `specs/验收截图-Step7.jpg`（56 KB）。墨黑底 + 烫金标题未变、探针 online、"关键词 · 监控清单"表单齐全（输入框 + 官方更新下拉 + 添加按钮）、"率土之滨"词条带启用/删除按钮、Console 看不到错误提示。代码 AI 自述"刷新后仍在（持久化生效）、点停用挂 `watchterm-item--off` + opacity 0.55" —— 持久化由上面的 curl 实测（数据落盘）间接佐证，样式开关态由 CSS 代码核对（`watchterm-item--off` 存在）佐证。

## 4. 踩到的坑 / 偏差

1. **文档漏列 `express.json()`**：Express 5 默认不解析 JSON body，不加的话 POST 的 `req.body` 恒为 undefined → 全落 400。代码 AI 绿阶段前主动请示，方案 AI 确认是任务说明漏列，已补进约束第 7 条 + 文件表。**教训：写任务说明时，"新增写接口"要顺手检查 body 解析中间件是否已在位。**

2. **代码 AI 把"文档已要求"误当"超出范围"请示**：它请示的三处里，只有 `express.json()` 是真漏列；CORS 扩方法（约束第 6 条）和 `.gitignore` 加 `api/data/*.json`（约束第 4 条）文档本来就白纸黑字写了。已回复照做即可。**这不是代码问题，是 AI 协作时的边界识别偏差。**

3. **web 测试的后置依赖导致假红**（见 §3）：本步非新增问题（Step 4 就存在）。测试设计上 fetch 契约测试依赖真实后端，关服务后必红。当前流程里记住"跑 web 测试前先起 api"即可，暂不改造测试。

4. **热点列表显示"热点拉取失败"**：代码 AI 截图时没带代理起后端（Step 7 本不需要外网），Node 直连 HackerNews 超时——这是 Step 6 遗留的代理问题，与 Step 7 无关。关键词区和整体风格正常。要一张"热点也在"的完整图，需带可用代理重启后端再拍。

5. **截图工具换了方案**：代码 AI 自带截图工具报 "renderer throttled"，改用本机 Edge headless + 转 JPG 落盘，内容经方案 AI 查看确认有效。**截图确实落在项目内 `specs/验收截图-Step7.jpg`**，不再是 Step 6 那种"只在临时目录口头说看到了"。

## 5. 下一步是什么

多源聚合切片继续。路线文档 §7 后续：关键词与热点匹配 → AI 审核 → 定时任务 → 通知 → Agent Skills。关键词 CRUD 已就位，下一步可以让"配置进来的词"真正参与热点筛选——这是从"配置"到"有用"的关键一跃。Step 6 留的技术债（`Promise.all` 无兜底、代理健壮性）可在"定时任务"那步一起补。

## 6. Git 状态

代码提交 `b692ab3`，方案文档（Step7 说明 + 任务说明 + 路线文档更新 + 验收截图）待方案 AI 提交推送。本地 ahead 1，工作区剩 `specs/` 下三个未入库项。
