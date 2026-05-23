/**
 * /past-due — merchant view of subscriptions in the keeper's grace period.
 *
 * Shows subscriptions whose most recent charge attempt failed and whose
 * retry_count is between 1 and 3 (still eligible for automatic retry).
 * The table is a follow-up task; this renders the page shell, loading
 * skeleton, and empty state.
 */
import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'

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

/** Column widths (px) used to shape the skeleton rows. */
const SKELETON_COLS = [140, 72, 96, 72, 96, 104]

function TableSkeleton() {
    return (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
            {/* Header */}
            <div className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                {SKELETON_COLS.map((w, i) => (
                    <div key={i} className="h-2.5 bg-gray-200 rounded" style={{ width: w }} />
                ))}
            </div>
            {/* Body rows */}
            {[0, 1, 2].map(row => (
                <div
                    key={row}
                    className="flex items-center gap-4 px-5 py-[18px] border-b border-gray-100 last:border-0"
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
            <p className="text-sm font-semibold text-gray-900">No past-due subscriptions</p>
            <p className="text-sm text-gray-400 mt-1 max-w-xs">
                All subscribers are current — no pending charge retries in the grace period.
            </p>
        </div>
    )
}

// ── Data fetch ────────────────────────────────────────────────────────────────

interface FetchState {
    items:     PastDueItem[]
    isLoading: boolean
    error:     string
}

function usePastDue(): FetchState {
    const { address } = useAccount()
    const [items,     setItems]     = useState<PastDueItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error,     setError]     = useState('')

    const load = useCallback(async () => {
        if (!address) {
            setIsLoading(false)
            return
        }
        try {
            const res = await fetch(`/api/merchants/${address.toLowerCase()}/past-due`)
            if (!res.ok) throw new Error(`Server error: ${res.status}`)
            const data = await res.json() as PastDueItem[]
            setItems(data)
            setError('')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load past-due subscriptions')
        } finally {
            setIsLoading(false)
        }
    }, [address])

    useEffect(() => { void load() }, [load])

    return { items, isLoading, error }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function PastDuePage() {
    const { items, isLoading, error } = usePastDue()

    return (
        <div className="max-w-4xl space-y-6">

            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Past Due</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Subscriptions in the grace period with pending charge retries.
                </p>
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

            {/* Table placeholder — populated in the next task */}
            {!isLoading && !error && items.length > 0 && (
                // STUB: PastDueTable renders here once built
                <div className="bg-white rounded-xl border border-gray-100 px-5 py-4">
                    <p className="text-sm text-gray-400 italic">
                        {items.length} past-due subscription{items.length !== 1 ? 's' : ''} found.
                        Table view coming in the next task.
                    </p>
                </div>
            )}

        </div>
    )
}
