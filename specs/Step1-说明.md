# Step 1 说明：建后端工程骨架

> 所属方案：`specs/实施方案-最小可运行骨架.md` · 完成时间：2026-11-24 11:00 · 状态：✅ 完成（含 1 处偏差）

## 1. 这一步做了什么

在 `I:\apps\trend-compass\api` 从零建了 Express 5 + TypeScript 的后端工程骨架：写了 `package.json`、`tsconfig.json`、`.env.example`、`src/main.ts` 四个文件，用 npmmirror 镜像装了运行时与开发依赖，并生成 `package-lock.json`。用 `npm run dev` 启动后控制台打印 `trend-compass api listening on 3001`，说明服务已在 3001 端口监听。本步按任务说明**没有写任何业务接口**，`/api/probe/status` 留给 Step 2。

## 2. 改了 / 新增了哪些文件

| 文件路径 | 动作（新增/修改/删除） | 一句话说明 |
| --- | --- | --- |
| `api/package.json` | 新增 | 包名 `trend-compass-api`，`type: module`，scripts 含 `dev`（`tsx watch src/main.ts`）与 `build`（`tsc`） |
| `api/package-lock.json` | 新增 | 首次安装生成的锁文件，用来固定实际依赖版本 |
| `api/tsconfig.json` | 新增 | target ES2022、module ESNext、moduleResolution bundler、strict、rootDir src、outDir dist |
| `api/.env.example` | 新增 | 只有占位 `PORT=3001`，无真实密钥 |
| `api/src/main.ts` | 新增 | 导入 express 与 dotenv，`app.listen(port)` 并打印启动日志；无任何路由 |
| `specs/实施方案-最小可运行骨架.md` | 修改 | §4 把 Step 1 状态改为 ✅ 完成；§8 记录文档布局决定；§9 追加执行记录 |
| `specs/Step1-说明.md` | 新增 | 本文件 |
| `specs/任务说明-Step1-后端骨架.md` | 新增（入库） | 上一轮遗留的未跟踪文件，本次随 Step 1 一并提交 |

## 3. 怎么验收的（必须贴真实结果，且写清"看到什么算对"）

- 验收命令：`cd I:\apps\trend-compass\api` → `npm install --registry=https://registry.npmmirror.com` → `npm run dev`
- 期望结果：控制台出现一行 `trend-compass api listening on 3001`；端口 3001 有进程监听，HTTP 请求能拿到响应（不是连接被拒）。
- 正确值来源：`specs/任务说明-Step1-后端骨架.md` 的「验收命令」；端口号来自 `specs/实施方案-最小可运行骨架.md` 第 3 节口径（后端 3001）。
- 实际输出（`npm run dev` 控制台）：

  ```text
  > trend-compass-api@0.1.0 dev
  > tsx watch src/main.ts

  ◇ injected env (0) from .env
  trend-compass api listening on 3001
  ```

  监听验证：`Invoke-WebRequest http://localhost:3001/api/probe/status` → `HTTP status: 404`。404 是预期值——Step 2 还没加探针接口，能返回 404 而不是连接失败，就证明 Express 已在 3001 监听。
- 附加验证（不在本步验收清单里，但能提前发现问题）：`npm run build` → 退出码 0，产物只有 `dist/main.js`；`git status` 未出现 `node_modules/`、`dist/`、`.env`。
- 结果：✅ 通过

## 4. 踩到的坑 / 和计划的偏差

1. **TypeScript 装成了 7.x（主版本与参考项目不同）**：`npm install -D typescript` 按 latest 解析到 `typescript@^7.0.2`（参考项目是 5.9.x）。任务说明没写死版本，属于"按 latest 安装"的自然结果；`tsx` 走 esbuild 不受影响，`tsc` 构建也通过。
2. **TS 7 报 `TS5011`：必须显式给 `rootDir`**：首次 `npm run build` 失败——

   ```text
   tsconfig.json(7,5): error TS5011: The common source directory of 'tsconfig.json' is './src'.
   The 'rootDir' setting must be explicitly set to this or another path to adjust your output's file layout.
   ```

   按提示在 `tsconfig.json` 补 `"rootDir": "src"` 后构建通过，产物从 `dist/src/main.js` 变成 `dist/main.js`（更符合预期）。这是任务说明「tsconfig 内容要点」里没列的一项，属于小偏差。
3. **dotenv 18 启动时会多打一行 `◇ injected env (0) from .env`**：当前没有 `.env` 文件（只有 `.env.example`），所以是 0 条注入，无害；等以后真有 `.env` 即可消失这行——或者等 Step 2 需要读环境变量时再决定是否静默。
4. 没有别的偏差：未加业务接口、未加 CORS、未加数据库/AI/信息源，与「本步不写任何业务接口」一致。

## 5. 下一步是什么（给下一 Step 的衔接）

Step 2 加探针状态接口 `GET /api/probe/status`：新建 `api/src/modules/probe/router.ts`，在 `api/src/main.ts` 注册路由，返回 `{"state":"online","checkedAt":"<ISO 时间>"}`（字段是 `state` 不是 `status`）。

给 Step 2 的提醒：
- 本步的 `main.ts` 还没有任何 `app.use`，注册路由时注意挂在 `/api/probe` 前缀下，并用 `curl http://localhost:3001/api/probe/status` 验证。
- 前端联调（Step 4）会跨域，届时需要 `cors` 或手写响应头放行 `http://localhost:5173`；本步按任务说明没有安装 `cors`，Step 2/4 要补，别等到联调才踩。
