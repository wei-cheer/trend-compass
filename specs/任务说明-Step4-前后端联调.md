# 任务说明：Step 4 前后端联调

> 直接转发给写代码的 AI。目标、文件、验收命令都在下面，照着做即可。
> 前置：Step 3 已完成（前端 5173 能显示"热点罗盘"），Step 2 已完成（后端 3001 探针接口可用）。
> 本步按 M 级走 TDD（red→green），分两次贴回。**这是最小骨架切片的最后一步。**

## 一句话目标

让前端页面真正显示"探针状态：online"——从后端 `GET http://localhost:3001/api/probe/status` 取数据渲染到页面上。

## 硬性约束（必须遵守，否则验收不通过）

1. **只在 `I:\apps\trend-compass` 里写文件**，不要碰 `I:\apps\yupi-hot-monitor`（只读参考）。
2. **fetch 写完整地址** `http://localhost:3001/api/probe/status`，**不要**写相对路径 `/api/probe/status`——Vite dev 不会代理到 3001，相对路径会打到 5173 然后 404。
3. **字段名是 `state`**：从返回体读 `data.state`（值是 `"online"`），**不要**读 `data.status`。
4. **跨域必须处理**：浏览器从 5173 fetch 3001 会被 CORS 拦。放行来源 `http://localhost:5173`。
   **方案 AI 已拍板：零依赖手写中间件**（与 Step 2/3 的零依赖测试保持一致；本切片不引入任何新依赖，规范第 13 条红线继续生效）。做法：在 `api/src/main.ts` 加一个中间件，对来源为 `http://localhost:5173` 的请求设 `Access-Control-Allow-Origin: http://localhost:5173` 响应头；`OPTIONS` 预检请求直接返回 204。**`api/package.json` 不动，不要装 `cors`**。
5. **只提交不推送**（push 由方案 AI 统一做）；不要 add `specs/` 文档。
6. 提交信息固定为 `feat(web): bind probe status to dashboard`。
7. **本步不做**：不做美化、不加样式库、不做关键词管理、不接数据库/AI/信息源。只把探针状态显示出来。

## 工作流：先红后绿，分两次贴回（TDD）

- **第 1 次贴回（红）**：写一个会因为"页面没有探针状态"而失败的测试，跑出红，贴失败输出。我确认红得对才放行。
- **第 2 次贴回（绿）**：写实现（前端 fetch + 渲染、后端 CORS），贴全绿输出和浏览器实测。

> 本步是跨端契约，正因为"字段名写串/地址写错"curl 单看后端发现不了，才要先写测试。

## 关于测试怎么写（关键，先读再动手）

本步测的是**跨端数据绑定**。零新依赖方案（沿用前两步）：

- **契约测试（fetch 真实后端，跑测前需先起 3001）**：直接 fetch `http://localhost:3001/api/probe/status`，分两条断言：
  1. **数据契约**：200 / `state === 'online'` / 无 `status` 字段 —— 这条 Step 2 已实现，**本来就该绿**，作用是锁住 Step 2 的成果防回归。
  2. **跨域契约**：带 `Origin: http://localhost:5173` 请求，断言响应头 `access-control-allow-origin === 'http://localhost:5173'` —— 这条**现在是红的**（实测拿到 `null`），正是 Step 4 唯一缺的那块。
- 想测"页面渲染出探针状态"：用 `react-dom/server` 的 `renderToString` 测不了 fetch（SSR 不执行 useEffect）。所以页面渲染这部分**用浏览器实测 + 截图验收**，不写自动化测试。
- **红绿判定就按上面两条**：前一条绿、后一条红 → 红得对，放行绿阶段。若你觉得这个拆法有问题，先贴出来问我。

测试文件：`web/tests/probe-contract.test.ts`（或 `.tsx`，按你测试内容定），test script 沿用已有 `node --import tsx --test tests/*.test.ts*`（注意 glob 要能同时匹配 `.ts` 和 `.tsx`，必要时调整）。

## 要改 / 新增的文件

| 文件 | 动作 | 阶段 | 内容要点 |
| --- | --- | --- | --- |
| `web/tests/probe-contract.test.ts` | 新增 | 红 | 两条断言（已在红阶段落地，见上）：数据契约绿、跨域契约红。**跑测前需先起后端 3001** |
| `web/src/App.tsx` | 修改 | 绿 | 用 `useEffect` + `fetch` 拉探针状态，`useState` 存结果，渲染"探针状态：online"（或失败时显示"探针不可达"）。保留 `<h1>热点罗盘</h1>` |
| `api/src/main.ts` | 修改 | 绿 | **手写** CORS 中间件放行 `http://localhost:5173`：设 `Access-Control-Allow-Origin` 头，`OPTIONS` 返回 204。**不改 `api/package.json`，不装依赖** |

**前端 fetch 的坑**：`useEffect` 里 fetch，记得处理 loading/错误态；组件卸载时若有 pending 请求，简单场景可忽略，但别让报错刷屏。

## 验收命令

**红阶段**（后端 3001 先起来，跑测试）：

```bash
# 终端 A：起后端
cd /i/apps/trend-compass/api && npm run dev
# 终端 B：跑测试
cd /i/apps/trend-compass/web && npm test
```

**看到什么算对**：三条测试里，标题渲染绿、数据契约绿、**跨域契约红**（`actual: null` vs `expected: 'http://localhost:5173'`）。红锁定的是"后端还没放行跨域"这一真实缺口，不是硬凑的假红。**方案 AI 已于红阶段实跑确认此红通过**（2026-11-24，后端 3001 已起）。

**绿阶段**（前端 5173 + 后端 3001 都起）：

```bash
cd /i/apps/trend-compass/web && npm test          # 全绿
curl http://localhost:3001/api/probe/status       # 后端返回 state online
curl -s http://localhost:5173/ | grep -o '热点罗盘' # 前端页面在
```

**浏览器实测**（必须做，贴截图）：打开 `http://localhost:5173`，看到"热点罗盘"标题 + "探针状态：online"。打开 DevTools → Console，确认**没有 CORS 报错**。

**常见失败**：
- 浏览器 Console 报 `CORS policy` → 后端 CORS 没加或来源写错，检查是不是 `http://localhost:5173`
- 页面显示"探针不可达" → fetch 地址写成了相对路径，或后端 3001 没起
- 测试 glob 匹配不到 `.test.tsx` → 检查 package.json 的 test script 后缀

## 提交（只提交，不推送）

```bash
cd /i/apps/trend-compass
git status              # 确认只改了 web/src/App.tsx、web/package.json、web/tests/、api/src/main.ts
git add web/src web/package.json web/tests api/src/main.ts
git commit -m "feat(web): bind probe status to dashboard"
git log -1 --oneline
```

## 交付要求

- **第 1 次贴回（红）**：红测试的设计说明 + 失败输出（说明为什么现在会失败）。
- **第 2 次贴回（绿）**：① `npm test` 全绿；② 浏览器截图（看到"探针状态：online"且 Console 无 CORS 错）；③ `git log -1 --oneline`。

**本步做完就停**，不要开始封装 Agent Skills 或接真实信息源——那是后续切片。等我验收后统一收尾最小骨架。
