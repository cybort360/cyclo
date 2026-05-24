/**
 * /subscribers — merchant view of all wallets subscribed to their plans.
 *
 * Owns the page header (title, count pill, Export CSV, Invite subscriber)
 * and the full-width search bar. SubscriberTable handles tabs + DataTable.
 *
 * Export CSV: serialises currently-visible rows to a browser download.
 * Invite subscriber: copies the checkout URL of the first active plan.
 */
import { useState, useMemo } from 'react'
import { IconSearch } from '@tabler/icons-react'
import { useSubscriptionManager } from '../hooks/useSubscriptionManager'
import { useSubscriberList } from '../hooks/useSubscriberList'
import { SubscriberTable } from '../components/SubscriberTable'
import { useRightPanel } from '../context/RightPanelContext'
import { SubscribersPanel } from '../components/SubscribersPanel'
import type { SubscriberRow } from '../hooks/useSubscriberList'
import './SubscribersPage.css'

// ── CSV export ────────────────────────────────────────────────────────────────

/** Builds and triggers a browser CSV download for the supplied subscriber rows. */
function exportCsv(rows: SubscriberRow[]): void {
    const header = ['Subscriber', 'Plan ID', 'Status']
    const lines  = rows.map(r => [r.subscriber, r.planId, r.status].join(','))
    const csv    = [header.join(','), ...lines].join('\n')
    const blob   = new Blob([csv], { type: 'text/csv' })
    const url    = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href     = url
    anchor.download = 'subscribers.csv'
    anchor.click()
    URL.revokeObjectURL(url)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SubscribersPage() {
    const { plans, planStatuses } = useSubscriptionManager()
    const { data: rows = [], isLoading } = useSubscriberList()
    const [search,  setSearch]  = useState('')
    const [invited, setInvited] = useState(false)

    const panel = useMemo(() => <SubscribersPanel />, [])
    useRightPanel(panel, [])

    const firstActivePlan = plans.find(
        p => planStatuses.get(p.planId.toString()) !== false
    )

    /** Copies the checkout URL of the first active plan. */
    function handleInvite(): void {
        if (!firstActivePlan) return
        const url = `${window.location.origin}/subscribe/${firstActivePlan.planId}`
        void navigator.clipboard.writeText(url).then(() => {
            setInvited(true)
            setTimeout(() => setInvited(false), 2_000)
        })
    }

    return (
        <div>
            {/* ── Header ────────────────────────────────────────── */}
            <div className="sbp-header">
                <div className="sbp-header-left">
                    <h1 className="sbp-title">Subscribers</h1>
                    <span className="sbp-count-pill">{rows.length.toLocaleString()}</span>
                </div>
                <div className="sbp-header-right">
                    <button
                        className="sbp-btn-secondary"
                        onClick={() => exportCsv(rows)}
                        disabled={rows.length === 0}
                    >
                        Export CSV
                    </button>
                    <button
                        className="sbp-btn-primary"
                        onClick={handleInvite}
                        disabled={!firstActivePlan}
                    >
                        {invited ? 'Link copied!' : 'Invite subscriber'}
                    </button>
                </div>
            </div>

            {/* ── Search ────────────────────────────────────────── */}
            <div className="sbp-search-wrap">
                <IconSearch size={16} className="sbp-search-icon" aria-hidden="true" />
                <input
                    className="sbp-search-input"
                    placeholder="Search wallet, plan, ENS…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    aria-label="Search subscribers"
                />
            </div>

            {/* ── Table ─────────────────────────────────────────── */}
            <SubscriberTable rows={rows} isLoading={isLoading} search={search} />
        </div>
    )
}
