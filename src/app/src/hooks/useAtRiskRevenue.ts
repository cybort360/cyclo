/**
 * Derives at-risk revenue figures for the connected merchant from
 * GET /api/merchants/:address/past-due (the full list endpoint).
 *
 * Returns:
 *   count       — number of past-due subscriptions (0 when none or disconnected)
 *   totalAmount — sum of USDC amounts at risk as a float
 *   isLoading   — true until the first fetch resolves
 *
 * Fetched once on mount and whenever the wallet address changes.
 * Errors are swallowed: the card simply doesn't appear rather than
 * rendering an error on the Overview page.
 */
import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'

interface PastDueListItem {
    amount: string  // human-readable USDC, e.g. "9.99"
}

export interface AtRiskRevenue {
    count:       number
    totalAmount: number
    isLoading:   boolean
}

export function useAtRiskRevenue(): AtRiskRevenue {
    const { address } = useAccount()
    const [count,       setCount]       = useState(0)
    const [totalAmount, setTotalAmount] = useState(0)
    const [isLoading,   setIsLoading]   = useState(true)

    const fetchItems = useCallback(async (): Promise<void> => {
        if (!address) {
            setIsLoading(false)
            return
        }
        try {
            const res = await fetch(`/api/merchants/${address.toLowerCase()}/past-due`)
            if (!res.ok) return
            const items = await res.json() as PastDueListItem[]
            setCount(items.length)
            setTotalAmount(
                items.reduce((sum, item) => sum + parseFloat(item.amount), 0)
            )
        } catch {
            // Fail silently — card stays hidden rather than showing an error.
        } finally {
            setIsLoading(false)
        }
    }, [address])

    useEffect(() => { void fetchItems() }, [fetchItems])

    // Reset on wallet disconnect so stale data never lingers.
    useEffect(() => {
        if (!address) { setCount(0); setTotalAmount(0) }
    }, [address])

    return { count, totalAmount, isLoading }
}
