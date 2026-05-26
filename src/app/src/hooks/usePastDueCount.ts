/**
 * Fetches the past-due subscription count for the connected merchant wallet
 * from GET /api/merchants/:address/past-due/count.
 *
 * Polls every 60 seconds. Returns 0 when no wallet is connected.
 * Fetch errors are swallowed — the badge stays at its last known value
 * rather than disappearing or showing an error state.
 *
 * Auth: the endpoint requires a wallet signature to prevent any user from
 * querying another merchant's past-due data. getCachedAuth provides a
 * 4-minute cached signature so the user is only prompted once per session.
 */
import { useState, useEffect, useCallback } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { API_BASE } from '../utils/apiBase'
import { getCachedAuth } from '../utils/authCache'

const POLL_INTERVAL_MS = 60_000

export function usePastDueCount(): number {
    const { address } = useAccount()
    const { signMessageAsync } = useSignMessage()
    const [count, setCount] = useState(0)

    const fetchCount = useCallback(async () => {
        if (!address) return
        try {
            const { timestamp, signature } = await getCachedAuth(address, signMessageAsync)
            const res = await fetch(
                `${API_BASE}/api/merchants/${address.toLowerCase()}/past-due/count` +
                `?timestamp=${timestamp}&signature=${encodeURIComponent(signature)}`
            )
            if (!res.ok) return
            const data = await res.json() as { count: number }
            setCount(data.count)
        } catch {
            // Fail silently — badge retains last known value.
        }
    }, [address, signMessageAsync])

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
