/**
 * Fetches protocol statistics from GET /api/stats.
 *
 * @param options.refreshIntervalMs - Re-fetch cadence in milliseconds. Defaults
 *   to 0, which means a single fetch on mount with no polling. Pass a positive
 *   value (e.g. 30_000) to enable periodic background refreshes.
 */
import { useState, useEffect, useCallback } from 'react'
import { API_BASE } from '../utils/apiBase'

export interface ProtocolStats {
    totalPlans:          number
    activePlans:         number
    totalSubscriptions:  number
    activeSubscriptions: number
    totalCharges:        number
    totalVolumeUsdc:     number
    uniqueMerchants:     number
}

interface UseProtocolStatsOptions {
    refreshIntervalMs?: number
}

export interface UseProtocolStatsResult {
    stats:       ProtocolStats | null
    loading:     boolean
    error:       string
    lastUpdated: Date | null
}

export function useProtocolStats(
    { refreshIntervalMs = 0 }: UseProtocolStatsOptions = {},
): UseProtocolStatsResult {
    const [stats,       setStats]       = useState<ProtocolStats | null>(null)
    const [loading,     setLoading]     = useState(true)
    const [error,       setError]       = useState('')
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/stats`)
            if (!res.ok) throw new Error(`Server error: ${res.status}`)
            const data = await res.json() as ProtocolStats
            setStats(data)
            setLastUpdated(new Date())
            setError('')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load stats')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void fetchStats()

        if (refreshIntervalMs > 0) {
            const id = setInterval(() => { void fetchStats() }, refreshIntervalMs)
            return () => clearInterval(id)
        }
    }, [fetchStats, refreshIntervalMs])

    return { stats, loading, error, lastUpdated }
}
