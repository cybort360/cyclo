# Onboarding Step 3 — Create Plan Design

**Date:** 2026-05-23  
**Scope:** Step 3 content for `/onboarding`. Shows a minimal plan-creation form. On success, stores the returned planId and advances to Step 4.

---

## Overview

Add interactive content to Step 3 of the onboarding wizard (step index 2, "Create Your First Plan"). The user fills in a plan name (display-only), a price in USDC, and a billing interval. Clicking "Create Plan" calls `cyclo.createPlan()` directly. On success the planId is stored in localStorage and the wizard advances to Step 4. On failure an inline error message is shown.

---

## Files

| File | Change |
|---|---|
| `src/app/src/pages/OnboardingPage.tsx` | Add `PLAN_ID_KEY` constant, three localStorage helpers, `planId` state, `CreatePlanStepContentProps` interface, `CreatePlanStepContent` component, render it at `currentStep === 2`, update `canGoNext` and wallet-reset effect |

No new files. No new dependencies.

---

## New Constant

```ts
const PLAN_ID_KEY = 'cyclo_onboarding_planId'
```

Defined at module level in `OnboardingPage.tsx`, near the other storage key constants (`STORAGE_KEY`).

---

## New localStorage Helpers

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
        // ignore
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

All three follow the same defensive try/catch pattern as the existing `readPersistedStep`, `persistStep`, and `clearPersistedStep` helpers.

---

## New State in `OnboardingPage`

```ts
const [planId, setPlanId] = useState<bigint | null>(readPersistedPlanId)
```

Initialized from localStorage on mount, same pattern as `currentStep`.

### Wallet Reset

The existing address-change / disconnect effect also clears `planId`:

```ts
if (addressChanged || disconnected) {
    setCurrentStep(0)
    clearPersistedStep()
    setPlanId(null)
    clearPersistedPlanId()
}
```

---

## `CreatePlanStepContent` Component

### Props Interface

```ts
interface CreatePlanStepContentProps {
    onSuccess: (planId: bigint) => void
}
```

`onSuccess` — called with the returned planId when `cyclo.createPlan()` resolves. The parent persists the id and advances to step 3.

### Internal State

```ts
const [planName, setPlanName]   = useState('')
const [price,    setPrice]      = useState('')
const [interval, setInterval]   = useState('2592000')  // Monthly default
const [isPending, setIsPending] = useState(false)
const [error,    setError]      = useState<string | null>(null)
```

### SDK Call

```ts
const cyclo = useCycloClient()

async function handleSubmit(e: React.FormEvent): Promise<void> {
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
```

`useCycloClient()` is imported from `@cyclo/react`. `cyclo.createPlan()` returns `Promise<bigint>` (the planId from the `PlanCreated` event log).

### Interval Conversion

The `<select>` stores interval values as seconds strings. The SDK parameter `intervalDays` is derived by dividing by 86400:

| Option label | Select value | `intervalDays` |
|---|---|---|
| Monthly | `"2592000"` | 30 |
| Weekly | `"604800"` | 7 |
| Yearly | `"31536000"` | 365 |

### Plan Name

Display-only. Not passed to `createPlan`. The on-chain `createPlan` interface has no name parameter. The field exists as a UX affordance only.

### Submit Guard

```ts
const canSubmit = price !== '' && parseFloat(price) >= 0.01 && !isPending
```

The "Create Plan" button is disabled when `!canSubmit`.

### Card Layout

```
┌──────────────────────────────────────┐
│  Create your first subscription plan │  text-lg font-semibold text-gray-900
│  This defines what you're charging   │  text-sm text-gray-500 mt-1
│  and how often.                      │
│                                      │
│  Plan name (optional)                │  text-sm font-medium text-gray-700
│  [________________________]          │  text input
│                                      │
│  Price (USDC)                        │  text-sm font-medium text-gray-700
│  [________________________]          │  number input, min="0.01" step="0.01"
│                                      │
│  Billing interval                    │  text-sm font-medium text-gray-700
│  [Monthly              ▼]            │  select: Monthly / Weekly / Yearly
│                                      │
│  Failed to create plan               │  text-sm text-red-600 (conditional)
│                                      │
│  [Create Plan]                       │  indigo button, disabled when !canSubmit
└──────────────────────────────────────┘
```

Card classes: `bg-white border border-gray-200 rounded-xl p-6 space-y-4` — matches `ConnectWalletStepContent` and `FundWalletStepContent`.

Button text: `"Create Plan"` when not pending, `"Creating…"` when pending.

### JSX

```tsx
function CreatePlanStepContent({ onSuccess }: CreatePlanStepContentProps): JSX.Element {
    const [planName, setPlanName]     = useState('')
    const [price,    setPrice]        = useState('')
    const [interval, setInterval]     = useState('2592000')
    const [isPending, setIsPending]   = useState(false)
    const [error,    setError]        = useState<string | null>(null)

    const cyclo = useCycloClient()

    async function handleSubmit(e: React.FormEvent): Promise<void> {
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

---

## Wiring in `OnboardingPage`

```tsx
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

---

## Updated `canGoNext`

```ts
const canGoNext =
    currentStep < STEP_COUNT - 1 &&
    (currentStep > 0 || isConnected) &&
    (currentStep !== 1 || (usdcBalance !== undefined && usdcBalance > 0n)) &&
    (currentStep !== 2 || planId !== null)
```

The nav-row Next button on step 3 is disabled until `planId` is set. Advancement happens inside `CreatePlanStepContent` via `onSuccess`, not via Next — the `canGoNext` guard prevents users from skipping forward if they somehow reach step 3 with no planId.

---

## New Import Required in `OnboardingPage.tsx`

```ts
import { useCycloClient } from '@cyclo/react'
```

---

## Spec Non-Goals

- No plan name stored anywhere (not on-chain, not in localStorage)
- No plan preview or summary before submission
- No content for Step 4 (added in a future task)
- No change to the stepper component or nav row layout
- No custom price validation beyond `min="0.01"` and the `canSubmit` guard
- No success toast — advancement to Step 4 is the success signal

---

## Definition of Done

- [ ] `CreatePlanStepContent` renders when `currentStep === 2`
- [ ] Heading is exactly "Create your first subscription plan"
- [ ] Subtext is exactly "This defines what you're charging and how often."
- [ ] Plan name field is present and display-only (not submitted)
- [ ] Price field is `type="number"` with `min="0.01"` and `step="0.01"`
- [ ] Billing interval select has exactly three options: Monthly (2592000s), Weekly (604800s), Yearly (31536000s); Monthly is default
- [ ] "Create Plan" button disabled when price is empty or < 0.01 or `isPending`
- [ ] Button shows "Creating…" while `isPending` is true
- [ ] On success: planId stored in state and localStorage under `cyclo_onboarding_planId`, wizard advances to step 3
- [ ] On failure: inline error message in `text-sm text-red-600`; button re-enables
- [ ] `canGoNext` on step 3 gated on `planId !== null`
- [ ] Wallet disconnect/address-change resets `planId` state and clears localStorage
- [ ] No `console.log`, no unused imports, no inline styles in new JSX
- [ ] TypeScript compiles with no new errors
