/**
 * Standalone checkout page — /subscribe/:planId.
 * Branding fetched from GET /api/checkout-brand?planId=<id>.
 * Pre-flight eth_call surfaces balance/allowance issues inline.
 * Transaction phases: idle → awaiting-wallet → awaiting-chain → success.
 *
 * Class prefix: co-  (CSS in SubscribePage.css)
 */
import { useAccount, useChainId, useReadContract, useSwitchChain } from 'wagmi'
import { useState } from 'react'
import { SUBSCRIPTION_MANAGER_ABI } from '../constants/abis'
import { CONTRACT_ADDRESS } from '../constants/addresses'
import { fromUsdcUnits, intervalToLabel } from '../utils/formatting'
import { ConnectButton } from '../components/WalletStatus'
import { useSubscriptionManager, type PlanStruct, type SubscriptionStruct } from '../hooks/useSubscriptionManager'
import { useCheckoutBrand, usePageMeta } from '../hooks/useCheckoutBrand'
import { CheckoutLogoArea } from '../components/CheckoutLogoArea'
import { CheckoutPreFlight } from '../components/CheckoutPreFlight'
import { CheckoutSuccess } from '../components/CheckoutSuccess'
import Logo from '../components/Logo'
import { usePreFlight } from '../hooks/usePreFlight'
import { useIsSubscribed } from '@cyclo/react'
import { parseSubscribeError, type ParsedSubscribeError } from '../utils/parseSubscribeError'
import { arcTestnet } from '../wagmi'
import './SubscribePage.css'

type Address = `0x${string}`
type TxPhase  = 'idle' | 'awaiting-wallet' | 'awaiting-chain' | 'success'

interface SubscribePageProps {
    planId: bigint
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTrialDuration(seconds: bigint): string {
    const days = Number(seconds) / 86_400
    return days === Math.floor(days) ? `${days}-day` : `${Number(seconds)}s`
}

function truncateAddress(addr: string): string {
    return `${addr.slice(0, 8)}…${addr.slice(-6)}`
}

/** Allows only http/https return URLs from the ?return= query param. */
function safeReturnUrl(raw: string | null): string | null {
    try {
        const { protocol } = new URL(raw ?? '')
        return /^https?:$/.test(protocol) ? raw : null
    } catch {
        return null
    }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SubscribePage({ planId }: SubscribePageProps) {
    const { isConnected, address } = useAccount()
    const chainId                  = useChainId()
    const { switchChain }          = useSwitchChain()
    const { subscribeToPlan }      = useSubscriptionManager()
    const onCorrectChain           = !isConnected || chainId === arcTestnet.id

    const [txPhase,        setTxPhase]        = useState<TxPhase>('idle')
    const [subscribeError, setSubscribeError] = useState<ParsedSubscribeError | null>(null)

    const returnUrl  = safeReturnUrl(new URLSearchParams(window.location.search).get('return'))
    const { brand, loading: brandLoading } = useCheckoutBrand(planId)

    const { data: planData, isLoading: planLoading } = useReadContract({
        address:      CONTRACT_ADDRESS as Address,
        abi:          SUBSCRIPTION_MANAGER_ABI,
        functionName: 'getPlan',
        args:         [planId],
    })

    const { data: subData, refetch: refetchSub } = useReadContract({
        address:      CONTRACT_ADDRESS as Address,
        abi:          SUBSCRIPTION_MANAGER_ABI,
        functionName: 'getSubscription',
        args:         address ? [planId, address] : undefined,
        query:        { enabled: !!address },
    })

    const plan         = planData as PlanStruct | undefined
    const sub          = subData  as SubscriptionStruct | undefined
    const planExists   = plan && plan.price > 0n
    const isSubscribed = sub?.active === true
    const hasTrial     = plan && plan.trialDuration > 0n

    usePageMeta(brand, brandLoading, planId, plan)

    const merchantDisplay = brand?.brandName
        ?? (plan ? truncateAddress(plan.merchant) : null)

    const preFlightEnabled = isConnected && onCorrectChain && !isSubscribed && (plan?.active ?? false)
    const preflight        = usePreFlight(planId, preFlightEnabled ? address : undefined)
    const { isSubscribed: hasNft } = useIsSubscribed(address, planId)
    const isPending = txPhase === 'awaiting-wallet' || txPhase === 'awaiting-chain'

    async function handleSubscribe(): Promise<void> {
        setSubscribeError(null)
        setTxPhase('awaiting-wallet')
        try {
            await subscribeToPlan(planId, () => setTxPhase('awaiting-chain'))
            await refetchSub()
            setTxPhase('success')
        } catch (err) {
            setTxPhase('idle')
            setSubscribeError(parseSubscribeError(err))
        }
    }

    return (
        <div className="co-outer">
            <div className="co-inner">

                {/* ── Nav ─────────────────────────────────────────────── */}
                <div className="co-nav">
                    <a href="/" className="co-wordmark">CYCLO</a>
                    <a href="/dashboard" className="co-back-link">← Back to app</a>
                </div>

                {planLoading && <p className="co-loading">Loading plan…</p>}

                {!planLoading && !planExists && (
                    <div className="co-card">
                        <p className="co-inactive">Plan {planId.toString()} not found.</p>
                    </div>
                )}

                {planExists && plan && (
                    <div className="co-card">

                        {/* ── Cyclo attribution ────────────────────────── */}
                        {!brandLoading && (() => {
                            const hasBrand = !!(brand?.brandLogoUrl || brand?.brandName)
                            return hasBrand ? (
                                <div className="co-cyclo-header">
                                    <span className="co-powered-by">Powered by</span>
                                    <Logo size={16} wordmarkSize={11} wordmarkColor="var(--text-secondary)" />
                                </div>
                            ) : (
                                <div className="co-cyclo-header co-cyclo-header--prominent">
                                    <Logo size={28} wordmarkSize={16} />
                                </div>
                            )
                        })()}

                        {/* ── Merchant branding ────────────────────────── */}
                        <div className="co-brand">
                            <CheckoutLogoArea loading={brandLoading} brandLogoUrl={brand?.brandLogoUrl ?? null} />
                            {merchantDisplay && (
                                <p className="co-merchant-name">{merchantDisplay}</p>
                            )}
                        </div>

                        {/* ── Plan details ─────────────────────────────── */}
                        <div className="co-plan-section">
                            <p className="co-plan-name">Plan {planId.toString()}</p>

                            <div className="co-price-row">
                                <span className="co-price">
                                    {fromUsdcUnits(plan.price).toFixed(2)}
                                </span>
                                <span className="co-interval">
                                    / {intervalToLabel(Number(plan.interval))}
                                </span>
                            </div>

                            {hasTrial && (
                                <span className="co-trial-badge">
                                    {formatTrialDuration(plan.trialDuration)} free trial
                                </span>
                            )}

                            <p className="co-merchant-addr">
                                Merchant: <code>{plan.merchant}</code>
                            </p>

                            {!plan.active && (
                                <div className="co-inactive">
                                    This plan is no longer accepting new subscribers.
                                </div>
                            )}
                        </div>

                        <hr className="co-divider" />

                        {/* ── Action area ──────────────────────────────── */}
                        <div className="co-action">
                            {txPhase === 'success' ? (
                                <CheckoutSuccess
                                    planPrice={plan.price}
                                    nextChargeTimestamp={sub?.nextChargeTimestamp ?? 0n}
                                    hasNft={hasNft}
                                    merchantName={merchantDisplay}
                                    returnUrl={returnUrl}
                                />
                            ) : (
                                <>
                                    {!isConnected && <ConnectButton />}

                                    {isConnected && !onCorrectChain && (
                                        <button
                                            className="co-switch-btn"
                                            onClick={() => switchChain({ chainId: arcTestnet.id })}
                                        >
                                            Switch to Arc Testnet
                                        </button>
                                    )}

                                    {isConnected && onCorrectChain && isSubscribed && sub && (
                                        <div className="co-already">
                                            ✓ You are subscribed — next charge:{' '}
                                            {new Date(Number(sub.nextChargeTimestamp) * 1_000).toLocaleDateString()}
                                        </div>
                                    )}

                                    {isConnected && onCorrectChain && !isSubscribed && plan.active && (
                                        <>
                                            <CheckoutPreFlight
                                                isLoading={preflight.isLoading}
                                                reason={preflight.reason}
                                                usdcBalance={preflight.usdcBalance}
                                                planPrice={plan.price}
                                            />

                                            {preflight.isLoading ? (
                                                <div className="co-btn-skeleton" />
                                            ) : (preflight.reason === null || preflight.reason === 0 ||
                                                   preflight.reason === 2 || preflight.reason === 3) && (
                                                <>
                                                    <button
                                                        onClick={handleSubscribe}
                                                        disabled={isPending || preflight.reason === 2}
                                                        className={`co-btn${isPending ? ' co-btn--pending' : ''}`}
                                                    >
                                                        {isPending && <span className="co-spinner" />}
                                                        {isPending ? 'Processing…'
                                                            : hasTrial
                                                                ? `Start ${formatTrialDuration(plan.trialDuration)} Free Trial`
                                                                : 'Approve & Subscribe'}
                                                    </button>

                                                    {isPending && (
                                                        <p className="co-phase-note">
                                                            {txPhase === 'awaiting-wallet'
                                                                ? 'Confirm the transaction in your wallet'
                                                                : 'Waiting for confirmation on Arc…'}
                                                        </p>
                                                    )}
                                                </>
                                            )}
                                        </>
                                    )}

                                    {subscribeError && (
                                        <div className="co-banner--dismiss">
                                            <span style={{ flex: 1 }}>{subscribeError.message}</span>
                                            <button
                                                type="button"
                                                className="co-banner-dismiss-btn"
                                                onClick={() => setSubscribeError(null)}
                                                aria-label="Dismiss error"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Footer ──────────────────────────────────────────── */}
                <div className="co-footer">
                    <p className="co-footer-text">
                        Powered by Cyclo — on-chain recurring billing on Arc testnet
                    </p>
                    <a href="/portal" className="co-footer-link">
                        Already subscribed? Manage your subscriptions
                    </a>
                </div>

            </div>
        </div>
    )
}
