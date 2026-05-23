/**
 * Merchant view of subscribers across all plans.
 *
 * Counts unique subscriber addresses via SubscriptionCreated event logs.
 * Shows an empty state while that count is zero; once subscribers exist,
 * falls through to the SubscribeForm for plan lookup and management.
 */
import { useState, useEffect } from 'react'
import { usePublicClient } from 'wagmi'
import { useSubscriptionManager } from '../hooks/useSubscriptionManager'
import { EmptyState } from '../components/EmptyState'
import { SubscribeForm } from '../components/SubscribeForm'
import { SUBSCRIPTION_MANAGER_ABI } from '../constants/abis'
import { CONTRACT_ADDRESS, DEPLOY_BLOCK } from '../constants/addresses'

type Address = `0x${string}`

const SUBSCRIBERS_EMPTY_ICON = (
    <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center">
        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24"
             stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round"
                d="M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
            <circle cx="9" cy="7" r="4" />
            <path strokeLinecap="round" strokeLinejoin="round"
                d="M23 20v-1a4 4 0 0 0-3-3.87" />
            <path strokeLinecap="round" strokeLinejoin="round"
                d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    </div>
)

/**
 * Counts unique subscriber addresses across the given plan IDs by reading
 * SubscriptionCreated event logs. Returns { count, isLoading }.
 *
 * One RPC call (no per-plan filter) — client-side filtered by merchant plan set.
 * Errors are swallowed: count stays 0, empty state renders, no crash.
 */
function useSubscriberCount(
    planIdKey: string,   // stable string derived from plan IDs; triggers re-fetch on change
    enabled: boolean,    // false while plans are still loading
): { count: number; isLoading: boolean } {
    const client = usePublicClient()
    const [count,     setCount]     = useState(0)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!enabled) { setIsLoading(false); return }
        if (!client)  return

        const planIds = planIdKey.split(',').filter(Boolean)
        if (planIds.length === 0) { setCount(0); setIsLoading(false); return }

        const planIdSet = new Set(planIds)
        setIsLoading(true)

        client.getContractEvents({
            address:   CONTRACT_ADDRESS as Address,
            abi:       SUBSCRIPTION_MANAGER_ABI,
            eventName: 'SubscriptionCreated',
            fromBlock: DEPLOY_BLOCK,
            toBlock:   'latest',
        })
            .then(logs => {
                const subscribers = new Set(
                    logs
                        .filter(log => planIdSet.has((log.args.planId as bigint).toString()))
                        .map(log => (log.args.subscriber as string).toLowerCase())
                )
                setCount(subscribers.size)
            })
            .catch(() => { /* fail silently — empty state remains */ })
            .finally(() => setIsLoading(false))
    }, [client, enabled, planIdKey])

    return { count, isLoading }
}

export function SubscribersPage() {
    const { plans, planStatuses, isLoadingPlans } = useSubscriptionManager()
    const [copied, setCopied] = useState(false)

    // Stable string key avoids reference-equality churn from the derived array.
    const planIdKey = plans.map(p => p.planId.toString()).join(',')
    const { count: subscriberCount, isLoading: isLoadingSubscribers } =
        useSubscriberCount(planIdKey, !isLoadingPlans)

    // First plan whose active status is not explicitly false (undefined = not yet read = optimistic true).
    const firstActivePlan = plans.find(p => planStatuses.get(p.planId.toString()) !== false)
    const hasActivePlan   = firstActivePlan !== undefined

    function copyCheckoutLink(): void {
        if (!firstActivePlan) return
        const url = `${window.location.origin}/subscribe/${firstActivePlan.planId}`
        void navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2_000)
    }

    const emptyAction = hasActivePlan
        ? { label: copied ? 'Copied!' : 'Copy checkout link', onClick: copyCheckoutLink }
        : { label: 'Create a plan first', href: '/plans' }

    const isLoading     = isLoadingPlans || isLoadingSubscribers
    const showEmptyState = !isLoading && subscriberCount === 0

    return (
        <div className="max-w-4xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Subscribers</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Enter a plan ID to view its details and subscribe. Your wallet must have a USDC
                    balance to cover the plan price — approval is handled automatically.
                </p>
            </div>

            {showEmptyState ? (
                <EmptyState
                    icon={SUBSCRIBERS_EMPTY_ICON}
                    heading="No subscribers yet"
                    subtext="Share your checkout link to start onboarding subscribers. Once someone subscribes, they'll appear here."
                    action={emptyAction}
                />
            ) : (
                <SubscribeForm />
            )}
        </div>
    )
}
