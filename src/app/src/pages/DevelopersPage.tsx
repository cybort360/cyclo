/**
 * /developers — in-dashboard developer reference.
 * Two-column layout: sticky anchor nav (left) + section content (right).
 * Scroll-spy via IntersectionObserver highlights the active nav link.
 * No API key UI — authentication is wallet-based and on-chain.
 *
 * Class prefix: dvp-
 */
import { useState, useEffect } from 'react'
import { CodeBlock, DocStep, CopyButton } from '../components/DocCodeBlock'
import { CONTRACT_ADDRESS, USDC_ADDRESS } from '../constants/addresses'
import { SdkReferenceSection } from './SdkReferenceSection'
import { ContractReferenceSection } from './ContractReferenceSection'
import { ComposabilitySection } from './ComposabilitySection'
import { WebhooksSection } from './WebhooksSection'
import './DevelopersPage.css'

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

// ── Network table ─────────────────────────────────────────────────────────────

interface NetworkRow {
    property: string
    value:    string
    copyable: boolean
    href?:    string
}

const NETWORK_ROWS: NetworkRow[] = [
    { property: 'Network name',     value: 'Arc Testnet',                                  copyable: false                       },
    { property: 'Chain ID',         value: '5042002',                                      copyable: false                       },
    { property: 'RPC URL',          value: ARC_RPC_URL || '(VITE_ARC_RPC_URL not set)',    copyable: ARC_RPC_URL.length > 0      },
    { property: 'USDC address',     value: USDC_ADDRESS || '(not configured)',             copyable: false                       },
    { property: 'Contract address', value: CONTRACT_ADDRESS || '(not configured)',         copyable: CONTRACT_ADDRESS.length > 0 },
    { property: 'Block explorer',   value: EXPLORER_URL,                                   copyable: false, href: EXPLORER_URL   },
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
 * rootMargin '-20% 0px -75% 0px' creates a spotlight: a section becomes
 * "active" when its top edge enters the top 20% of the viewport.
 * The -75% bottom margin prevents two sections from being active at once.
 */
function useScrollSpy(): SectionId {
    const [activeId, setActiveId] = useState<SectionId>('quick-start')

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                for (const entry of entries) {
                    if (entry.isIntersecting) setActiveId(entry.target.id as SectionId)
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

// ── Sub-components ────────────────────────────────────────────────────────────

interface AnchorNavProps { activeId: SectionId }

function AnchorNav({ activeId }: AnchorNavProps) {
    return (
        <ul className="dvp-nav-list">
            {DOC_SECTIONS.map(({ id, label }) => (
                <li key={id}>
                    <a
                        href={`#${id}`}
                        className={`dvp-nav-link${activeId === id ? ' dvp-nav-link--active' : ''}`}
                    >
                        {label}
                    </a>
                </li>
            ))}
        </ul>
    )
}

interface DocSectionProps {
    id:        SectionId
    title:     string
    children?: React.ReactNode
}

function DocSection({ id, title, children }: DocSectionProps) {
    return (
        <section id={id} className="dvp-section">
            <h2 className="dvp-section-title">{title}</h2>
            <div className="dvp-section-body">
                {children ?? <p className="dvp-soon">Content coming soon.</p>}
            </div>
        </section>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function DevelopersPage() {
    const activeId = useScrollSpy()

    return (
        <div className="dvp-wrap">

            {/* ── Left anchor nav ───────────────────────────────────────── */}
            <aside className="dvp-nav">
                <div className="dvp-nav-inner">
                    <p className="dvp-nav-heading">On this page</p>
                    <AnchorNav activeId={activeId} />
                </div>
            </aside>

            {/* ── Main content ──────────────────────────────────────────── */}
            <div className="dvp-content">

                <div className="dvp-page-heading">
                    <h1 className="dvp-page-title">Developer reference</h1>
                    <p className="dvp-page-sub">
                        Integration guides, SDK reference, and on-chain contract documentation.
                    </p>
                </div>

                <div className="dvp-sections">

                    {/* ── Quick Start ─────────────────────────────────── */}
                    <DocSection id="quick-start" title="Quick Start">
                        <p className="dvp-section-lead">
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
                        <p className="dvp-section-lead">
                            All contract interactions happen on Arc Testnet. There are no API keys —
                            authentication is wallet-based and entirely on-chain.
                        </p>
                        <div className="dvp-net-wrap">
                            <table className="dvp-net-table">
                                <thead>
                                    <tr>
                                        <th className="dvp-net-th">Property</th>
                                        <th className="dvp-net-th">Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {NETWORK_ROWS.map(({ property, value, copyable, href }) => (
                                        <tr key={property} className="dvp-net-tr">
                                            <td className="dvp-net-td">{property}</td>
                                            <td className="dvp-net-td dvp-net-td--val">
                                                {href ? (
                                                    <a
                                                        href={href}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="dvp-net-link"
                                                    >
                                                        {value}
                                                    </a>
                                                ) : (
                                                    <span>{value}</span>
                                                )}
                                                {copyable && <CopyButton value={value} />}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </DocSection>

                    {/* ── Remaining sections ───────────────────────────── */}
                    <DocSection id="sdk-reference"      title="SDK Reference">
                        <SdkReferenceSection />
                    </DocSection>
                    <DocSection id="contract-reference" title="Contract Reference">
                        <ContractReferenceSection />
                    </DocSection>
                    <DocSection id="composability"      title="Composability">
                        <ComposabilitySection />
                    </DocSection>
                    <DocSection id="webhooks"           title="Webhooks">
                        <WebhooksSection />
                    </DocSection>

                </div>
            </div>
        </div>
    )
}
