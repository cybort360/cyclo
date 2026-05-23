/**
 * /past-due — merchant view of subscriptions in the keeper's grace period.
 *
 * Shows subscriptions whose most recent charge attempt failed and that are
 * still eligible for automatic retry (retry_count 1–3). Data is fetched on
 * mount and on manual refresh. Sorted by nextRetryAt ascending in PastDueTable.
 */
import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { PastDueTable } from '../components/PastDueTable'
import { PastDueDrawer } from '../components/PastDueDrawer'

// ── API shape ─────────────────────────────────────────────────────────────────

export interface PastDueItem {
    subscriber:    string
    planId:        string
    planName:      string | null
    amount:        string
    attemptCount:  number
    nextRetryAt:   string
    lastAttemptAt: string
    failureReason: 'low_balance' | 'low_allowance' | 'unknown'
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

/** Column widths (px) mirroring the 8 table columns. */
const SKELETON_COLS = [160, 80, 72, 96, 80, 96, 100, 68]

function TableSkeleton() {
    return (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
            <div className="flex items-center gap-3 px-3 py-3 border-b border-gray-100 bg-gray-50/80">
                {SKELETON_COLS.map((w, i) => (
                    <div key={i} className="h-2.5 bg-gray-200 rounded" style={{ width: w }} />
                ))}
            </div>
            {[0, 1, 2].map(row => (
                <div
                    key={row}
                    className="flex items-center gap-3 px-3 py-[18px] border-b border-gray-50 last:border-0"
                >
                    {SKELETON_COLS.map((w, i) => (
                        <div key={i} className="h-3 bg-gray-100 rounded" style={{ width: w }} />
                    ))}
                </div>
            ))}
        </div>
    )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
    return (
        <div className="bg-white rounded-xl border border-gray-100 px-8 py-16 flex flex-col items-center text-center">
            <div className="w-11 h-11 rounded-full bg-green-50 flex items-center justify-center mb-4">
                <svg
                    className="w-5 h-5 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            </div>
            <p className="text-sm font-semibold text-gray-900">All caught up</p>
            <p className="text-sm text-gray-400 mt-1 max-w-xs">
                No subscriptions are currently in the grace period.
                The keeper will notify you here when a charge fails.
            </p>
        </div>
    )
}

// ── Data hook ─────────────────────────────────────────────────────────────────

interface FetchState {
    items:      PastDueItem[]
    isLoading:  boolean
    refreshing: boolean
    error:      string
    refresh:    () => void
}

function usePastDue(): FetchState {
    const { address } = useAccount()
    const [items,      setItems]      = useState<PastDueItem[]>([])
    const [isLoading,  setIsLoading]  = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error,      setError]      = useState('')

    const fetchItems = useCallback(async (): Promise<PastDueItem[]> => {
        if (!address) return []
        const res = await fetch(`/api/merchants/${address.toLowerCase()}/past-due`)
        if (!res.ok) throw new Error(`Server error: ${res.status}`)
        return res.json() as Promise<PastDueItem[]>
    }, [address])

    // Initial load — drives the full-page skeleton.
    const load = useCallback(async (): Promise<void> => {
        if (!address) { setIsLoading(false); return }
        try {
            const data = await fetchItems()
            setItems(data)
            setError('')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load past-due subscriptions')
        } finally {
            setIsLoading(false)
        }
    }, [address, fetchItems])

    // Manual refresh — keeps the table visible, only disables the Refresh button.
    const refresh = useCallback((): void => {
        setRefreshing(true)
        void fetchItems()
            .then(data => { setItems(data); setError('') })
            .catch(err => {
                setError(err instanceof Error ? err.message : 'Failed to refresh')
            })
            .finally(() => setRefreshing(false))
    }, [fetchItems])

    useEffect(() => { void load() }, [load])

    return { items, isLoading, refreshing, error, refresh }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function PastDuePage() {
    const { items, isLoading, refreshing, error, refresh } = usePastDue()
    const [selectedItem, setSelectedItem] = useState<PastDueItem | null>(null)

    return (
        <>
        <div className="max-w-4xl space-y-6">

            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Past Due</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Subscriptions in the grace period with pending charge retries.
                    </p>
                </div>
                <button
                    onClick={refresh}
                    disabled={isLoading || refreshing}
                    className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500
                               hover:text-gray-900 hover:border-gray-300 transition-colors
                               disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {refreshing ? 'Refreshing…' : 'Refresh'}
                </button>
            </div>

            {/* Loading */}
            {isLoading && <TableSkeleton />}

            {/* Error */}
            {!isLoading && error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                </div>
            )}

            {/* Empty state */}
            {!isLoading && !error && items.length === 0 && <EmptyState />}

            {/* Table */}
            {!isLoading && !error && items.length > 0 && (
                <PastDueTable items={items} onSelect={setSelectedItem} />
            )}

        </div>

        {/* Detail drawer — rendered outside the max-w container so it overlays the full viewport */}
        {selectedItem && (
            <PastDueDrawer item={selectedItem} onClose={() => setSelectedItem(null)} />
        )}
        </>
    )
}
