import { Router } from 'express'
import { activeStore, DUPLICATE_CODE } from './store.js'
import type { WatchCategory } from './types.js'

const CATEGORIES: WatchCategory[] = ['official', 'other-game', 'outside']

export const watchTermRouter = Router()

watchTermRouter.get('/', (_req, res) => {
  // 每次请求读 live binding，测试可替换 activeStore
  res.json({ terms: activeStore.list() })
})

watchTermRouter.post('/', (req, res) => {
  const body = req.body as { text?: unknown; category?: unknown } | undefined
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  const category = body?.category

  if (!text || !CATEGORIES.includes(category as WatchCategory)) {
    res.status(400).json({ error: 'text 不能为空，category 必须是 official / other-game / outside' })
    return
  }

  try {
    const term = activeStore.add(text, category as WatchCategory)
    res.status(201).json({ term })
  } catch (error) {
    if ((error as { code?: string }).code === DUPLICATE_CODE) {
      res.status(409).json({ error: '该关键词已存在' })
      return
    }
    throw error
  }
})

watchTermRouter.delete('/:id', (req, res) => {
  if (!activeStore.remove(req.params.id)) {
    res.status(404).json({ error: '关键词不存在' })
    return
  }
  res.status(204).end()
})

watchTermRouter.patch('/:id/toggle', (req, res) => {
  const term = activeStore.toggle(req.params.id)
  if (!term) {
    res.status(404).json({ error: '关键词不存在' })
    return
  }
  res.json({ term })
})
