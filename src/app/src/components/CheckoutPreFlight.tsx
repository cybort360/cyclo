/**
 * Pre-flight banners for the checkout page.
 *
 * Returns null when pre-flight is loading, succeeded (reason 0), or the
 * reason is unrecognised — the caller handles the button skeleton separately.
 * Uses co-banner co-banner--* CSS classes from SubscribePage.css.
 */
import { Link } from 'wouter'
import { fromUsdcUnits } from '../utils/formatting'

interface CheckoutPreFlightProps {
    isLoading:   boolean
    reason:      number | null
    usdcBalance: bigint
    planPrice:   bigint
}

export function CheckoutPreFlight({
    isLoading, reason, usdcBalance, planPrice,
}: CheckoutPreFlightProps) {
    if (isLoading || reason === null || reason === 0) return null

    // Reason 1: already subscribed to this plan
    if (reason === 1) {
        return (
            <div className="co-banner co-banner--violet">
                You're already subscribed to this plan.{' '}
                <Link href="/portal" className="co-banner-link">
                    Manage your subscriptions →
                </Link>
            </div>
        )
    }

    // Reason 2: USDC balance too low
    if (reason === 2) {
        return (
            <div className="co-banner co-banner--amber">
                <p style={{ margin: '0 0 6px' }}>
                    Your balance ({fromUsdcUnits(usdcBalance).toFixed(2)} USDC) is below the
                    plan price ({fromUsdcUnits(planPrice).toFixed(2)} USDC).
                </p>
                <a
                    href="https://faucet.arc.io"
                    target="_blank"
                    rel="noreferrer"
                    className="co-banner-link"
                >
                    Get testnet USDC →
                </a>
            </div>
        )
    }

    // Reason 3: USDC allowance needs refresh — subscribeToPlan re-approves automatically
    if (reason === 3) {
        return (
            <div className="co-banner co-banner--violet">
                USDC allowance needs to be refreshed. Click Subscribe to approve and retry.
            </div>
        )
    }

    // Reason 4: plan deactivated at contract level
    if (reason === 4) {
        return (
            <div className="co-banner co-banner--danger">
                This plan is no longer active and cannot accept new subscribers.
            </div>
        )
    }

    return null
}
