/**
 * /portal — subscriber-facing page.
 *
 * Shows the connected wallet's active on-chain subscriptions.
 * Outside the merchant dashboard Layout — accessible to any wallet holder.
 *
 * Heavy components split into:
 *   PortalCard.tsx   — SubscriptionCard + SoulboundBadge + formatters
 *   PortalModals.tsx — CancelConfirmModal + SwitchPlanModal + ToastStack
 *
 * Class prefix: prt-  (CSS in PortalPage.css)
 */
import { useState } from 'react'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'wouter'
import { ConnectButton } from '../components/WalletStatus'
import Logo from '../components/Logo'
import { usePortalSubscriptions, type PortalSubscription } from '../hooks/usePortalSubscriptions'
import { CONTRACT_ADDRESS } from '../constants/addresses'
import { SUBSCRIPTION_MANAGER_ABI } from '../constants/abis'
import { SubscriptionCard } from '../components/PortalCard'
import { ToastStack, CancelConfirmModal, SwitchPlanModal, type ToastItem } from '../components/PortalModals'
import { fmtAddress } from '../components/PortalCard'
import './PortalPage.css'

type Address = `0x${string}`

// ── Normalise transaction errors ──────────────────────────────────────────────

function toastError(err: unknown): string {
    const raw = err instanceof Error ? err.message : 'Transaction failed.'
    const isRejection = raw.toLowerCase().includes('user rejected') ||
                        raw.toLowerCase().includes('rejected the request')
    if (isRejection) return 'Transaction rejected.'
    return raw.length > 120 ? raw.slice(0, 117) + '…' : raw
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PortalHeader() {
    const { isConnected, address } = useAccount()
    return (
        <header className="prt-header">
            <div className="prt-header-inner">
                <div className="prt-header-brand">
                    <Logo size={24} wordmarkSize={14} />
                </div>
                <div className="prt-header-right">
                    {isConnected && address && (
                        <span className="prt-header-addr">{fmtAddress(address)}</span>
                    )}
                    <Link href="/dashboard">
                        <a className="prt-dashboard-btn">Merchant dashboard →</a>
                    </Link>
                </div>
            </div>
        </header>
    )
}

function ConnectPrompt() {
    return (
        <div className="prt-connect">
            <div className="prt-connect-icon">◎</div>
            <p className="prt-connect-title">Connect wallet to view your subscriptions</p>
            <p className="prt-connect-sub">
                Your active subscriptions are stored on-chain and visible only to
                the connected wallet.
            </p>
            <ConnectButton />
        </div>
    )
}

function LoadingSkeleton() {
    return (
        <div className="prt-grid">
            {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="prt-skel-card">
                    <div className="prt-skel-bar" style={{ width: '50%' }} />
                    <div className="prt-skel-bar" style={{ width: '35%', height: '20px' }} />
                    <div className="prt-skel-bar" style={{ width: '60%' }} />
                </div>
            ))}
        </div>
    )
}

function EmptyState() {
    return (
        <div className="prt-empty">
            <span className="prt-empty-icon">⇅</span>
            <p className="prt-empty-title">No active subscriptions</p>
            <p className="prt-empty-sub">
                This wallet has no active on-chain subscriptions.
            </p>
            <Link href="/dashboard">
                <a className="prt-empty-link">Browse plans →</a>
            </Link>
        </div>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function PortalPage() {
    const { isConnected, address }             = useAccount()
    const publicClient                         = usePublicClient()
    const { writeContractAsync }               = useWriteContract()
    const queryClient                          = useQueryClient()
    const { subscriptions, isLoading, error }  = usePortalSubscriptions()

    const [confirmingPlanId,       setConfirmingPlanId]       = useState<bigint | null>(null)
    const [cancellingPlanId,       setCancellingPlanId]       = useState<bigint | null>(null)
    const [fadingPlanIds,          setFadingPlanIds]          = useState<Set<string>>(new Set())
    const [removedPlanIds,         setRemovedPlanIds]         = useState<Set<string>>(new Set())
    const [switchingSubscription,  setSwitchingSubscription]  = useState<PortalSubscription | null>(null)
    const [migratingPlanId,        setMigratingPlanId]        = useState<bigint | null>(null)
    const [toasts,                 setToasts]                 = useState<ToastItem[]>([])

    function addToast(type: 'success' | 'error', message: string): void {
        const id = Date.now()
        setToasts(prev => [...prev, { id, type, message }])
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4_000)
    }

    async function handleConfirmCancel(): Promise<void> {
        if (confirmingPlanId === null) return
        const planId = confirmingPlanId
        setConfirmingPlanId(null)
        setCancellingPlanId(planId)
        try {
            const hash = await writeContractAsync({
                address: CONTRACT_ADDRESS as Address, abi: SUBSCRIPTION_MANAGER_ABI,
                functionName: 'cancelSubscription', args: [planId],
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

    async function handleConfirmMigrate(targetPlanId: bigint): Promise<void> {
        if (switchingSubscription === null) return
        const currentPlanId = switchingSubscription.planId
        setSwitchingSubscription(null)
        setMigratingPlanId(currentPlanId)
        try {
            const hash = await writeContractAsync({
                address: CONTRACT_ADDRESS as Address, abi: SUBSCRIPTION_MANAGER_ABI,
                functionName: 'migratePlan', args: [currentPlanId, targetPlanId],
            })
            await publicClient!.waitForTransactionReceipt({ hash })
            void queryClient.invalidateQueries({ queryKey: ['portal', 'subscriptions', address] })
            addToast('success', `Switched to Plan ${targetPlanId.toString()}.`)
        } catch (err) {
            addToast('error', toastError(err))
        } finally {
            setMigratingPlanId(null)
        }
    }

    const displayedSubs = subscriptions.filter(s => !removedPlanIds.has(s.planId.toString()))
    const confirmingSub = confirmingPlanId !== null
        ? subscriptions.find(s => s.planId === confirmingPlanId) ?? null
        : null

    return (
        <div className="prt-page">
            <PortalHeader />

            <div className="prt-content">
                {isConnected && (
                    <>
                        <p className="prt-page-title">My Subscriptions</p>
                        <p className="prt-page-sub">Your active on-chain recurring subscriptions.</p>
                    </>
                )}

                {error && <div className="prt-error">Failed to load subscriptions: {error}</div>}
                {!isConnected && <ConnectPrompt />}
                {isConnected && isLoading && <LoadingSkeleton />}
                {isConnected && !isLoading && !error && displayedSubs.length === 0 && <EmptyState />}
                {isConnected && !isLoading && displayedSubs.length > 0 && (
                    <div className="prt-grid">
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

            {confirmingSub !== null && (
                <CancelConfirmModal
                    subscription={confirmingSub}
                    isPending={cancellingPlanId !== null}
                    onConfirm={handleConfirmCancel}
                    onDismiss={() => setConfirmingPlanId(null)}
                />
            )}
            {switchingSubscription !== null && (
                <SwitchPlanModal
                    subscription={switchingSubscription}
                    isPending={migratingPlanId !== null}
                    onConfirm={handleConfirmMigrate}
                    onDismiss={() => setSwitchingSubscription(null)}
                />
            )}
            <ToastStack toasts={toasts} />
        </div>
    )
}
