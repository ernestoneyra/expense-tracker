import express from 'express'
import mongoose from 'mongoose'
import { connectDb } from './db.ts'

const app = express()
app.use(express.json())

app.get('/api/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1
  res.status(connected ? 200 : 503).json({ ok: connected, db: mongoose.connection.name })
})

const port = Number(process.env.PORT) || 3001

try {
  await connectDb()
} catch (err) {
  console.error('Failed to connect to MongoDB:', err instanceof Error ? err.message : err)
  process.exit(1)
}

app.listen(port, () => console.log(`API listening on http://localhost:${port}`))
