import { Link } from 'wouter'
import { useProtocolStats } from '../hooks/useProtocolStats'
import type { ProtocolStats } from '../hooks/useProtocolStats'

const REFRESH_INTERVAL_MS = 30_000

const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

const fmtInt = (n: number) => n.toLocaleString('en-US')

interface StatCardProps {
    label: string
    value: string
    sub?: string
}

function StatCard({ label, value, sub }: StatCardProps) {
    return (
        <div className="bg-white border rounded-2xl p-6">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
    )
}

export function StatsPage() {
    const { stats, loading, error, lastUpdated } = useProtocolStats({ refreshIntervalMs: REFRESH_INTERVAL_MS })

    return (
        <div className="min-h-screen bg-gray-50">

            {/* Header */}
            <header className="bg-white border-b">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
                            <span className="text-white text-xs font-bold">C</span>
                        </div>
                        <span className="font-semibold text-gray-900">Cyclo</span>
                        <span className="text-gray-300 ml-2 mr-1">·</span>
                        <span className="text-sm text-gray-500">Protocol Stats</span>
                    </div>
                    <Link href="/dashboard">
                        <a className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                            Open dashboard →
                        </a>
                    </Link>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

                {/* Page heading */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Protocol Statistics</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Live data from the Cyclo recurring billing protocol on Arc Testnet.
                        {lastUpdated && (
                            <span> Last updated {lastUpdated.toLocaleTimeString()}.</span>
                        )}
                    </p>
                </div>

                {error && (
                    <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        {error}
                    </div>
                )}

                {/* Stats grid */}
                {loading && !stats ? (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="bg-white border rounded-2xl p-6 animate-pulse">
                                <div className="h-3 bg-gray-200 rounded w-24 mb-4" />
                                <div className="h-8 bg-gray-200 rounded w-16" />
                            </div>
                        ))}
                    </div>
                ) : stats ? (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                        <StatCard
                            label="Total Volume"
                            value={fmt(stats.totalVolumeUsdc)}
                            sub="USDC charged on-chain"
                        />
                        <StatCard
                            label="Total Charges"
                            value={fmtInt(stats.totalCharges)}
                            sub="successful payments"
                        />
                        <StatCard
                            label="Active Subscribers"
                            value={fmtInt(stats.activeSubscriptions)}
                            sub={`of ${fmtInt(stats.totalSubscriptions)} total`}
                        />
                        <StatCard
                            label="Active Plans"
                            value={fmtInt(stats.activePlans)}
                            sub={`of ${fmtInt(stats.totalPlans)} total`}
                        />
                        <StatCard
                            label="Unique Merchants"
                            value={fmtInt(stats.uniqueMerchants)}
                            sub="wallet addresses"
                        />
                        <StatCard
                            label="Avg. Charge Size"
                            value={stats.totalCharges > 0
                                ? fmt(stats.totalVolumeUsdc / stats.totalCharges)
                                : '—'
                            }
                            sub="per successful payment"
                        />
                    </div>
                ) : null}

                {/* Footer */}
                <div className="border-t pt-6 flex items-center justify-between text-xs text-gray-400">
                    <span>Refreshes every 30 seconds</span>
                    <div className="flex items-center gap-4">
                        <a href="/arc-economics" className="hover:text-gray-600 transition-colors">
                            Why Arc?
                        </a>
                        <span>Arc Testnet · Chain ID 5042002</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
