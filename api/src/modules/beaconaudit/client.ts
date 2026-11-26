import { buildAuditPrompt, parseAuditResponse, resolveAuditModel } from './prompt.js'

export interface AuditConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export interface AuditResult {
  isReal: boolean
  reason: string
  degraded: boolean
}

export interface AuditClient {
  audit(title: string, matchedTerms: string[], model?: string): Promise<AuditResult>
}

const DEGRADED_REASON = 'AI 未配置或调用失败'
const TIMEOUT_MS = 30_000

function degraded(): AuditResult {
  return { isReal: false, reason: DEGRADED_REASON, degraded: true }
}

// 必须在函数内读 env：main.ts 的 dotenv.config() 在模块体执行，子模块顶层先跑完会拿到 undefined
function readConfigFromEnv(): AuditConfig {
  return {
    apiKey: process.env.SILICONFLOW_API_KEY?.trim() ?? '',
    baseUrl: (process.env.AI_BASE_URL?.trim() || 'https://api.siliconflow.cn/v1').replace(/\/$/, ''),
    model: process.env.AI_MODEL?.trim() || 'Qwen/Qwen2.5-7B-Instruct',
  }
}

export function createAuditClient(options?: {
  fetchFn?: typeof fetch
  getConfig?: () => AuditConfig
}): AuditClient {
  const fetchFn = options?.fetchFn ?? fetch
  const getConfig = options?.getConfig ?? readConfigFromEnv

  return {
    async audit(title, matchedTerms, model) {
      const config = getConfig()
      const resolvedModel = resolveAuditModel(model, config.model)

      // 没配 key 直接降级，不发请求
      if (!config.apiKey) return degraded()

      const { system, user } = buildAuditPrompt(title, matchedTerms)

      try {
        const response = await fetchFn(`${config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: resolvedModel,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            temperature: 0.2,
            max_tokens: 300,
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })

        // 401 / 403 / 429 / 5xx 全部走降级
        if (!response.ok) return degraded()

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: unknown } }>
        }
        const content = data.choices?.[0]?.message?.content
        const parsed = parseAuditResponse(typeof content === 'string' ? content : '')
        if (!parsed) return degraded()

        return { ...parsed, degraded: false }
      } catch {
        return degraded()
      }
    },
  }
}
