/**
 * Overview stat cards — four themed cards displayed at the top of the Dashboard.
 *
 * Each card has:
 *   - Labelled icon area (themed background + colour)
 *   - Counter-animated value (counts from 0 → target over 900ms on first load)
 *   - Delta trend pill + period label
 *   - SVG sparkline with themed stroke + gradient fill
 *
 * Live socket updates trigger a brief scale(1.04) pulse on the value element
 * instead of restarting the counter, preserving readability.
 *
 * CSS: OverviewStatCards.css — Ivory & Indigo tokens.
 * Class prefix: oc-  (overview-cards)
 */
import { useEffect, useRef, useState, type ComponentType } from 'react'
import {
    IconTrendingUp,
    IconUsers,
    IconBolt,
    IconCoin,
} from '@tabler/icons-react'
import './OverviewStatCards.css'

// ── Counter animation ─────────────────────────────────────────────────────────

interface CountState {
    displayed: number
    pulse:     boolean
}

/**
 * Animates a numeric value from 0 → target over `duration` ms on first load.
 * Subsequent target changes update instantly and trigger a pulse flag.
 */
function useCountUp(target: number, duration = 900): CountState {
    const [displayed, setDisplayed] = useState(0)
    const [pulse, setPulse]         = useState(false)
    const prevTarget                = useRef(0)
    const rafRef                    = useRef(0)

    useEffect(() => {
        const isFirstLoad = prevTarget.current === 0 && target > 0
        prevTarget.current = target

        if (isFirstLoad) {
            // Count up from 0 — cubic ease-out approximation of cubic-bezier(0,0,0.2,1)
            cancelAnimationFrame(rafRef.current)
            const start = performance.now()

            function tick(now: number): void {
                const t      = Math.min((now - start) / duration, 1)
                const eased  = 1 - Math.pow(1 - t, 3)
                setDisplayed(target * eased)
                if (t < 1) rafRef.current = requestAnimationFrame(tick)
            }

            rafRef.current = requestAnimationFrame(tick)
            return () => cancelAnimationFrame(rafRef.current)
        }

        if (target !== prevTarget.current || target === 0) return
        // Live update: instant value + 200ms pulse
        setDisplayed(target)
        setPulse(true)
        const t = setTimeout(() => setPulse(false), 200)
        return () => clearTimeout(t)
    }, [target, duration])

    return { displayed, pulse }
}

// ── Sparkline helper ──────────────────────────────────────────────────────────

interface SparkPaths {
    line: string
    area: string
}

/**
 * Converts a flat array of values into SVG path strings for a smooth sparkline.
 * Returns empty strings when fewer than 2 values are supplied.
 */
function buildSparkPaths(values: number[], w: number, h: number): SparkPaths {
    if (values.length < 2) return { line: '', area: '' }

    const max   = Math.max(...values, 1)
    const pad   = h * 0.12
    const pts   = values.map((v, i) => ({
        x: (i / (values.length - 1)) * w,
        y: h - pad - (v / max) * (h - pad * 2),
    }))

    // Smooth curve: cubic bezier through midpoints
    let line = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
    for (let i = 1; i < pts.length; i++) {
        const cx = ((pts[i - 1].x + pts[i].x) / 2).toFixed(1)
        line += ` C ${cx},${pts[i - 1].y.toFixed(1)} ${cx},${pts[i].y.toFixed(1)} ${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)}`
    }

    const last = pts[pts.length - 1]
    const area = `${line} L ${last.x.toFixed(1)},${h} L 0,${h} Z`
    return { line, area }
}

/**
 * Generates a synthetic 8-point upward-trending sparkline array
 * when real time-series data is unavailable.
 */
export function syntheticSpark(final: number, points = 8): number[] {
    if (final === 0) return Array(points).fill(0)
    return Array.from({ length: points }, (_, i) => {
        const t    = i / (points - 1)
        const base = final * (0.4 + 0.6 * t)
        // Deterministic gentle undulation (no Math.random — stable across re-renders)
        return Math.max(0, base + Math.sin(i * 2.1) * final * 0.05)
    })
}

// ── Theme map ─────────────────────────────────────────────────────────────────

type Theme = 'accent' | 'success' | 'info' | 'warning'

const THEME_STROKE: Record<Theme, string> = {
    accent:  'var(--accent)',
    success: 'var(--success)',
    info:    'var(--info)',
    warning: 'var(--warning)',
}

const THEME_FILL_TOP: Record<Theme, string> = {
    accent:  'rgba(79,70,229,0.12)',
    success: 'rgba(5,150,105,0.12)',
    info:    'rgba(2,132,199,0.12)',
    warning: 'rgba(217,119,6,0.12)',
}

// ── Single card ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NavIcon = ComponentType<any>

interface StatCardProps {
    id:       string
    label:    string
    /** Raw numeric value — counter-animated on load, pulsed on live updates. */
    value:    number
    /** Decimal places shown after the counter settles (default 0). */
    decimals?: number
    /** Text appended after the value, e.g. " USDC". Include leading space. */
    suffix?:  string
    /**
     * Delta string including arrow glyph (e.g. "↑ 12%").
     * Omit or pass undefined to hide the delta pill entirely.
     */
    delta?:   string
    /** Secondary period label, e.g. "all time". */
    period:   string
    theme:    Theme
    Icon:     NavIcon
    spark:    number[]
}

function StatCard({
    id, label, value, decimals = 0, suffix, delta, period, theme, Icon, spark,
}: StatCardProps) {
    const { displayed, pulse } = useCountUp(value)
    const fillId = `oc-fill-${id}`

    const formattedValue = decimals > 0
        ? displayed.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        : Math.round(displayed).toLocaleString('en-US')

    const { line: sparkLine, area: sparkArea } = buildSparkPaths(spark, 260, 40)

    // Only render the sparkline when there is at least one non-zero data point.
    // When all values are 0 the paths collapse to a flat line at y=h which
    // renders as a coloured bottom border — suppressing it is cleaner.
    const hasSparkData = spark.some(v => v > 0)

    return (
        <div className={`oc-card oc-card--${theme}`}>

            {/* ── Top row: label + icon ────────────────────────── */}
            <div className="oc-top">
                <span className="oc-label">{label}</span>
                <div className={`oc-icon-wrap oc-icon-wrap--${theme}`} aria-hidden="true">
                    <Icon size={16} aria-hidden="true" />
                </div>
            </div>

            {/* ── Value ───────────────────────────────────────── */}
            <div className="oc-value-row">
                <span className={`oc-value${pulse ? ' oc-value--pulse' : ''}`}>
                    {formattedValue}
                </span>
                {suffix && <span className="oc-suffix">{suffix}</span>}
            </div>

            {/* ── Delta pill + period ──────────────────────────── */}
            <div className="oc-delta-row">
                {delta && (
                    <span className={`oc-delta oc-delta--${theme}`}>{delta}</span>
                )}
                <span className="oc-period">{period}</span>
            </div>

            {/* ── Sparkline SVG — hidden when all values are zero ─── */}
            {hasSparkData && (
                <svg
                    className="oc-spark"
                    viewBox="0 0 260 40"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                >
                    <defs>
                        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor={THEME_FILL_TOP[theme]} />
                            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                        </linearGradient>
                    </defs>
                    {sparkArea && (
                        <path d={sparkArea} fill={`url(#${fillId})`} />
                    )}
                    {sparkLine && (
                        <path
                            d={sparkLine}
                            fill="none"
                            stroke={THEME_STROKE[theme]}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    )}
                </svg>
            )}

        </div>
    )
}

// ── Public component ──────────────────────────────────────────────────────────

interface OverviewStatCardsProps {
    totalRevenue:      number
    activeSubscribers: number
    totalCharges:      number
    /** Triggered when a live socket payment fires — causes Revenue + Fees pulse. */
    liveRevenueDelta:  number
    /** Real per-day revenue from on-chain events — used as the Revenue sparkline. */
    dailyRevenue:      { date: string; revenue: number }[]
}

export function OverviewStatCards({
    totalRevenue,
    activeSubscribers,
    totalCharges,
    liveRevenueDelta,
    dailyRevenue,
}: OverviewStatCardsProps) {
    const revenue = totalRevenue + liveRevenueDelta
    const fees    = revenue * 0.03   // Cyclo protocol fee is 3 %

    // Build sparkline from real daily data when available; fall back to synthetic
    // when there are fewer than 2 data points (e.g. no charges yet).
    const revenueSpark = dailyRevenue.length >= 2
        ? dailyRevenue.map(d => d.revenue)
        : syntheticSpark(revenue)

    return (
        <div className="oc-grid">

            <StatCard
                id="revenue"
                label="TOTAL REVENUE"
                value={revenue}
                decimals={2}
                suffix=" USDC"
                period="all time"
                theme="accent"
                Icon={IconTrendingUp}
                spark={revenueSpark}
            />

            <StatCard
                id="subscribers"
                label="ACTIVE SUBSCRIBERS"
                value={activeSubscribers}
                period="on-chain"
                theme="success"
                Icon={IconUsers}
                spark={syntheticSpark(activeSubscribers)}
            />

            <StatCard
                id="charges"
                label="TOTAL CHARGES"
                value={totalCharges}
                period="all time"
                theme="info"
                Icon={IconBolt}
                spark={syntheticSpark(totalCharges)}
            />

            <StatCard
                id="fees"
                label="PROTOCOL FEES"
                value={fees}
                decimals={2}
                suffix=" USDC"
                period="3% of revenue"
                theme="warning"
                Icon={IconCoin}
                spark={syntheticSpark(fees)}
            />

        </div>
    )
}
