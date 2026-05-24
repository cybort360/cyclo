/**
 * Logo — Cyclo brand mark adapted to the Ivory & Indigo design system.
 *
 * Renders the SVG arc and an optional "CYCLO" wordmark side-by-side.
 * Each instance generates a unique gradient ID via useId() so multiple
 * Logo components on the same page never share a <defs> entry.
 *
 * Props:
 *   size          — controls SVG width/height (default 32)
 *   showWordmark  — render "CYCLO" text next to the mark (default true)
 *   wordmarkSize  — font-size of the wordmark in px (default 15)
 *   wordmarkColor — CSS color string for the wordmark (default var(--text-primary))
 *   variant       — 'default' | 'white' | 'mono'
 *
 * Variants:
 *   default — gradient outer arc + #A5B4FC inner arc at 45 % opacity
 *   white   — both arcs white; inner at 40 % opacity. Use on dark backgrounds.
 *   mono    — outer arc inherits currentColor; inner arc hidden. Single-colour usage.
 *
 * Exports:
 *   default Logo
 *   LogoIcon — convenience wrapper with showWordmark=false
 */
import { useId } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LogoProps {
    /** Controls SVG width and height. @default 32 */
    size?:          number
    /** Render the "CYCLO" wordmark beside the mark. @default true */
    showWordmark?:  boolean
    /** Font-size of the wordmark in px. @default 15 */
    wordmarkSize?:  number
    /** CSS color for the wordmark. @default 'var(--text-primary)' */
    wordmarkColor?: string
    /** Colour treatment for the SVG paths. @default 'default' */
    variant?:       'default' | 'white' | 'mono'
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Logo({
    size          = 32,
    showWordmark  = true,
    wordmarkSize  = 15,
    wordmarkColor = 'var(--text-primary)',
    variant       = 'default',
}: LogoProps) {
    // useId returns strings like ":r0:" — strip colons so the value is a
    // valid XML/CSS id fragment (e.g. "r0").
    const reactId    = useId()
    const uid        = reactId.replace(/:/g, '')
    const gradientId = `cycloGradient-${uid}`

    // ── Stroke resolution per variant ────────────────────────────────────────
    const outerStroke: string =
        variant === 'white' ? '#ffffff'
        : variant === 'mono' ? 'currentColor'
        : `url(#${gradientId})`

    const showInner       = variant !== 'mono'
    const innerStroke     = variant === 'white' ? '#ffffff' : '#A5B4FC'
    const innerOpacity    = variant === 'white' ? 0.4 : 0.45

    // ── Wrapper gap scales with the icon size ─────────────────────────────────
    const gap = `${(size * 0.28).toFixed(1)}px`

    return (
        <span
            style={{
                display:    'inline-flex',
                alignItems: 'center',
                gap,
            }}
        >
            {/* ── SVG mark ────────────────────────────────────────────────── */}
            <svg
                width={size}
                height={size}
                viewBox="0 0 512 512"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                focusable="false"
            >
                {/* Gradient defs are only needed for the default variant */}
                {variant === 'default' && (
                    <defs>
                        <linearGradient
                            id={gradientId}
                            x1="80"
                            y1="80"
                            x2="432"
                            y2="432"
                            gradientUnits="userSpaceOnUse"
                        >
                            <stop offset="0%"   stopColor="#818CF8" />
                            <stop offset="45%"  stopColor="#4F46E5" />
                            <stop offset="100%" stopColor="#3730A3" />
                        </linearGradient>
                    </defs>
                )}

                {/* Outer arc — main brand stroke */}
                <path
                    d="M394 122C355 84 307 64 256 64C149 64 64 149 64 256C64 363 149 448 256 448C307 448 355 428 394 390"
                    stroke={outerStroke}
                    strokeWidth="48"
                    strokeLinecap="round"
                    fill="none"
                />

                {/* Inner arc — depth / shimmer layer; hidden in mono variant */}
                {showInner && (
                    <path
                        d="M374 146C341 113 300 96 256 96C167 96 96 167 96 256C96 345 167 416 256 416C300 416 341 399 374 366"
                        stroke={innerStroke}
                        strokeOpacity={innerOpacity}
                        strokeWidth="12"
                        strokeLinecap="round"
                        fill="none"
                    />
                )}
            </svg>

            {/* ── Wordmark ─────────────────────────────────────────────────── */}
            {showWordmark && (
                <span
                    style={{
                        fontSize:      `${wordmarkSize}px`,
                        fontWeight:    700,
                        fontFamily:    'ui-monospace, "Cascadia Code", Consolas, monospace',
                        color:         wordmarkColor,
                        letterSpacing: '0.08em',
                        lineHeight:    1,
                        userSelect:    'none',
                    }}
                >
                    CYCLO
                </span>
            )}
        </span>
    )
}

/**
 * LogoIcon — the Cyclo SVG mark with no wordmark.
 * Convenience wrapper around Logo with showWordmark={false}.
 */
export function LogoIcon(props: Omit<LogoProps, 'showWordmark'>) {
    return <Logo {...props} showWordmark={false} />
}

export default Logo
