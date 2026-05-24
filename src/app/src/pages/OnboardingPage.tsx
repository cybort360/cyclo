/**
 * /onboarding — focused setup wizard for new merchants.
 *
 * Guides users through 4 steps: connect wallet, get testnet USDC,
 * create a plan, and share their checkout link.
 *
 * Inputs:  none (reads wallet state via wagmi useAccount)
 * Outputs: renders full-screen centered wizard UI
 *
 * State:
 *   - currentStep persists to localStorage under 'cyclo_onboarding_step'
 *   - Resets to step 0 when the wallet address changes or disconnects
 *   - Step 0 is bypassed immediately if the wallet is already connected on mount
 *   - Wallet connection auto-advances from step 0 to step 1 with a success animation
 *
 * Step content lives in OnboardingSteps.tsx; indicator in OnboardingStepper.tsx.
 */
import { useState, useEffect, useRef } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { Link, useLocation }           from 'wouter'
import { OnboardingStepper }           from '../components/OnboardingStepper'
import Logo                            from '../components/Logo'
import type { OnboardingStep }         from '../components/OnboardingStepper'
import {
    ConnectWalletStepContent,
    FundWalletStepContent,
    CreatePlanStepContent,
    ShareLinkStepContent,
    ResumeBanner,
} from '../components/OnboardingSteps'
import { USDC_ABI }     from '../constants/abis'
import { USDC_ADDRESS } from '../constants/addresses'
import './OnboardingPage.css'

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cyclo_onboarding_step'
const PLAN_ID_KEY = 'cyclo_onboarding_planId'

const ONBOARDING_STEPS: OnboardingStep[] = [
    { title: 'Connect Wallet',         description: 'Connect an injected wallet to get started on Arc testnet.' },
    { title: 'Get Testnet USDC',       description: 'Fund your wallet with testnet USDC from the Arc faucet.' },
    { title: 'Create Your First Plan', description: 'Define a price and billing interval for your first subscription plan.' },
    { title: 'Share Your Link',        description: 'Share your checkout link and accept your first subscriber.' },
]

const STEP_COUNT = ONBOARDING_STEPS.length

// 5 seconds: responsive enough to feel near-instant after visiting the faucet,
// without hammering the RPC on every render.
const BALANCE_POLL_INTERVAL_MS = 5_000

// ── localStorage helpers ──────────────────────────────────────────────────────

function readPersistedStep(): number {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw === null) return 0
        const parsed = parseInt(raw, 10)
        if (isNaN(parsed)) return 0
        return Math.max(0, Math.min(parsed, STEP_COUNT - 1))
    } catch {
        // localStorage unavailable — fail silently, default to start
        return 0
    }
}

function persistStep(step: number): void {
    try { localStorage.setItem(STORAGE_KEY, String(step)) } catch { /* unavailable */ }
}

function clearPersistedStep(): void {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* unavailable */ }
}

function readPersistedPlanId(): bigint | null {
    try {
        const raw = localStorage.getItem(PLAN_ID_KEY)
        if (raw === null) return null
        const parsed = BigInt(raw)
        return parsed < 0n ? null : parsed
    } catch {
        return null
    }
}

function persistPlanId(id: bigint): void {
    try { localStorage.setItem(PLAN_ID_KEY, String(id)) } catch { /* unavailable */ }
}

function clearPersistedPlanId(): void {
    try { localStorage.removeItem(PLAN_ID_KEY) } catch { /* unavailable */ }
}

// ── Page ──────────────────────────────────────────────────────────────────────

/**
 * Full-screen onboarding wizard for new merchants.
 * @returns The 4-step onboarding UI with localStorage-persisted step state.
 */
export function OnboardingPage() {
    const { address, isConnected }         = useAccount()
    const [, navigate]                     = useLocation()
    const [currentStep, setCurrentStep]    = useState<number>(readPersistedStep)
    const [flashingStep, setFlashingStep]  = useState<number | null>(null)
    const [planId, setPlanId]              = useState<bigint | null>(readPersistedPlanId)
    // Evaluated once on mount — lazy initialiser avoids a one-frame flicker.
    // Both keys being present means the user created a plan but did not click
    // "Go to Dashboard" (which clears both keys).
    const [showResume] = useState(
        () => localStorage.getItem(STORAGE_KEY)  !== null &&
              localStorage.getItem(PLAN_ID_KEY) !== null
    )

    // Polled only while the user is on step 1 — avoids unnecessary RPC traffic
    // on every other step. Lifted to page level so canGoNext can gate on it,
    // preventing the nav-row Next button from bypassing the balance requirement.
    const { data: usdcBalance } = useReadContract({
        address:      USDC_ADDRESS as `0x${string}`,
        abi:          USDC_ABI,
        functionName: 'balanceOf',
        args:         address ? [address] : undefined,
        query: {
            enabled:         currentStep === 1 && !!address,
            refetchInterval: BALANCE_POLL_INTERVAL_MS,
        },
    })

    // lastAddressRef: detects wallet address changes to trigger reset.
    // Starts undefined so the initial mount never fires the reset logic.
    const lastAddressRef = useRef<string | undefined>(undefined)
    // wasConnectedAtMountRef: distinguishes "already connected on arrival" from
    // "just connected during this session" for the auto-advance animation logic.
    const wasConnectedAtMountRef = useRef(isConnected)

    // Reset to step 0 when the wallet address changes or when isConnected goes
    // false. isConnected is the explicit disconnect signal — address alone is
    // not reliable because it can lag behind connection state in wagmi.
    useEffect(() => {
        const prevAddress    = lastAddressRef.current
        const addressChanged = address !== undefined && prevAddress !== undefined && prevAddress !== address
        const disconnected   = !isConnected && prevAddress !== undefined

        if (addressChanged || disconnected) {
            setCurrentStep(0)
            clearPersistedStep()
            setPlanId(null)
            clearPersistedPlanId()
        }

        lastAddressRef.current = isConnected ? address : undefined
    }, [address, isConnected])

    // Auto-advance from step 0 when the wallet connects.
    // If already connected on mount, skip to step 1 immediately without animation.
    // Otherwise show a 600ms success flash on the step 0 indicator first.
    useEffect(() => {
        if (!isConnected || currentStep !== 0) return

        if (wasConnectedAtMountRef.current) {
            wasConnectedAtMountRef.current = false
            setCurrentStep(1)
            persistStep(1)
            return
        }

        setFlashingStep(0)
        const timer = setTimeout(() => {
            setFlashingStep(null)
            setCurrentStep(1)
            persistStep(1)
        }, 600)
        return () => clearTimeout(timer)
    }, [isConnected, currentStep])

    function goToStep(step: number): void {
        // Guard against clicking a completed step circle to skip past the connection
        // requirement — auto-advance is the only sanctioned path from step 0 to 1.
        if (step > 0 && !isConnected) return
        // Guard against navigating to the share-link step without a confirmed planId.
        if (step === 3 && planId === null) return
        setCurrentStep(step)
        persistStep(step)
    }

    // Next is disabled on the last step, on step 0 when not connected, on
    // step 1 when the USDC balance is zero, and on step 2 before a plan is
    // created — mirrors each card's own advance mechanism so the nav row
    // cannot bypass any step's requirement.
    const canGoNext =
        currentStep < STEP_COUNT - 1 &&
        (currentStep > 0 || isConnected) &&
        (currentStep !== 1 || (usdcBalance !== undefined && usdcBalance > 0n)) &&
        (currentStep !== 2 || planId !== null)
    const canGoBack = currentStep > 0

    return (
        <div className="onb-outer">
            <div className="onb-inner">

                <div className="onb-logo">
                    <Logo size={32} wordmarkSize={18} />
                </div>

                <div className="onb-heading">
                    <h1 className="onb-title">Get started</h1>
                    <p className="onb-sub">Follow the steps below to set up your first subscription plan.</p>
                </div>

                {showResume && <ResumeBanner onResume={() => goToStep(3)} />}

                <OnboardingStepper
                    steps={ONBOARDING_STEPS}
                    currentStep={currentStep}
                    onStepClick={goToStep}
                    flashingStep={flashingStep}
                />

                {currentStep === 0 && <ConnectWalletStepContent />}

                {/* Fallback to connect card for the rare render cycle where currentStep
                    has advanced to 1 but address hasn't resolved yet — wagmi can set
                    isConnected and address in separate renders. */}
                {currentStep === 1 && !address && <ConnectWalletStepContent />}
                {currentStep === 1 && address && (
                    <FundWalletStepContent usdcBalance={usdcBalance} onAdvance={() => goToStep(2)} />
                )}

                {currentStep === 2 && (
                    <CreatePlanStepContent
                        onSuccess={id => {
                            setPlanId(id)
                            persistPlanId(id)
                            goToStep(3)
                        }}
                    />
                )}

                {currentStep === 3 && planId !== null && (
                    <ShareLinkStepContent
                        planId={planId}
                        onDashboard={() => {
                            clearPersistedStep()
                            clearPersistedPlanId()
                            navigate('/dashboard')
                        }}
                    />
                )}

                {/* Navigation row — hidden on step 0 and the terminal step 3
                    where "Go to Dashboard" in the card is the only exit. */}
                {currentStep > 0 && currentStep < STEP_COUNT - 1 && (
                    <div className="onb-nav-row">
                        <button
                            onClick={() => goToStep(currentStep - 1)}
                            disabled={!canGoBack}
                            className="onb-btn--secondary"
                        >
                            ← Back
                        </button>
                        <button
                            onClick={() => goToStep(currentStep + 1)}
                            disabled={!canGoNext}
                            className="onb-btn--primary"
                        >
                            Next →
                        </button>
                    </div>
                )}

                <Link href="/dashboard" className="onb-skip">
                    Skip setup →
                </Link>

            </div>
        </div>
    )
}
