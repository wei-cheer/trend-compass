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
4. **跨域必须处理**：浏览器从 5173 fetch 3001 会被 CORS 拦。放行来源 `http://localhost:5173`。实现二选一：
   - 后端装 `cors` 包，`app.use(cors({ origin: 'http://localhost:5173' }))`；
   - 或后端手写响应头中间件（不引入新依赖）。
   **本步允许为 CORS 加依赖**（规范第 13 条红线针对"代码 AI 不得自行加依赖"，这一步的方案 AI 明确授权装 `cors` 这一个包，别加别的）。
5. **只提交不推送**（push 由方案 AI 统一做）；不要 add `specs/` 文档。
6. 提交信息固定为 `feat(web): bind probe status to dashboard`。
7. **本步不做**：不做美化、不加样式库、不做关键词管理、不接数据库/AI/信息源。只把探针状态显示出来。

## 工作流：先红后绿，分两次贴回（TDD）

- **第 1 次贴回（红）**：写一个会因为"页面没有探针状态"而失败的测试，跑出红，贴失败输出。我确认红得对才放行。
- **第 2 次贴回（绿）**：写实现（前端 fetch + 渲染、后端 CORS），贴全绿输出和浏览器实测。

> 本步是跨端契约，正因为"字段名写串/地址写错"curl 单看后端发现不了，才要先写测试。

## 关于测试怎么写（关键，先读再动手）

本步测的是**跨端数据绑定**。零新依赖方案（沿用前两步）：

- **契约测试（纯前端，不需要起后端）**：从 `api` 的 router 拿返回体结构做断言容易跨目录，简化为——写一个测试直接 fetch 真实后端 `http://localhost:3001/api/probe/status`，断言拿到 `state: "online"` 且无 `status` 字段。**这个测试要求跑测时后端 3001 已启动**。
- 想测"页面渲染出探针状态"：用 `react-dom/server` 的 `renderToString` 测不了 fetch（SSR 不执行 useEffect）。所以页面渲染这部分**用浏览器实测 + 截图验收**，不写自动化测试；自动化测试只覆盖"后端契约正确"。
- 若你觉得这个拆法有问题，**先贴出来问我，别自己猜着写**。

测试文件：`web/tests/probe-contract.test.ts`（或 `.tsx`，按你测试内容定），test script 沿用已有 `node --import tsx --test tests/*.test.ts*`（注意 glob 要能同时匹配 `.ts` 和 `.tsx`，必要时调整）。

## 要改 / 新增的文件

| 文件 | 动作 | 阶段 | 内容要点 |
| --- | --- | --- | --- |
| `web/tests/probe-contract.test.ts` | 新增 | 红 | fetch 真实后端探针接口，断言 200 / `state === 'online'` / 无 `status` 字段。**跑测前需先起后端 3001** |
| `web/src/App.tsx` | 修改 | 绿 | 用 `useEffect` + `fetch` 拉探针状态，`useState` 存结果，渲染"探针状态：online"（或失败时显示"探针不可达"）。保留 `<h1>热点罗盘</h1>` |
| `api/src/main.ts` | 修改 | 绿 | 加 CORS 放行 `http://localhost:5173`（装 cors 或手写响应头，二选一） |
| `api/package.json` | 修改（若选装 cors） | 绿 | 只加 `cors` 一个依赖 + `@types/cors` |

**前端 fetch 的坑**：`useEffect` 里 fetch，记得处理 loading/错误态；组件卸载时若有 pending 请求，简单场景可忽略，但别让报错刷屏。

## 验收命令

**红阶段**（后端 3001 先起来，跑测试）：

```bash
# 终端 A：起后端
cd /i/apps/trend-compass/api && npm run dev
# 终端 B：跑测试
cd /i/apps/trend-compass/web && npm test
```

**看到什么算对**：`probe-contract` 测试失败——但如果后端已起、探针接口已对，这个契约测试本来就该过。**所以红的判定请这样设计**：先让测试断言一个当前页面还没做到的东西（例如渲染"探针状态"文字），或者你直接贴出你设计的红测试并说明它为什么现在会失败，我确认后再放行。不确定就贴出来问，别硬凑一个假红。

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
git status              # 确认只改了 web/src/App.tsx、api 相关、测试文件
git add web/src api/src api/package.json
git commit -m "feat(web): bind probe status to dashboard"
git log -1 --oneline
```

## 交付要求

- **第 1 次贴回（红）**：红测试的设计说明 + 失败输出（说明为什么现在会失败）。
- **第 2 次贴回（绿）**：① `npm test` 全绿；② 浏览器截图（看到"探针状态：online"且 Console 无 CORS 错）；③ `git log -1 --oneline`。

**本步做完就停**，不要开始封装 Agent Skills 或接真实信息源——那是后续切片。等我验收后统一收尾最小骨架。
