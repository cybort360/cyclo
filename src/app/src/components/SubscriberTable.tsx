/**
 * SubscriberTable — tabbed table of all subscribers using the DataTable shell.
 *
 * Tabs filter rows by status (All / Active / Past due / Cancelled).
 * Search (passed from SubscribersPage) filters by address or planId.
 *
 * Amount is derived from merchant's PlanEvent price (USDC, 6 decimals).
 * Next Charge is derived from the latest PaymentCharged event for each pair.
 * ENS names are resolved per-row via wagmi; on Arc testnet this returns undefined.
 *
 * Class prefix: sbt-
 */
import { useState, useMemo, type ReactNode } from 'react'
import { useEnsName } from 'wagmi'
import { IconChevronRight } from '@tabler/icons-react'
import { DataTable, StatusBadge, type DataTableColumn } from './DataTable'
import { useSubscriptionManager } from '../hooks/useSubscriptionManager'
import { avatarPalette } from '../utils/avatar'
import { fromUsdcUnits } from '../utils/formatting'
import type { SubscriberRow, SubscriberStatus } from '../hooks/useSubscriberList'
import './SubscriberTable.css'

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'all' | SubscriberStatus

interface Props {
    rows:      SubscriberRow[]
    isLoading: boolean
    search:    string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'all',       label: 'All' },
    { id: 'active',    label: 'Active' },
    { id: 'past_due',  label: 'Past due' },
    { id: 'cancelled', label: 'Cancelled' },
]

const COLUMNS: DataTableColumn[] = [
    { key: 'subscriber', label: 'Subscriber',   width: '220px' },
    { key: 'plan',       label: 'Plan',          width: '1fr' },
    { key: 'amount',     label: 'Amount',        width: '110px', align: 'right', mono: true },
    { key: 'nextCharge', label: 'Next Charge',   width: '130px', mono: true },
    { key: 'status',     label: 'Status',        width: '100px' },
    { key: '_chevron',   label: '',              width: '32px' },
]

const TAB_EMPTY: Record<Tab, { heading: string; sub: string }> = {
    all:       { heading: '', sub: '' },
    active:    { heading: 'No active subscribers',   sub: 'All current subscribers have cancelled or are past due.' },
    past_due:  { heading: 'No past due subscribers', sub: 'All subscriptions are current.' },
    cancelled: { heading: 'No cancelled subscribers', sub: 'Nobody has cancelled yet.' },
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** 28px avatar circle with deterministic 5-colour palette. */
function SubscriberAvatar({ addr }: { addr: string }) {
    const { bg, text } = avatarPalette(addr)
    // Use hex digits 2-3 of the address as initials (address is always "0x…")
    const initials = addr.slice(2, 4).toUpperCase()
    return (
        <span className="sbt-avatar" style={{ background: bg, color: text }}>
            {initials}
        </span>
    )
}

/**
 * Subscriber cell: avatar circle + truncated address or resolved ENS name.
 * Calls useEnsName — must be rendered as a React element (not called in map).
 */
function SubscriberCell({ address }: { address: string }) {
    const { data: ens } = useEnsName({ address: address as `0x${string}` })
    const display = ens ?? `${address.slice(0, 6)}…${address.slice(-4)}`
    return (
        <span className="sbt-sub-cell">
            <SubscriberAvatar addr={address} />
            <span className="sbt-sub-label">{display}</span>
        </span>
    )
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Tabbed subscriber table. Receives pre-fetched rows and a search query;
 * all filtering is done client-side.
 */
export function SubscriberTable({ rows, isLoading, search }: Props) {
    const [activeTab, setActiveTab] = useState<Tab>('all')
    const { plans, settlements } = useSubscriptionManager()

    // Build planId → price lookup from merchant's on-chain PlanCreated events.
    const planPriceMap = useMemo(() => {
        const map = new Map<string, bigint>()
        for (const p of plans) {
            map.set(p.planId.toString(), p.price)
        }
        return map
    }, [plans])

    // Build (planId:subscriber) → latestNextCharge from PaymentCharged events.
    const nextChargeMap = useMemo(() => {
        const map = new Map<string, bigint>()
        for (const s of settlements) {
            const key      = `${s.planId.toString()}:${s.subscriber.toLowerCase()}`
            const existing = map.get(key)
            if (!existing || s.nextChargeTimestamp > existing) {
                map.set(key, s.nextChargeTimestamp)
            }
        }
        return map
    }, [settlements])

    // Tab counts.
    const counts: Record<Tab, number> = useMemo(() => ({
        all:       rows.length,
        active:    rows.filter(r => r.status === 'active').length,
        past_due:  rows.filter(r => r.status === 'past_due').length,
        cancelled: rows.filter(r => r.status === 'cancelled').length,
    }), [rows])

    // Filter by tab + search query.
    const filtered: SubscriberRow[] = useMemo(() => {
        let result = activeTab === 'all' ? rows : rows.filter(r => r.status === activeTab)
        const q = search.trim().toLowerCase()
        if (q) {
            result = result.filter(r =>
                r.subscriber.toLowerCase().includes(q) ||
                r.planId.includes(q)
            )
        }
        return result
    }, [rows, activeTab, search])

    // Build DataTable row records.
    const tableRows: Record<string, ReactNode>[] = useMemo(() =>
        filtered.map(row => {
            const price     = planPriceMap.get(row.planId)
            const tsRaw     = nextChargeMap.get(row.key)
            const nextCharge = tsRaw !== undefined
                ? new Date(Number(tsRaw) * 1_000).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric',
                })
                : '—'
            const amountStr = price !== undefined
                ? `${fromUsdcUnits(price).toFixed(2)} USDC`
                : '—'

            return {
                subscriber: <SubscriberCell address={row.subscriber} />,
                plan:       `Plan ${row.planId}`,
                amount:     <span className="sbt-amount">{amountStr}</span>,
                nextCharge,
                status:     <StatusBadge status={row.status} />,
                _chevron:   <span className="sbt-chevron"><IconChevronRight size={16} /></span>,
            }
        }),
        [filtered, planPriceMap, nextChargeMap]
    )

    // Per-tab inline empty state (only shown when a tab filter yields 0 rows).
    const showTabEmpty = filtered.length === 0 && rows.length > 0 && activeTab !== 'all'

    return (
        <div>
            {/* ── Tab row ───────────────────────────────────────── */}
            <div className="sbt-tabs" role="tablist">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        className={`sbt-tab${activeTab === tab.id ? ' sbt-tab--active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                        {counts[tab.id] > 0 && (
                            <span className="sbt-tab-badge">{counts[tab.id]}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── Table ─────────────────────────────────────────── */}
            {showTabEmpty ? (
                <div className="sbt-empty">
                    <p className="sbt-empty-heading">{TAB_EMPTY[activeTab].heading}</p>
                    <p className="sbt-empty-sub">{TAB_EMPTY[activeTab].sub}</p>
                </div>
            ) : (
                <DataTable
                    columns={COLUMNS}
                    rows={tableRows}
                    isLoading={isLoading}
                    skeletonRows={6}
                />
            )}
        </div>
    )
}
