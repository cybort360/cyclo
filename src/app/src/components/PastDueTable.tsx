/**
 * Table of past-due subscriptions for the merchant dashboard.
 *
 * Rows are sorted client-side by nextRetryAt ascending (soonest retry at top).
 * Renders all rows — no pagination required for under 100 rows.
 *
 * Columns:
 *   Subscriber | Plan | Amount | Attempts | Last Attempt | Next Retry | Failure Reason | Status
 */
import { useState } from 'react'
import { useEnsName } from 'wagmi'
import type { PastDueItem } from '../pages/PastDuePage'

// ── Time helpers ───────────────────────────────────────────────────────────────

/**
 * Returns a compact relative time string for a past ISO timestamp.
 * Examples: "just now", "5m ago", "2h ago", "3d ago"
 */
function relativeTime(isoStr: string): string {
    const diffMs = Date.now() - new Date(isoStr).getTime()
    const mins   = Math.floor(diffMs / 60_000)
    const hours  = Math.floor(diffMs / 3_600_000)
    const days   = Math.floor(diffMs / 86_400_000)
    if (mins  <  1) return 'just now'
    if (hours <  1) return `${mins}m ago`
    if (days  <  1) return `${hours}h ago`
    return `${days}d ago`
}

const ONE_DAY_MS = 24 * 3_600_000

/**
 * Returns a label for a future ISO timestamp.
 * Within 24 h: countdown ("in 4h 32m").
 * Beyond 24 h: locale absolute string ("May 25, 2:30 PM").
 */
function nextRetryLabel(isoStr: string): string {
    const diffMs = new Date(isoStr).getTime() - Date.now()
    if (diffMs <= 0) return 'overdue'
    if (diffMs < ONE_DAY_MS) {
        const hours = Math.floor(diffMs / 3_600_000)
        const mins  = Math.floor((diffMs % 3_600_000) / 60_000)
        if (hours > 0) return `in ${hours}h ${mins}m`
        return `in ${mins}m`
    }
    return new Date(isoStr).toLocaleString('en-US', {
        month:  'short',
        day:    'numeric',
        hour:   'numeric',
        minute: '2-digit',
    })
}

// ── Subscriber cell ────────────────────────────────────────────────────────────

interface SubscriberCellProps {
    /** Full lowercase wallet address. */
    address: string
}

/**
 * Shows ENS name when resolved, otherwise a truncated address.
 * A copy-to-clipboard button appears on hover.
 *
 * ENS resolution requires mainnet in the wagmi config; on Arc testnet
 * the hook returns undefined and the truncated address is shown.
 */
function SubscriberCell({ address }: SubscriberCellProps) {
    const [copied,  setCopied]  = useState(false)
    const [hovered, setHovered] = useState(false)
    const { data: ens } = useEnsName({ address: address as `0x${string}` })

    const display = ens ?? `${address.slice(0, 6)}…${address.slice(-4)}`

    function copy(): void {
        void navigator.clipboard.writeText(address)
        setCopied(true)
        setTimeout(() => setCopied(false), 2_000)
    }

    return (
        <div
            className="flex items-center gap-1.5"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <code className="text-[13px] font-mono text-gray-700">{display}</code>
            {hovered && (
                <button
                    onClick={copy}
                    className="shrink-0 text-[10px] px-1.5 py-0.5 rounded border border-gray-200
                               text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors"
                >
                    {copied ? '✓' : 'Copy'}
                </button>
            )}
        </div>
    )
}

// ── Attempts cell ─────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 3

/** "2 of 3" with three dots — amber-filled for each attempt made. */
function AttemptsCell({ count }: { count: number }) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-[13px] text-gray-700 tabular-nums whitespace-nowrap">
                {count} of {MAX_ATTEMPTS}
            </span>
            <div className="flex items-center gap-[3px]">
                {Array.from({ length: MAX_ATTEMPTS }, (_, i) => (
                    <span
                        key={i}
                        className={`inline-block w-[7px] h-[7px] rounded-full ${
                            i < count ? 'bg-amber-400' : 'bg-gray-200'
                        }`}
                    />
                ))}
            </div>
        </div>
    )
}

// ── Badge configs ─────────────────────────────────────────────────────────────

interface BadgeConfig { label: string; cls: string }

const REASON_BADGE: Record<PastDueItem['failureReason'], BadgeConfig> = {
    low_balance:   { label: 'Low balance',   cls: 'bg-amber-50  text-amber-700  border-amber-100'  },
    low_allowance: { label: 'Low allowance', cls: 'bg-orange-50 text-orange-700 border-orange-100' },
    unknown:       { label: 'Unknown',       cls: 'bg-gray-100  text-gray-500   border-gray-200'   },
}

const PILL = 'inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap'

// ── Shared cell class strings ──────────────────────────────────────────────────

const TH = 'px-3 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap'
const TD = 'px-3 py-3.5 text-[13px] align-middle border-b border-gray-50 last:border-0'

// ── Table ─────────────────────────────────────────────────────────────────────

export interface PastDueTableProps {
    items: PastDueItem[]
}

/** Renders past-due subscriptions sorted by nextRetryAt ascending. */
export function PastDueTable({ items }: PastDueTableProps) {
    const sorted = [...items].sort(
        (a, b) => new Date(a.nextRetryAt).getTime() - new Date(b.nextRetryAt).getTime()
    )

    return (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/80">
                            <th className={TH}>Subscriber</th>
                            <th className={TH}>Plan</th>
                            <th className={TH}>Amount</th>
                            <th className={TH}>Attempts</th>
                            <th className={TH}>Last Attempt</th>
                            <th className={TH}>Next Retry</th>
                            <th className={TH}>Failure Reason</th>
                            <th className={TH}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map(item => {
                            const msUntilRetry = new Date(item.nextRetryAt).getTime() - Date.now()
                            const retrySoon    = msUntilRetry > 0 && msUntilRetry < ONE_DAY_MS

                            return (
                                <tr
                                    key={`${item.planId}-${item.subscriber}`}
                                    className="hover:bg-gray-50/60 transition-colors"
                                >
                                    {/* Subscriber */}
                                    <td className={TD}>
                                        <SubscriberCell address={item.subscriber} />
                                    </td>

                                    {/* Plan */}
                                    <td className={TD}>
                                        <span className="text-gray-900">
                                            {item.planName ?? `Plan ${item.planId}`}
                                        </span>
                                    </td>

                                    {/* Amount */}
                                    <td className={TD}>
                                        <span className="font-medium text-gray-900 tabular-nums">
                                            {item.amount} USDC
                                        </span>
                                    </td>

                                    {/* Attempts */}
                                    <td className={TD}>
                                        <AttemptsCell count={item.attemptCount} />
                                    </td>

                                    {/* Last Attempt */}
                                    <td className={`${TD} text-gray-500`}>
                                        {relativeTime(item.lastAttemptAt)}
                                    </td>

                                    {/* Next Retry — amber when within 24 h; tooltip shows full datetime */}
                                    <td className={TD}>
                                        <span
                                            title={new Date(item.nextRetryAt).toLocaleString()}
                                            className={retrySoon
                                                ? 'font-medium text-amber-600'
                                                : 'text-gray-600'
                                            }
                                        >
                                            {nextRetryLabel(item.nextRetryAt)}
                                        </span>
                                    </td>

                                    {/* Failure Reason */}
                                    <td className={TD}>
                                        <span className={`${PILL} ${REASON_BADGE[item.failureReason].cls}`}>
                                            {REASON_BADGE[item.failureReason].label}
                                        </span>
                                    </td>

                                    {/* Status */}
                                    <td className={TD}>
                                        <span className={`${PILL} bg-amber-50 text-amber-700 border-amber-100`}>
                                            Past due
                                        </span>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
