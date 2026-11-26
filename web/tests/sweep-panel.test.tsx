import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToString } from 'react-dom/server'
import App from '../src/App.tsx'

// 回归锁：快照数据到达后才渲染，SSR 只能锁结构
test('改为单一快照源后热点区与巡检设置区结构仍在', () => {
  const html = renderToString(React.createElement(App))

  assert.match(html, /class="beacon-board"/, `应渲染 beacon-board 容器，实际输出：${html}`)
  assert.match(html, /class="sweep-panel"/, `应渲染巡检设置区，实际输出：${html}`)
  assert.match(html, /立即巡检/, `应有立即巡检按钮，实际输出：${html}`)
  assert.match(html, /class="compass"/, `水墨外壳应保留，实际输出：${html}`)
})
