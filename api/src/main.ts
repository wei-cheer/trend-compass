import express from 'express'
import dotenv from 'dotenv'
import { pathToFileURL } from 'node:url'
import probeRouter from './modules/probe/router.js'

dotenv.config()

const app = express()
const port = process.env.PORT || 3001

app.use('/api/probe', probeRouter)

// 直接运行（tsx watch 等）时才监听；被测试 import 时不占端口
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(port, () => {
    console.log(`trend-compass api listening on ${port}`)
  })
}

export default app
