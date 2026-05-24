/**
 * AnalyticsTab — KPI cards, two Recharts charts, and per-plan breakdown table.
 *
 * Receives `days` from AnalyticsPage and filters dailyRevenue accordingly.
 * Socket.io integration:
 *   'payment.charged' events patch liveRevenueToday and liveChargesCount in
 *   real time; today's revenue bar is updated without a full refetch.
 *
 * Recharts SVG note: SVG presentation attributes do not accept CSS custom
 * properties (var(--...)), so all colours are hex constants mirroring tokens.
 *
 * Class prefix: alt-
 */
import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { useAccount } from 'wagmi'
import {
    LineChart, Line, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer,
} from 'recharts'
import { useAnalytics, type DailyRevenue, type PlanMetrics } from '../hooks/useAnalytics'
import { useSocket } from '../hooks/useSocket'
import { DataTable, type DataTableColumn } from './DataTable'
import './AnalyticsTab.css'

// ── Recharts hex constants (mirror tokens.css — update both together) ──────────

const C_ACCENT = '#00FF87', C_FILL_START = 'rgba(0,255,135,0.18)',  C_FILL_END = 'rgba(0,255,135,0)'
const C_GRID   = '#0E2A3A', C_AXIS       = '#1A3A50'
const C_VIOLET = '#7C3AED', C_VIOLET_FILL_START = 'rgba(124,58,237,0.18)', C_VIOLET_FILL_END = 'rgba(124,58,237,0)'

// ── Plan breakdown columns ─────────────────────────────────────────────────────

const PLAN_COLS: DataTableColumn[] = [
    { key: 'plan',        label: 'Plan',        width: '90px',   mono: true   },
    { key: 'subscribers', label: 'Subscribers',  width: '110px',  align: 'right' },
    { key: 'revenue',     label: 'Revenue',      width: '120px',  align: 'right', mono: true },
    { key: 'churn',       label: 'Churn Rate',   width: '110px',  align: 'right' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUsdc(n: number): string {
    return n.toLocaleString('en-US', {
        style:                 'currency',
        currency:              'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })
}

/** ISO date string for N days ago from today. */
function dateNDaysAgo(days: number): string {
    const d = new Date()
    d.setDate(d.getDate() - (days - 1))
    return d.toISOString().split('T')[0]!
}

/** Merges a live USDC delta into dailyRevenue without mutating. */
function mergeRevenueToday(base: DailyRevenue[], liveAmount: number): DailyRevenue[] {
    if (liveAmount === 0) return base
    const today = new Date().toISOString().split('T')[0]!
    const idx   = base.findIndex(d => d.date === today)
    if (idx >= 0) {
        return base.map((d, i) => i === idx ? { ...d, revenue: d.revenue + liveAmount } : d)
    }
    return [...base, { date: today, revenue: liveAmount }]
}

// STUB: Requires per-day subscription event data from the hook. Currently
//       approximates a linear ramp toward the current active subscriber count.
function buildSubscriberSeries(
    totalSubscribers: number,
    days: number,
): Array<{ date: string; subscribers: number }> {
    const result: Array<{ date: string; subscribers: number }> = []
    const now = new Date()
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        result.push({
            date:        d.toISOString().split('T')[0]!,
            subscribers: Math.round(totalSubscribers * ((days - i) / days)),
        })
    }
    return result
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

interface TooltipEntry {
    active?:  boolean
    payload?: Array<{ value?: number }>
    label?:   string
}

function RevenueTooltip({ active, payload, label }: TooltipEntry) {
    if (!active || !payload?.length) return null
    return (
        <div className="alt-tooltip">
            <p className="alt-tooltip-label">{label}</p>
            <p className="alt-tooltip-value">{fmtUsdc(payload[0]?.value ?? 0)}</p>
        </div>
    )
}

function SubTooltip({ active, payload, label }: TooltipEntry) {
    if (!active || !payload?.length) return null
    return (
        <div className="alt-tooltip">
            <p className="alt-tooltip-label">{label}</p>
            <p className="alt-tooltip-value">{payload[0]?.value ?? 0} subs</p>
        </div>
    )
}

// ── Plan breakdown row builder ─────────────────────────────────────────────────

function buildPlanRows(plans: PlanMetrics[]): Record<string, ReactNode>[] {
    return plans.map(p => ({
        plan:        `Plan ${p.planId.toString()}`,
        subscribers: String(p.activeSubscribers),
        revenue:     fmtUsdc(p.totalRevenue),
        // STUB: Churn rate requires historical cancellation data per plan interval;
        //       not available from the current analytics hook.
        churn: '—',
    }))
}

// ── Component ─────────────────────────────────────────────────────────────────

interface AnalyticsTabProps {
    /** Number of days to display in charts and KPI calculations. */
    days: 7 | 30 | 90
}

export function AnalyticsTab({ days }: AnalyticsTabProps) {
    const { address }          = useAccount()
    const { data, isLoading }  = useAnalytics()
    const { onPaymentCharged } = useSocket()

    const [liveChargesCount,  setLiveChargesCount]  = useState(0)
    const [liveRevenueToday,  setLiveRevenueToday]  = useState(0)

    useEffect(() => {
        return onPaymentCharged(payload => {
            setLiveChargesCount(c => c + 1)
            setLiveRevenueToday(r => r + parseFloat(payload.amount))
        })
    }, [onPaymentCharged])

    // Revenue chart data: historical + live patch, filtered to selected range
    const revenueData: DailyRevenue[] = useMemo(() => {
        const cutoff  = dateNDaysAgo(days)
        const patched = mergeRevenueToday(data?.dailyRevenue ?? [], liveRevenueToday)
        return patched.filter(d => d.date >= cutoff)
    }, [data?.dailyRevenue, liveRevenueToday, days])

    // Subscriber growth series (approximated from total active count)
    const subGrowthData = useMemo(
        () => buildSubscriberSeries(data?.activeSubscribers ?? 0, days),
        [data?.activeSubscribers, days],
    )

    const planRows = useMemo(
        () => buildPlanRows(data?.plans ?? []),
        [data?.plans],
    )

    if (!address) {
        return <p className="alt-loading">Connect your wallet to view analytics.</p>
    }

    if (isLoading) {
        return <p className="alt-loading">Loading analytics…</p>
    }

    if ((data?.plans.length ?? 0) === 0 && liveChargesCount === 0) {
        return (
            <p className="alt-empty-text" style={{ padding: '60px 0', textAlign: 'center' }}>
                Analytics will appear here once your first payment is settled.
            </p>
        )
    }

    const kpis = [
        { label: 'MRR',               value: fmtUsdc(data?.mrr ?? 0),                              live: false },
        { label: 'Total Revenue',     value: fmtUsdc((data?.totalRevenue ?? 0) + liveRevenueToday), live: false },
        { label: 'Active Subscribers',value: String(data?.activeSubscribers ?? 0),                  live: false },
        { label: 'Charges Today',     value: String(liveChargesCount),                              live: true  },
    ]

    return (
        <div className="alt-root">

            {/* ── KPI cards ─────────────────────────────────────────── */}
            <div className="alt-kpi-grid">
                {kpis.map(({ label, value, live }) => (
                    <div key={label} className={`alt-kpi-card${live ? ' alt-kpi-card--live' : ''}`}>
                        <p className="alt-kpi-label">{label}</p>
                        <p className="alt-kpi-value">{value}</p>
                    </div>
                ))}
            </div>

            {/* ── Charts ────────────────────────────────────────────── */}
            <div className="alt-chart-row">

                {/* Revenue over time — line chart */}
                <div className="alt-chart-card">
                    <p className="alt-chart-title">Revenue</p>
                    <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={revenueData}>
                            <defs>
                                <linearGradient id="altRevFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%"  stopColor={C_FILL_START} />
                                    <stop offset="95%" stopColor={C_FILL_END}   />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={C_GRID} />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10, fill: C_AXIS }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: C_AXIS }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={v => `$${v}`}
                            />
                            <Tooltip content={<RevenueTooltip />} />
                            <Line
                                type="monotone"
                                dataKey="revenue"
                                stroke={C_ACCENT}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4, fill: C_ACCENT, strokeWidth: 0 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Subscriber growth — area chart */}
                <div className="alt-chart-card">
                    <p className="alt-chart-title">Subscriber Growth</p>
                    <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={subGrowthData}>
                            <defs>
                                <linearGradient id="altSubFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%"  stopColor={C_VIOLET_FILL_START} />
                                    <stop offset="95%" stopColor={C_VIOLET_FILL_END}   />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={C_GRID} />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10, fill: C_AXIS }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: C_AXIS }}
                                tickLine={false}
                                axisLine={false}
                                allowDecimals={false}
                            />
                            <Tooltip content={<SubTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="subscribers"
                                stroke={C_VIOLET}
                                fill="url(#altSubFill)"
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ── Plan breakdown ─────────────────────────────────────── */}
            {planRows.length > 0 && (
                <div>
                    <p className="alt-breakdown-label">Plan Breakdown</p>
                    <DataTable
                        columns={PLAN_COLS}
                        rows={planRows}
                        skeletonRows={3}
                    />
                </div>
            )}

        </div>
    )
}
