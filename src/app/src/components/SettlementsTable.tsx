/**
 * SettlementsTable — custom dark-token table of PaymentCharged events.
 *
 * Implements its own CSS grid rows (not the DataTable component) so that
 * live rows arriving via Socket.io can receive a per-row slide-down animation
 * via the `stl-row--new` class.
 *
 * Columns: Time | Subscriber | Plan | Amount | Fee | Tx hash
 *
 * Time: derived from nextChargeTimestamp − plan.interval. Shows "just now"
 * for rows currently in newTxHashes (recently arrived via socket).
 *
 * Fee: 3% of the settlement amount (Cyclo protocol fee).
 *
 * Class prefix: stl-
 */
import { useMemo } from 'react'
import { IconExternalLink } from '@tabler/icons-react'
import type { PlanEvent, PaymentEvent } from '../hooks/useSubscriptionManager'
import { fromUsdcUnits, relativeTime } from '../utils/formatting'
import './SettlementsTable.css'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Cyclo protocol fee: 3% of each settlement. */
const PROTOCOL_FEE_BPS = 3

/** CSS grid template shared by header and every data row. */
const GRID = '80px 150px 90px 100px 80px 1fr'

const SKELETON_ROWS = 5

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Derives an approximate charge timestamp from nextChargeTimestamp − interval.
 * Returns null when either value is unavailable (0n sentinels for live rows).
 */
function chargeTime(event: PaymentEvent, planMap: Map<string, PlanEvent>): string | null {
    if (event.nextChargeTimestamp === 0n) return null
    const plan = planMap.get(event.planId.toString())
    if (!plan) return null
    const chargedAt = Number(event.nextChargeTimestamp - plan.interval) * 1_000
    return relativeTime(new Date(chargedAt).toISOString())
}

/** Truncates a hex hash to "0x1234…5678" format. */
function shortHash(hash: string): string {
    return `${hash.slice(0, 8)}…${hash.slice(-4)}`
}

/** Formats a fee amount: 3% of the raw USDC bigint. */
function feeDisplay(amount: bigint): string {
    const fee = fromUsdcUnits(amount) * PROTOCOL_FEE_BPS / 100
    return fee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Skeleton row shown while initial data loads. */
function SkeletonRow() {
    return (
        <div className="stl-row stl-row--skeleton" style={{ gridTemplateColumns: GRID }} aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="stl-cell">
                    <span className="stl-skeleton-bar" />
                </div>
            ))}
        </div>
    )
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface SettlementsTableProps {
    settlements:  PaymentEvent[]
    plans:        PlanEvent[]
    isLoading:    boolean
    error?:       string
    /** txHashes arriving live via socket — used to apply the slide-in animation. */
    newTxHashes?: ReadonlySet<string>
}

export function SettlementsTable({ settlements, plans, isLoading, error, newTxHashes }: SettlementsTableProps) {
    const planMap = useMemo(() => new Map(plans.map(p => [p.planId.toString(), p])), [plans])

    return (
        <div className="stl-wrap" role="table">

            {/* Header */}
            <div className="stl-header" style={{ gridTemplateColumns: GRID }} role="row">
                {['Time', 'Subscriber', 'Plan', 'Amount', 'Fee', 'Tx hash'].map(label => (
                    <div key={label} className="stl-th" role="columnheader">{label}</div>
                ))}
            </div>

            {/* Loading skeleton */}
            {isLoading && Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <SkeletonRow key={i} />
            ))}

            {/* Error */}
            {!isLoading && error && (
                <div className="stl-empty" role="row">
                    <p className="stl-empty-text" style={{ color: 'var(--danger)' }}>
                        Failed to load settlements: {error}
                    </p>
                </div>
            )}

            {/* Empty */}
            {!isLoading && !error && settlements.length === 0 && (
                <div className="stl-empty" role="row">
                    <p className="stl-empty-text">No settlements yet.</p>
                </div>
            )}

            {/* Rows */}
            {!isLoading && !error && settlements.map((s, i) => {
                const isNew     = newTxHashes?.has(s.txHash) ?? false
                const timeLabel = isNew ? 'just now' : (chargeTime(s, planMap) ?? '—')
                const amount    = fromUsdcUnits(s.amount)
                    .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })

                return (
                    <div
                        key={`${s.txHash}-${i}`}
                        className={`stl-row${isNew ? ' stl-row--new' : ''}`}
                        style={{ gridTemplateColumns: GRID }}
                        role="row"
                    >
                        {/* Time */}
                        <div className="stl-cell" role="cell">
                            <span className="stl-time">{timeLabel}</span>
                        </div>

                        {/* Subscriber */}
                        <div className="stl-cell" role="cell">
                            <span className="stl-addr">
                                {s.subscriber.slice(0, 6)}…{s.subscriber.slice(-4)}
                            </span>
                        </div>

                        {/* Plan */}
                        <div className="stl-cell stl-cell--mono" role="cell">
                            Plan {s.planId.toString()}
                        </div>

                        {/* Amount */}
                        <div className="stl-cell stl-cell--right" role="cell">
                            <span className="stl-amount">{amount}</span>
                        </div>

                        {/* Fee */}
                        <div className="stl-cell stl-cell--right" role="cell">
                            <span className="stl-fee">{feeDisplay(s.amount)}</span>
                        </div>

                        {/* Tx hash */}
                        <div className="stl-cell" role="cell">
                            <span className="stl-tx-cell">
                                <a
                                    href={`https://testnet.arcscan.app/tx/${s.txHash}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="stl-tx-link"
                                    title={s.txHash}
                                >
                                    {shortHash(s.txHash)}
                                </a>
                                <span className="stl-tx-icon">
                                    <IconExternalLink size={12} aria-hidden="true" />
                                </span>
                            </span>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
