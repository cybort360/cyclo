/**
 * /demo — fictional "Flowboard" SaaS landing page that embeds the Cyclo widget
 * inline in the Pro pricing card. "Start 7-day free trial" reveals the
 * CycloCheckout component in place.
 *
 * Class prefix: dm-   Styles: DemoPage.css   Icons: hugeicons-react
 */
import { useState, useEffect } from 'react'
import {
    FlashIcon,
    AnalyticsUpIcon,
    LockIcon,
    GlobalIcon,
    CheckmarkCircle01Icon,
} from 'hugeicons-react'
import { CycloCheckout } from '../widget/Widget'
import { CONTRACT_ADDRESS, USDC_ADDRESS } from '../constants/addresses'
import './DemoPage.css'

// ── Data ──────────────────────────────────────────────────────────────────────

const DEMO_PLAN_ID = 1n

type FeatureIcon = typeof FlashIcon

interface Feature {
    Icon:        FeatureIcon
    title:       string
    description: string
}

const FEATURES: Feature[] = [
    {
        Icon:        FlashIcon,
        title:       'Instant deploys',
        description: 'Push to main and your app is live in seconds. Zero config.',
    },
    {
        Icon:        AnalyticsUpIcon,
        title:       'Real-time analytics',
        description: 'See every request, error, and latency spike as it happens.',
    },
    {
        Icon:        LockIcon,
        title:       'Built-in security',
        description: 'DDoS protection, WAF, and SSL certificates included.',
    },
    {
        Icon:        GlobalIcon,
        title:       'Global edge network',
        description: 'Served from 47 regions. Sub-100ms response times worldwide.',
    },
]

const HOBBY_FEATURES      = ['3 projects', '10k requests/month', 'Community support']
const PRO_FEATURES        = ['Unlimited projects', '1M requests/month', 'Priority support', 'Custom domains']
const ENTERPRISE_FEATURES = ['Everything in Pro', 'SLA guarantee', 'Dedicated support', 'SSO + audit logs']

// ── Plan card ─────────────────────────────────────────────────────────────────

interface PlanCardProps {
    name:       string
    price:      string
    sub:        string
    features:   string[]
    featured?:  boolean
    cta:        string
    onCta?:     () => void
    children?:  React.ReactNode
}

/**
 * Generic pricing plan card.
 * When `children` is provided it replaces the CTA button (used for the inline
 * checkout widget).
 */
function PlanCard({ name, price, sub, features, featured, cta, onCta, children }: PlanCardProps) {
    return (
        <div className={`dm-plan-card${featured ? ' dm-plan-card--featured' : ''}`}>
            {featured && <span className="dm-plan-badge">Most popular</span>}
            <p className="dm-plan-name">{name}</p>
            <p className="dm-plan-price">{price}</p>
            <p className="dm-plan-sub">{sub}</p>
            <ul className="dm-plan-features">
                {features.map(f => (
                    <li key={f} className="dm-plan-feature">
                        <CheckmarkCircle01Icon
                            size={15}
                            className="dm-plan-feature-icon"
                            aria-hidden="true"
                        />
                        {f}
                    </li>
                ))}
            </ul>
            {children ?? (
                onCta ? (
                    <button onClick={onCta} className="dm-plan-btn dm-plan-btn--primary">
                        {cta}
                    </button>
                ) : (
                    <button className="dm-plan-btn dm-plan-btn--outline">
                        {cta}
                    </button>
                )
            )}
        </div>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function DemoPage() {
    const [billingOpen, setBillingOpen] = useState(false)

    // Prevent the document body from growing wider than the viewport while
    // this page is mounted. overflow-x: hidden on .dm-root alone isn't enough
    // because the browser still allows the document itself to scroll sideways
    // if any element expands beyond 100vw. Resetting on unmount avoids leaking
    // the style into other routes.
    useEffect(() => {
        document.documentElement.style.overflowX = 'hidden'
        document.body.style.overflowX = 'hidden'
        return () => {
            document.documentElement.style.overflowX = ''
            document.body.style.overflowX = ''
        }
    }, [])

    return (
        <div className="dm-root">

            {/* ── Nav ─────────────────────────────────────────────────── */}
            <nav className="dm-nav">
                <div className="dm-nav-inner">

                    {/* Brand */}
                    <a href="#" className="dm-nav-brand" aria-label="Flowboard home">
                        <div className="dm-nav-logo" aria-hidden="true" />
                        <span className="dm-nav-name">Flowboard</span>
                    </a>

                    {/* Center links (hidden on mobile) */}
                    <div className="dm-nav-links" aria-label="Site sections">
                        <a href="#features" className="dm-nav-link">Features</a>
                        <a href="#pricing"  className="dm-nav-link">Pricing</a>
                        <a href="#"         className="dm-nav-link">Docs</a>
                    </div>

                    {/* Actions */}
                    <div className="dm-nav-actions">
                        <a href="/dashboard" className="dm-nav-back">← Back to app</a>
                        <button className="dm-nav-signin">Sign in</button>
                    </div>

                </div>
            </nav>

            {/* ── Hero ────────────────────────────────────────────────── */}
            <section id="hero" className="dm-hero">
                <span className="dm-hero-badge">Now in public beta</span>
                <h1 className="dm-hero-h1">
                    Ship faster.<br />Scale further.
                </h1>
                <p className="dm-hero-sub">
                    Flowboard gives your team the deployment infrastructure used by the
                    world's fastest-growing startups.
                </p>
                <div className="dm-hero-btns">
                    <button
                        className="dm-hero-btn-primary"
                        onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                        Start free trial
                    </button>
                    <button className="dm-hero-btn-secondary">View demo</button>
                </div>
            </section>

            {/* ── Features ────────────────────────────────────────────── */}
            <section id="features" className="dm-features">
                <div className="dm-features-grid">
                    {FEATURES.map(({ Icon, title, description }) => (
                        <div key={title} className="dm-feature-card">
                            <div className="dm-feature-icon" aria-hidden="true">
                                <Icon size={20} />
                            </div>
                            <h3 className="dm-feature-title">{title}</h3>
                            <p className="dm-feature-desc">{description}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Pricing ─────────────────────────────────────────────── */}
            <section id="pricing" className="dm-pricing">
                <div className="dm-pricing-inner">

                    <div className="dm-pricing-hd">
                        <h2>Simple, transparent pricing</h2>
                        <p>No seat fees. No surprise bills. Cancel any time.</p>
                    </div>

                    <div className="dm-pricing-grid">

                        <PlanCard
                            name="Hobby"
                            price="$0"
                            sub="Forever free"
                            features={HOBBY_FEATURES}
                            cta="Get started"
                        />

                        {/* Pro — embeds CycloCheckout when the user clicks the CTA */}
                        <PlanCard
                            name="Pro"
                            price="$5.99"
                            sub="per month, billed on-chain"
                            features={PRO_FEATURES}
                            featured
                            cta="Start 7-day free trial"
                            onCta={billingOpen ? undefined : () => setBillingOpen(true)}
                        >
                            {billingOpen ? (
                                <div style={{ marginTop: 8 }}>
                                    <CycloCheckout
                                        planId={DEMO_PLAN_ID}
                                        contractAddress={CONTRACT_ADDRESS}
                                        usdcAddress={USDC_ADDRESS}
                                        rpcUrl="/rpc"
                                    />
                                </div>
                            ) : (
                                <button
                                    onClick={() => setBillingOpen(true)}
                                    className="dm-plan-btn dm-plan-btn--primary"
                                >
                                    Start 7-day free trial
                                </button>
                            )}
                        </PlanCard>

                        <PlanCard
                            name="Enterprise"
                            price="Custom"
                            sub="Contact us"
                            features={ENTERPRISE_FEATURES}
                            cta="Talk to sales"
                        />

                    </div>

                    <div className="dm-powered">
                        <p>
                            Payments powered by{' '}
                            <a href="/" target="_blank" rel="noreferrer">Cyclo</a>
                            {' '}— on-chain recurring billing on Arc testnet
                        </p>
                    </div>

                </div>
            </section>

            {/* ── Footer ──────────────────────────────────────────────── */}
            <footer className="dm-footer">
                <div className="dm-footer-inner">
                    <span>© 2026 Flowboard, Inc.</span>
                    <div className="dm-footer-links">
                        {['Privacy', 'Terms', 'Status'].map(l => (
                            <a key={l} href="#" className="dm-footer-link">{l}</a>
                        ))}
                    </div>
                </div>
            </footer>

        </div>
    )
}
