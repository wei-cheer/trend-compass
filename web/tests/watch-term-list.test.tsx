import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToString } from 'react-dom/server'
import App from '../src/App.tsx'

// SSR 不执行 useEffect，只锁容器钩子（真实交互由浏览器验收）
test('关键词区结构契约：watchterm-board 与 watchterm-form 存在', () => {
  const html = renderToString(React.createElement(App))

  assert.match(html, /class="watchterm-board"/, `应渲染关键词区容器，实际输出：${html}`)
  assert.match(html, /class="watchterm-form"/, `应渲染关键词表单，实际输出：${html}`)
})
