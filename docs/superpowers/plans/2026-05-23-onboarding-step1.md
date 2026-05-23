# Onboarding Step 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Step 1 content on `/onboarding` — a wallet connect card below the stepper that auto-advances to Step 2 on connection, with a 600ms green success flash on the step indicator. Arriving already-connected skips to Step 2 immediately.

**Architecture:** Two files modified. `OnboardingStepper` gains an optional `flashingStep` prop (backward-compatible) that renders the matching circle green. `OnboardingPage` gains a `flashingStep` state, a `wasConnectedAtMountRef` for mount-time skip logic, an auto-advance effect, a `Step1Content` component, and conditional nav row visibility.

**Tech Stack:** React 19, wagmi `useAccount`, TypeScript strict mode (`noUnusedLocals`, `noUnusedParameters`), Tailwind CSS v4. No new dependencies.

---

> **Pre-existing baseline:** 5 TypeScript errors and 14 ESLint errors exist in the repo in other files. Verification steps grep/filter for only the files being changed.

---

## File Map

| Action | Path | What changes |
|---|---|---|
| **Modify** | `src/app/src/components/OnboardingStepper.tsx` | Add `flashingStep?` prop, `isFlashing` to `StepCircle`, `transition-colors duration-300` on all circles |
| **Modify** | `src/app/src/pages/OnboardingPage.tsx` | Add `flashingStep` state, `wasConnectedAtMountRef`, auto-advance effect, `Step1Content`, import `ConnectButton`, hide nav on step 0 |

---

## Task 1: Add `flashingStep` prop to `OnboardingStepper`

**Files:**
- Modify: `src/app/src/components/OnboardingStepper.tsx`

This task is self-contained. The new `flashingStep` prop is optional — the existing call site in `OnboardingPage` continues to work without passing it until Task 2 wires it up.

- [ ] **Step 1.1 — Replace the file with the updated version**

Write the complete file to `src/app/src/components/OnboardingStepper.tsx`:

```tsx
/**
 * Stateless stepper component for the onboarding wizard.
 *
 * Renders 4 steps vertically with three visual states:
 *   - completed (index < currentStep): indigo filled circle, ✓, clickable
 *   - active    (index === currentStep): indigo filled circle, step number, not clickable
 *   - future    (index > currentStep): gray outlined circle, step number, not clickable
 *
 * Connector lines between steps are indigo when the lower step has been reached,
 * gray otherwise.
 *
 * Pass `flashingStep` to show a transient green success circle on the given step
 * index (used during the wallet-connect auto-advance animation).
 */

/**
 * Represents a single step in the onboarding wizard.
 */
export interface OnboardingStep {
    title:       string
    description: string
}

interface OnboardingStepperProps {
    steps:        OnboardingStep[]
    currentStep:  number
    onStepClick:  (index: number) => void
    /** Index of the step indicator to render in green during a success flash. */
    flashingStep?: number | null
}

type StepState = 'completed' | 'active' | 'future'

interface StepCircleProps {
    index:      number
    state:      StepState
    isFlashing: boolean
}

function StepCircle({ index, state, isFlashing }: StepCircleProps) {
    const base = 'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-colors duration-300'

    if (state === 'completed' && isFlashing) {
        return (
            <div className={`${base} bg-green-500 text-white`}>✓</div>
        )
    }

    if (state === 'completed') {
        return (
            <div className={`${base} bg-indigo-600 text-white`}>✓</div>
        )
    }

    if (state === 'active') {
        return (
            <div className={`${base} bg-indigo-600 text-white`}>
                {index + 1}
            </div>
        )
    }

    return (
        <div className={`${base} border-2 border-gray-300 text-gray-400`}>
            {index + 1}
        </div>
    )
}

/**
 * Stateless stepper component for the onboarding wizard.
 * @param steps - Ordered list of steps to display.
 * @param currentStep - Zero-based index of the currently active step.
 * @param onStepClick - Called with the step index when a completed step is clicked.
 * @param flashingStep - Optional index of the step indicator to render in green (success flash).
 */
export function OnboardingStepper({ steps, currentStep, onStepClick, flashingStep }: OnboardingStepperProps) {
    return (
        <div className="w-full">
            {steps.map((step, index) => {
                const isCompleted = index < currentStep
                const isActive    = index === currentStep
                const isLast      = index === steps.length - 1
                const state: StepState = isCompleted ? 'completed' : isActive ? 'active' : 'future'
                const isFlashing  = flashingStep != null && index === flashingStep

                return (
                    <div key={step.title} className="flex gap-4">

                        {/* Left column: circle + vertical connector */}
                        <div className="flex flex-col items-center">
                            {isCompleted ? (
                                <button
                                    onClick={() => onStepClick(index)}
                                    className="focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded-full"
                                    aria-label={`Go back to ${step.title}`}
                                >
                                    <StepCircle index={index} state={state} isFlashing={isFlashing} />
                                </button>
                            ) : (
                                <StepCircle index={index} state={state} isFlashing={isFlashing} />
                            )}

                            {/* Connector line — omitted after the last step */}
                            {!isLast && (
                                <div
                                    className={`w-0.5 my-1 flex-1 ${
                                        index < currentStep ? 'bg-indigo-600' : 'bg-gray-200'
                                    }`}
                                    style={{ minHeight: '2rem' }}
                                />
                            )}
                        </div>

                        {/* Right column: step title + description */}
                        <div className={`min-w-0 ${isLast ? 'pb-0' : 'pb-8'}`}>
                            <p className={`text-sm leading-none mt-1.5 ${
                                isActive    ? 'text-indigo-700 font-semibold' :
                                isCompleted ? 'text-gray-900'                 :
                                              'text-gray-400'
                            }`}>
                                {step.title}
                            </p>
                            <p className="text-sm text-gray-500 mt-1 leading-snug">
                                {step.description}
                            </p>
                        </div>

                    </div>
                )
            })}
        </div>
    )
}
```

- [ ] **Step 1.2 — Verify: no new TypeScript errors**

```bash
cd /Users/HideOut/Documents/Cyclo/src/app
npx tsc -p tsconfig.app.json 2>&1 | grep "OnboardingStepper"
```

Expected: **no output**.

- [ ] **Step 1.3 — Verify: no new lint errors**

```bash
cd /Users/HideOut/Documents/Cyclo/src/app
npx eslint src/components/OnboardingStepper.tsx
```

Expected: **no output** (exit 0).

- [ ] **Step 1.4 — Commit**

```bash
cd /Users/HideOut/Documents/Cyclo
git add src/app/src/components/OnboardingStepper.tsx
git commit -m "feat(demo): add flashingStep prop to OnboardingStepper for success animation

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Add Step 1 content and auto-advance to `OnboardingPage`

**Files:**
- Modify: `src/app/src/pages/OnboardingPage.tsx`

Depends on Task 1 (uses the `flashingStep` prop added there).

- [ ] **Step 2.1 — Replace the file with the updated version**

Write the complete file to `src/app/src/pages/OnboardingPage.tsx`:

```tsx
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
import { useAccount } from 'wagmi'
import { Link } from 'wouter'
import { OnboardingStepper } from '../components/OnboardingStepper'
import type { OnboardingStep } from '../components/OnboardingStepper'
import { ConnectButton } from '../components/WalletStatus'

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
function Step1Content() {
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
        // Enforce the wallet-connection gate: step 0 → 1 requires an active connection.
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
                {currentStep === 0 && <Step1Content />}

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
```

- [ ] **Step 2.2 — Verify: no new TypeScript errors**

```bash
cd /Users/HideOut/Documents/Cyclo/src/app
npx tsc -p tsconfig.app.json 2>&1 | grep -E "OnboardingPage|OnboardingStepper"
```

Expected: **no output**.

- [ ] **Step 2.3 — Verify: no new lint errors**

```bash
cd /Users/HideOut/Documents/Cyclo/src/app
npx eslint src/pages/OnboardingPage.tsx
```

Expected: **no output** (exit 0).

- [ ] **Step 2.4 — Start dev server and verify browser behavior**

```bash
cd /Users/HideOut/Documents/Cyclo/src/app
npm run dev
```

Navigate to `http://localhost:5173/onboarding`. Run through this checklist before committing:

| # | Action | Expected |
|---|---|---|
| 1 | Arrive not connected | Step 1 circle active (indigo "1"), wallet connect card visible below stepper |
| 2 | Card heading | "Connect your wallet" |
| 3 | Card subtext | "You'll need a Web3 wallet to create plans and receive payments." |
| 4 | Nav row | Hidden (no Back/Next buttons) |
| 5 | Click "Connect Wallet" and approve in MetaMask | Step 1 circle briefly turns **green** |
| 6 | After ~600ms | Auto-advances to step 2; step 1 circle returns to indigo ✓; Back/Next nav appears |
| 7 | localStorage after advance | `cyclo_onboarding_step = "1"` |
| 8 | Click Back to step 1 | Wallet connect card reappears; nav row hides again |
| 9 | Disconnect wallet | Resets to step 0; wallet connect card reappears |
| 10 | Refresh with wallet already connected | Arrives at step 2 immediately (no flash) |
| 11 | Refresh with step 2 persisted and wallet connected | Stays at step 2 (does not regress to step 1) |

Kill the dev server after verifying.

- [ ] **Step 2.5 — Commit**

```bash
cd /Users/HideOut/Documents/Cyclo
git add src/app/src/pages/OnboardingPage.tsx
git commit -m "feat(demo): implement step 1 wallet connect content with auto-advance animation

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Definition of Done

Cross-reference with spec at `docs/superpowers/specs/2026-05-23-onboarding-step1-design.md`:

- [ ] Arriving not connected shows step 1 content card with correct heading and subtext
- [ ] `ConnectButton` renders inside the card and triggers wallet connect
- [ ] Connecting wallet shows green flash on step 0 indicator for ~600ms then advances to step 1
- [ ] Arriving already connected with `currentStep === 0` advances to step 1 immediately (no flash)
- [ ] Arriving already connected with `currentStep > 0` resumes at persisted step (no regression)
- [ ] Nav row is hidden on step 0; visible from step 1 onwards
- [ ] `flashingStep` prop on `OnboardingStepper` is optional — no breakage at existing call sites
- [ ] `transition-colors duration-300` on all circle variants in `OnboardingStepper`
- [ ] No `console.log`, no unused imports, no inline styles added to new JSX
