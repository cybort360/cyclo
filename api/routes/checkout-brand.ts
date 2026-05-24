/**
 * GET /api/checkout-brand?planId=<planId>
 *
 * Public, no-auth endpoint used by the checkout page to load merchant branding.
 *
 * 1. Parses planId from query string.
 * 2. Calls getPlan(planId) on the SubscriptionManager contract to resolve the
 *    merchant wallet address.
 * 3. Looks up merchant_profiles in Postgres by wallet address.
 * 4. Returns branding fields (nulls if no merchant record exists).
 *
 * Response is cached for 60 seconds — plan merchant addresses change rarely.
 */
import { Router, type Request, type Response } from 'express'
import { ethers } from 'ethers'
import { pool } from '../db.js'

const router = Router()

// ── Minimal ABI — only the view function we need ──────────────────────────────

const GET_PLAN_ABI = [
    {
        type:   'function',
        name:   'getPlan',
        inputs: [{ name: 'planId', type: 'uint256' }],
        outputs: [{
            name: '',
            type: 'tuple',
            components: [
                { name: 'merchant',      type: 'address' },
                { name: 'active',        type: 'bool'    },
                { name: 'trialDuration', type: 'uint48'  },
                { name: 'price',         type: 'uint256' },
                { name: 'interval',      type: 'uint256' },
            ],
        }],
        stateMutability: 'view',
    },
] as const

// ── Lazy contract singleton ───────────────────────────────────────────────────

// Initialised on first request so missing env vars don't crash the server at
// startup (other routes still work if branding is not configured).
let _contract: ethers.Contract | null = null

function getContract(): ethers.Contract {
    if (!_contract) {
        const rpcUrl       = process.env.ARC_RPC_URL
        const contractAddr = process.env.CONTRACT_ADDRESS
        if (!rpcUrl || !contractAddr) {
            throw new Error('ARC_RPC_URL and CONTRACT_ADDRESS env vars are required')
        }
        const provider = new ethers.JsonRpcProvider(rpcUrl)
        _contract = new ethers.Contract(contractAddr, GET_PLAN_ABI, provider)
    }
    return _contract
}

// ── Response type ─────────────────────────────────────────────────────────────

interface CheckoutBrandResponse {
    brandName:       string | null
    brandLogoUrl:    string | null
    brandColor:      string | null
    merchantAddress: string
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
    const { planId } = req.query

    if (!planId || typeof planId !== 'string') {
        res.status(400).json({ error: 'planId query param is required' })
        return
    }

    // Accept only decimal integer strings — reject floats, negatives, hex.
    if (!/^\d+$/.test(planId)) {
        res.status(400).json({ error: 'planId must be a non-negative integer' })
        return
    }

    // ── 1. Resolve merchant address from contract ─────────────────────────────
    let merchantAddress: string
    try {
        const plan = await getContract().getPlan(BigInt(planId)) as {
            merchant:      string
            active:        boolean
            trialDuration: bigint
            price:         bigint
            interval:      bigint
        }
        merchantAddress = plan.merchant.toLowerCase()
    } catch (err) {
        const msg = String(err)
        // Custom error PlanNotFound(planId) is thrown when the plan doesn't exist.
        if (msg.includes('PlanNotFound') || msg.includes('execution reverted')) {
            res.status(404).json({ error: `Plan ${planId} not found` })
        } else {
            res.status(502).json({ error: 'Failed to read plan from contract' })
        }
        return
    }

    // ── 2. Look up merchant branding in Postgres ──────────────────────────────
    const result = await pool.query<{
        brand_name:       string | null
        brand_logo_url:   string | null
        brand_color:      string | null
    }>(
        `SELECT brand_name, brand_logo_url, brand_color
         FROM merchant_profiles
         WHERE wallet_address = $1`,
        [merchantAddress]
    )

    const row = result.rows[0] ?? null

    // Per spec: no merchant record → return nulls, not 404.
    const body: CheckoutBrandResponse = {
        brandName:       row?.brand_name     ?? null,
        brandLogoUrl:    row?.brand_logo_url ?? null,
        brandColor:      row?.brand_color    ?? null,
        merchantAddress,
    }

    // Cache for 60 seconds — plan ownership and branding change infrequently.
    res.set('Cache-Control', 'public, max-age=60')
    res.json(body)
})

export default router
