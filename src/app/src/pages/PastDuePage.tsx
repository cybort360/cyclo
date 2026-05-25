/**
 * /past-due — merchant view of subscriptions in the keeper's grace period.
 *
 * Shows subscriptions whose most recent charge attempt failed and that are
 * still eligible for automatic retry (retry_count 1–3). Data is fetched on
 * mount and on manual refresh. Sorted by nextRetryAt ascending in PastDueTable.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAccount } from 'wagmi'
import { IconCheck } from '@tabler/icons-react'
import { PastDueTable } from '../components/PastDueTable'
import { PastDueDrawer } from '../components/PastDueDrawer'
import { useRightPanel } from '../context/RightPanelContext'
import { PastDuePanel } from '../components/PastDuePanel'
import './PastDuePage.css'
import { API_BASE } from '../utils/apiBase'

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

// ── Empty state ───────────────────────────────────────────────────────────────

function PastDueEmpty() {
    return (
        <div className="pd-empty">
            <span className="pd-empty-icon">
                <IconCheck size={18} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <p className="pd-empty-heading">All caught up</p>
            <p className="pd-empty-sub">
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
        const res = await fetch(`${API_BASE}/api/merchants/${address.toLowerCase()}/past-due`)
        if (!res.ok) throw new Error(`Server error: ${res.status}`)
        return res.json() as Promise<PastDueItem[]>
    }, [address])

    const load = useCallback(async (): Promise<void> => {
        if (!address) { setIsLoading(false); return }
        try {
            setItems(await fetchItems())
            setError('')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load past-due subscriptions')
        } finally {
            setIsLoading(false)
        }
    }, [address, fetchItems])

    const refresh = useCallback((): void => {
        setRefreshing(true)
        void fetchItems()
            .then(data => { setItems(data); setError('') })
            .catch(err  => { setError(err instanceof Error ? err.message : 'Failed to refresh') })
            .finally(() => setRefreshing(false))
    }, [fetchItems])

    useEffect(() => { void load() }, [load])

    return { items, isLoading, refreshing, error, refresh }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function PastDuePage() {
    const { items, isLoading, refreshing, error, refresh } = usePastDue()
    const [selectedItem, setSelectedItem] = useState<PastDueItem | null>(null)

    const panel = useMemo(() => <PastDuePanel />, [])
    useRightPanel(panel, [])

    return (
        <>
        <div>
            {/* ── Header ────────────────────────────────────────── */}
            <div className="pd-header">
                <div className="pd-header-left">
                    <h1 className="pd-title">Past Due</h1>
                    {!isLoading && (
                        <span className={`pd-count-pill${items.length > 0 ? ' pd-count-pill--warning' : ''}`}>
                            {items.length}
                        </span>
                    )}
                </div>
                <button
                    onClick={refresh}
                    disabled={isLoading || refreshing}
                    className="pd-refresh-btn"
                >
                    {refreshing ? 'Refreshing…' : 'Refresh'}
                </button>
            </div>

            {/* Error */}
            {error && <div className="pd-error">{error}</div>}

            {/* Empty state */}
            {!isLoading && !error && items.length === 0 && <PastDueEmpty />}

            {/* Table — handles its own loading skeleton */}
            {!error && (items.length > 0 || isLoading) && (
                <PastDueTable
                    items={items}
                    isLoading={isLoading}
                    onSelect={setSelectedItem}
                />
            )}
        </div>

        {selectedItem && (
            <PastDueDrawer item={selectedItem} onClose={() => setSelectedItem(null)} />
        )}
        </>
    )
}
