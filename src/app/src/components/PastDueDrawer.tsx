/**
 * Slide-in detail drawer for a single past-due subscription.
 *
 * Opened when a row in PastDueTable is clicked. Read-only.
 * Closes on ESC or backdrop click.
 *
 * Live data fetched from chain on open:
 *   - Subscriber USDC balance (balanceOf)
 *   - Subscriber allowance granted to SubscriptionManager
 *   - Plan interval (getPlan)
 *   - Subscription start date (SubscriptionCreated event log)
 */
import { useState, useEffect, useRef } from 'react'
import { useEnsName, useReadContract, useReadContracts, usePublicClient } from 'wagmi'
import { CopyButton } from './DocCodeBlock'
import { relativeTime, fromUsdcUnits, intervalToLabel, toUsdcUnits } from '../utils/formatting'
import { SUBSCRIPTION_MANAGER_ABI, USDC_ABI } from '../constants/abis'
import { CONTRACT_ADDRESS, USDC_ADDRESS, DEPLOY_BLOCK } from '../constants/addresses'
import type { PastDueItem } from '../pages/PastDuePage'

type Address = `0x${string}`

// ── USDC display helpers ──────────────────────────────────────────────────────

/** Threshold above which an allowance is displayed as "Unlimited". */
const UNLIMITED_THRESHOLD = BigInt(1e18.toString()) // 1 trillion USDC in raw units

/** Formats a raw USDC bigint for display; collapses huge allowances to "Unlimited". */
function formatUsdc(raw: bigint): string {
    if (raw >= UNLIMITED_THRESHOLD) return 'Unlimited'
    return fromUsdcUnits(raw).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
    })
}

// ── Keeper retry interval ─────────────────────────────────────────────────────

/** 24 h in ms — mirrors RETRY_INTERVAL_MS in keeper/scheduler.ts. */
const RETRY_INTERVAL_MS = 86_400_000

// ── Component ─────────────────────────────────────────────────────────────────

export interface PastDueDrawerProps {
    item:    PastDueItem
    onClose: () => void
}

export function PastDueDrawer({ item, onClose }: PastDueDrawerProps) {

    // ── ESC to close (stable closure via ref) ─────────────────────────────────
    const onCloseRef = useRef(onClose)
    useEffect(() => { onCloseRef.current = onClose })
    useEffect(() => {
        function handleEsc(e: KeyboardEvent) {
            if (e.key === 'Escape') onCloseRef.current()
        }
        document.addEventListener('keydown', handleEsc)
        return () => document.removeEventListener('keydown', handleEsc)
    }, [])

    // ── ENS resolution ────────────────────────────────────────────────────────
    const { data: ens } = useEnsName({ address: item.subscriber as Address })

    // ── Live wallet data (balance + allowance, batched) ───────────────────────
    const { data: walletData, isLoading: walletLoading } = useReadContracts({
        contracts: [
            {
                address:      USDC_ADDRESS     as Address,
                abi:          USDC_ABI,
                functionName: 'balanceOf' as const,
                args:         [item.subscriber as Address],
            },
            {
                address:      USDC_ADDRESS     as Address,
                abi:          USDC_ABI,
                functionName: 'allowance' as const,
                args:         [item.subscriber as Address, CONTRACT_ADDRESS as Address],
            },
        ],
    })
    const balance   = walletData?.[0]?.status === 'success' ? walletData[0].result as bigint : undefined
    const allowance = walletData?.[1]?.status === 'success' ? walletData[1].result as bigint : undefined

    // ── Plan interval (not in PastDueItem) ────────────────────────────────────
    const { data: planStruct } = useReadContract({
        address:      CONTRACT_ADDRESS as Address,
        abi:          SUBSCRIPTION_MANAGER_ABI,
        functionName: 'getPlan' as const,
        args:         [BigInt(item.planId)],
    })
    const interval = planStruct ? (planStruct as { interval: bigint }).interval : undefined

    // ── Subscription start date (SubscriptionCreated event) ───────────────────
    const client = usePublicClient()
    const [startDate, setStartDate] = useState<string | null>(null)
    useEffect(() => {
        if (!client) return
        client.getContractEvents({
            address:   CONTRACT_ADDRESS as Address,
            abi:       SUBSCRIPTION_MANAGER_ABI,
            eventName: 'SubscriptionCreated',
            args:      { planId: BigInt(item.planId), subscriber: item.subscriber as Address },
            fromBlock: DEPLOY_BLOCK,
            toBlock:   'latest',
        })
            .then(async logs => {
                if (!logs[0]) return
                const block = await client.getBlock({ blockNumber: logs[0].blockNumber })
                setStartDate(
                    new Date(Number(block.timestamp) * 1_000).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                    })
                )
            })
            .catch(() => { /* fail silently — shows '—' */ })
    }, [client, item.planId, item.subscriber])

    // ── Attempt history (reconstructed from lastAttemptAt + retry interval) ───
    const lastMs = new Date(item.lastAttemptAt).getTime()
    const attempts = Array.from({ length: item.attemptCount }, (_, i) => {
        const offsetMs = (item.attemptCount - 1 - i) * RETRY_INTERVAL_MS
        return {
            n:   i + 1,
            iso: new Date(lastMs - offsetMs).toLocaleString('en-US', {
                month: 'short', day: 'numeric',
                hour:  'numeric', minute: '2-digit',
            }),
        }
    })

    // ── Diagnosis ─────────────────────────────────────────────────────────────
    const planPriceRaw = toUsdcUnits(item.amount)

    let diagnosis: { text: string; cls: string }
    if (walletLoading) {
        diagnosis = { text: 'Loading wallet data…', cls: 'text-gray-400' }
    } else if (balance !== undefined && balance < planPriceRaw) {
        const current  = fromUsdcUnits(balance).toFixed(2)
        const required = item.amount
        diagnosis = {
            text: `Subscriber wallet has insufficient USDC balance. Current: ${current} USDC. Required: ${required} USDC.`,
            cls:  'text-amber-700',
        }
    } else if (allowance !== undefined && allowance < planPriceRaw) {
        diagnosis = {
            text: 'Subscriber has insufficient USDC allowance. They may need to re-approve.',
            cls:  'text-amber-700',
        }
    } else if (balance !== undefined && allowance !== undefined) {
        diagnosis = {
            text: 'Wallet appears funded. Keeper will retry automatically.',
            cls:  'text-green-700',
        }
    } else {
        diagnosis = { text: 'Unable to fetch wallet data.', cls: 'text-gray-400' }
    }

    const explorerUrl = `https://testnet.arcscan.app/address/${item.subscriber}`

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/25"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Panel */}
            <aside
                role="dialog"
                aria-label="Subscription detail"
                className="fixed right-0 top-0 h-full z-50 w-[440px] bg-white
                           shadow-2xl border-l border-gray-100 flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
                    <h2 className="font-semibold text-gray-900 text-sm">Subscription detail</h2>
                    <button
                        onClick={onClose}
                        aria-label="Close drawer"
                        className="text-gray-400 hover:text-gray-600 text-xl leading-none transition-colors"
                    >
                        ×
                    </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 text-sm">

                    {/* ── Subscriber ─────────────────────────────────────── */}
                    <section className="space-y-2">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                            Subscriber
                        </p>
                        {ens && (
                            <p className="font-medium text-gray-900">{ens}</p>
                        )}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <code className="text-[13px] font-mono text-gray-600 break-all">
                                {item.subscriber}
                            </code>
                            <CopyButton value={item.subscriber} />
                        </div>
                        <a
                            href={explorerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800
                                       text-[13px] transition-colors"
                        >
                            View on Arc Explorer ↗
                        </a>
                    </section>

                    {/* ── Plan ───────────────────────────────────────────── */}
                    <section className="space-y-2">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                            Plan
                        </p>
                        <div className="grid grid-cols-2 gap-y-1.5">
                            <span className="text-gray-500">Name</span>
                            <span className="text-gray-900 font-medium">
                                {item.planName ?? `Plan ${item.planId}`}
                            </span>
                            <span className="text-gray-500">Price</span>
                            <span className="text-gray-900 font-medium tabular-nums">
                                {item.amount} USDC
                            </span>
                            <span className="text-gray-500">Interval</span>
                            <span className="text-gray-900">
                                {interval !== undefined
                                    ? intervalToLabel(Number(interval))
                                    : '—'}
                            </span>
                            <span className="text-gray-500">Subscribed</span>
                            <span className="text-gray-900">{startDate ?? '—'}</span>
                        </div>
                    </section>

                    {/* ── Attempt history ────────────────────────────────── */}
                    <section className="space-y-2">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                            Attempt history
                        </p>
                        <ol className="space-y-3">
                            {attempts.map(a => (
                                <li key={a.n} className="flex gap-3">
                                    <div className="flex flex-col items-center">
                                        <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700
                                                       text-[10px] font-bold flex items-center justify-center
                                                       flex-shrink-0">
                                            {a.n}
                                        </span>
                                        {a.n < attempts.length && (
                                            <span className="w-px flex-1 bg-gray-100 mt-1" />
                                        )}
                                    </div>
                                    <div className="pb-3 last:pb-0">
                                        <p className="text-gray-900">{a.iso}</p>
                                        <p className="text-[12px] text-gray-400 mt-0.5">
                                            Charge failed
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </section>

                    {/* ── Live wallet status ──────────────────────────────── */}
                    <section className="space-y-2">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                            Live wallet status
                        </p>
                        {walletLoading ? (
                            <div className="animate-pulse space-y-2">
                                <div className="h-3 bg-gray-100 rounded w-48" />
                                <div className="h-3 bg-gray-100 rounded w-40" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-y-1.5">
                                <span className="text-gray-500">USDC balance</span>
                                <span className={`font-medium tabular-nums ${
                                    balance !== undefined && balance < planPriceRaw
                                        ? 'text-amber-600'
                                        : 'text-gray-900'
                                }`}>
                                    {balance !== undefined ? `${formatUsdc(balance)} USDC` : '—'}
                                </span>
                                <span className="text-gray-500">Allowance</span>
                                <span className={`font-medium tabular-nums ${
                                    allowance !== undefined && allowance < planPriceRaw
                                        ? 'text-amber-600'
                                        : 'text-gray-900'
                                }`}>
                                    {allowance !== undefined ? `${formatUsdc(allowance)} USDC` : '—'}
                                </span>
                                <span className="text-gray-500">Last seen</span>
                                <span className="text-gray-900">
                                    {relativeTime(item.lastAttemptAt)}
                                </span>
                            </div>
                        )}
                    </section>

                    {/* ── Diagnosis ──────────────────────────────────────── */}
                    <section>
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                            Diagnosis
                        </p>
                        <p className={`text-[13px] leading-relaxed ${diagnosis.cls}`}>
                            {diagnosis.text}
                        </p>
                    </section>

                </div>
            </aside>
        </>
    )
}
