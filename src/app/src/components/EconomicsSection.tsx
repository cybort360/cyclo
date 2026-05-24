/**
 * Arc economics callout section — single large two-column card.
 *
 * Left column: eyebrow + headline with italic last word + body copy + docs link.
 * Right column: comparison widget — title + three network rows with bar charts.
 *   Arc row is highlighted and carries a "Best" badge.
 *
 * CSS: EconomicsSection.css — l- tokens only, no dark dashboard tokens.
 */
import './EconomicsSection.css'

// ── Comparison widget data ────────────────────────────────────────────────────

interface NetworkRow {
    name:      string
    /** Bar fill width as a percentage of the track (100 = full). */
    fillPct:   number
    /** Fill colour — hardcoded for Ethereum/Polygon, l- token for Arc. */
    fillColor: string
    amount:    string
    /** Highlights the Arc row with a tinted background + "Best" badge. */
    highlight?: true
}

const NETWORK_ROWS: NetworkRow[] = [
    { name: 'Ethereum', fillPct: 100,  fillColor: '#EF4444',         amount: '$240,000' },
    { name: 'Polygon',  fillPct: 12,   fillColor: '#F59E0B',         amount: '$3,600'   },
    {
        name:      'Arc',
        fillPct:   0.5,
        fillColor: 'var(--l-accent)',
        amount:    '$120',
        highlight: true,
    },
]

// ── Comparison widget ─────────────────────────────────────────────────────────

/** Bar-chart cost comparison rendered inside the right column. */
function ComparisonWidget() {
    return (
        <div className="ec-widget">
            <p className="ec-widget-title">Annual keeper cost · 10k subscribers</p>

            <div className="ec-rows">
                {NETWORK_ROWS.map(({ name, fillPct, fillColor, amount, highlight }) => (
                    <div
                        key={name}
                        className={`ec-row${highlight ? ' ec-row--highlight' : ''}`}
                    >
                        {/* Row header: network name + amount */}
                        <div className="ec-row-top">
                            <span className="ec-row-name">
                                {name}
                                {highlight && <span className="ec-badge">Best</span>}
                            </span>
                            <span className="ec-row-amount">{amount}</span>
                        </div>

                        {/* Bar track + fill */}
                        <div className="ec-bar-track">
                            <div
                                className="ec-bar-fill"
                                style={{ width: `${fillPct}%`, background: fillColor }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EconomicsSection() {
    return (
        <section id="economics" className="ec-section">
            <div className="ec-inner">
                <div className="ec-card">

                    {/* ── Left column ───────────────────────────────────── */}
                    <div className="ec-left">
                        <span className="ec-eyebrow">Arc Economics</span>
                        <h2 className="ec-h2">
                            The only chain where<br />
                            keeper costs are<br />
                            <em className="ec-h2-em">irrelevant.</em>
                        </h2>
                        <p className="ec-body">
                            On Ethereum, running the keeper costs up to $240,000/year at
                            10,000 subscribers. On Arc, the same operation costs $120. The
                            3% fee is pure margin.
                        </p>
                        <a href="#docs" className="ec-link">Full economics breakdown →</a>
                    </div>

                    {/* ── Right column ──────────────────────────────────── */}
                    <div className="ec-right">
                        <ComparisonWidget />
                    </div>

                </div>
            </div>
        </section>
    )
}
