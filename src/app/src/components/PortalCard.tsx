/**
 * PortalCard — subscription card for the subscriber portal.
 *
 * Exports formatters used by PortalPage and PortalModals, so they live
 * in one place without a separate utilities file.
 *
 * Uses prt- CSS classes from PortalPage.css.
 */
import { useState, type MouseEvent } from 'react'
import { useAccount } from 'wagmi'
import { useIsSubscribed } from '@cyclo/react'
import type { PortalSubscription } from '../hooks/usePortalSubscriptions'
import { fromUsdcUnits, intervalToLabel } from '../utils/formatting'

// ── Exported formatters (also used by PortalModals) ──────────────────────────

export const fmtUsdc = (raw: bigint) =>
    fromUsdcUnits(raw).toLocaleString('en-US', {
        style: 'currency', currency: 'USD', minimumFractionDigits: 2,
    })

export const fmtDate = (ts: bigint) =>
    new Date(Number(ts) * 1000).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    })

export const fmtAddress = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`

export function daysUntil(ts: bigint): number {
    return Math.ceil((Number(ts) * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
}

export function formatCountdown(ts: bigint): string {
    const days = daysUntil(ts)
    if (days < 0)   return 'overdue'
    if (days === 0) return 'today'
    if (days === 1) return 'tomorrow'
    return `in ${days} days`
}

export function formatTrialDuration(seconds: bigint): string {
    if (seconds === 0n) return ''
    const days = Number(seconds) / 86_400
    if (days === 1)             return '1-day trial'
    if (Number.isInteger(days)) return `${days}-day trial`
    return `${Number(seconds)}s trial`
}

function formatTrialBadge(trialEndDate: bigint): string {
    const days = daysUntil(trialEndDate)
    if (days <= 0)  return 'Trial ends today'
    if (days === 1) return 'Trial ends in 1 day'
    return `Trial ends in ${days} days`
}

// ── SoulboundBadge ────────────────────────────────────────────────────────────

/**
 * Reads wallet address via useAccount so the parent card does not need to
 * pass it. Returns null when the NFT contract is not deployed or the token
 * is not minted for this plan.
 */
function SoulboundBadge({ planId }: { planId: bigint }) {
    const { address }                    = useAccount()
    const { isSubscribed, isLoading } = useIsSubscribed(
        address as `0x${string}` | undefined,
        planId,
    )

    if (isLoading) return <span className="prt-nft-skel" aria-hidden="true" />
    if (!isSubscribed) return null

    return <span className="prt-nft-badge">◆ Soulbound</span>
}

// ── SubscriptionCard ──────────────────────────────────────────────────────────

export interface CardProps {
    subscription:    PortalSubscription
    isCancelling:    boolean
    isMigrating:     boolean
    isFading:        boolean
    onCancelRequest: () => void
    onSwitchRequest: () => void
}

export function SubscriptionCard({
    subscription, isCancelling, isMigrating, isFading,
    onCancelRequest, onSwitchRequest,
}: CardProps) {
    const { plan, planId, nextChargeTimestamp, isInTrial, trialEndDate } = subscription
    const [copied, setCopied] = useState(false)
    const isAnyPending        = isCancelling || isMigrating

    function handleCopy(e: MouseEvent<HTMLButtonElement>): void {
        e.stopPropagation()
        void navigator.clipboard.writeText(plan.merchant).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2_000)
        })
    }

    const priceStr = fromUsdcUnits(plan.price).toLocaleString('en-US', {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
    })

    return (
        <div className={`prt-card${isFading ? ' prt-card--fading' : ''}`}>

            {/* Top row: plan name + NFT badge */}
            <div className="prt-card-top">
                <p className="prt-plan-name">Plan {planId.toString()}</p>
                <SoulboundBadge planId={planId} />
            </div>

            {/* Price + interval */}
            <div className="prt-price-row">
                <span className="prt-price">{priceStr}</span>
                <span className="prt-interval">/ {intervalToLabel(Number(plan.interval))}</span>
            </div>

            {/* Trial badge */}
            {isInTrial && trialEndDate !== null && (
                <span className="prt-trial-badge">{formatTrialBadge(trialEndDate)}</span>
            )}

            {/* Next charge countdown */}
            <p className="prt-countdown">
                {isInTrial ? 'First charge' : 'Next charge'}{' '}
                {fmtDate(nextChargeTimestamp)} ({formatCountdown(nextChargeTimestamp)})
            </p>

            {/* Merchant — compact, copyable */}
            <p className="prt-countdown" style={{ marginTop: '4px' }}>
                Merchant:{' '}
                <a
                    href={`https://testnet.arcscan.app/address/${plan.merchant}`}
                    target="_blank" rel="noreferrer"
                    style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace' }}
                >
                    {fmtAddress(plan.merchant)}
                </a>
                <button
                    onClick={handleCopy}
                    style={{ background: 'none', border: 'none', cursor: 'pointer',
                             color: 'var(--text-tertiary)', fontSize: '11px', marginLeft: '4px' }}
                    title={copied ? 'Copied!' : 'Copy address'}
                >
                    {copied ? '✓' : '⧉'}
                </button>
            </p>

            {/* Action row */}
            <div className="prt-actions">
                <button
                    className="prt-btn-switch"
                    onClick={onSwitchRequest}
                    disabled={isAnyPending}
                >
                    {isMigrating ? 'Migrating…' : 'Switch plan'}
                </button>
                <button
                    className="prt-btn-cancel"
                    onClick={onCancelRequest}
                    disabled={isAnyPending}
                >
                    {isCancelling ? 'Cancelling…' : 'Cancel'}
                </button>
            </div>
        </div>
    )
}
