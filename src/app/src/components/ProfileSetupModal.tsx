/**
 * ProfileSetupModal — merchant onboarding overlay shown on first login.
 *
 * Collects business name, email, and optional logo URL, then calls
 * saveProfile() from MerchantProfileContext.
 *
 * Class prefix: psm-
 */
import { useState } from 'react'
import { useMerchantProfile } from '../context/MerchantProfileContext'
import './ProfileSetupModal.css'

interface ProfileSetupModalProps {
    onComplete: () => void
}

export function ProfileSetupModal({ onComplete }: ProfileSetupModalProps) {
    const { saveProfile } = useMerchantProfile()

    const [businessName, setBusinessName] = useState('')
    const [email,        setEmail]        = useState('')
    const [logoUrl,      setLogoUrl]      = useState('')
    const [isPending,    setIsPending]    = useState(false)
    const [error,        setError]        = useState<string | null>(null)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setIsPending(true)
        try {
            await saveProfile(businessName, email, logoUrl || undefined)
            onComplete()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setIsPending(false)
        }
    }

    return (
        <div className="psm-overlay">
            <div className="psm-card">
                <h2 className="psm-title">Set up your merchant profile</h2>
                <p className="psm-subtitle">
                    Your business name and email will be visible to subscribers.
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="psm-field">
                        <label className="psm-label">Business name *</label>
                        <input
                            className="psm-input"
                            value={businessName}
                            onChange={e => setBusinessName(e.target.value)}
                            placeholder="Acme Inc."
                            required
                            disabled={isPending}
                        />
                    </div>

                    <div className="psm-field">
                        <label className="psm-label">Email *</label>
                        <input
                            className="psm-input"
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="billing@acme.com"
                            required
                            disabled={isPending}
                        />
                    </div>

                    <div className="psm-field">
                        <label className="psm-label">Logo URL (optional)</label>
                        <input
                            className="psm-input"
                            value={logoUrl}
                            onChange={e => setLogoUrl(e.target.value)}
                            placeholder="https://..."
                            disabled={isPending}
                        />
                    </div>

                    {error && <div className="psm-error">{error}</div>}

                    <div className="psm-actions">
                        <button
                            type="submit"
                            className="psm-btn-primary"
                            disabled={isPending}
                        >
                            {isPending ? 'Saving…' : 'Save profile'}
                        </button>
                        <button
                            type="button"
                            className="psm-btn-secondary"
                            onClick={onComplete}
                            disabled={isPending}
                        >
                            Skip
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
