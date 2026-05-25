import 'dotenv/config'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { createServer } from 'http'
import express from 'express'
import cors from 'cors'
import { pool } from './db.js'
import { initIo } from './socket.js'
import { merchantsRouter } from './routes/merchants.js'
import { pastDueRouter } from './routes/past-due.js'
import aiRouter from './routes/ai.js'
import statsRouter from './routes/stats.js'
import checkoutBrandRouter from './routes/checkout-brand.js'
import { internalRouter } from './routes/internal.js'
import { subdomainRouter } from './middleware/subdomainRouter.js'

const PORT = 3001
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'

/**
 * Applies the keeper schema SQL against the connected database.
 * All statements use CREATE TABLE IF NOT EXISTS so this is safe to run on
 * every startup — it is a no-op when the schema is already current.
 */
async function runMigrations(): Promise<void> {
    const schemaPath = resolve(dirname(fileURLToPath(import.meta.url)), '../keeper/db/schema.sql')
    const sql = readFileSync(schemaPath, 'utf8')
    await pool.query(sql)
    console.log('[migrations] schema applied successfully')
}

const app = express()
app.use(cors())
app.use(express.json())

// Subdomain routing must run before all route handlers so custom domains are
// intercepted regardless of path. System hosts pass through untouched.
app.use(subdomainRouter)

app.get('/health', (_req, res) => res.json({ ok: true }))
app.use('/api/merchants', merchantsRouter)
app.use('/api/merchants', pastDueRouter)
app.use('/api/ai', aiRouter)
app.use('/api/stats', statsRouter)
app.use('/api/checkout-brand', checkoutBrandRouter)
app.use('/internal', internalRouter)

const httpServer = createServer(app)

export const io = initIo(httpServer, FRONTEND_ORIGIN)

io.on('connection', (socket) => {
    console.log(`[socket.io] client connected    id=${socket.id}`)
    socket.on('disconnect', (reason) => {
        console.log(`[socket.io] client disconnected id=${socket.id} reason=${reason}`)
    })
})

async function main(): Promise<void> {
    await runMigrations()
    httpServer.listen(PORT, () => {
        console.log(`API server listening on port ${PORT}`)
    })
}

main().catch((err) => {
    console.error('[startup] fatal error:', err)
    process.exit(1)
})
