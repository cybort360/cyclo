/**
 * Checkout page hooks extracted from SubscribePage to keep that file under the
 * 300-line limit.
 *
 *   useCheckoutBrand — fetches merchant branding from the API for a given planId
 *   usePageMeta      — manages <title> and Open Graph tags for the checkout page
 */
import { useState, useEffect, useRef } from 'react'
import { fromUsdcUnits, intervalToLabel } from '../utils/formatting'
import type { PlanStruct } from './useSubscriptionManager'
import { API_BASE } from '../utils/apiBase'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CheckoutBrand {
    brandName:       string | null
    brandLogoUrl:    string | null
    brandColor:      string | null
    merchantAddress: string
}

// ── useCheckoutBrand ──────────────────────────────────────────────────────────

/**
 * Fetches merchant branding from GET /api/checkout-brand?planId=<id>.
 * Returns null on any fetch failure — branding is purely cosmetic and must
 * never block checkout functionality.
 */
export function useCheckoutBrand(planId: bigint): { brand: CheckoutBrand | null; loading: boolean } {
    const [brand,   setBrand]   = useState<CheckoutBrand | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch(`${API_BASE}/api/checkout-brand?planId=${planId.toString()}`)
            .then(r => r.ok ? (r.json() as Promise<CheckoutBrand>) : null)
            .then(data => setBrand(data))
            .catch(() => setBrand(null))
            .finally(() => setLoading(false))
    }, [planId])

    return { brand, loading }
}

// ── Meta tag helpers (private) ────────────────────────────────────────────────

function upsertMeta(property: string, content: string): void {
    let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
    if (!el) {
        el = document.createElement('meta')
        el.setAttribute('property', property)
        document.head.appendChild(el)
    }
    el.setAttribute('content', content)
}

function removeMeta(property: string): void {
    document.querySelector(`meta[property="${property}"]`)?.remove()
}

// ── usePageMeta ───────────────────────────────────────────────────────────────

/**
 * Sets document.title and Open Graph meta tags once branding has loaded.
 * A separate unmount-only effect restores the original title and removes all
 * injected tags when the component tears down.
 */
export function usePageMeta(
    brand:        CheckoutBrand | null,
    brandLoading: boolean,
    planId:       bigint,
    plan:         PlanStruct | undefined,
): void {
    const originalTitle = useRef(document.title)

    useEffect(() => {
        if (brandLoading) return
        const title = brand?.brandName ? `${brand.brandName} — Subscribe` : 'Subscribe via Cyclo'
        document.title = title
        upsertMeta('og:title', title)
        if (plan) {
            const price    = fromUsdcUnits(plan.price).toFixed(2)
            const interval = intervalToLabel(Number(plan.interval))
            upsertMeta('og:description', `Subscribe to Plan ${planId.toString()} for ${price} USDC / ${interval}`)
        }
        if (brand?.brandLogoUrl) upsertMeta('og:image', brand.brandLogoUrl)
        else                      removeMeta('og:image')
    }, [brandLoading, brand, planId, plan])

    // Cleanup runs on unmount only — captured title is stable across renders.
    useEffect(() => {
        const saved = originalTitle.current
        return () => {
            document.title = saved
            removeMeta('og:title')
            removeMeta('og:description')
            removeMeta('og:image')
        }
    }, [])
}
