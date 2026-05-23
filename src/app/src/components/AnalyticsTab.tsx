/**
 * Merchant analytics — KPI cards, revenue-over-time chart, per-plan breakdown.
 * Reads on-chain events to compute MRR, total revenue, and active subscriber counts.
 *
 * Socket.io integration:
 *   'payment.charged' events patch local state in real time without triggering
 *   a full refetch. Two counters are maintained:
 *     - liveChargesCount  — number of charges received since page load
 *     - liveRevenueToday  — USDC sum of those charges
 *   The revenue chart's today bar is updated inline from liveRevenueToday.
 */
import { useState, useEffect, useMemo } from 'react'
import { useAccount } from 'wagmi'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer,
} from 'recharts'
import { useAnalytics } from '../hooks/useAnalytics'
import { useSocket } from '../hooks/useSocket'
import type { DailyRevenue } from '../hooks/useAnalytics'
import { EmptyState } from './EmptyState'

const ANALYTICS_EMPTY_ICON = (
    <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center">
        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24"
             stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 3v18h18" />
            <path strokeLinecap="round" strokeLinejoin="round"
                d="M7 16l4-5 4 3 4-6" />
        </svg>
    </div>
)

const card: React.CSSProperties = {
    border: '1px solid #e5e4e7', borderRadius: '12px', padding: '20px',
    background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
}
const liveCard: React.CSSProperties = {
    ...card,
    border: '1px solid #c7d2fe',
    background: 'rgba(238,242,255,0.4)',
}
const thStyle: React.CSSProperties = {
    textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid #e5e4e7',
    fontWeight: 600, fontSize: '13px', color: '#6b6375',
}
const tdStyle: React.CSSProperties = {
    padding: '10px 16px', borderBottom: '1px solid #f4f3f6', fontSize: '14px',
}

function fmt(n: number): string {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}

function todayDateString(): string {
    return new Date().toISOString().split('T')[0]
}

/**
 * Merges a live USDC delta into an existing dailyRevenue array without mutating it.
 * If today already has an entry, its revenue is incremented.
 * If not, a new entry for today is appended.
 */
function mergeRevenueToday(base: DailyRevenue[], liveAmount: number): DailyRevenue[] {
    if (liveAmount === 0) return base
    const today = todayDateString()
    const idx   = base.findIndex(d => d.date === today)
    if (idx >= 0) {
        return base.map((d, i) => i === idx ? { ...d, revenue: d.revenue + liveAmount } : d)
    }
    return [...base, { date: today, revenue: liveAmount }]
}

export function AnalyticsTab() {
    const { address }         = useAccount()
    const { data, isLoading } = useAnalytics()
    const { onPaymentCharged } = useSocket()

    // Number of charges received via socket since this page was mounted.
    const [liveChargesCount, setLiveChargesCount] = useState(0)
    // Cumulative USDC received via socket since mount — patched into Total Revenue
    // and today's chart bar in real time.
    const [liveRevenueToday, setLiveRevenueToday] = useState(0)

    useEffect(() => {
        return onPaymentCharged((payload) => {
            setLiveChargesCount(c => c + 1)
            setLiveRevenueToday(r => r + parseFloat(payload.amount))
        })
    }, [onPaymentCharged])

    // Chart data with today's live revenue merged in — recomputed only when either
    // the fetched daily data or the live delta changes.
    const chartData: DailyRevenue[] = useMemo(
        () => mergeRevenueToday(data?.dailyRevenue ?? [], liveRevenueToday),
        [data?.dailyRevenue, liveRevenueToday]
    )

    if (!address) {
        return <p style={{ color: '#6b6375', marginTop: '32px' }}>Connect your wallet to view analytics.</p>
    }
    if (isLoading) {
        return <p style={{ color: '#6b6375', marginTop: '32px' }}>Loading analytics…</p>
    }

    // No plans + no live charges = merchant has never had any activity.
    // Show the empty state instead of a dashboard full of zeroes.
    if ((data?.plans.length ?? 0) === 0 && liveChargesCount === 0) {
        return (
            <EmptyState
                icon={ANALYTICS_EMPTY_ICON}
                heading="No data yet"
                subtext="Analytics will appear here once your first payment is settled. Come back after your first billing cycle."
            />
        )
    }

    const kpis = [
        {
            label: 'Monthly Recurring Revenue',
            value: fmt(data?.mrr ?? 0),
            live:  false,
        },
        {
            // Patch: add live socket revenue on top of the fetched all-time total.
            // The 30-second refetch will naturally absorb the delta into the base figure.
            label: 'Total Revenue',
            value: fmt((data?.totalRevenue ?? 0) + liveRevenueToday),
            live:  false,
        },
        {
            label: 'Active Subscribers',
            value: String(data?.activeSubscribers ?? 0),
            live:  false,
        },
        {
            label: 'Charges Today',
            value: String(liveChargesCount),
            live:  true,
        },
    ]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', marginTop: '8px' }}>

            {/* KPI cards — 4-column grid; last card is the live socket counter */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                {kpis.map(({ label, value, live }) => (
                    <div key={label} style={live ? liveCard : card}>
                        <p style={{ fontSize: '13px', color: live ? '#6366f1' : '#6b6375', margin: '0 0 6px' }}>
                            {label}
                        </p>
                        <p style={{ fontSize: '24px', fontWeight: 600, margin: 0, color: live ? '#4f46e5' : 'inherit' }}>
                            {value}
                        </p>
                    </div>
                ))}
            </div>

            {/* Revenue over time — today's bar is patched in real time by liveRevenueToday */}
            {chartData.length > 0 && (
                <div style={card}>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: '#374151', margin: '0 0 16px' }}>
                        Revenue over time
                    </p>
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                            <Tooltip formatter={(v: number) => fmt(v)} />
                            <Area
                                type="monotone"
                                dataKey="revenue"
                                stroke="#6366f1"
                                fill="url(#rev)"
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Per-plan breakdown */}
            {(data?.plans.length ?? 0) > 0 && (
                <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead style={{ background: '#f9fafb' }}>
                            <tr>
                                {['Plan ID', 'Price', 'Active Subs', 'MRR', 'Total Revenue'].map(h => (
                                    <th key={h} style={thStyle}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data!.plans.map(p => (
                                <tr key={p.planId.toString()}>
                                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{p.planId.toString()}</td>
                                    <td style={tdStyle}>{fmt(p.price)}</td>
                                    <td style={tdStyle}>{p.activeSubscribers}</td>
                                    <td style={tdStyle}>{fmt(p.mrr)}</td>
                                    <td style={tdStyle}>{fmt(p.totalRevenue)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

        </div>
    )
}
