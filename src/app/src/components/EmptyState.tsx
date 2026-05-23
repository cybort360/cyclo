/**
 * Reusable empty-state block for pages and table panels.
 *
 * Centers content within its container (relies on parent for full-height
 * layout if vertical centering in a viewport is needed).
 *
 * Usage:
 *   <EmptyState
 *     icon={<div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center">
 *             <span className="text-gray-400 text-lg">☰</span>
 *           </div>}
 *     heading="No plans yet"
 *     subtext="Create your first plan to start accepting subscriptions."
 *     action={{ label: 'Create plan', href: '/plans' }}
 *   />
 */
import type { ReactNode } from 'react'
import { Link } from 'wouter'

export interface EmptyStateAction {
    label:    string
    /** Renders a Link when provided; takes precedence over onClick. */
    href?:    string
    onClick?: () => void
}

export interface EmptyStateProps {
    /** Pre-styled icon node — caller controls size and color treatment. */
    icon:    ReactNode
    heading: string
    subtext: string
    /** Optional CTA: Link when href is set, button when onClick is set. */
    action?: EmptyStateAction
}

const ACTION_CLS =
    'inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg ' +
    'text-sm font-medium hover:bg-indigo-700 transition-colors'

export function EmptyState({ icon, heading, subtext, action }: EmptyStateProps): JSX.Element {
    return (
        <div className="bg-white rounded-xl border border-gray-100 px-8 py-16
                        flex flex-col items-center text-center">

            <div className="mb-4">{icon}</div>

            <p className="text-sm font-semibold text-gray-900">{heading}</p>

            <p className="text-sm text-gray-400 mt-1 max-w-xs leading-relaxed">
                {subtext}
            </p>

            {action && (
                <div className="mt-5">
                    {action.href ? (
                        <Link href={action.href}>
                            <a className={ACTION_CLS}>{action.label}</a>
                        </Link>
                    ) : (
                        <button
                            type="button"
                            onClick={action.onClick}
                            className={ACTION_CLS}
                        >
                            {action.label}
                        </button>
                    )}
                </div>
            )}

        </div>
    )
}
