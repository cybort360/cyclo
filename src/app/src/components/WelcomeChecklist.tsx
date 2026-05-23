/**
 * Bespoke welcome experience shown on the Overview page for new merchants.
 * Replaces the stats section until the merchant has both a plan and a subscriber.
 *
 * Steps 1 and 3 check themselves dynamically via hasPlans / hasSubscribers.
 * Step 2 (share link) becomes interactive only after step 1 is done.
 * None of the checked state is persisted here — the parent owns graduation logic.
 */
import { useState } from 'react'
import { Link } from 'wouter'

// ── Props ──────────────────────────────────────────────────────────────────────

export interface WelcomeChecklistProps {
    /** Connected wallet address — shown truncated in the heading. */
    address:            string
    /** True when the merchant has at least one plan on-chain. */
    hasPlans:           boolean
    /** True when the merchant has at least one active subscriber. */
    hasSubscribers:     boolean
    /** planId of the first plan — used to build the checkout URL for step 2. */
    firstActivePlanId?: bigint
}

// ── Step item ──────────────────────────────────────────────────────────────────

interface StepItemProps {
    n:         number
    label:     string
    checked:   boolean
    href?:     string
    onClick?:  () => void
    disabled?: boolean
}

function StepItem({ n, label, checked, href, onClick, disabled }: StepItemProps): JSX.Element {
    const indicator = checked ? (
        <span className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center
                         text-white text-[11px] font-bold shrink-0 select-none">
            ✓
        </span>
    ) : (
        <span className="w-6 h-6 rounded-full border-2 border-gray-200 flex items-center
                         justify-center text-xs font-medium text-gray-400 shrink-0 select-none">
            {n}
        </span>
    )

    const textCls = checked
        ? 'text-sm text-gray-400 line-through'
        : disabled
        ? 'text-sm text-gray-300 select-none'
        : 'text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors'

    const text = <span className={textCls}>{label}</span>

    // Checked and disabled steps are non-interactive.
    const content = checked || disabled ? text : href ? (
        <Link href={href}><a>{text}</a></Link>
    ) : onClick ? (
        <button type="button" onClick={onClick} className="text-left">{text}</button>
    ) : text

    return (
        <li className="flex items-center gap-3">
            {indicator}
            {content}
        </li>
    )
}

// ── Component ──────────────────────────────────────────────────────────────────

export function WelcomeChecklist({
    address, hasPlans, hasSubscribers, firstActivePlanId,
}: WelcomeChecklistProps): JSX.Element {
    const [copied, setCopied] = useState(false)

    const truncated = `${address.slice(0, 6)}…${address.slice(-4)}`

    function copyCheckoutLink(): void {
        if (!firstActivePlanId) return
        const url = `${window.location.origin}/subscribe/${firstActivePlanId}`
        void navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2_000)
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-100 px-8 py-10 space-y-8 max-w-lg">

            <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Getting started
                </p>
                <h2 className="text-xl font-bold text-gray-900">
                    Welcome to Cyclo,{' '}
                    <code className="font-mono text-indigo-600 text-lg">{truncated}</code>
                </h2>
            </div>

            <ol className="space-y-5">
                <StepItem
                    n={1}
                    label="Create your first plan"
                    checked={hasPlans}
                    href={hasPlans ? undefined : '/plans'}
                />
                <StepItem
                    n={2}
                    label={copied ? 'Copied!' : 'Share your checkout link'}
                    checked={false}
                    onClick={hasPlans ? copyCheckoutLink : undefined}
                    disabled={!hasPlans}
                />
                <StepItem
                    n={3}
                    label="Watch your first subscriber appear"
                    checked={hasSubscribers}
                    href={hasSubscribers ? undefined : '/subscribers'}
                />
            </ol>

            <p className="text-sm text-gray-400 pt-4 border-t border-gray-100">
                Need help?{' '}
                <Link href="/onboarding">
                    <a className="text-indigo-600 font-medium hover:underline">
                        Follow the setup guide →
                    </a>
                </Link>
            </p>

        </div>
    )
}
