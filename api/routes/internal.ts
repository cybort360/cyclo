/**
 * Internal event relay route.
 * Accepts a Socket.io event name and payload from same-host processes (keeper,
 * webhook relay) and broadcasts to all connected frontend clients.
 *
 * Restricted to loopback addresses only — not exposed to the public internet.
 *
 * POST /internal/events
 *   Body:   { event: string, payload: unknown }
 *   Returns 204 on success, 400 on bad input, 403 if caller is not loopback.
 */
import { Router } from 'express'
import { getIo } from '../socket.js'

const router = Router()

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

router.post('/events', (req, res) => {
    const remoteIp = req.socket.remoteAddress ?? ''
    if (!LOOPBACK_ADDRESSES.has(remoteIp)) {
        res.status(403).json({ error: 'Forbidden' })
        return
    }

    const { event, payload } = req.body as { event?: unknown; payload?: unknown }

    if (typeof event !== 'string' || event.length === 0) {
        res.status(400).json({ error: 'event must be a non-empty string' })
        return
    }

    getIo().emit(event, payload)
    res.status(204).end()
})

export { router as internalRouter }
