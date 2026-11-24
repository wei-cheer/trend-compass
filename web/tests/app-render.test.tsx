import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToString } from 'react-dom/server'
import App from '../src/App.tsx'

// 用 React.createElement 而不是 JSX，避免测试阶段依赖 tsconfig 的 jsx 配置
test('App 渲染结果包含页面标题“热点罗盘”', () => {
  const html = renderToString(React.createElement(App))
  assert.ok(
    html.includes('热点罗盘'),
    `渲染结果应包含“热点罗盘”，实际输出：${html}`
  )
})
