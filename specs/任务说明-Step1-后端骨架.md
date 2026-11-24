# 任务说明：Step 1 建后端工程骨架

> 直接转发给写代码的 AI。目标、文件、验收命令都在下面，照着做即可。

## 一句话目标

在 `I:\apps\trend-compass\api` 里从零建一个 Express 5 + TypeScript 的后端工程，能在 3001 端口启动，控制台打印 `trend-compass api listening on 3001`。**本步不写任何业务接口**（探针接口是 Step 2）。

## 硬性约束（必须遵守，否则验收不通过）

1. **只在 `I:\apps\trend-compass` 目录里写文件**，不要碰 `I:\apps\yupi-hot-monitor`（那是只读参考仓库）。
2. **命名必须独立原创**，不沿用参考项目：
   - 项目根目录 `api/`（不是 `server/`）
   - 后端入口 `api/src/main.ts`（不是 `server/src/index.ts`）
   - 启动日志文案 `trend-compass api listening on 3001`
   - 不要创建任何叫 `health` 的文件或路由
3. **本步只做骨架**：不装数据库、不接信息源、不接 AI、不写 `.env` 真实值。
4. 只提交 `.env.example`，**`.env` 绝不提交**（`.gitignore` 已配好）。
5. npm 安装用国内镜像：`npm install --registry=https://registry.npmmirror.com`。

## 要创建的文件

| 文件 | 内容要点 |
| --- | --- |
| `api/package.json` | name 用 `trend-compass-api`；type module；scripts 至少含 `dev`（`tsx watch src/main.ts`）和 `build`；依赖 `express@^5`、`dotenv`；devDependencies `typescript`、`tsx`、`@types/express`、`@types/node` |
| `api/tsconfig.json` | target ES2022、module ESNext、moduleResolution bundler、strict true、outDir dist |
| `api/.env.example` | 只放占位键 `PORT=3001`，写成示例，不含任何真实密钥 |
| `api/src/main.ts` | 导入 express 与 dotenv；`const app = express()`；`const port = process.env.PORT || 3001`；`app.listen(port, () => console.log(\`trend-compass api listening on ${port}\`))` |

## 验收命令（每一步都要自己跑一遍，把输出贴回来）

```bash
cd /i/apps/trend-compass/api
npm install --registry=https://registry.npmmirror.com
npm run dev
```

看到控制台输出：`trend-compass api listening on 3001` 即算通过。

然后提交并推送：

```bash
cd /i/apps/trend-compass
git add api
git status              # 确认没有 .env，只列出上面 4 个文件
git commit -m "feat(api): scaffold express service"
git push origin main
git status -sb          # 应显示 ## main...origin/main，无 ahead/behind
git log -1 --oneline    # 应显示 feat(api): scaffold express service
```

## 交付要求

把以下三项贴回来给我：
1. `npm run dev` 的控制台输出（含那行启动日志）
2. `git log -1 --oneline` 的输出
3. `git status -sb` 的输出

**本步做完就停**，不要提前写 Step 2 的探针接口。等我验收后再给下一步任务。
