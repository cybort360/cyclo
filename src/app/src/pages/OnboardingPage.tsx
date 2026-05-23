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
 */
import { useState, useEffect, useRef, FormEvent } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { Link, useLocation } from 'wouter'
import { OnboardingStepper } from '../components/OnboardingStepper'
import type { OnboardingStep } from '../components/OnboardingStepper'
import { ConnectButton } from '../components/WalletStatus'
import { USDC_ABI }      from '../constants/abis'
import { USDC_ADDRESS }  from '../constants/addresses'
import { fromUsdcUnits } from '../utils/formatting'
import { useCycloClient } from '@cyclo/react'
import QRCode from 'qrcode'

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cyclo_onboarding_step'
const PLAN_ID_KEY = 'cyclo_onboarding_planId'

const ONBOARDING_STEPS: OnboardingStep[] = [
    {
        title:       'Connect Wallet',
        description: 'Connect an injected wallet to get started on Arc testnet.',
    },
    {
        title:       'Get Testnet USDC',
        description: 'Fund your wallet with testnet USDC from the Arc faucet.',
    },
    {
        title:       'Create Your First Plan',
        description: 'Define a price and billing interval for your first subscription plan.',
    },
    {
        title:       'Share Your Link',
        description: 'Share your checkout link and accept your first subscriber.',
    },
]

const STEP_COUNT = ONBOARDING_STEPS.length

const ARC_FAUCET_URL: string = import.meta.env.VITE_ARC_FAUCET_URL ?? 'https://faucet.circle.com/'
const APP_BASE_URL: string = import.meta.env.VITE_APP_URL ?? ''

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
    try {
        localStorage.setItem(STORAGE_KEY, String(step))
    } catch {
        // localStorage unavailable — degrade silently, do not crash
    }
}

function clearPersistedStep(): void {
    try {
        localStorage.removeItem(STORAGE_KEY)
    } catch {
        // ignore
    }
}

function readPersistedPlanId(): bigint | null {
    try {
        const raw = localStorage.getItem(PLAN_ID_KEY)
        if (raw === null) return null
        const parsed = BigInt(raw)
        if (parsed < 0n) return null
        return parsed
    } catch {
        return null
    }
}

function persistPlanId(id: bigint): void {
    try {
        localStorage.setItem(PLAN_ID_KEY, String(id))
    } catch {
        // localStorage unavailable — degrade silently, do not crash
    }
}

function clearPersistedPlanId(): void {
    try {
        localStorage.removeItem(PLAN_ID_KEY)
    } catch {
        // ignore
    }
}

// ── Step content ──────────────────────────────────────────────────────────────

/**
 * Content panel for step 0: prompts the user to connect their Web3 wallet.
 * Renders the shared ConnectButton — connection triggers auto-advance in the parent.
 */
function ConnectWalletStepContent() {
    return (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-gray-900">Connect your wallet</h2>
                <p className="text-sm text-gray-500 mt-1">
                    You'll need a Web3 wallet to create plans and receive payments.
                </p>
            </div>
            <ConnectButton />
        </div>
    )
}

interface FundWalletStepContentProps {
    usdcBalance: bigint | undefined
    onAdvance:   () => void
}

/**
 * Content panel for step 1: displays the live USDC balance (polled by the
 * parent) and gates advancement on any nonzero balance rather than a minimum —
 * testnet amounts are unpredictable and any balance is sufficient to proceed.
 */
function FundWalletStepContent({ usdcBalance, onAdvance }: FundWalletStepContentProps): JSX.Element {
    const balanceDisplay = usdcBalance !== undefined
        ? `${fromUsdcUnits(usdcBalance).toFixed(6)} USDC`
        : '—'

    const canContinue = usdcBalance !== undefined && usdcBalance > 0n

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-gray-900">Fund your wallet with testnet USDC</h2>
                <p className="text-sm text-gray-500 mt-1">
                    You need testnet USDC to pay gas fees and test subscriptions on Arc.
                </p>
            </div>
            <a
                href={ARC_FAUCET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
                Open Arc Faucet ↗
            </a>
            <p className="text-sm text-gray-600">
                Balance: {balanceDisplay}
            </p>
            <button
                onClick={onAdvance}
                disabled={!canContinue}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
                I'm funded, continue
            </button>
        </div>
    )
}

interface CreatePlanStepContentProps {
    onSuccess: (planId: bigint) => void
}

/**
 * Content panel for step 2: form to create a subscription plan.
 * Owns all form state internally. Calls cyclo.createPlan() on submit,
 * then notifies the parent via onSuccess(planId) to persist and advance.
 */
function CreatePlanStepContent({ onSuccess }: CreatePlanStepContentProps): JSX.Element {
    // planName is a UX affordance only — the contract's createPlan has no name
    // parameter, so this is not submitted. Kept so the form feels complete to merchants.
    const [planName, setPlanName]   = useState('')
    const [price,    setPrice]      = useState('')
    const [interval, setInterval]   = useState('30')
    const [isPending, setIsPending] = useState(false)
    const [error,    setError]      = useState<string | null>(null)

    const cyclo = useCycloClient()

    async function handleSubmit(e: FormEvent): Promise<void> {
        e.preventDefault()
        setError(null)
        setIsPending(true)
        try {
            // parseFloat is safe here: step="0.01" constrains price to 2 decimal
            // places, which Math.round(x * 1_000_000) handles without precision loss.
            const id = await cyclo.createPlan({
                price:        parseFloat(price),
                intervalDays: parseInt(interval, 10),
                trialDays:    0,
            })
            onSuccess(id)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create plan')
        } finally {
            setIsPending(false)
        }
    }

    // The regex guards the 2-decimal-place assumption in the parseFloat comment above —
    // step="0.01" is a browser hint only; this ensures it's a code-level invariant.
    const canSubmit =
        price !== '' &&
        /^\d+(\.\d{1,2})?$/.test(price) &&
        parseFloat(price) >= 0.01 &&
        !isPending

    return (
        <form
            onSubmit={handleSubmit}
            className="bg-white border border-gray-200 rounded-xl p-6 space-y-4"
        >
            <div>
                <h2 className="text-lg font-semibold text-gray-900">Create your first subscription plan</h2>
                <p className="text-sm text-gray-500 mt-1">
                    This defines what you're charging and how often.
                </p>
            </div>

            <div className="space-y-3">
                <div>
                    <label htmlFor="plan-name" className="block text-sm font-medium text-gray-700 mb-1">
                        Plan name (optional)
                    </label>
                    <input
                        id="plan-name"
                        type="text"
                        value={planName}
                        onChange={e => setPlanName(e.target.value)}
                        placeholder="e.g. Pro Monthly"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <div>
                    <label htmlFor="plan-price" className="block text-sm font-medium text-gray-700 mb-1">
                        Price (USDC)
                    </label>
                    <input
                        id="plan-price"
                        type="number"
                        value={price}
                        onChange={e => setPrice(e.target.value)}
                        min="0.01"
                        step="0.01"
                        placeholder="10.00"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <div>
                    <label htmlFor="plan-interval" className="block text-sm font-medium text-gray-700 mb-1">
                        Billing interval
                    </label>
                    <select
                        id="plan-interval"
                        value={interval}
                        onChange={e => setInterval(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="30">Monthly</option>
                        <option value="7">Weekly</option>
                        <option value="365">Yearly</option>
                    </select>
                </div>
            </div>

            {error !== null && (
                <p className="text-sm text-red-600">{error}</p>
            )}

            <button
                type="submit"
                disabled={!canSubmit}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
                {isPending ? 'Creating…' : 'Create Plan'}
            </button>
        </form>
    )
}

interface ShareLinkStepContentProps {
    planId: bigint
}

/**
 * Content panel for step 3: displays the merchant's subscribe URL, a QR code,
 * a copy-to-clipboard button, and a "Go to Dashboard" button that clears
 * onboarding localStorage and navigates to the merchant dashboard.
 */
function ShareLinkStepContent({ planId }: ShareLinkStepContentProps): JSX.Element {
    const [, navigate]        = useLocation()
    const [copied, setCopied] = useState(false)
    const qrCanvasRef         = useRef<HTMLCanvasElement>(null)
    const copyTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null)

    const subscribeUrl = `${APP_BASE_URL || window.location.origin}/subscribe/${String(planId)}`

    useEffect(() => {
        if (qrCanvasRef.current === null) return
        QRCode.toCanvas(qrCanvasRef.current, subscribeUrl, { width: 160 })
            .catch(() => {
                // QR generation failed — canvas stays blank, card still renders
            })
    }, [subscribeUrl])

    useEffect(() => () => {
        if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current)
    }, [])

    async function handleCopy(): Promise<void> {
        try {
            await navigator.clipboard.writeText(subscribeUrl)
            setCopied(true)
            if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current)
            copyTimerRef.current = setTimeout(() => setCopied(false), 2_000)
        } catch {
            // Clipboard unavailable — degrade silently, do not crash
        }
    }

    function handleDashboard(): void {
        clearPersistedStep()
        clearPersistedPlanId()
        navigate('/')
    }

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-gray-900">Your checkout link is ready</h2>
                <p className="text-sm text-gray-500 mt-1">
                    Share this link with anyone you want to subscribe.
                </p>
            </div>

            <div className="flex gap-2 items-center">
                <input
                    type="text"
                    readOnly
                    value={subscribeUrl}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50 focus:outline-none"
                />
                <a
                    href={subscribeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                    aria-label="Open subscribe link in new tab"
                >
                    ↗
                </a>
            </div>

            <button
                onClick={handleCopy}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
                {copied ? 'Copied! ✓' : 'Copy Link'}
            </button>

            <div className="flex justify-center">
                <canvas ref={qrCanvasRef} width={160} height={160} />
            </div>

            <button
                onClick={handleDashboard}
                className="w-full px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
                Go to Dashboard
            </button>
        </div>
    )
}

interface ResumeBannerProps {
    onResume: () => void
}

/**
 * Banner shown at the top of the onboarding wizard when both
 * 'cyclo_onboarding_step' and 'cyclo_onboarding_planId' are present in
 * localStorage — indicating the user created a plan but did not finish
 * the onboarding flow.
 */
function ResumeBanner({ onResume }: ResumeBannerProps): JSX.Element {
    return (
        <div className="flex items-center gap-3 px-5 py-3 bg-green-50 border border-green-200 rounded-xl text-sm">
            <span className="text-green-500">✓</span>
            <span className="flex-1 text-gray-700">
                You're almost done.{' '}
                <button
                    onClick={onResume}
                    className="text-green-700 font-medium hover:underline"
                >
                    Resume where you left off →
                </button>
            </span>
        </div>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────

/**
 * Full-screen onboarding wizard for new merchants.
 *
 * @returns The 4-step onboarding UI with localStorage-persisted step state.
 */
export function OnboardingPage() {
    const { address, isConnected } = useAccount()
    const [currentStep, setCurrentStep]   = useState<number>(readPersistedStep)
    const [flashingStep, setFlashingStep] = useState<number | null>(null)
    const [planId, setPlanId]             = useState<bigint | null>(readPersistedPlanId)
    // Evaluated once on mount — lazy initialiser avoids a one-frame flicker.
    // Both keys being present means the user created a plan but did not click
    // "Go to Dashboard" (which clears both keys).
    const [showResume]                    = useState(
        () =>
            localStorage.getItem(STORAGE_KEY)  !== null &&
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
    // The reset is gated on lastAddressRef so the initial mount never resets.
    useEffect(() => {
        const prevAddress = lastAddressRef.current
        const addressChanged =
            address !== undefined && prevAddress !== undefined && prevAddress !== address

        const disconnected = !isConnected && prevAddress !== undefined

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
    // Otherwise show a 600ms green success flash on the step 0 indicator first.
    useEffect(() => {
        if (!isConnected || currentStep !== 0) return

        if (wasConnectedAtMountRef.current) {
            // Arrived already connected — advance without animation.
            wasConnectedAtMountRef.current = false
            setCurrentStep(1)
            persistStep(1)
            return
        }

        // Wallet just connected — flash green then advance.
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

    function handleNext(): void {
        if (currentStep >= STEP_COUNT - 1) return
        goToStep(currentStep + 1)
    }

    function handleBack(): void {
        if (currentStep <= 0) return
        goToStep(currentStep - 1)
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
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 py-12">
            <div className="w-full max-w-sm space-y-8">

                {/* Logo */}
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
                        <span className="text-white text-xs font-bold">C</span>
                    </div>
                    <span className="font-semibold text-gray-900">Cyclo</span>
                </div>

                {/* Heading */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Get started</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Follow the steps below to set up your first subscription plan.
                    </p>
                </div>

                {/* Resume banner — shown when prior onboarding progress is detected */}
                {showResume && (
                    <ResumeBanner onResume={() => goToStep(3)} />
                )}

                {/* Stepper */}
                <OnboardingStepper
                    steps={ONBOARDING_STEPS}
                    currentStep={currentStep}
                    onStepClick={goToStep}
                    flashingStep={flashingStep}
                />

                {/* Step 1 content — wallet connect card */}
                {currentStep === 0 && <ConnectWalletStepContent />}

                {/* Step 2 content — fund wallet card.
                    Falls back to the connect card for the rare render cycle where
                    currentStep has advanced to 1 but address hasn't resolved yet
                    (wagmi can set isConnected and address in separate renders). */}
                {currentStep === 1 && !address && <ConnectWalletStepContent />}
                {currentStep === 1 && address && (
                    <FundWalletStepContent
                        usdcBalance={usdcBalance}
                        onAdvance={() => goToStep(2)}
                    />
                )}

                {/* Step 3 content — create plan card */}
                {currentStep === 2 && (
                    <CreatePlanStepContent
                        onSuccess={(id) => {
                            setPlanId(id)
                            persistPlanId(id)
                            goToStep(3)
                        }}
                    />
                )}

                {/* Step 4 content — share link card */}
                {currentStep === 3 && planId !== null && (
                    <ShareLinkStepContent planId={planId} />
                )}

                {/* Navigation — hidden on step 0 and on the terminal step 3,
                    where Go to Dashboard in the card is the only exit. */}
                {currentStep > 0 && currentStep < STEP_COUNT - 1 && (
                    <div className="flex gap-3">
                        <button
                            onClick={handleBack}
                            disabled={!canGoBack}
                            className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            ← Back
                        </button>
                        <button
                            onClick={handleNext}
                            disabled={!canGoNext}
                            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Next →
                        </button>
                    </div>
                )}

                {/* Skip */}
                <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
                    Skip setup →
                </Link>

            </div>
        </div>
    )
}
