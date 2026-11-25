import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToString } from 'react-dom/server'
import App from '../src/App.tsx'

// 样式结构契约：只锁 className 钩子是否挂全，不测颜色（CSS 不进 SSR 输出）
// SSR 输出对应初始态 probe === 'loading'
test('样式结构契约：compass / 副标题 / probe-card 三态钩子存在', () => {
  const html = renderToString(React.createElement(App))

  assert.match(
    html,
    /class="compass"/,
    `<main> 应挂 class="compass"，实际输出：${html}`
  )
  assert.match(
    html,
    /class="compass__subtitle"/,
    `副标题应挂 class="compass__subtitle"，实际输出：${html}`
  )
  assert.match(
    html,
    /class="[^"]*\bprobe-card\b[^"]*"/,
    `状态卡应挂 probe-card 块类，实际输出：${html}`
  )
  assert.match(
    html,
    /class="[^"]*probe-card--loading[^"]*"/,
    `初始态应挂 probe-card--loading 修饰类，实际输出：${html}`
  )
})
