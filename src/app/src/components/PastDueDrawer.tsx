/**
 * PastDueDrawer — 380px dark slide-in panel for a single past-due subscription.
 *
 * Fetches on open:
 *   - Subscriber USDC balance + allowance (batched)
 *   - Plan interval (getPlan)
 *   - Subscription start date (SubscriptionCreated event log)
 *
 * Balance / allowance are rendered as 4px progress bars with accent fill
 * if sufficient, warning fill if below the plan price.
 *
 * Class prefix: pdd-
 */
import { useState, useEffect, useRef } from 'react'
import { useEnsName, useReadContract, useReadContracts, usePublicClient } from 'wagmi'
import { IconX } from '@tabler/icons-react'
import { CopyButton } from './DocCodeBlock'
import { relativeTime, fromUsdcUnits, intervalToLabel, toUsdcUnits } from '../utils/formatting'
import { SUBSCRIPTION_MANAGER_ABI, USDC_ABI } from '../constants/abis'
import { CONTRACT_ADDRESS, USDC_ADDRESS, DEPLOY_BLOCK } from '../constants/addresses'
import type { PastDueItem } from '../pages/PastDuePage'
import './PastDueDrawer.css'

type Address = `0x${string}`

// ── USDC helpers ──────────────────────────────────────────────────────────────

const UNLIMITED_THRESHOLD = BigInt(1e18.toString())

function formatUsdc(raw: bigint): string {
    if (raw >= UNLIMITED_THRESHOLD) return 'Unlimited'
    return fromUsdcUnits(raw).toLocaleString('en-US', {
        minimumFractionDigits: 2, maximumFractionDigits: 6,
    })
}

/** Clamps a USDC ratio to [0, 100] for progress bar widths. */
function barPct(value: bigint, required: bigint): number {
    if (required === 0n) return 100
    const pct = Number((value * 100n) / required)
    return Math.min(pct, 100)
}

const RETRY_INTERVAL_MS = 86_400_000

// ── Component ─────────────────────────────────────────────────────────────────

export interface PastDueDrawerProps {
    item:    PastDueItem
    onClose: () => void
}

export function PastDueDrawer({ item, onClose }: PastDueDrawerProps) {

    // ESC to close — stable closure via ref.
    const onCloseRef = useRef(onClose)
    useEffect(() => { onCloseRef.current = onClose })
    useEffect(() => {
        function handleEsc(e: KeyboardEvent) { if (e.key === 'Escape') onCloseRef.current() }
        document.addEventListener('keydown', handleEsc)
        return () => document.removeEventListener('keydown', handleEsc)
    }, [])

    const { data: ens } = useEnsName({ address: item.subscriber as Address })

    // Batch balance + allowance in one round-trip.
    const { data: walletData, isLoading: walletLoading } = useReadContracts({
        contracts: [
            { address: USDC_ADDRESS as Address, abi: USDC_ABI, functionName: 'balanceOf'  as const, args: [item.subscriber as Address] },
            { address: USDC_ADDRESS as Address, abi: USDC_ABI, functionName: 'allowance'  as const, args: [item.subscriber as Address, CONTRACT_ADDRESS as Address] },
        ],
    })
    const balance   = walletData?.[0]?.status === 'success' ? walletData[0].result as bigint : undefined
    const allowance = walletData?.[1]?.status === 'success' ? walletData[1].result as bigint : undefined

    const { data: planStruct } = useReadContract({
        address: CONTRACT_ADDRESS as Address,
        abi:     SUBSCRIPTION_MANAGER_ABI,
        functionName: 'getPlan' as const,
        args:    [BigInt(item.planId)],
    })
    const interval = planStruct ? (planStruct as { interval: bigint }).interval : undefined

    const client = usePublicClient()
    const [startDate, setStartDate] = useState<string | null>(null)
    useEffect(() => {
        if (!client) return
        client.getContractEvents({
            address: CONTRACT_ADDRESS as Address, abi: SUBSCRIPTION_MANAGER_ABI,
            eventName: 'SubscriptionCreated',
            args: { planId: BigInt(item.planId), subscriber: item.subscriber as Address },
            fromBlock: DEPLOY_BLOCK, toBlock: 'latest',
        })
            .then(async logs => {
                if (!logs[0]) return
                const block = await client.getBlock({ blockNumber: logs[0].blockNumber })
                setStartDate(new Date(Number(block.timestamp) * 1_000).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric',
                }))
            })
            .catch(() => { /* shows '—' */ })
    }, [client, item.planId, item.subscriber])

    // Reconstruct attempt timestamps from lastAttemptAt + retry interval.
    const lastMs   = new Date(item.lastAttemptAt).getTime()
    const attempts = Array.from({ length: item.attemptCount }, (_, i) => ({
        n:   i + 1,
        iso: new Date(lastMs - (item.attemptCount - 1 - i) * RETRY_INTERVAL_MS).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        }),
    }))

    const planPriceRaw = toUsdcUnits(item.amount)

    let diagCls: string
    let diagText: string
    if (walletLoading) {
        diagCls = 'pdd-diagnosis--muted'; diagText = 'Loading wallet data…'
    } else if (balance !== undefined && balance < planPriceRaw) {
        diagCls = 'pdd-diagnosis--warning'
        diagText = `Insufficient balance. Current: ${fromUsdcUnits(balance).toFixed(2)} USDC, required: ${item.amount} USDC.`
    } else if (allowance !== undefined && allowance < planPriceRaw) {
        diagCls = 'pdd-diagnosis--warning'
        diagText = 'Insufficient allowance. Subscriber may need to re-approve.'
    } else if (balance !== undefined && allowance !== undefined) {
        diagCls = 'pdd-diagnosis--ok'; diagText = 'Wallet appears funded. Keeper will retry automatically.'
    } else {
        diagCls = 'pdd-diagnosis--muted'; diagText = 'Unable to fetch wallet data.'
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <>
            <div className="pdd-backdrop" onClick={onClose} aria-hidden="true" />

            <aside role="dialog" aria-label="Subscriber detail" className="pdd-panel">

                {/* Header */}
                <div className="pdd-header">
                    <h2 className="pdd-title">Subscriber detail</h2>
                    <button className="pdd-close" onClick={onClose} aria-label="Close drawer">
                        <IconX size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="pdd-body">

                    {/* ── Subscriber ─────────────────────────────────── */}
                    <section>
                        <p className="pdd-section-label">Subscriber</p>
                        {ens && <p className="pdd-kv-val" style={{ marginBottom: 4 }}>{ens}</p>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                            <code className="pdd-kv-val" style={{ wordBreak: 'break-all', fontSize: 11 }}>
                                {item.subscriber}
                            </code>
                            <CopyButton value={item.subscriber} />
                        </div>
                        <a
                            href={`https://testnet.arcscan.app/address/${item.subscriber}`}
                            target="_blank" rel="noreferrer"
                            className="pdd-explorer-link"
                        >
                            View on Arc Explorer ↗
                        </a>
                    </section>

                    {/* ── Plan ───────────────────────────────────────── */}
                    <section>
                        <p className="pdd-section-label">Plan</p>
                        <div className="pdd-kv">
                            <span className="pdd-kv-key">Name</span>
                            <span className="pdd-kv-val">{item.planName ?? `Plan ${item.planId}`}</span>
                            <span className="pdd-kv-key">Price</span>
                            <span className="pdd-kv-val">{item.amount} USDC</span>
                            <span className="pdd-kv-key">Interval</span>
                            <span className="pdd-kv-val">
                                {interval !== undefined ? intervalToLabel(Number(interval)) : '—'}
                            </span>
                            <span className="pdd-kv-key">Last attempt</span>
                            <span className="pdd-kv-val">{relativeTime(item.lastAttemptAt)}</span>
                            <span className="pdd-kv-key">Subscribed</span>
                            <span className="pdd-kv-val">{startDate ?? '—'}</span>
                        </div>
                    </section>

                    {/* ── Attempt history ────────────────────────────── */}
                    <section>
                        <p className="pdd-section-label">Attempt history</p>
                        <ol className="pdd-attempts" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {attempts.map(a => (
                                <li key={a.n} className="pdd-attempt">
                                    <span className="pdd-attempt-num">{a.n}</span>
                                    <div>
                                        <p className="pdd-attempt-time">{a.iso}</p>
                                        <p className="pdd-attempt-note">Charge failed</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </section>

                    {/* ── Live wallet status ──────────────────────────── */}
                    <section>
                        <p className="pdd-section-label">Live wallet status</p>
                        {walletLoading ? (
                            <>
                                <div className="pdd-skeleton" style={{ width: '60%' }} />
                                <div className="pdd-skeleton" style={{ width: '45%' }} />
                            </>
                        ) : (
                            <>
                                <WalletBar
                                    label="USDC balance"
                                    value={balance}
                                    required={planPriceRaw}
                                />
                                <WalletBar
                                    label="Allowance"
                                    value={allowance}
                                    required={planPriceRaw}
                                />
                            </>
                        )}
                    </section>

                    {/* ── Diagnosis ──────────────────────────────────── */}
                    <section>
                        <p className="pdd-section-label">Diagnosis</p>
                        <p className={`pdd-diagnosis ${diagCls}`}>{diagText}</p>
                    </section>

                </div>
            </aside>
        </>
    )
}

// ── WalletBar ─────────────────────────────────────────────────────────────────

interface WalletBarProps {
    label:    string
    value:    bigint | undefined
    required: bigint
}

/** Label + mono value + 4px progress bar (accent if ok, warning if insufficient). */
function WalletBar({ label, value, required }: WalletBarProps) {
    const ok  = value !== undefined && value >= required
    const pct = value !== undefined ? barPct(value, required) : 0

    return (
        <div className="pdd-wallet-row">
            <div className="pdd-wallet-label-row">
                <span className="pdd-wallet-key">{label}</span>
                <span className={`pdd-wallet-val ${ok ? 'pdd-wallet-val--ok' : 'pdd-wallet-val--warning'}`}>
                    {value !== undefined ? `${formatUsdc(value)} USDC` : '—'}
                </span>
            </div>
            <div className="pdd-bar-track">
                <div
                    className={`pdd-bar-fill ${ok ? 'pdd-bar-fill--ok' : 'pdd-bar-fill--warning'}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    )
}
