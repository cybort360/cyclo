# Onboarding Step 2 — Fund Wallet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the "Get Testnet USDC" step content to the onboarding wizard: a faucet link, live USDC balance polling, and a gated continue button.

**Architecture:** One new internal component `FundWalletStepContent` added to `OnboardingPage.tsx`, receiving `address` and `onAdvance` props. It fetches USDC balance via wagmi's `useReadContract` with a 5-second refetch interval and enables the continue button once balance exceeds zero. The faucet URL is read from `VITE_ARC_FAUCET_URL` with a hardcoded fallback.

**Tech Stack:** React 19, TypeScript (strict), wagmi v2 (`useReadContract`), Tailwind CSS v4, Vite env vars (`import.meta.env`).

---

## File Map

| File | Change |
|---|---|
| `src/app/src/pages/OnboardingPage.tsx` | Add imports, `ARC_FAUCET_URL` constant, `FundWalletStepContentProps` interface, `FundWalletStepContent` component, and render condition |
| `src/app/.env.example` | Add `VITE_ARC_FAUCET_URL=` |

---

## Context you must read before starting

Read these files so you understand the existing patterns. Do not modify them unless a task explicitly says to.

**`src/app/src/pages/OnboardingPage.tsx`** — this is the file you will modify. Key things to know:
- `OnboardingPage` destructures `{ address, isConnected }` from `useAccount()`
- `goToStep(step)` persists and sets `currentStep` — you will call this via the `onAdvance` prop
- `ConnectWalletStepContent` (around line 85) is a parallel component you are modelling your new component after
- The render block around line 213 shows where step content is conditionally rendered

**`src/app/src/constants/abis.ts`** — `USDC_ABI` is already exported; it includes `balanceOf`.

**`src/app/src/constants/addresses.ts`** — `USDC_ADDRESS` is already exported as `import.meta.env.VITE_USDC_ADDRESS as string ?? ''`.

**`src/app/src/utils/formatting.ts`** — `fromUsdcUnits(rawAmount: bigint): number` converts 6-decimal USDC units to a JS number.

**`src/app/.env.example`** currently contains:
```
VITE_ARC_RPC_URL=
VITE_CONTRACT_ADDRESS=
VITE_USDC_ADDRESS=
VITE_DEPLOY_BLOCK=
VITE_API_URL=http://localhost:3001
```

---

## Baseline error count

Before making any changes, run:

```bash
cd src/app && npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```

Note the number. Your changes must not increase it.

---

## Task 1: Add `VITE_ARC_FAUCET_URL` to `src/app/.env.example`

**Files:**
- Modify: `src/app/.env.example`

This is a one-line change. No code logic involved.

- [ ] **Step 1: Add the env var**

Open `src/app/.env.example` and append this line at the end:

```
VITE_ARC_FAUCET_URL=
```

Final file content:
```
VITE_ARC_RPC_URL=
VITE_CONTRACT_ADDRESS=
VITE_USDC_ADDRESS=
VITE_DEPLOY_BLOCK=
VITE_API_URL=http://localhost:3001
VITE_ARC_FAUCET_URL=
```

- [ ] **Step 2: Commit**

```bash
git add src/app/.env.example
git commit -m "chore(config): add VITE_ARC_FAUCET_URL to app env example"
```

---

## Task 2: Implement `FundWalletStepContent` and wire it into `OnboardingPage`

**Files:**
- Modify: `src/app/src/pages/OnboardingPage.tsx`

This task adds all the React logic for step 2. There is no separate test framework for the React frontend — verification is manual (see the verification checklist at the end of this task).

### Step-by-step

- [ ] **Step 1: Add new imports at the top of `OnboardingPage.tsx`**

Locate the existing import block:
```ts
import { useState, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
```

Replace with:
```ts
import { useState, useEffect, useRef } from 'react'
import { useAccount, useReadContract } from 'wagmi'
```

Then add these three new imports directly below the existing import block (after the `ConnectButton` import):
```ts
import { USDC_ABI }      from '../constants/abis'
import { USDC_ADDRESS }  from '../constants/addresses'
import { fromUsdcUnits } from '../utils/formatting'
```

Full import block after the change:
```ts
import { useState, useEffect, useRef } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { Link } from 'wouter'
import { OnboardingStepper } from '../components/OnboardingStepper'
import type { OnboardingStep } from '../components/OnboardingStepper'
import { ConnectButton } from '../components/WalletStatus'
import { USDC_ABI }      from '../constants/abis'
import { USDC_ADDRESS }  from '../constants/addresses'
import { fromUsdcUnits } from '../utils/formatting'
```

- [ ] **Step 2: Verify TypeScript compiles after imports**

```bash
cd src/app && npx tsc --noEmit 2>&1 | grep "error TS"
```

Expected: same error count as baseline (no new errors).

- [ ] **Step 3: Add `ARC_FAUCET_URL` constant in the Constants section**

In `OnboardingPage.tsx`, find the `// ── Constants ─────────` section. It currently ends after:
```ts
const STEP_COUNT = ONBOARDING_STEPS.length
```

Add the faucet URL constant immediately after `STEP_COUNT`:
```ts
const ARC_FAUCET_URL: string = import.meta.env.VITE_ARC_FAUCET_URL ?? 'https://faucet.circle.com/'
```

- [ ] **Step 4: Add `FundWalletStepContentProps` interface and `FundWalletStepContent` component**

In `OnboardingPage.tsx`, find the `// ── Step content ─────────` section. It currently contains only `ConnectWalletStepContent`. Add the following directly after `ConnectWalletStepContent`'s closing brace, before the `// ── Page ─────────` section:

```ts
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
        ? `${fromUsdcUnits(usdcBalance)} USDC`
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
```

- [ ] **Step 5: Render `FundWalletStepContent` inside `OnboardingPage`**

In the JSX return of `OnboardingPage`, find the existing step content block:
```tsx
                {/* Step 1 content — wallet connect card */}
                {currentStep === 0 && <ConnectWalletStepContent />}
```

Add the step 2 content immediately after it:
```tsx
                {/* Step 1 content — wallet connect card */}
                {currentStep === 0 && <ConnectWalletStepContent />}

                {/* Step 2 content — fund wallet card */}
                {currentStep === 1 && address && (
                    <FundWalletStepContent
                        address={address}
                        onAdvance={() => goToStep(2)}
                    />
                )}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd src/app && npx tsc --noEmit 2>&1 | grep "error TS"
```

Expected: same error count as baseline. If you see new errors referencing `FundWalletStepContent`, `useReadContract`, `USDC_ABI`, `USDC_ADDRESS`, or `fromUsdcUnits`, you missed an import in Step 1.

- [ ] **Step 7: Verify Foundry tests still pass**

```bash
forge test
```

Expected: `42 tests passed, 0 failed`.

- [ ] **Step 8: Manual verification checklist**

Start the dev server:
```bash
cd src/app && npm run dev
```

Navigate to `http://localhost:5173/onboarding`.

- [ ] Not connected → step 0 wallet connect card shows. Connect wallet → auto-advances to step 1.
- [ ] Step 1 shows heading "Fund your wallet with testnet USDC" and correct subtext.
- [ ] "Open Arc Faucet ↗" link opens `https://faucet.circle.com/` in a new tab (assuming `VITE_ARC_FAUCET_URL` is not set in `.env`).
- [ ] Balance row shows "Balance: —" immediately, then resolves to a USDC amount after a moment.
- [ ] "I'm funded, continue" is disabled (greyed out, not clickable) when balance is 0.
- [ ] After funding from the faucet, balance updates within 5 seconds and the button becomes enabled.
- [ ] Clicking "I'm funded, continue" with balance > 0 advances to step 2 (stepper shows "Create Your First Plan" as active).
- [ ] Refreshing the page with `currentStep` persisted as 1 shows step 2 content (not step 1).
- [ ] Back button on step 2 returns to step 1; step 2 content appears again.

- [ ] **Step 9: Commit**

```bash
git add src/app/src/pages/OnboardingPage.tsx
git commit -m "feat(demo): add fund-wallet step content to onboarding wizard

- FundWalletStepContent renders on step index 1
- useReadContract polls USDC balance every 5s via balanceOf
- Continue button gates on usdcBalance > 0n
- Faucet link reads VITE_ARC_FAUCET_URL, falls back to faucet.circle.com"
```

---

## Self-review against spec

**Spec coverage:**

| Spec requirement | Covered by |
|---|---|
| Heading "Fund your wallet with testnet USDC" | Task 2 Step 4 — exact string in JSX |
| Subtext exact text | Task 2 Step 4 — exact string in JSX |
| "Open Arc Faucet" opens in new tab | Task 2 Step 4 — `target="_blank" rel="noopener noreferrer"` |
| `VITE_ARC_FAUCET_URL` with `https://faucet.circle.com/` fallback | Task 2 Step 3 — `ARC_FAUCET_URL` constant |
| `VITE_ARC_FAUCET_URL=` in `src/app/.env.example` | Task 1 Step 1 |
| Balance display using `fromUsdcUnits`, shows "—" while loading | Task 2 Step 4 — `balanceDisplay` derived value |
| Balance refreshes every 5 seconds | Task 2 Step 4 — `refetchInterval: 5_000` |
| Continue button disabled when balance ≤ 0 | Task 2 Step 4 — `canContinue` guard |
| Advance to step 3 on continue | Task 2 Step 5 — `onAdvance={() => goToStep(2)}` |
| No new files | ✓ only existing files modified |
| No new dependencies | ✓ wagmi and existing constants already in project |
| No inline styles in new JSX | Task 2 Step 4 — only Tailwind classes used |
