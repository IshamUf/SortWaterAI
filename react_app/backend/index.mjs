import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import path from 'path'
import db from './config/database.mjs'
import redisClient from './utils/redisClient.mjs'

import leaderboardRoutes from './routes/leaderboard.mjs'
import levelRoutes from './routes/levels.mjs'
import progressRoutes from './routes/progress.mjs'
import userRoutes from './routes/users.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 5050

app.use(cors())
app.use(express.json())

// Статические файлы фронтенда
app.use(express.static(path.join(__dirname, 'public')))
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

// API маршруты
app.use('/api/leaderboard', leaderboardRoutes)
app.use('/api/levels', levelRoutes)
app.use('/api/progress', progressRoutes)
app.use('/api/users', userRoutes)

// Ожидание готовности базы данных
const waitForDatabase = async (retries = 10) => {
  while (retries > 0) {
    try {
      await db.authenticate()
      console.log('Database ready')
      return
    } catch (e) {
      console.log('Waiting for database...')
      await new Promise(res => setTimeout(res, 2000))
      retries--
    }
  }
  throw new Error('Database not ready')
}

// Запуск сервера после подключения к БД и Redis
const startServer = async () => {
  try {
    await redisClient.connect()
    console.log('Redis connected')

    await waitForDatabase()
    await db.sync()
    console.log('Database synced')

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
  }
}

startServer()

