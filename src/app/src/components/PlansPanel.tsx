/**
 * PlansPanel — right-panel content for the /plans page.
 * Self-contained; injected via useRightPanel() from PlansPage.
 * Class prefix: pp-  (plans panel)
 */
import { useSubscriptionManager } from '../hooks/useSubscriptionManager'
import { useAnalytics } from '../hooks/useAnalytics'
import { fromUsdcUnits, INTERVAL_WEEKLY, INTERVAL_MONTHLY, INTERVAL_YEARLY } from '../utils/formatting'
import './PanelShared.css'
import './PlansPanel.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUsdc(n: number): string {
    return n.toLocaleString('en-US', {
        style: 'currency', currency: 'USD', minimumFractionDigits: 2,
    })
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface PlanPerfRowProps {
    name:        string
    mrr:         number
    subscribers: number
}

function PlanPerfRow({ name, mrr, subscribers }: PlanPerfRowProps) {
    return (
        <div className="pp-plan-row">
            <span className="pp-plan-name">{name}</span>
            <span className="pp-plan-mrr">{fmtUsdc(mrr)}</span>
            <span className="pp-plan-subs">{subscribers}</span>
        </div>
    )
}

// ── Interval breakdown ────────────────────────────────────────────────────────

const INTERVAL_COLORS = {
    weekly:  '#00FF87',   // --accent
    monthly: '#7C3AED',   // --violet
    yearly:  '#00D4FF',   // cyan
} as const

interface IntervalBreakdownProps {
    weekly:  number
    monthly: number
    yearly:  number
    total:   number
}

function IntervalBreakdown({ weekly, monthly, yearly, total }: IntervalBreakdownProps) {
    const wPct = total > 0 ? (weekly  / total) * 100 : 0
    const mPct = total > 0 ? (monthly / total) * 100 : 0
    const yPct = total > 0 ? (yearly  / total) * 100 : 0

    return (
        <div>
            {total === 0 ? (
                <p className="pn-empty">No plans yet.</p>
            ) : (
                <>
                    <div className="pp-interval-bar">
                        {wPct > 0 && (
                            <div
                                className="pp-interval-seg"
                                style={{ width: `${wPct}%`, background: INTERVAL_COLORS.weekly }}
                            />
                        )}
                        {mPct > 0 && (
                            <div
                                className="pp-interval-seg"
                                style={{ width: `${mPct}%`, background: INTERVAL_COLORS.monthly }}
                            />
                        )}
                        {yPct > 0 && (
                            <div
                                className="pp-interval-seg"
                                style={{ width: `${yPct}%`, background: INTERVAL_COLORS.yearly }}
                            />
                        )}
                    </div>
                    <div className="pp-interval-legend">
                        {weekly  > 0 && <LegendItem color={INTERVAL_COLORS.weekly}  label="Weekly"  count={weekly} />}
                        {monthly > 0 && <LegendItem color={INTERVAL_COLORS.monthly} label="Monthly" count={monthly} />}
                        {yearly  > 0 && <LegendItem color={INTERVAL_COLORS.yearly}  label="Yearly"  count={yearly} />}
                    </div>
                </>
            )}
        </div>
    )
}

function LegendItem({ color, label, count }: { color: string; label: string; count: number }) {
    return (
        <div className="pp-legend-item">
            <span className="pp-legend-dot" style={{ background: color }} />
            <span className="pp-legend-label">{label}</span>
            <span className="pp-legend-count">{count}</span>
        </div>
    )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function PlansPanel() {
    const { plans: planEvents } = useSubscriptionManager()
    const { data: analytics }   = useAnalytics()

    const analyticsByPlanId = new Map(
        (analytics?.plans ?? []).map(p => [p.planId.toString(), p])
    )

    const weekly  = planEvents.filter(p => Number(p.interval) === INTERVAL_WEEKLY).length
    const monthly = planEvents.filter(p => Number(p.interval) === INTERVAL_MONTHLY).length
    const yearly  = planEvents.filter(p => Number(p.interval) === INTERVAL_YEARLY).length

    return (
        <div className="pn-panel">

            {/* ── Section 1: Plan performance ──────────────────────────── */}
            <p className="pn-section-label">Plan Performance</p>
            {planEvents.length === 0 ? (
                <p className="pn-empty">No plans created yet.</p>
            ) : (
                <div className="pp-plan-list">
                    <div className="pp-plan-list-header">
                        <span>Plan</span>
                        <span>MRR</span>
                        <span>Subs</span>
                    </div>
                    {planEvents.map(p => {
                        const m = analyticsByPlanId.get(p.planId.toString())
                        return (
                            <PlanPerfRow
                                key={p.planId.toString()}
                                name={`Plan ${p.planId.toString()}`}
                                mrr={m?.mrr ?? fromUsdcUnits(p.price) * (m?.activeSubscribers ?? 0)}
                                subscribers={m?.activeSubscribers ?? 0}
                            />
                        )
                    })}
                </div>
            )}

            <hr className="pn-divider" />

            {/* ── Section 2: Interval breakdown ────────────────────────── */}
            <p className="pn-section-label">Intervals</p>
            <IntervalBreakdown
                weekly={weekly}
                monthly={monthly}
                yearly={yearly}
                total={planEvents.length}
            />

        </div>
    )
}
