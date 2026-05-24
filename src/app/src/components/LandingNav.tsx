/**
 * Fixed top navigation bar for the public landing page (/).
 *
 * Three zones:
 *   Left   — "Cyclo" wordmark + indigo accent dot (superscript position)
 *   Center — section anchor links (hidden below 768px)
 *   Right  — "Sign in" text link + "Launch app →" pill button
 *
 * Scroll behaviour: transparent until 60px scrolled, then frosted-glass
 * bg via the .ln-nav--scrolled modifier class.
 *
 * All visual tokens come from landing-tokens.css (l- prefix).
 * No dark dashboard tokens are used here.
 */
import { useState, useEffect } from 'react'
import { Link } from 'wouter'
import Logo from './Logo'
import './LandingNav.css'

/** Section anchors in the order they appear on the page. */
const NAV_LINKS = [
    { label: 'Protocol',      href: '#protocol'   },
    { label: 'Developers',    href: '#developers' },
    { label: 'Arc Economics', href: '#economics'  },
    { label: 'Docs',          href: '#docs'       },
] as const

/**
 * Fixed top navigation for the landing page.
 * Attaches a passive scroll listener to toggle the frosted-glass state.
 * @returns The nav bar element.
 */
export function LandingNav() {
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        function onScroll(): void {
            setScrolled(window.scrollY > 60)
        }
        // Passive listener — no call to preventDefault, so the browser can
        // optimise scroll performance without waiting on this handler.
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    return (
        <header className={`ln-nav${scrolled ? ' ln-nav--scrolled' : ''}`}>
            <div className="ln-inner">

                {/* ── Logo (left) ──────────────────────────────────────── */}
                <a href="/" className="ln-logo" aria-label="Cyclo home">
                    <Logo
                        size={28}
                        wordmarkSize={15}
                        wordmarkColor="#0A0A14"
                    />
                </a>

                {/* ── Section links (center, desktop only) ─────────────── */}
                <nav className="ln-links" aria-label="Page sections">
                    {NAV_LINKS.map(({ label, href }) => (
                        <a key={label} href={href} className="ln-link">
                            {label}
                        </a>
                    ))}
                </nav>

                {/* ── Actions (right) ──────────────────────────────────── */}
                <div className="ln-actions">
                    <Link href="/dashboard">
                        <a className="ln-signin">Sign in</a>
                    </Link>
                    <Link href="/dashboard">
                        <a className="ln-launch">Launch app →</a>
                    </Link>
                </div>

            </div>
        </header>
    )
}
