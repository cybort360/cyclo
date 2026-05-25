/**
 * Form for creating a new subscription plan.
 *
 * Price is entered in whole USDC (e.g. "9.99") and converted to 6-decimal units.
 * Interval is chosen from a three-pill segmented toggle (Weekly / Monthly / Yearly).
 * Trial duration is entered in days and converted to seconds.
 *
 * The optional AI strip sends the natural-language input to /api/ai/parse-plan
 * and pre-fills all fields with the parsed values.
 *
 * Class prefix: cpf-
 */
import { useState, useEffect, type FormEvent } from 'react'
import { toUsdcUnits, INTERVAL_WEEKLY, INTERVAL_MONTHLY, INTERVAL_YEARLY } from '../utils/formatting'
import './CreatePlanForm.css'
import { API_BASE } from '../utils/apiBase'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreatePlanInitialValues {
    price:        string
    /** Days value from the AI parser (7 / 30 / 365). Mapped to the nearest preset. */
    intervalDays: string
    trialDays:    string
}

interface CreatePlanFormProps {
    isPending:      boolean
    onCreate:       (price: bigint, interval: bigint, trialDuration: bigint) => Promise<void>
    initialValues?: CreatePlanInitialValues
}

// ── Constants ─────────────────────────────────────────────────────────────────

const INTERVAL_OPTIONS = [
    { label: 'Weekly',  seconds: String(INTERVAL_WEEKLY)  },
    { label: 'Monthly', seconds: String(INTERVAL_MONTHLY) },
    { label: 'Yearly',  seconds: String(INTERVAL_YEARLY)  },
] as const

type IntervalSeconds = (typeof INTERVAL_OPTIONS)[number]['seconds']

const DAYS_TO_SECONDS: Record<string, IntervalSeconds> = {
    '7':   String(INTERVAL_WEEKLY)  as IntervalSeconds,
    '30':  String(INTERVAL_MONTHLY) as IntervalSeconds,
    '365': String(INTERVAL_YEARLY)  as IntervalSeconds,
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CreatePlanForm({ isPending, onCreate, initialValues }: CreatePlanFormProps) {
    // STUB: planName is display-only — SubscriptionManager contract does not
    // persist plan names on-chain. Stored locally only until contract supports it.
    const [planName, setPlanName] = useState('')
    const [price,    setPrice]    = useState('')
    const [interval, setInterval] = useState<IntervalSeconds>(String(INTERVAL_MONTHLY) as IntervalSeconds)
    const [trial,    setTrial]    = useState('')
    const [error,    setError]    = useState('')

    // AI strip state
    const [nlInput,  setNlInput]  = useState('')
    const [parsing,  setParsing]  = useState(false)

    // Sync AI-suggested values into form state when the parent supplies them.
    useEffect(() => {
        if (!initialValues) return
        setPrice(initialValues.price)
        setInterval(DAYS_TO_SECONDS[initialValues.intervalDays] ?? (String(INTERVAL_MONTHLY) as IntervalSeconds))
        setTrial(initialValues.trialDays)
    }, [initialValues])

    /** Sends the NL input to the AI endpoint and pre-fills form fields. */
    async function parseNaturalLanguage(): Promise<void> {
        if (!nlInput.trim()) return
        setParsing(true)
        try {
            const res  = await fetch(`${API_BASE}/api/ai/parse-plan`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ input: nlInput }),
            })
            const data = await res.json() as { price: number; intervalDays: number; trialDays: number }
            setPrice(String(data.price))
            setInterval(DAYS_TO_SECONDS[String(data.intervalDays)] ?? (String(INTERVAL_MONTHLY) as IntervalSeconds))
            setTrial(String(data.trialDays))
            setNlInput('')
        } finally {
            setParsing(false)
        }
    }

    async function handleSubmit(e: FormEvent): Promise<void> {
        e.preventDefault()
        setError('')
        const priceRaw    = toUsdcUnits(price)
        const intervalSec = BigInt(interval)
        const trialSec    = trial.trim() === '' ? 0n : BigInt(Math.round(parseFloat(trial) * 86_400))
        if (priceRaw === 0n) { setError('Price must be greater than zero.'); return }
        try {
            await onCreate(priceRaw, intervalSec, trialSec)
            setPlanName(''); setPrice(''); setInterval(String(INTERVAL_MONTHLY) as IntervalSeconds); setTrial('')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Transaction failed.')
        }
    }

    return (
        <form className="cpf-form" onSubmit={handleSubmit}>

            {/* AI strip */}
            <div className="cpf-ai-strip">
                <span className="cpf-ai-label">✦ AI</span>
                <input
                    className="cpf-ai-input"
                    value={nlInput}
                    onChange={e => setNlInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void parseNaturalLanguage() } }}
                    placeholder='e.g. "monthly plan $9.99 with 7-day trial"'
                />
                <button
                    type="button"
                    className="cpf-ai-btn"
                    onClick={() => void parseNaturalLanguage()}
                    disabled={parsing || !nlInput.trim()}
                >
                    {parsing ? '…' : 'Fill'}
                </button>
            </div>

            {/* Plan name — display only */}
            <label className="cpf-field">
                <span className="cpf-label">Plan name <span className="cpf-label-opt">— optional</span></span>
                <input
                    className="cpf-input"
                    type="text"
                    placeholder="e.g. Pro monthly"
                    value={planName}
                    onChange={e => setPlanName(e.target.value)}
                />
            </label>

            {/* Price */}
            <label className="cpf-field">
                <span className="cpf-label">Price (USDC)</span>
                <input
                    className="cpf-input"
                    type="number" step="0.000001" min="0"
                    placeholder="e.g. 9.99"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    required
                />
            </label>

            {/* Billing interval */}
            <div className="cpf-field">
                <span className="cpf-label">Billing interval</span>
                <div className="cpf-toggle" role="group" aria-label="Billing interval">
                    {INTERVAL_OPTIONS.map(opt => (
                        <button
                            key={opt.seconds}
                            type="button"
                            className={`cpf-toggle-btn${interval === opt.seconds ? ' cpf-toggle-btn--active' : ''}`}
                            onClick={() => setInterval(opt.seconds)}
                            aria-pressed={interval === opt.seconds}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Free trial */}
            <label className="cpf-field">
                <span className="cpf-label">Free trial (days) <span className="cpf-label-opt">— optional</span></span>
                <input
                    className="cpf-input"
                    type="number" step="1" min="0"
                    placeholder="e.g. 7  (leave blank for no trial)"
                    value={trial}
                    onChange={e => setTrial(e.target.value)}
                />
            </label>

            {trial !== '' && Number(trial) > 0 && (
                <p className="cpf-trial-hint">
                    Subscribers get {trial} day{Number(trial) !== 1 ? 's' : ''} free before the first charge.
                </p>
            )}

            {error && <p className="cpf-error">{error}</p>}

            <button type="submit" className="cpf-submit" disabled={isPending}>
                {isPending ? 'Submitting…' : 'Create plan'}
            </button>
        </form>
    )
}
