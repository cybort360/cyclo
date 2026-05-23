# Onboarding Step 2 — Fund Wallet Design

**Date:** 2026-05-23  
**Scope:** Step 2 content for `/onboarding`. Shows faucet link and live USDC balance. Manual "I'm funded, continue" button advances to Step 3 when balance > 0.

---

## Overview

Add interactive content to Step 2 of the onboarding wizard. When the user reaches step index 1 (the "Get Testnet USDC" step), they see a card with a prominent faucet link, their live USDC balance (refreshing every 5 seconds), and a continue button that enables once their balance exceeds zero.

---

## Files

| File | Change |
|---|---|
| `src/app/src/pages/OnboardingPage.tsx` | Add `ARC_FAUCET_URL` constant, `FundWalletStepContent` component, render it when `currentStep === 1` |
| `src/app/.env.example` | Add `VITE_ARC_FAUCET_URL=` |

No new files. No new dependencies.

---

## New constant

```ts
const ARC_FAUCET_URL = import.meta.env.VITE_ARC_FAUCET_URL ?? 'https://faucet.circle.com/'
```

Defined at module level in `OnboardingPage.tsx`, near the other constants. Falls back to the Circle testnet faucet if the env var is not set.

---

## `FundWalletStepContent` component

### Props interface

```ts
interface FundWalletStepContentProps {
    address:   `0x${string}`
    onAdvance: () => void
}
```

`address` — the connected wallet address, used as the `balanceOf` argument.  
`onAdvance` — called when the user clicks "I'm funded, continue" with a positive balance.

### USDC balance fetch

```ts
const { data: usdcBalance } = useReadContract({
    address:      USDC_ADDRESS as `0x${string}`,
    abi:          USDC_ABI,
    functionName: 'balanceOf',
    args:         [address],
    query:        { refetchInterval: 5_000 },
})
```

Uses the existing `USDC_ADDRESS` constant (from `src/app/src/constants/addresses.ts`) and `USDC_ABI` (from `src/app/src/constants/abis.ts`). The `refetchInterval: 5_000` re-polls every 5 seconds while the component is mounted.

### Balance display

```ts
const balanceDisplay = usdcBalance !== undefined
    ? `${fromUsdcUnits(usdcBalance)} USDC`
    : '—'
```

Uses the existing `fromUsdcUnits` helper from `src/app/src/utils/formatting.ts`.

### Continue button gate

```ts
const canContinue = usdcBalance !== undefined && usdcBalance > 0n
```

### Card layout

```
┌──────────────────────────────────┐
│  Fund your wallet with testnet   │  text-lg font-semibold text-gray-900
│  USDC                            │
│  You need testnet USDC to pay    │  text-sm text-gray-500 mt-1
│  gas fees and test subscriptions │
│  on Arc.                         │
│                                  │
│  [Open Arc Faucet ↗]             │  indigo button, opens new tab
│                                  │
│  Balance: X.XXXXXX USDC          │  text-sm text-gray-600
│                                  │
│  [I'm funded, continue]          │  indigo button, disabled when balance ≤ 0
└──────────────────────────────────┘
```

Card classes: `bg-white border border-gray-200 rounded-xl p-6 space-y-4` — matches `ConnectWalletStepContent` and the card style used throughout the app.

### "Open Arc Faucet" element

An `<a>` tag styled as a button (not a `<button>`), since it navigates to an external URL:

```tsx
<a
    href={ARC_FAUCET_URL}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-block px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
>
    Open Arc Faucet ↗
</a>
```

### "I'm funded, continue" button

```tsx
<button
    onClick={onAdvance}
    disabled={!canContinue}
    className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
>
    I'm funded, continue
</button>
```

---

## Wiring in `OnboardingPage`

`address` is already destructured from `useAccount()`. `goToStep(2)` already handles persistence and the wallet-connection gate.

```tsx
{currentStep === 1 && address && (
    <FundWalletStepContent
        address={address}
        onAdvance={() => goToStep(2)}
    />
)}
```

The `address &&` guard is defensive — step 1 is only reachable after the wallet-connection gate in step 0, so `address` will always be defined here, but the guard keeps TypeScript satisfied without a non-null assertion.

---

## New imports required in `OnboardingPage.tsx`

```ts
import { useReadContract } from 'wagmi'
import { USDC_ABI }        from '../constants/abis'
import { USDC_ADDRESS }    from '../constants/addresses'
import { fromUsdcUnits }   from '../utils/formatting'
```

---

## `src/app/.env.example` addition

```
VITE_ARC_FAUCET_URL=
```

Added to the frontend section of the file. Not added to the root `.env.example` (which holds server-side Node variables only).

---

## Spec non-goals

- No automatic advance when balance crosses zero — the user explicitly clicks "I'm funded, continue"
- No content for steps 3 or 4 (added in future tasks)
- No change to the stepper component or nav row logic
- No change to the localStorage persistence or wallet-reset logic

---

## Definition of Done

- [ ] `FundWalletStepContent` renders when `currentStep === 1` and wallet is connected
- [ ] Heading is exactly "Fund your wallet with testnet USDC"
- [ ] Subtext is exactly "You need testnet USDC to pay gas fees and test subscriptions on Arc."
- [ ] "Open Arc Faucet ↗" opens `VITE_ARC_FAUCET_URL` (or `https://faucet.circle.com/` fallback) in a new tab
- [ ] Balance displays as `"X.XXXXXX USDC"` (using `fromUsdcUnits`) or `"—"` while loading
- [ ] Balance refreshes every 5 seconds via `refetchInterval: 5_000`
- [ ] "I'm funded, continue" is disabled when balance is `undefined` or `0n`
- [ ] "I'm funded, continue" calls `goToStep(2)` (advances to step index 2) when clicked with balance > 0
- [ ] `VITE_ARC_FAUCET_URL=` present in `src/app/.env.example`
- [ ] `ARC_FAUCET_URL` module-level constant reads from env with `https://faucet.circle.com/` fallback
- [ ] No console.log, no unused imports, no inline styles in new JSX
