/**
 * Merchant view of all wallets subscribed to their plans.
 *
 * Data comes from useSubscriberList — on-chain SubscriptionCreated /
 * SubscriptionCancelled events cross-referenced with the keeper's past-due
 * API. The tabbed SubscriberTable handles per-status filtering.
 *
 * Shows a full-page EmptyState while the subscriber list is zero; once
 * any subscriptions exist the tabbed table is shown instead.
 */
import { useState } from 'react'
import { useSubscriptionManager } from '../hooks/useSubscriptionManager'
import { useSubscriberList } from '../hooks/useSubscriberList'
import { EmptyState } from '../components/EmptyState'
import { SubscriberTable } from '../components/SubscriberTable'

const EMPTY_ICON = (
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

export function SubscribersPage() {
    const { plans, planStatuses } = useSubscriptionManager()
    const { data: rows = [], isLoading } = useSubscriberList()
    const [copied, setCopied] = useState(false)

    // First plan not explicitly deactivated — used to build the checkout link.
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

    return (
        <div className="max-w-4xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Subscribers</h1>
                <p className="text-sm text-gray-500 mt-1">
                    All wallets subscribed to your plans, with live status from the keeper.
                </p>
            </div>

            {isLoading ? (
                <div className="bg-white rounded-xl border border-gray-100 px-8 py-12
                                text-sm text-gray-400 text-center">
                    Loading subscribers…
                </div>
            ) : rows.length === 0 ? (
                <EmptyState
                    icon={EMPTY_ICON}
                    heading="No subscribers yet"
                    subtext="Share your checkout link to start onboarding subscribers. Once someone subscribes, they'll appear here."
                    action={emptyAction}
                />
            ) : (
                <SubscriberTable rows={rows} />
            )}
        </div>
    )
}
