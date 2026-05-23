/**
 * Public landing page — rendered at /.
 * No wallet required. Sections are scaffolded and ready for content;
 * each has a stable id for smooth-scroll anchors.
 *
 * Layout: full-width, no sidebar, no dashboard chrome.
 * Sticky top nav with logo left, "Launch App" CTA right.
 */
import { Link } from 'wouter'
import { useProtocolStats } from '../hooks/useProtocolStats'

// ── Nav ───────────────────────────────────────────────────────────────────────

function TopNav() {
    return (
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
            <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

                {/* Logo */}
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-bold">C</span>
                    </div>
                    <span className="font-semibold text-gray-900 text-base">Cyclo</span>
                </div>

                {/* Launch App CTA */}
                <Link href="/dashboard">
                    <a className="text-sm font-semibold bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                        Launch App →
                    </a>
                </Link>
            </div>
        </header>
    )
}

// ── Sections ──────────────────────────────────────────────────────────────────

function Hero() {
    return (
        <section
            id="hero"
            /*
             * Fill the viewport below the sticky nav (h-16 = 4rem).
             * py-20 gives breathing room on short screens where the content
             * would otherwise crowd the nav or fold boundary.
             */
            className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center text-center px-6 py-20 bg-white"
        >
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Eyebrow tag */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-full text-xs font-semibold text-indigo-600 tracking-wide uppercase">
                    Arc Testnet · Open Beta
                </div>

                {/* Headline — largest text on the page */}
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 tracking-tight leading-[1.05]">
                    Recurring billing infrastructure for Arc
                </h1>

                {/* Sub-headline */}
                <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
                    Create subscription plans on-chain. Subscribers approve once.
                    The protocol handles the rest —{' '}
                    <span className="text-gray-700">no backend, no API keys, no trust required.</span>
                </p>

                {/* CTAs */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <Link href="/onboarding">
                        <a className="px-6 py-3.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm">
                            Start accepting subscriptions →
                        </a>
                    </Link>
                    <Link href="/docs">
                        <a className="px-6 py-3.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors">
                            Read the docs
                        </a>
                    </Link>
                </div>

                {/* Tagline strip */}
                <p className="text-sm text-gray-400 pt-2 select-none">
                    Built on Arc · Powered by USDC · Open source
                </p>
            </div>
        </section>
    )
}

const HOW_IT_WORKS_STEPS = [
    {
        number: 1,
        title:  'Merchants create a plan',
        body:   'Set a price, billing interval, and optional trial period. Deployed to Arc in one transaction.',
    },
    {
        number: 2,
        title:  'Subscribers approve once',
        body:   'One USDC approval. No repeated signing. The subscriber controls their wallet at all times.',
    },
    {
        number: 3,
        title:  'The protocol settles automatically',
        body:   'A decentralised keeper charges due subscriptions on schedule. Every payment is on-chain and auditable.',
    },
] as const

function HowItWorks() {
    return (
        <section
            id="how-it-works"
            className="py-24 px-6 bg-gray-50 border-t border-gray-100"
        >
            <div className="max-w-5xl mx-auto space-y-14">

                {/* Heading */}
                <div className="text-center">
                    <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                        How Cyclo works
                    </h2>
                </div>

                {/* Step cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {HOW_IT_WORKS_STEPS.map(({ number, title, body }) => (
                        <div
                            key={number}
                            className="bg-white border border-gray-100 rounded-2xl p-7 flex flex-col gap-4"
                        >
                            {/* Step number badge */}
                            <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                                <span className="text-sm font-bold text-indigo-600 tabular-nums">
                                    {number}
                                </span>
                            </div>

                            {/* Text */}
                            <div className="space-y-2">
                                <h3 className="text-base font-semibold text-gray-900 leading-snug">
                                    {title}
                                </h3>
                                <p className="text-sm text-gray-500 leading-relaxed">
                                    {body}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Composability note */}
                <p className="text-sm text-gray-400 text-center max-w-2xl mx-auto leading-relaxed">
                    Every subscription mints a soulbound NFT. Any contract on Arc can call{' '}
                    <code className="font-mono text-xs bg-white border border-gray-200 px-1.5 py-0.5 rounded text-gray-600">
                        isSubscribed(wallet, planId)
                    </code>
                    {' '}to verify access — no Cyclo integration required.
                </p>
            </div>
        </section>
    )
}

// ── Formatting helpers ────────────────────────────────────────────────────────

/** Formats a dollar amount with comma grouping and two decimal places. */
function fmtUsdc(n: number): string {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}

/** Formats an integer with comma grouping. */
function fmtInt(n: number): string {
    return n.toLocaleString('en-US')
}

// ── Protocol stats section ────────────────────────────────────────────────────

/** Skeleton placeholder for a single stat card while data is loading. */
function StatSkeleton() {
    return (
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 text-center">
            <div className="h-9 bg-gray-200 rounded-lg w-28 mx-auto animate-pulse" />
            <div className="h-3 bg-gray-100 rounded w-20 mx-auto mt-3 animate-pulse" />
        </div>
    )
}

function ProtocolStats() {
    const { stats, loading } = useProtocolStats()

    return (
        <section
            id="protocol-stats"
            className="py-24 px-6 bg-white border-t border-gray-100"
        >
            <div className="max-w-5xl mx-auto space-y-12">

                {/* Heading */}
                <div className="text-center max-w-2xl mx-auto">
                    <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                        Live on Arc testnet
                    </h2>
                    <p className="text-gray-500 mt-3 text-base leading-relaxed">
                        All figures sourced directly from on-chain events.
                    </p>
                </div>

                {/* Stat grid — skeleton while loading, live values once resolved */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {loading || !stats ? (
                        <>
                            <StatSkeleton />
                            <StatSkeleton />
                            <StatSkeleton />
                            <StatSkeleton />
                        </>
                    ) : (
                        <>
                            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 text-center">
                                <p className="text-3xl font-bold text-gray-900 tabular-nums leading-none">
                                    {fmtUsdc(stats.totalVolumeUsdc)}
                                </p>
                                <p className="text-xs text-gray-400 mt-2 font-medium uppercase tracking-wide">
                                    Total USDC processed
                                </p>
                            </div>

                            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 text-center">
                                <p className="text-3xl font-bold text-gray-900 tabular-nums leading-none">
                                    {fmtInt(stats.activeSubscriptions)}
                                </p>
                                <p className="text-xs text-gray-400 mt-2 font-medium uppercase tracking-wide">
                                    Active subscriptions
                                </p>
                            </div>

                            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 text-center">
                                <p className="text-3xl font-bold text-gray-900 tabular-nums leading-none">
                                    {fmtInt(stats.uniqueMerchants)}
                                </p>
                                <p className="text-xs text-gray-400 mt-2 font-medium uppercase tracking-wide">
                                    Total merchants
                                </p>
                            </div>

                            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 text-center">
                                <p className="text-3xl font-bold text-gray-900 tabular-nums leading-none">
                                    {fmtInt(stats.totalCharges)}
                                </p>
                                <p className="text-xs text-gray-400 mt-2 font-medium uppercase tracking-wide">
                                    Charges settled
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </section>
    )
}

function Pricing() {
    return (
        <section
            id="pricing"
            className="py-24 px-6 bg-gray-50 border-t border-gray-100"
        >
            <div className="max-w-3xl mx-auto space-y-10">

                {/* Heading */}
                <div className="text-center">
                    <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                        Simple, transparent pricing
                    </h2>
                    <p className="mt-4 text-lg text-gray-600 leading-relaxed">
                        3% protocol fee on every settled payment. No monthly charges,
                        no setup fees, no hidden costs.
                    </p>
                </div>

                {/* Keeper cost callout */}
                <div className="bg-white border border-gray-200 rounded-2xl px-8 py-6 space-y-3">
                    <p className="text-sm text-gray-700 leading-relaxed">
                        Keeper costs on Arc run at{' '}
                        <span className="font-semibold text-gray-900">~$0.001 per charge</span>.
                        At 10,000 subscribers, that's{' '}
                        <span className="font-semibold text-gray-900">$10/month</span>{' '}
                        in operational costs.
                    </p>
                    <a
                        href="/arc-economics"
                        className="inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                        See the full economics breakdown →
                    </a>
                </div>
            </div>
        </section>
    )
}

// ── CTA banner ────────────────────────────────────────────────────────────────

function CtaBanner() {
    return (
        <section
            id="cta"
            className="py-28 px-6 bg-gray-900"
        >
            <div className="max-w-2xl mx-auto text-center space-y-6">
                <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-[1.1]">
                    Ready to build?
                </h2>
                <p className="text-lg text-gray-400 leading-relaxed">
                    Set up your first plan in under 90 seconds.
                </p>
                <div className="pt-2 space-y-4">
                    <Link href="/onboarding">
                        <a className="inline-block px-8 py-3.5 bg-indigo-500 text-white text-sm font-bold rounded-xl hover:bg-indigo-400 active:bg-indigo-600 transition-colors shadow-lg shadow-indigo-900/40">
                            Get started
                        </a>
                    </Link>
                    <p className="text-xs text-gray-500 select-none">
                        Arc testnet · No real funds required
                    </p>
                </div>
            </div>
        </section>
    )
}

// ── Page footer ───────────────────────────────────────────────────────────────

function PageFooter() {
    return (
        <footer className="bg-white border-t border-gray-100">
            <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">

                {/* Built on Arc badge */}
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    Built on Arc
                </span>

                {/* Nav links */}
                <nav className="flex items-center gap-6 text-xs text-gray-400">
                    <a href="/docs"          className="hover:text-gray-700 transition-colors">Docs</a>
                    <a href="/arc-economics" className="hover:text-gray-700 transition-colors">Arc economics</a>
                    <a href="/stats"         className="hover:text-gray-700 transition-colors">Protocol stats</a>
                    <a href="/portal"        className="hover:text-gray-700 transition-colors">Subscriber portal</a>
                </nav>
            </div>
        </footer>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function LandingPage() {
    return (
        <div className="min-h-screen scroll-smooth">
            <TopNav />
            <Hero />
            <HowItWorks />
            <ProtocolStats />
            <Pricing />
            <CtaBanner />
            <PageFooter />
        </div>
    )
}
