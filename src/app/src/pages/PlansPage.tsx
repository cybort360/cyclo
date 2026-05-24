/**
 * /plans — merchant view of all subscription plans.
 *
 * Plans render as a 3-column card grid (PlanGrid).
 * The "Create plan" button opens a modal overlay containing the
 * restyled CreatePlanForm with the AI natural-language strip.
 *
 * Class prefix: plp-
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { IconPlus, IconX } from '@tabler/icons-react'
import { useSubscriptionManager } from '../hooks/useSubscriptionManager'
import { PlanGrid } from '../components/PlanGrid'
import { CreatePlanForm } from '../components/CreatePlanForm'
import type { CreatePlanInitialValues } from '../components/CreatePlanForm'
import { useRightPanel } from '../context/RightPanelContext'
import { PlansPanel } from '../components/PlansPanel'
import './PlansPage.css'

export function PlansPage() {
    const {
        plans, planStatuses, isLoadingPlans,
        planEventsError, isPending, pendingPlanId,
        settlements, createPlan, deactivatePlan,
    } = useSubscriptionManager()

    const panel = useMemo(() => <PlansPanel />, [])
    useRightPanel(panel, [])

    const [showCreate,  setShowCreate]  = useState(false)
    const [successMsg,  setSuccessMsg]  = useState('')
    const [formValues,  setFormValues]  = useState<CreatePlanInitialValues | undefined>(undefined)
    const overlayRef = useRef<HTMLDivElement>(null)

    // Auto-dismiss the success message after 4 s.
    useEffect(() => {
        if (!successMsg) return
        const t = setTimeout(() => setSuccessMsg(''), 4_000)
        return () => clearTimeout(t)
    }, [successMsg])

    // Close modal on backdrop click.
    function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>): void {
        if (e.target === overlayRef.current) setShowCreate(false)
    }

    // Close modal on ESC.
    useEffect(() => {
        if (!showCreate) return
        function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') setShowCreate(false) }
        document.addEventListener('keydown', onEsc)
        return () => document.removeEventListener('keydown', onEsc)
    }, [showCreate])

    async function handleCreate(price: bigint, interval: bigint, trialDuration: bigint): Promise<void> {
        await createPlan(price, interval, trialDuration)
        setSuccessMsg('Plan created successfully.')
        setShowCreate(false)
        setFormValues(undefined)
    }

    async function handleDeactivate(planId: bigint): Promise<void> {
        await deactivatePlan(planId)
        setSuccessMsg(`Plan ${planId} deactivated.`)
    }

    return (
        <div>
            {/* ── Header ────────────────────────────────────────── */}
            <div className="plp-header">
                <h1 className="plp-title">Plans</h1>
                <button
                    className="plp-create-btn"
                    onClick={() => { setFormValues(undefined); setShowCreate(true) }}
                >
                    <IconPlus size={14} aria-hidden="true" />
                    Create plan
                </button>
            </div>

            {/* Success toast */}
            {successMsg && <div className="plp-success">{successMsg}</div>}

            {/* Plan grid */}
            <PlanGrid
                plans={plans}
                isLoading={isLoadingPlans}
                isPending={isPending}
                pendingPlanId={pendingPlanId}
                planStatuses={planStatuses}
                settlements={settlements}
                error={planEventsError}
                onDeactivate={handleDeactivate}
                onCreatePlan={() => setShowCreate(true)}
            />

            {/* ── Create plan modal ──────────────────────────── */}
            {showCreate && (
                <div
                    className="plp-overlay"
                    ref={overlayRef}
                    onClick={handleOverlayClick}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Create a plan"
                >
                    <div className="plp-modal">
                        <div className="plp-modal-header">
                            <h2 className="plp-modal-title">Create a plan</h2>
                            <button
                                className="plp-modal-close"
                                onClick={() => setShowCreate(false)}
                                aria-label="Close modal"
                            >
                                <IconX size={16} />
                            </button>
                        </div>

                        <CreatePlanForm
                            isPending={isPending}
                            onCreate={handleCreate}
                            initialValues={formValues}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
