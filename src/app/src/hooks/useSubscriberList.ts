/**
 * Fetches all subscribers to the merchant's plans from on-chain event logs
 * and cross-references with the keeper's past-due API to assign status.
 *
 * Returns one SubscriberRow per (planId, subscriber) pair:
 *   active    — subscribed, not cancelled, not in keeper past-due list
 *   past_due  — present in GET /api/merchants/:addr/past-due
 *   cancelled — SubscriptionCancelled is the most recent event for the pair
 *
 * Four sources fetched in parallel:
 *   1. PlanCreated events filtered by merchant (indexed arg — one call)
 *   2. All SubscriptionCreated events (client-side filtered by merchant's planIds)
 *   3. All SubscriptionCancelled events (same filter)
 *   4. Keeper past-due REST endpoint
 *
 * Events are walked chronologically so a re-subscribe after a cancel
 * correctly restores active status.
 */
import { useQuery } from '@tanstack/react-query'
import { useAccount, usePublicClient } from 'wagmi'
import { SUBSCRIPTION_MANAGER_ABI } from '../constants/abis'
import { CONTRACT_ADDRESS, DEPLOY_BLOCK } from '../constants/addresses'
import { API_BASE } from '../utils/apiBase'

type Address = `0x${string}`

// ── Public types ───────────────────────────────────────────────────────────────

export type SubscriberStatus = 'active' | 'past_due' | 'cancelled'

export interface SubscriberRow {
    /** Stable React list key: "${planId}:${subscriber}" */
    key:        string
    planId:     string
    subscriber: string
    status:     SubscriberStatus
}

// ── Internal helpers ───────────────────────────────────────────────────────────

interface PastDueApiItem {
    planId:     string
    subscriber: string
}

async function fetchPastDue(address: string): Promise<PastDueApiItem[]> {
    try {
        const res = await fetch(`${API_BASE}/api/merchants/${address}/past-due`)
        if (!res.ok) return []
        return res.json() as Promise<PastDueApiItem[]>
    } catch {
        return []
    }
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useSubscriberList() {
    const { address }  = useAccount()
    const publicClient = usePublicClient()

    return useQuery<SubscriberRow[]>({
        queryKey:        ['subscriberList', address],
        enabled:         !!address && !!publicClient,
        refetchInterval: 30_000,
        queryFn: async (): Promise<SubscriberRow[]> => {
            if (!address || !publicClient) return []

            const [planCreatedLogs, subCreatedLogs, subCancelledLogs, pastDueItems] =
                await Promise.all([
                    publicClient.getContractEvents({
                        address:   CONTRACT_ADDRESS as Address,
                        abi:       SUBSCRIPTION_MANAGER_ABI,
                        eventName: 'PlanCreated',
                        args:      { merchant: address as Address },
                        fromBlock: DEPLOY_BLOCK,
                        toBlock:   'latest',
                    }),
                    publicClient.getContractEvents({
                        address:   CONTRACT_ADDRESS as Address,
                        abi:       SUBSCRIPTION_MANAGER_ABI,
                        eventName: 'SubscriptionCreated',
                        fromBlock: DEPLOY_BLOCK,
                        toBlock:   'latest',
                    }),
                    publicClient.getContractEvents({
                        address:   CONTRACT_ADDRESS as Address,
                        abi:       SUBSCRIPTION_MANAGER_ABI,
                        eventName: 'SubscriptionCancelled',
                        fromBlock: DEPLOY_BLOCK,
                        toBlock:   'latest',
                    }),
                    fetchPastDue(address.toLowerCase()),
                ])

            const myPlanIds = new Set(
                planCreatedLogs.map(l => (l.args.planId as bigint).toString())
            )
            if (myPlanIds.size === 0) return []

            const pastDueKey = new Set(
                pastDueItems.map(item =>
                    `${item.planId}:${item.subscriber.toLowerCase()}`
                )
            )

            // Walk all events chronologically so later events (e.g. re-subscribe
            // after cancel) overwrite earlier ones in the latestKind map.
            type Kind = 'created' | 'cancelled'
            const allEvents = [
                ...subCreatedLogs
                    .filter(l => myPlanIds.has((l.args.planId as bigint).toString()))
                    .map(l => ({
                        key:         `${(l.args.planId as bigint).toString()}:${(l.args.subscriber as string).toLowerCase()}`,
                        kind:        'created' as Kind,
                        blockNumber: l.blockNumber ?? 0n,
                        logIndex:    l.logIndex    ?? 0,
                    })),
                ...subCancelledLogs
                    .filter(l => myPlanIds.has((l.args.planId as bigint).toString()))
                    .map(l => ({
                        key:         `${(l.args.planId as bigint).toString()}:${(l.args.subscriber as string).toLowerCase()}`,
                        kind:        'cancelled' as Kind,
                        blockNumber: l.blockNumber ?? 0n,
                        logIndex:    l.logIndex    ?? 0,
                    })),
            ].sort((a, b) =>
                a.blockNumber !== b.blockNumber
                    ? Number(a.blockNumber - b.blockNumber)
                    : a.logIndex - b.logIndex
            )

            const latestKind = new Map<string, Kind>()
            for (const ev of allEvents) {
                latestKind.set(ev.key, ev.kind)
            }

            return Array.from(latestKind.entries()).map(([key, kind]) => {
                const colonIdx  = key.indexOf(':')
                const planId    = key.slice(0, colonIdx)
                const subscriber = key.slice(colonIdx + 1)

                let status: SubscriberStatus
                if (kind === 'cancelled') {
                    status = 'cancelled'
                } else if (pastDueKey.has(key)) {
                    status = 'past_due'
                } else {
                    status = 'active'
                }

                return { key, planId, subscriber, status }
            })
        },
    })
}
