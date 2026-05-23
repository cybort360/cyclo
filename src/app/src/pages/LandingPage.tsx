/**
 * Public landing page — rendered at /.
 * No wallet required. Sections are scaffolded and ready for content;
 * each has a stable id for smooth-scroll anchors.
 *
 * Layout: full-width, no sidebar, no dashboard chrome.
 * Sticky top nav with logo left, "Launch App" CTA right.
 */
import { Link } from 'wouter'

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
            className="min-h-[80vh] flex flex-col items-center justify-center text-center px-6 py-24 bg-white"
        >
            {/* Placeholder content — replace with real copy */}
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-full text-xs font-medium text-indigo-600">
                    On-chain recurring billing · Arc Testnet
                </div>
                <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 leading-tight tracking-tight">
                    {/* Hero headline — TODO */}
                    Headline goes here
                </h1>
                <p className="text-xl text-gray-500 max-w-xl mx-auto leading-relaxed">
                    {/* Sub-headline — TODO */}
                    Sub-headline goes here.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <Link href="/dashboard">
                        <a className="px-6 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
                            Launch App →
                        </a>
                    </Link>
                    <a
                        href="#how-it-works"
                        className="px-6 py-3 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                    >
                        How it works
                    </a>
                </div>
            </div>
        </section>
    )
}

function HowItWorks() {
    return (
        <section
            id="how-it-works"
            className="py-24 px-6 bg-gray-50 border-t border-gray-100"
        >
            <div className="max-w-6xl mx-auto space-y-12">
                <div className="text-center max-w-2xl mx-auto">
                    <h2 className="text-3xl font-bold text-gray-900">How it works</h2>
                    <p className="text-gray-500 mt-3 text-lg leading-relaxed">
                        {/* Section intro — TODO */}
                    </p>
                </div>

                {/* Step cards — populate with real content */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {[
                        { step: '01', title: 'Step one', body: 'Description placeholder.' },
                        { step: '02', title: 'Step two', body: 'Description placeholder.' },
                        { step: '03', title: 'Step three', body: 'Description placeholder.' },
                    ].map(({ step, title, body }) => (
                        <div key={step} className="bg-white border border-gray-100 rounded-2xl p-6 space-y-3">
                            <span className="text-xs font-bold text-indigo-500 tracking-widest uppercase">
                                {step}
                            </span>
                            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                            <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

function ProtocolStats() {
    return (
        <section
            id="protocol-stats"
            className="py-24 px-6 bg-white border-t border-gray-100"
        >
            <div className="max-w-6xl mx-auto space-y-12">
                <div className="text-center max-w-2xl mx-auto">
                    <h2 className="text-3xl font-bold text-gray-900">Protocol stats</h2>
                    <p className="text-gray-500 mt-3 text-lg leading-relaxed">
                        {/* Section intro — TODO */}
                    </p>
                </div>

                {/* Stat cards — wire to live on-chain data */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'Active plans',       value: '—' },
                        { label: 'Active subscribers', value: '—' },
                        { label: 'Volume (USDC)',      value: '—' },
                        { label: 'Fees collected',     value: '—' },
                    ].map(({ label, value }) => (
                        <div key={label} className="bg-gray-50 border border-gray-100 rounded-2xl p-6 text-center">
                            <p className="text-3xl font-bold text-gray-900 tabular-nums">{value}</p>
                            <p className="text-xs text-gray-400 mt-1.5 font-medium uppercase tracking-wide">
                                {label}
                            </p>
                        </div>
                    ))}
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
