/**
 * Tabbed subscriber table for the merchant dashboard.
 *
 * Tabs: All | Active | Past due | Cancelled
 * When a filtered tab returns no rows but others have data, an inline
 * contextual empty state replaces the table body — tabs stay visible.
 */
import { useState } from 'react'
import { TabBar } from './TabBar'
import type { SubscriberRow, SubscriberStatus } from '../hooks/useSubscriberList'

// ── Tab config ─────────────────────────────────────────────────────────────────

type Tab = 'all' | SubscriberStatus

const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'all',       label: 'All' },
    { id: 'active',    label: 'Active' },
    { id: 'past_due',  label: 'Past due' },
    { id: 'cancelled', label: 'Cancelled' },
]

// ── Inline empty state copy ────────────────────────────────────────────────────

const TAB_EMPTY: Record<Tab, { heading: string; subtext: string }> = {
    all:       { heading: '', subtext: '' },   // never shown — page-level EmptyState handles total=0
    active:    {
        heading: 'No active subscribers',
        subtext: 'All current subscribers have cancelled or are past due.',
    },
    past_due:  {
        heading: 'No past due subscribers',
        subtext: 'All subscriptions are current. The keeper has no pending retries.',
    },
    cancelled: {
        heading: 'No cancelled subscribers',
        subtext: 'No one has cancelled their subscription yet.',
    },
}

// ── Status badge config ────────────────────────────────────────────────────────

const STATUS_BADGE: Record<SubscriberStatus, { label: string; cls: string }> = {
    active:    { label: 'Active',    cls: 'bg-green-50  text-green-700  border-green-100'  },
    past_due:  { label: 'Past due',  cls: 'bg-amber-50  text-amber-700  border-amber-100'  },
    cancelled: { label: 'Cancelled', cls: 'bg-gray-100  text-gray-500   border-gray-200'   },
}

// ── Shared class strings ───────────────────────────────────────────────────────

const TH   = 'px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap'
const TD   = 'px-4 py-3.5 text-[13px] align-middle border-b border-gray-50 last:border-0'
const PILL = 'inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap'

// ── Inline empty state ─────────────────────────────────────────────────────────

/** Lightweight empty state without an icon — used when a specific tab has no rows. */
function InlineEmpty({ heading, subtext }: { heading: string; subtext: string }): JSX.Element {
    return (
        <div className="bg-white rounded-xl border border-gray-100 px-8 py-12
                        flex flex-col items-center text-center">
            <p className="text-sm font-semibold text-gray-900">{heading}</p>
            <p className="text-sm text-gray-400 mt-1 max-w-xs leading-relaxed">{subtext}</p>
        </div>
    )
}

// ── Component ──────────────────────────────────────────────────────────────────

export interface SubscriberTableProps {
    rows: SubscriberRow[]
}

export function SubscriberTable({ rows }: SubscriberTableProps): JSX.Element {
    const [activeTab, setActiveTab] = useState<Tab>('all')

    const counts: Record<Tab, number> = {
        all:       rows.length,
        active:    rows.filter(r => r.status === 'active').length,
        past_due:  rows.filter(r => r.status === 'past_due').length,
        cancelled: rows.filter(r => r.status === 'cancelled').length,
    }

    const tabs = TABS.map(t => ({
        id:    t.id,
        label: counts[t.id] > 0 ? `${t.label} (${counts[t.id]})` : t.label,
    }))

    const filtered        = activeTab === 'all' ? rows : rows.filter(r => r.status === activeTab)
    const showInlineEmpty = filtered.length === 0 && rows.length > 0

    return (
        <div>
            <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

            {showInlineEmpty ? (
                <InlineEmpty {...TAB_EMPTY[activeTab]} />
            ) : (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/80">
                                    <th className={TH}>Subscriber</th>
                                    <th className={TH}>Plan</th>
                                    <th className={TH}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(row => {
                                    const badge = STATUS_BADGE[row.status]
                                    return (
                                        <tr key={row.key}
                                            className="hover:bg-gray-50/60 transition-colors">
                                            <td className={TD}>
                                                <code className="text-[13px] font-mono text-gray-700">
                                                    {row.subscriber.slice(0, 8)}…{row.subscriber.slice(-4)}
                                                </code>
                                            </td>
                                            <td className={TD}>
                                                <span className="text-gray-900">
                                                    Plan {row.planId}
                                                </span>
                                            </td>
                                            <td className={TD}>
                                                <span className={`${PILL} ${badge.cls}`}>
                                                    {badge.label}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
