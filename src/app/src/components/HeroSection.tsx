/**
 * Full-viewport hero section for the landing page (/).
 *
 * Two-column layout:
 *   Left  — badge, headline, subheading, CTA row, trust line
 *   Right — floating dashboard window mockup with keeper + subscriber pills
 *
 * The .hs-stats-row is rendered as a sibling OUTSIDE the overflow-hidden
 * section so its bottom:-40px shift bleeds visually into the next section.
 *
 * CSS: HeroSection.css (section shell + copy), HeroDashboard.css (mockup + stats).
 * Both files use l- tokens from landing-tokens.css exclusively.
 */
import { Link } from 'wouter'
import { LogoIcon } from './Logo'
import './HeroSection.css'
import './HeroDashboard.css'

export function HeroSection() {
    return (
        <>
            <section id="hero" className="hs-section">

                {/* ── Background layers (z-index 0) ──────────────────────── */}
                <div className="hs-blob-indigo" aria-hidden="true" />
                <div className="hs-blob-warm"   aria-hidden="true" />
                <div className="hs-dots"        aria-hidden="true" />

                {/* Decorative watermark — 420px mono logo, 4% opacity */}
                <div className="hs-watermark" aria-hidden="true">
                    <LogoIcon size={420} variant="mono" />
                </div>

                {/* ── Main content (z-index 1) ───────────────────────────── */}
                <div className="hs-content">
                    <div className="hs-inner">
                        <div className="hs-two-col">

                            {/* ── Left copy column ─────────────────────────── */}
                            <div className="hs-left">

                                {/* 1. Badge */}
                                <div className="hs-badge">
                                    <LogoIcon size={14} variant="default" />
                                    <span>Built on Arc testnet</span>
                                </div>

                                {/* 2. Headline */}
                                <h1 className="hs-h1">
                                    Billing infrastructure<br />
                                    for{' '}<em className="hs-h1-em">Web3.</em>
                                </h1>

                                {/* 3. Subheading */}
                                <p className="hs-sub">
                                    Merchants create subscription plans on-chain.
                                    Subscribers approve once. A decentralised keeper
                                    settles every payment automatically — no backend,
                                    no API keys, no trust required.
                                </p>

                                {/* 4. CTA row */}
                                <div className="hs-cta">
                                    <Link href="/onboarding">
                                        <a className="hs-cta-primary">
                                            Start accepting subscriptions
                                        </a>
                                    </Link>
                                    <a href="#how-it-works" className="hs-cta-secondary">
                                        Watch how it works →
                                    </a>
                                </div>

                                {/* 5. Trust line */}
                                <div className="hs-trust">
                                    <span className="hs-trust-item">No API keys</span>
                                    <span className="hs-trust-sep" aria-hidden="true" />
                                    <span className="hs-trust-item">No backend</span>
                                    <span className="hs-trust-sep" aria-hidden="true" />
                                    <span className="hs-trust-item">Open source</span>
                                </div>

                            </div>

                            {/* ── Right: dashboard mockup (desktop only) ─────── */}
                            <div className="hs-right" aria-hidden="true">

                                {/* Keeper pill — overlaps top-left of card, rotated -3deg */}
                                <div className="hs-pill hs-pill-keeper">
                                    <span className="hs-pill-dot hs-pill-dot--green" />
                                    <span className="hs-pill-text">Keeper live · 3ms</span>
                                </div>

                                {/* Dashboard window card — rotated 2deg */}
                                <div className="hs-dash-card">

                                    <div className="hs-dash-top">
                                        <span className="hs-dash-overview">Overview</span>
                                        <span className="hs-dash-date">May 24, 2026</span>
                                    </div>

                                    <div className="hs-dash-mini-grid">
                                        <div className="hs-dash-mini-card">
                                            <p className="hs-dash-mini-label">Revenue</p>
                                            <p className="hs-dash-mini-value">$2,340</p>
                                        </div>
                                        <div className="hs-dash-mini-card">
                                            <p className="hs-dash-mini-label">Subs</p>
                                            <p className="hs-dash-mini-value hs-dash-mini-value--accent">128</p>
                                        </div>
                                    </div>

                                    {/* Sparkline — indigo fill, no CSS custom properties in SVG attrs */}
                                    <svg className="hs-spark" viewBox="0 0 300 60" preserveAspectRatio="none">
                                        <defs>
                                            <linearGradient id="hs-spark-fill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%"   stopColor="rgb(79,70,229)" stopOpacity="0.08" />
                                                <stop offset="100%" stopColor="rgb(79,70,229)" stopOpacity="0" />
                                            </linearGradient>
                                        </defs>
                                        <path d="M0,50 C50,42 100,35 160,24 C220,13 260,17 300,8 L300,60 L0,60 Z" fill="url(#hs-spark-fill)" />
                                        <path d="M0,50 C50,42 100,35 160,24 C220,13 260,17 300,8" fill="none" stroke="rgba(79,70,229,0.65)" strokeWidth="1.5" strokeLinecap="round" />
                                    </svg>

                                    <div className="hs-settle-row">
                                        <div className="hs-settle-avatar hs-settle-avatar--indigo">O</div>
                                        <span className="hs-settle-name">orion.eth</span>
                                        <span className="hs-settle-amount">$19.00</span>
                                    </div>
                                    <div className="hs-settle-row">
                                        <div className="hs-settle-avatar hs-settle-avatar--green">V</div>
                                        <span className="hs-settle-name">vega.eth</span>
                                        <span className="hs-settle-amount">$49.00</span>
                                    </div>
                                    <div className="hs-settle-row">
                                        <div className="hs-settle-avatar hs-settle-avatar--orange">Z</div>
                                        <span className="hs-settle-name">zara.eth</span>
                                        <span className="hs-settle-amount">$9.00</span>
                                    </div>

                                </div>

                                {/* Subscriber notification pill — overlaps bottom-right, rotate 1deg */}
                                <div className="hs-pill hs-pill-sub">
                                    <p className="hs-pill-title">↑ orion.eth subscribed</p>
                                    <p className="hs-pill-detail">Team Monthly · 199 USDC</p>
                                </div>

                            </div>

                        </div>
                    </div>
                </div>

            </section>

            {/* ── Floating stat cards ─────────────────────────────────────────
                Sibling of <section> so overflow:hidden doesn't clip them.
                bottom:-40px shifts them 40px into the next section visually. */}
            <div className="hs-stats-row" aria-label="Live protocol statistics">
                <div className="hs-stat-card">
                    <p className="hs-stat-label">Total USDC Settled</p>
                    <p className="hs-stat-value">$1,284,060</p>
                    <p className="hs-stat-delta">↑ 12% this month</p>
                </div>
                <div className="hs-stat-card">
                    <p className="hs-stat-label">Active Subscribers</p>
                    <p className="hs-stat-value hs-stat-value--accent">3,847</p>
                    <p className="hs-stat-delta">↑ 38 this week</p>
                </div>
                <div className="hs-stat-card">
                    <p className="hs-stat-label">Keeper charges today</p>
                    <p className="hs-stat-value">214</p>
                    <p className="hs-stat-sub">Arc testnet · live</p>
                </div>
            </div>
        </>
    )
}
