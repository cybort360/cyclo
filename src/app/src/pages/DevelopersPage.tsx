/**
 * /developers — in-dashboard developer reference.
 * Two-column layout: sticky anchor nav (left) + section content (right).
 * Scroll-spy via IntersectionObserver highlights the active section.
 * No API key UI — authentication is wallet-based and on-chain.
 * -mx-8 -mt-8 cancels Layout's px-8 py-8 padding so the nav sits flush-left.
 */
import { useState, useEffect } from 'react'
import { CodeBlock, DocStep, CopyButton } from '../components/DocCodeBlock'
import { CONTRACT_ADDRESS, USDC_ADDRESS } from '../constants/addresses'
import { SdkReferenceSection } from './SdkReferenceSection'
import { ContractReferenceSection } from './ContractReferenceSection'
import { ComposabilitySection } from './ComposabilitySection'
import { WebhooksSection } from './WebhooksSection'

// ── Network constants ─────────────────────────────────────────────────────────

const ARC_RPC_URL  = (import.meta.env.VITE_ARC_RPC_URL as string | undefined) ?? ''
const EXPLORER_URL = 'https://testnet.arcscan.app'

// ── Quick Start code snippets ─────────────────────────────────────────────────

const INSTALL_CODE = 'npm install @cyclo/sdk'

const INIT_CODE = `\
import { CycloClient } from '@cyclo/sdk'
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const client = new CycloClient({
  contractAddress: '0x...', // SubscriptionManager address
  walletClient: createWalletClient({
    account: privateKeyToAccount('0x...'),
    transport: http('https://rpc.arc.testnet')
  })
})`

const CREATE_PLAN_CODE = `\
const planId = await client.createPlan({
  price: 9990000n,      // 9.99 USDC (6 decimals)
  interval: 2592000n,   // 30 days in seconds
  trialPeriod: 0n
})`

const SUBSCRIBE_CODE = `\
await client.subscribe(planId)
// USDC allowance is managed automatically`

// ── Network table rows ────────────────────────────────────────────────────────

interface NetworkRow {
    property: string
    value:    string
    copyable: boolean
    href?:    string
}

const NETWORK_ROWS: NetworkRow[] = [
    { property: 'Network name',     value: 'Arc Testnet',                                    copyable: false                          },
    { property: 'Chain ID',         value: '5042002',                                        copyable: false                          },
    { property: 'RPC URL',          value: ARC_RPC_URL || '(VITE_ARC_RPC_URL not set)',      copyable: ARC_RPC_URL.length > 0         },
    { property: 'USDC address',     value: USDC_ADDRESS || '(not configured)',               copyable: false                          },
    { property: 'Contract address', value: CONTRACT_ADDRESS || '(not configured)',           copyable: CONTRACT_ADDRESS.length > 0    },
    { property: 'Block explorer',   value: EXPLORER_URL,                                     copyable: false, href: EXPLORER_URL      },
]

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
    id:        SectionId
    title:     string
    children?: React.ReactNode
}

/**
 * Wraps each documentation section with a consistent heading style, bottom
 * separator, and scroll-margin-top to ensure anchor links land below the
 * sticky dashboard header.
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

                    {/* ── Quick Start ─────────────────────────────────── */}
                    <DocSection id="quick-start" title="Quick Start">
                        <p className="text-sm text-gray-600 mb-8 leading-relaxed">
                            Start accepting subscriptions in minutes.
                        </p>
                        <DocStep n={1} title="Install the SDK">
                            <CodeBlock code={INSTALL_CODE} language="bash" />
                        </DocStep>
                        <DocStep n={2} title="Initialise the client">
                            <CodeBlock code={INIT_CODE} />
                        </DocStep>
                        <DocStep n={3} title="Create a plan">
                            <CodeBlock code={CREATE_PLAN_CODE} />
                        </DocStep>
                        <DocStep n={4} title="Subscribe a user">
                            <CodeBlock code={SUBSCRIBE_CODE} />
                        </DocStep>
                    </DocSection>

                    {/* ── Network ─────────────────────────────────────── */}
                    <DocSection id="network" title="Network">
                        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                            All contract interactions happen on Arc Testnet. There are no API keys —
                            authentication is wallet-based and entirely on-chain.
                        </p>
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="border-b border-gray-200">
                                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2.5 w-44">
                                        Property
                                    </th>
                                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2.5">
                                        Value
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {NETWORK_ROWS.map(({ property, value, copyable, href }) => (
                                    <tr key={property} className="border-b border-gray-100 last:border-0">
                                        <td className="py-3 pr-4 text-gray-500 align-middle whitespace-nowrap">
                                            {property}
                                        </td>
                                        <td className="py-3 align-middle">
                                            <div className="flex items-center">
                                                {href ? (
                                                    <a
                                                        href={href}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="font-mono text-indigo-600 hover:underline break-all"
                                                    >
                                                        {value}
                                                    </a>
                                                ) : (
                                                    <span className="font-mono text-gray-900 break-all">{value}</span>
                                                )}
                                                {copyable && <CopyButton value={value} />}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </DocSection>

                    {/* ── Remaining sections (content coming soon) ─────── */}
                    <DocSection id="sdk-reference" title="SDK Reference">
                        <SdkReferenceSection />
                    </DocSection>
                    <DocSection id="contract-reference" title="Contract Reference">
                        <ContractReferenceSection />
                    </DocSection>
                    <DocSection id="composability" title="Composability">
                        <ComposabilitySection />
                    </DocSection>
                    <DocSection id="webhooks" title="Webhooks">
                        <WebhooksSection />
                    </DocSection>

                </div>
            </div>
        </div>
    )
}
