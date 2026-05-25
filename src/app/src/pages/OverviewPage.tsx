/**
 * Overview page — center-column content for /dashboard.
 *
 * Structure:
 *   GreetingBar       — time-aware greeting + merchant name / current date-time
 *   WelcomeChecklist  — shown until merchant has both a plan and a subscriber
 *   (or, after graduation:)
 *   AtRiskCard        — warning banner when past-due subscriptions exist
 *   RevenueCard       — Recharts area chart with period selector
 *   OverviewStatCards — four themed stat cards (Revenue / Subscribers / Charges / Fees)
 *   RecentSettlementsTable — live socket-powered table
 *
 * Class prefix: ov-
 */
import { useState, useEffect, useMemo } from 'react'
import { useAccount } from 'wagmi'
import { Link } from 'wouter'
import { useAnalytics } from '../hooks/useAnalytics'
import { useSubscriberList } from '../hooks/useSubscriberList'
import { useSocket } from '../hooks/useSocket'
import { useAtRiskRevenue } from '../hooks/useAtRiskRevenue'
import { useMerchantProfile } from '../context/MerchantProfileContext'
import { useRightPanel } from '../context/RightPanelContext'
import { WelcomeChecklist } from '../components/WelcomeChecklist'
import { LogoIcon } from '../components/Logo'
import { RevenueCard } from '../components/RevenueCard'
import { RecentSettlementsTable } from '../components/RecentSettlementsTable'
import { OverviewPanel } from '../components/OverviewPanel'
import { OverviewStatCards } from '../components/OverviewStatCards'
import './OverviewPage.css'

// ── Constants ─────────────────────────────────────────────────────────────────

const ONBOARDING_DISMISSED_KEY = 'cyclo_onboarding_dismissed'

// ── Helpers ───────────────────────────────────────────────────────────────────

function greeting(hour: number): string {
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
}

function fmtUsdc(n: number): string {
    return n.toLocaleString('en-US', {
        style: 'currency', currency: 'USD', minimumFractionDigits: 2,
    })
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface AtRiskCardProps {
    count:       number
    totalAmount: number
}

function AtRiskCard({ count, totalAmount }: AtRiskCardProps) {
    const label = count === 1 ? 'subscription is' : 'subscriptions are'
    return (
        <div className="ov-atrisk">
            <div className="ov-atrisk-body">
                <p className="ov-atrisk-label">At-risk revenue</p>
                <p className="ov-atrisk-value">{fmtUsdc(totalAmount)}</p>
                <p className="ov-atrisk-sub">
                    {count} {label} in the grace period. The keeper retries up
                    to 3 times before marking {count === 1 ? 'it' : 'them'} as failed.
                </p>
            </div>
            <Link href="/past-due" className="ov-atrisk-link">View past due →</Link>
        </div>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function OverviewPage() {
    const { isConnected, address } = useAccount()
    const { data }                  = useAnalytics()
    const { data: subscribers }     = useSubscriberList()
    const { onPaymentCharged }      = useSocket()
    const { profile }               = useMerchantProfile()
    const { count: pastDueCount, totalAmount: pastDueTotalAmount } = useAtRiskRevenue()

    // Inject right-panel content for the duration of this page's lifetime.
    // OverviewPanel is self-contained (fetches its own data via shared React Query cache),
    // so [] deps is correct — the panel manages its own updates.
    const panel = useMemo(() => <OverviewPanel />, [])
    useRightPanel(panel, [])

    const [liveUsdcProcessed, setLiveUsdcProcessed] = useState(0)
    const [dismissed,  setDismissed]  = useState(false)
    const [graduated,  setGraduated]  = useState(false)

    // Reset per-address flags when wallet changes to prevent bleed-through
    useEffect(() => { setGraduated(false); setDismissed(false) }, [address])
    useEffect(() => {
        if (!address) return
        const addr = address.toLowerCase()
        if (localStorage.getItem(ONBOARDING_DISMISSED_KEY) === addr) setDismissed(true)
        if (localStorage.getItem(`cyclo_grad_${addr}`) === '1')      setGraduated(true)
    }, [address])

    // Graduate permanently once the merchant has both a plan and a subscriber
    useEffect(() => {
        if (!address || !data || graduated) return
        if (data.plans.length > 0 && data.activeSubscribers > 0) {
            localStorage.setItem(`cyclo_grad_${address.toLowerCase()}`, '1')
            setGraduated(true)
        }
    }, [address, data, graduated])

    function handleDismiss(): void {
        if (!address) return
        localStorage.setItem(ONBOARDING_DISMISSED_KEY, address.toLowerCase())
        setDismissed(true)
    }

    useEffect(() => {
        return onPaymentCharged(payload => {
            setLiveUsdcProcessed(u => u + parseFloat(payload.amount))
        })
    }, [onPaymentCharged])

    // Greeting bar values
    const now        = new Date()
    const greetText  = greeting(now.getHours())
    const merchantName = profile?.business_name ?? (address ? address.slice(0, 6) : 'there')
    const dateText   = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    const timeText   = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

    // Stats derived from analytics data
    // Note: liveUsdcProcessed is passed separately as liveRevenueDelta — OverviewStatCards
    // owns the addition so it can pulse the Revenue and Fees cards independently.
    const activeSubscribers = data?.activeSubscribers ?? 0

    // Welcome state: shown until the merchant has both a plan and a subscriber
    const hasPlans       = (data?.plans.length      ?? 0) > 0
    const hasSubscribers = (data?.activeSubscribers  ?? 0) > 0
    const dataReady      = data !== undefined
    const showWelcome    = !!address && dataReady && !graduated && !(hasPlans && hasSubscribers)

    if (!isConnected) {
        return (
            <div className="ov-gate">
                <div className="ov-gate-icon">
                    <LogoIcon size={48} />
                </div>
                <h1 className="ov-gate-heading">Welcome to Cyclo</h1>
                <p className="ov-gate-sub">
                    On-chain recurring USDC billing on Arc testnet.
                    Connect your wallet to get started.
                </p>
                <Link href="/connect" className="ov-gate-btn">Connect wallet</Link>
            </div>
        )
    }

    return (
        <div className="ov-page">

            {/* ── Greeting bar ──────────────────────────────────────────── */}
            <div className="ov-greeting-bar">
                <p className="ov-greeting">{greetText}, {merchantName}</p>
                <p className="ov-datetime">{dateText} · {timeText}</p>
            </div>

            {showWelcome ? (
                <WelcomeChecklist
                    address={address!}
                    hasPlans={hasPlans}
                    hasSubscribers={hasSubscribers}
                    firstActivePlanId={data?.plans[0]?.planId}
                />
            ) : (
                <>
                    {/* Onboarding entry point — suppressed while welcome checklist is active */}
                    {dataReady && !dismissed && !graduated && !hasPlans && (
                        <div className="ov-onboarding-banner">
                            <span className="ov-onboarding-icon">★</span>
                            <p className="ov-onboarding-text">
                                Welcome to Cyclo. Set up your first plan in 90 seconds.
                            </p>
                            <Link href="/onboarding" className="ov-onboarding-cta">
                                Get started →
                            </Link>
                            <button
                                onClick={handleDismiss}
                                className="ov-onboarding-dismiss"
                                aria-label="Dismiss banner"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    {pastDueCount > 0 && (
                        <AtRiskCard count={pastDueCount} totalAmount={pastDueTotalAmount} />
                    )}

                    {/* ── Revenue chart ──────────────────────────────────── */}
                    <RevenueCard
                        dailyRevenue={data?.dailyRevenue ?? []}
                        liveRevenue={liveUsdcProcessed}
                    />

                    {/* ── Stat cards ─────────────────────────────────────── */}
                    <OverviewStatCards
                        totalRevenue={data?.totalRevenue ?? 0}
                        activeSubscribers={activeSubscribers}
                        totalCharges={data?.totalCharges ?? 0}
                        liveRevenueDelta={liveUsdcProcessed}
                        dailyRevenue={data?.dailyRevenue ?? []}
                    />

                    {/* ── Live settlements table ─────────────────────────── */}
                    <RecentSettlementsTable
                        subscribers={subscribers ?? []}
                        plans={data?.plans ?? []}
                    />
                </>
            )}
        </div>
    )
}
