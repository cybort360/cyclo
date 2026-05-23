import { useState, useEffect } from 'react'
import { useSubscriptionManager, type PaymentEvent } from '../hooks/useSubscriptionManager'
import { useSocket } from '../hooks/useSocket'
import { SettlementsTable } from '../components/SettlementsTable'
import { toUsdcUnits } from '../utils/formatting'

type Address = `0x${string}`

// Placeholder for fields not present in the socket payload.
// merchant is not rendered by SettlementsTable; nextChargeTimestamp 0n
// is caught by formatTimestamp and shown as "—".
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

export function SettlementsPage() {
    const { settlements, isLoadingSettlements, settlementsError, plans } = useSubscriptionManager()
    const { onPaymentCharged } = useSocket()

    // Plan filter — 'all' shows every settlement; any other value is a plan ID string.
    const [selectedPlanId, setSelectedPlanId] = useState<string>('all')

    // Rows pushed in by the keeper in real time, newest at index 0.
    const [liveRows, setLiveRows] = useState<PaymentEvent[]>([])
    // txHashes currently mid-highlight animation.
    const [newTxHashes, setNewTxHashes] = useState<ReadonlySet<string>>(new Set())

    useEffect(() => {
        const timers: ReturnType<typeof setTimeout>[] = []

        const off = onPaymentCharged((payload) => {
            const row: PaymentEvent = {
                planId:              BigInt(payload.planId),
                subscriber:          payload.subscriber as Address,
                merchant:            ZERO_ADDRESS,
                // toUsdcUnits converts "9.99" → 9_990_000n (6-decimal bigint)
                amount:              toUsdcUnits(payload.amount),
                // nextChargeTimestamp is not in the socket payload; 0n is treated
                // as "—" by SettlementsTable's formatTimestamp.
                nextChargeTimestamp: 0n,
                txHash:              payload.txHash as Address,
            }

            setLiveRows(prev => [row, ...prev])
            setNewTxHashes(prev => new Set([...prev, payload.txHash]))

            // Remove from highlight set once the CSS animation (2 s) finishes.
            const timer = setTimeout(() => {
                setNewTxHashes(prev => {
                    const next = new Set(prev)
                    next.delete(payload.txHash)
                    return next
                })
            }, 2_000)
            timers.push(timer)
        })

        return () => {
            off()
            timers.forEach(clearTimeout)
        }
    }, [onPaymentCharged])

    // Live rows sit above the historical list.
    // Once the 30-second refetch picks up a row that arrived via socket,
    // filter it out of liveRows so it is not shown twice.
    const liveRowTxHashes = new Set(liveRows.map(r => r.txHash))
    const deduplicatedSettlements = settlements.filter(s => !liveRowTxHashes.has(s.txHash))
    const allSettlements = [...liveRows, ...deduplicatedSettlements]

    // Apply plan filter — live rows are included so the filter is always consistent.
    const filteredSettlements = selectedPlanId === 'all'
        ? allSettlements
        : allSettlements.filter(s => s.planId.toString() === selectedPlanId)

    // True when a plan is selected but has no settlements, yet other plans do.
    const planFilterEmpty =
        selectedPlanId !== 'all' &&
        filteredSettlements.length === 0 &&
        allSettlements.length > 0

    return (
        <div className="max-w-4xl space-y-6">
            <div className="flex items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-gray-900">Settlements</h1>

                {/* Plan filter — only rendered when the merchant has multiple plans */}
                {plans.length > 1 && (
                    <select
                        value={selectedPlanId}
                        onChange={e => setSelectedPlanId(e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm
                                   text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="all">All plans</option>
                        {plans.map(p => (
                            <option key={p.planId.toString()} value={p.planId.toString()}>
                                Plan {p.planId.toString()}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {planFilterEmpty ? (
                <div className="bg-white rounded-xl border border-gray-100 px-8 py-12
                                flex flex-col items-center text-center">
                    <p className="text-sm font-semibold text-gray-900">
                        No settlements for this plan yet
                    </p>
                    <p className="text-sm text-gray-400 mt-1 max-w-xs leading-relaxed">
                        Settlements appear here as the keeper processes payments for this plan.
                    </p>
                </div>
            ) : (
                <SettlementsTable
                    settlements={filteredSettlements}
                    isLoading={isLoadingSettlements}
                    error={settlementsError}
                    newTxHashes={newTxHashes}
                />
            )}
        </div>
    )
}
