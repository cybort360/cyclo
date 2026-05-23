# Onboarding Step 4 — Share Link Design

**Date:** 2026-05-23
**Scope:** Step 4 content for /onboarding. Shows the merchant's subscribe URL, a copy button, an open-in-new-tab link, a QR code, and a "Go to Dashboard" button that clears onboarding state and navigates to /.

---

## Overview

Add the terminal step to the onboarding wizard. When the user reaches step index 3 ("Share Your Link"), they see their subscribe URL displayed as a read-only input with a copy button and an open-in-new-tab icon button, a QR code of the URL rendered onto a canvas element (160x160 px), and a "Go to Dashboard" button that clears both localStorage keys and navigates to /. There is no Next button on this step.

Note on QR rendering: the qrcode package's toCanvas(element, url, options) API writes directly to a canvas DOM node via a ref. This avoids any string-based HTML injection and is the recommended React integration pattern for this library. The visual result is identical to an SVG QR code at 160 px.

---

## Files

| File | Change |
|---|---|
| src/app/src/pages/OnboardingPage.tsx | Add APP_BASE_URL constant, ShareLinkStepContentProps interface, ShareLinkStepContent component, render condition for currentStep === 3, nav row tweak, add QRCode and useLocation imports |
| src/app/package.json | Add qrcode to dependencies, @types/qrcode to devDependencies |
| src/app/.env.example | Add VITE_APP_URL= |

No new source files. One new npm dependency.

---

## New npm Dependency

Install from within src/app:

  npm install qrcode
  npm install --save-dev @types/qrcode

qrcode provides QRCode.toCanvas(canvasElement, text, options) which renders a QR code directly onto a provided canvas DOM element. options.width controls the output size in pixels.

---

## New Constant

  const APP_BASE_URL: string = import.meta.env.VITE_APP_URL ?? ''

Defined at module level near ARC_FAUCET_URL. Empty string as fallback; the component uses window.location.origin at runtime when the env var is absent or blank.

---

## src/app/.env.example Addition

  VITE_APP_URL=

Added after VITE_ARC_FAUCET_URL=.

---

## ShareLinkStepContent Component

### Props Interface

  interface ShareLinkStepContentProps {
      planId: bigint
  }

planId is the confirmed on-chain plan ID from step 3. Used to build the subscribe URL.

### Internal State, Refs, and Derived Values

  const [, navigate] = useLocation()

  const subscribeUrl = (APP_BASE_URL || window.location.origin) + '/subscribe/' + String(planId)

  const [copied,  setCopied]  = useState(false)
  const qrCanvasRef           = useRef<HTMLCanvasElement>(null)

### QR Code Generation

  useEffect(() => {
      if (qrCanvasRef.current === null) return
      QRCode.toCanvas(qrCanvasRef.current, subscribeUrl, { width: 160 })
          .catch(() => {
              // QR generation failed — canvas stays blank, no error shown
          })
  }, [subscribeUrl])

Runs whenever subscribeUrl changes (once on mount since planId is stable). toCanvas writes to the canvas element directly via the ref. On failure the canvas stays blank and the rest of the card renders normally.

### Copy Handler

  async function handleCopy(): Promise<void> {
      try {
          await navigator.clipboard.writeText(subscribeUrl)
          setCopied(true)
          setTimeout(() => setCopied(false), 2_000)
      } catch {
          // Clipboard unavailable — degrade silently, do not crash
      }
  }

### Dashboard Handler

  function handleDashboard(): void {
      clearPersistedStep()
      clearPersistedPlanId()
      navigate('/')
  }

Clears both localStorage keys before navigating. No React state reset needed — navigation unmounts OnboardingPage entirely.

### Card Layout (ASCII)

  +-----------------------------------------+
  | Your checkout link is ready              |  text-lg font-semibold
  | Share this link with anyone you want to  |  text-sm text-gray-500 mt-1
  | subscribe.                               |
  |                                          |
  | [https://.../subscribe/1          ] [->] |  read-only input + icon anchor
  |                                          |
  | [Copy Link]  ->  [Copied! check]         |  button, 2 s feedback
  |                                          |
  | [       160x160 canvas QR code       ]   |  centered
  |                                          |
  | [         Go to Dashboard             ]  |  indigo, w-full
  +-----------------------------------------+

Card element: div with classes "bg-white border border-gray-200 rounded-xl p-6 space-y-4" matching all prior step cards.

### URL Row JSX

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
          ->
      </a>
  </div>

(Use the Unicode arrow character rightwards arrow with hook, or a simple text arrow glyph in the actual implementation — see exact character in Definition of Done below.)

### Copy Button JSX

  <button
      onClick={handleCopy}
      className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
  >
      {copied ? 'Copied! check' : 'Copy Link'}
  </button>

(Use Unicode check mark in the actual implementation: "Copied! ✓" or the literal character. See Definition of Done.)

### QR Code Block JSX

  <div className="flex justify-center">
      <canvas ref={qrCanvasRef} width={160} height={160} />
  </div>

The canvas element is always rendered. toCanvas populates it once the effect fires. width/height attributes set the canvas buffer size; the CSS class w-40 h-40 is not needed since the canvas intrinsic size already matches.

### Go to Dashboard Button JSX

  <button
      onClick={handleDashboard}
      className="w-full px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
  >
      Go to Dashboard
  </button>

---

## Wiring in OnboardingPage

### Updated Imports

Change the existing wouter import from:

  import { Link } from 'wouter'

To:

  import { Link, useLocation } from 'wouter'

Add the qrcode import after the existing imports:

  import QRCode from 'qrcode'

### JSX Render Condition

Added after the step 3 block:

  {/* Step 4 content -- share link card */}
  {currentStep === 3 && planId !== null && (
      <ShareLinkStepContent planId={planId} />
  )}

The planId !== null guard is defensive -- step 3 is only reachable after step 2's onSuccess, so planId will always be set here.

### Nav Row Change

The terminal step shows no navigation row. Change:

  {currentStep > 0 && (

To:

  {currentStep > 0 && currentStep < STEP_COUNT - 1 && (

This hides the nav row entirely on step 3 (Back and Next both hidden). The "Go to Dashboard" button inside the card is the only exit.

---

## Spec Non-Goals

- No share-via-email or social buttons
- No copy fallback UI for browsers without the Clipboard API
- No QR error message shown on generation failure
- No change to the stepper component
- No animation on copy feedback beyond the text change
- No content for a hypothetical step 5

---

## Definition of Done

- [ ] qrcode in src/app/package.json dependencies; @types/qrcode in devDependencies
- [ ] VITE_APP_URL= present in src/app/.env.example
- [ ] APP_BASE_URL constant at module level: import.meta.env.VITE_APP_URL ?? ''
- [ ] wouter import updated to: import { Link, useLocation } from 'wouter'
- [ ] import QRCode from 'qrcode' added
- [ ] ShareLinkStepContent renders when currentStep === 3 and planId !== null
- [ ] Heading: exactly "Your checkout link is ready"
- [ ] Subtext: exactly "Share this link with anyone you want to subscribe."
- [ ] subscribeUrl = (APP_BASE_URL || window.location.origin) + '/subscribe/' + String(planId)
- [ ] Read-only input displays subscribeUrl
- [ ] Open-in-new-tab anchor: href={subscribeUrl}, target="_blank", rel="noopener noreferrer", aria-label="Open subscribe link in new tab", icon text is the Unicode arrow character U+2197 (up-right arrow: ↗)
- [ ] "Copy Link" button writes subscribeUrl to clipboard; shows "Copied! ✓" (U+2713) for 2 s then reverts; always enabled
- [ ] QR canvas: ref={qrCanvasRef}, width={160}, height={160}; QRCode.toCanvas called in useEffect with { width: 160 }
- [ ] container.isConnected guard not needed for toCanvas (synchronous canvas write); effect cleanup is not required
- [ ] "Go to Dashboard" button: onClick calls clearPersistedStep(), clearPersistedPlanId(), then navigate('/')
- [ ] Nav row hidden on step 3: condition changed to currentStep > 0 && currentStep < STEP_COUNT - 1
- [ ] No console.log, no unused imports, no inline styles in new JSX
- [ ] TypeScript compiles with no new errors
- [ ] Foundry tests unaffected (frontend-only change)
