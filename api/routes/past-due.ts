/**
 * Past-due subscription routes for the merchant dashboard.
 *
 * GET /api/merchants/:merchantAddress/past-due
 *   Returns subscriptions in grace period owned by this merchant.
 *   Filters: status = 'past_due', retry_count BETWEEN 1 AND 3.
 *   Derives next_retry_at and failure_reason from keeper tables when
 *   the dedicated columns are NULL (pre-migration or un-backfilled rows).
 *
 * GET /api/merchants/:merchantAddress/past-due/count
 *   Returns { count: number }. Cached in-process for 30 seconds — used
 *   by the sidebar badge so it is fetched on every navigation.
 */
import { Router, type Request, type Response } from 'express'
import { pool } from '../db.js'
import { buildMessage, verifySignature } from '../verify.js'

// ── Types ──────────────────────────────────────────────────────────────────────

/** Shape returned by the list query before formatting. */
interface PastDueRow {
    subscriber:     string
    plan_id:        string
    plan_name:      string | null
    price:          string
    retry_count:    number
    /** Unix-seconds as string; COALESCE guarantees non-null when last_retry is set. */
    next_retry_at:  string | null
    last_retry:     string | null
    failure_reason: string | null
}

/** Public response shape for each past-due subscription. */
interface PastDueItem {
    subscriber:    string
    planId:        string
    planName:      string | null
    amount:        string
    attemptCount:  number
    nextRetryAt:   string
    lastAttemptAt: string
    failureReason: 'low_balance' | 'low_allowance' | 'unknown'
}

// ── In-process cache for the count endpoint ───────────────────────────────────

const CACHE_TTL_MS = 30_000

interface CountCacheEntry {
    count:     number
    expiresAt: number
}

/** Keyed by lowercased merchant address. */
const countCache = new Map<string, CountCacheEntry>()

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Formats a raw 6-decimal USDC amount string as a human-readable decimal.
 * "9990000" → "9.99", "10000000" → "10".
 */
function formatUsdc(raw: string): string {
    const n     = BigInt(raw)
    const whole = n / 1_000_000n
    const frac  = n % 1_000_000n
    if (frac === 0n) return whole.toString()
    return `${whole}.${frac.toString().padStart(6, '0').replace(/0+$/, '')}`
}

/**
 * Converts a unix-seconds string to ISO-8601.
 * Returns the Unix epoch string when the value is null (defensive fallback only
 * — matching rows always have last_retry set by markPastDue).
 */
function toIso(unixSecs: string | null): string {
    if (unixSecs === null) return new Date(0).toISOString()
    return new Date(Number(unixSecs) * 1_000).toISOString()
}

/** Narrows the raw DB string to the failure-reason union. */
function toFailureReason(raw: string | null): 'low_balance' | 'low_allowance' | 'unknown' {
    if (raw === 'low_balance' || raw === 'low_allowance') return raw
    return 'unknown'
}

// ── Auth helper ───────────────────────────────────────────────────────────────

const SIGNATURE_TTL_MS = 5 * 60 * 1000

/**
 * Validates timestamp + signature query params for GET endpoints.
 * Past-due data contains subscriber billing info — it must only be
 * accessible to the merchant who owns those plans.
 */
function checkGetAuth(address: string, req: Request, res: Response): boolean {
    const timestamp = Number(req.query.timestamp)
    const signature = (req.query.signature as string | undefined) ?? ''

    if (!timestamp || !signature) {
        res.status(401).json({ error: 'timestamp and signature query params required' })
        return false
    }
    if (Date.now() - timestamp > SIGNATURE_TTL_MS) {
        res.status(401).json({ error: 'Signature expired' })
        return false
    }
    const message = buildMessage(address, timestamp)
    if (!verifySignature(address, message, signature)) {
        res.status(401).json({ error: 'Invalid signature' })
        return false
    }
    return true
}

// ── Router ────────────────────────────────────────────────────────────────────

export const pastDueRouter = Router()

/**
 * 24-hour retry interval in seconds — mirrors RETRY_INTERVAL_MS in
 * keeper/scheduler.ts. Used to derive next_retry_at when the column is NULL.
 */
const KEEPER_RETRY_INTERVAL_SECS = 86_400

/**
 * Reason codes that map to named failure reasons.
 * Source: REASON constant in keeper/executor.ts and keeper/scheduler.ts.
 */
const REASON_LOW_BALANCE  = 2
const REASON_LOW_ALLOWANCE = 3

/**
 * GET /api/merchants/:merchantAddress/past-due
 *
 * Returns all subscriptions in the keeper's grace period for plans owned
 * by this merchant. Ordered by last_retry descending (most recent failure first).
 */
pastDueRouter.get(
    '/:merchantAddress/past-due',
    async (req: Request, res: Response): Promise<void> => {
        try {
            const merchantAddress = req.params.merchantAddress.toLowerCase()

            if (!checkGetAuth(merchantAddress, req, res)) return

            const result = await pool.query<PastDueRow>(
                `SELECT
                     s.subscriber,
                     s.plan_id,
                     p.plan_name,
                     p.price,
                     s.retry_count,
                     COALESCE(
                         s.next_retry_at,
                         s.last_retry + $2
                     )::TEXT AS next_retry_at,
                     s.last_retry::TEXT AS last_retry,
                     COALESCE(
                         s.failure_reason,
                         (
                             SELECT CASE el.reason_code
                                        WHEN $3 THEN 'low_balance'
                                        WHEN $4 THEN 'low_allowance'
                                        ELSE        'unknown'
                                    END
                             FROM execution_logs el
                             WHERE el.plan_id    = s.plan_id
                               AND el.subscriber = s.subscriber
                               AND el.status     = 'skipped'
                               AND el.reason_code IN ($3, $4)
                             ORDER BY el.created_at DESC
                             LIMIT 1
                         ),
                         'unknown'
                     ) AS failure_reason
                 FROM subscriptions s
                 JOIN plans p ON s.plan_id = p.plan_id
                 WHERE p.merchant     = $1
                   AND s.status       = 'past_due'
                   AND s.retry_count  BETWEEN 1 AND 3
                 ORDER BY s.last_retry DESC NULLS LAST`,
                [merchantAddress, KEEPER_RETRY_INTERVAL_SECS, REASON_LOW_BALANCE, REASON_LOW_ALLOWANCE]
            )

            const items: PastDueItem[] = result.rows.map(row => ({
                subscriber:    row.subscriber,
                planId:        row.plan_id,
                planName:      row.plan_name,
                amount:        formatUsdc(row.price),
                attemptCount:  row.retry_count,
                nextRetryAt:   toIso(row.next_retry_at),
                lastAttemptAt: toIso(row.last_retry),
                failureReason: toFailureReason(row.failure_reason),
            }))

            res.json(items)
        } catch (err) {
            console.error('[past-due] list error', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    }
)

/**
 * GET /api/merchants/:merchantAddress/past-due/count
 *
 * Returns { count: number }. Cached per merchant address for 30 seconds.
 * The count matches the same filter as the list endpoint so the sidebar badge
 * stays consistent with the table.
 */
pastDueRouter.get(
    '/:merchantAddress/past-due/count',
    async (req: Request, res: Response): Promise<void> => {
        try {
            const merchantAddress = req.params.merchantAddress.toLowerCase()

            if (!checkGetAuth(merchantAddress, req, res)) return

            const cached = countCache.get(merchantAddress)
            if (cached && Date.now() < cached.expiresAt) {
                res.json({ count: cached.count })
                return
            }

            const result = await pool.query<{ count: string }>(
                `SELECT COUNT(*) AS count
                 FROM subscriptions s
                 JOIN plans p ON s.plan_id = p.plan_id
                 WHERE p.merchant    = $1
                   AND s.status      = 'past_due'
                   AND s.retry_count BETWEEN 1 AND 3`,
                [merchantAddress]
            )

            const count = Number(result.rows[0].count)
            countCache.set(merchantAddress, { count, expiresAt: Date.now() + CACHE_TTL_MS })
            res.json({ count })
        } catch (err) {
            console.error('[past-due] count error', err)
            res.status(500).json({ error: 'Internal server error' })
        }
    }
)
