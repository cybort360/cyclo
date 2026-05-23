/**
 * Form for creating a new subscription plan.
 * Price is entered in whole USDC (e.g. "9.99") and converted to 6-decimal units.
 * Interval is chosen from a three-option segmented toggle (Weekly / Monthly / Yearly)
 * and stored internally as seconds; the user never sees the raw second value.
 * Trial duration is entered in days and converted to seconds.
 */
import { useState, useEffect, type FormEvent } from 'react';
import { toUsdcUnits, INTERVAL_WEEKLY, INTERVAL_MONTHLY, INTERVAL_YEARLY } from '../utils/formatting';

export interface CreatePlanInitialValues {
    price:        string;
    /** Days value from the AI parser (7 / 30 / 365). Mapped to the nearest preset. */
    intervalDays: string;
    trialDays:    string;
}

interface CreatePlanFormProps {
    isPending:     boolean;
    onCreate:      (price: bigint, interval: bigint, trialDuration: bigint) => Promise<void>;
    initialValues?: CreatePlanInitialValues;
}

/** The three interval presets. Order matches the toggle left→right layout. */
const INTERVAL_OPTIONS = [
    { label: 'Weekly',  seconds: String(INTERVAL_WEEKLY)  },
    { label: 'Monthly', seconds: String(INTERVAL_MONTHLY) },
    { label: 'Yearly',  seconds: String(INTERVAL_YEARLY)  },
] as const

type IntervalSeconds = (typeof INTERVAL_OPTIONS)[number]['seconds']

/**
 * Maps the AI parser's intervalDays (7 / 30 / 365) to the corresponding
 * preset seconds string. Defaults to Monthly for any unrecognised value.
 */
const DAYS_TO_SECONDS: Record<string, IntervalSeconds> = {
    '7':   String(INTERVAL_WEEKLY)  as IntervalSeconds,
    '30':  String(INTERVAL_MONTHLY) as IntervalSeconds,
    '365': String(INTERVAL_YEARLY)  as IntervalSeconds,
}

const inputStyle: React.CSSProperties = {
    padding:      '8px 12px',
    border:       '1px solid #e5e4e7',
    borderRadius: '6px',
    fontSize:     '15px',
    width:        '100%',
    boxSizing:    'border-box',
};

export function CreatePlanForm({ isPending, onCreate, initialValues }: CreatePlanFormProps) {
    const [price,    setPrice]    = useState('');
    const [interval, setInterval] = useState<IntervalSeconds>(String(INTERVAL_MONTHLY) as IntervalSeconds);
    const [trial,    setTrial]    = useState('');
    const [error,    setError]    = useState('');

    // Sync AI-suggested values into form state when the parent supplies them.
    useEffect(() => {
        if (!initialValues) return;
        setPrice(initialValues.price);
        setInterval(DAYS_TO_SECONDS[initialValues.intervalDays] ?? (String(INTERVAL_MONTHLY) as IntervalSeconds));
        setTrial(initialValues.trialDays);
    }, [initialValues]);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError('');

        const priceRaw  = toUsdcUnits(price);
        // interval is already in seconds — no day conversion needed
        const intervalSecs = BigInt(interval);
        const trialSecs    = trial.trim() === '' ? 0n : BigInt(Math.round(parseFloat(trial) * 86400));

        if (priceRaw === 0n) { setError('Price must be greater than zero.'); return; }

        try {
            await onCreate(priceRaw, intervalSecs, trialSecs);
            setPrice('');
            setInterval(String(INTERVAL_MONTHLY) as IntervalSeconds);
            setTrial('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Transaction failed.');
        }
    }

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontWeight: 600 }}>Price (USDC)</span>
                <input
                    type="number" step="0.000001" min="0" placeholder="e.g. 9.99"
                    value={price} onChange={e => setPrice(e.target.value)}
                    style={inputStyle} required
                />
            </label>

            {/* Billing interval — segmented toggle */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontWeight: 600 }}>Billing interval</span>
                <div style={{ display: 'flex', border: '1px solid #e5e4e7', borderRadius: '6px', overflow: 'hidden' }}>
                    {INTERVAL_OPTIONS.map((opt, idx) => (
                        <button
                            key={opt.seconds}
                            type="button"
                            onClick={() => setInterval(opt.seconds)}
                            style={{
                                flex:        1,
                                padding:     '8px 0',
                                border:      'none',
                                borderRight: idx < INTERVAL_OPTIONS.length - 1 ? '1px solid #e5e4e7' : 'none',
                                background:  interval === opt.seconds ? '#6366f1' : '#fff',
                                color:       interval === opt.seconds ? '#fff' : '#374151',
                                fontSize:    '14px',
                                fontWeight:  interval === opt.seconds ? 600 : 400,
                                cursor:      'pointer',
                                transition:  'background 0.15s, color 0.15s',
                            }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontWeight: 600 }}>Free trial (days) <span style={{ color: '#6b6375', fontWeight: 400 }}>— optional</span></span>
                <input
                    type="number" step="1" min="0" placeholder="e.g. 7  (leave blank for no trial)"
                    value={trial} onChange={e => setTrial(e.target.value)}
                    style={inputStyle}
                />
            </label>
            {trial !== '' && Number(trial) > 0 && (
                <p style={{ margin: 0, fontSize: '13px', color: '#6b6375' }}>
                    Subscribers get {trial} day{Number(trial) !== 1 ? 's' : ''} free before the first charge.
                </p>
            )}
            {error && <p style={{ color: '#dc2626', margin: 0, fontSize: '14px' }}>{error}</p>}
            <button
                type="submit" disabled={isPending}
                style={{ padding: '10px 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', cursor: isPending ? 'wait' : 'pointer', fontSize: '15px' }}
            >
                {isPending ? 'Submitting…' : 'Create Plan'}
            </button>
        </form>
    );
}
