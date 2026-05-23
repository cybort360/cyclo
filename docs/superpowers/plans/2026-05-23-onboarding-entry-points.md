# Onboarding Entry Points Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three entry points that surface the onboarding wizard — a zero-plan banner on Overview, a resume banner on /onboarding, and an always-visible "Setup guide" link in the sidebar.

**Architecture:** All three changes are isolated to existing files (OverviewPage.tsx, OnboardingPage.tsx, Layout.tsx). No new files, no new npm dependencies. Each task is independent and commits cleanly on its own.

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS v4, wouter v3 `Link`, wagmi `useAccount`, `@tanstack/react-query` via `useAnalytics`, localStorage.

---

## Baseline

Before any changes, confirm 0 TypeScript errors:

```bash
cd /Users/HideOut/Documents/Cyclo/src/app && npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```

Expected: `0`. Do not proceed if this is non-zero.

---

## File Map

| File | Change |
|---|---|
| `src/app/src/pages/OverviewPage.tsx` | Add `ONBOARDING_DISMISSED_KEY` constant, `OnboardingBannerProps` interface, `OnboardingBanner` component; update `useAccount` destructure; add `dismissed` state, address-watching `useEffect`, `handleDismiss`; render banner between page header and KPIs |
| `src/app/src/pages/OnboardingPage.tsx` | Add `ResumeBannerProps` interface, `ResumeBanner` component; add `showResume` lazy state in `OnboardingPage`; render banner above `<OnboardingStepper>` |
| `src/app/src/components/Layout.tsx` | Add "Setup guide" `Link` in the existing sidebar footer `<div>`, above "Public stats" |

---

## Task 1: Overview Page Onboarding Banner

**Files:**
- Modify: `src/app/src/pages/OverviewPage.tsx`

### Context you must read before starting

Current top of the file (lines 1–15):

```ts
import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Link } from 'wouter'
import { useAnalytics } from '../hooks/useAnalytics'
import { useSocket } from '../hooks/useSocket'
import { InsightsCard } from '../components/InsightsCard'

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

export function OverviewPage() {
  const { isConnected } = useAccount()
  const { data, isLoading } = useAnalytics()
  const { onPaymentCharged } = useSocket()
```

Current JSX KPI grid opening (find this in the return):

```tsx
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
```

Key facts:
- `Link` is already imported from wouter — do not add a duplicate import.
- `useState` and `useEffect` are already imported — do not add duplicates.
- `data` from `useAnalytics()` has type `AnalyticsData | undefined`. `data?.plans` is `PlanMetrics[] | undefined`. `data?.plans.length ?? -1` evaluates to `-1` when data is undefined, so the banner is suppressed when the query hasn't resolved or failed. `-1 === 0` is false, so no flash on error states.
- `address` from `useAccount()` has type `` `0x${string}` | undefined ``. The dismiss logic calls `address.toLowerCase()` only inside guards where `address` is defined.

### Steps

- [ ] **Step 1: Add `ONBOARDING_DISMISSED_KEY` constant and `OnboardingBanner` component**

Find this line in the file:
```ts
const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
```

Insert the following immediately after it (before `export function OverviewPage()`):

```ts
const ONBOARDING_DISMISSED_KEY = 'cyclo_onboarding_dismissed'

interface OnboardingBannerProps {
    onDismiss: () => void
}

function OnboardingBanner({ onDismiss }: OnboardingBannerProps): JSX.Element {
    return (
        <div className="flex items-center gap-3 px-5 py-3 bg-indigo-50 border border-indigo-200 rounded-xl text-sm">
            <span className="text-indigo-500">★</span>
            <p className="flex-1 text-gray-700">
                Welcome to Cyclo. Set up your first plan in 90 seconds.
            </p>
            <Link href="/onboarding">
                <a className="text-indigo-600 font-medium hover:underline whitespace-nowrap">
                    Get started →
                </a>
            </Link>
            <button
                onClick={onDismiss}
                className="text-gray-400 hover:text-gray-600 text-base leading-none"
                aria-label="Dismiss banner"
            >
                ×
            </button>
        </div>
    )
}
```

- [ ] **Step 2: Update `useAccount` destructure and add dismissed state**

Find the opening of `OverviewPage` (the exact block):
```ts
export function OverviewPage() {
  const { isConnected } = useAccount()
  const { data, isLoading } = useAnalytics()
  const { onPaymentCharged } = useSocket()
```

Replace with:
```ts
export function OverviewPage() {
  const { isConnected, address } = useAccount()
  const { data, isLoading } = useAnalytics()
  const { onPaymentCharged } = useSocket()

  const [dismissed, setDismissed] = useState(false)

  // Re-check dismissal when the wallet address resolves or changes.
  // localStorage is synchronous but address can arrive after mount.
  useEffect(() => {
    if (!address) return
    if (localStorage.getItem(ONBOARDING_DISMISSED_KEY) === address.toLowerCase()) {
      setDismissed(true)
    }
  }, [address])

  function handleDismiss(): void {
    if (!address) return
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, address.toLowerCase())
    setDismissed(true)
  }
```

- [ ] **Step 3: Render the banner in JSX**

Find the KPI comment inside the JSX return:
```tsx
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
```

Insert immediately before it:
```tsx
      {/* Onboarding entry banner — shown only to new merchants with zero plans */}
      {isConnected && !isLoading && (data?.plans.length ?? -1) === 0 && !dismissed && (
        <OnboardingBanner onDismiss={handleDismiss} />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/HideOut/Documents/Cyclo/src/app && npx tsc --noEmit 2>&1 | grep "error TS"
```

Expected: no output (0 errors). Common issues:
- `address.toLowerCase()` type error → confirm `address` is destructured from `useAccount()`, not a local variable
- `JSX.Element` unknown → `tsconfig.json` already has `"jsx": "react-jsx"`, this is a Vite project default; no fix needed

- [ ] **Step 5: Commit**

```bash
cd /Users/HideOut/Documents/Cyclo && git add src/app/src/pages/OverviewPage.tsx && git commit -m "feat(demo): add onboarding entry banner to Overview page

- Renders when connected merchant has zero plans (reads from useAnalytics)
- !isLoading guard prevents flash on merchants who already have plans
- Dismissal stored per-wallet under 'cyclo_onboarding_dismissed'
- Comparing stored address to current address makes dismissal wallet-specific"
```

---

## Task 2: Onboarding Resume Banner

**Files:**
- Modify: `src/app/src/pages/OnboardingPage.tsx`

### Context you must read before starting

Module-level constants already defined (lines 30–31):
```ts
const STORAGE_KEY = 'cyclo_onboarding_step'
const PLAN_ID_KEY = 'cyclo_onboarding_planId'
```

`ResumeBanner` must be defined before the `// ── Page` comment (around line 404) — same pattern as the other step content components in this file.

`goToStep` is defined inside `OnboardingPage` (around line 484). `ResumeBanner` cannot call it directly — it receives it via the `onResume` prop.

The `// ── Page` marker line (exactly as it appears):
```ts
// ── Page ──────────────────────────────────────────────────────────────────────
```

The state block inside `OnboardingPage` (lines 413–415):
```ts
    const [currentStep, setCurrentStep]   = useState<number>(readPersistedStep)
    const [flashingStep, setFlashingStep] = useState<number | null>(null)
    const [planId, setPlanId]             = useState<bigint | null>(readPersistedPlanId)
```

The stepper block in the JSX return (lines 535–541):
```tsx
                {/* Stepper */}
                <OnboardingStepper
                    steps={ONBOARDING_STEPS}
                    currentStep={currentStep}
                    onStepClick={goToStep}
                    flashingStep={flashingStep}
                />
```

### Steps

- [ ] **Step 1: Add `ResumeBanner` component before the `// ── Page` comment**

Find the exact line:
```ts
// ── Page ──────────────────────────────────────────────────────────────────────
```

Insert immediately before it:
```ts
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
            <p className="flex-1 text-gray-700">
                You're almost done.{' '}
                <button
                    onClick={onResume}
                    className="text-green-700 font-medium hover:underline"
                >
                    Resume where you left off →
                </button>
            </p>
        </div>
    )
}

```

- [ ] **Step 2: Add `showResume` lazy state in `OnboardingPage`**

Find:
```ts
    const [currentStep, setCurrentStep]   = useState<number>(readPersistedStep)
    const [flashingStep, setFlashingStep] = useState<number | null>(null)
    const [planId, setPlanId]             = useState<bigint | null>(readPersistedPlanId)
```

Replace with:
```ts
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
```

- [ ] **Step 3: Render the banner above the stepper**

Find:
```tsx
                {/* Stepper */}
                <OnboardingStepper
                    steps={ONBOARDING_STEPS}
                    currentStep={currentStep}
                    onStepClick={goToStep}
                    flashingStep={flashingStep}
                />
```

Replace with:
```tsx
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
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/HideOut/Documents/Cyclo/src/app && npx tsc --noEmit 2>&1 | grep "error TS"
```

Expected: no output. If you see an error about `goToStep` not being defined inside the arrow function: confirm `showResume` state and the banner render are both inside `OnboardingPage` (after `goToStep` is defined), not in a nested component.

- [ ] **Step 5: Commit**

```bash
cd /Users/HideOut/Documents/Cyclo && git add src/app/src/pages/OnboardingPage.tsx && git commit -m "feat(demo): add resume banner to onboarding wizard

- Shown when both cyclo_onboarding_step and cyclo_onboarding_planId
  are in localStorage (user completed plan creation but didn't finish)
- Clicking resume calls goToStep(3) to jump to the share-link step
- Evaluated once on mount via lazy useState initialiser (no flicker)"
```

---

## Task 3: Sidebar "Setup Guide" Link

**Files:**
- Modify: `src/app/src/components/Layout.tsx`

### Context you must read before starting

`Link` is already imported from wouter at line 1:
```ts
import { Link, useRoute } from 'wouter'
```

Current sidebar footer section (lines 100–109):
```tsx
        {/* Public stats link */}
        <div className="px-2 pb-2">
          <a
            href="/stats"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <span className="text-base w-5 text-center">⊞</span>
            Public stats
          </a>
        </div>
```

### Steps

- [ ] **Step 1: Add "Setup guide" link above "Public stats"**

Find the exact block:
```tsx
        {/* Public stats link */}
        <div className="px-2 pb-2">
          <a
            href="/stats"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <span className="text-base w-5 text-center">⊞</span>
            Public stats
          </a>
        </div>
```

Replace with:
```tsx
        {/* Footer links */}
        <div className="px-2 pb-2">
          <Link href="/onboarding">
            <a className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors">
              <span className="text-base w-5 text-center">✎</span>
              Setup guide
            </a>
          </Link>
          <a
            href="/stats"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <span className="text-base w-5 text-center">⊞</span>
            Public stats
          </a>
        </div>
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/HideOut/Documents/Cyclo/src/app && npx tsc --noEmit 2>&1 | grep "error TS"
```

Expected: no output.

- [ ] **Step 3: Foundry tests**

```bash
cd /Users/HideOut/Documents/Cyclo && forge test 2>&1 | tail -3
```

Expected: `42 tests passed, 0 failed, 0 skipped`.

- [ ] **Step 4: Commit**

```bash
cd /Users/HideOut/Documents/Cyclo && git add src/app/src/components/Layout.tsx && git commit -m "feat(demo): add Setup guide link to sidebar footer"
```

---

## Self-Review Against Spec

| Spec requirement | Covered by |
|---|---|
| Banner on Overview if connected merchant has zero plans | Task 1 — `isConnected && !isLoading && (data?.plans.length ?? -1) === 0` |
| Banner suppressed while analytics loading | Task 1 — `!isLoading` guard |
| "Welcome to Cyclo. Set up your first plan in 90 seconds. → Get started" | Task 1 — exact strings in `OnboardingBanner` JSX |
| "Get started" links to /onboarding | Task 1 — `Link href="/onboarding"` |
| Dismiss button stores dismissal in localStorage under `cyclo_onboarding_dismissed` | Task 1 — `localStorage.setItem(ONBOARDING_DISMISSED_KEY, ...)` |
| Once dismissed, never show again for that wallet | Task 1 — stores `address.toLowerCase()` as value; `useEffect` restores `dismissed=true` on next load |
| Resume banner on /onboarding when both localStorage keys set | Task 2 — lazy `useState` reads both `STORAGE_KEY` and `PLAN_ID_KEY` |
| "You're almost done. Resume where you left off →" exact text | Task 2 — exact strings in `ResumeBanner` JSX |
| Resume CTA jumps to Step 4 | Task 2 — `onResume={() => goToStep(3)}` |
| No dismiss on resume banner | Task 2 — no dismiss button in `ResumeBanner` |
| "Setup guide" in sidebar footer | Task 3 — new `Link` in `px-2 pb-2` div |
| Setup guide always visible | Task 3 — no condition |
| Setup guide links to /onboarding | Task 3 — `href="/onboarding"` |
| 0 TypeScript errors | Tasks 1, 2, 3 — each includes TS check step |
| No unused imports | ✅ `Link` and `useState`/`useEffect` already imported in both page files |
| No inline styles | ✅ Tailwind only throughout |
| Foundry tests unaffected | Task 3 Step 3 — all 42 pass confirmed |
