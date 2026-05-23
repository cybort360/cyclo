/**
 * /portal — subscriber-facing page.
 * Shows the connected wallet's active on-chain subscriptions with full plan
 * details (price, interval, merchant, trial state) fetched from the contract.
 *
 * This page is intentionally outside the merchant dashboard Layout — it has
 * no sidebar and is accessible to any wallet holder, not just merchants.
 */
import { useState } from 'react'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import { useIsSubscribed } from '@cyclo/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'wouter'
import { ConnectButton } from '../components/WalletStatus'
import {
    usePortalSubscriptions,
    type PortalSubscription,
} from '../hooks/usePortalSubscriptions'
import { fromUsdcUnits, intervalToLabel } from '../utils/formatting'
import { SUBSCRIPTION_MANAGER_ABI } from '../constants/abis'
import { CONTRACT_ADDRESS, DEPLOY_BLOCK } from '../constants/addresses'

type Address = `0x${string}`

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtUsdc = (raw: bigint) =>
    fromUsdcUnits(raw).toLocaleString('en-US', {
        style:                 'currency',
        currency:              'USD',
        minimumFractionDigits: 2,
    })

const fmtDate = (ts: bigint) =>
    new Date(Number(ts) * 1000).toLocaleDateString('en-US', {
        month: 'short',
        day:   'numeric',
        year:  'numeric',
    })

const fmtAddress = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`

/** Returns "14-day trial", "1-day trial", etc. Empty string if no trial. */
function formatTrialDuration(seconds: bigint): string {
    if (seconds === 0n) return ''
    const days = Number(seconds) / 86_400
    if (days === 1)               return '1-day trial'
    if (Number.isInteger(days))   return `${days}-day trial`
    return `${Number(seconds)}s trial`
}

function daysUntil(ts: bigint): number {
    return Math.ceil((Number(ts) * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
}

function formatCountdown(ts: bigint): string {
    const days = daysUntil(ts)
    if (days < 0)   return 'overdue'
    if (days === 0) return 'today'
    if (days === 1) return 'tomorrow'
    return `in ${days} days`
}

function formatTrialBadge(trialEndDate: bigint): string {
    const days = daysUntil(trialEndDate)
    if (days <= 0)  return 'Trial ends today'
    if (days === 1) return 'Trial ends in 1 day'
    return `Trial ends in ${days} days`
}

/** Normalises a transaction error to a short user-facing string. */
function toastError(err: unknown): string {
    const raw = err instanceof Error ? err.message : 'Transaction failed.'
    const isRejection = raw.toLowerCase().includes('user rejected') ||
                        raw.toLowerCase().includes('rejected the request')
    if (isRejection) return 'Transaction rejected.'
    return raw.length > 120 ? raw.slice(0, 117) + '…' : raw
}

// ── Toast ─────────────────────────────────────────────────────────────────────

interface ToastItem {
    id:      number
    type:    'success' | 'error'
    message: string
}

function ToastStack({ toasts }: { toasts: ToastItem[] }) {
    if (toasts.length === 0) return null
    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`flex items-start gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-xs pointer-events-auto ${
                        toast.type === 'success' ? 'bg-gray-900 text-white' : 'bg-red-600 text-white'
                    }`}
                >
                    <span className="shrink-0 mt-px">{toast.type === 'success' ? '✓' : '✕'}</span>
                    <span className="leading-snug">{toast.message}</span>
                </div>
            ))}
        </div>
    )
}

// ── Cancel confirmation modal ─────────────────────────────────────────────────

interface CancelModalProps {
    subscription: PortalSubscription
    isPending:    boolean
    onConfirm:   () => void
    onDismiss:   () => void
}

function CancelConfirmModal({ subscription, isPending, onConfirm, onDismiss }: CancelModalProps) {
    return (
        <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
            onClick={isPending ? undefined : onDismiss}
        >
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-3">
                    <span className="text-red-500 text-lg">✕</span>
                </div>
                <h2 className="text-base font-semibold text-gray-900">
                    Cancel your Plan {subscription.planId.toString()} subscription?
                </h2>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                    This takes effect immediately. No refund is issued for the current period.
                </p>
                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onConfirm}
                        disabled={isPending}
                        className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 disabled:cursor-wait"
                    >
                        {isPending ? 'Cancelling…' : 'Yes, cancel'}
                    </button>
                    <button
                        onClick={onDismiss}
                        disabled={isPending}
                        className="flex-1 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Go back
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Switch Plan modal ─────────────────────────────────────────────────────────

interface AlternatePlan {
    planId:        bigint
    price:         bigint
    interval:      bigint
    trialDuration: bigint
}

type RawPlan = {
    merchant:      Address
    active:        boolean
    trialDuration: number   // uint48 decoded as number by viem
    price:         bigint
    interval:      bigint
}

interface SwitchPlanModalProps {
    subscription: PortalSubscription
    isPending:    boolean
    onConfirm:    (targetPlanId: bigint) => void
    onDismiss:    () => void
}

function SwitchPlanModal({ subscription, isPending, onConfirm, onDismiss }: SwitchPlanModalProps) {
    const publicClient                  = usePublicClient()
    const [selectedPlanId, setSelected] = useState<bigint | null>(null)

    // Fetch all active plans from the same merchant, excluding the current one.
    const { data: alternatePlans = [], isLoading: loadingPlans } = useQuery<AlternatePlan[]>({
        queryKey: [
            'portal', 'merchant-plans',
            subscription.plan.merchant,
            subscription.planId.toString(),
        ],
        enabled: !!publicClient,
        queryFn: async () => {
            // 1. Discover plan IDs for this merchant via PlanCreated events.
            const logs = await publicClient!.getContractEvents({
                address:   CONTRACT_ADDRESS as Address,
                abi:       SUBSCRIPTION_MANAGER_ABI,
                eventName: 'PlanCreated',
                args:      { merchant: subscription.plan.merchant },
                fromBlock: DEPLOY_BLOCK,
                toBlock:   'latest',
            })

            // 2. Deduplicate and exclude the subscription's current plan.
            const seen = new Set<string>()
            const planIds: bigint[] = []
            for (const log of logs) {
                const id  = (log.args as { planId: bigint }).planId
                const key = id.toString()
                if (!seen.has(key) && id !== subscription.planId) {
                    seen.add(key)
                    planIds.push(id)
                }
            }
            if (planIds.length === 0) return []

            // 3. Batch-read full plan details in one multicall.
            const reads = await publicClient!.multicall({
                contracts: planIds.map(planId => ({
                    address:      CONTRACT_ADDRESS as Address,
                    abi:          SUBSCRIPTION_MANAGER_ABI,
                    functionName: 'getPlan' as const,
                    args:         [planId] as const,
                })),
            })

            // 4. Filter to active plans only.
            const result: AlternatePlan[] = []
            for (let i = 0; i < planIds.length; i++) {
                const read = reads[i]
                if (read.status !== 'success' || !read.result) continue
                const plan = read.result as RawPlan
                if (!plan.active) continue
                result.push({
                    planId:        planIds[i],
                    price:         plan.price,
                    interval:      plan.interval,
                    trialDuration: BigInt(plan.trialDuration),
                })
            }
            return result
        },
    })

    const hasPlans     = alternatePlans.length > 0
    const canMigrate   = selectedPlanId !== null && hasPlans && !isPending

    return (
        <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
            onClick={isPending ? undefined : onDismiss}
        >
            <div
                className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-5"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div>
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mb-3">
                        <span className="text-indigo-600 text-lg">⇅</span>
                    </div>
                    <h2 className="text-base font-semibold text-gray-900">Switch plan</h2>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                        Switching immediately cancels Plan {subscription.planId.toString()} and
                        subscribes you to the new plan. Your current period is not refunded.
                    </p>
                </div>

                {/* Plan list */}
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto -mx-1 px-1">
                    {loadingPlans && (
                        <div className="space-y-2 py-2">
                            {[0, 1].map(i => (
                                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                            ))}
                        </div>
                    )}

                    {!loadingPlans && !hasPlans && (
                        <p className="text-sm text-gray-400 text-center py-6">
                            No other plans available from this merchant.
                        </p>
                    )}

                    {!loadingPlans && alternatePlans.map(plan => {
                        const isSelected = selectedPlanId === plan.planId
                        const trial      = formatTrialDuration(plan.trialDuration)
                        return (
                            <button
                                key={plan.planId.toString()}
                                onClick={() => setSelected(plan.planId)}
                                disabled={isPending}
                                className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-colors disabled:opacity-50 ${
                                    isSelected
                                        ? 'border-indigo-500 bg-indigo-50/60'
                                        : 'border-gray-100 hover:border-gray-200 bg-white'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-medium text-gray-400 mb-0.5">
                                            Plan {plan.planId.toString()}
                                        </p>
                                        <p className="text-sm font-semibold text-gray-900 leading-tight">
                                            {fmtUsdc(plan.price)}
                                            <span className="text-gray-400 font-normal"> / {intervalToLabel(Number(plan.interval))}</span>
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {trial && (
                                            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                                                {trial}
                                            </span>
                                        )}
                                        {/* Selection indicator */}
                                        <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                            isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
                                        }`}>
                                            {isSelected && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-white block" />
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={() => selectedPlanId !== null && onConfirm(selectedPlanId)}
                        disabled={!canMigrate}
                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isPending
                            ? 'Migrating…'
                            : selectedPlanId !== null
                                ? `Migrate to Plan ${selectedPlanId.toString()}`
                                : 'Select a plan'
                        }
                    </button>
                    <button
                        onClick={onDismiss}
                        disabled={isPending}
                        className="flex-1 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Go back
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── ChainLinkIcon ─────────────────────────────────────────────────────────────

function ChainLinkIcon() {
    return (
        <svg
            width="10" height="10" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
    )
}

// ── SoulboundBadge ────────────────────────────────────────────────────────────

/**
 * Renders a "Soulbound NFT" badge for a subscription card.
 *
 * Reads the connected wallet address via useAccount so the parent card does not
 * need to pass it as a prop. Returns null (fail silently) when the NFT contract
 * is not deployed or the subscriber does not hold a token for this plan.
 */
function SoulboundBadge({ planId }: { planId: bigint }) {
    const { address } = useAccount()
    const { isSubscribed, tokenId, isLoading } = useIsSubscribed(
        address as `0x${string}` | undefined,
        planId,
    )

    if (isLoading) {
        return <div className="h-5 w-24 bg-gray-100 rounded-full animate-pulse" />
    }

    if (!isSubscribed) return null

    return (
        <div className="relative group">
            <div className="flex items-center gap-1 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full cursor-default select-none">
                <ChainLinkIcon />
                <span>Soulbound NFT</span>
            </div>
            {/* Tooltip — visible on hover via group */}
            <div
                aria-hidden="true"
                className="absolute right-0 top-full mt-2 z-10 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
            >
                {/* Arrow */}
                <div className="absolute right-3 -top-1 w-2 h-2 bg-gray-900 rotate-45" />
                <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg leading-relaxed w-max max-w-[230px]">
                    Token ID #{tokenId?.toString()} — non-transferable proof of your active subscription
                </div>
            </div>
        </div>
    )
}

// ── ClipboardIcon ─────────────────────────────────────────────────────────────

function ClipboardIcon() {
    return (
        <svg
            width="12" height="12" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
        >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
    )
}

// ── Subscription card ─────────────────────────────────────────────────────────

interface CardProps {
    subscription:    PortalSubscription
    isCancelling:    boolean
    isMigrating:     boolean
    isFading:        boolean
    onCancelRequest: () => void
    onSwitchRequest: () => void
}

function SubscriptionCard({
    subscription, isCancelling, isMigrating, isFading,
    onCancelRequest, onSwitchRequest,
}: CardProps) {
    const { plan, planId, nextChargeTimestamp, isInTrial, trialEndDate } = subscription
    const [copied, setCopied] = useState(false)
    // Either action locks both buttons for the duration of the tx
    const isAnyPending = isCancelling || isMigrating

    function handleCopy() {
        void navigator.clipboard.writeText(plan.merchant)
        setCopied(true)
        setTimeout(() => setCopied(false), 2_000)
    }

    return (
        <div
            className={`bg-white border rounded-2xl p-5 flex flex-col gap-5 transition-all duration-300 ${
                isFading
                    ? 'opacity-0 scale-95'
                    : 'opacity-100 hover:border-indigo-200 hover:shadow-sm'
            }`}
        >
            {/* Plan ID + Active badge + Soulbound NFT badge */}
            <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide pt-0.5">
                    Plan {planId.toString()}
                </p>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full">
                        Active
                    </span>
                    <SoulboundBadge planId={planId} />
                </div>
            </div>

            {/* Price + interval */}
            <div>
                <p className="text-2xl font-bold text-gray-900 leading-none">
                    {fmtUsdc(plan.price)}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                    / {intervalToLabel(Number(plan.interval))}
                </p>
            </div>

            {/* Trial badge — only when in free trial */}
            {isInTrial && trialEndDate !== null && (
                <span className="self-start text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg">
                    {formatTrialBadge(trialEndDate)}
                </span>
            )}

            {/* Next charge + merchant */}
            <div className="space-y-3 text-sm border-t border-gray-100 pt-4">

                <div className="flex items-start justify-between gap-4">
                    <span className="text-gray-400 shrink-0">
                        {isInTrial ? 'First charge' : 'Next charge'}
                    </span>
                    <div className="text-right">
                        <p className="text-gray-700 font-medium leading-snug">
                            {fmtDate(nextChargeTimestamp)}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {formatCountdown(nextChargeTimestamp)}
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                    <span className="text-gray-400 shrink-0">Merchant</span>
                    <div className="flex items-center gap-1.5">
                        <a
                            href={`https://testnet.arcscan.app/address/${plan.merchant}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-600 font-mono text-xs hover:underline"
                        >
                            {fmtAddress(plan.merchant)}
                        </a>
                        <button
                            onClick={handleCopy}
                            className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            title={copied ? 'Copied!' : 'Copy full address'}
                            aria-label="Copy merchant address to clipboard"
                        >
                            {copied
                                ? <span className="text-green-600 text-xs leading-none font-medium">✓</span>
                                : <ClipboardIcon />
                            }
                        </button>
                    </div>
                </div>

                {!plan.active && (
                    <span className="inline-flex text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
                        Plan closed — no new subscribers accepted
                    </span>
                )}
            </div>

            {/* Action buttons */}
            <div className="border-t border-gray-100 pt-4 flex gap-2">
                <button
                    onClick={onSwitchRequest}
                    disabled={isAnyPending}
                    className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-wait"
                >
                    {isMigrating ? 'Migrating…' : 'Switch plan'}
                </button>
                <button
                    onClick={onCancelRequest}
                    disabled={isAnyPending}
                    className="flex-1 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-wait"
                >
                    {isCancelling ? 'Cancelling…' : 'Cancel'}
                </button>
            </div>
        </div>
    )
}

// ── Page sub-components ───────────────────────────────────────────────────────

function PortalHeader() {
    const { isConnected, address } = useAccount()
    return (
        <header className="bg-white border-b">
            <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
                        <span className="text-white text-xs font-bold">C</span>
                    </div>
                    <span className="font-semibold text-gray-900">Cyclo</span>
                    <span className="text-gray-300 mx-1.5">·</span>
                    <span className="text-sm text-gray-500">Subscriber Portal</span>
                </div>
                <div className="flex items-center gap-3">
                    {isConnected && address && (
                        <span className="text-xs font-mono text-gray-500 hidden sm:block">
                            {fmtAddress(address)}
                        </span>
                    )}
                    <Link href="/dashboard">
                        <a className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                            Merchant dashboard →
                        </a>
                    </Link>
                </div>
            </div>
        </header>
    )
}

function ConnectPrompt() {
    return (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-5">
                <span className="text-2xl">◎</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Connect wallet to view your subscriptions
            </h2>
            <p className="text-sm text-gray-500 mb-8 max-w-xs">
                Your active subscriptions are stored on-chain and are only
                visible to the connected wallet address.
            </p>
            <ConnectButton />
        </div>
    )
}

function LoadingSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white border rounded-2xl p-5 animate-pulse space-y-5">
                    <div className="flex items-center justify-between">
                        <div className="h-3 w-16 bg-gray-200 rounded" />
                        <div className="h-6 w-14 bg-gray-200 rounded-full" />
                    </div>
                    <div className="space-y-1.5">
                        <div className="h-7 w-24 bg-gray-200 rounded-lg" />
                        <div className="h-3 w-16 bg-gray-200 rounded" />
                    </div>
                    <div className="space-y-2.5 pt-4 border-t border-gray-100">
                        <div className="h-3 w-40 bg-gray-200 rounded" />
                        <div className="h-3 w-32 bg-gray-200 rounded" />
                    </div>
                    <div className="pt-4 border-t border-gray-100 flex gap-2">
                        <div className="flex-1 h-9 bg-gray-100 rounded-lg" />
                        <div className="flex-1 h-9 bg-gray-100 rounded-lg" />
                    </div>
                </div>
            ))}
        </div>
    )
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-5">
                <span className="text-2xl text-gray-400">⇅</span>
            </div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">
                No active subscriptions
            </h2>
            <p className="text-sm text-gray-500 mb-6 max-w-xs">
                This wallet has no active on-chain subscriptions. Browse available
                plans to get started.
            </p>
            <Link href="/dashboard">
                <a className="text-sm text-indigo-600 font-medium hover:underline">
                    Browse plans →
                </a>
            </Link>
        </div>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function PortalPage() {
    const { isConnected, address }         = useAccount()
    const publicClient                     = usePublicClient()
    const { writeContractAsync }           = useWriteContract()
    const queryClient                      = useQueryClient()
    const { subscriptions, isLoading, error } = usePortalSubscriptions()

    // ── Cancel flow ────────────────────────────────────────────────────────
    const [confirmingPlanId, setConfirmingPlanId] = useState<bigint | null>(null)
    const [cancellingPlanId, setCancellingPlanId] = useState<bigint | null>(null)
    const [fadingPlanIds,    setFadingPlanIds]    = useState<Set<string>>(new Set())
    const [removedPlanIds,   setRemovedPlanIds]   = useState<Set<string>>(new Set())

    // ── Switch Plan flow ───────────────────────────────────────────────────
    // The full subscription object is kept so the modal can read plan.merchant / planId.
    const [switchingSubscription, setSwitchingSubscription] = useState<PortalSubscription | null>(null)
    const [migratingPlanId,       setMigratingPlanId]       = useState<bigint | null>(null)

    // ── Toasts ─────────────────────────────────────────────────────────────
    const [toasts, setToasts] = useState<ToastItem[]>([])

    function addToast(type: 'success' | 'error', message: string) {
        const id = Date.now()
        setToasts(prev => [...prev, { id, type, message }])
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4_000)
    }

    // ── Handlers ───────────────────────────────────────────────────────────

    async function handleConfirmCancel() {
        if (confirmingPlanId === null) return
        const planId = confirmingPlanId
        setConfirmingPlanId(null)
        setCancellingPlanId(planId)
        try {
            const hash = await writeContractAsync({
                address:      CONTRACT_ADDRESS as Address,
                abi:          SUBSCRIPTION_MANAGER_ABI,
                functionName: 'cancelSubscription',
                args:         [planId],
            })
            await publicClient!.waitForTransactionReceipt({ hash })

            const key = planId.toString()
            setFadingPlanIds(prev => new Set([...prev, key]))
            setTimeout(() => {
                setRemovedPlanIds(prev => new Set([...prev, key]))
                setFadingPlanIds(prev => { const s = new Set(prev); s.delete(key); return s })
            }, 350)

            addToast('success', 'Subscription cancelled.')
        } catch (err) {
            addToast('error', toastError(err))
        } finally {
            setCancellingPlanId(null)
        }
    }

    async function handleConfirmMigrate(targetPlanId: bigint) {
        if (switchingSubscription === null) return
        const currentPlanId = switchingSubscription.planId
        setSwitchingSubscription(null)
        setMigratingPlanId(currentPlanId)
        try {
            const hash = await writeContractAsync({
                address:      CONTRACT_ADDRESS as Address,
                abi:          SUBSCRIPTION_MANAGER_ABI,
                functionName: 'migratePlan',
                args:         [currentPlanId, targetPlanId],
            })
            await publicClient!.waitForTransactionReceipt({ hash })

            // Invalidate the subscriptions query so the card list refreshes
            // with the new plan data from the chain.
            void queryClient.invalidateQueries({
                queryKey: ['portal', 'subscriptions', address],
            })

            addToast('success', `Switched to Plan ${targetPlanId.toString()}.`)
        } catch (err) {
            addToast('error', toastError(err))
        } finally {
            setMigratingPlanId(null)
        }
    }

    // ── Derived ────────────────────────────────────────────────────────────

    const displayedSubs = subscriptions.filter(
        s => !removedPlanIds.has(s.planId.toString())
    )

    const confirmingSubscription = confirmingPlanId !== null
        ? subscriptions.find(s => s.planId === confirmingPlanId) ?? null
        : null

    return (
        <div className="min-h-screen bg-gray-50">

            <PortalHeader />

            <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">

                {isConnected && (
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">My Subscriptions</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Your active on-chain recurring subscriptions.
                        </p>
                    </div>
                )}

                {error && (
                    <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        Failed to load subscriptions: {error}
                    </div>
                )}

                {!isConnected && <ConnectPrompt />}
                {isConnected && isLoading && <LoadingSkeleton />}
                {isConnected && !isLoading && !error && displayedSubs.length === 0 && <EmptyState />}
                {isConnected && !isLoading && displayedSubs.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {displayedSubs.map(sub => (
                            <SubscriptionCard
                                key={sub.planId.toString()}
                                subscription={sub}
                                isCancelling={cancellingPlanId === sub.planId}
                                isMigrating={migratingPlanId === sub.planId}
                                isFading={fadingPlanIds.has(sub.planId.toString())}
                                onCancelRequest={() => setConfirmingPlanId(sub.planId)}
                                onSwitchRequest={() => setSwitchingSubscription(sub)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Cancel confirmation modal */}
            {confirmingSubscription !== null && (
                <CancelConfirmModal
                    subscription={confirmingSubscription}
                    isPending={cancellingPlanId !== null}
                    onConfirm={handleConfirmCancel}
                    onDismiss={() => setConfirmingPlanId(null)}
                />
            )}

            {/* Switch Plan modal */}
            {switchingSubscription !== null && (
                <SwitchPlanModal
                    subscription={switchingSubscription}
                    isPending={migratingPlanId !== null}
                    onConfirm={handleConfirmMigrate}
                    onDismiss={() => setSwitchingSubscription(null)}
                />
            )}

            {/* Toast notifications */}
            <ToastStack toasts={toasts} />
        </div>
    )
}
