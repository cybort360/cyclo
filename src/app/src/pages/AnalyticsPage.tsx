/**
 * /analytics — merchant analytics shell.
 *
 * Owns the page header and the date-range pill selector (7d / 30d / 90d).
 * All chart and table content lives in AnalyticsTab, which receives the
 * selected number of days and filters its data accordingly.
 *
 * Class prefix: alp-
 */
import { useState } from 'react'
import { AnalyticsTab } from '../components/AnalyticsTab'
import './AnalyticsPage.css'

// ── Types ─────────────────────────────────────────────────────────────────────

const RANGE_OPTIONS = [
    { label: '7d',  days: 7  },
    { label: '30d', days: 30 },
    { label: '90d', days: 90 },
] as const

type RangeDays = (typeof RANGE_OPTIONS)[number]['days']

// ── Page ──────────────────────────────────────────────────────────────────────

export function AnalyticsPage() {
    const [days, setDays] = useState<RangeDays>(30)

    return (
        <div>
            <div className="alp-header">
                <h1 className="alp-title">Analytics</h1>

                <div className="alp-range" role="group" aria-label="Date range">
                    {RANGE_OPTIONS.map(opt => (
                        <button
                            key={opt.days}
                            className={`alp-range-btn${days === opt.days ? ' alp-range-btn--active' : ''}`}
                            onClick={() => setDays(opt.days)}
                            aria-pressed={days === opt.days}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <AnalyticsTab days={days} />
        </div>
    )
}
