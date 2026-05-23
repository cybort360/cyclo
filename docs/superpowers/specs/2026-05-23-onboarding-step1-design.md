# Onboarding Step 1 — Connect Wallet Design

**Date:** 2026-05-23  
**Scope:** Step 1 content for `/onboarding`. Auto-advance on wallet connect with success animation. No step content for steps 2–4.

---

## Overview

Add interactive content to Step 1 of the onboarding wizard. When the user lands on `/onboarding` and is not yet connected, they see a card with a wallet connect prompt. Connecting automatically advances to Step 2 with a brief green success flash on the step indicator. If they arrive already connected, they are silently skipped to Step 2 on mount.

---

## Files

| File | Change |
|---|---|
| `src/app/src/pages/OnboardingPage.tsx` | Add `flashingStep` state, `wasConnectedAtMountRef`, auto-advance effect, step 1 content card, hide nav row on step 0 |
| `src/app/src/components/OnboardingStepper.tsx` | Add optional `flashingStep?` prop; render green circle + `transition-colors` when flashing |

No new files. No new dependencies.

---

## State additions (`OnboardingPage`)

### New state

```ts
const [flashingStep, setFlashingStep] = useState<number | null>(null)
```

Holds the index of the step indicator currently showing the green flash. `null` when no flash is active.

### New ref

```ts
const wasConnectedAtMountRef = useRef(isConnected)
```

Snapshots `isConnected` at the moment the component mounts. Used once to distinguish "was already connected on arrival" from "just connected during this session."

---

## Auto-advance effect

```ts
useEffect(() => {
    if (!isConnected || currentStep !== 0) return

    if (wasConnectedAtMountRef.current) {
        // Already connected when page loaded — skip to step 1 immediately, no animation.
        wasConnectedAtMountRef.current = false
        setCurrentStep(1)
        persistStep(1)
        return
    }

    // Wallet just connected — flash green on step 0 circle, then advance.
    setFlashingStep(0)
    const timer = setTimeout(() => {
        setFlashingStep(null)
        setCurrentStep(1)
        persistStep(1)
    }, 600)
    return () => clearTimeout(timer)
}, [isConnected, currentStep])
```

**Behavior table:**

| Scenario | Result |
|---|---|
| Arrive at `/onboarding` already connected, `currentStep === 0` | Immediate advance to step 1, no animation |
| Arrive already connected, `currentStep > 0` (persisted) | No change — resume at persisted step |
| Connect wallet during step 0 | 600ms green flash on step 0 circle, then advance to step 1 |
| Arrive not connected, stay not connected | No auto-advance; Next button hidden (step 0) |

---

## Step 1 content card

Renders between the stepper and the nav buttons when `currentStep === 0`.

```
┌──────────────────────────────────┐
│  Connect your wallet             │  text-lg font-semibold text-gray-900
│  You'll need a Web3 wallet to    │  text-sm text-gray-500 mt-1
│  create plans and receive        │
│  payments.                       │
│                                  │
│  [Connect Wallet]                │  existing ConnectButton — unchanged
└──────────────────────────────────┘
```

Card classes: `bg-white border border-gray-200 rounded-xl p-6` — matches the card style used throughout the existing app (`ConnectPage`, `BrandingSection`).

`ConnectButton` is imported from `../components/WalletStatus` as-is. Its inline styles are not changed.

---

## Navigation row visibility

The Back/Next button row is hidden entirely when `currentStep === 0`:

```tsx
{currentStep > 0 && (
    <div className="flex gap-3">
        {/* Back + Next buttons */}
    </div>
)}
```

Rationale: connection itself triggers advancement. Showing a disabled "Next" with no active "Back" adds visual noise with no benefit.

---

## `OnboardingStepper` changes

### Updated props interface

```ts
interface OnboardingStepperProps {
    steps:        OnboardingStep[]
    currentStep:  number
    onStepClick:  (index: number) => void
    flashingStep?: number | null   // index of the step indicator to show in green
}
```

`flashingStep` is optional (`undefined` and `null` both mean no flash) so all existing call sites continue to work without changes.

### `StepCircle` — new `isFlashing` boolean prop

```ts
interface StepCircleProps {
    index:     number
    state:     StepState
    isFlashing: boolean
}
```

Rendering rules (priority order):

| Condition | Circle | Symbol |
|---|---|---|
| `state === 'completed' && isFlashing` | `bg-green-500 text-white` | ✓ |
| `state === 'completed'` | `bg-indigo-600 text-white` | ✓ |
| `state === 'active'` | `bg-indigo-600 text-white` | step number |
| `state === 'future'` | `border-2 border-gray-300 text-gray-400` | step number |

All circle divs gain `transition-colors duration-300` so the green→indigo return is animated after the flash ends.

---

## Spec non-goals

- No content for steps 2, 3, or 4 (added in future tasks)
- No change to the stepper's connector line or title/description rendering
- No change to the localStorage persistence or wallet-reset logic
- No change to the Back/Next button styles (they are simply hidden on step 0)

---

## Definition of Done

- [ ] Arriving at `/onboarding` not connected shows step 1 content card with correct heading and subtext
- [ ] `ConnectButton` renders inside the card and triggers wallet connect
- [ ] Connecting wallet shows green flash on step 0 indicator for ~600ms then advances to step 1
- [ ] Arriving already connected with `currentStep === 0` advances to step 1 immediately (no flash)
- [ ] Arriving already connected with `currentStep > 0` resumes at the persisted step (no regression)
- [ ] Nav row is hidden on step 0
- [ ] Nav row is visible again from step 1 onwards
- [ ] `flashingStep` prop on `OnboardingStepper` is optional — existing call sites unchanged
- [ ] `transition-colors duration-300` present on all circle variants
- [ ] No console.log, no unused imports, no inline styles added to new JSX
