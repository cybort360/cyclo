/**
 * Full-width statistics bar rendered immediately below the hero section.
 *
 * Fetches live values from /api/stats via useProtocolStats() and refreshes
 * every 30 seconds. Shows pulsing skeletons while the first fetch is in flight.
 *
 * NOTE: the API exposes totalCharges (all-time), not a daily count.
 * The "Charges settled" slot uses totalCharges. Update if a daily endpoint
 * is added to /api/stats in the future.
 */
import { useProtocolStats, type ProtocolStats } from '../hooks/useProtocolStats'
import './StatsBar.css'

// ── Formatting helpers ────────────────────────────────────────────────────────

/** Formats a USDC dollar total with locale commas, e.g. "$24,180.42". */
function fmtUsdc(n: number): string {
    return n.toLocaleString('en-US', {
        style: 'currency', currency: 'USD', minimumFractionDigits: 2,
    })
}

/** Formats a plain integer with locale commas, e.g. "1,284". */
function fmtInt(n: number): string {
    return n.toLocaleString('en-US')
}

// ── Stat definitions ──────────────────────────────────────────────────────────

interface StatDef {
    key:   string
    label: string
    value: (s: ProtocolStats) => string
}

const STATS: StatDef[] = [
    {
        key:   'volume',
        label: 'Total USDC settled',
        value: s => fmtUsdc(s.totalVolumeUsdc),
    },
    {
        key:   'subscriptions',
        label: 'Active subscriptions',
        value: s => fmtInt(s.activeSubscriptions),
    },
    {
        key:   'merchants',
        label: 'Total merchants',
        value: s => fmtInt(s.uniqueMerchants),
    },
    {
        key:   'charges',
        label: 'Charges settled',
        value: s => fmtInt(s.totalCharges),
    },
]

// ── Skeleton cell ─────────────────────────────────────────────────────────────

function StatSkeleton() {
    return (
        <div className="sb-stat">
            <div className="sb-skel-value" />
            <div className="sb-skel-label" />
        </div>
    )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StatsBar() {
    const { stats, loading } = useProtocolStats({ refreshIntervalMs: 30_000 })

    return (
        <section className="sb-section" aria-label="Protocol statistics">
            <div className="sb-inner">

                <p className="sb-eyebrow">Live on Arc Testnet</p>

                <div className="sb-row">
                    {STATS.map(({ key, label, value }, i) => (
                        <div key={key} style={{ display: 'contents' }}>
                            {/* Vertical divider between stats (not before the first) */}
                            {i > 0 && <div className="sb-divider" aria-hidden="true" />}

                            {loading || !stats ? (
                                <StatSkeleton />
                            ) : (
                                <div className="sb-stat">
                                    <span className="sb-value">{value(stats)}</span>
                                    <span className="sb-label">{label}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

            </div>
        </section>
    )
}
