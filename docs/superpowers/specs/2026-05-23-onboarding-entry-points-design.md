# Onboarding Entry Points Design

**Date:** 2026-05-23
**Scope:** Three entry points that surface the onboarding wizard throughout the merchant dashboard.

---

## Overview

Three small, isolated additions guide new merchants toward `/onboarding`:

1. **Overview page banner** — shown when a connected merchant has zero plans; dismissible per-wallet via localStorage.
2. **Onboarding resume banner** — shown at the top of `/onboarding` when localStorage contains both onboarding keys, signalling incomplete progress.
3. **Sidebar "Setup guide" link** — always-visible footer link in the merchant dashboard sidebar.

No new files are created. No new npm dependencies are needed.

---

## Files

| File | Change |
|---|---|
| `src/app/src/pages/OverviewPage.tsx` | Add `OnboardingBanner` component + render it after the page header |
| `src/app/src/pages/OnboardingPage.tsx` | Add `ResumeBanner` component + render it above the stepper |
| `src/app/src/components/Layout.tsx` | Add "Setup guide" link in sidebar footer |

---

## Part 1 — Overview Page Banner (`OverviewPage.tsx`)

### Show condition

```
isConnected && !isLoading && (data?.plans.length ?? -1) === 0 && !dismissed
```

- `isConnected` — do not show to disconnected users.
- `!isLoading` — suppress during the initial analytics fetch to prevent a flash of the banner for merchants who already have plans.
- `data?.plans.length === 0` — merchant has no plans on-chain. `data` comes from the existing `useAnalytics()` call already in `OverviewPage`; `useAnalytics` reads `PlanCreated` events from the contract filtered by the connected address. No new hook or contract call required.
- `!dismissed` — user has not dismissed the banner for the current wallet.

### Dismissal logic

`dismissed` state is initialised lazily:

```ts
const ONBOARDING_DISMISSED_KEY = 'cyclo_onboarding_dismissed'

const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(ONBOARDING_DISMISSED_KEY) === address?.toLowerCase()
)
```

Comparing the stored value to `address?.toLowerCase()` makes dismissal per-wallet. If a different wallet connects, the stored address will not match and the banner reappears.

Dismiss handler:

```ts
function handleDismiss(): void {
    if (!address) return
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, address.toLowerCase())
    setDismissed(true)
}
```

### Component interface

```ts
interface OnboardingBannerProps {
    address:   `0x${string}` | undefined
    onDismiss: () => void
}
```

`OnboardingBanner` is a pure presentational component; the parent (`OverviewPage`) owns state and the dismiss handler.

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ★  Welcome to Cyclo. Set up your first plan in 90 seconds.  Get started →  [×] │
└─────────────────────────────────────────────────────────────────────────┘
```

- Container: `flex items-center gap-3 px-5 py-3 bg-indigo-50 border border-indigo-200 rounded-xl text-sm`
- Star icon: `text-indigo-500` span
- Body text: `flex-1 text-gray-700` — "Welcome to Cyclo. Set up your first plan in 90 seconds."
- CTA: `Link href="/onboarding"` — "Get started →" in `text-indigo-600 font-medium hover:underline`
- Dismiss: `<button onClick={onDismiss}>` — `×` character, `text-gray-400 hover:text-gray-600`

Rendered immediately after the page header `<div>` and before the KPI grid.

---

## Part 2 — Onboarding Resume Banner (`OnboardingPage.tsx`)

### Show condition

Both `STORAGE_KEY` (`'cyclo_onboarding_step'`) and `PLAN_ID_KEY` (`'cyclo_onboarding_planId'`) are present in localStorage, evaluated once on mount via a lazy `useState` initialiser.

```ts
const [showResume] = useState(
    () =>
        localStorage.getItem(STORAGE_KEY)  !== null &&
        localStorage.getItem(PLAN_ID_KEY) !== null
)
```

A lazy initialiser (not `useEffect`) avoids a one-frame flash of the banner appearing after render.

### CTA behaviour

Clicking "Resume where you left off →" calls `goToStep(3)`. The banner receives this as an `onResume` prop so it remains a pure component without access to page-level state.

No dismiss button. The banner disappears naturally on the next visit after the user clicks "Go to Dashboard" (which calls `clearPersistedStep()` and `clearPersistedPlanId()`, removing both keys). Since `showResume` is derived once on mount, it persists for the lifetime of the current page load — closing the onboarding flow clears the keys, so the banner will not show on the next visit.

### Component interface

```ts
interface ResumeBannerProps {
    onResume: () => void
}
```

### Layout

```
┌──────────────────────────────────────────────────────┐
│ ✓  You're almost done. Resume where you left off →   │
└──────────────────────────────────────────────────────┘
[OnboardingStepper]
[step content]
```

- Container: `flex items-center gap-3 px-5 py-3 bg-green-50 border border-green-200 rounded-xl text-sm mb-6`
- Check icon: `text-green-500` span
- Text + CTA combined: `"You're almost done. "` followed by `<button onClick={onResume}>` — `"Resume where you left off →"` in `text-green-700 font-medium hover:underline`

Rendered at the top of the OnboardingPage JSX return, above the `OnboardingStepper`.

---

## Part 3 — Sidebar "Setup guide" Link (`Layout.tsx`)

A single `Link` added to the existing sidebar footer `<div className="px-2 pb-2">`, above the "Public stats" link, using identical Tailwind classes.

```tsx
<Link href="/onboarding">
  <a className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors">
    <span className="text-base w-5 text-center">✎</span>
    Setup guide
  </a>
</Link>
```

- Icon: `✎` (U+270E, pencil — consistent with the single-Unicode-char convention of the nav array).
- Always visible, no condition.
- `href="/onboarding"` via wouter `Link`.

---

## Non-Goals

- No animation on banner appearance or dismissal.
- No server-side dismissal tracking — localStorage only.
- No banner on any page other than Overview.
- No changes to the onboarding wizard steps themselves.
- No changes to the `/onboarding` routing or wizard logic beyond the resume banner render.

---

## Definition of Done

- [ ] `OnboardingBanner` renders on Overview page only when: connected, data loaded, zero plans, not dismissed for the current wallet address
- [ ] Clicking `×` sets `localStorage['cyclo_onboarding_dismissed']` to `address.toLowerCase()` and hides the banner immediately
- [ ] Revisiting the page with the same wallet does not show the banner again
- [ ] Connecting a different wallet shows the banner again (stored address does not match)
- [ ] "Get started →" navigates to `/onboarding`
- [ ] Banner does not flash during loading (guarded by `!isLoading`)
- [ ] `ResumeBanner` renders at the top of `/onboarding` only when both `cyclo_onboarding_step` and `cyclo_onboarding_planId` are in localStorage
- [ ] Clicking "Resume where you left off →" calls `goToStep(3)`
- [ ] After clicking "Go to Dashboard" (which clears both keys), revisiting `/onboarding` does not show the resume banner
- [ ] "Setup guide" link is always visible in the sidebar footer, pointing to `/onboarding`
- [ ] TypeScript compiles with 0 new errors
- [ ] No `console.log` statements, no inline styles, no unused imports
- [ ] Foundry tests unaffected (frontend-only changes)
