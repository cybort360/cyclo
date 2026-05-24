/**
 * Combined closing CTA section + page footer — the last element on the landing page.
 *
 * CTA section (<section>):
 *   Centred headline, subtext, two action buttons (primary indigo / secondary surface),
 *   and a three-stat row separated by vertical dividers.
 *
 * Page footer (<footer>):
 *   Dark (var(--l-ink)) background. Top row: CYCLO wordmark + tagline left,
 *   navigation links right. Bottom divider + centred copyright line.
 *
 * CSS: CtaFooter.css — l- tokens for CTA, hardcoded dark values for footer.
 */
import { Link } from 'wouter'
import Logo from './Logo'
import './CtaFooter.css'

// ── Footer link data ──────────────────────────────────────────────────────────

const FOOTER_LINKS = [
    { label: 'Docs',           href: '/docs'          },
    { label: 'Arc Economics',  href: '/arc-economics' },
    { label: 'Stats',          href: '/stats'         },
    { label: 'Portal',         href: '/portal'        },
] as const

// ── Stats data ────────────────────────────────────────────────────────────────

const STATS = [
    { num: '3%',     label: 'Protocol fee'      },
    { num: '$0.001', label: 'Per keeper charge' },
    { num: '1 tx',   label: 'To subscribe'      },
] as const

// ── Component ─────────────────────────────────────────────────────────────────

export function CtaFooter() {
    return (
        <>
            {/* ── CTA section ────────────────────────────────────────────── */}
            <section id="cta" className="cf-cta-section">
                <div className="cf-cta-inner">

                    <h2 className="cf-headline">Ready to build on Arc?</h2>

                    <p className="cf-subtext">
                        Set up your first subscription plan in under 90 seconds.
                        Arc testnet — no real funds required.
                    </p>

                    {/* ── CTA buttons ────────────────────────────────────── */}
                    <div className="cf-buttons">
                        <Link href="/onboarding">
                            <a className="cf-btn-primary">
                                Start accepting subscriptions
                            </a>
                        </Link>
                        <Link href="/docs" className="cf-btn-secondary">
                            Read the docs
                        </Link>
                    </div>

                    {/* ── Stat row ───────────────────────────────────────── */}
                    <div className="cf-stats" aria-label="Protocol statistics">
                        {STATS.map(({ num, label }, i) => (
                            <>
                                {i > 0 && (
                                    <div
                                        key={`div-${label}`}
                                        className="cf-stat-divider"
                                        aria-hidden="true"
                                    />
                                )}
                                <div key={label} className="cf-stat">
                                    <p className="cf-stat-num">{num}</p>
                                    <p className="cf-stat-label">{label}</p>
                                </div>
                            </>
                        ))}
                    </div>

                </div>
            </section>

            {/* ── Page footer ────────────────────────────────────────────── */}
            <footer className="cf-footer">
                <div className="cf-footer-inner">

                    {/* Top row: wordmark left, links right */}
                    <div className="cf-footer-top">

                        <div className="cf-footer-brand">
                            <Logo
                                size={20}
                                variant="white"
                                wordmarkSize={13}
                                wordmarkColor="white"
                            />
                            <span className="cf-footer-tagline">Built on Arc testnet</span>
                        </div>

                        <nav className="cf-footer-links" aria-label="Site links">
                            {FOOTER_LINKS.map(({ label, href }) => (
                                <a key={href} href={href} className="cf-footer-link">
                                    {label}
                                </a>
                            ))}
                        </nav>

                    </div>

                    {/* Bottom divider + copyright */}
                    <div className="cf-footer-bottom">
                        <p className="cf-copyright">© 2026 Cyclo Protocol</p>
                    </div>

                </div>
            </footer>
        </>
    )
}
