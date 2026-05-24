/**
 * Public landing page — rendered at /.
 * No wallet required. Sections are scaffolded and ready for content;
 * each has a stable id for smooth-scroll anchors.
 *
 * Layout: full-width, no sidebar, no dashboard chrome.
 * Sticky top nav with logo left, "Launch App" CTA right.
 */
import { useProtocolStats } from '../hooks/useProtocolStats'
import { LandingNav } from '../components/LandingNav'
import { HeroSection } from '../components/HeroSection'
import { HowItWorksSection } from '../components/HowItWorksSection'
import { FeaturesSection } from '../components/FeaturesSection'
import { EconomicsSection } from '../components/EconomicsSection'
import { DeveloperSection } from '../components/DeveloperSection'
import { CtaFooter } from '../components/CtaFooter'
import '../styles/landing-tokens.css'

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

                <div className="text-center max-w-2xl mx-auto">
                    <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                        Live on Arc testnet
                    </h2>
                    <p className="text-gray-500 mt-3 text-base leading-relaxed">
                        All figures sourced directly from on-chain events.
                    </p>
                </div>

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

                <div className="text-center">
                    <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                        Simple, transparent pricing
                    </h2>
                    <p className="mt-4 text-lg text-gray-600 leading-relaxed">
                        3% protocol fee on every settled payment. No monthly charges,
                        no setup fees, no hidden costs.
                    </p>
                </div>

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

// ── Page ──────────────────────────────────────────────────────────────────────

export function LandingPage() {
    return (
        <div className="lp-root">
            <LandingNav />
            <HeroSection />
            <HowItWorksSection />
            <FeaturesSection />
            <ProtocolStats />
            <Pricing />
            <EconomicsSection />
            <DeveloperSection />
            <CtaFooter />
        </div>
    )
}
