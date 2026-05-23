/**
 * /arc-economics — public, read-only explainer page.
 * No wallet required. No sidebar.
 *
 * Makes the economic case for why keeper-driven recurring billing
 * only works cleanly on a chain where USDC is the native gas token.
 */
import { useState, useEffect, useRef, memo } from 'react'
import { usePublicClient } from 'wagmi'
import { Link } from 'wouter'
import { COMPOSABILITY_SOLIDITY_CODE } from '../constants/codeSnippets'
import { SUBSCRIPTION_MANAGER_ABI } from '../constants/abis'
import { CONTRACT_ADDRESS, DEPLOY_BLOCK } from '../constants/addresses'

// ── Calculator constants ──────────────────────────────────────────────────────

const NETWORKS_DATA = [
    { name: 'Ethereum', costPerCharge: 3.50,  costLabel: '$3.50 avg', isArc: false },
    { name: 'Polygon',  costPerCharge: 0.03,  costLabel: '$0.03 avg', isArc: false },
    { name: 'Arc',      costPerCharge: 0.001, costLabel: '$0.001',    isArc: true  },
] as const

const SLIDER_MIN          = 100
const SLIDER_MAX          = 1_000_000
const DEFAULT_SUBSCRIBERS = 10_000

/**
 * Formats a dollar cost value with tier-based precision:
 *   < $1      → 3 decimal places   e.g. "$0.001"
 *   $1–$999   → 2 decimal places   e.g. "$35.00"
 *   ≥ $1,000  → 0 decimal places, comma-separated   e.g. "$420,000"
 */
function fmtCost(value: number): string {
    if (value < 1)    return `$${value.toFixed(3)}`
    if (value < 1000) return `$${value.toFixed(2)}`
    return `$${Math.round(value).toLocaleString('en-US')}`
}

/**
 * Formats a percentage value:
 *   < 0.1%   → "<0.1"  (avoids showing "0.0")
 *   < 100%   → 1 decimal place
 *   ≥ 100%   → integer with commas  e.g. "3,503"
 */
function fmtPct(value: number): string {
    if (value < 0.1)  return '<0.1'
    if (value < 100)  return value.toFixed(1)
    return Math.round(value).toLocaleString('en-US')
}

// ── Live stats ────────────────────────────────────────────────────────────────

interface LiveStats {
    totalCharges:       number
    totalUsdcProcessed: number
    totalKeeperGasUsdc: number
}

type StatsState =
    | { status: 'loading' }
    | { status: 'success'; data: LiveStats }
    | { status: 'error' }

/**
 * Fetches three live figures from the SubscriptionManager contract on mount.
 * Uses the wagmi public client (read-only, no wallet required).
 *
 * Gas cost calculation: on Arc the native currency is USDC with 6 decimals.
 * gasUsed × effectiveGasPrice gives cost in micro-USDC; divide by 1e6 for USDC.
 * Only the last 50 unique batchCharge transactions are fetched to keep it fast.
 */
function useLiveStats(): StatsState {
    const [state, setState] = useState<StatsState>({ status: 'loading' })
    const publicClient = usePublicClient()

    useEffect(() => {
        if (!publicClient || !CONTRACT_ADDRESS) return

        async function load() {
            try {
                // ── 1. All PaymentCharged events — count + USDC sum ──────────
                const logs = await publicClient!.getContractEvents({
                    address:   CONTRACT_ADDRESS as `0x${string}`,
                    abi:       SUBSCRIPTION_MANAGER_ABI,
                    eventName: 'PaymentCharged',
                    fromBlock: DEPLOY_BLOCK,
                    toBlock:   'latest',
                })

                const totalCharges = logs.length

                const totalUsdcProcessed = logs.reduce((sum, log) => {
                    const { amount } = log.args as { amount: bigint }
                    return sum + Number(amount) / 1_000_000
                }, 0)

                // ── 2. Last 50 unique txs — gas cost ─────────────────────────
                // Deduplicate by txHash (batchCharge emits multiple events per tx).
                const seen = new Set<string>()
                const uniqueHashes: `0x${string}`[] = []
                for (const log of logs) {
                    const hash = log.transactionHash
                    if (hash && !seen.has(hash)) {
                        seen.add(hash)
                        uniqueHashes.push(hash as `0x${string}`)
                    }
                }
                const last50 = uniqueHashes.slice(-50)

                const receipts = await Promise.all(
                    last50.map(hash => publicClient!.getTransactionReceipt({ hash }))
                )

                const totalKeeperGasUsdc = receipts.reduce((sum, r) => {
                    // gasUsed × effectiveGasPrice → micro-USDC → ÷ 1e6 → USDC
                    return sum + Number(r.gasUsed) * Number(r.effectiveGasPrice) / 1_000_000
                }, 0)

                setState({ status: 'success', data: { totalCharges, totalUsdcProcessed, totalKeeperGasUsdc } })
            } catch {
                // Silently degrade — a stats fetch failure should not break the page.
                setState({ status: 'error' })
            }
        }

        void load()
    }, [publicClient]) // fetch once on mount; publicClient reference is stable

    return state
}

// ── LiveStatsBar ──────────────────────────────────────────────────────────────

/**
 * Three live protocol figures rendered as a horizontal stat strip.
 * Shows a skeleton while loading; disappears silently on error so the
 * rest of the page (which is static) is unaffected.
 */
function LiveStatsBar() {
    const stats = useLiveStats()

    if (stats.status === 'error') return null

    if (stats.status === 'loading') {
        return (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 animate-pulse">
                <div className="grid grid-cols-3 gap-6">
                    {[0, 1, 2].map(i => (
                        <div key={i} className={`space-y-2 ${i > 0 ? 'pl-6 border-l border-gray-100' : ''}`}>
                            <div className="h-3 w-28 bg-gray-200 rounded" />
                            <div className="h-7 w-20 bg-gray-200 rounded-lg" />
                            <div className="h-3 w-32 bg-gray-100 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    const { totalCharges, totalUsdcProcessed, totalKeeperGasUsdc } = stats.data

    const items = [
        {
            label: 'Total charges executed',
            value: totalCharges.toLocaleString('en-US'),
            sub:   'PaymentCharged events on-chain',
        },
        {
            label: 'Total USDC processed',
            value: fmtCost(totalUsdcProcessed),
            sub:   'sum of all subscription payments',
        },
        {
            label: 'Keeper gas spent',
            value: fmtCost(totalKeeperGasUsdc),
            sub:   'last 50 txs · paid in USDC on Arc',
        },
    ]

    return (
        <div className="bg-white border border-indigo-100 rounded-2xl p-6">
            <div className="grid grid-cols-3 gap-0 divide-x divide-gray-100">
                {items.map(({ label, value, sub }, i) => (
                    <div key={label} className={i > 0 ? 'pl-6' : 'pr-6'}>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide leading-none">
                            {label}
                        </p>
                        <p className="text-2xl font-bold text-gray-900 mt-2 tabular-nums">
                            {value}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{sub}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── CostCalculator ────────────────────────────────────────────────────────────

interface CostCalculatorProps {
    subscribers:         number
    onSubscribersChange: (n: number) => void
}

/**
 * Interactive keeper cost calculator.
 * Subscriber state is owned by ArcEconomicsPage so the fee margin section
 * below can read the same value without prop-drilling duplication.
 */
function CostCalculator({ subscribers, onSubscribersChange }: CostCalculatorProps) {
    function handleSlider(e: React.ChangeEvent<HTMLInputElement>) {
        onSubscribersChange(Number(e.target.value))
    }

    function handleNumberInput(e: React.ChangeEvent<HTMLInputElement>) {
        // Strip commas the user may have typed, then clamp to valid range.
        const raw = parseInt(e.target.value.replace(/,/g, ''), 10)
        if (!isNaN(raw)) {
            onSubscribersChange(Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, raw)))
        }
    }

    return (
        <div className="space-y-5">

            {/* Slider + number input */}
            <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-4">
                    <label htmlFor="sub-count" className="text-sm font-medium text-gray-700 shrink-0">
                        Number of subscribers
                    </label>
                    <input
                        id="sub-count-number"
                        type="number"
                        min={SLIDER_MIN}
                        max={SLIDER_MAX}
                        value={subscribers}
                        onChange={handleNumberInput}
                        className="w-32 text-right text-sm font-mono border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                </div>
                <input
                    id="sub-count"
                    type="range"
                    min={SLIDER_MIN}
                    max={SLIDER_MAX}
                    value={subscribers}
                    onChange={handleSlider}
                    className="w-full accent-indigo-600 cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-400 select-none">
                    <span>100</span>
                    <span className="font-medium text-gray-500">
                        {subscribers.toLocaleString('en-US')} subscribers
                    </span>
                    <span>1,000,000</span>
                </div>
            </div>

            {/* Live results table — same pattern as the comparison table above */}
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            {['Network', 'Cost per charge', 'Monthly keeper cost', 'Annual keeper cost'].map(h => (
                                <th
                                    key={h}
                                    className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide"
                                >
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {NETWORKS_DATA.map(({ name, costPerCharge, costLabel, isArc }) => {
                            const monthly = subscribers * costPerCharge
                            const annual  = monthly * 12
                            return (
                                <tr
                                    key={name}
                                    className={isArc ? 'bg-indigo-50/60' : 'hover:bg-gray-50/60'}
                                >
                                    <td className={`px-5 py-3.5 ${isArc ? 'font-semibold text-indigo-700' : 'font-medium text-gray-800'}`}>
                                        {name}
                                    </td>
                                    <td className={`px-5 py-3.5 ${isArc ? 'font-medium text-indigo-700' : 'text-gray-600'}`}>
                                        {costLabel}
                                    </td>
                                    <td className={`px-5 py-3.5 font-mono font-medium tabular-nums ${isArc ? 'text-indigo-700' : 'text-gray-700'}`}>
                                        {fmtCost(monthly)}
                                    </td>
                                    <td className={`px-5 py-3.5 font-mono font-medium tabular-nums ${isArc ? 'text-indigo-700' : 'text-gray-700'}`}>
                                        {fmtCost(annual)}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// ── FeeMarginSection ──────────────────────────────────────────────────────────

const DEFAULT_PLAN_PRICE     = 9.99
const ARC_COST_PER_CHARGE    = 0.001
const ETH_COST_PER_CHARGE    = 3.50
const PROTOCOL_FEE_RATE      = 0.03   // 3%

interface FeeMarginSectionProps {
    subscribers: number
}

interface StatCardProps {
    label:   string
    value:   string
    sub?:    string
    accent?: 'green' | 'red' | 'indigo' | 'default'
}

function StatCard({ label, value, sub, accent = 'default' }: StatCardProps) {
    const valueColor =
        accent === 'green'  ? 'text-green-600'  :
        accent === 'red'    ? 'text-red-600'    :
        accent === 'indigo' ? 'text-indigo-600' :
        'text-gray-900'

    return (
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide leading-none">
                {label}
            </p>
            <p className={`text-3xl font-bold mt-2 tabular-nums ${valueColor}`}>
                {value}
            </p>
            {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
    )
}

/**
 * Protocol fee margin section.
 * Reads subscriber count from the parent (shared with CostCalculator) and
 * owns its own plan price input. All figures are monthly.
 */
function FeeMarginSection({ subscribers }: FeeMarginSectionProps) {
    const [planPrice, setPlanPrice] = useState(DEFAULT_PLAN_PRICE)

    function handlePlanPrice(e: React.ChangeEvent<HTMLInputElement>) {
        const raw = parseFloat(e.target.value)
        if (!isNaN(raw) && raw > 0) setPlanPrice(raw)
    }

    // ── Arithmetic ────────────────────────────────────────────────────────
    const grossRevenue  = subscribers * planPrice * PROTOCOL_FEE_RATE
    const arcKeeperCost = subscribers * ARC_COST_PER_CHARGE
    const ethKeeperCost = subscribers * ETH_COST_PER_CHARGE
    const netMargin     = grossRevenue - arcKeeperCost
    const netMarginPct  = grossRevenue > 0 ? (netMargin  / grossRevenue) * 100 : 0
    const ethPct        = grossRevenue > 0 ? (ethKeeperCost / grossRevenue) * 100 : 0
    const arcPct        = grossRevenue > 0 ? (arcKeeperCost / grossRevenue) * 100 : 0

    return (
        <div className="space-y-5">

            {/* Plan price input */}
            <div className="bg-white border border-gray-100 rounded-xl p-5">
                <div className="flex items-center justify-between gap-4">
                    <label htmlFor="plan-price" className="text-sm font-medium text-gray-700">
                        Average plan price (USDC)
                    </label>
                    <div className="flex items-center gap-1.5">
                        <span className="text-sm text-gray-400">$</span>
                        <input
                            id="plan-price"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={planPrice}
                            onChange={handlePlanPrice}
                            className="w-24 text-right text-sm font-mono border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>
                </div>
            </div>

            {/* Stat cards — 2 × 2 grid */}
            <div className="grid grid-cols-2 gap-4">
                <StatCard
                    label="Gross protocol revenue"
                    value={fmtCost(grossRevenue)}
                    sub="subscribers × price × 3% fee / month"
                />
                <StatCard
                    label="Keeper cost on Arc"
                    value={fmtCost(arcKeeperCost)}
                    sub="subscribers × $0.001 / month"
                    accent="indigo"
                />
                <StatCard
                    label="Net margin"
                    value={fmtCost(netMargin)}
                    sub="gross revenue − Arc keeper cost"
                    accent={netMargin >= 0 ? 'green' : 'red'}
                />
                <StatCard
                    label="Net margin %"
                    value={`${fmtPct(netMarginPct)}%`}
                    sub="net margin / gross revenue"
                    accent={netMarginPct >= 0 ? 'green' : 'red'}
                />
            </div>

            {/* Dynamic copy line */}
            <p className="text-sm text-gray-500 leading-relaxed">
                On Ethereum, keeper costs would consume{' '}
                <span className="font-semibold text-gray-700">{fmtPct(ethPct)}%</span>{' '}
                of protocol revenue at this scale. On Arc, they consume less than{' '}
                <span className="font-semibold text-indigo-600">{fmtPct(arcPct)}%</span>.
            </p>
        </div>
    )
}

// ── Composability section ─────────────────────────────────────────────────────

/** Alias so the rest of this file can keep its existing local name. */
const SOLIDITY_CODE = COMPOSABILITY_SOLIDITY_CODE

const HLJS_VERSION    = '11.9.0'
const HLJS_BASE       = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/${HLJS_VERSION}`
const HLJS_CORE_SRC   = `${HLJS_BASE}/highlight.min.js`
const HLJS_SOLID_SRC  = `${HLJS_BASE}/languages/solidity.min.js`
const HLJS_THEME_HREF = `${HLJS_BASE}/styles/github-dark.min.css`
const HLJS_THEME_ID   = 'hljs-github-dark-css'

/** Injects a `<script>` tag and resolves when it loads. No-ops if already present. */
function loadScript(src: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
        const el = Object.assign(document.createElement('script'), { src })
        el.onload  = () => resolve()
        el.onerror = () => reject(new Error(`Failed to load script: ${src}`))
        document.head.appendChild(el)
    })
}

/**
 * Renders a Solidity snippet with highlight.js syntax highlighting.
 * Loads hljs core + Solidity language from cdnjs on first mount, then calls
 * highlightElement() directly on the <code> ref.
 *
 * Wrapped in React.memo so parent re-renders (e.g. the subscriber slider) do
 * not reconcile this component and overwrite the DOM that hljs has modified.
 */
const SolidityCodeBlock = memo(function SolidityCodeBlock({ code }: { code: string }) {
    const codeRef    = useRef<HTMLElement>(null)
    const mountedRef = useRef(true)

    useEffect(() => {
        mountedRef.current = true

        if (!document.getElementById(HLJS_THEME_ID)) {
            const link = Object.assign(document.createElement('link'), {
                id:   HLJS_THEME_ID,
                rel:  'stylesheet',
                href: HLJS_THEME_HREF,
            })
            document.head.appendChild(link)
        }

        async function applyHighlight() {
            try {
                await loadScript(HLJS_CORE_SRC)
                await loadScript(HLJS_SOLID_SRC)
                if (!mountedRef.current || !codeRef.current) return
                const hljs = (window as unknown as { hljs?: { highlightElement(el: Element): void } }).hljs
                if (!hljs) return
                hljs.highlightElement(codeRef.current)
            } catch {
                // CDN unavailable — plain-text fallback remains in place.
            }
        }

        void applyHighlight()
        return () => { mountedRef.current = false }
    }, []) // intentionally empty — `code` is a module-level constant

    return (
        <div className="rounded-xl overflow-hidden border border-slate-700 shadow-lg">
            {/* Fake window chrome */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 border-b border-slate-700">
                <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-500/70"    aria-hidden="true" />
                    <span className="w-3 h-3 rounded-full bg-yellow-500/70" aria-hidden="true" />
                    <span className="w-3 h-3 rounded-full bg-green-500/70"  aria-hidden="true" />
                </div>
                <span className="ml-2 text-xs text-slate-400 font-mono">MyProtocol.sol</span>
            </div>
            <pre className="p-5 overflow-x-auto text-sm leading-relaxed bg-[#0d1117] m-0">
                <code ref={codeRef} className="language-solidity text-slate-300 whitespace-pre">
                    {code}
                </code>
            </pre>
        </div>
    )
})

interface UseCaseCardProps {
    icon:        string
    title:       string
    description: string
}

function UseCaseCard({ icon, title, description }: UseCaseCardProps) {
    return (
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-2">
            <span className="text-2xl leading-none" aria-hidden="true">{icon}</span>
            <p className="font-semibold text-gray-900 text-sm mt-3">{title}</p>
            <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
        </div>
    )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PageHeader() {
    return (
        <header className="bg-white border-b">
            <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
                        <span className="text-white text-xs font-bold">C</span>
                    </div>
                    <span className="font-semibold text-gray-900">Cyclo</span>
                    <span className="text-gray-300 mx-1.5">·</span>
                    <span className="text-sm text-gray-500">Arc Economics</span>
                </div>
                <Link href="/dashboard">
                    <a className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                        Open dashboard →
                    </a>
                </Link>
            </div>
        </header>
    )
}

interface SectionProps {
    title:    string
    children: React.ReactNode
}

function Section({ title, children }: SectionProps) {
    return (
        <section className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 pb-3 border-b border-gray-100">
                {title}
            </h2>
            {children}
        </section>
    )
}

interface CompareRowProps {
    label:    string
    standard: string
    arc:      string
    arcGood?: boolean
}

function CompareRow({ label, standard, arc, arcGood = true }: CompareRowProps) {
    return (
        <div className="grid grid-cols-3 gap-4 py-3 border-b border-gray-50 last:border-0 text-sm">
            <span className="text-gray-500 font-medium">{label}</span>
            <span className="text-gray-700">{standard}</span>
            <span className={arcGood ? 'text-indigo-700 font-medium' : 'text-gray-700'}>{arc}</span>
        </div>
    )
}

interface FormulaProps {
    label:  string
    value:  string
    sub?:   string
    accent?: boolean
}

function FormulaRow({ label, value, sub, accent }: FormulaProps) {
    return (
        <div className={`flex items-center justify-between py-2.5 px-4 rounded-lg ${accent ? 'bg-indigo-50' : ''}`}>
            <span className="text-sm text-gray-600">{label}</span>
            <div className="text-right">
                <span className={`text-sm font-mono font-semibold ${accent ? 'text-indigo-700' : 'text-gray-800'}`}>
                    {value}
                </span>
                {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ArcEconomicsPage() {
    // Lifted here so both the cost calculator and the fee margin section share it.
    const [subscribers, setSubscribers] = useState(DEFAULT_SUBSCRIBERS)

    return (
        <div className="min-h-screen bg-gray-50">

            <PageHeader />

            <div className="max-w-3xl mx-auto px-6 py-12 space-y-12">

                {/* Hero */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                        Why Cyclo only works on Arc
                    </h1>
                    <p className="text-lg text-indigo-600 font-medium">
                        The keeper economics proof
                    </p>
                    <p className="text-gray-500 text-sm max-w-xl leading-relaxed pt-1">
                        Recurring on-chain billing requires someone to push transactions on a schedule.
                        On most blockchains, the economics of that role are broken. Arc fixes it.
                    </p>
                </div>

                {/* Live protocol stats — fetched on mount, no wallet required */}
                <LiveStatsBar />

                {/* Section 1: What is a keeper */}
                <Section title="What is a keeper?">
                    <p className="text-gray-600 leading-relaxed">
                        Blockchains don't have timers. Smart contracts only execute when called
                        externally — they cannot wake themselves up on a schedule. This means
                        recurring billing requires an off-chain agent called a <strong className="text-gray-800">keeper</strong>:
                        a bot that monitors the contract, identifies due payments, and calls{' '}
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">batchCharge()</code> on
                        the correct subscriber addresses each billing cycle.
                    </p>
                    <p className="text-gray-600 leading-relaxed">
                        For a recurring billing protocol to be credible, the keeper must run
                        reliably. That means the economics of operating it must be positive —
                        the cost of sending each transaction must be covered by the revenue
                        it produces. This sounds obvious. On standard EVM chains, it isn't.
                    </p>
                </Section>

                {/* Section 2: The problem */}
                <Section title="The gas problem on standard EVM">
                    <p className="text-gray-600 leading-relaxed">
                        On Ethereum, Arbitrum, Base, and most other EVM chains, gas is
                        denominated in the chain's native token (ETH). Subscription revenue
                        on Cyclo is denominated in USDC. These are different assets with
                        a floating exchange rate between them.
                    </p>
                    <p className="text-gray-600 leading-relaxed">
                        This creates a structural problem for keeper economics. The keeper's
                        cost (gas in ETH) and revenue (protocol fees in USDC) are priced
                        in different units. To evaluate whether a charge is worth submitting,
                        the keeper needs a live ETH/USDC price. To remain profitable across
                        market conditions, it needs that price to stay above a threshold.
                    </p>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-5 space-y-2">
                        <p className="text-sm font-semibold text-amber-800">The compounding risks</p>
                        <ul className="text-sm text-amber-700 space-y-1.5 leading-relaxed">
                            <li className="flex items-start gap-2">
                                <span className="shrink-0 mt-0.5">·</span>
                                <span><strong>Exchange rate risk:</strong> ETH appreciates, gas costs (in USDC terms) spike, small-value subscriptions become unprofitable to charge.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="shrink-0 mt-0.5">·</span>
                                <span><strong>Oracle dependency:</strong> The keeper must trust an external price feed. A stale or manipulated oracle produces wrong profitability signals.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="shrink-0 mt-0.5">·</span>
                                <span><strong>Congestion spikes:</strong> Gas price volatility on-chain can make entire batches uneconomic during high-traffic events, causing missed billing cycles.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="shrink-0 mt-0.5">·</span>
                                <span><strong>Inventory management:</strong> The keeper wallet must hold ETH for gas and receive USDC for fees — requiring ongoing rebalancing.</span>
                            </li>
                        </ul>
                    </div>

                    {/* Network comparison table */}
                    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    {['Network', 'Gas token', 'Est. cost per charge', 'Notes'].map(h => (
                                        <th
                                            key={h}
                                            className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide"
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                <tr className="hover:bg-gray-50/60">
                                    <td className="px-5 py-3.5 font-medium text-gray-800">Ethereum</td>
                                    <td className="px-5 py-3.5 text-gray-600">ETH</td>
                                    <td className="px-5 py-3.5 text-gray-600">$2.00 – $5.00</td>
                                    <td className="px-5 py-3.5 text-gray-500 text-xs">Volatile, spikes during congestion</td>
                                </tr>
                                <tr className="hover:bg-gray-50/60">
                                    <td className="px-5 py-3.5 font-medium text-gray-800">Polygon</td>
                                    <td className="px-5 py-3.5 text-gray-600">MATIC</td>
                                    <td className="px-5 py-3.5 text-gray-600">$0.01 – $0.05</td>
                                    <td className="px-5 py-3.5 text-gray-500 text-xs">Cheap but ETH-denominated risk</td>
                                </tr>
                                {/* Arc row — highlighted */}
                                <tr className="bg-indigo-50/60">
                                    <td className="px-5 py-3.5 font-semibold text-indigo-700">
                                        Arc
                                    </td>
                                    <td className="px-5 py-3.5 font-medium text-indigo-700">USDC</td>
                                    <td className="px-5 py-3.5 font-medium text-indigo-700">~$0.001</td>
                                    <td className="px-5 py-3.5 text-indigo-600 text-xs">Stable, predictable, no FX risk</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed">
                        Arc uses USDC as its gas token, making keeper costs stable, predictable,
                        and denominated in the same asset as the protocol fee.
                    </p>
                </Section>

                {/* Calculator section */}
                <Section title="Keeper cost calculator">
                    <p className="text-gray-600 leading-relaxed">
                        Adjust the subscriber count to see how keeper operating costs
                        compare across networks at scale. Monthly cost assumes one
                        charge per subscriber per billing cycle.
                    </p>
                    <CostCalculator
                        subscribers={subscribers}
                        onSubscribersChange={setSubscribers}
                    />
                </Section>

                {/* Protocol fee margin */}
                <Section title="Protocol fee margin">
                    <p className="text-gray-600 leading-relaxed">
                        With the same subscriber count, see how the 3% protocol fee
                        translates into net margin once Arc keeper costs are deducted.
                        Adjust the average plan price to model different pricing tiers.
                    </p>
                    <FeeMarginSection subscribers={subscribers} />
                </Section>

                {/* Section 3: Arc solution */}
                <Section title="Arc eliminates the denominator problem">
                    <p className="text-gray-600 leading-relaxed">
                        Arc uses <strong className="text-gray-800">USDC as its native gas token</strong>.
                        There is no ETH. Gas is priced, paid, and settled in the same
                        asset as subscription revenue. This collapses the two-asset problem
                        into a single-asset identity.
                    </p>
                    <p className="text-gray-600 leading-relaxed">
                        The keeper's profit calculation becomes pure arithmetic with no
                        oracle, no exchange rate, and no multi-asset inventory:
                    </p>

                    {/* Profit formula */}
                    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                Keeper profit per batchCharge call — Arc
                            </p>
                        </div>
                        <div className="p-2 space-y-1">
                            <FormulaRow
                                label="Subscriptions in batch"
                                value="N"
                            />
                            <FormulaRow
                                label="Protocol fee per subscription"
                                value="price × 3%"
                                sub="collected in USDC"
                            />
                            <FormulaRow
                                label="Total fees collected"
                                value="N × price × 0.03"
                                sub="in USDC"
                            />
                            <FormulaRow
                                label="Gas cost for batchCharge(N)"
                                value="~constant USDC"
                                sub="no exchange rate — same asset"
                            />
                            <FormulaRow
                                label="Net keeper profit"
                                value="(N × price × 0.03) − gas"
                                sub="fully determined before submitting"
                                accent
                            />
                        </div>
                    </div>

                    <p className="text-gray-600 leading-relaxed">
                        Because gas and fees share the same unit, the keeper can calculate
                        exact profitability before submitting any transaction. There is no
                        market risk between the moment of calculation and the moment of
                        execution. The pre-flight check in the Cyclo contract —{' '}
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">checkPreFlight()</code> —
                        is therefore a complete profitability signal, not an approximation.
                    </p>
                </Section>

                {/* Section 4: Comparison table */}
                <Section title="Side-by-side comparison">
                    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                        {/* Header row */}
                        <div className="grid grid-cols-3 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-100">
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                Property
                            </span>
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                Standard EVM (ETH gas)
                            </span>
                            <span className="text-xs font-semibold text-indigo-500 uppercase tracking-wide">
                                Arc (USDC gas)
                            </span>
                        </div>
                        <div className="px-4">
                            <CompareRow
                                label="Gas token"
                                standard="ETH (volatile)"
                                arc="USDC (stable)"
                            />
                            <CompareRow
                                label="Revenue token"
                                standard="USDC"
                                arc="USDC"
                                arcGood={false}
                            />
                            <CompareRow
                                label="Profit calculation"
                                standard="Requires ETH/USDC oracle"
                                arc="Simple subtraction"
                            />
                            <CompareRow
                                label="Exchange rate risk"
                                standard="Yes — ETH price swings"
                                arc="None"
                            />
                            <CompareRow
                                label="Oracle dependency"
                                standard="Yes"
                                arc="No"
                            />
                            <CompareRow
                                label="Minimum viable subscription price"
                                standard="Float — depends on ETH/USDC"
                                arc="Fixed — gas cost × 100"
                            />
                            <CompareRow
                                label="Keeper wallet complexity"
                                standard="Two-asset (ETH + USDC)"
                                arc="Single-asset (USDC)"
                            />
                            <CompareRow
                                label="Missed cycles on ETH spike"
                                standard="Yes — batches become uneconomic"
                                arc="No — gas priced in same asset"
                            />
                        </div>
                    </div>
                </Section>

                {/* Section 5: Concrete example */}
                <Section title="A concrete example">
                    <p className="text-gray-600 leading-relaxed">
                        Consider a merchant offering a $9.99/month plan with 50 active subscribers.
                        The keeper batches all 50 into a single{' '}
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">batchCharge()</code> call.
                    </p>

                    <div className="grid sm:grid-cols-2 gap-4">
                        {/* Standard EVM */}
                        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
                                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                                    Ethereum (ETH gas)
                                </p>
                            </div>
                            <div className="p-3 space-y-0.5">
                                <FormulaRow label="Fees collected" value="$14.985" sub="50 × $9.99 × 3%" />
                                <FormulaRow label="Gas cost" value="~0.003 ETH" sub="at 20 gwei, ~150k units" />
                                <FormulaRow label="ETH/USDC rate" value="needs oracle" sub="$1,500–$4,000 range" />
                                <FormulaRow label="Gas in USD" value="$4.50–$12.00" sub="depends on ETH price" />
                                <FormulaRow
                                    label="Net profit range"
                                    value="+$2.99 to +$10.49"
                                    sub="range depends on ETH price"
                                    accent
                                />
                            </div>
                        </div>

                        {/* Arc */}
                        <div className="bg-white border border-indigo-100 rounded-xl overflow-hidden">
                            <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
                                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
                                    Arc (USDC gas)
                                </p>
                            </div>
                            <div className="p-3 space-y-0.5">
                                <FormulaRow label="Fees collected" value="$14.985 USDC" sub="50 × $9.99 × 3%" />
                                <FormulaRow label="Gas cost" value="~$0.001 USDC" sub="same asset, no oracle" />
                                <FormulaRow label="Exchange rate" value="n/a" sub="USDC = USDC" />
                                <FormulaRow label="Gas in USD" value="$0.001" sub="stable, predictable" />
                                <FormulaRow
                                    label="Net profit"
                                    value="+$14.984 USDC"
                                    sub="deterministic"
                                    accent
                                />
                            </div>
                        </div>
                    </div>

                    <p className="text-sm text-gray-500 leading-relaxed">
                        The Ethereum scenario is not hypothetical. During ETH price surges in 2021
                        and 2023, keeper networks on standard EVM chains routinely stopped processing
                        small-value transactions because the gas cost exceeded the incentive. Cyclo's
                        keeper has no such failure mode on Arc.
                    </p>
                </Section>

                {/* Section 6: Implication */}
                <Section title="What this means for Cyclo">
                    <p className="text-gray-600 leading-relaxed">
                        The choice to build on Arc is not cosmetic. Every design decision in Cyclo
                        assumes a single-asset environment:
                    </p>
                    <ul className="space-y-3">
                        {[
                            {
                                title: 'No price oracles in the contract',
                                body:  'The SubscriptionManager contract has zero oracle dependencies. All amounts are USDC by construction. On a standard chain this would be a liability; on Arc it\'s correct by design.',
                            },
                            {
                                title: 'Pre-flight checks are exact',
                                body:  'checkPreFlight() returns a binary ready/not-ready signal based purely on USDC balance and allowance. On Arc, this is a complete decision — the keeper never needs to cross-reference an external price to confirm profitability.',
                            },
                            {
                                title: 'The 3% fee is always viable',
                                body:  'The protocol fee is fixed at 3% of the subscription price. On Arc, this will always exceed gas cost for any subscription priced above approximately $0.04 USDC. On Ethereum, the break-even price floats with ETH.',
                            },
                            {
                                title: 'Single-asset keeper wallet',
                                body:  'The keeper holds only USDC. It pays gas in USDC, receives fees in USDC, and never needs to rebalance between assets. This simplifies operations and eliminates treasury management risk.',
                            },
                        ].map(({ title, body }) => (
                            <li key={title} className="flex items-start gap-3">
                                <span className="shrink-0 mt-1 w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center">
                                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full block" />
                                </span>
                                <div>
                                    <p className="text-sm font-semibold text-gray-800">{title}</p>
                                    <p className="text-sm text-gray-500 leading-relaxed mt-0.5">{body}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </Section>

                {/* Section 7: Built for composability */}
                <Section title="Built for composability">
                    <p className="text-gray-600 leading-relaxed">
                        Because every active Cyclo subscription mints a soulbound token to the
                        subscriber's wallet, any smart contract on Arc can verify access with a
                        single function call — no API key, no off-chain dependency, no Cyclo
                        integration required.
                    </p>

                    <SolidityCodeBlock code={SOLIDITY_CODE} />

                    <div className="grid grid-cols-3 gap-4">
                        <UseCaseCard
                            icon="📈"
                            title="DeFi Protocol"
                            description="Gate yield strategies to paying subscribers"
                        />
                        <UseCaseCard
                            icon="🖼️"
                            title="NFT Project"
                            description="Reserve mints for active plan holders"
                        />
                        <UseCaseCard
                            icon="🏛️"
                            title="DAO"
                            description="Weight voting power by subscription tier"
                        />
                    </div>
                </Section>

                {/* Footer */}
                <div className="border-t pt-6 flex items-center justify-between text-xs text-gray-400">
                    <span>Cyclo · Arc Testnet · Chain ID 5042002</span>
                    <div className="flex items-center gap-4">
                        <a href="/stats" className="hover:text-gray-600 transition-colors">Protocol stats</a>
                        <a href="/docs"  className="hover:text-gray-600 transition-colors">Docs</a>
                        <Link href="/dashboard">
                            <a className="hover:text-gray-600 transition-colors">Dashboard</a>
                        </Link>
                    </div>
                </div>

            </div>
        </div>
    )
}
