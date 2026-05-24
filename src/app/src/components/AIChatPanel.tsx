/**
 * AIChatPanel — floating assistant panel that opens above the right-panel footer.
 *
 * Styled with Ivory & Indigo dashboard tokens (no Tailwind).
 * The trigger button lives in the right panel's footer; this component is the
 * floating card that appears above it when open.
 *
 * Class prefix: ai-  (CSS in AIChatPanel.css)
 */
import { useState, useRef, useEffect } from 'react'
import { useAccount } from 'wagmi'
import './AIChatPanel.css'

interface Message {
    role:    'user' | 'assistant'
    content: string
}

const SUGGESTIONS = [
    'What is my MRR this month?',
    'How many subscribers do I have?',
    'Which plan is performing best?',
    'Are any subscribers at risk of churning?',
    'Show me recent failed payments',
]

export function AIChatPanel({ onClose }: { onClose: () => void }) {
    const { address }                   = useAccount()
    const [messages, setMessages]       = useState<Message[]>([])
    const [input,    setInput]          = useState('')
    const [loading,  setLoading]        = useState(false)
    const bottomRef                     = useRef<HTMLDivElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, loading])

    async function send(text: string): Promise<void> {
        if (!text.trim() || !address) return

        const userMsg: Message = { role: 'user', content: text }
        const updated = [...messages, userMsg]
        setMessages(updated)
        setInput('')
        setLoading(true)

        try {
            const res  = await fetch('/api/ai/chat', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    walletAddress: address,
                    messages:      updated.map(m => ({ role: m.role, content: m.content })),
                }),
            })
            const data = await res.json() as { reply?: string }
            setMessages(prev => [...prev, {
                role:    'assistant',
                content: data.reply ?? 'No response generated.',
            }])
        } catch {
            setMessages(prev => [...prev, {
                role:    'assistant',
                content: 'Something went wrong. Please try again.',
            }])
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="ai-panel" role="dialog" aria-label="Cyclo AI assistant">

            {/* ── Header ─────────────────────────────────────────── */}
            <div className="ai-header">
                <div className="ai-header-left">
                    <div className="ai-icon" aria-hidden="true">✦</div>
                    <p className="ai-title">Cyclo AI</p>
                    <span className="ai-badge">BETA</span>
                </div>
                <button
                    onClick={onClose}
                    className="ai-close"
                    aria-label="Close AI assistant"
                >
                    ×
                </button>
            </div>

            {/* ── Messages ───────────────────────────────────────── */}
            <div className="ai-messages">
                {messages.length === 0 && (
                    <>
                        <p className="ai-empty-hint">
                            Ask anything about your<br />revenue, subscribers, or payments.
                        </p>
                        {SUGGESTIONS.map(s => (
                            <button
                                key={s}
                                onClick={() => send(s)}
                                className="ai-suggestion"
                            >
                                {s}
                            </button>
                        ))}
                    </>
                )}

                {messages.map((m, i) => (
                    <div key={i} className={`ai-bubble-row ai-bubble-row--${m.role}`}>
                        <p className={`ai-bubble ai-bubble--${m.role}`}>
                            {m.content}
                        </p>
                    </div>
                ))}

                {loading && (
                    <div className="ai-typing" aria-label="Thinking…">
                        <span className="ai-dot" />
                        <span className="ai-dot" />
                        <span className="ai-dot" />
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            {/* ── Input ──────────────────────────────────────────── */}
            <form
                className="ai-input-row"
                onSubmit={e => { e.preventDefault(); void send(input) }}
            >
                <input
                    className="ai-input"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Ask about your revenue…"
                    disabled={loading}
                    aria-label="Message Cyclo AI"
                />
                <button
                    type="submit"
                    className="ai-send"
                    disabled={loading || !input.trim()}
                    aria-label="Send"
                >
                    ↑
                </button>
            </form>

        </div>
    )
}
