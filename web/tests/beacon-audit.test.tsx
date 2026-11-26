import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToString } from 'react-dom/server'
import App from '../src/App.tsx'

// 回归锁：AI 判定与模型标记依赖数据到达，SSR 测不到，这里只锁结构未被破坏
test('AI 审核改造后热点区与模型选择区结构仍完整', () => {
  const html = renderToString(React.createElement(App))

  assert.match(html, /class="beacon-board"/, `应渲染 beacon-board 容器，实际输出：${html}`)
  assert.match(html, /class="audit-panel"/, `应渲染模型选择区，实际输出：${html}`)
  assert.match(html, /烽火 · 热点列表/, `应保留热点区标题，实际输出：${html}`)
})
