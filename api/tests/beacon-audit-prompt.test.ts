import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAuditPrompt,
  parseAuditResponse,
  resolveAuditModel,
} from '../src/modules/beaconaudit/prompt.js'

test('buildAuditPrompt 带入标题与命中词并要求 JSON；parseAuditResponse 容错解析', () => {
  const prompt = buildAuditPrompt('OpenAI ships a new AI model', ['AI'])

  assert.match(prompt.system, /JSON/, 'system 应要求输出 JSON')
  assert.match(prompt.system, /isReal/, 'system 应约定 isReal 字段')
  assert.match(prompt.system, /reason/, 'system 应约定 reason 字段')
  assert.match(prompt.user, /OpenAI ships a new AI model/, 'user 应包含热点标题')
  assert.match(prompt.user, /AI/, 'user 应包含命中的关键词')

  assert.deepEqual(
    parseAuditResponse('{"isReal":true,"reason":"与关键词 AI 直接相关"}'),
    { isReal: true, reason: '与关键词 AI 直接相关' },
    '纯 JSON 应能解析'
  )

  assert.deepEqual(
    parseAuditResponse('```json\n{"isReal":false,"reason":"标题党"}\n```'),
    { isReal: false, reason: '标题党' },
    '带 ```json 代码块包裹也应能解析'
  )

  assert.equal(parseAuditResponse('这不是 JSON'), null, '非法 JSON 应返回 null')
})

test('resolveAuditModel 优先级：传入 > 配置 > 硬编码默认，空白回落', () => {
  assert.equal(
    resolveAuditModel('deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-7B-Instruct'),
    'deepseek-ai/DeepSeek-V3',
    '传了 model 应优先用传入值'
  )
  assert.equal(
    resolveAuditModel(undefined, 'zai-org/GLM-4.6'),
    'zai-org/GLM-4.6',
    '未传应回落到配置值'
  )
  assert.equal(
    resolveAuditModel(undefined, undefined),
    'Qwen/Qwen2.5-7B-Instruct',
    '两者都没有应回落到硬编码默认'
  )
  assert.equal(
    resolveAuditModel('   ', 'zai-org/GLM-4.6'),
    'zai-org/GLM-4.6',
    '空白字符串应回落'
  )
})
