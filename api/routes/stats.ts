/**
 * Public protocol stats endpoint — no auth required.
 * Aggregates plan, subscription, and charge data from PostgreSQL.
 */
import { Router, type Request, type Response } from 'express'
import { pool } from '../db.js'

const router = Router()

interface StatsRow {
    total_plans: string
    active_plans: string
    total_subscriptions: string
    active_subscriptions: string
    total_charges: string
    total_volume: string
    unique_merchants: string
}

router.get('/', async (_req: Request, res: Response): Promise<void> => {
    const result = await pool.query<StatsRow>(`
        SELECT
            (SELECT COUNT(*)               FROM plans)                                         AS total_plans,
            (SELECT COUNT(*)               FROM plans        WHERE active = true)              AS active_plans,
            (SELECT COUNT(*)               FROM subscriptions)                                 AS total_subscriptions,
            (SELECT COUNT(*)               FROM subscriptions WHERE status = 'active')         AS active_subscriptions,
            (SELECT COUNT(*)               FROM execution_logs WHERE status = 'success')       AS total_charges,
            (SELECT COALESCE(SUM(amount::NUMERIC), 0)
                                           FROM execution_logs WHERE status = 'success'
                                             AND amount IS NOT NULL
                                             AND amount ~ '^[0-9]+$')                          AS total_volume,
            (SELECT COUNT(DISTINCT merchant) FROM plans)                                       AS unique_merchants
    `)

    const row = result.rows[0]
    res.json({
        totalPlans:          Number(row.total_plans),
        activePlans:         Number(row.active_plans),
        totalSubscriptions:  Number(row.total_subscriptions),
        activeSubscriptions: Number(row.active_subscriptions),
        totalCharges:        Number(row.total_charges),
        totalVolumeUsdc:     Number(row.total_volume) / 1_000_000,
        uniqueMerchants:     Number(row.unique_merchants),
    })
})

export default router
