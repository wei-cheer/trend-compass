# 任务说明-Step5：前端美化（三国水墨 / 作战沙盘）

> 直接转发给写代码的 AI。目标、文件、验收命令都在下面，照着做即可。
> 前置：Step 0~4 最小骨架已完成并验收（页面显示"热点罗盘 / 探针状态：online"）。
> 本步是 **Step 5**（前端美化切片的第一步，教程第 3 节对应环节），规模 S 级、纯样式改动，**不强制 TDD**（见 `specs/开发路线说明.md` §5）。
> 本步**依据设计规范**：`specs/设计规范-前端美化-三国水墨.md`（方案 AI 按 ui-ux-pro-max skill 的 SOP 生成，已含设计令牌、组件规格、布局、对比度校验）。**先读那份规范再动手**，本文件只讲怎么落地和验收。

## 一句话目标

把当前只有两行字的"状态页"，换成**三国水墨 / 作战沙盘**风格：墨黑底 + 朱砂红点缀 + 烫金标题，保留探针状态显示和原有全部逻辑。

## 硬性约束（必须遵守，否则验收不通过）

1. **只在 `I:\apps\trend-compass` 里写文件**，不要碰 `I:\apps\yupi-hot-monitor`（只读参考）。
2. **零新依赖**：`web/package.json` **不动**，不要装任何包（不装 Tailwind / Aceternity UI / 动画库）。纯手写 CSS。
3. **探针逻辑一个字都不改**：`PROBE_URL` 常量、`useEffect` + `fetch` + `cancelled` 防竞态、`data.state === 'online' ? 'online' : 'unreachable'` 判定——全部保留原样。本步**只换样式与呈现**，不换行为。
4. **字段名仍是 `state`**，不是 `status`。
5. **样式入口**：当前 `web/src/main.tsx` 可能没有引入 CSS。需要新建 `web/src/index.css` 并在 `main.tsx` 顶部加 `import './index.css'`。先读 `main.tsx` 确认现状再改，别重复 import。
6. **只提交不推送**（push 由方案 AI 统一做）；**不要 add `specs/` 文档**。
7. 提交信息固定为 `feat(web): apply ink-wash theme (step5)`。
8. **本步不做**：不做数据卡片、不接信息源、不改后端、不做关键词管理、不做自定义风格切换。只美化当前这个状态页框架。

## 关于测试（关键，先读再动手）

本步有两种验证 + 一条**新增的红测试**，别搞混（2026-11-25 方案 AI 拍板，采纳代码 AI 的 A 方案）：

- **红测试锁"样式结构契约"（本步新增要求）**：先写一条会失败的测试，断言 `renderToString(<App />)` 的输出里**有** `class="compass"`、`class="probe-card"`、`probe-card--loading`（SSR 只能看到初始态 loading）、副标题 `compass__subtitle`。现在代码里一个 className 都没有 → 必然红；挂上 class 后转绿。**这条红测的是"样式钩子挂没挂上"，不是测颜色**——className 漏了，样式就不生效，而这件事人眼在截图里容易漏看（尤其三态只显示一态时），所以要锁。
- **回归测试锁"逻辑没被改坏"**：已有的两个测试文件（`app-render.test.tsx`、`probe-contract.test.ts`）必须继续全绿。改完样式若它们挂了，说明你动了探针逻辑或标题文字，回退。
- **样式效果本身不写自动化测试**：颜色、对比度、动画这些 `renderToString` 测不了（不渲染 CSS），靠**浏览器截图 + 方案 AI 目视验收**。

> **为什么这里又走 TDD**（跟"Step 5 是 S 级"不矛盾）：S 级说的是代码规模小；但"className 是否挂全"属于**结构契约**——它错了截图未必一眼看得出（内联样式也能出效果），符合"看一眼发现不了就得先写测试"的判据。测试用零依赖 `node:test` + 已有 `react-dom/server`，不装新包，不撞规范第 13 条红线。

## 要改 / 新增的文件

| 文件 | 动作 | 内容要点 |
| --- | --- | --- |
| `web/tests/style-contract.test.tsx` | **新增（红）** | 零依赖 `node:test` + `renderToString`；断言输出含 `compass`、`probe-card`、`probe-card--loading`（SSR 初始态）、`compass__subtitle`；**先写、先跑、先贴红输出** |
| `web/src/index.css` | **新增（绿）** | 按规范 §2 写 `:root` 设计令牌 + `body` 墨黑底；按 §3/§4 写 `.compass`、`.probe-card` 三态、状态点动画、`prefers-reduced-motion` 降级、响应式断点 |
| `web/src/main.tsx` | 修改（绿） | 顶部加 `import './index.css'`（先确认没有再 import） |
| `web/src/App.tsx` | 修改（绿） | **保留全部逻辑与文字**，只加 className：`<main className="compass">`、`<header className="compass__header">`、`<h1 className="compass__title">热点罗盘</h1>`、副标题 `<p className="compass__subtitle">`、状态卡 `<section className={...}>` 按 probe 三态挂 `probe-card--loading/--online/--unreachable`，状态点 `<span className="probe-card__dot">` |

**App.tsx 改法示意**（只加 class，逻辑原样）：

```tsx
// 三态文字照旧：'探针状态：加载中' / '探针状态：online' / '探针不可达'
// 修饰类由 probe 状态拼出来，例如：
<section className={`probe-card probe-card--${probe}`}>
  <span className="probe-card__dot" aria-hidden="true" />
  <p>{/* 原来的三态文字表达式，原封不动 */}</p>
</section>
```

**副标题文字**规范里举例是"多源热点聚合 · 作战沙盘"，你可用这个，也可自拟同调性短句；**不要**改主标题"热点罗盘"四个字（测试断言它存在）。

**配色红线**（规范 §2.5 已实测，别踩）：
- 朱砂 `--cinnabar` 对墨黑底只有 **3.26:1**，**禁止用于正文/小字**，只做大标题装饰、边框、故障态大字。
- 故障态"探针不可达"的朱砂大字**必须 ≥21px 且加粗**（2026-11-25 修正）：WCAG 大字号门槛是 ≥24px 常规或 ≥18.66px 加粗，18px 常规不达标。用 `--fs-h2`（21px）+ `font-weight:700`，别写 18px。
- 卡片底和页面底只差 **1.12:1**，**必须加 `--ink-line` 边框**，否则看不出卡片边界。
- 正文用宣纸白 `--paper`（14.66:1）、状态值用烫金 `--gold`（7.62:1）、online 用青瓷 `--celadon`（6.07:1）——这些才过 WCAG AA。

## 验收命令（red → green 两次贴回）

**阶段一 · 红（先做，贴给我确认后才准写实现）**：只新增 `style-contract.test.tsx`，**不要**动 App.tsx / 建 CSS。

```bash
cd /i/apps/trend-compass/web && npm test 2>&1 | grep -A6 'style-contract'
```

期望：这条测试**失败**，失败原因是"输出里找不到 `class="compass"`"之类（断言 class 缺失），**不是**模块加载报错 / `Cannot find module`。贴出这段红输出给我。

**阶段二 · 绿（我放行后再做）**：建 CSS、挂 className、加 import，然后：

```bash
# 终端 A：起后端（probe-contract 测试要 fetch 真实接口）
cd /i/apps/trend-compass/api && npm run dev
# 终端 B：前端测试 + 构建
cd /i/apps/trend-compass/web && npm test       # 3 条全绿
cd /i/apps/trend-compass/web && npm run build  # 退出码 0
```

**浏览器实测（必须做，贴截图）**：

```bash
# 终端 C：起前端
cd /i/apps/trend-compass/web && npm run dev
```

打开 `http://localhost:5173`，贴截图，并逐条确认：

- [ ] 底色是**墨黑**，标题是**烫金**，整体没有蓝紫渐变（去 AI 味）
- [ ] 状态卡有可见边框，能看出卡片轮廓
- [ ] 三种状态能区分：加载中（琥珀点脉冲）/ online（青瓷点）/ 不可达（朱砂点 + 大字）
- [ ] 文字清晰不糊（尤其别把朱砂用在小字上）
- [ ] Console 无报错

**常见失败**：
- 页面还是老样子、样式没生效 → `main.tsx` 少 `import './index.css'`
- 测试挂了 → 你动了探针逻辑或改了标题文字，回退那部分
- 状态卡看不出边界 → 忘了加 `--ink-line` 边框（色差只有 1.12:1）
- `build` 报 TS 错 → 类名字符串拼接的类型问题，先看 `tsconfig.json` 的 `rootDir: "src"` 是否还在

## 提交（只提交，不推送）

```bash
cd /i/apps/trend-compass
git status              # 确认只有 web/src/index.css、web/src/main.tsx、web/src/App.tsx、web/tests/style-contract.test.tsx
git add web/src
git commit -m "feat(web): apply ink-wash theme (step5)"
git log -1 --oneline
```

## 交付要求（分两次）

**第一次（红）**：`style-contract` 测试的失败输出（证明红在 class 缺失，不是加载错）。我确认红得对 → 放行绿阶段。

**第二次（绿）**：四项——
1. `npm test` 全绿输出（3 条）
2. `npm run build` 退出码 0
3. **浏览器截图**（墨黑底 + 烫金标题 + 状态卡可见）
4. `git log -1 --oneline` 输出

**本步做完就停**，不要开始接真实信息源或做自定义风格切换——那是后续切片。等我验收后再定下一步。
