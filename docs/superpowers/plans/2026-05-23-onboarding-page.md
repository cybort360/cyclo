# Onboarding Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/onboarding` setup wizard at `src/app/src/pages/OnboardingPage.tsx` with a 4-step stepper shell, localStorage-persisted step index, and wallet-address-change reset — no step content yet.

**Architecture:** Two new files (`OnboardingStepper.tsx` stateless component, `OnboardingPage.tsx` page shell) plus a one-line route addition to `App.tsx`. State lives entirely in `OnboardingPage`; `OnboardingStepper` is purely presentational. No new dependencies required.

**Tech Stack:** React 19, wagmi `useAccount`, wouter `Route`/`Link`, Tailwind CSS v4, TypeScript strict mode (`noUnusedLocals`, `noUnusedParameters`)

---

> **Pre-existing baseline (do not fix):** 5 TypeScript errors and 14 ESLint errors exist in the repo before these changes. Verification steps grep/filter for only the new files so pre-existing failures do not create confusion.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| **Create** | `src/app/src/components/OnboardingStepper.tsx` | Stateless stepper UI — step circle, connector, title, description |
| **Create** | `src/app/src/pages/OnboardingPage.tsx` | Page shell — layout, state, localStorage, wallet reset, nav buttons |
| **Modify** | `src/app/src/App.tsx` | Register `/onboarding` as a full-page route (no Layout) |

---

## Task 1: Create `OnboardingStepper` component

**Files:**
- Create: `src/app/src/components/OnboardingStepper.tsx`

- [ ] **Step 1.1 — Create the file**

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
 */

export interface OnboardingStep {
    title:       string
    description: string
}

interface OnboardingStepperProps {
    steps:       OnboardingStep[]
    currentStep: number
    onStepClick: (index: number) => void
}

type StepState = 'completed' | 'active' | 'future'

interface StepCircleProps {
    index: number
    state: StepState
}

function StepCircle({ index, state }: StepCircleProps) {
    const base = 'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0'

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

export function OnboardingStepper({ steps, currentStep, onStepClick }: OnboardingStepperProps) {
    return (
        <div className="w-full">
            {steps.map((step, index) => {
                const isCompleted = index < currentStep
                const isActive    = index === currentStep
                const isLast      = index === steps.length - 1
                const state: StepState = isCompleted ? 'completed' : isActive ? 'active' : 'future'

                return (
                    <div key={index} className="flex gap-4">

                        {/* Left column: circle + vertical connector */}
                        <div className="flex flex-col items-center">
                            {isCompleted ? (
                                <button
                                    onClick={() => onStepClick(index)}
                                    className="focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded-full"
                                    aria-label={`Go back to ${step.title}`}
                                >
                                    <StepCircle index={index} state={state} />
                                </button>
                            ) : (
                                <StepCircle index={index} state={state} />
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
                                isCompleted ? 'text-gray-900 font-medium'    :
                                              'text-gray-400 font-medium'
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

- [ ] **Step 1.2 — Verify: no new TypeScript errors in this file**

```bash
cd /Users/HideOut/Documents/Cyclo/src/app
npx tsc -p tsconfig.app.json 2>&1 | grep "OnboardingStepper"
```

Expected: **no output** (zero errors in this file).

- [ ] **Step 1.3 — Verify: no lint errors in this file**

```bash
cd /Users/HideOut/Documents/Cyclo/src/app
npx eslint src/components/OnboardingStepper.tsx
```

Expected: **no output** (exit code 0).

- [ ] **Step 1.4 — Commit**

```bash
cd /Users/HideOut/Documents/Cyclo
git add src/app/src/components/OnboardingStepper.tsx
git commit -m "feat(demo): add OnboardingStepper stateless component

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Create `OnboardingPage` shell

**Files:**
- Create: `src/app/src/pages/OnboardingPage.tsx`

- [ ] **Step 2.1 — Create the file**

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
 *   - Step 0 Next button is gated on wallet connection
 */
import { useState, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { Link } from 'wouter'
import { OnboardingStepper } from '../components/OnboardingStepper'
import type { OnboardingStep } from '../components/OnboardingStepper'

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

const STEP_COUNT = ONBOARDING_STEPS.length  // 4

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

// ── Page ──────────────────────────────────────────────────────────────────────

export function OnboardingPage() {
    const { address, isConnected } = useAccount()
    const [currentStep, setCurrentStep] = useState<number>(readPersistedStep)

    // lastAddressRef records the address seen in the previous effect run.
    // Starts as undefined so the initial mount (address going from undefined
    // to a value) does NOT trigger a reset.
    const lastAddressRef = useRef<string | undefined>(undefined)

    // Reset to step 0 when the wallet address changes or disconnects.
    // address is undefined when no wallet is connected (wagmi contract).
    useEffect(() => {
        if (address === undefined) {
            // Wallet disconnected — reset unconditionally.
            // React bails out of re-render if the new state equals the old.
            setCurrentStep(0)
            clearPersistedStep()
            lastAddressRef.current = undefined
            return
        }

        if (lastAddressRef.current !== undefined && lastAddressRef.current !== address) {
            // A different wallet connected — reset.
            setCurrentStep(0)
            clearPersistedStep()
        }

        lastAddressRef.current = address
    }, [address])

    function goToStep(step: number): void {
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
                />

                {/* Navigation */}
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

                {/* Skip */}
                <Link href="/">
                    <a className="text-sm text-gray-400 hover:text-gray-600">
                        Skip setup →
                    </a>
                </Link>

            </div>
        </div>
    )
}
```

- [ ] **Step 2.2 — Verify: no new TypeScript errors in this file**

```bash
cd /Users/HideOut/Documents/Cyclo/src/app
npx tsc -p tsconfig.app.json 2>&1 | grep "OnboardingPage"
```

Expected: **no output**.

- [ ] **Step 2.3 — Verify: no lint errors in this file**

```bash
cd /Users/HideOut/Documents/Cyclo/src/app
npx eslint src/pages/OnboardingPage.tsx
```

Expected: **no output** (exit code 0).

- [ ] **Step 2.4 — Commit**

```bash
cd /Users/HideOut/Documents/Cyclo
git add src/app/src/pages/OnboardingPage.tsx
git commit -m "feat(demo): add OnboardingPage shell with stepper and localStorage state

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Register the route and verify end-to-end

**Files:**
- Modify: `src/app/src/App.tsx`

- [ ] **Step 3.1 — Add the import**

In `src/app/src/App.tsx`, add this import after the existing page imports (after the `ArcEconomicsPage` import):

```tsx
import { OnboardingPage } from './pages/OnboardingPage'
```

- [ ] **Step 3.2 — Register the route**

In `App.tsx`, inside the `<Switch>`, add `/onboarding` **before** the catch-all `<Route>` block that wraps `<Layout>`. The full-page routes section should look like this after the change:

```tsx
{/* Full-page routes — no sidebar */}
<Route path="/subscribe/:planId" component={SubscribeRoute} />
<Route path="/portal" component={PortalPage} />
<Route path="/arc-economics" component={ArcEconomicsPage} />
<Route path="/stats" component={StatsPage} />
<Route path="/demo" component={DemoPage} />
<Route path="/docs" component={DocsPage} />
<Route path="/onboarding" component={OnboardingPage} />
```

- [ ] **Step 3.3 — Verify: no new TypeScript errors in modified file**

```bash
cd /Users/HideOut/Documents/Cyclo/src/app
npx tsc -p tsconfig.app.json 2>&1 | grep "App.tsx"
```

Expected: **no output** (App.tsx had zero errors before; confirm it still does).

- [ ] **Step 3.4 — Verify: no lint errors in modified file**

```bash
cd /Users/HideOut/Documents/Cyclo/src/app
npx eslint src/App.tsx
```

Expected: **no output** (exit code 0).

- [ ] **Step 3.5 — Start the dev server and open the page**

```bash
cd /Users/HideOut/Documents/Cyclo/src/app
npm run dev
```

Navigate to `http://localhost:5173/onboarding` in a browser.

- [ ] **Step 3.6 — Browser checklist**

Verify each item visually before committing:

| # | Check | Expected |
|---|---|---|
| 1 | Page renders | Full-screen gray background, no sidebar, no top bar |
| 2 | Logo | Indigo square with "C" + "Cyclo" wordmark |
| 3 | Stepper — initial state | Step 1 circle is indigo + "1"; steps 2–4 are gray outlined |
| 4 | Stepper — titles | Step 1 title is `text-indigo-700 font-semibold`; steps 2–4 are gray |
| 5 | Next button | Disabled (wallet not connected) |
| 6 | Back button | Disabled (on step 0) |
| 7 | Connect wallet in MetaMask | Next button becomes enabled |
| 8 | Click Next | Advances to step 2; step 1 circle shows `✓`; connector line turns indigo |
| 9 | Refresh page | Resumes at step 2 (localStorage persisted) |
| 10 | Click the step 1 `✓` circle | Jumps back to step 1 |
| 11 | Click Next to step 4 | Next button becomes disabled (last step) |
| 12 | Disconnect wallet in MetaMask | Resets to step 1; localStorage cleared |
| 13 | "Skip setup →" link | Navigates to `/` (dashboard) |

- [ ] **Step 3.7 — Commit**

```bash
cd /Users/HideOut/Documents/Cyclo
git add src/app/src/App.tsx
git commit -m "feat(demo): register /onboarding as full-page route

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Definition of Done

Cross-reference with the spec at `docs/superpowers/specs/2026-05-23-onboarding-page-design.md`:

- [ ] `/onboarding` renders without sidebar or top bar
- [ ] Stepper shows 4 steps with correct visual state (completed / active / future)
- [ ] Completed steps are clickable and jump back correctly
- [ ] Step 0 Next is disabled when wallet is not connected
- [ ] Current step persists to `cyclo_onboarding_step` in localStorage
- [ ] Refreshing the page resumes at the persisted step
- [ ] Connecting a different wallet resets to step 0
- [ ] Disconnecting the wallet resets to step 0
- [ ] Back is disabled on step 0, Next is disabled on step 3
- [ ] No sidebar, no Layout component, no `console.log` in production paths
