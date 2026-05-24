/**
 * Wallet connect, address, USDC balance display, and merchant branding settings.
 */
import { useState, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { Link } from 'wouter'
import { ConnectButton, WalletStatus } from '../components/WalletStatus'
import { useSubscriptionManager } from '../hooks/useSubscriptionManager'
import { useMerchantProfile } from '../context/MerchantProfileContext'

// ── Validation ────────────────────────────────────────────────────────────────

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/

function isValidUrl(value: string): boolean {
    if (!value) return true // empty is fine (optional field)
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
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
            {toasts.map(t => (
                <div
                    key={t.id}
                    className={`flex items-start gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-xs pointer-events-auto ${
                        t.type === 'success' ? 'bg-gray-900 text-white' : 'bg-red-600 text-white'
                    }`}
                >
                    <span className="shrink-0 mt-px">{t.type === 'success' ? '✓' : '✕'}</span>
                    <span className="leading-snug">{t.message}</span>
                </div>
            ))}
        </div>
    )
}

// ── BrandingSection ───────────────────────────────────────────────────────────

function BrandingSection({ onToast }: { onToast: (type: 'success' | 'error', msg: string) => void }) {
    const { profile, saveBranding } = useMerchantProfile()

    const [brandName,       setBrandName]       = useState('')
    const [brandLogoUrl,    setBrandLogoUrl]     = useState('')
    const [brandColor,      setBrandColor]       = useState('#6366f1')
    const [customSubdomain, setCustomSubdomain]  = useState('')
    const [isPending,       setIsPending]        = useState(false)
    const [logoError,       setLogoError]        = useState(false)

    // Validation errors shown inline
    const [logoUrlErr,  setLogoUrlErr]  = useState('')
    const [colorErr,    setColorErr]    = useState('')

    // Initialise from profile once it loads — don't overwrite in-progress edits
    const initialized = useRef(false)
    useEffect(() => {
        if (profile && !initialized.current) {
            initialized.current = true
            setBrandName(profile.brand_name        ?? '')
            setBrandLogoUrl(profile.brand_logo_url ?? '')
            setBrandColor(profile.brand_color       ?? '#6366f1')
            setCustomSubdomain(profile.custom_subdomain ?? '')
        }
    }, [profile])

    // Live logo URL validation
    function handleLogoUrlChange(v: string) {
        setBrandLogoUrl(v)
        setLogoError(false)
        setLogoUrlErr(v && !isValidUrl(v) ? 'Must be a valid http/https URL' : '')
    }

    // Color picker always produces valid hex — guard the text path just in case
    function handleColorChange(v: string) {
        setBrandColor(v)
        setColorErr(v && !HEX_COLOR_RE.test(v) ? 'Must be a 6-digit hex color (e.g. #6366f1)' : '')
    }

    const logoPreviewValid = brandLogoUrl && isValidUrl(brandLogoUrl) && !logoError
    const hasErrors        = !!logoUrlErr || !!colorErr

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        if (hasErrors) return

        // Final client-side guard before submitting
        if (brandLogoUrl && !isValidUrl(brandLogoUrl)) {
            setLogoUrlErr('Must be a valid http/https URL')
            return
        }
        if (brandColor && !HEX_COLOR_RE.test(brandColor)) {
            setColorErr('Must be a 6-digit hex color (e.g. #6366f1)')
            return
        }

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
        <div className="bg-white border rounded-xl p-6 space-y-5">
            <div>
                <h2 className="text-base font-semibold text-gray-900">Branding</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                    Shown on your checkout page and subscriber portal.
                </p>
            </div>

            <form onSubmit={handleSave} className="space-y-4">

                {/* Brand name */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Brand name
                    </label>
                    <input
                        type="text"
                        value={brandName}
                        onChange={e => setBrandName(e.target.value)}
                        placeholder="Acme Pro"
                        disabled={isPending}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                    />
                </div>

                {/* Logo URL + live preview */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Logo URL
                    </label>
                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            value={brandLogoUrl}
                            onChange={e => handleLogoUrlChange(e.target.value)}
                            placeholder="https://cdn.example.com/logo.png"
                            disabled={isPending}
                            className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 ${
                                logoUrlErr ? 'border-red-300' : 'border-gray-200'
                            }`}
                        />
                        {logoPreviewValid && (
                            <img
                                src={brandLogoUrl}
                                alt="Logo preview"
                                onError={() => setLogoError(true)}
                                className="w-10 h-10 rounded-lg object-contain border border-gray-100 shrink-0 bg-gray-50"
                            />
                        )}
                    </div>
                    {logoUrlErr && (
                        <p className="text-xs text-red-600 mt-1">{logoUrlErr}</p>
                    )}
                </div>

                {/* Primary color */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Primary color
                    </label>
                    <div className="flex items-center gap-3">
                        {/* Native color picker — always produces a valid 6-digit hex */}
                        <input
                            type="color"
                            value={brandColor}
                            onChange={e => handleColorChange(e.target.value)}
                            disabled={isPending}
                            className="w-10 h-10 rounded-lg border border-gray-200 p-0.5 cursor-pointer disabled:opacity-50"
                            title="Pick a brand color"
                        />
                        {/* Hex text input kept in sync */}
                        <input
                            type="text"
                            value={brandColor}
                            onChange={e => handleColorChange(e.target.value)}
                            placeholder="#6366f1"
                            disabled={isPending}
                            maxLength={7}
                            className={`w-32 border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 ${
                                colorErr ? 'border-red-300' : 'border-gray-200'
                            }`}
                        />
                        {/* Swatch preview */}
                        {HEX_COLOR_RE.test(brandColor) && (
                            <span
                                className="w-8 h-8 rounded-lg border border-gray-200 shrink-0"
                                style={{ backgroundColor: brandColor }}
                            />
                        )}
                    </div>
                    {colorErr && (
                        <p className="text-xs text-red-600 mt-1">{colorErr}</p>
                    )}
                </div>

                {/* Custom subdomain */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Custom subdomain
                    </label>
                    <input
                        type="text"
                        value={customSubdomain}
                        onChange={e => setCustomSubdomain(e.target.value)}
                        placeholder="checkout.yourdomain.com"
                        disabled={isPending}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                    />
                    {/* CNAME info box */}
                    <div className="mt-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Point a <span className="font-mono font-medium text-gray-700">CNAME</span> record
                            from your subdomain to{' '}
                            <span className="font-mono font-medium text-gray-700">checkout.cyclo.xyz</span>{' '}
                            to activate custom domain checkout.
                        </p>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isPending || hasErrors}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isPending ? 'Saving…' : 'Save branding'}
                </button>
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
        <div className="max-w-md space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Connect wallet</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Connect an injected wallet (MetaMask or compatible) to use Cyclo on Arc testnet.
                </p>
            </div>

            <div className="bg-white border rounded-xl p-6">
                {isConnected && address ? (
                    <WalletStatus address={address} usdcBalance={usdcBalance} />
                ) : (
                    <ConnectButton />
                )}
            </div>

            {isConnected && (
                <div className="flex gap-3">
                    <Link href="/plans">
                        <a className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">
                            Create a plan →
                        </a>
                    </Link>
                    <Link href="/subscribers">
                        <a className="px-5 py-2.5 border border-indigo-600 text-indigo-600 rounded-lg text-sm hover:bg-indigo-50">
                            Subscribe to a plan →
                        </a>
                    </Link>
                </div>
            )}

            {/* Branding section — only shown when wallet is connected */}
            {isConnected && <BrandingSection onToast={addToast} />}

            <ToastStack toasts={toasts} />
        </div>
    )
}
