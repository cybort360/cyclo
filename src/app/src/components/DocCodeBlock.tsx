/**
 * Shared UI primitives for developer documentation pages.
 *
 * CodeBlock  — dark code block with highlight.js syntax highlighting (github-dark
 *              theme, loaded from cdnjs) and a copy-on-hover button.
 * DocStep    — numbered step with an indigo badge, used in procedural guides.
 * CopyButton — inline copy-to-clipboard button with a 2-second flash state.
 */
import { useState, useEffect, useRef, useCallback } from 'react'

// ── highlight.js lazy loader ──────────────────────────────────────────────────

type HljsGlobal = { highlightElement: (el: Element) => void }

const HLJS_VERSION = '11.9.0'
const HLJS_BASE    = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/${HLJS_VERSION}`

/**
 * Module-level singleton so CSS + JS are injected exactly once regardless of
 * how many CodeBlock instances mount concurrently.
 */
let hljsPromise: Promise<HljsGlobal> | null = null

/**
 * Loads the highlight.js CSS (github-dark) and JS bundle from cdnjs.
 * Returns the hljs global; subsequent callers receive the cached promise.
 */
function loadHljs(): Promise<HljsGlobal> {
    if (hljsPromise) return hljsPromise

    hljsPromise = new Promise<HljsGlobal>((resolve, reject) => {
        if (!document.getElementById('hljs-css')) {
            const link = document.createElement('link')
            link.id   = 'hljs-css'
            link.rel  = 'stylesheet'
            link.href = `${HLJS_BASE}/styles/github-dark.min.css`
            document.head.appendChild(link)
        }

        const win = window as unknown as { hljs?: HljsGlobal }
        if (win.hljs) { resolve(win.hljs); return }

        const script   = document.createElement('script')
        script.src     = `${HLJS_BASE}/highlight.min.js`
        script.onload  = () => {
            const hljs = (window as unknown as { hljs?: HljsGlobal }).hljs
            if (hljs) resolve(hljs)
            else reject(new Error('hljs missing from window after load'))
        }
        script.onerror = () => reject(new Error('highlight.js CDN request failed'))
        document.head.appendChild(script)
    })

    return hljsPromise
}

// ── CodeBlock ─────────────────────────────────────────────────────────────────

interface CodeBlockProps {
    /** Source code to display and highlight. */
    code:      string
    /** highlight.js language identifier. Defaults to 'typescript'. */
    language?: string
}

/**
 * Dark code block with syntax highlighting applied after highlight.js loads.
 * The block is always readable as plain text if the CDN request fails.
 * A copy-to-clipboard button fades in on hover.
 */
export function CodeBlock({ code, language = 'typescript' }: CodeBlockProps) {
    const codeRef               = useRef<HTMLElement>(null)
    const [copied,  setCopied]  = useState(false)
    const [hovered, setHovered] = useState(false)

    useEffect(() => {
        const el = codeRef.current
        if (!el) return
        loadHljs()
            .then(hljs => {
                // Remove the attribute hljs sets on highlighted elements so
                // it will re-process when the code or language prop changes.
                el.removeAttribute('data-highlighted')
                hljs.highlightElement(el)
            })
            .catch(() => { /* plain text is still readable — fail silently */ })
    }, [code, language])

    const copy = useCallback(() => {
        void navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }, [code])

    return (
        <div
            className="relative rounded-xl overflow-hidden my-4"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <pre className="m-0 text-[13px] leading-relaxed overflow-x-auto bg-[#0d1117] p-5">
                <code ref={codeRef} className={`language-${language}`}>
                    {code}
                </code>
            </pre>
            <button
                onClick={copy}
                aria-label="Copy code to clipboard"
                className={`absolute top-3 right-3 text-[11px] px-2.5 py-1 rounded-md
                    bg-white/10 text-gray-300 border border-white/10
                    hover:bg-white/20 transition-all duration-150
                    ${hovered ? 'opacity-100' : 'opacity-0'}`}
            >
                {copied ? 'Copied!' : 'Copy'}
            </button>
        </div>
    )
}

// ── DocStep ───────────────────────────────────────────────────────────────────

interface DocStepProps {
    /** Step number displayed in the badge. */
    n:        number
    /** Bold step title. */
    title:    string
    children: React.ReactNode
}

/** Numbered step row with an indigo badge, for procedural guides. */
export function DocStep({ n, title, children }: DocStepProps) {
    return (
        <div className="flex gap-4">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center mt-0.5">
                <span className="text-white text-[11px] font-bold tabular-nums">{n}</span>
            </div>
            <div className="flex-1 min-w-0 pb-8 last:pb-0">
                <p className="text-sm font-semibold text-gray-900 mb-1">{title}</p>
                {children}
            </div>
        </div>
    )
}

// ── CopyButton ────────────────────────────────────────────────────────────────

interface CopyButtonProps {
    /** Text written to the clipboard on click. */
    value: string
}

/** Compact inline copy-to-clipboard button with a 2-second "Copied!" flash. */
export function CopyButton({ value }: CopyButtonProps) {
    const [copied, setCopied] = useState(false)

    function copy() {
        void navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <button
            onClick={copy}
            className="ml-2 shrink-0 text-[11px] px-2 py-0.5 rounded border border-gray-200
                text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors"
        >
            {copied ? 'Copied!' : 'Copy'}
        </button>
    )
}
