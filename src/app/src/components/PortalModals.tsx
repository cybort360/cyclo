/**
 * PortalModals — cancel confirmation modal, switch plan modal, and toast stack.
 * Uses prt- CSS classes from PortalPage.css.
 */
import { useState } from 'react'
import { usePublicClient } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import type { PortalSubscription } from '../hooks/usePortalSubscriptions'
import { intervalToLabel } from '../utils/formatting'
import { SUBSCRIPTION_MANAGER_ABI } from '../constants/abis'
import { CONTRACT_ADDRESS, DEPLOY_BLOCK } from '../constants/addresses'
import { fmtUsdc, formatTrialDuration } from './PortalCard'

type Address = `0x${string}`

// ── Toast ─────────────────────────────────────────────────────────────────────

export interface ToastItem {
    id:      number
    type:    'success' | 'error'
    message: string
}

export function ToastStack({ toasts }: { toasts: ToastItem[] }) {
    if (toasts.length === 0) return null
    return (
        <div className="prt-toast-stack">
            {toasts.map(t => (
                <div key={t.id} className={`prt-toast prt-toast--${t.type}`}>
                    <span>{t.type === 'success' ? '✓' : '✕'}</span>
                    <span>{t.message}</span>
                </div>
            ))}
        </div>
    )
}

// ── Cancel confirmation ───────────────────────────────────────────────────────

interface CancelModalProps {
    subscription: PortalSubscription
    isPending:    boolean
    onConfirm:   () => void
    onDismiss:   () => void
}

export function CancelConfirmModal({ subscription, isPending, onConfirm, onDismiss }: CancelModalProps) {
    return (
        <div
            className="prt-overlay"
            onClick={isPending ? undefined : onDismiss}
        >
            <div className="prt-modal" onClick={e => e.stopPropagation()}>
                <div>
                    <div className="prt-modal-icon">✕</div>
                    <p className="prt-modal-title">
                        Cancel Plan {subscription.planId.toString()} subscription?
                    </p>
                    <p className="prt-modal-sub">
                        This takes effect immediately. No refund is issued for the current period.
                    </p>
                </div>
                <div className="prt-modal-actions">
                    <button
                        className="prt-modal-btn--danger"
                        onClick={onConfirm}
                        disabled={isPending}
                    >
                        {isPending ? 'Cancelling…' : 'Yes, cancel'}
                    </button>
                    <button
                        className="prt-modal-btn--secondary"
                        onClick={onDismiss}
                        disabled={isPending}
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
    trialDuration: number
    price:         bigint
    interval:      bigint
}

interface SwitchPlanModalProps {
    subscription: PortalSubscription
    isPending:    boolean
    onConfirm:    (targetPlanId: bigint) => void
    onDismiss:    () => void
}

export function SwitchPlanModal({ subscription, isPending, onConfirm, onDismiss }: SwitchPlanModalProps) {
    const publicClient                  = usePublicClient()
    const [selectedPlanId, setSelected] = useState<bigint | null>(null)

    const { data: alternatePlans = [], isLoading } = useQuery<AlternatePlan[]>({
        queryKey: ['portal', 'merchant-plans', subscription.plan.merchant, subscription.planId.toString()],
        enabled:  !!publicClient,
        queryFn:  async () => {
            const logs = await publicClient!.getContractEvents({
                address:   CONTRACT_ADDRESS as Address,
                abi:       SUBSCRIPTION_MANAGER_ABI,
                eventName: 'PlanCreated',
                args:      { merchant: subscription.plan.merchant },
                fromBlock: DEPLOY_BLOCK,
                toBlock:   'latest',
            })

            const seen = new Set<string>()
            const planIds: bigint[] = []
            for (const log of logs) {
                const id  = (log.args as { planId: bigint }).planId
                const key = id.toString()
                if (!seen.has(key) && id !== subscription.planId) { seen.add(key); planIds.push(id) }
            }
            if (planIds.length === 0) return []

            // Arc Testnet does not have Multicall3 — use individual readContract
            // calls in parallel instead.
            const planResults = await Promise.all(
                planIds.map(planId =>
                    publicClient!.readContract({
                        address:      CONTRACT_ADDRESS as Address,
                        abi:          SUBSCRIPTION_MANAGER_ABI,
                        functionName: 'getPlan',
                        args:         [planId],
                    }) as Promise<RawPlan>
                )
            )

            const result: AlternatePlan[] = []
            for (let i = 0; i < planIds.length; i++) {
                const plan = planResults[i]
                if (!plan || !plan.active) continue
                result.push({ planId: planIds[i]!, price: plan.price, interval: plan.interval, trialDuration: BigInt(plan.trialDuration) })
            }
            return result
        },
    })

    const canMigrate = selectedPlanId !== null && alternatePlans.length > 0 && !isPending

    return (
        <div className="prt-overlay" onClick={isPending ? undefined : onDismiss}>
            <div className="prt-modal" onClick={e => e.stopPropagation()}>
                <div>
                    <div className="prt-modal-icon">⇅</div>
                    <p className="prt-modal-title">Switch plan</p>
                    <p className="prt-modal-sub">
                        Switching immediately cancels Plan {subscription.planId.toString()} and
                        subscribes you to the new plan. Current period is not refunded.
                    </p>
                </div>

                <div className="prt-plan-list">
                    {isLoading && [0, 1].map(i => (
                        <div key={i} className="prt-skel-plan-item" />
                    ))}
                    {!isLoading && alternatePlans.length === 0 && (
                        <p className="prt-modal-empty">No other plans available from this merchant.</p>
                    )}
                    {!isLoading && alternatePlans.map(plan => {
                        const trial = formatTrialDuration(plan.trialDuration)
                        const isSelected = selectedPlanId === plan.planId
                        return (
                            <button
                                key={plan.planId.toString()}
                                className={`prt-plan-item${isSelected ? ' prt-plan-item--selected' : ''}`}
                                onClick={() => setSelected(plan.planId)}
                                disabled={isPending}
                            >
                                <p className="prt-plan-item-id">Plan {plan.planId.toString()}</p>
                                <p className="prt-plan-item-price">
                                    {fmtUsdc(plan.price)}
                                    <span className="prt-plan-item-interval">
                                        {' '}/ {intervalToLabel(Number(plan.interval))}
                                    </span>
                                    {trial && (
                                        <span className="prt-plan-item-trial" style={{ marginLeft: '6px' }}>
                                            {trial}
                                        </span>
                                    )}
                                </p>
                            </button>
                        )
                    })}
                </div>

                <div className="prt-modal-actions">
                    <button
                        className="prt-modal-btn--primary"
                        onClick={() => selectedPlanId !== null && onConfirm(selectedPlanId)}
                        disabled={!canMigrate}
                    >
                        {isPending ? 'Migrating…'
                            : selectedPlanId !== null
                                ? `Migrate to Plan ${selectedPlanId.toString()}`
                                : 'Select a plan'}
                    </button>
                    <button className="prt-modal-btn--secondary" onClick={onDismiss} disabled={isPending}>
                        Go back
                    </button>
                </div>
            </div>
        </div>
    )
}
