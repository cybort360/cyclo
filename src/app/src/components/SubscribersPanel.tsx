/**
 * SubscribersPanel — right-panel content for the /subscribers page.
 * Self-contained; injected via useRightPanel() from SubscribersPage.
 * Class prefix: sp-  (subscribers panel)
 */
import { useSubscriberList } from '../hooks/useSubscriberList'
import { useAnalytics } from '../hooks/useAnalytics'
import './PanelShared.css'
import './SubscribersPanel.css'

// ── Colour constants ──────────────────────────────────────────────────────────
// Mirror token values — SVG/style attributes don't accept CSS custom properties.
const C_ACCENT  = '#00FF87'
const C_WARNING = '#F59E0B'
const C_DANGER  = '#FF4444'

// ── Helpers ───────────────────────────────────────────────────────────────────

function churnColor(pct: number): string {
    if (pct <= 25) return C_ACCENT
    if (pct <= 50) return C_WARNING
    return C_DANGER
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface StatusRowProps {
    dotColor: string
    label:    string
    count:    number
}

function StatusRow({ dotColor, label, count }: StatusRowProps) {
    return (
        <div className="sp-status-row">
            <span className="sp-dot" style={{ background: dotColor }} />
            <span className="sp-status-label">{label}</span>
            <span className="sp-status-count">{count}</span>
        </div>
    )
}

interface PlanBarProps {
    name:  string
    count: number
    pct:   number
}

function PlanBar({ name, count, pct }: PlanBarProps) {
    return (
        <div className="sp-plan-bar-row">
            <span className="sp-plan-name">{name}</span>
            <div className="pn-bar-track">
                <div className="pn-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="sp-plan-count">{count}</span>
        </div>
    )
}

// ── Churn risk arc meter ──────────────────────────────────────────────────────

// Arc geometry: semicircle, center (60,60), radius 48.
// Left → right across the top, stroke-based fill.
const R          = 48
const CX         = 60
const CY         = 60
const ARC_LEN    = Math.PI * R          // ≈ 150.8 — total semicircle length
const ARC_PATH   = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`

function ChurnMeter({ pct }: { pct: number }) {
    const filled = ARC_LEN * (pct / 100)
    const color  = churnColor(pct)
    return (
        <div className="sp-meter-wrap">
            <svg viewBox="0 0 120 66" className="sp-meter-svg" aria-hidden="true">
                {/* Background arc */}
                <path
                    d={ARC_PATH}
                    fill="none"
                    stroke="#0E2A3A"
                    strokeWidth={8}
                    strokeLinecap="round"
                />
                {/* Fill arc */}
                <path
                    d={ARC_PATH}
                    fill="none"
                    stroke={color}
                    strokeWidth={8}
                    strokeLinecap="round"
                    strokeDasharray={`${filled} ${ARC_LEN}`}
                />
                {/* Center value */}
                <text
                    x={CX}
                    y={CY - 4}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#F0F6FF"
                    fontSize={18}
                    fontFamily="ui-monospace, 'Cascadia Code', Consolas, monospace"
                    fontWeight={500}
                >
                    {pct}%
                </text>
            </svg>
        </div>
    )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function SubscribersPanel() {
    const { data: rows   = [] } = useSubscriberList()
    const { data: analytics }   = useAnalytics()

    const total     = rows.length
    const active    = rows.filter(r => r.status === 'active').length
    const pastDue   = rows.filter(r => r.status === 'past_due').length
    const cancelled = rows.filter(r => r.status === 'cancelled').length
    const churnPct  = total > 0 ? Math.round((pastDue / total) * 100) : 0

    const plans     = analytics?.plans ?? []
    const topPlans  = [...plans]
        .sort((a, b) => b.activeSubscribers - a.activeSubscribers)
        .slice(0, 3)
    const maxSubs   = topPlans[0]?.activeSubscribers ?? 1

    return (
        <div className="pn-panel">

            {/* ── Section 1: Subscriber stats ─────────────────────────── */}
            <p className="pn-section-label">Subscribers</p>
            <p className="sp-total">{total}</p>
            <div className="sp-status-rows">
                <StatusRow dotColor={C_ACCENT}  label="Active"    count={active} />
                <StatusRow dotColor={C_WARNING} label="Past due"  count={pastDue} />
                <StatusRow dotColor={C_DANGER}  label="Cancelled" count={cancelled} />
            </div>

            <hr className="pn-divider" />

            {/* ── Section 2: Top plans ────────────────────────────────── */}
            <p className="pn-section-label">Top Plans</p>
            {topPlans.length === 0 ? (
                <p className="pn-empty">No plans yet.</p>
            ) : (
                topPlans.map(p => (
                    <PlanBar
                        key={p.planId.toString()}
                        name={`Plan ${p.planId.toString()}`}
                        count={p.activeSubscribers}
                        pct={maxSubs > 0 ? (p.activeSubscribers / maxSubs) * 100 : 0}
                    />
                ))
            )}

            <hr className="pn-divider" />

            {/* ── Section 3: Churn risk ────────────────────────────────── */}
            <p className="pn-section-label">Churn Risk</p>
            <ChurnMeter pct={churnPct} />

        </div>
    )
}
