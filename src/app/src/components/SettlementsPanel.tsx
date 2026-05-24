/**
 * SettlementsPanel — right-panel content for the /settlements page.
 * Self-contained; injected via useRightPanel() from SettlementsPage.
 * Class prefix: stp-  (settlements panel)
 */
import { useSubscriptionManager } from '../hooks/useSubscriptionManager'
import { fromUsdcUnits } from '../utils/formatting'
import './PanelShared.css'
import './SettlementsPanel.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUsdc(n: number): string {
    return n.toLocaleString('en-US', {
        style: 'currency', currency: 'USD', minimumFractionDigits: 2,
    })
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface PlanVolumeRowProps {
    name:    string
    amount:  number
    pct:     number
}

function PlanVolumeRow({ name, amount, pct }: PlanVolumeRowProps) {
    return (
        <div className="stp-vol-row">
            <span className="stp-vol-name">{name}</span>
            <div className="stp-vol-bar-wrap">
                <div className="pn-bar-track">
                    <div className="pn-bar-fill" style={{ width: `${pct}%` }} />
                </div>
            </div>
            <span className="stp-vol-amount">{fmtUsdc(amount)}</span>
        </div>
    )
}

interface KeeperStatRowProps {
    label: string
    value: string
}

function KeeperStatRow({ label, value }: KeeperStatRowProps) {
    return (
        <div className="stp-keeper-row">
            <span className="stp-keeper-label">{label}</span>
            <span className="stp-keeper-value">{value}</span>
        </div>
    )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function SettlementsPanel() {
    const { settlements, plans } = useSubscriptionManager()

    // Aggregate totals from raw bigint amounts
    const totalRaw  = settlements.reduce((s, e) => s + e.amount, 0n)
    const total     = fromUsdcUnits(totalRaw)
    const fees      = total * 0.03

    // Charge count for badge
    const chargeCount = settlements.length

    // Revenue aggregated per plan (top 5 by volume)
    const byPlan = new Map<string, bigint>()
    for (const s of settlements) {
        const k = s.planId.toString()
        byPlan.set(k, (byPlan.get(k) ?? 0n) + s.amount)
    }
    const topPlans = [...byPlan.entries()]
        .sort(([, a], [, b]) => Number(b - a))
        .slice(0, 5)
    const maxAmount = topPlans[0] ? fromUsdcUnits(topPlans[0][1]) : 1

    // Plan ID → name lookup
    const planNames = new Map(plans.map(p => [p.planId.toString(), `Plan ${p.planId.toString()}`]))

    // Keeper stats
    const successRate = chargeCount > 0 ? '100%' : '—'
    const avgPerDay   = chargeCount > 0 ? chargeCount.toString() : '—'

    return (
        <div className="pn-panel">

            {/* ── Section 1: Revenue summary ───────────────────────────── */}
            <p className="pn-section-label">Revenue Summary</p>
            <p className="stp-total">{fmtUsdc(total)}</p>
            <p className="stp-fees">Protocol fees {fmtUsdc(fees)}</p>
            <span className="stp-badge">
                {chargeCount} {chargeCount === 1 ? 'charge' : 'charges'}
            </span>

            <hr className="pn-divider" />

            {/* ── Section 2: Charge volume by plan ────────────────────── */}
            <p className="pn-section-label">Volume by Plan</p>
            {topPlans.length === 0 ? (
                <p className="pn-empty">No settlements yet.</p>
            ) : (
                <div className="stp-vol-list">
                    {topPlans.map(([planId, raw]) => {
                        const amount = fromUsdcUnits(raw)
                        return (
                            <PlanVolumeRow
                                key={planId}
                                name={planNames.get(planId) ?? `Plan ${planId}`}
                                amount={amount}
                                pct={maxAmount > 0 ? (amount / maxAmount) * 100 : 0}
                            />
                        )
                    })}
                </div>
            )}

            <hr className="pn-divider" />

            {/* ── Section 3: Keeper stats ──────────────────────────────── */}
            <p className="pn-section-label">Keeper Stats</p>
            <div className="stp-keeper-stats">
                <KeeperStatRow label="Total charges"   value={String(chargeCount)} />
                <KeeperStatRow label="Success rate"    value={successRate} />
                <KeeperStatRow label="Charges (today)" value={avgPerDay} />
            </div>

        </div>
    )
}
