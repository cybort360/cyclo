/**
 * RecentSettlementsTable — live feed of recent on-chain settlements.
 *
 * Pre-seeded with the merchant's subscribers on mount (all statuses so the
 * status badge system is visible in the demo); new rows prepend automatically
 * when the keeper settles a charge via Socket.io.
 *
 * New socket rows slide in from the top over 300ms and hold an accent-light
 * highlight for 2 s before fading to their normal stripe colour.
 *
 * Supports text search by subscriber address or plan ID.
 * Class prefix: st-
 */
import {
    useState, useEffect, useCallback, useMemo,
    useRef, type ChangeEvent,
} from 'react'
import { IconSearch, IconAdjustmentsHorizontal, IconDotsVertical } from '@tabler/icons-react'
import { useSocket, type PaymentChargedPayload } from '../hooks/useSocket'
import type { SubscriberRow } from '../hooks/useSubscriberList'
import type { PlanMetrics } from '../hooks/useAnalytics'
import { addressColor } from '../utils/avatar'
import './RecentSettlementsTable.css'

// ── Types ─────────────────────────────────────────────────────────────────────

type SubscriberStatus = 'active' | 'past_due' | 'cancelled'

interface SettlementRow {
    /** Unique key — txHash for live rows, synthetic key for seeded rows */
    key:        string
    subscriber: string
    planId:     string
    /** USDC amount as human-readable float */
    amount:     number
    timestamp:  number
    status:     SubscriberStatus
    isNew:      boolean
}

export interface RecentSettlementsTableProps {
    /** Subscribers used to seed the initial row set */
    subscribers: SubscriberRow[]
    /** Plan data for looking up prices when seeding rows */
    plans:       PlanMetrics[]
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function AvatarCircle({ address }: { address: string }) {
    const { bg, text } = addressColor(address)
    return (
        <span className="st-avatar" style={{ background: bg, color: text }}>
            {address.slice(2, 4).toUpperCase()}
        </span>
    )
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<SubscriberStatus, string> = {
    active:    'Active',
    past_due:  'Past Due',
    cancelled: 'Cancelled',
}

function StatusBadge({ status }: { status: SubscriberStatus }) {
    return (
        <span className={`st-badge st-badge--${status.replace('_', '-')}`}>
            {STATUS_LABEL[status]}
        </span>
    )
}

// ── Row component ─────────────────────────────────────────────────────────────

function SettlementRowItem({ row }: { row: SettlementRow }) {
    const shortAddr = `${row.subscriber.slice(0, 6)}…${row.subscriber.slice(-4)}`
    const fmtDate   = new Date(row.timestamp).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric',
    })
    const fmtAmount = row.amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })

    return (
        <tr className={`st-row${row.isNew ? ' st-row--new' : ''}`}>
            <td className="st-cell st-cell--subscriber">
                <AvatarCircle address={row.subscriber} />
                <span className="st-addr">{shortAddr}</span>
            </td>
            <td className="st-cell st-cell--date">{fmtDate}</td>
            <td className="st-cell">
                <span className="st-plan-badge">Plan {row.planId}</span>
            </td>
            <td className="st-cell st-cell--amount">{fmtAmount} USDC</td>
            <td className="st-cell st-cell--status">
                <StatusBadge status={row.status} />
            </td>
            <td className="st-cell st-cell--kebab">
                <button className="st-kebab" aria-label="Row actions">
                    <IconDotsVertical size={14} aria-hidden="true" />
                </button>
            </td>
        </tr>
    )
}

// ── Component ─────────────────────────────────────────────────────────────────

/** Maximum rows retained in memory — prevents unbounded growth during long sessions. */
const MAX_ROWS = 50

export function RecentSettlementsTable({ subscribers, plans }: RecentSettlementsTableProps) {
    const { onPaymentCharged } = useSocket()
    const [rows, setRows]      = useState<SettlementRow[]>([])
    const [query, setQuery]    = useState('')

    // Seed with subscribers on mount; stagger timestamps so the list shows a
    // spread of dates. Include all statuses so status badges are visible.
    const seedRows = useMemo<SettlementRow[]>(() => {
        const priceMap = new Map(plans.map(p => [p.planId.toString(), p.price]))
        return subscribers
            .slice(0, 12)
            .map((s, i) => ({
                key:        `seed-${s.key}`,
                subscriber: s.subscriber,
                planId:     s.planId,
                amount:     priceMap.get(s.planId) ?? 0,
                timestamp:  Date.now() - i * 3_600_000,   // spread 1 h apart
                status:     s.status as SubscriberStatus,
                isNew:      false,
            }))
    }, [subscribers, plans])

    const seededRef = useRef(false)
    useEffect(() => {
        if (seededRef.current) return
        setRows(seedRows)
        seededRef.current = true
    }, [seedRows])

    // Prepend socket-delivered rows; cap list to avoid memory growth
    useEffect(() => {
        return onPaymentCharged((payload: PaymentChargedPayload) => {
            const newRow: SettlementRow = {
                key:        payload.txHash,
                subscriber: payload.subscriber,
                planId:     payload.planId,
                amount:     parseFloat(payload.amount),
                timestamp:  payload.timestamp * 1_000,
                status:     'active',
                isNew:      true,
            }
            setRows(prev => [newRow, ...prev].slice(0, MAX_ROWS))
        })
    }, [onPaymentCharged])

    const handleSearch = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value)
    }, [])

    const filtered = useMemo(() => {
        const q = query.toLowerCase().trim()
        if (!q) return rows
        return rows.filter(r =>
            r.subscriber.toLowerCase().includes(q) || r.planId.includes(q)
        )
    }, [rows, query])

    return (
        <div className="st-wrap">

            {/* ── Top bar ───────────────────────────────────────────────── */}
            <div className="st-bar">
                <span className="st-heading">Recent Settlements</span>
                <div className="st-bar-right">
                    <div className="st-search">
                        <IconSearch size={13} className="st-search-icon" aria-hidden="true" />
                        <input
                            type="text"
                            className="st-search-input"
                            placeholder="Filter by address or plan..."
                            value={query}
                            onChange={handleSearch}
                            aria-label="Filter settlements"
                        />
                    </div>
                    <button className="st-filter-btn" aria-label="Filter options">
                        <IconAdjustmentsHorizontal size={15} aria-hidden="true" />
                    </button>
                </div>
            </div>

            {filtered.length === 0 ? (
                <p className="st-empty">
                    {rows.length === 0
                        ? 'No settlements yet — charges appear here as they arrive.'
                        : 'No results match your filter.'}
                </p>
            ) : (
                <div className="st-table-wrap">
                    <table className="st-table" aria-label="Recent settlements">
                        <thead>
                            <tr>
                                <th className="st-th">Subscriber</th>
                                <th className="st-th">Date</th>
                                <th className="st-th">Plan</th>
                                <th className="st-th">Amount</th>
                                <th className="st-th">Status</th>
                                <th className="st-th" aria-hidden="true" />
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(row => (
                                <SettlementRowItem key={row.key} row={row} />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

        </div>
    )
}
