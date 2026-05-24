/**
 * PastDuePanel — right-panel content for the /past-due page.
 * Self-contained; fetches past-due data independently via the same
 * REST endpoint as PastDuePage so React can batch with any cached state.
 * Injected via useRightPanel() from PastDuePage.
 * Class prefix: pdp-  (past-due panel)
 */
import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import './PanelShared.css'
import './PastDuePanel.css'

// ── Type (mirrors PastDuePage.PastDueItem to avoid circular import) ────────────

interface PastDueItem {
    subscriber:   string
    planId:       string
    amount:       string
    attemptCount: number
    nextRetryAt:  string
    failureReason: 'low_balance' | 'low_allowance' | 'unknown'
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface ReasonRowProps {
    label: string
    count: number
}

function ReasonRow({ label, count }: ReasonRowProps) {
    return (
        <div className="pdp-reason-row">
            <span className="pdp-reason-label">{label}</span>
            <span className="pdp-reason-count">{count}</span>
        </div>
    )
}

// ── Attempt dots ──────────────────────────────────────────────────────────────

function AttemptDots({ count }: { count: number }) {
    return (
        <span className="pdp-dots" aria-label={`${count} of 3 attempts`}>
            {[1, 2, 3].map(n => (
                <span
                    key={n}
                    className={`pdp-dot${n <= count ? ' pdp-dot--filled' : ''}`}
                />
            ))}
        </span>
    )
}

// ── Timeline row ──────────────────────────────────────────────────────────────

interface TimelineRowProps {
    item: PastDueItem
}

function TimelineRow({ item }: TimelineRowProps) {
    const retryTime = new Date(item.nextRetryAt).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit',
    })
    const shortAddr = `${item.subscriber.slice(0, 6)}…${item.subscriber.slice(-4)}`

    return (
        <div className="pdp-timeline-row">
            <span className="pdp-retry-time">{retryTime}</span>
            <span className="pdp-timeline-addr">{shortAddr}</span>
            <AttemptDots count={item.attemptCount} />
        </div>
    )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function PastDuePanel() {
    const { address }    = useAccount()
    const [items, setItems] = useState<PastDueItem[]>([])

    useEffect(() => {
        if (!address) return
        fetch(`/api/merchants/${address.toLowerCase()}/past-due`)
            .then(r => (r.ok ? r.json() as Promise<PastDueItem[]> : []))
            .then(setItems)
            .catch(() => {})
    }, [address])

    const total        = items.reduce((s, i) => s + parseFloat(i.amount), 0)
    const lowBalance   = items.filter(i => i.failureReason === 'low_balance').length
    const lowAllowance = items.filter(i => i.failureReason === 'low_allowance').length
    const unknown      = items.filter(i => i.failureReason === 'unknown').length

    const fmtUsdc = (n: number) =>
        n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

    // Upcoming retries: sorted soonest-first, top 5
    const upcoming = [...items]
        .sort((a, b) => new Date(a.nextRetryAt).getTime() - new Date(b.nextRetryAt).getTime())
        .slice(0, 5)

    return (
        <div className="pn-panel">

            {/* ── Section 1: Grace period summary ─────────────────────── */}
            <p className="pn-section-label">At-risk USDC</p>
            <p className="pdp-total">{fmtUsdc(total)}</p>
            <p className="pdp-sub">{items.length} {items.length === 1 ? 'subscription' : 'subscriptions'} in grace period</p>

            {items.length > 0 && (
                <div className="pdp-reason-rows">
                    {lowBalance   > 0 && <ReasonRow label="Low balance"   count={lowBalance} />}
                    {lowAllowance > 0 && <ReasonRow label="Low allowance" count={lowAllowance} />}
                    {unknown      > 0 && <ReasonRow label="Unknown"       count={unknown} />}
                </div>
            )}

            {items.length === 0 && (
                <p className="pn-empty" style={{ marginTop: '8px' }}>No past-due subscriptions.</p>
            )}

            <hr className="pn-divider" />

            {/* ── Section 2: Retry timeline ────────────────────────────── */}
            <p className="pn-section-label">Next Retries</p>
            {upcoming.length === 0 ? (
                <p className="pn-empty">No retries scheduled.</p>
            ) : (
                <div className="pdp-timeline">
                    {upcoming.map(item => (
                        <TimelineRow key={`${item.planId}:${item.subscriber}`} item={item} />
                    ))}
                </div>
            )}

        </div>
    )
}
