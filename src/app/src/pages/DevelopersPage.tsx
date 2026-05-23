/**
 * /developers — in-dashboard developer reference.
 *
 * Two-column layout: sticky anchor nav (left) + section content (right).
 * Scroll-spy via IntersectionObserver highlights the active section as
 * the user scrolls.
 *
 * No API key UI — Cyclo does not use API keys. Authentication is entirely
 * wallet-based and on-chain.
 *
 * The outer dashboard chrome (sidebar + header) is provided by Layout.
 * -mx-8 -mt-8 cancels Layout's px-8 py-8 wrapper so the anchor nav
 * can sit flush-left with its own border treatment.
 */
import { useState, useEffect } from 'react'

// ── Section manifest ──────────────────────────────────────────────────────────

const DOC_SECTIONS = [
    { id: 'quick-start',        label: 'Quick Start'        },
    { id: 'network',            label: 'Network'            },
    { id: 'sdk-reference',      label: 'SDK Reference'      },
    { id: 'contract-reference', label: 'Contract Reference' },
    { id: 'composability',      label: 'Composability'      },
    { id: 'webhooks',           label: 'Webhooks'           },
] as const

type SectionId = (typeof DOC_SECTIONS)[number]['id']

// ── Scroll-spy hook ───────────────────────────────────────────────────────────

/**
 * Observes each doc section and returns the id of whichever section currently
 * occupies the top band of the viewport.
 *
 * rootMargin '-20% 0px -75% 0px' defines a spotlight: a section becomes
 * "active" the moment its top edge crosses into the top 20 % of the viewport.
 * The -75 % bottom margin prevents two sections from being active at once on
 * normal screen heights.
 */
function useScrollSpy(): SectionId {
    const [activeId, setActiveId] = useState<SectionId>('quick-start')

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setActiveId(entry.target.id as SectionId)
                    }
                }
            },
            { rootMargin: '-20% 0px -75% 0px', threshold: 0 },
        )

        for (const { id } of DOC_SECTIONS) {
            const el = document.getElementById(id)
            if (el) observer.observe(el)
        }

        return () => observer.disconnect()
    }, [])

    return activeId
}

// ── Anchor nav ────────────────────────────────────────────────────────────────

interface AnchorNavProps {
    activeId: SectionId
}

function AnchorNav({ activeId }: AnchorNavProps) {
    return (
        <ul className="space-y-0.5">
            {DOC_SECTIONS.map(({ id, label }) => {
                const isActive = id === activeId
                return (
                    <li key={id}>
                        <a
                            href={`#${id}`}
                            className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                isActive
                                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                        >
                            {label}
                        </a>
                    </li>
                )
            })}
        </ul>
    )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

interface DocSectionProps {
    id:       SectionId
    title:    string
    children?: React.ReactNode
}

/**
 * Wraps each documentation section with a consistent heading style, bottom
 * separator, and scroll-margin-top to ensure anchor links land below the
 * sticky dashboard header.
 *
 * scroll-mt-20 (80px) gives clearance above the ~58px header + some breathing
 * room so the section heading doesn't sit flush against the header border.
 */
function DocSection({ id, title, children }: DocSectionProps) {
    return (
        <section
            id={id}
            className="scroll-mt-20 pb-16 border-b border-gray-100 last:border-0 last:pb-0"
        >
            <h2 className="text-lg font-semibold text-gray-900 pb-3 border-b border-gray-100">
                {title}
            </h2>
            <div className="mt-6">
                {children ?? (
                    <p className="text-sm text-gray-400 italic">Content coming soon.</p>
                )}
            </div>
        </section>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function DevelopersPage() {
    const activeId = useScrollSpy()

    return (
        /*
         * -mx-8 -mt-8: cancel Layout's px-8 py-8 so the anchor nav can be
         * flush-left with its own bg + border treatment, matching the visual
         * weight of the outer sidebar.
         */
        <div className="flex -mx-8 -mt-8 min-h-screen">

            {/* ── Left anchor nav ───────────────────────────────────────── */}
            <aside className="w-[216px] flex-shrink-0 border-r border-gray-100 bg-white">
                {/*
                  * top-[57px] positions the sticky nav just below the dashboard
                  * header (py-4 top + py-4 bottom + ~25px content + 1px border
                  * ≈ 57px). Adjust if the header height changes.
                  */}
                <div className="sticky top-[57px] px-5 pt-7 pb-12">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                        On this page
                    </p>
                    <AnchorNav activeId={activeId} />
                </div>
            </aside>

            {/* ── Main content ──────────────────────────────────────────── */}
            <div className="flex-1 min-w-0 px-10 pt-8 pb-24 max-w-3xl">

                {/* Page heading */}
                <div className="mb-12">
                    <h1 className="text-2xl font-bold text-gray-900">Developer reference</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Integration guides, SDK reference, and on-chain contract documentation.
                    </p>
                </div>

                {/* Sections */}
                <div className="space-y-0">
                    <DocSection id="quick-start"        title="Quick Start"        />
                    <DocSection id="network"            title="Network"            />
                    <DocSection id="sdk-reference"      title="SDK Reference"      />
                    <DocSection id="contract-reference" title="Contract Reference" />
                    <DocSection id="composability"      title="Composability"      />
                    <DocSection id="webhooks"           title="Webhooks"           />
                </div>
            </div>
        </div>
    )
}
