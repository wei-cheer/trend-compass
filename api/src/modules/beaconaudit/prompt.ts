const DEFAULT_MODEL = 'Qwen/Qwen2.5-7B-Instruct'

// system 要求 JSON，user 带标题 + 命中词
export function buildAuditPrompt(
  title: string,
  matchedTerms: string[]
): { system: string; user: string } {
  const system = [
    '你是内容审核助手。判断给出的热点是否真实、有价值，排除标题党、假信息和营销软文；并说明它与用户关注的关键词的关系。',
    '只输出 JSON，不要任何多余文字或代码块标记，格式：{"isReal": true, "reason": "一句话中文理由"}',
    'isReal 必须是布尔值；reason 为一句话，不超过 60 字。',
  ].join('\n')

  const user = `热点标题：${title}\n命中关键词：${matchedTerms.join('、')}`

  return { system, user }
}

// 支持纯 JSON、```json 包裹；非法或缺少 isReal 返回 null 触发降级
export function parseAuditResponse(raw: string): { isReal: boolean; reason: string } | null {
  if (typeof raw !== 'string') return null

  let text = raw.trim()
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) text = fenced[1].trim()

  try {
    const parsed = JSON.parse(text) as { isReal?: unknown; reason?: unknown }
    if (typeof parsed?.isReal !== 'boolean') return null
    return {
      isReal: parsed.isReal,
      reason: typeof parsed.reason === 'string' ? parsed.reason.trim() : '',
    }
  } catch {
    return null
  }
}

// 优先级：请求体传入（trim 非空）> 配置 > 硬编码默认
export function resolveAuditModel(
  requestedModel: string | undefined,
  configModel: string | undefined
): string {
  const requested = requestedModel?.trim()
  if (requested) return requested

  const configured = configModel?.trim()
  if (configured) return configured

  return DEFAULT_MODEL
}
