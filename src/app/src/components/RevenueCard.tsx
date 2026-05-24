/**
 * RevenueCard — Recharts area chart card with period selector and delta pills.
 *
 * Accepts historical dailyRevenue from useAnalytics (all bucketed to today
 * because block timestamps require extra RPC calls) and a liveRevenue float
 * that accumulates socket-charged amounts since page load.
 *
 * Card header layout:
 *   Left  — label / animated value / delta pills (income + fees)
 *   Right — period selector pill (Week / Month / Quarter)
 *
 * Class prefix: rv-
 */
import { useState, useMemo } from 'react'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer,
} from 'recharts'
import type { DailyRevenue } from '../hooks/useAnalytics'
import './RevenueCard.css'

// ── Recharts colour constants ──────────────────────────────────────────────────
// SVG presentation attributes do not support CSS custom properties (var(--)).
// These hex values are exact equivalents of the Ivory & Indigo tokens.
// Update these and tokens.css in the same commit if colours change.
const C_ACCENT     = '#4F46E5'              // --accent
const C_FILL_START = 'rgba(79,70,229,0.06)' // --accent-glow
const C_FILL_END   = 'rgba(79,70,229,0)'
const C_GRID       = 'rgba(0,0,0,0.05)'
const C_AXIS       = '#9CA3AF'              // --text-muted

// ── Types ─────────────────────────────────────────────────────────────────────

type Period = 'week' | 'month' | 'quarter'

interface RevenueCardProps {
    /** Historical daily revenue from useAnalytics. */
    dailyRevenue: DailyRevenue[]
    /** Live USDC accrued since page load, in USDC float (human-readable). */
    liveRevenue:  number
}

// ── Data helpers ──────────────────────────────────────────────────────────────

const PERIOD_DAYS: Record<Period, number> = { week: 7, month: 30, quarter: 90 }

/**
 * Builds a complete date-range series ending today, filling missing days with 0.
 * Adds liveRevenue to today's bucket so the chart reflects real-time accrual.
 */
export function buildPeriodData(
    base:        DailyRevenue[],
    days:        number,
    liveRevenue: number,
): DailyRevenue[] {
    const map   = new Map<string, number>(base.map(d => [d.date, d.revenue]))
    const today = new Date()
    const result: DailyRevenue[] = []

    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        result.push({
            date:    dateStr,
            revenue: (map.get(dateStr) ?? 0) + (i === 0 ? liveRevenue : 0),
        })
    }
    return result
}

/** Returns which date strings to show as X-axis ticks to avoid crowding. */
function buildTicks(data: DailyRevenue[], period: Period): string[] {
    return data
        .filter((_, i) => {
            const n = data.length
            if (period === 'week')    return true
            if (period === 'month')   return i % 7 === 0 || i === n - 1
            return i % 30 === 0 || i === n - 1      // quarter
        })
        .map(d => d.date)
}

/** Formats a date string as a readable X-axis label for the chosen period. */
function tickLabel(dateStr: string, period: Period): string {
    const d = new Date(dateStr + 'T00:00:00')
    if (period === 'week')    return d.toLocaleDateString('en-US', { weekday: 'short' })
    if (period === 'quarter') return d.toLocaleDateString('en-US', { month: 'short' })
    return String(d.getDate())
}

/** Compact Y-axis tick — shortens large numbers ("$1.2k"). */
function yAxisTick(n: number): string {
    if (n >= 1_000) return `$${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`
    return `$${n}`
}

/** Number-only formatter (no $ symbol, no cents above $1,000). */
function fmtNumber(n: number): string {
    if (n >= 1_000) {
        return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
    }
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Full USD string used only in tooltip. */
function fmtUsdc(n: number): string {
    if (n >= 1_000) {
        return n.toLocaleString('en-US', {
            style: 'currency', currency: 'USD', maximumFractionDigits: 0,
        })
    }
    return n.toLocaleString('en-US', {
        style: 'currency', currency: 'USD', minimumFractionDigits: 2,
    })
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

interface TooltipArgs {
    active?:  boolean
    payload?: { value: number }[]
    label?:   string
}

function RevenueTooltip({ active, payload, label }: TooltipArgs) {
    if (!active || !payload?.length || !label) return null
    return (
        <div className="rv-tooltip">
            <p className="rv-tooltip-date">{label}</p>
            <p className="rv-tooltip-value">{fmtUsdc(payload[0].value)}</p>
        </div>
    )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RevenueCard({ dailyRevenue, liveRevenue }: RevenueCardProps) {
    const [period, setPeriod] = useState<Period>('week')
    const days = PERIOD_DAYS[period]

    const data = useMemo(
        () => buildPeriodData(dailyRevenue, days, liveRevenue),
        [dailyRevenue, days, liveRevenue],
    )

    const periodTotal = useMemo(
        () => data.reduce((sum, d) => sum + d.revenue, 0),
        [data],
    )
    const fees   = periodTotal * 0.03
    const income = periodTotal - fees

    const ticks = useMemo(() => buildTicks(data, period), [data, period])

    return (
        <div className="rv-card">

            {/* ── Card header ───────────────────────────────────────────── */}
            <div className="rv-header">

                {/* Left: label + value + pills */}
                <div className="rv-meta">
                    <span className="rv-label">REVENUE</span>
                    <div className="rv-value-row">
                        <span className="rv-value">{fmtNumber(periodTotal)}</span>
                        <span className="rv-suffix"> USDC</span>
                    </div>
                    <div className="rv-pills">
                        <span className="rv-pill rv-pill--income">↑ {fmtNumber(income)} USDC</span>
                        <span className="rv-pill rv-pill--fee">↓ {fmtNumber(fees)} fees</span>
                    </div>
                </div>

                {/* Right: period selector */}
                <div className="rv-period-selector">
                    {(['week', 'month', 'quarter'] as Period[]).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`rv-period-btn${period === p ? ' rv-period-btn--active' : ''}`}
                        >
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                        </button>
                    ))}
                </div>

            </div>

            {/* ── Area chart ────────────────────────────────────────────── */}
            <div className="rv-chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
                        <defs>
                            <linearGradient id="rv-fill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor={C_FILL_START} />
                                <stop offset="95%" stopColor={C_FILL_END}   />
                            </linearGradient>
                        </defs>
                        <CartesianGrid
                            stroke={C_GRID}
                            strokeDasharray="0"
                            vertical={false}
                        />
                        <XAxis
                            dataKey="date"
                            ticks={ticks}
                            tickFormatter={d => tickLabel(d, period)}
                            tick={{ fill: C_AXIS, fontSize: 10, fontFamily: 'ui-monospace, Consolas, monospace' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tickFormatter={yAxisTick}
                            tick={{ fill: C_AXIS, fontSize: 10, fontFamily: 'ui-monospace, Consolas, monospace' }}
                            axisLine={false}
                            tickLine={false}
                            width={44}
                        />
                        <Tooltip content={<RevenueTooltip />} cursor={{ stroke: C_GRID, strokeWidth: 1 }} />
                        <Area
                            type="monotone"
                            dataKey="revenue"
                            stroke={C_ACCENT}
                            strokeWidth={2.5}
                            fill="url(#rv-fill)"
                            dot={false}
                            activeDot={{ r: 4, fill: C_ACCENT, stroke: '#fff', strokeWidth: 2 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

        </div>
    )
}
