/**
 * OverviewPanel — right-panel content injected by the /dashboard Overview page.
 * Self-contained: fetches its own data so OverviewPage doesn't need to pass props.
 * Injected via useRightPanel(<OverviewPanel />, []) in OverviewPage.
 *
 * Sections:
 *   1. My Plans      — gradient card for primary plan + plain list for the rest
 *   2. Subscribers   — 5 most-recent active subscribers with avatar + amount
 *   3. Keeper Status — live socket status + keeper log tail
 *   4. At-risk       — conditional warning card (only when pastDueCount > 0)
 *
 * Class prefix: op-
 */
import { useState, useEffect } from 'react'
import { Link } from 'wouter'
import { IconPlus } from '@tabler/icons-react'
import { useAnalytics } from '../hooks/useAnalytics'
import { useSubscriberList } from '../hooks/useSubscriberList'
import { useSocket, type PaymentChargedPayload, type SocketStatus } from '../hooks/useSocket'
import { useAtRiskRevenue } from '../hooks/useAtRiskRevenue'
import { addressColor } from '../utils/avatar'
import type { PlanMetrics } from '../hooks/useAnalytics'
import type { SubscriberRow } from '../hooks/useSubscriberList'
import './OverviewPanel.css'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LogLine {
    /** Text before the " — " separator, e.g. "charge planId=1" */
    prefix: string
    /** Status token after the " — " separator, e.g. "OK" */
    suffix: string
    status: 'ok' | 'low_balance' | 'info'
}

// ── Seed data ─────────────────────────────────────────────────────────────────

/**
 * Three seed log lines shown before any socket events arrive.
 * Stored newest-first; rendered reversed (newest at bottom).
 */
const DEFAULT_LOG: LogLine[] = [
    { prefix: 'preflight',       suffix: 'low_balance', status: 'low_balance' },
    { prefix: 'charge planId=2', suffix: 'OK',          status: 'ok'          },
    { prefix: 'charge planId=1', suffix: 'OK',          status: 'ok'          },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUsdc(n: number): string {
    return n.toLocaleString('en-US', {
        style: 'currency', currency: 'USD', minimumFractionDigits: 2,
    })
}

function fmtTime(d: Date): string {
    return d.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', second: '2-digit',
    })
}

// ── Plan card (gradient hero) ─────────────────────────────────────────────────

function PlanCard({ plan }: { plan: PlanMetrics }) {
    const subCount = plan.activeSubscribers
    return (
        <div className="op-plan-card">
            <p className="op-plan-card-eyebrow">SUBSCRIPTION PLAN</p>
            <p className="op-plan-card-name">Plan {plan.planId.toString()}</p>
            <div className="op-plan-card-price-row">
                <span className="op-plan-card-price">
                    {plan.price.toFixed(2)} USDC
                </span>
                <span className="op-plan-card-period">/ mo</span>
            </div>
            <div className="op-plan-card-footer">
                <span className="op-plan-card-pill">
                    {subCount} {subCount === 1 ? 'subscriber' : 'subscribers'}
                </span>
            </div>
        </div>
    )
}

// ── Secondary plan list item ──────────────────────────────────────────────────

function PlanListItem({ plan }: { plan: PlanMetrics }) {
    return (
        <div className="op-plan-item">
            <span className="op-plan-item-name">Plan {plan.planId.toString()}</span>
            <div className="op-plan-item-right">
                <span className="op-plan-item-price">
                    {plan.price.toFixed(2)} USDC
                </span>
                <span className="op-plan-item-subs">
                    {plan.activeSubscribers} sub{plan.activeSubscribers !== 1 ? 's' : ''}
                </span>
            </div>
        </div>
    )
}

// ── Subscriber row ────────────────────────────────────────────────────────────

interface SubscriberRowItemProps {
    row:    SubscriberRow
    amount: number
}

function SubscriberRowItem({ row, amount }: SubscriberRowItemProps) {
    const { bg, text } = addressColor(row.subscriber)
    const shortAddr = `${row.subscriber.slice(0, 6)}…${row.subscriber.slice(-4)}`
    return (
        <Link href="/subscribers" className="op-sub-row">
            <span className="op-sub-avatar" style={{ background: bg, color: text }}>
                {row.subscriber.slice(2, 4).toUpperCase()}
            </span>
            <div className="op-sub-info">
                <span className="op-sub-addr">{shortAddr}</span>
                <span className="op-sub-plan">Plan {row.planId}</span>
            </div>
            <span className="op-sub-amount">
                {amount > 0 ? `${amount.toFixed(2)}` : '—'}
            </span>
        </Link>
    )
}

// ── Keeper status card ────────────────────────────────────────────────────────

interface KeeperStatusProps {
    socketStatus:  SocketStatus
    lastChargeStr: string
    logLines:      LogLine[]
}

function KeeperStatus({ socketStatus, lastChargeStr, logLines }: KeeperStatusProps) {
    const isConnected  = socketStatus === 'connected'
    const isConnecting = socketStatus === 'connecting'
    const liveLabel    = isConnected ? 'LIVE' : isConnecting ? 'CONNECTING' : 'OFFLINE'
    const dotMod       = isConnected  ? 'op-dot--live' :
                         isConnecting ? 'op-dot--warn' : 'op-dot--off'

    return (
        <div className="op-keeper-card">
            <div className="op-keeper-top">
                <div className="op-keeper-status">
                    <span className={`op-dot ${dotMod}`} />
                    <span className={`op-keeper-live${isConnected ? '' : ' op-keeper-live--dim'}`}>
                        {liveLabel}
                    </span>
                </div>
                <span className="op-keeper-network">Arc testnet</span>
            </div>

            <div className="op-keeper-stats">
                <div className="op-keeper-stat">
                    <span className="op-keeper-stat-label">Last charge</span>
                    <span className="op-keeper-stat-value">{lastChargeStr}</span>
                </div>
                <div className="op-keeper-stat">
                    <span className="op-keeper-stat-label">Avg latency</span>
                    <span className="op-keeper-stat-value op-keeper-stat-value--accent">3ms</span>
                </div>
            </div>

            <div className="op-keeper-log">
                {logLines.slice().reverse().map((line, i) => (
                    <p key={i} className="op-log-line">
                        {'> '}{line.prefix}{' — '}
                        <span className={
                            line.status === 'ok'          ? 'op-log-ok'   :
                            line.status === 'low_balance' ? 'op-log-warn' : ''
                        }>
                            {line.suffix}
                        </span>
                    </p>
                ))}
            </div>
        </div>
    )
}

// ── At-risk card ──────────────────────────────────────────────────────────────

function AtRiskSection({ count, totalAmount }: { count: number; totalAmount: number }) {
    return (
        <div className="op-atrisk">
            <div className="op-atrisk-head">
                <span className="op-atrisk-label">AT-RISK</span>
                <Link href="/past-due" className="op-atrisk-link">View →</Link>
            </div>
            <p className="op-atrisk-amount">{fmtUsdc(totalAmount)}</p>
            <p className="op-atrisk-sub">
                {count} {count === 1 ? 'sub' : 'subs'} in grace period
            </p>
        </div>
    )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function OverviewPanel() {
    const { data }              = useAnalytics()
    const { data: subscribers } = useSubscriberList()
    const { onPaymentCharged, status } = useSocket()
    const { count: pastDueCount, totalAmount } = useAtRiskRevenue()

    const [logLines,       setLogLines]   = useState<LogLine[]>(DEFAULT_LOG)
    const [lastChargeTime, setLastCharge] = useState<Date | null>(null)

    // Track last charge time and prepend log lines from live socket events
    useEffect(() => {
        return onPaymentCharged((payload: PaymentChargedPayload) => {
            setLastCharge(new Date(payload.timestamp * 1_000))
            setLogLines(prev => [
                { prefix: `charge planId=${payload.planId}`, suffix: 'OK', status: 'ok' as const },
                ...prev,
            ].slice(0, 3))
        })
    }, [onPaymentCharged])

    const plans     = data?.plans ?? []
    const topPlan   = plans[0]
    const restPlans = plans.slice(1)

    // Price lookup for subscriber rows
    const priceMap = new Map(plans.map(p => [p.planId.toString(), p.price]))

    // Five most-recent active subscribers (list oldest-first, so reverse-slice)
    const recentSubs = (subscribers ?? [])
        .filter(s => s.status === 'active')
        .slice(-5)
        .reverse()

    const lastChargeStr = lastChargeTime ? fmtTime(lastChargeTime) : '—'

    return (
        <div className="op-panel">

            {/* ── Section 1: My Plans ─────────────────────────────────── */}
            <div className="op-section-header">
                <span className="op-section-title">My Plans</span>
                <Link href="/plans" className="op-add-btn">
                    <IconPlus size={12} aria-hidden="true" />
                    Add
                </Link>
            </div>

            {topPlan ? (
                <>
                    <PlanCard plan={topPlan} />
                    {restPlans.length > 0 && (
                        <div className="op-plan-list">
                            {restPlans.map(p => (
                                <PlanListItem key={p.planId.toString()} plan={p} />
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <p className="op-empty">No plans yet — create one to get started.</p>
            )}

            {/* ── Section 2: Recent Subscribers ───────────────────────── */}
            <div className="op-section-header op-section-header--gap">
                <span className="op-section-title">Recent Subscribers</span>
                <Link href="/subscribers" className="op-see-all">See all →</Link>
            </div>

            {recentSubs.length === 0 ? (
                <p className="op-empty">No subscribers yet.</p>
            ) : (
                <div className="op-sub-list">
                    {recentSubs.map(s => (
                        <SubscriberRowItem
                            key={s.key}
                            row={s}
                            amount={priceMap.get(s.planId) ?? 0}
                        />
                    ))}
                </div>
            )}

            {/* ── Section 3: Keeper Status ─────────────────────────────── */}
            <div className="op-section-header op-section-header--gap">
                <span className="op-section-title">Keeper</span>
            </div>
            <KeeperStatus
                socketStatus={status}
                lastChargeStr={lastChargeStr}
                logLines={logLines}
            />

            {/* ── Section 4: At-risk (conditional) ────────────────────── */}
            {pastDueCount > 0 && (
                <div className="op-atrisk-wrap">
                    <AtRiskSection count={pastDueCount} totalAmount={totalAmount} />
                </div>
            )}

        </div>
    )
}
