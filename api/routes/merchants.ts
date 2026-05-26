import { Router, type Request, type Response } from 'express'
import { pool } from '../db.js'
import { buildMessage, verifySignature } from '../verify.js'

export const merchantsRouter = Router()

const SIGNATURE_TTL_MS = 5 * 60 * 1000

// ── Signature replay prevention ───────────────────────────────────────────────
// Track used (address:timestamp) pairs for the TTL window so a captured
// signature cannot be replayed. In-memory only — server restart clears it,
// but signatures expire quickly enough to bound the exposure window.
const usedSignatures = new Map<string, number>() // key → expiresAt ms

function pruneUsedSignatures(): void {
    const now = Date.now()
    for (const [key, exp] of usedSignatures) {
        if (now > exp) usedSignatures.delete(key)
    }
}

// ── Validation ────────────────────────────────────────────────────────────────

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/

/**
 * Validates a hostname string (e.g. "checkout.acme.com").
 * Allows letters, digits, hyphens and dots. Each DNS label must start and
 * end with an alphanumeric character and be ≤ 63 chars. Total ≤ 253 chars.
 */
const HOSTNAME_RE =
    /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/

function isValidUrl(value: string): boolean {
    try {
        const u = new URL(value)
        return u.protocol === 'http:' || u.protocol === 'https:'
    } catch {
        return false
    }
}

function isValidHostname(value: string): boolean {
    return value.length <= 253 && HOSTNAME_RE.test(value)
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

interface AuthBody {
    address:   string
    timestamp: number
    signature: string
}

/**
 * Read-only auth: verifies TTL + signature but does NOT mark the signature
 * as used. This lets the frontend cache a single signature and reuse it for
 * polling GET endpoints within the 4-minute client cache window.
 */
function checkGetAuth(body: AuthBody, res: Response): boolean {
    const { address, timestamp, signature } = body
    if (!address || !timestamp || !signature) {
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

function checkAuth(body: AuthBody, res: Response): boolean {
    const { address, timestamp, signature } = body
    if (!address || !timestamp || !signature) {
        res.status(400).json({ error: 'Missing address, timestamp, or signature' })
        return false
    }
    if (Date.now() - timestamp > SIGNATURE_TTL_MS) {
        res.status(401).json({ error: 'Signature expired' })
        return false
    }

    // Replay prevention: reject signatures that have already been accepted
    // within the current TTL window.
    pruneUsedSignatures()
    const sigKey = `${address.toLowerCase()}:${timestamp}`
    if (usedSignatures.has(sigKey)) {
        res.status(401).json({ error: 'Signature already used' })
        return false
    }

    const message = buildMessage(address, timestamp)
    if (!verifySignature(address, message, signature)) {
        res.status(401).json({ error: 'Invalid signature' })
        return false
    }

    // Mark signature as used for the remainder of its TTL
    usedSignatures.set(sigKey, Date.now() + SIGNATURE_TTL_MS)
    return true
}

// ── Brand-field validation helper ─────────────────────────────────────────────

/**
 * Validates the four optional brand fields.
 * Returns an error message string if any field is invalid, or null if all pass.
 */
function validateBrandFields(fields: {
    brandLogoUrl?:    unknown
    brandColor?:      unknown
    customSubdomain?: unknown
}): string | null {
    const { brandLogoUrl, brandColor, customSubdomain } = fields

    if (brandLogoUrl !== undefined && brandLogoUrl !== null) {
        if (typeof brandLogoUrl !== 'string' || !isValidUrl(brandLogoUrl)) {
            return 'brandLogoUrl must be a valid http or https URL'
        }
    }

    if (brandColor !== undefined && brandColor !== null) {
        if (typeof brandColor !== 'string' || !HEX_COLOR_RE.test(brandColor)) {
            return 'brandColor must be a 6-digit hex color code (e.g. "#6366f1")'
        }
    }

    if (customSubdomain !== undefined && customSubdomain !== null) {
        if (typeof customSubdomain !== 'string' || !isValidHostname(customSubdomain)) {
            return 'customSubdomain must be a valid hostname (e.g. "checkout.acme.com")'
        }
    }

    return null
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /api/merchants
 * Create or upsert a merchant profile.
 * Body (camelCase): address, businessName, email, logoUrl,
 *   brandName, brandLogoUrl, brandColor, customSubdomain, timestamp, signature
 */
merchantsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
    const {
        address, businessName, email, logoUrl,
        brandName, brandLogoUrl, brandColor, customSubdomain,
        timestamp, signature,
    } = req.body

    if (!address) { res.status(400).json({ error: 'address is required' }); return }
    if (!checkAuth({ address, timestamp, signature }, res)) return

    if (!businessName || !email) {
        res.status(400).json({ error: 'businessName and email are required' })
        return
    }

    const brandErr = validateBrandFields({ brandLogoUrl, brandColor, customSubdomain })
    if (brandErr) { res.status(400).json({ error: brandErr }); return }

    const result = await pool.query(
        `INSERT INTO merchant_profiles
             (wallet_address, business_name, email, logo_url,
              brand_name, brand_logo_url, brand_color, custom_subdomain,
              updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (wallet_address) DO UPDATE SET
             business_name    = $2,
             email            = $3,
             logo_url         = $4,
             brand_name       = $5,
             brand_logo_url   = $6,
             brand_color      = $7,
             custom_subdomain = $8,
             updated_at       = NOW()
         RETURNING
             wallet_address, business_name, email, logo_url,
             brand_name, brand_logo_url, brand_color, custom_subdomain`,
        [
            address.toLowerCase(),
            businessName,
            email,
            logoUrl          ?? null,
            brandName        ?? null,
            brandLogoUrl     ?? null,
            brandColor       ?? null,
            customSubdomain  ?? null,
        ]
    )
    res.json(result.rows[0])
})

/**
 * GET /api/merchants/:address
 * Returns the full merchant profile including brand fields.
 * Requires signature auth (query params: timestamp, signature) because
 * the response contains PII (email address).
 *
 * Uses TTL-only verification (no replay prevention) so the frontend can
 * poll with a cached signature without being rejected on the second call.
 */
merchantsRouter.get('/:address', async (req: Request, res: Response): Promise<void> => {
    const { address } = req.params
    const timestamp = Number(req.query.timestamp)
    const signature = req.query.signature as string | undefined

    // Require auth so the email field is only served to the profile owner.
    // Read-only → TTL check + sig verify only; no replay prevention.
    if (!checkGetAuth({ address, timestamp, signature: signature ?? '' }, res)) return

    const result = await pool.query(
        `SELECT
             wallet_address, business_name, email, logo_url,
             brand_name, brand_logo_url, brand_color, custom_subdomain,
             created_at
         FROM merchant_profiles
         WHERE wallet_address = $1`,
        [address.toLowerCase()]
    )
    if (result.rows.length === 0) {
        res.status(404).json({ error: 'Profile not found' })
        return
    }
    res.json(result.rows[0])
})

/**
 * POST /api/merchants/:address
 * Update a merchant profile.
 * Body (snake_case): business_name, email, logo_url,
 *   brand_name, brand_logo_url, brand_color, custom_subdomain, timestamp, signature
 */
merchantsRouter.post('/:address', async (req: Request, res: Response): Promise<void> => {
    const { address } = req.params
    const {
        business_name, email, logo_url,
        brand_name, brand_logo_url, brand_color, custom_subdomain,
        timestamp, signature,
    } = req.body

    if (!checkAuth({ address, timestamp, signature }, res)) return

    if (!business_name || !email) {
        res.status(400).json({ error: 'business_name and email are required' })
        return
    }

    const brandErr = validateBrandFields({
        brandLogoUrl:    brand_logo_url,
        brandColor:      brand_color,
        customSubdomain: custom_subdomain,
    })
    if (brandErr) { res.status(400).json({ error: brandErr }); return }

    const result = await pool.query(
        `INSERT INTO merchant_profiles
             (wallet_address, business_name, email, logo_url,
              brand_name, brand_logo_url, brand_color, custom_subdomain,
              updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (wallet_address) DO UPDATE SET
             business_name    = $2,
             email            = $3,
             logo_url         = $4,
             brand_name       = $5,
             brand_logo_url   = $6,
             brand_color      = $7,
             custom_subdomain = $8,
             updated_at       = NOW()
         RETURNING
             wallet_address, business_name, email, logo_url,
             brand_name, brand_logo_url, brand_color, custom_subdomain`,
        [
            address.toLowerCase(),
            business_name,
            email,
            logo_url         ?? null,
            brand_name       ?? null,
            brand_logo_url   ?? null,
            brand_color      ?? null,
            custom_subdomain ?? null,
        ]
    )
    res.json(result.rows[0])
})

/**
 * PATCH /api/merchants/:address
 * Partially updates brand identity fields. business_name and email are not
 * touched — callers only need to send the four brand fields (all optional).
 * Body (snake_case): brand_name, brand_logo_url, brand_color, custom_subdomain,
 *   timestamp, signature
 */
merchantsRouter.patch('/:address', async (req: Request, res: Response): Promise<void> => {
    const { address } = req.params
    const {
        brand_name, brand_logo_url, brand_color, custom_subdomain,
        timestamp, signature,
    } = req.body

    if (!checkAuth({ address, timestamp, signature }, res)) return

    const brandErr = validateBrandFields({
        brandLogoUrl:    brand_logo_url,
        brandColor:      brand_color,
        customSubdomain: custom_subdomain,
    })
    if (brandErr) { res.status(400).json({ error: brandErr }); return }

    // Upsert: insert a stub row if none exists, then update brand columns.
    // business_name / email default to '' on the insert path so the NOT NULL
    // constraint is satisfied; they are never overwritten on conflict.
    // Empty string is stored as NULL so callers can clear fields by sending ''.
    const result = await pool.query(
        `INSERT INTO merchant_profiles
             (wallet_address, business_name, email,
              brand_name, brand_logo_url, brand_color, custom_subdomain,
              updated_at)
         VALUES ($1, '', '', $2, $3, $4, $5, NOW())
         ON CONFLICT (wallet_address) DO UPDATE SET
             brand_name       = EXCLUDED.brand_name,
             brand_logo_url   = EXCLUDED.brand_logo_url,
             brand_color      = EXCLUDED.brand_color,
             custom_subdomain = EXCLUDED.custom_subdomain,
             updated_at       = NOW()
         RETURNING
             wallet_address, business_name, email, logo_url,
             brand_name, brand_logo_url, brand_color, custom_subdomain`,
        [
            address.toLowerCase(),
            brand_name        || null,
            brand_logo_url    || null,
            brand_color       || null,
            custom_subdomain  || null,
        ]
    )
    res.json(result.rows[0])
})

// ── Webhook routes (unchanged) ────────────────────────────────────────────────

// ── Webhook routes ────────────────────────────────────────────────────────────

merchantsRouter.get('/:address/webhooks', async (req: Request, res: Response): Promise<void> => {
    const { address } = req.params
    const timestamp = Number(req.query.timestamp)
    const signature = req.query.signature as string | undefined

    // Require auth: webhook URLs are sensitive (attackers with them can send
    // forged webhook deliveries and bypass signature checks if secrets leak).
    // Read-only → use TTL-only check so cached signatures can be reused.
    if (!checkGetAuth({ address, timestamp, signature: signature ?? '' }, res)) return

    const result = await pool.query(
        'SELECT id, plan_id, url, active, created_at FROM merchant_webhooks WHERE wallet_address = $1 ORDER BY created_at ASC',
        [address.toLowerCase()]
    )
    res.json(result.rows)
})

merchantsRouter.post('/:address/webhooks', async (req: Request, res: Response): Promise<void> => {
    const { address } = req.params
    const { planId, plan_id, url, secret, timestamp, signature } = req.body
    const resolvedPlanId = planId ?? plan_id ?? '*'

    if (!checkAuth({ address, timestamp, signature }, res)) return

    if (!url || !secret) {
        res.status(400).json({ error: 'url and secret are required' })
        return
    }

    const result = await pool.query(
        `INSERT INTO merchant_webhooks (wallet_address, plan_id, url, secret)
         VALUES ($1, $2, $3, $4)
         RETURNING id, plan_id, url, active, created_at`,
        [address.toLowerCase(), resolvedPlanId, url, secret]
    )
    res.status(201).json(result.rows[0])
})

merchantsRouter.delete('/:address/webhooks/:id', async (req: Request, res: Response): Promise<void> => {
    const { address, id } = req.params
    const { timestamp, signature } = req.body

    if (!checkAuth({ address, timestamp, signature }, res)) return

    const result = await pool.query(
        'DELETE FROM merchant_webhooks WHERE id = $1 AND wallet_address = $2 RETURNING id',
        [id, address.toLowerCase()]
    )
    if (result.rows.length === 0) {
        res.status(404).json({ error: 'Webhook not found' })
        return
    }
    res.json({ deleted: id })
})
