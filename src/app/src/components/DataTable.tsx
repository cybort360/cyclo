/**
 * DataTable — reusable dark-themed table used across Subscribers,
 * Settlements, Past Due, and Plans pages.
 *
 * Exported helpers:
 *   StatusBadge — renders coloured status pill for known status strings
 *   AddressCell — truncated address with copy-on-hover icon
 *
 * Class prefix: dt-
 */
import { useState, type ReactNode, type MouseEvent } from 'react'
import { IconCopy } from '@tabler/icons-react'
import './DataTable.css'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DataTableColumn {
    /** Key into each row Record used to retrieve the cell's ReactNode */
    key:     string
    label:   string
    /** CSS grid-column value, e.g. '120px', '1fr', 'auto'. Default: '1fr' */
    width?:  string
    align?:  'left' | 'right' | 'center'
    /** Renders cell text in monospace at 12px instead of the default 13px */
    mono?:   boolean
}

export interface DataTableProps {
    columns:     DataTableColumn[]
    /** Each element is a Record mapping column.key → ReactNode for that cell */
    rows:        Record<string, ReactNode>[]
    onRowClick?: (row: Record<string, ReactNode>) => void
    emptyState?: ReactNode
    isLoading?:  boolean
    /** Number of skeleton rows shown while loading. Default: 5 */
    skeletonRows?: number
}

// ── Status badge ──────────────────────────────────────────────────────────────

type BadgeStatus = 'active' | 'past_due' | 'cancelled' | 'inactive'

const BADGE_LABELS: Record<BadgeStatus, string> = {
    active:    'Active',
    past_due:  'Past due',
    cancelled: 'Cancelled',
    inactive:  'Inactive',
}

/**
 * Renders a colour-coded status pill.
 * @param status - One of 'active' | 'past_due' | 'cancelled' | 'inactive'
 */
export function StatusBadge({ status }: { status: BadgeStatus }) {
    return (
        <span className={`dt-badge dt-badge--${status.replace('_', '-')}`}>
            {BADGE_LABELS[status]}
        </span>
    )
}

// ── Address cell ──────────────────────────────────────────────────────────────

/**
 * Renders a truncated wallet address (0x1234…5678) with a copy icon that
 * appears on row hover. Copy success briefly turns the icon var(--accent).
 */
export function AddressCell({ address }: { address: string }) {
    const [copied, setCopied] = useState(false)
    const short = `${address.slice(0, 6)}…${address.slice(-4)}`

    function handleCopy(e: MouseEvent<HTMLButtonElement>): void {
        // Prevent triggering onRowClick when copying
        e.stopPropagation()
        void navigator.clipboard.writeText(address).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1_500)
        })
    }

    return (
        <span className="dt-addr-cell">
            <span className="dt-addr-text">{short}</span>
            <button
                className={`dt-copy-btn${copied ? ' dt-copy-btn--success' : ''}`}
                onClick={handleCopy}
                aria-label={`Copy address ${address}`}
                title="Copy address"
            >
                <IconCopy size={14} aria-hidden="true" />
            </button>
        </span>
    )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function SkeletonRow({ columns }: { columns: DataTableColumn[] }) {
    return (
        <div className="dt-row dt-row--skeleton" aria-hidden="true">
            {columns.map(col => (
                <div
                    key={col.key}
                    className="dt-cell"
                    style={{ justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start' }}
                >
                    {/* Random-ish widths give visual variety across skeleton rows */}
                    <span className="dt-skeleton-bar" style={{ width: '60%' }} />
                </div>
            ))}
        </div>
    )
}

// ── DataTable ─────────────────────────────────────────────────────────────────

export function DataTable({
    columns,
    rows,
    onRowClick,
    emptyState,
    isLoading    = false,
    skeletonRows = 5,
}: DataTableProps) {
    const gridTemplate = columns.map(c => c.width ?? '1fr').join(' ')
    const isClickable  = !!onRowClick

    return (
        <div className="dt-wrap" role="table" aria-busy={isLoading}>

            {/* ── Header ──────────────────────────────────────────────── */}
            <div
                className="dt-header"
                style={{ gridTemplateColumns: gridTemplate }}
                role="row"
            >
                {columns.map(col => (
                    <div
                        key={col.key}
                        className="dt-th"
                        style={{ textAlign: col.align ?? 'left' }}
                        role="columnheader"
                    >
                        {col.label}
                    </div>
                ))}
            </div>

            {/* ── Body ────────────────────────────────────────────────── */}
            {isLoading ? (
                Array.from({ length: skeletonRows }, (_, i) => (
                    <SkeletonRow key={i} columns={columns} />
                ))
            ) : rows.length === 0 ? (
                <div className="dt-empty" role="row">
                    {emptyState ?? (
                        <p className="dt-empty-text">No data yet.</p>
                    )}
                </div>
            ) : (
                rows.map((row, rowIdx) => (
                    <div
                        key={rowIdx}
                        className={`dt-row${isClickable ? ' dt-row--clickable' : ''}`}
                        style={{ gridTemplateColumns: gridTemplate }}
                        onClick={isClickable ? () => onRowClick!(row) : undefined}
                        role="row"
                        tabIndex={isClickable ? 0 : undefined}
                        onKeyDown={isClickable
                            ? e => { if (e.key === 'Enter' || e.key === ' ') onRowClick!(row) }
                            : undefined
                        }
                    >
                        {columns.map(col => (
                            <div
                                key={col.key}
                                className={`dt-cell${col.mono ? ' dt-cell--mono' : ''}`}
                                style={{ justifyContent: col.align === 'right' ? 'flex-end' :
                                                         col.align === 'center' ? 'center' : 'flex-start' }}
                                role="cell"
                            >
                                {row[col.key] ?? null}
                            </div>
                        ))}
                    </div>
                ))
            )}
        </div>
    )
}
