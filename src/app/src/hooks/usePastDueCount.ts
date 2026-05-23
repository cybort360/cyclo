/**
 * Fetches the past-due subscription count for the connected merchant wallet
 * from GET /api/merchants/:address/past-due/count.
 *
 * Polls every 60 seconds. Returns 0 when no wallet is connected.
 * Fetch errors are swallowed — the badge stays at its last known value
 * rather than disappearing or showing an error state.
 */
import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'

const POLL_INTERVAL_MS = 60_000

export function usePastDueCount(): number {
    const { address } = useAccount()
    const [count, setCount] = useState(0)

    const fetchCount = useCallback(async () => {
        if (!address) return
        try {
            const res = await fetch(`/api/merchants/${address.toLowerCase()}/past-due/count`)
            if (!res.ok) return
            const data = await res.json() as { count: number }
            setCount(data.count)
        } catch {
            // Fail silently — badge retains last known value.
        }
    }, [address])

    useEffect(() => {
        void fetchCount()
        const id = setInterval(() => { void fetchCount() }, POLL_INTERVAL_MS)
        return () => clearInterval(id)
    }, [fetchCount])

    // Reset to zero on wallet disconnect so a stale badge is never shown.
    useEffect(() => {
        if (!address) setCount(0)
    }, [address])

    return count
}
