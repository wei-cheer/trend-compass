import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToString } from 'react-dom/server'
import App from '../src/App.tsx'

// 命中标记依赖 useEffect 数据，SSR 测不到；这里只锁热点容器结构未被破坏
test('命中改造后热点区结构仍完整', () => {
  const html = renderToString(React.createElement(App))

  assert.match(html, /class="beacon-board"/, `应渲染 beacon-board 容器，实际输出：${html}`)
  assert.match(html, /烽火 · 热点列表/, `应保留热点区标题，实际输出：${html}`)
})
