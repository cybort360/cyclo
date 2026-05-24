/**
 * Subdomain-aware redirect middleware.
 *
 * Inspects the Host header on every incoming request. Requests arriving on
 * localhost, 127.0.0.1, ::1, or the primary app domain are passed through
 * unchanged. Any other hostname is treated as a potential custom merchant
 * subdomain and handled as follows:
 *
 *   1. Query merchant_profiles for a row where custom_subdomain = host.
 *   2. If found, query plans for the lowest active plan_id for that merchant.
 *      Redirect 302 to /subscribe/<planId>.
 *   3. If the subdomain is not found → 404 "Subdomain not configured".
 *   4. If the subdomain is found but the merchant has no active plans → 404.
 *
 * Database errors propagate to Express's error handler via next(err).
 *
 * Set CYCLO_PRIMARY_DOMAIN to the apex domain (e.g. "cyclo.xyz"). Requests to
 * that domain and all its subdomains are treated as system traffic and passed
 * through.
 */
import { type Request, type Response, type NextFunction } from 'express'
import { pool } from '../db.js'

const PRIMARY_DOMAIN = (process.env.CYCLO_PRIMARY_DOMAIN ?? 'cyclo.xyz').toLowerCase()

/**
 * Returns true if the host belongs to the system (should not be treated as a
 * custom merchant subdomain).
 */
function isSystemHost(host: string): boolean {
    return (
        host === 'localhost'  ||
        host === '127.0.0.1' ||
        host === '::1'       ||
        host === PRIMARY_DOMAIN ||
        host.endsWith(`.${PRIMARY_DOMAIN}`)
    )
}

interface MerchantRow { wallet_address: string }
interface PlanRow     { plan_id: string }

export async function subdomainRouter(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    const rawHost = req.headers.host ?? ''
    // Strip port number so "checkout.acme.com:3001" → "checkout.acme.com"
    const host = rawHost.split(':')[0].toLowerCase()

    if (!host || isSystemHost(host)) {
        next()
        return
    }

    try {
        // ── 1. Look up merchant by custom subdomain ──────────────────────────
        const merchantResult = await pool.query<MerchantRow>(
            `SELECT wallet_address
             FROM merchant_profiles
             WHERE custom_subdomain = $1`,
            [host]
        )

        if (merchantResult.rows.length === 0) {
            res.status(404).type('text/plain').send('Subdomain not configured')
            return
        }

        const { wallet_address } = merchantResult.rows[0]

        // ── 2. Find the lowest active planId for this merchant ───────────────
        // plan_id is stored as TEXT representing a uint256. Casting to BIGINT is
        // safe for realistic plan counts (uint256 values up to ~9.2 × 10^18 can
        // exceed BIGINT, but plan IDs in practice are small incrementing integers).
        const planResult = await pool.query<PlanRow>(
            `SELECT plan_id
             FROM plans
             WHERE LOWER(merchant) = $1
               AND active = true
             ORDER BY plan_id::BIGINT ASC
             LIMIT 1`,
            [wallet_address]
        )

        if (planResult.rows.length === 0) {
            res.status(404).type('text/plain').send('No active plans for this merchant')
            return
        }

        const { plan_id } = planResult.rows[0]

        // ── 3. Redirect to the checkout page ─────────────────────────────────
        res.redirect(302, `/subscribe/${plan_id}`)
    } catch (err) {
        next(err)
    }
}
