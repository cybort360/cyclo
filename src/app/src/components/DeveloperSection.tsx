/**
 * "Developer love" section — two-column layout.
 *
 * Left column: eyebrow + headline + body copy.
 * Right column: dark code card with syntax-highlighted SDK snippet,
 *               three macOS-style dot decorations, and feature pills below.
 *
 * Code is rendered as a token array → spans to avoid needing a
 * syntax-highlight library while still matching the spec colour scheme.
 *
 * CSS: DeveloperSection.css — l- tokens only, no dark dashboard tokens.
 */
import { IconCheck } from '@tabler/icons-react'
import './DeveloperSection.css'

// ── Code snippet tokens ───────────────────────────────────────────────────────

type TokenType = 'kw' | 'str' | 'comment' | 'text' | 'punc' | 'nl'

interface Token {
    type:  TokenType
    value: string
}

/**
 * Syntax-tokenised form of the SDK example snippet.
 * 'nl' tokens are rendered as raw strings so <pre> preserves newlines.
 */
const CODE_TOKENS: Token[] = [
    { type: 'kw',      value: 'import'   },
    { type: 'punc',    value: ' { '      },
    { type: 'text',    value: 'CycloClient' },
    { type: 'punc',    value: ' } '      },
    { type: 'kw',      value: 'from'     },
    { type: 'text',    value: ' '        },
    { type: 'str',     value: "'@cyclo/sdk'" },
    { type: 'nl',      value: '\n\n'     },
    { type: 'kw',      value: 'const'    },
    { type: 'text',    value: ' client ' },
    { type: 'punc',    value: '='        },
    { type: 'text',    value: ' new CycloClient' },
    { type: 'punc',    value: '({'       },
    { type: 'nl',      value: '\n'       },
    { type: 'text',    value: '  contractAddress' },
    { type: 'punc',    value: ': '       },
    { type: 'text',    value: 'CYCLO_ADDRESS' },
    { type: 'punc',    value: ','        },
    { type: 'nl',      value: '\n'       },
    { type: 'text',    value: '  walletClient' },
    { type: 'nl',      value: '\n'       },
    { type: 'punc',    value: '})'       },
    { type: 'nl',      value: '\n\n'     },
    { type: 'comment', value: '// Subscribe — allowance handled automatically' },
    { type: 'nl',      value: '\n'       },
    { type: 'kw',      value: 'await'    },
    { type: 'text',    value: ' client'  },
    { type: 'punc',    value: '.'        },
    { type: 'text',    value: 'subscribe' },
    { type: 'punc',    value: '('        },
    { type: 'text',    value: 'planId'   },
    { type: 'punc',    value: ')'        },
]

// ── Feature pills ─────────────────────────────────────────────────────────────

const PILLS = ['TypeScript-first', 'Auto-allowance', 'React hooks included'] as const

// ── Code card sub-component ───────────────────────────────────────────────────

/** Dark code card with macOS dots + syntax-highlighted SDK snippet. */
function CodeCard() {
    return (
        <div className="dv-code-card">

            {/* Three-dot decorative bar */}
            <div className="dv-dots" aria-hidden="true">
                <span className="dv-dot dv-dot--red"   />
                <span className="dv-dot dv-dot--amber" />
                <span className="dv-dot dv-dot--green" />
            </div>

            {/* Syntax-highlighted code */}
            <pre className="dv-code" aria-label="Example CycloClient SDK usage"><code>{
                CODE_TOKENS.map((tok, i) =>
                    tok.type === 'nl'
                        ? tok.value
                        : <span key={i} className={`dv-tok--${tok.type}`}>{tok.value}</span>
                )
            }</code></pre>

        </div>
    )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DeveloperSection() {
    return (
        <section id="developers" className="dv-section">
            <div className="dv-inner">
                <div className="dv-grid">

                    {/* ── Left column ─────────────────────────────────────── */}
                    <div className="dv-left">
                        <span className="dv-eyebrow">For developers</span>
                        <h2 className="dv-h2">
                            Integrate in minutes.<br />
                            <em className="dv-h2-em">Not weeks.</em>
                        </h2>
                        <p className="dv-body">
                            No API key management. No backend integration. Just the contract
                            address and the SDK. Four lines of code to accept your first subscription.
                        </p>
                    </div>

                    {/* ── Right column ────────────────────────────────────── */}
                    <div className="dv-right">
                        <CodeCard />

                        {/* Feature pills below the code card */}
                        <div className="dv-pills">
                            {PILLS.map(label => (
                                <div key={label} className="dv-pill">
                                    <IconCheck
                                        size={14}
                                        className="dv-pill-icon"
                                        aria-hidden="true"
                                    />
                                    <span>{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </section>
    )
}
