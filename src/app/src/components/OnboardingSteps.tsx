/**
 * OnboardingSteps — step content panels for the onboarding wizard.
 *
 * Exports:
 *   ConnectWalletStepContent — step 0: wallet connection prompt
 *   FundWalletStepContent    — step 1: faucet link + live USDC balance
 *   CreatePlanStepContent    — step 2: plan creation form
 *   ShareLinkStepContent     — step 3: checkout URL + QR code
 *   ResumeBanner             — shown when prior progress is detected in localStorage
 *
 * CSS: onb- classes from OnboardingPage.css (loaded by parent OnboardingPage.tsx).
 */
import { useState, useEffect, useRef, type FormEvent } from 'react'
import { ConnectButton }   from './WalletStatus'
import { fromUsdcUnits }  from '../utils/formatting'
import { useCycloClient } from '@cyclo/react'
import QRCode             from 'qrcode'

const ARC_FAUCET_URL: string = import.meta.env.VITE_ARC_FAUCET_URL ?? 'https://faucet.circle.com/'
const APP_BASE_URL:   string = import.meta.env.VITE_APP_URL         ?? ''

// ── Connect wallet ────────────────────────────────────────────────────────────

/**
 * Step 0 content: prompts the user to connect their Web3 wallet.
 * Connection is detected by the parent and triggers auto-advance.
 * @returns Card with a ConnectButton.
 */
export function ConnectWalletStepContent() {
    return (
        <div className="onb-card">
            <div>
                <p className="onb-card-title">Connect your wallet</p>
                <p className="onb-card-sub">
                    You'll need a Web3 wallet to create plans and receive payments.
                </p>
            </div>
            <ConnectButton />
        </div>
    )
}

// ── Fund wallet ───────────────────────────────────────────────────────────────

interface FundWalletStepContentProps {
    usdcBalance: bigint | undefined
    onAdvance:   () => void
}

/**
 * Step 1 content: shows a faucet link and live USDC balance.
 * Advance button is disabled until any nonzero balance is detected.
 * @param usdcBalance - Live USDC balance polled by the parent.
 * @param onAdvance   - Called when the user clicks "I'm funded, continue".
 * @returns Card with faucet link, balance display, and advance button.
 */
export function FundWalletStepContent({ usdcBalance, onAdvance }: FundWalletStepContentProps) {
    const balanceDisplay = usdcBalance !== undefined
        ? `${fromUsdcUnits(usdcBalance).toFixed(6)} USDC`
        : '—'
    const canContinue = usdcBalance !== undefined && usdcBalance > 0n

    return (
        <div className="onb-card">
            <div>
                <p className="onb-card-title">Fund your wallet with testnet USDC</p>
                <p className="onb-card-sub">
                    You need testnet USDC to pay gas fees and test subscriptions on Arc.
                </p>
            </div>
            {/* Styled as a primary button — inline presentation fixes needed for <a>. */}
            <a
                href={ARC_FAUCET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="onb-btn--primary"
                style={{ textDecoration: 'none', textAlign: 'center' }}
            >
                Open Arc Faucet ↗
            </a>
            <p className="onb-balance">
                Balance:{' '}
                <span className="onb-balance-val">{balanceDisplay}</span>
            </p>
            <button onClick={onAdvance} disabled={!canContinue} className="onb-btn--primary">
                I'm funded, continue
            </button>
        </div>
    )
}

// ── Create plan ───────────────────────────────────────────────────────────────

interface CreatePlanStepContentProps {
    onSuccess: (planId: bigint) => void
}

/**
 * Step 2 content: form for creating a subscription plan.
 * Owns form state internally. Calls cyclo.createPlan() on submit
 * and notifies the parent via onSuccess(planId) to persist and advance.
 * @param onSuccess - Called with the new plan ID after successful creation.
 * @returns Form card with name, price, and interval inputs.
 */
export function CreatePlanStepContent({ onSuccess }: CreatePlanStepContentProps) {
    // planName is a UX affordance — the contract's createPlan has no name parameter.
    // Kept so the form feels complete to merchants.
    const [planName,  setPlanName]  = useState('')
    const [price,     setPrice]     = useState('')
    const [interval,  setInterval]  = useState('30')
    const [isPending, setIsPending] = useState(false)
    const [error,     setError]     = useState<string | null>(null)

    const cyclo = useCycloClient()

    async function handleSubmit(e: FormEvent): Promise<void> {
        e.preventDefault()
        setError(null)
        setIsPending(true)
        try {
            // parseFloat is safe: step="0.01" constrains price to 2 decimal places,
            // which Math.round(x * 1_000_000) handles without precision loss.
            const id = await cyclo.createPlan({
                price:        parseFloat(price),
                intervalDays: parseInt(interval, 10),
                trialDays:    0,
            })
            onSuccess(id)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create plan')
        } finally {
            setIsPending(false)
        }
    }

    // Regex guards the 2-decimal assumption: step="0.01" is a browser hint only.
    const canSubmit =
        price !== '' &&
        /^\d+(\.\d{1,2})?$/.test(price) &&
        parseFloat(price) >= 0.01 &&
        !isPending

    return (
        <form onSubmit={handleSubmit} className="onb-card">
            <div>
                <p className="onb-card-title">Create your first subscription plan</p>
                <p className="onb-card-sub">This defines what you're charging and how often.</p>
            </div>
            <div className="onb-field">
                <label htmlFor="plan-name" className="onb-label">Plan name (optional)</label>
                <input
                    id="plan-name"
                    type="text"
                    value={planName}
                    onChange={e => setPlanName(e.target.value)}
                    placeholder="e.g. Pro Monthly"
                    className="onb-input"
                />
            </div>
            <div className="onb-field">
                <label htmlFor="plan-price" className="onb-label">Price (USDC)</label>
                <input
                    id="plan-price"
                    type="number"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    min="0.01"
                    step="0.01"
                    placeholder="10.00"
                    className="onb-input"
                />
            </div>
            <div className="onb-field">
                <label htmlFor="plan-interval" className="onb-label">Billing interval</label>
                <select
                    id="plan-interval"
                    value={interval}
                    onChange={e => setInterval(e.target.value)}
                    className="onb-select"
                >
                    <option value="30">Monthly</option>
                    <option value="7">Weekly</option>
                    <option value="365">Yearly</option>
                </select>
            </div>
            {error !== null && <p className="onb-error">{error}</p>}
            <button type="submit" disabled={!canSubmit} className="onb-btn--primary">
                {isPending ? 'Creating…' : 'Create Plan'}
            </button>
        </form>
    )
}

// ── Share link ────────────────────────────────────────────────────────────────

interface ShareLinkStepContentProps {
    planId:      bigint
    /** Called when the user clicks "Go to Dashboard" — parent clears localStorage and navigates. */
    onDashboard: () => void
}

/**
 * Step 3 content: displays the subscribe URL, QR code, and copy/open controls.
 * @param planId      - Plan ID for constructing the checkout URL.
 * @param onDashboard - Called when the user clicks "Go to Dashboard".
 * @returns Card with URL input, copy button, QR code, and dashboard button.
 */
export function ShareLinkStepContent({ planId, onDashboard }: ShareLinkStepContentProps) {
    const [copied, setCopied] = useState(false)
    const qrCanvasRef         = useRef<HTMLCanvasElement>(null)
    const copyTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null)

    const subscribeUrl = `${APP_BASE_URL || window.location.origin}/subscribe/${String(planId)}`

    useEffect(() => {
        if (qrCanvasRef.current === null) return
        QRCode.toCanvas(qrCanvasRef.current, subscribeUrl, { width: 160 })
            .catch(() => {
                // QR generation failed — canvas stays blank, card still renders
            })
    }, [subscribeUrl])

    useEffect(() => () => {
        if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current)
    }, [])

    async function handleCopy(): Promise<void> {
        try {
            await navigator.clipboard.writeText(subscribeUrl)
            setCopied(true)
            if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current)
            copyTimerRef.current = setTimeout(() => setCopied(false), 2_000)
        } catch {
            // Clipboard unavailable — degrade silently
        }
    }

    return (
        <div className="onb-card">
            <div>
                <p className="onb-card-title">Your checkout link is ready</p>
                <p className="onb-card-sub">Share this link with anyone you want to subscribe.</p>
            </div>
            <div className="onb-url-row">
                <input
                    type="text"
                    readOnly
                    value={subscribeUrl}
                    className="onb-url-input"
                />
                <a
                    href={subscribeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="onb-open-link"
                    aria-label="Open subscribe link in new tab"
                >
                    ↗
                </a>
            </div>
            <button onClick={handleCopy} className="onb-btn--primary">
                {copied ? 'Copied! ✓' : 'Copy Link'}
            </button>
            <div className="onb-qr-wrap">
                <canvas ref={qrCanvasRef} width={160} height={160} />
            </div>
            <button onClick={onDashboard} className="onb-btn--primary">
                Go to Dashboard
            </button>
        </div>
    )
}

// ── Resume banner ─────────────────────────────────────────────────────────────

interface ResumeBannerProps {
    onResume: () => void
}

/**
 * Banner shown when prior onboarding progress is detected in localStorage.
 * Displayed when both cyclo_onboarding_step and cyclo_onboarding_planId are set,
 * indicating the user created a plan but did not complete the flow.
 * @param onResume - Called when the user clicks the resume link.
 * @returns Accent-tinted banner with a clickable resume link.
 */
export function ResumeBanner({ onResume }: ResumeBannerProps) {
    return (
        <div className="onb-resume">
            <span>✓</span>
            <span>
                You're almost done.{' '}
                <button className="onb-resume-btn" onClick={onResume}>
                    Resume where you left off →
                </button>
            </span>
        </div>
    )
}
