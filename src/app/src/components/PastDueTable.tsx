/**
 * PastDueTable — DataTable wrapper for past-due subscriptions.
 *
 * Rows are sorted by nextRetryAt ascending (soonest retry at top).
 * Row click opens the PastDueDrawer; the original PastDueItem is
 * encoded as _idx in the row record and decoded in the click handler.
 *
 * Columns: Subscriber | Plan | Amount due | Attempts | Next Retry | Reason
 *
 * Class prefix: pdt-
 */
import { useMemo, type ReactNode } from 'react'
import { useEnsName } from 'wagmi'
import { DataTable, type DataTableColumn } from './DataTable'
import { avatarPalette } from '../utils/avatar'
import type { PastDueItem } from '../pages/PastDuePage'
import './PastDueTable.css'

// ── Constants ─────────────────────────────────────────────────────────────────

const ONE_DAY_MS   = 86_400_000
const MAX_ATTEMPTS = 3

const COLUMNS: DataTableColumn[] = [
    { key: 'subscriber', label: 'Subscriber',  width: '200px' },
    { key: 'plan',       label: 'Plan',         width: '1fr' },
    { key: 'amount',     label: 'Amount due',   width: '110px', align: 'right', mono: true },
    { key: 'attempts',   label: 'Attempts',     width: '120px' },
    { key: 'nextRetry',  label: 'Next Retry',   width: '130px', mono: true },
    { key: 'reason',     label: 'Reason',       width: '120px' },
]

const REASON_BADGE: Record<PastDueItem['failureReason'], { label: string; cls: string }> = {
    low_balance:   { label: 'Low balance',   cls: 'pdt-badge--warning' },
    low_allowance: { label: 'Low allowance', cls: 'pdt-badge--violet' },
    unknown:       { label: 'Unknown',       cls: 'pdt-badge--secondary' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns a compact label for a future ISO retry timestamp.
 * Within 24 h: countdown ("in 4h 32m"). Beyond: absolute locale string.
 */
function nextRetryLabel(isoStr: string): string {
    const diffMs = new Date(isoStr).getTime() - Date.now()
    if (diffMs <= 0) return 'overdue'
    if (diffMs < ONE_DAY_MS) {
        const h = Math.floor(diffMs / 3_600_000)
        const m = Math.floor((diffMs % 3_600_000) / 60_000)
        return h > 0 ? `in ${h}h ${m}m` : `in ${m}m`
    }
    return new Date(isoStr).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** 28px avatar + truncated address or ENS. Hook-bearing component per row. */
function SubscriberCell({ address }: { address: string }) {
    const { data: ens } = useEnsName({ address: address as `0x${string}` })
    const display       = ens ?? `${address.slice(0, 6)}…${address.slice(-4)}`
    const { bg, text }  = avatarPalette(address)
    const initials      = address.slice(2, 4).toUpperCase()
    return (
        <span className="pdt-sub-cell">
            <span className="pdt-avatar" style={{ background: bg, color: text }}>{initials}</span>
            <span className="pdt-sub-label">{display}</span>
        </span>
    )
}

/** "X of 3" text + three filled/empty dots. */
function AttemptDots({ count }: { count: number }) {
    return (
        <span className="pdt-attempts">
            <span className="pdt-attempts-label">{count} of {MAX_ATTEMPTS}</span>
            <span className="pdt-dots">
                {Array.from({ length: MAX_ATTEMPTS }, (_, i) => (
                    <span key={i} className={`pdt-dot${i < count ? ' pdt-dot--filled' : ''}`} />
                ))}
            </span>
        </span>
    )
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface PastDueTableProps {
    items:      PastDueItem[]
    isLoading:  boolean
    onSelect:   (item: PastDueItem) => void
}

/** Renders past-due subscriptions sorted by nextRetryAt ascending. */
export function PastDueTable({ items, isLoading, onSelect }: PastDueTableProps) {
    const sorted: PastDueItem[] = useMemo(() =>
        [...items].sort(
            (a, b) => new Date(a.nextRetryAt).getTime() - new Date(b.nextRetryAt).getTime()
        ),
        [items]
    )

    // Build DataTable row records. _idx stores the row index for the click handler.
    const tableRows: Record<string, ReactNode>[] = useMemo(() =>
        sorted.map((item, idx) => {
            const retrySoon =
                new Date(item.nextRetryAt).getTime() - Date.now() < ONE_DAY_MS &&
                new Date(item.nextRetryAt).getTime() > Date.now()
            const badge = REASON_BADGE[item.failureReason]

            return {
                _idx:      String(idx),
                subscriber: <SubscriberCell address={item.subscriber} />,
                plan:       item.planName ?? `Plan ${item.planId}`,
                amount:     `${item.amount} USDC`,
                attempts:   <AttemptDots count={item.attemptCount} />,
                nextRetry:  (
                    <span
                        className={retrySoon ? 'pdt-retry--soon' : ''}
                        title={new Date(item.nextRetryAt).toLocaleString()}
                    >
                        {nextRetryLabel(item.nextRetryAt)}
                    </span>
                ),
                reason: (
                    <span className={`pdt-badge ${badge.cls}`}>{badge.label}</span>
                ),
            }
        }),
        [sorted]
    )

    function handleRowClick(row: Record<string, ReactNode>): void {
        const idx  = Number(row['_idx'])
        const item = sorted[idx]
        if (item) onSelect(item)
    }

    return (
        <DataTable
            columns={COLUMNS}
            rows={tableRows}
            isLoading={isLoading}
            skeletonRows={4}
            onRowClick={handleRowClick}
        />
    )
}
