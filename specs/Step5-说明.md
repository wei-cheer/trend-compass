# Step 5 说明：前端美化（三国水墨 / 作战沙盘）

> 验收日期：2026-11-25 · 关联：`specs/设计规范-前端美化-三国水墨.md`、`specs/任务说明-Step5-前端美化.md`
> 这是**前端美化切片**的第一步，对应教程第 3 节（但按本项目实际进度调整为"先美化空壳、再接数据"）。

## 1. 这一步做了什么

把只有两行字的状态页换成三国水墨风：墨黑底 `#161311` + 烫金标题 `#C6A15B` + 朱砂 `#B93A26` 点缀，宋体衬线标题，加品牌竖线、状态卡边框、青瓷/琥珀/朱砂三态状态点。

**探针逻辑一个字没动**：`PROBE_URL`、`useEffect` + `fetch` + `cancelled` 防竞态、`data.state === 'online' ? ...` 判定、三态文字全部保留，只在外层加 className。

## 2. 改了 / 新增了哪些文件

代码 AI 提交 `6bea0ee feat(web): apply ink-wash theme (step5)`，5 个文件 +226/-7：

| 文件 | 动作 |
| --- | --- |
| `web/src/index.css` | 新增 · 179 行：设计令牌、墨黑底、组件样式、状态点动画、`prefers-reduced-motion` 降级、375px 断点 |
| `web/src/App.tsx` | 修改 · 只加 className（`compass` / `compass__header` / `compass__title` / `compass__subtitle` / `probe-card` 三态 / `probe-card__dot`） |
| `web/src/main.tsx` | 修改 · +1 行 `import './index.css'` |
| `web/tests/style-contract.test.tsx` | 新增 · 32 行 · 零依赖 `node:test` + `renderToString`，4 条 class 钩子正则断言 |
| `web/src/vite-env.d.ts` | 新增 · 1 行 `/// <reference types="vite/client" />`（补 Step 3 漏掉的文件，详见 §4） |

## 3. 怎么验收的（方案 AI 逐项实跑，不采信自述）

**自动化测试**：起后端 3001 后 `npm test` → **pass 4 / fail 0**（标题渲染、数据契约、跨域契约、样式结构契约四条全绿）；`npm run build` → 退出码 0，`dist/assets/index-D3p26Zz_.css` 2.50 kB。

**浏览器实测（亲自截图目视）**：
- 底色 `rgb(22,19,17)` 墨黑、标题 `rgb(198,161,91)` 烫金，左侧朱砂竖线可见，无蓝紫渐变（去 AI 味成功）
- 状态卡边框清晰可辨（在线态青瓷 1px），状态点青瓷实心，文字"热点罗盘 / 探针状态：online"
- Console 零 error 零 warning
- CSS 源码核对：故障态 `.probe-card--unreachable p` 用 `--fs-h2`（21px）+ `--fw-bold`（700）朱砂，符合裁决

**红→绿节奏**：红阶段实跑 pass3/fail1（唯一红是 style-contract、红因 class 缺失）→ 验收放行 → 绿阶段 pass4/fail0。验证后关掉前后端，3001 / 5173 均释放，浏览器标签交还用户。

## 4. 踩到的坑 / 和计划的偏差

1. **文档自身两处矛盾（我的锅，已修）**：
   - 我上轮把 Step 5 定为"S 级不强制 TDD"，但代码 AI 指出 className 结构契约该测——采纳 A 方案补零依赖红测试，并澄清「规模 S 与走 TDD 不矛盾」（路线文档 §5 已改）。
   - 设计规范 §3.2 写故障态朱砂 18px，与 §2.5 实测的 3.26:1 冲突——WCAG 大字号门槛 ≥24px 常规/≥18.66px 加粗，18px 不达标。改为 21px（`--fs-h2`）加粗，既合规又不跟 24px 主标题同级。

2. **`vite-env.d.ts`（代码 AI 主动补，合理）**：Step 3 漏了 Vite 自带的类型声明文件，TS 7 报 `TS2882: Cannot find module ... for side-effect import of './index.css'`。补一行 reference 解决，未动 `package.json`、零新依赖。

3. **online 态 18px 未改（代码 AI 主动说明，合理）**：规范里 online 的 "online" 值用 18px，但它是青瓷色 6.07:1（正文级也过 AA），不受朱砂大字号限制；要放大得包 `<span>`、会改动三态文字表达式，与"逻辑文字一字不动"冲突。保持原样。

4. **我验收时连踩两次"忘起后端"**：Step 4 和 Step 5 红阶段都先得到 `fetch failed` 的假红，起 3001 后重跑才准。已把"跑测试前先起后端"写进任务说明和路线记忆。

## 5. 下一步是什么

前端美化切片第一步完成，页面从两行字变成有辨识度的三国水墨状态页。但**页面仍没有真实热点数据**——下一步按路线文档 §7 推进：接真实信息源（教程第 4 节）→ 关键词管理 → AI 审核 → 定时任务 → 通知 → Agent Skills。每步仍按双 AI 闸门走（任务说明 → 代码 AI 实现 → 方案 AI 实测验收 → 回写 Step 说明）。

## 6. Git 状态

代码提交 `6bea0ee`，方案文档提交 `3722b49`（A 方案 + 字号修正）、`8ed5906`（红阶段验收裁决）、以及本说明。本地 ahead，网络探测超时（git 端点 000/15s）未推送、未重试——网络恢复后一条 `git push origin main` 带走。
