# Step 4 说明：前后端联调

> 所属方案：`specs/实施方案-最小可运行骨架.md` · 完成时间：2026-11-24 12:57 · 状态：✅ 完成（M 级 TDD red→green）· **最小可运行骨架切片收尾**

## 1. 这一步做了什么

让前端页面真正显示"探针状态：online"——`App.tsx` 用 `useEffect` + `fetch` 从后端 `GET http://localhost:3001/api/probe/status` 取数据、渲染到页面；后端 `main.ts` 手写 CORS 中间件放行 `http://localhost:5173`。至此最小骨架全流程跑通：`/api/probe/status` → 跨域放行 → 前端渲染。

按 M 级走 TDD，但红测试的造法费了点周折：原任务说明让"直接 fetch 真实后端断言 state online"，可这条 Step 2 已实现、天然就绿；`renderToString` 又测不了 `useEffect` 里的 fetch。代码 AI 没有硬凑假红，而是自己设计了三条测试——标题渲染（绿）、数据契约（绿）、**跨域契约（红）**，抓住 Step 4 唯一真缺的 CORS，方案 AI 实跑确认后放行绿阶段。

## 2. 改了 / 新增了哪些文件

| 文件路径 | 动作 | 一句话说明 |
| --- | --- | --- |
| `web/tests/probe-contract.test.ts` | 新增（红阶段） | 两条断言：数据契约 200/state/无 status（绿）、跨域契约 `Origin: 5173` 拿到 `Access-Control-Allow-Origin`（红）。**跑测需先起后端 3001** |
| `web/package.json` | 修改（红阶段） | test script glob 从 `*.test.tsx` 扩到 `*.test.ts*`，让 `.ts` 和 `.tsx` 测试都能被匹配 |
| `web/src/App.tsx` | 修改（绿阶段） | `useState<ProbeState>` 存 loading/online/unreachable，`useEffect` fetch 完整地址读 `data.state`，`cancelled` 标志防竞态，保留 `<h1>热点罗盘</h1>` |
| `api/src/main.ts` | 修改（绿阶段） | 手写 CORS 中间件：设 `Access-Control-Allow-Origin: http://localhost:5173`，`OPTIONS` 预检返回 204。**未装 cors、未改 api/package.json** |

提交：`683fd4f feat(web): bind probe status to dashboard`（4 文件 +72/-1，只提交未推送）。

## 3. 怎么验收的（方案 AI 逐项实跑）

**红阶段**：起后端 3001 后 `npm test` → `pass 2 / fail 1`，失败项为跨域契约：`actual: null` vs `expected: 'http://localhost:5173'`。红锁定的是"后端还没放行跨域"这一真实缺口，红得对。同时确认前两条（标题渲染、数据契约）是绿的——证明没硬凑假红。

**绿阶段**：
- `web npm test` → `pass 3 / fail 0`（标题渲染、数据契约、跨域契约全绿）。注：首次误在未起后端时跑，得 `pass 1 / fail 2`，是操作顺序错（任务说明要求先起 3001），非代码问题；起后端后重跑通过
- `web npm run build` → 退出码 0，`dist/assets/index-*.js` 220.04 kB（gzip 68.90 kB）
- `api npm run build` → 退出码 0
- `curl -H "Origin: http://localhost:5173" .../api/probe/status` → 响应头 `Access-Control-Allow-Origin: http://localhost:5173`，HTTP 200
- `curl .../api/probe/status` → `{"state":"online","checkedAt":"..."}`
- 浏览器实测：打开 `http://localhost:5173`，截图显示"热点罗盘" + "探针状态：online"，无"加载中/不可达"残留 → 证明 fetch 成功、CORS 未拦（若被拦会走 catch 显示"探针不可达"）
- 验证后关闭前后端服务，3001 / 5173 端口均已释放
- 结果：✅ 通过

## 4. 踩到的坑 / 和计划的偏差

1. **红测试造法（已解决）**：原任务说明的两处模糊（"直接 fetch 天然绿" + "`renderToString` 测不了 useEffect"）由代码 AI 自己厘清，设计跨域契约红。方案 AI 接受该设计并回写任务说明，把红绿判定固定为"数据契约绿、跨域契约红"。
2. **CORS 方案改判（方案 AI 拍板）**：否掉了原任务说明"授权装 cors"的口径，改为**零依赖手写中间件**。四理由：① 与 Step 2/3 零依赖切片一致；② 代理间歇 502，避免 `npm install` 再踩坑；③ 手写能看懂 CORS 就是几个响应头（教学价值）；④ 固定来源 + 单 GET 场景手写足够。已修任务说明消除与规范第 13 条的张力，代码 AI 照此实现。
3. **代码 AI 边界守得好**：它发现文档矛盾（"允许装 cors" vs 规范第 13 条）后停下问方案 AI，没擅加依赖、没碰 `specs/`、没推送，符合分工。

## 5. 下一步是什么（最小骨架收尾）

Step 0~4 全部落地，最小可运行骨架完成。收尾待办：
- [ ] 回写 `实施方案` / `开发路线说明` 进度为全部完成
- [ ] 推送剩余提交（含本步 `_683fd4f_` 与方案文档提交）
- [ ] GitHub 远端确认最终状态

后续切片（不在本次最小骨架范围）：接真实信息源、关键词管理、AI 审核、定时任务、Notification、封装 Agent Skills。
