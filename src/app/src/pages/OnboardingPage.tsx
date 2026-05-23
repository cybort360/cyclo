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
import { useState, useEffect, useRef } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { Link } from 'wouter'
import { OnboardingStepper } from '../components/OnboardingStepper'
import type { OnboardingStep } from '../components/OnboardingStepper'
import { ConnectButton } from '../components/WalletStatus'
import { USDC_ABI }      from '../constants/abis'
import { USDC_ADDRESS }  from '../constants/addresses'
import { fromUsdcUnits } from '../utils/formatting'

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cyclo_onboarding_step'

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
    address:   `0x${string}`
    onAdvance: () => void
}

/**
 * Content panel for step 1: shows the Arc faucet link, live USDC balance,
 * and a continue button that enables once the balance exceeds zero.
 */
function FundWalletStepContent({ address, onAdvance }: FundWalletStepContentProps) {
    const { data: usdcBalance } = useReadContract({
        address:      USDC_ADDRESS as `0x${string}`,
        abi:          USDC_ABI,
        functionName: 'balanceOf',
        args:         [address],
        query:        { refetchInterval: 5_000 },
    })

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

    // Next is disabled on the last step, and on step 0 when not connected
    // (wallet connection is required to progress past step 1).
    const canGoNext = currentStep < STEP_COUNT - 1 && (currentStep > 0 || isConnected)
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

                {/* Stepper */}
                <OnboardingStepper
                    steps={ONBOARDING_STEPS}
                    currentStep={currentStep}
                    onStepClick={goToStep}
                    flashingStep={flashingStep}
                />

                {/* Step 1 content — wallet connect card */}
                {currentStep === 0 && <ConnectWalletStepContent />}

                {/* Step 2 content — fund wallet card */}
                {currentStep === 1 && address && (
                    <FundWalletStepContent
                        address={address}
                        onAdvance={() => goToStep(2)}
                    />
                )}

                {/* Navigation — hidden on step 0; connection itself advances the step */}
                {currentStep > 0 && (
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
