/**
 * EmptyState — reusable empty-state block for pages and table panels.
 *
 * Renders a 64px accent-light icon circle (accent-glow shadow), heading,
 * subtext, and an optional primary CTA button or link.
 *
 * Usage:
 *   import { IconStack2 } from '@tabler/icons-react'
 *   <EmptyState
 *     icon={IconStack2}
 *     heading="No plans yet"
 *     subtext="Create your first plan to start accepting subscriptions."
 *     action={{ label: 'Create plan', href: '/plans' }}
 *   />
 *
 * Class prefix: es-
 */
import type { FC } from 'react'
import { Link } from 'wouter'
import './EmptyState.css'

export interface EmptyStateAction {
    label:    string
    /** Renders a Link when provided; takes precedence over onClick. */
    href?:    string
    onClick?: () => void
}

/** Minimal shape satisfied by every Tabler icon component. */
type TablerIcon = FC<{ size?: number; 'aria-hidden'?: boolean | 'true' | 'false' }>

export interface EmptyStateProps {
    /**
     * Raw Tabler icon component — EmptyState owns the 64px circle wrapper
     * and renders it at 28px with the accent colour.
     */
    icon:    TablerIcon
    heading: string
    subtext: string
    /** Optional CTA: Link when href is set, button when onClick is set. */
    action?: EmptyStateAction
}

export function EmptyState({ icon: IconComponent, heading, subtext, action }: EmptyStateProps) {
    return (
        <div className="es-root">

            <div className="es-icon-wrap">
                <IconComponent size={28} aria-hidden="true" />
            </div>

            <p className="es-heading">{heading}</p>
            <p className="es-subtext">{subtext}</p>

            {action && (
                <div className="es-action">
                    {action.href ? (
                        <Link href={action.href} className="es-btn">
                            {action.label}
                        </Link>
                    ) : (
                        <button
                            type="button"
                            className="es-btn"
                            onClick={action.onClick}
                        >
                            {action.label}
                        </button>
                    )}
                </div>
            )}

        </div>
    )
}
