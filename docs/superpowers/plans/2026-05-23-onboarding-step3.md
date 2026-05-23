# Onboarding Step 3 — Create Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the "Create Your First Plan" step content to the onboarding wizard: a minimal form with plan name (display-only), USDC price, and billing interval select, wired to `cyclo.createPlan()` with localStorage persistence of the returned planId.

**Architecture:** One new internal component `CreatePlanStepContent` added to `OnboardingPage.tsx`, receiving only an `onSuccess` callback prop. It owns all form state internally, calls `useCycloClient()` directly to obtain `cyclo.createPlan()` which returns `Promise<bigint>`, and notifies the parent via `onSuccess(planId)`. The parent stores planId in state and localStorage, then calls `goToStep(3)`. `canGoNext` on step 2 is gated on `planId !== null` to prevent the nav-row Next button from bypassing the form.

**Tech Stack:** React 19, TypeScript (strict — 0 baseline errors), wagmi v2, `@cyclo/react` (`useCycloClient`), `@cyclo/sdk` (`CreatePlanParams`, `CycloClient.createPlan`), Tailwind CSS v4, Vite.

---

## File Map

| File | Change |
|---|---|
| `src/app/src/pages/OnboardingPage.tsx` | Add `FormEvent` to react import, add `useCycloClient` import, add `PLAN_ID_KEY` constant, add three localStorage helpers, add `planId` state, update wallet-reset effect, update `canGoNext`, add `CreatePlanStepContentProps` interface, add `CreatePlanStepContent` component, add render condition for `currentStep === 2` |

No new files. No new dependencies.

---

## Context you must read before starting

**`src/app/src/pages/OnboardingPage.tsx`** (330 lines) — the only file you modify. Key landmarks:

- Line 16: `import { useState, useEffect, useRef } from 'react'` — you will add `FormEvent` here
- Line 24: last import line — you will add `useCycloClient` import after it
- Line 28: `const STORAGE_KEY` — add `PLAN_ID_KEY` after this line
- Lines 59–86: three localStorage helpers (`readPersistedStep`, `persistStep`, `clearPersistedStep`) — add three more planId helpers directly after line 86
- Line 155: `// ── Page ──────────────` section header — the new component goes before this line
- Lines 163–165: state declarations — add `planId` state after `flashingStep`
- Lines 193–206: wallet-reset effect — add `setPlanId(null)` and `clearPersistedPlanId()` inside the reset `if` block (lines 200–203)
- Lines 253–256: `canGoNext` declaration — add fourth guard clause for step 2
- Lines 287–300: step content render block — add step 3 content after the step 2 block (after line 300)

**`packages/react/src/index.ts`** — confirms `useCycloClient` is exported from `@cyclo/react`.

**`packages/sdk/src/client.ts`** — `createPlan(params: CreatePlanParams): Promise<bigint>` where `CreatePlanParams = { price: number, intervalDays: number, trialDays?: number }`. `price` is a decimal USDC number (e.g., `10.0`). `intervalDays` is a number (e.g., `30`). The method resolves with the planId `bigint` from the `PlanCreated` event log.

---

## Baseline error count

Before making any changes, run:

```bash
cd src/app && npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```

Expected: `0`. Your changes must not increase it.

---

## Task 1: Add constants, localStorage helpers, page-level state and logic

**Files:**
- Modify: `src/app/src/pages/OnboardingPage.tsx`

This task adds all supporting infrastructure in the page module without touching the JSX return yet.

- [ ] **Step 1: Add `FormEvent` to the react import**

Open `src/app/src/pages/OnboardingPage.tsx`. Find line 16:

```ts
import { useState, useEffect, useRef } from 'react'
```

Replace with:

```ts
import { useState, useEffect, useRef, FormEvent } from 'react'
```

- [ ] **Step 2: Add `useCycloClient` import**

Find the last import line (line 24, currently `import { fromUsdcUnits } from '../utils/formatting'`). Add one line directly after it:

```ts
import { useCycloClient } from '@cyclo/react'
```

Full import block after the change:

```ts
import { useState, useEffect, useRef, FormEvent } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { Link } from 'wouter'
import { OnboardingStepper } from '../components/OnboardingStepper'
import type { OnboardingStep } from '../components/OnboardingStepper'
import { ConnectButton } from '../components/WalletStatus'
import { USDC_ABI }      from '../constants/abis'
import { USDC_ADDRESS }  from '../constants/addresses'
import { fromUsdcUnits } from '../utils/formatting'
import { useCycloClient } from '@cyclo/react'
```

- [ ] **Step 3: Add `PLAN_ID_KEY` constant**

In the `// ── Constants ─────────` section, find:

```ts
const STORAGE_KEY = 'cyclo_onboarding_step'
```

Add one line directly after it:

```ts
const PLAN_ID_KEY = 'cyclo_onboarding_planId'
```

- [ ] **Step 4: Add three planId localStorage helpers**

Find the closing brace of `clearPersistedStep` (currently the last function before `// ── Step content ─────────`):

```ts
function clearPersistedStep(): void {
    try {
        localStorage.removeItem(STORAGE_KEY)
    } catch {
        // ignore
    }
}
```

Add the three new helpers directly after it, before the `// ── Step content ─────────` comment:

```ts
function readPersistedPlanId(): bigint | null {
    try {
        const raw = localStorage.getItem(PLAN_ID_KEY)
        if (raw === null) return null
        return BigInt(raw)
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
```

- [ ] **Step 5: Add `planId` state to `OnboardingPage`**

Inside `OnboardingPage`, find the two existing state declarations:

```ts
    const [currentStep, setCurrentStep]   = useState<number>(readPersistedStep)
    const [flashingStep, setFlashingStep] = useState<number | null>(null)
```

Add `planId` state directly after `flashingStep`:

```ts
    const [currentStep, setCurrentStep]   = useState<number>(readPersistedStep)
    const [flashingStep, setFlashingStep] = useState<number | null>(null)
    const [planId, setPlanId]             = useState<bigint | null>(readPersistedPlanId)
```

- [ ] **Step 6: Update wallet-reset effect to clear planId**

Find the if block inside the wallet-reset effect:

```ts
        if (addressChanged || disconnected) {
            setCurrentStep(0)
            clearPersistedStep()
        }
```

Replace with:

```ts
        if (addressChanged || disconnected) {
            setCurrentStep(0)
            clearPersistedStep()
            setPlanId(null)
            clearPersistedPlanId()
        }
```

- [ ] **Step 7: Add planId guard to `canGoNext`**

Find:

```ts
    const canGoNext =
        currentStep < STEP_COUNT - 1 &&
        (currentStep > 0 || isConnected) &&
        (currentStep !== 1 || (usdcBalance !== undefined && usdcBalance > 0n))
```

Replace with:

```ts
    // Next is disabled on the last step, on step 0 when not connected, on
    // step 1 when the USDC balance is zero, and on step 2 before a plan is
    // created — mirrors each card's own advance mechanism so the nav row
    // cannot bypass any step's requirement.
    const canGoNext =
        currentStep < STEP_COUNT - 1 &&
        (currentStep > 0 || isConnected) &&
        (currentStep !== 1 || (usdcBalance !== undefined && usdcBalance > 0n)) &&
        (currentStep !== 2 || planId !== null)
```

- [ ] **Step 8: TypeScript check**

```bash
cd src/app && npx tsc --noEmit 2>&1 | grep "error TS"
```

Expected: no output (0 errors). If you see errors about `useCycloClient`, verify the import path is `'@cyclo/react'` and the package is present in `packages/react/src/index.ts`. If you see `planId` is unused, that's expected — Task 2 will use it.

- [ ] **Step 9: Commit**

```bash
git add src/app/src/pages/OnboardingPage.tsx
git commit -m "feat(demo): add plan-id state and localStorage helpers to onboarding wizard"
```

---

## Task 2: Implement `CreatePlanStepContent` and wire it into `OnboardingPage`

**Files:**
- Modify: `src/app/src/pages/OnboardingPage.tsx`

There is no separate test framework for the React frontend — verification is manual (see the checklist at the end).

- [ ] **Step 1: Add `CreatePlanStepContentProps` interface and `CreatePlanStepContent` component**

Find the `// ── Page ──────────────` section header and everything directly before it. Currently the section just above it ends with the closing brace of `FundWalletStepContent`:

```ts
}

// ── Page ──────────────────────────────────────────────────────────────────────
```

Insert the following between that closing brace and the `// ── Page` comment:

```ts
interface CreatePlanStepContentProps {
    onSuccess: (planId: bigint) => void
}

/**
 * Content panel for step 2: form to create a subscription plan.
 * Owns all form state internally. Calls cyclo.createPlan() on submit,
 * then notifies the parent via onSuccess(planId) to persist and advance.
 */
function CreatePlanStepContent({ onSuccess }: CreatePlanStepContentProps): JSX.Element {
    const [planName, setPlanName]   = useState('')
    const [price,    setPrice]      = useState('')
    const [interval, setInterval]   = useState('2592000')
    const [isPending, setIsPending] = useState(false)
    const [error,    setError]      = useState<string | null>(null)

    const cyclo = useCycloClient()

    async function handleSubmit(e: FormEvent): Promise<void> {
        e.preventDefault()
        setError(null)
        setIsPending(true)
        try {
            const id = await cyclo.createPlan({
                price:        parseFloat(price),
                intervalDays: parseInt(interval) / 86400,
                trialDays:    0,
            })
            onSuccess(id)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create plan')
        } finally {
            setIsPending(false)
        }
    }

    const canSubmit = price !== '' && parseFloat(price) >= 0.01 && !isPending

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
                        <option value="2592000">Monthly</option>
                        <option value="604800">Weekly</option>
                        <option value="31536000">Yearly</option>
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
```

- [ ] **Step 2: Add step 3 render condition in JSX**

In the JSX return of `OnboardingPage`, find the step 2 content block:

```tsx
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
```

Add the step 3 block directly after it:

```tsx
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
```

- [ ] **Step 3: TypeScript check**

```bash
cd src/app && npx tsc --noEmit 2>&1 | grep "error TS"
```

Expected: no output (0 errors). Common errors to check:
- `planId` still unused → you missed wiring Step 2 correctly.
- `useCycloClient` not found → check `@cyclo/react` import path.
- `FormEvent` not found → check it's in the react import on line 16.
- Type mismatch on `onSuccess` → verify `CreatePlanStepContentProps.onSuccess: (planId: bigint) => void`.

- [ ] **Step 4: Foundry test check**

```bash
forge test
```

Expected: all tests pass, 0 failed. (This change is frontend-only; Foundry tests should be unaffected.)

- [ ] **Step 5: Manual verification checklist**

Start the dev server:

```bash
cd src/app && npm run dev
```

Navigate to `http://localhost:5173/onboarding`.

- [ ] Connect wallet → auto-advances to step 1.
- [ ] Fund from faucet, click "I'm funded, continue" → advances to step 2.
- [ ] Step 2 shows heading "Create your first subscription plan" and subtext "This defines what you're charging and how often."
- [ ] Three fields visible: Plan name (optional), Price (USDC), Billing interval (select).
- [ ] Plan name field accepts text but is not submitted to the contract.
- [ ] Billing interval defaults to "Monthly".
- [ ] "Create Plan" button is disabled when price is empty.
- [ ] "Create Plan" button is disabled when price is less than 0.01.
- [ ] Entering a valid price ≥ 0.01 enables the "Create Plan" button.
- [ ] Clicking "Create Plan" with valid inputs shows "Creating…" and disables the button.
- [ ] On success: wizard advances to step 3 ("Share Your Link" becomes active in stepper).
- [ ] Refreshing with step 2 persisted and planId in localStorage: wizard remains at step 2 (step persisted) and canGoNext reflects planId already set.
- [ ] Nav-row Next button on step 2 is disabled before a plan is created.
- [ ] If `cyclo.createPlan()` throws (e.g. wallet rejects), inline error appears in red; button re-enables.
- [ ] Disconnecting wallet resets to step 0 and clears planId from localStorage.

- [ ] **Step 6: Commit**

```bash
git add src/app/src/pages/OnboardingPage.tsx
git commit -m "feat(demo): add create-plan step content to onboarding wizard

- CreatePlanStepContent renders on step index 2
- useCycloClient().createPlan() called on form submit
- intervalDays derived from seconds select value (÷86400)
- planId stored in state and localStorage under cyclo_onboarding_planId
- canGoNext on step 2 gated on planId !== null
- wallet disconnect clears planId state and localStorage"
```

---

## Self-review against spec

**Spec coverage:**

| Spec requirement | Covered by |
|---|---|
| Heading "Create your first subscription plan" | Task 2 Step 1 — exact string in JSX |
| Subtext "This defines what you're charging and how often." | Task 2 Step 1 — exact string in JSX |
| Plan name field (optional, display-only) | Task 2 Step 1 — input present, not passed to `createPlan` |
| Price field `type="number"` with `min="0.01"` `step="0.01"` | Task 2 Step 1 — input attrs |
| Billing interval select: Monthly/Weekly/Yearly with seconds values | Task 2 Step 1 — three `<option>` elements |
| Monthly default | Task 2 Step 1 — `useState('2592000')` |
| Button disabled when price empty or < 0.01 or isPending | Task 2 Step 1 — `canSubmit` guard |
| Button shows "Creating…" while pending | Task 2 Step 1 — ternary on `isPending` |
| `cyclo.createPlan({ price, intervalDays, trialDays: 0 })` | Task 2 Step 1 — `handleSubmit` |
| intervalDays = parseInt(interval) / 86400 | Task 2 Step 1 — arithmetic in handleSubmit |
| planId stored in state and localStorage | Task 2 Step 2 — `onSuccess` callback |
| Advance to step 3 on success | Task 2 Step 2 — `goToStep(3)` in `onSuccess` |
| Inline error on failure | Task 2 Step 1 — `{error !== null && <p ...>}` |
| `canGoNext` on step 2 gated on `planId !== null` | Task 1 Step 7 — fourth clause |
| Wallet disconnect clears planId | Task 1 Step 6 — `setPlanId(null)` + `clearPersistedPlanId()` |
| `PLAN_ID_KEY = 'cyclo_onboarding_planId'` | Task 1 Step 3 |
| No new files | ✓ only `OnboardingPage.tsx` modified |
| No new dependencies | ✓ `@cyclo/react` already in project |
| No inline styles in new JSX | ✓ only Tailwind classes used |
| TypeScript 0 errors | Task 1 Step 8, Task 2 Step 3 |
