/**
 * Wallet connection and merchant branding settings.
 * Styled with Cyclo design tokens (cp-* classes in ConnectPage.css).
 */
import { useState, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton, WalletStatus } from '../components/WalletStatus'
import { useSubscriptionManager } from '../hooks/useSubscriptionManager'
import { useMerchantProfile } from '../context/MerchantProfileContext'
import './ConnectPage.css'

// ── Validation ────────────────────────────────────────────────────────────────

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/

function isValidUrl(value: string): boolean {
    if (!value) return true
    try {
        const u = new URL(value)
        return u.protocol === 'http:' || u.protocol === 'https:'
    } catch {
        return false
    }
}

// ── Toast ─────────────────────────────────────────────────────────────────────

interface Toast { id: number; type: 'success' | 'error'; message: string }

function ToastStack({ toasts }: { toasts: Toast[] }) {
    if (toasts.length === 0) return null
    return (
        <div className="cp-toast-stack">
            {toasts.map(t => (
                <div key={t.id} className={`cp-toast cp-toast--${t.type}`}>
                    <span className="cp-toast-icon">{t.type === 'success' ? '✓' : '✕'}</span>
                    <span className="cp-toast-msg">{t.message}</span>
                </div>
            ))}
        </div>
    )
}

// ── BrandingSection ───────────────────────────────────────────────────────────

function BrandingSection({ onToast }: { onToast: (type: 'success' | 'error', msg: string) => void }) {
    const { profile, saveBranding } = useMerchantProfile()

    const [brandName,       setBrandName]      = useState('')
    const [brandLogoUrl,    setBrandLogoUrl]    = useState('')
    const [brandColor,      setBrandColor]      = useState('#6366f1')
    const [customSubdomain, setCustomSubdomain] = useState('')
    const [isPending,       setIsPending]       = useState(false)
    const [logoError,       setLogoError]       = useState(false)
    const [logoUrlErr,      setLogoUrlErr]      = useState('')
    const [colorErr,        setColorErr]        = useState('')

    const initialized = useRef(false)
    useEffect(() => {
        if (profile && !initialized.current) {
            initialized.current = true
            setBrandName(profile.brand_name        ?? '')
            setBrandLogoUrl(profile.brand_logo_url ?? '')
            setBrandColor(profile.brand_color      ?? '#6366f1')
            setCustomSubdomain(profile.custom_subdomain ?? '')
        }
    }, [profile])

    function handleLogoUrlChange(v: string) {
        setBrandLogoUrl(v)
        setLogoError(false)
        setLogoUrlErr(v && !isValidUrl(v) ? 'Must be a valid http/https URL' : '')
    }

    function handleColorChange(v: string) {
        setBrandColor(v)
        setColorErr(v && !HEX_COLOR_RE.test(v) ? 'Must be a 6-digit hex color (e.g. #6366f1)' : '')
    }

    const logoPreviewValid = brandLogoUrl && isValidUrl(brandLogoUrl) && !logoError
    const hasErrors        = !!logoUrlErr || !!colorErr

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        if (hasErrors) return
        if (brandLogoUrl && !isValidUrl(brandLogoUrl)) { setLogoUrlErr('Must be a valid http/https URL'); return }
        if (brandColor   && !HEX_COLOR_RE.test(brandColor)) { setColorErr('Must be a 6-digit hex color'); return }

        setIsPending(true)
        try {
            await saveBranding({ brandName, brandLogoUrl, brandColor, customSubdomain })
            onToast('success', 'Branding saved.')
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Save failed.'
            onToast('error', msg.length > 120 ? msg.slice(0, 117) + '…' : msg)
        } finally {
            setIsPending(false)
        }
    }

    return (
        <div className="cp-card">
            <div className="cp-brand-header">
                <h2 className="cp-brand-title">Branding</h2>
                <p className="cp-brand-sub">Shown on your checkout page and subscriber portal.</p>
            </div>

            <form onSubmit={handleSave} className="cp-form">

                {/* Brand name */}
                <div className="cp-field">
                    <label className="cp-label">Brand name</label>
                    <input
                        className="cp-input"
                        type="text"
                        value={brandName}
                        onChange={e => setBrandName(e.target.value)}
                        placeholder="Acme Pro"
                        disabled={isPending}
                    />
                </div>

                {/* Logo URL */}
                <div className="cp-field">
                    <label className="cp-label">Logo URL</label>
                    <div className="cp-logo-row">
                        <input
                            className={`cp-input${logoUrlErr ? ' cp-input--error' : ''}`}
                            type="text"
                            value={brandLogoUrl}
                            onChange={e => handleLogoUrlChange(e.target.value)}
                            placeholder="https://cdn.example.com/logo.png"
                            disabled={isPending}
                        />
                        {logoPreviewValid && (
                            <img
                                className="cp-logo-preview"
                                src={brandLogoUrl}
                                alt="Logo preview"
                                onError={() => setLogoError(true)}
                            />
                        )}
                    </div>
                    {logoUrlErr && <p className="cp-error">{logoUrlErr}</p>}
                </div>

                {/* Primary color */}
                <div className="cp-field">
                    <label className="cp-label">Primary color</label>
                    <div className="cp-color-row">
                        <input
                            className="cp-color-native"
                            type="color"
                            value={HEX_COLOR_RE.test(brandColor) ? brandColor : '#6366f1'}
                            onChange={e => handleColorChange(e.target.value)}
                            disabled={isPending}
                            title="Pick a brand color"
                        />
                        <input
                            className={`cp-input cp-input--mono cp-color-hex${colorErr ? ' cp-input--error' : ''}`}
                            type="text"
                            value={brandColor}
                            onChange={e => handleColorChange(e.target.value)}
                            placeholder="#6366f1"
                            disabled={isPending}
                            maxLength={7}
                        />
                        {HEX_COLOR_RE.test(brandColor) && (
                            <span className="cp-color-swatch" style={{ backgroundColor: brandColor }} />
                        )}
                    </div>
                    {colorErr && <p className="cp-error">{colorErr}</p>}
                </div>

                {/* Custom subdomain */}
                <div className="cp-field">
                    <label className="cp-label">Custom subdomain</label>
                    <input
                        className="cp-input cp-input--mono"
                        type="text"
                        value={customSubdomain}
                        onChange={e => setCustomSubdomain(e.target.value)}
                        placeholder="checkout.yourdomain.com"
                        disabled={isPending}
                    />
                    <div className="cp-cname-hint">
                        Point a <code>CNAME</code> record from your subdomain to{' '}
                        <code>checkout.cyclo.xyz</code> to activate custom domain checkout.
                    </div>
                </div>

                <div>
                    <button
                        className="cp-btn cp-btn-primary"
                        type="submit"
                        disabled={isPending || hasErrors}
                    >
                        {isPending ? 'Saving…' : 'Save branding'}
                    </button>
                </div>
            </form>
        </div>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ConnectPage() {
    const { isConnected } = useAccount()
    const { address, usdcBalance } = useSubscriptionManager()
    const [toasts, setToasts] = useState<Toast[]>([])

    function addToast(type: 'success' | 'error', message: string) {
        const id = Date.now()
        setToasts(prev => [...prev, { id, type, message }])
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4_000)
    }

    return (
        <div className="cp-page">
            <div className="cp-heading-block">
                <h1 className="cp-heading">Wallet &amp; Branding</h1>
                <p className="cp-sub">
                    Manage your connected wallet and customise your checkout identity.
                </p>
            </div>

            <div className="cp-card">
                {isConnected && address
                    ? <WalletStatus address={address} usdcBalance={usdcBalance} />
                    : <ConnectButton />
                }
            </div>

            {isConnected && <BrandingSection onToast={addToast} />}

            <ToastStack toasts={toasts} />
        </div>
    )
}
