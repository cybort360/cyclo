/**
 * "How it works" section — eyebrow + h2 + subtext header, three step cards,
 * and a composability callout bar.
 *
 * Step card bottoms are bespoke per step:
 *   Step 1 — code snippet showing createPlan()
 *   Step 2 — approval confirmation mockup (USDC logo + label + checkmark)
 *   Step 3 — keeper log output (batchCharge + preflight lines)
 *
 * Composability bar: chain icon left + inline-code text + docs link right.
 *
 * CSS: HowItWorksSection.css — l- tokens only, no dark dashboard tokens.
 */
import { IconLink } from '@tabler/icons-react'
import './HowItWorksSection.css'

// ── Component ─────────────────────────────────────────────────────────────────

export function HowItWorksSection() {
    return (
        <section id="how-it-works" className="hiw-section">
            <div className="hiw-inner">

                {/* ── Section header ──────────────────────────────────────── */}
                <div className="hiw-header">
                    <span className="hiw-eyebrow">How it works</span>
                    <h2 className="hiw-h2">
                        From plan creation to<br />
                        <em className="hiw-h2-em">automatic settlement.</em>
                    </h2>
                    <p className="hiw-sub">
                        Create a plan. Approve once. Let the protocol do the rest —
                        every charge transparent, every payment on-chain.
                    </p>
                </div>

                {/* ── Step cards ──────────────────────────────────────────── */}
                <div className="hiw-grid">

                    {/* ── Step 1: Merchants create a plan ──────────────── */}
                    <div className="hiw-card">
                        <span className="hiw-step-num">STEP 01</span>
                        <h3 className="hiw-title">Merchants create a plan</h3>
                        <p className="hiw-desc">
                            Set a price, billing interval, and optional trial period. One
                            transaction on Arc — plan is live immediately.
                        </p>

                        {/* Code snippet — function name in accent colour */}
                        <div className="hiw-code-snip" aria-label="Example createPlan call">
                            <span className="hiw-code-fn">createPlan</span>
                            <span className="hiw-code-args">(9_990_000, 2_592_000, 0)</span>
                        </div>
                    </div>

                    {/* ── Step 2: Subscribers approve once ─────────────── */}
                    <div className="hiw-card">
                        <span className="hiw-step-num">STEP 02</span>
                        <h3 className="hiw-title">Subscribers approve once</h3>
                        <p className="hiw-desc">
                            One USDC allowance approval. No repeated signing. The SDK manages
                            re-approval automatically when allowance runs low.
                        </p>

                        {/* Approval mockup — USDC circle + label + green tick */}
                        <div className="hiw-approval" aria-label="USDC approval confirmation">
                            <div className="hiw-usdc-logo" aria-hidden="true">U</div>
                            <span className="hiw-approval-label">Approve 12 months</span>
                            <span className="hiw-approval-check" aria-hidden="true">✓</span>
                        </div>
                    </div>

                    {/* ── Step 3: Protocol settles automatically ────────── */}
                    <div className="hiw-card">
                        <span className="hiw-step-num">STEP 03</span>
                        <h3 className="hiw-title">Protocol settles automatically</h3>
                        <p className="hiw-desc">
                            A decentralised keeper polls the chain, runs pre-flight checks, and
                            calls batchCharge() on schedule. Every transaction is on-chain.
                        </p>

                        {/* Keeper log — "OK" in green, all else in muted */}
                        <div className="hiw-keeper-log" aria-label="Keeper activity log">
                            <p className="hiw-log-line">
                                <span className="hiw-log-muted">{'> batchCharge — 847 subs · '}</span>
                                <span className="hiw-log-ok">OK</span>
                            </p>
                            <p className="hiw-log-line">
                                <span className="hiw-log-muted">{'> preflight — all clear'}</span>
                            </p>
                        </div>
                    </div>

                </div>

                {/* ── Composability callout bar ──────────────────────────── */}
                <div className="hiw-callout">

                    <div className="hiw-callout-left">
                        <IconLink size={20} className="hiw-callout-icon" aria-hidden="true" />
                        <p className="hiw-callout-text">
                            Every subscription mints a soulbound NFT — any Arc contract calls{' '}
                            <code className="hiw-callout-code">isSubscribed(wallet, planId)</code>
                            {' '}to verify access.
                        </p>
                    </div>

                    <a href="#docs" className="hiw-callout-link">
                        See composability docs →
                    </a>

                </div>

            </div>
        </section>
    )
}
