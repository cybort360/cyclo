/**
 * Success panel shown after a subscription transaction confirms on-chain.
 * Replaces the subscribe button area — no re-submission is possible.
 *
 * Animated SVG checkmark uses CSS stroke-dashoffset animation.
 * Circle circumference ≈ 157 (2π × 25); mark path length ≈ 36.
 * Both use var(--accent) (#00FF87) — hardcoded for SVG attribute compatibility.
 *
 * Uses co- CSS classes from SubscribePage.css.
 */
import { Link } from 'wouter'
import { fromUsdcUnits } from '../utils/formatting'

// SVG stroke must be a hex value — CSS custom properties do not work in
// SVG presentation attributes. This hex mirrors the --accent token.
const ACCENT_HEX = '#00FF87'

interface CheckoutSuccessProps {
    planPrice:           bigint
    /** Unix timestamp (seconds) from getSubscription().nextChargeTimestamp. */
    nextChargeTimestamp: bigint
    /** True when the soulbound NFT contract is deployed and token is minted. */
    hasNft:              boolean
    merchantName:        string | null
    /** Validated http/https return URL from the ?return= query param, or null. */
    returnUrl:           string | null
}

export function CheckoutSuccess({
    planPrice, nextChargeTimestamp, hasNft, merchantName, returnUrl,
}: CheckoutSuccessProps) {
    const amount   = fromUsdcUnits(planPrice).toFixed(2)
    const nextDate = nextChargeTimestamp > 0n
        ? new Date(Number(nextChargeTimestamp) * 1000).toLocaleDateString()
        : null

    return (
        <div className="co-success">

            {/* Animated SVG checkmark */}
            <svg viewBox="0 0 52 52" width="48" height="48" aria-hidden="true">
                <circle
                    className="co-check-circle"
                    cx="26" cy="26" r="25"
                    fill="none" stroke={ACCENT_HEX} strokeWidth="2"
                />
                <path
                    className="co-check-mark"
                    fill="none" stroke={ACCENT_HEX} strokeWidth="3"
                    strokeLinecap="round" strokeLinejoin="round"
                    d="M14 27l9 9 16-16"
                />
            </svg>

            {/* Heading + next charge */}
            <div>
                <h2 className="co-success-title">You're subscribed!</h2>
                {nextDate && (
                    <p className="co-success-date">
                        Next payment of {amount} USDC on {nextDate}
                    </p>
                )}
            </div>

            {/* Soulbound NFT confirmation */}
            {hasNft && (
                <p className="co-success-nft">
                    ◆ Soulbound subscription token minted to your wallet
                </p>
            )}

            {/* Navigation */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Link href="/portal" className="co-success-portal">
                    Manage your subscriptions →
                </Link>
                {returnUrl && (
                    <a href={returnUrl} className="co-success-return">
                        ← Back to {merchantName ?? 'merchant'}
                    </a>
                )}
            </div>
        </div>
    )
}
