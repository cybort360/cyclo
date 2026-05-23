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
            <div className="max-w-6xl mx-auto space-y-12">
                <div className="text-center max-w-2xl mx-auto">
                    <h2 className="text-3xl font-bold text-gray-900">Simple, transparent pricing</h2>
                    <p className="text-gray-500 mt-3 text-lg leading-relaxed">
                        {/* Pricing intro — TODO */}
                    </p>
                </div>

                {/* Pricing card — populate with real copy */}
                <div className="max-w-sm mx-auto bg-white border border-gray-100 rounded-2xl p-8 text-center space-y-4 shadow-sm">
                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Protocol fee</p>
                    <p className="text-5xl font-bold text-gray-900">3%</p>
                    <p className="text-sm text-gray-500 leading-relaxed">
                        {/* Fee description — TODO */}
                        Description placeholder.
                    </p>
                    <Link href="/dashboard">
                        <a className="block w-full mt-2 px-5 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
                            Get started →
                        </a>
                    </Link>
                </div>
            </div>
        </section>
    )
}

function CtaFooter() {
    return (
        <footer
            id="cta"
            className="py-24 px-6 bg-indigo-600 border-t border-indigo-700"
        >
            <div className="max-w-3xl mx-auto text-center space-y-6">
                <h2 className="text-3xl font-bold text-white">
                    {/* CTA headline — TODO */}
                    Ready to get started?
                </h2>
                <p className="text-indigo-200 text-lg leading-relaxed">
                    {/* CTA body — TODO */}
                    Description placeholder.
                </p>
                <Link href="/dashboard">
                    <a className="inline-block px-8 py-3.5 bg-white text-indigo-600 text-sm font-bold rounded-xl hover:bg-indigo-50 transition-colors shadow-sm">
                        Launch App →
                    </a>
                </Link>
            </div>

            {/* Bottom strip */}
            <div className="max-w-6xl mx-auto mt-20 pt-8 border-t border-indigo-500 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-indigo-300">
                <span>Cyclo · Arc Testnet · Chain ID 5042002</span>
                <div className="flex items-center gap-5">
                    <a href="/stats" className="hover:text-white transition-colors">Protocol stats</a>
                    <a href="/docs"  className="hover:text-white transition-colors">Docs</a>
                    <a href="/arc-economics" className="hover:text-white transition-colors">Arc economics</a>
                    <a href="/portal" className="hover:text-white transition-colors">Subscriber portal</a>
                </div>
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
            <CtaFooter />
        </div>
    )
}
