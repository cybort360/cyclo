/**
 * Shareable standalone checkout page — accessible at /subscribe/:planId.
 * No tab bar. Works without a connected wallet for plan discovery;
 * connect + subscribe actions require wallet + correct chain.
 *
 * Branding is fetched from GET /api/checkout-brand?planId=<id> on mount and
 * applied cosmetically (color, logo, merchant name). All checkout logic is
 * unaffected by whether branding loads successfully.
 */
import { useAccount, useChainId, useReadContract, useSwitchChain } from 'wagmi';
import { SUBSCRIPTION_MANAGER_ABI } from '../constants/abis';
import { CONTRACT_ADDRESS } from '../constants/addresses';
import { fromUsdcUnits, intervalToLabel } from '../utils/formatting';
import { ConnectButton } from '../components/WalletStatus';
import { useSubscriptionManager, type PlanStruct, type SubscriptionStruct } from '../hooks/useSubscriptionManager';
import { arcTestnet } from '../wagmi';
import { useState, useEffect, useRef } from 'react';

type Address = `0x${string}`;

interface SubscribePageProps {
    planId: bigint;
}

// ── Branding ──────────────────────────────────────────────────────────────────

interface CheckoutBrand {
    brandName:       string | null
    brandLogoUrl:    string | null
    brandColor:      string | null
    merchantAddress: string
}

/** Fetches merchant branding for the given plan. Returns null on any failure. */
function useCheckoutBrand(planId: bigint): { brand: CheckoutBrand | null; loading: boolean } {
    const [brand,   setBrand]   = useState<CheckoutBrand | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch(`/api/checkout-brand?planId=${planId.toString()}`)
            .then(r => r.ok ? (r.json() as Promise<CheckoutBrand>) : null)
            .then(data => setBrand(data))
            .catch(() => setBrand(null))
            .finally(() => setLoading(false))
    }, [planId])

    return { brand, loading }
}

// ── Helpers ───────────────────────────────────────────────────────────────────


function formatTrialDuration(seconds: bigint): string {
    const days = Number(seconds) / 86400;
    return days === Math.floor(days) ? `${days}-day` : `${Number(seconds)}s`;
}

function truncateAddress(addr: string): string {
    return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

// ── Page meta ─────────────────────────────────────────────────────────────────

/**
 * Upserts a <meta property="…"> tag: updates content if it exists, creates
 * and appends it to <head> if it doesn't.
 */
function upsertMeta(property: string, content: string): void {
    let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
    if (!el) {
        el = document.createElement('meta')
        el.setAttribute('property', property)
        document.head.appendChild(el)
    }
    el.setAttribute('content', content)
}

/** Removes a <meta property="…"> tag if present. */
function removeMeta(property: string): void {
    document.querySelector(`meta[property="${property}"]`)?.remove()
}

/**
 * Sets document.title and Open Graph meta tags once branding has loaded.
 * A second empty-deps effect captures the original title and removes all
 * injected tags when the component unmounts — the first effect only needs to
 * update the DOM, not worry about cleanup on dep changes.
 */
function usePageMeta(
    brand:        CheckoutBrand | null,
    brandLoading: boolean,
    planId:       bigint,
    plan:         PlanStruct | undefined,
): void {
    // Captured synchronously at first render, before any effect runs.
    const originalTitle = useRef(document.title)

    // Update title + OG tags whenever branding or plan data changes.
    useEffect(() => {
        // Wait until the branding fetch has settled (loading skeleton visible).
        if (brandLoading) return

        const title = brand?.brandName
            ? `${brand.brandName} — Subscribe`
            : 'Subscribe via Cyclo'

        document.title = title
        upsertMeta('og:title', title)

        if (plan) {
            const price    = fromUsdcUnits(plan.price).toFixed(2)
            const interval = intervalToLabel(Number(plan.interval))
            upsertMeta(
                'og:description',
                `Subscribe to Plan ${planId.toString()} for ${price} USDC / ${interval}`,
            )
        }

        // Only set og:image when a logo URL is available; omit the tag otherwise.
        if (brand?.brandLogoUrl) {
            upsertMeta('og:image', brand.brandLogoUrl)
        } else {
            removeMeta('og:image')
        }
    }, [brandLoading, brand, planId, plan])

    // Restore defaults on unmount only — runs once, cleanup fires on teardown.
    useEffect(() => {
        const saved = originalTitle.current
        return () => {
            document.title = saved
            removeMeta('og:title')
            removeMeta('og:description')
            removeMeta('og:image')
        }
    }, [])
}

// ── Logo area ─────────────────────────────────────────────────────────────────

interface LogoAreaProps {
    loading:     boolean
    brandLogoUrl: string | null
}

function LogoArea({ loading, brandLogoUrl }: LogoAreaProps) {
    const [imgError, setImgError] = useState(false)

    if (loading) {
        return (
            <div style={{
                height: '48px', width: '120px', borderRadius: '8px',
                background: '#f4f3f6',
                animationName: 'checkout-skeleton-pulse',
                animationDuration: '1.5s',
                animationTimingFunction: 'ease-in-out',
                animationIterationCount: 'infinite',
            }} />
        )
    }

    if (brandLogoUrl && !imgError) {
        return (
            <img
                src={brandLogoUrl}
                alt="Merchant logo"
                onError={() => setImgError(true)}
                style={{ maxHeight: '48px', objectFit: 'contain', display: 'block' }}
            />
        )
    }

    // Fallback wordmark
    return (
        <span style={{ fontWeight: 700, fontSize: '17px', color: '#111' }}>
            Cyclo Checkout
        </span>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SubscribePage({ planId }: SubscribePageProps) {
    const { isConnected, address } = useAccount();
    const chainId                  = useChainId();
    const { switchChain }          = useSwitchChain();
    const { subscribeToPlan, isPending } = useSubscriptionManager();
    const onCorrectChain           = !isConnected || chainId === arcTestnet.id;
    const [error,      setError]      = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const { brand, loading: brandLoading } = useCheckoutBrand(planId)

    // Brand color with fallback to Cyclo's default primary
    const brandColor = brand?.brandColor ?? '#6366f1'

    const { data: planData, isLoading: planLoading } = useReadContract({
        address:      CONTRACT_ADDRESS as Address,
        abi:          SUBSCRIPTION_MANAGER_ABI,
        functionName: 'getPlan',
        args:         [planId],
    });

    const { data: subData, refetch: refetchSub } = useReadContract({
        address:      CONTRACT_ADDRESS as Address,
        abi:          SUBSCRIPTION_MANAGER_ABI,
        functionName: 'getSubscription',
        args:         address ? [planId, address] : undefined,
        query:        { enabled: !!address },
    });

    const plan         = planData as PlanStruct | undefined;
    const sub          = subData  as SubscriptionStruct | undefined;
    const planExists   = plan && plan.price > 0n;
    const isSubscribed = sub?.active === true;
    const hasTrial     = plan && plan.trialDuration > 0n;

    // Update <title> and OG meta tags once branding (and optionally plan) has loaded
    usePageMeta(brand, brandLoading, planId, plan)

    // Merchant display name: brand name → truncated address → contract address
    const merchantDisplay = brand?.brandName
        ?? (plan ? truncateAddress(plan.merchant) : null)

    async function handleSubscribe() {
        setError('');
        try {
            await subscribeToPlan(planId);
            await refetchSub();
            setSuccessMsg(hasTrial
                ? `Subscribed! Your ${formatTrialDuration(plan!.trialDuration)} free trial starts now.`
                : 'Subscribed successfully!');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Transaction failed.');
        }
    }

    return (
        // --brand-color is set here so all var(--brand-color) references below resolve
        <div style={{
            '--brand-color': brandColor,
            minHeight: '100vh', background: '#fafafa',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '32px 24px',
        } as React.CSSProperties}>

            {/* Skeleton pulse keyframe — injected once, scoped by name */}
            <style>{`
                @keyframes checkout-skeleton-pulse {
                    0%, 100% { opacity: 1; }
                    50%      { opacity: 0.45; }
                }
            `}</style>

            <div style={{ width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <a href="/" style={{ fontWeight: 700, fontSize: '20px', color: '#111', textDecoration: 'none' }}>Cyclo</a>
                    <a href="/dashboard" style={{ fontSize: '13px', color: '#6b6375', textDecoration: 'none' }}>← Back to app</a>
                </div>

                {planLoading && <p style={{ color: '#6b6375' }}>Loading plan…</p>}

                {!planLoading && !planExists && (
                    <div style={{ padding: '24px', border: '1px solid #e5e4e7', borderRadius: '12px', background: '#fff' }}>
                        <p style={{ color: '#dc2626', margin: 0 }}>Plan {planId.toString()} not found.</p>
                    </div>
                )}

                {planExists && plan && (
                    <div style={{ padding: '24px', border: '1px solid #e5e4e7', borderRadius: '12px', background: '#fff', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        {/* ── Merchant identity ────────────────────────────────── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {/* Logo — skeleton while loading, image or wordmark once resolved */}
                            <LogoArea loading={brandLoading} brandLogoUrl={brand?.brandLogoUrl ?? null} />

                            {/* Merchant name / address */}
                            {merchantDisplay && (
                                <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                    {merchantDisplay}
                                </div>
                            )}
                        </div>

                        {/* ── Plan details (unchanged) ─────────────────────────── */}
                        <div>
                            <div style={{ fontSize: '13px', color: '#6b6375', marginBottom: '4px' }}>Plan {planId.toString()}</div>
                            <div style={{ fontSize: '32px', fontWeight: 700 }}>{fromUsdcUnits(plan.price)} USDC</div>
                            <div style={{ color: '#6b6375', marginTop: '4px' }}>per {intervalToLabel(Number(plan.interval))}</div>
                        </div>

                        {hasTrial && (
                            <div style={{ padding: '10px 14px', background: '#eff6ff', borderRadius: '6px', color: '#1d4ed8', fontWeight: 600, fontSize: '14px' }}>
                                {formatTrialDuration(plan.trialDuration)} free trial — no charge until trial ends
                            </div>
                        )}

                        <div style={{ fontSize: '13px', color: '#6b6375' }}>
                            Merchant: <code style={{ fontSize: '12px' }}>{plan.merchant}</code>
                        </div>

                        {!plan.active && (
                            <div style={{ padding: '10px 14px', background: '#fef3c7', borderRadius: '6px', color: '#92400e', fontSize: '14px' }}>
                                This plan is no longer accepting new subscribers.
                            </div>
                        )}

                        <div style={{ borderTop: '1px solid #f4f3f6', paddingTop: '16px' }}>
                            {!isConnected && <ConnectButton />}

                            {isConnected && !onCorrectChain && (
                                <button onClick={() => switchChain({ chainId: arcTestnet.id })}
                                    style={{ width: '100%', padding: '12px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: 600 }}>
                                    Switch to Arc Testnet
                                </button>
                            )}

                            {isConnected && onCorrectChain && isSubscribed && sub && (
                                <div style={{ padding: '12px 16px', background: '#f0fdf4', borderRadius: '8px', color: '#166534', fontSize: '14px' }}>
                                    ✓ You are subscribed — next charge: {new Date(Number(sub.nextChargeTimestamp) * 1000).toLocaleDateString()}
                                </div>
                            )}

                            {/* Subscribe button — uses brand color */}
                            {isConnected && onCorrectChain && !isSubscribed && plan.active && (
                                <button onClick={handleSubscribe} disabled={isPending}
                                    style={{ width: '100%', padding: '14px', background: 'var(--brand-color)', color: '#fff', border: 'none', borderRadius: '8px', cursor: isPending ? 'wait' : 'pointer', fontSize: '16px', fontWeight: 600 }}>
                                    {isPending
                                        ? 'Processing…'
                                        : hasTrial
                                            ? `Start ${formatTrialDuration(plan.trialDuration)} Free Trial`
                                            : 'Approve & Subscribe'}
                                </button>
                            )}

                            {error      && <p style={{ color: '#dc2626', margin: '12px 0 0', fontSize: '14px' }}>{error}</p>}
                            {successMsg && <p style={{ color: '#16a34a', margin: '12px 0 0', fontSize: '14px' }}>{successMsg}</p>}
                            {successMsg && (
                                <a href="/portal" style={{ display: 'block', marginTop: '8px', color: 'var(--brand-color)', fontSize: '14px', textDecoration: 'none' }}>
                                    View and manage all your subscriptions →
                                </a>
                            )}
                        </div>
                    </div>
                )}

                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <p style={{ fontSize: '12px', color: '#6b6375', margin: 0 }}>
                        Powered by Cyclo — on-chain recurring billing on Arc testnet
                    </p>
                    <a href="/portal" style={{ fontSize: '12px', color: '#6b6375', textDecoration: 'underline' }}>
                        Already subscribed? Manage your subscriptions
                    </a>
                </div>
            </div>
        </div>
    );
}
