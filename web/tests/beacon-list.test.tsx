import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToString } from 'react-dom/server'
import App from '../src/App.tsx'

// SSR 不执行 useEffect，测不到数据行，只锁容器钩子与加载态文字
test('beacon 列表结构契约：容器与加载态文字存在', () => {
  const html = renderToString(React.createElement(App))

  assert.match(html, /class="beacon-board"/, `应渲染 beacon-board 容器，实际输出：${html}`)
  assert.match(html, /热点加载中/, `初始态应有加载提示，实际输出：${html}`)
})
