import express from 'express'
import dotenv from 'dotenv'
import { pathToFileURL } from 'node:url'
import probeRouter from './modules/probe/router.js'
import { beaconRouter } from './modules/beacon/router.js'

dotenv.config()

const app = express()
const port = process.env.PORT || 3001

// 放行前端 dev server；零依赖手写，未引入 cors 包
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.status(204).end()
    return
  }
  next()
})

app.use('/api/probe', probeRouter)
app.use('/api/beacons', beaconRouter)

// 直接运行（tsx watch 等）时才监听；被测试 import 时不占端口
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(port, () => {
    console.log(`trend-compass api listening on ${port}`)
  })
}

export default app
