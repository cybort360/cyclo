# Onboarding Step 4 — Share Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the terminal "Share Your Link" step to the onboarding wizard: a read-only subscribe URL with copy and open-in-new-tab controls, a QR code canvas, and a "Go to Dashboard" button that clears localStorage and navigates to /.

**Architecture:** One new internal component `ShareLinkStepContent` added to `OnboardingPage.tsx`, receiving `planId: bigint` as its only prop. It derives the subscribe URL from `APP_BASE_URL || window.location.origin`, generates a QR code onto a canvas ref via `QRCode.toCanvas`, handles copy-to-clipboard with 2-second feedback, and navigates to / via wouter's `useLocation` after clearing both localStorage keys. The nav row condition is tightened to hide on step 3.

**Tech Stack:** React 19, TypeScript strict (0 baseline errors), `qrcode` npm package (`QRCode.toCanvas` API), `@types/qrcode`, wouter v3 (`useLocation`), Tailwind CSS v4, Vite env vars.

---

## File Map

| File | Change |
|---|---|
| `src/app/src/pages/OnboardingPage.tsx` | Update wouter import, add QRCode import, add `APP_BASE_URL` constant, add `ShareLinkStepContentProps` interface, add `ShareLinkStepContent` component, add `currentStep === 3` render block, change nav row condition |
| `src/app/package.json` | Add `qrcode` to dependencies, `@types/qrcode` to devDependencies |
| `src/app/.env.example` | Add `VITE_APP_URL=` |

---

## Context you must read before starting

**`src/app/src/pages/OnboardingPage.tsx`** (499 lines, on branch `feat/onboarding-step2`). Key landmarks:

- **Line 18:** `import { Link } from 'wouter'` — you will add `useLocation` here
- **Line 25:** `import { useCycloClient } from '@cyclo/react'` — add `import QRCode from 'qrcode'` after this
- **Line 29–30:** `STORAGE_KEY` and `PLAN_ID_KEY` — add `APP_BASE_URL` constant after line 53 (`ARC_FAUCET_URL`)
- **Line 306:** closing brace of `CreatePlanStepContent` — add the new component and its interface after this, before the `// ── Page` comment on line 308
- **Lines 460–469:** step 3 render block — add step 4 block directly after
- **Line 472:** `{currentStep > 0 && (` — change to `{currentStep > 0 && currentStep < STEP_COUNT - 1 && (`

**Module-level functions already defined (you can call them from the new component):**
- `clearPersistedStep(): void` — removes `'cyclo_onboarding_step'` from localStorage
- `clearPersistedPlanId(): void` — removes `'cyclo_onboarding_planId'` from localStorage

**`src/app/package.json`** — `qrcode` is not yet present. Install it with:
```bash
cd /Users/HideOut/Documents/Cyclo/src/app && npm install qrcode && npm install --save-dev @types/qrcode
```

---

## Baseline error count

Before making any changes, confirm:
```bash
cd /Users/HideOut/Documents/Cyclo/src/app && npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```
Expected: `0`. Your changes must not increase it.

---

## Task 1: Install package, update env, add imports and constant

**Files:**
- Modify: `src/app/package.json` (via npm install)
- Modify: `src/app/.env.example`
- Modify: `src/app/src/pages/OnboardingPage.tsx`

- [ ] **Step 1: Install qrcode**

```bash
cd /Users/HideOut/Documents/Cyclo/src/app && npm install qrcode && npm install --save-dev @types/qrcode
```

Expected: `qrcode` appears in `dependencies` and `@types/qrcode` in `devDependencies` in `package.json`. Node modules installed without errors.

- [ ] **Step 2: Add VITE_APP_URL to .env.example**

Open `src/app/.env.example`. Current content:
```
VITE_ARC_RPC_URL=
VITE_CONTRACT_ADDRESS=
VITE_USDC_ADDRESS=
VITE_DEPLOY_BLOCK=
VITE_API_URL=http://localhost:3001
VITE_ARC_FAUCET_URL=
```

Add one line at the end:
```
VITE_APP_URL=
```

Final file:
```
VITE_ARC_RPC_URL=
VITE_CONTRACT_ADDRESS=
VITE_USDC_ADDRESS=
VITE_DEPLOY_BLOCK=
VITE_API_URL=http://localhost:3001
VITE_ARC_FAUCET_URL=
VITE_APP_URL=
```

- [ ] **Step 3: Update the wouter import to include useLocation**

In `src/app/src/pages/OnboardingPage.tsx`, find line 18:
```ts
import { Link } from 'wouter'
```
Replace with:
```ts
import { Link, useLocation } from 'wouter'
```

- [ ] **Step 4: Add QRCode import**

Find line 25 (currently the last import line):
```ts
import { useCycloClient } from '@cyclo/react'
```
Add one line directly after it:
```ts
import QRCode from 'qrcode'
```

- [ ] **Step 5: Add APP_BASE_URL constant**

Find this line (currently line 53):
```ts
const ARC_FAUCET_URL: string = import.meta.env.VITE_ARC_FAUCET_URL ?? 'https://faucet.circle.com/'
```
Add one line directly after it:
```ts
const APP_BASE_URL: string = import.meta.env.VITE_APP_URL ?? ''
```

- [ ] **Step 6: TypeScript check**

```bash
cd /Users/HideOut/Documents/Cyclo/src/app && npx tsc --noEmit 2>&1 | grep "error TS"
```
Expected: no output. If you see errors about `QRCode`, verify `@types/qrcode` was installed. If you see errors about `useLocation`, verify the wouter import was updated correctly.

- [ ] **Step 7: Commit**

```bash
cd /Users/HideOut/Documents/Cyclo && git add src/app/src/pages/OnboardingPage.tsx src/app/.env.example src/app/package.json src/app/package-lock.json && git commit -m "chore(demo): install qrcode, add VITE_APP_URL, add imports and constant for onboarding step 4"
```

---

## Task 2: Implement ShareLinkStepContent and wire into OnboardingPage

**Files:**
- Modify: `src/app/src/pages/OnboardingPage.tsx`

There is no separate test framework for the React frontend — verification is manual (see checklist at the end).

- [ ] **Step 1: Add ShareLinkStepContentProps interface and ShareLinkStepContent component**

Find the closing brace of `CreatePlanStepContent` followed by the `// ── Page` comment (currently around line 306–308):
```ts
}

// ── Page ──────────────────────────────────────────────────────────────────────
```

Insert the following between that closing brace and the `// ── Page` comment:

```ts
interface ShareLinkStepContentProps {
    planId: bigint
}

/**
 * Content panel for step 3: displays the merchant's subscribe URL, a QR code,
 * a copy-to-clipboard button, and a "Go to Dashboard" button that clears
 * onboarding localStorage and navigates to the merchant dashboard.
 */
function ShareLinkStepContent({ planId }: ShareLinkStepContentProps): JSX.Element {
    const [, navigate]   = useLocation()
    const [copied, setCopied] = useState(false)
    const qrCanvasRef         = useRef<HTMLCanvasElement>(null)

    const subscribeUrl = `${APP_BASE_URL || window.location.origin}/subscribe/${String(planId)}`

    useEffect(() => {
        if (qrCanvasRef.current === null) return
        QRCode.toCanvas(qrCanvasRef.current, subscribeUrl, { width: 160 })
            .catch(() => {
                // QR generation failed — canvas stays blank, card still renders
            })
    }, [subscribeUrl])

    async function handleCopy(): Promise<void> {
        try {
            await navigator.clipboard.writeText(subscribeUrl)
            setCopied(true)
            setTimeout(() => setCopied(false), 2_000)
        } catch {
            // Clipboard unavailable — degrade silently, do not crash
        }
    }

    function handleDashboard(): void {
        clearPersistedStep()
        clearPersistedPlanId()
        navigate('/')
    }

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-gray-900">Your checkout link is ready</h2>
                <p className="text-sm text-gray-500 mt-1">
                    Share this link with anyone you want to subscribe.
                </p>
            </div>

            <div className="flex gap-2 items-center">
                <input
                    type="text"
                    readOnly
                    value={subscribeUrl}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50 focus:outline-none"
                />
                <a
                    href={subscribeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                    aria-label="Open subscribe link in new tab"
                >
                    ↗
                </a>
            </div>

            <button
                onClick={handleCopy}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
                {copied ? 'Copied! ✓' : 'Copy Link'}
            </button>

            <div className="flex justify-center">
                <canvas ref={qrCanvasRef} width={160} height={160} />
            </div>

            <button
                onClick={handleDashboard}
                className="w-full px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
                Go to Dashboard
            </button>
        </div>
    )
}
```

- [ ] **Step 2: Add step 4 JSX render block**

In the JSX return of `OnboardingPage`, find the step 3 content block (currently around lines 460–469):
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

Add the step 4 block directly after it:
```tsx
                {/* Step 4 content — share link card */}
                {currentStep === 3 && planId !== null && (
                    <ShareLinkStepContent planId={planId} />
                )}
```

- [ ] **Step 3: Narrow the nav row condition to hide on step 3**

Find (currently around line 472):
```tsx
                {/* Navigation — hidden on step 0; connection itself advances the step */}
                {currentStep > 0 && (
```

Replace with:
```tsx
                {/* Navigation — hidden on step 0 and on the terminal step 3,
                    where Go to Dashboard in the card is the only exit. */}
                {currentStep > 0 && currentStep < STEP_COUNT - 1 && (
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/HideOut/Documents/Cyclo/src/app && npx tsc --noEmit 2>&1 | grep "error TS"
```
Expected: no output (0 errors). Common errors to check:
- `QRCode.toCanvas` not found → verify `import QRCode from 'qrcode'` and `@types/qrcode` installed
- `navigate` not found → verify `const [, navigate] = useLocation()` and wouter import updated
- `APP_BASE_URL` not found → verify constant was added in Task 1 Step 5
- `clearPersistedStep` / `clearPersistedPlanId` not found → these are module-level functions already in the file, should be accessible

- [ ] **Step 5: Foundry tests**

```bash
cd /Users/HideOut/Documents/Cyclo && forge test 2>&1 | tail -3
```
Expected: `42 tests passed, 0 failed, 0 skipped`.

- [ ] **Step 6: Manual verification checklist**

Start the dev server:
```bash
cd /Users/HideOut/Documents/Cyclo/src/app && npm run dev
```

Navigate to `http://localhost:5173/onboarding` and walk through all steps:

- [ ] Connect wallet → auto-advances to step 1
- [ ] Fund from faucet → "I'm funded, continue" → step 2
- [ ] Fill in plan form → "Create Plan" → step 3
- [ ] Step 3 shows heading "Your checkout link is ready" and subtext "Share this link with anyone you want to subscribe."
- [ ] Read-only input shows URL in format `http://localhost:5173/subscribe/<planId>` (or VITE_APP_URL if set)
- [ ] ↗ icon button opens the URL in a new browser tab
- [ ] "Copy Link" copies the URL to clipboard; text changes to "Copied! ✓" for 2 seconds then reverts to "Copy Link"
- [ ] QR code renders inside the canvas element, visible after a brief moment
- [ ] Nav row (Back / Next buttons) is NOT visible on step 3
- [ ] "Go to Dashboard" button is present and styled indigo, full-width
- [ ] Clicking "Go to Dashboard" navigates to `/` (merchant dashboard)
- [ ] After navigating, revisiting `/onboarding` starts at step 0 (localStorage was cleared)
- [ ] Back button on step 3 is NOT present (nav row hidden entirely)

- [ ] **Step 7: Commit**

```bash
cd /Users/HideOut/Documents/Cyclo && git add src/app/src/pages/OnboardingPage.tsx && git commit -m "feat(demo): add share-link step content to onboarding wizard

- ShareLinkStepContent renders on step index 3
- Subscribe URL derived from VITE_APP_URL or window.location.origin
- QR code rendered onto canvas via QRCode.toCanvas
- Copy Link button with 2-second Copied! feedback
- Go to Dashboard clears localStorage and navigates to /
- Nav row hidden on terminal step 3"
```

---

## Self-review against spec

**Spec coverage:**

| Spec requirement | Covered by |
|---|---|
| Heading "Your checkout link is ready" | Task 2 Step 1 — exact string in JSX h2 |
| Subtext "Share this link with anyone you want to subscribe." | Task 2 Step 1 — exact string in JSX p |
| subscribeUrl = (APP_BASE_URL or window.location.origin) + /subscribe/ + planId | Task 2 Step 1 — template literal |
| Read-only input displays subscribeUrl | Task 2 Step 1 — input readOnly value={subscribeUrl} |
| Open-in-new-tab anchor with ↗ | Task 2 Step 1 — a tag with target="_blank" rel="noopener noreferrer" |
| Copy Link button; Copied! ✓ for 2 s | Task 2 Step 1 — handleCopy with setTimeout 2_000 |
| QR code 160×160 via qrcode toCanvas | Task 2 Step 1 — canvas ref + useEffect + QRCode.toCanvas |
| Go to Dashboard clears localStorage and navigates | Task 2 Step 1 — handleDashboard |
| Nav row hidden on step 3 | Task 2 Step 3 — currentStep < STEP_COUNT - 1 |
| currentStep === 3 render condition | Task 2 Step 2 |
| planId !== null guard in render | Task 2 Step 2 |
| VITE_APP_URL= in .env.example | Task 1 Step 2 |
| APP_BASE_URL constant | Task 1 Step 5 |
| qrcode + @types/qrcode installed | Task 1 Step 1 |
| import QRCode from 'qrcode' | Task 1 Step 4 |
| useLocation import added | Task 1 Step 3 |
| No inline styles | ✓ Tailwind only |
| No unused imports | ✓ useLocation, QRCode, APP_BASE_URL all used in new component |
