# Onboarding Page Design

**Date:** 2026-05-23  
**Scope:** `/onboarding` route — stepper shell and navigation state only. Step content is deferred.

---

## Overview

A focused setup wizard at `/onboarding` that guides new merchants through four steps: connecting a wallet, funding with testnet USDC, creating a plan, and sharing their checkout link. The page is public but wallet connection gates progression past step 1. The current step persists across refreshes via localStorage and resets if the wallet address changes.

---

## Files

| File | Change |
|---|---|
| `src/app/src/pages/OnboardingPage.tsx` | **New** — page shell: layout, state management, nav controls |
| `src/app/src/components/OnboardingStepper.tsx` | **New** — stateless stepper UI component |
| `src/app/src/App.tsx` | **Modify** — add `/onboarding` as a full-page route (no Layout) |

---

## Routing

`/onboarding` is added to `App.tsx` as a full-page route, alongside `/portal`, `/stats`, `/demo`, and `/docs` — placed **before** the catch-all Layout block:

```tsx
<Route path="/onboarding" component={OnboardingPage} />
```

No authentication redirect. The route is public.

---

## State management

### Owned by `OnboardingPage`

```ts
currentStep: number  // 0-indexed, range [0, 3]
```

### localStorage

- **Key:** `cyclo_onboarding_step`
- **Value:** stringified integer, e.g. `"2"`
- **On mount:** read value → `parseInt` → clamp to `[0, 3]` → use as initial state. If missing or unparseable, default to `0`.
- **On every step change:** write new index immediately with `localStorage.setItem`.

### Wallet address reset

- Uses `useAccount()` from wagmi to read `address` and `isConnected`.
- A `useEffect` watches `address`. When `address` transitions to a new non-null value (i.e. a different wallet connects), reset `currentStep` to `0` and call `localStorage.removeItem('cyclo_onboarding_step')`.
- Track the "last seen address" in a `useRef` to distinguish a wallet change from the initial mount.

### Wallet disconnect

- If `isConnected` becomes `false` while `currentStep > 0`, reset to step `0` and clear localStorage. Handled in the same effect or a dedicated effect on `isConnected`.

### Wallet gate

- Advancing past step 0 (i.e. `currentStep === 0` → `1`) requires `isConnected === true`.
- The **Next** button is disabled when `!isConnected && currentStep === 0`.
- Steps 1–3 inherently require connection because the reset-on-disconnect rule would already have returned the user to step 0.

---

## Steps definition

Static constant in `OnboardingPage.tsx`:

```ts
const ONBOARDING_STEPS = [
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
```

---

## `OnboardingStepper` component

### Props

```ts
interface OnboardingStepperProps {
  steps:       { title: string; description: string }[]
  currentStep: number
  onStepClick: (index: number) => void
}
```

### Step states

| Condition | Circle style | Title style | Clickable |
|---|---|---|---|
| `index < currentStep` | Indigo filled (`bg-indigo-600`), white `✓` checkmark | `text-gray-900` | Yes — calls `onStepClick(index)` |
| `index === currentStep` | Indigo filled (`bg-indigo-600`), white step number | `text-indigo-700 font-semibold` | No |
| `index > currentStep` | Gray outlined (`border-2 border-gray-300`), gray step number | `text-gray-400` | No |

### Layout

- Vertical stepper — steps listed top to bottom.
- Each step: circle indicator left-aligned, title + description to the right.
- Connector line between steps: a vertical bar below each circle (except the last). Indigo (`bg-indigo-600`) if the lower step is reached; gray (`bg-gray-200`) otherwise.
- Step descriptions: `text-sm text-gray-500` beneath the title.
- Component is purely presentational — no internal state.

---

## `OnboardingPage` layout

Full-screen, vertically and horizontally centered. No sidebar. No top bar.

```
min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 py-12
```

Top to bottom:

1. **Logo mark** — `w-7 h-7 bg-indigo-600 rounded-lg` + "Cyclo" wordmark (same pattern as `PortalPage`)
2. **Page heading** — `"Get started"` (`text-2xl font-bold text-gray-900`)  
   **Subtitle** — `"Follow the steps below to set up your first subscription plan."` (`text-sm text-gray-500`)
3. **`OnboardingStepper`** — 4 steps, max-width `max-w-sm`
4. **Navigation controls** — Back + Next buttons
5. **Skip link** — `"Skip setup →"` (wouter `<Link href="/">`)

### Navigation controls

```
[← Back]   [Next →]
```

- **Back:** `disabled` when `currentStep === 0`. On click: decrement step, persist.
- **Next:** `disabled` when `currentStep === 3`. `disabled` when `currentStep === 0 && !isConnected` (wallet gate). On click: increment step, persist.
- Styling follows existing project pattern: Next uses `bg-indigo-600 text-white`, Back uses `border border-gray-200 text-gray-600`. Both `rounded-lg px-5 py-2.5 text-sm font-semibold`.

---

## What is NOT in scope

- Step content (forms, wallet connect UI, faucet links, plan creation, share link copy)
- Any visual feedback inside a step panel
- Progress percentage or completion tracking beyond the step index
- Route guards or redirects based on step completion

---

## Definition of Done

- [ ] `/onboarding` route renders without sidebar or top bar
- [ ] Stepper shows 4 steps with correct visual state (completed/active/future)
- [ ] Completed steps are clickable and jump back correctly
- [ ] Step 0 Next is disabled when wallet is not connected
- [ ] Current step persists to `cyclo_onboarding_step` in localStorage
- [ ] Refreshing the page resumes at the persisted step
- [ ] Connecting a different wallet resets to step 0
- [ ] Disconnecting the wallet resets to step 0
- [ ] Back is disabled on step 0, Next is disabled on step 3
- [ ] No sidebar, no Layout component, no console.log in production paths
