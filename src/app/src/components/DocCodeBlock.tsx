/**
 * Shared UI primitives for developer documentation pages.
 *
 * CodeBlock  — dark code block with a top bar (language label + copy button)
 *              and highlight.js syntax highlighting (github-dark theme, CDN).
 * DocStep    — numbered step with an accent circle badge.
 * CopyButton — compact inline clipboard button with 2-second flash state.
 *
 * Class prefix: dcb-
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { IconCopy } from '@tabler/icons-react'
import './DocCodeBlock.css'

// ── highlight.js lazy loader ──────────────────────────────────────────────────

type HljsGlobal = { highlightElement: (el: Element) => void }

const HLJS_VERSION      = '11.9.0'
const HLJS_BASE         = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/${HLJS_VERSION}`
const HLJS_SOLIDITY_SRC = `${HLJS_BASE}/languages/solidity.min.js`

/**
 * Module-level singleton so CSS + JS are injected exactly once regardless of
 * how many CodeBlock instances mount concurrently.
 */
let hljsPromise: Promise<HljsGlobal> | null = null

/**
 * Lazy-loads the Solidity language grammar for highlight.js.
 * No-ops if the script tag is already in the document.
 * Must be called after loadHljs() resolves (grammar requires the core bundle).
 */
function loadSolidityGrammar(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        if (document.querySelector(`script[src="${HLJS_SOLIDITY_SRC}"]`)) { resolve(); return }
        const script   = document.createElement('script')
        script.src     = HLJS_SOLIDITY_SRC
        script.onload  = () => resolve()
        script.onerror = () => reject(new Error('Solidity grammar CDN request failed'))
        document.head.appendChild(script)
    })
}

/**
 * Loads the highlight.js CSS (github-dark) and JS bundle from cdnjs.
 * Returns the hljs global; subsequent callers receive the cached promise.
 */
function loadHljs(): Promise<HljsGlobal> {
    if (hljsPromise) return hljsPromise

    hljsPromise = new Promise<HljsGlobal>((resolve, reject) => {
        if (!document.getElementById('hljs-css')) {
            const link  = document.createElement('link')
            link.id     = 'hljs-css'
            link.rel    = 'stylesheet'
            link.href   = `${HLJS_BASE}/styles/github-dark.min.css`
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
 * Dark code block with a top bar showing language label and a copy button.
 * Syntax highlighting is applied once highlight.js loads from CDN.
 * The block is always readable as plain text if the CDN request fails.
 */
export function CodeBlock({ code, language = 'typescript' }: CodeBlockProps) {
    const codeRef              = useRef<HTMLElement>(null)
    const [copied, setCopied]  = useState(false)

    useEffect(() => {
        const el = codeRef.current
        if (!el) return

        function applyHighlight(hljs: HljsGlobal): void {
            el!.removeAttribute('data-highlighted')
            hljs.highlightElement(el!)
        }

        const load = language === 'solidity'
            ? loadHljs().then(hljs => loadSolidityGrammar().then(() => applyHighlight(hljs)))
            : loadHljs().then(applyHighlight)

        load.catch(() => { /* plain text is still readable — fail silently */ })
    }, [code, language])

    const copy = useCallback(() => {
        void navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2_000)
    }, [code])

    return (
        <div className="dcb-block">
            <div className="dcb-topbar">
                <span className="dcb-lang">{language}</span>
                <button
                    onClick={copy}
                    aria-label="Copy code to clipboard"
                    className={`dcb-copy-btn${copied ? ' dcb-copy-btn--copied' : ''}`}
                >
                    <IconCopy size={11} aria-hidden="true" />
                    {copied ? 'Copied!' : 'Copy'}
                </button>
            </div>
            <pre className="dcb-pre">
                <code ref={codeRef} className={`language-${language}`}>
                    {code}
                </code>
            </pre>
        </div>
    )
}

// ── DocStep ───────────────────────────────────────────────────────────────────

interface DocStepProps {
    /** Step number displayed in the accent badge. */
    n:        number
    /** Bold step title. */
    title:    string
    children: React.ReactNode
}

/** Numbered step row with an accent circle badge, for procedural guides. */
export function DocStep({ n, title, children }: DocStepProps) {
    return (
        <div className="dcb-step">
            <div className="dcb-step-badge" aria-hidden="true">
                <span className="dcb-step-num">{n}</span>
            </div>
            <div className="dcb-step-body">
                <p className="dcb-step-title">{title}</p>
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

    function copy(): void {
        void navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 2_000)
    }

    return (
        <button
            onClick={copy}
            className={`dcb-inline-copy${copied ? ' dcb-inline-copy--copied' : ''}`}
            aria-label={`Copy ${value}`}
        >
            <IconCopy size={10} aria-hidden="true" />
            {copied ? 'Copied!' : 'Copy'}
        </button>
    )
}
