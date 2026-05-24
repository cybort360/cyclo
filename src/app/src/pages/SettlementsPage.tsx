/**
 * /settlements — merchant view of all PaymentCharged events.
 *
 * Summary bar shows total settled USDC and protocol fees (3%).
 * Live rows arrive via Socket.io and are prepended with a slide-in animation.
 * A plan filter dropdown appears when the merchant has more than one plan.
 *
 * Class prefix: sep-
 */
import { useState, useEffect, useMemo } from 'react'
import { useSubscriptionManager, type PaymentEvent } from '../hooks/useSubscriptionManager'
import { useSocket } from '../hooks/useSocket'
import { SettlementsTable } from '../components/SettlementsTable'
import { fromUsdcUnits, toUsdcUnits } from '../utils/formatting'
import { useRightPanel } from '../context/RightPanelContext'
import { SettlementsPanel } from '../components/SettlementsPanel'
import './SettlementsPage.css'

type Address = `0x${string}`

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address
/** Protocol fee rate: 3% of each settlement. */
const FEE_RATE = 0.03

// ── CSV export ────────────────────────────────────────────────────────────────

/** Builds and triggers a CSV download from the current filtered settlements. */
function exportCsv(rows: PaymentEvent[]): void {
    const header = ['Plan ID', 'Subscriber', 'Amount (USDC)', 'Tx Hash']
    const lines  = rows.map(r => [
        r.planId.toString(),
        r.subscriber,
        fromUsdcUnits(r.amount).toFixed(6),
        r.txHash,
    ].join(','))
    const csv    = [header.join(','), ...lines].join('\n')
    const blob   = new Blob([csv], { type: 'text/csv' })
    const url    = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = 'settlements.csv'; anchor.click()
    URL.revokeObjectURL(url)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SettlementsPage() {
    const { settlements, isLoadingSettlements, settlementsError, plans } = useSubscriptionManager()
    const { onPaymentCharged } = useSocket()

    const panel = useMemo(() => <SettlementsPanel />, [])
    useRightPanel(panel, [])

    const [selectedPlanId, setSelectedPlanId] = useState<string>('all')
    const [liveRows,       setLiveRows]       = useState<PaymentEvent[]>([])
    const [newTxHashes,    setNewTxHashes]    = useState<ReadonlySet<string>>(new Set())

    // Subscribe to live keeper events.
    useEffect(() => {
        const timers: ReturnType<typeof setTimeout>[] = []

        const off = onPaymentCharged(payload => {
            const row: PaymentEvent = {
                planId:              BigInt(payload.planId),
                subscriber:          payload.subscriber as Address,
                merchant:            ZERO_ADDRESS,
                amount:              toUsdcUnits(payload.amount),
                nextChargeTimestamp: 0n,   // not in socket payload; shown as "just now"
                txHash:              payload.txHash as Address,
            }
            setLiveRows(prev => [row, ...prev])
            setNewTxHashes(prev => new Set([...prev, payload.txHash]))

            // Clear highlight after animation finishes (2 s).
            const t = setTimeout(() => {
                setNewTxHashes(prev => {
                    const next = new Set(prev); next.delete(payload.txHash); return next
                })
            }, 2_000)
            timers.push(t)
        })

        return () => { off(); timers.forEach(clearTimeout) }
    }, [onPaymentCharged])

    // Merge live rows above historical; deduplicate by txHash.
    const liveHashes = useMemo(() => new Set(liveRows.map(r => r.txHash)), [liveRows])
    const allRows    = useMemo(
        () => [...liveRows, ...settlements.filter(s => !liveHashes.has(s.txHash))],
        [liveRows, settlements, liveHashes]
    )

    const filtered = selectedPlanId === 'all'
        ? allRows
        : allRows.filter(s => s.planId.toString() === selectedPlanId)

    // Summary totals over the filtered set.
    const totalRaw   = useMemo(() => filtered.reduce((acc, s) => acc + s.amount, 0n), [filtered])
    const totalUsdc  = fromUsdcUnits(totalRaw)
    const feesUsdc   = totalUsdc * FEE_RATE

    const planFilterEmpty = selectedPlanId !== 'all' && filtered.length === 0 && allRows.length > 0

    return (
        <div>
            {/* ── Header ────────────────────────────────────────── */}
            <div className="sep-header">
                <h1 className="sep-title">Settlements</h1>
                <div className="sep-header-right">
                    {plans.length > 1 && (
                        <select
                            className="sep-plan-select"
                            value={selectedPlanId}
                            onChange={e => setSelectedPlanId(e.target.value)}
                            aria-label="Filter by plan"
                        >
                            <option value="all">All plans</option>
                            {plans.map(p => (
                                <option key={p.planId.toString()} value={p.planId.toString()}>
                                    Plan {p.planId.toString()}
                                </option>
                            ))}
                        </select>
                    )}
                    <button
                        className="sep-export-btn"
                        onClick={() => exportCsv(filtered)}
                        disabled={filtered.length === 0}
                    >
                        Export CSV
                    </button>
                </div>
            </div>

            {/* ── Summary bar ───────────────────────────────────── */}
            {!planFilterEmpty && (
                <div className="sep-summary" aria-label="Settlement totals">
                    <div className="sep-summary-stat">
                        <span className="sep-summary-label">Total settled</span>
                        <span className="sep-summary-value">
                            {totalUsdc.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                        </span>
                    </div>
                    <div className="sep-summary-divider" aria-hidden="true" />
                    <div className="sep-summary-stat">
                        <span className="sep-summary-label">Protocol fees</span>
                        <span className="sep-summary-value">
                            {feesUsdc.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} USDC
                        </span>
                    </div>
                </div>
            )}

            {/* Per-plan empty state */}
            {planFilterEmpty ? (
                <div className="sep-plan-empty">
                    <p className="sep-plan-empty-heading">No settlements for this plan yet</p>
                    <p className="sep-plan-empty-sub">
                        Settlements appear as the keeper processes due payments for this plan.
                    </p>
                </div>
            ) : (
                <SettlementsTable
                    settlements={filtered}
                    plans={plans}
                    isLoading={isLoadingSettlements}
                    error={settlementsError}
                    newTxHashes={newTxHashes}
                />
            )}
        </div>
    )
}
