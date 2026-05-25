/**
 * PlanGrid — 3-column card grid for the merchant's subscription plans.
 *
 * Each card shows: plan name, status badge, price / interval,
 * subscriber count, total settled USDC, and a kebab menu for deactivate.
 *
 * Subscriber count is derived from useSubscriberList (React Query deduplication
 * prevents extra network calls when SubscribersPage is also mounted).
 * Settled USDC is derived from the settlements prop.
 *
 * Class prefix: plg-
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import type { PlanEvent, PaymentEvent } from '../hooks/useSubscriptionManager'
import { useSubscriberList } from '../hooks/useSubscriberList'
import { fromUsdcUnits, intervalToLabel } from '../utils/formatting'
import './PlanGrid.css'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlanGridProps {
    plans:        PlanEvent[]
    isLoading:    boolean
    isPending:    boolean
    pendingPlanId: bigint | null
    planStatuses: Map<string, boolean>
    settlements:  PaymentEvent[]
    error?:       string
    onDeactivate: (planId: bigint) => Promise<void>
    onCreatePlan: () => void
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
    return (
        <div className="plg-skeleton-card" aria-hidden="true">
            <div className="plg-skel" style={{ width: '60%' }} />
            <div className="plg-skel" style={{ width: '40%', height: 28 }} />
            <div className="plg-skel" style={{ width: '80%', marginTop: 8 }} />
        </div>
    )
}

// ── Kebab menu ────────────────────────────────────────────────────────────────

interface KebabProps {
    planId:       bigint
    isActive:     boolean
    isPending:    boolean
    isThisPending: boolean
    onDeactivate: () => void
}

/** Three-dot menu for plan actions. Closes on outside click or ESC. */
function KebabMenu({ planId, isActive, isPending, isThisPending, onDeactivate }: KebabProps) {
    const [open, setOpen] = useState(false)
    const wrapRef         = useRef<HTMLDivElement>(null)

    const close = useCallback(() => setOpen(false), [])

    useEffect(() => {
        if (!open) return
        function onOutside(e: MouseEvent) {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close()
        }
        function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') close() }
        document.addEventListener('mousedown', onOutside)
        document.addEventListener('keydown', onEsc)
        return () => {
            document.removeEventListener('mousedown', onOutside)
            document.removeEventListener('keydown', onEsc)
        }
    }, [open, close])

    if (!isActive) return null

    return (
        <div className="plg-kebab-wrap" ref={wrapRef}>
            <button
                className="plg-kebab-btn"
                onClick={() => setOpen(v => !v)}
                aria-label={`Plan ${planId} options`}
                aria-expanded={open}
            >
                ⋮
            </button>
            {open && (
                <div className="plg-kebab-menu" role="menu">
                    <button
                        role="menuitem"
                        className="plg-kebab-item plg-kebab-item--danger"
                        disabled={isPending}
                        onClick={() => { onDeactivate(); close() }}
                    >
                        {isThisPending ? 'Deactivating…' : 'Deactivate'}
                    </button>
                </div>
            )}
        </div>
    )
}

// ── Plan card ─────────────────────────────────────────────────────────────────

interface PlanCardProps {
    plan:         PlanEvent
    isActive:     boolean
    subscriberCount: number
    settledUsdc:  number
    isPending:    boolean
    pendingPlanId: bigint | null
    onDeactivate: (planId: bigint) => Promise<void>
}

function PlanCard({ plan, isActive, subscriberCount, settledUsdc, isPending, pendingPlanId, onDeactivate }: PlanCardProps) {
    const isThisPending = pendingPlanId === plan.planId
    const priceDisplay  = fromUsdcUnits(plan.price).toLocaleString('en-US', {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
    })

    return (
        <div className={`plg-card${!isActive ? ' plg-card--inactive' : ''}`}>

            {/* Name + status */}
            <div className="plg-card-top">
                <h3 className="plg-plan-name">Plan {plan.planId.toString()}</h3>
                <span className={`plg-badge${isActive ? ' plg-badge--active' : ' plg-badge--inactive'}`}>
                    {isActive ? 'Active' : 'Inactive'}
                </span>
            </div>

            {/* Price */}
            <div className="plg-price-row">
                <span className="plg-price">{priceDisplay}</span>
                <span className="plg-price-sep">/</span>
                <span className="plg-interval">{intervalToLabel(Number(plan.interval))}</span>
            </div>

            {/* Stats */}
            <div className="plg-stats-row">
                <div className="plg-stat">
                    <span className="plg-stat-label">subscribers</span>
                    <span className="plg-stat-value">{subscriberCount}</span>
                </div>
                <div className="plg-stat">
                    <span className="plg-stat-label">USDC settled</span>
                    <span className="plg-stat-value">
                        {settledUsdc.toLocaleString('en-US', {
                            minimumFractionDigits: 2, maximumFractionDigits: 2,
                        })}
                    </span>
                </div>
            </div>

            {/* Footer */}
            <div className="plg-footer">
                <a className="plg-view-link" href="/subscribers">
                    View subscribers →
                </a>
                <KebabMenu
                    planId={plan.planId}
                    isActive={isActive}
                    isPending={isPending}
                    isThisPending={isThisPending}
                    onDeactivate={() => void onDeactivate(plan.planId)}
                />
            </div>
        </div>
    )
}

// ── Grid ──────────────────────────────────────────────────────────────────────

/** 3-column card grid of all merchant plans. */
export function PlanGrid({
    plans, isLoading, isPending, pendingPlanId,
    planStatuses, settlements, error, onDeactivate, onCreatePlan,
}: PlanGridProps) {
    const { data: subscribers = [] } = useSubscriberList()

    // Subscriber count per planId (active or past_due, not cancelled).
    const subCountMap = new Map<string, number>()
    for (const row of subscribers) {
        if (row.status !== 'cancelled') {
            subCountMap.set(row.planId, (subCountMap.get(row.planId) ?? 0) + 1)
        }
    }

    // Settled USDC per planId.
    const settledMap = new Map<string, bigint>()
    for (const s of settlements) {
        const key = s.planId.toString()
        settledMap.set(key, (settledMap.get(key) ?? 0n) + s.amount)
    }

    if (isLoading) return (
        <div className="plg-grid">
            {[0, 1, 2].map(i => <SkeletonCard key={i} />)}
        </div>
    )

    if (error) return (
        <div className="plg-grid">
            <div className="plg-empty">
                <p className="plg-empty-heading">Failed to load plans</p>
                <p className="plg-empty-sub">{error}</p>
            </div>
        </div>
    )

    if (plans.length === 0) return (
        <div className="plg-grid">
            <div className="plg-empty">
                <p className="plg-empty-heading">No plans yet</p>
                <p className="plg-empty-sub">
                    Create your first subscription plan to start accepting recurring USDC payments.
                </p>
                <button className="plg-empty-cta" onClick={onCreatePlan}>
                    Create your first plan →
                </button>
            </div>
        </div>
    )

    return (
        <div className="plg-grid">
            {plans.map(plan => {
                const key      = plan.planId.toString()
                const isActive = planStatuses.get(key) !== false
                return (
                    <PlanCard
                        key={plan.txHash}
                        plan={plan}
                        isActive={isActive}
                        subscriberCount={subCountMap.get(key) ?? 0}
                        settledUsdc={fromUsdcUnits(settledMap.get(key) ?? 0n)}
                        isPending={isPending}
                        pendingPlanId={pendingPlanId}
                        onDeactivate={onDeactivate}
                    />
                )
            })}
        </div>
    )
}
