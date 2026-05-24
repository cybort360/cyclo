/**
 * Merchant dashboard — three-column layout shell.
 *
 *   [Sidebar 220px fixed] | [Main: topbar + content, scrollable] | [RightPanel 280px]
 *
 * Pages inject right-panel content via useRightPanel() from RightPanelContext.
 * Uses Ivory & Indigo tokens from src/styles/tokens.css.
 * Class prefix: sl-  (sidebar layout)
 */
import { Link, useRoute, useLocation } from 'wouter'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { useState, useEffect, type ReactNode, type ComponentType } from 'react'
import {
    IconLayoutDashboard, IconUsers, IconAlertTriangle, IconStack2,
    IconReceipt, IconBuildingBank, IconChartBar, IconWebhook,
    IconCode, IconBook, IconPlayerPlay, IconSearch, IconLayoutSidebarRight,
} from '@tabler/icons-react'
import { useMerchantProfile } from '../context/MerchantProfileContext'
import { useSubscriptionManager } from '../hooks/useSubscriptionManager'
import { RightPanelCtx } from '../context/RightPanelContext'
import { ProfileSetupModal } from './ProfileSetupModal'
import { AIChatPanel } from './AIChatPanel'
import { SocketStatusIndicator } from './SocketStatusIndicator'
import Logo from './Logo'
import { fromUsdcUnits } from '../utils/formatting'
import { usePastDueCount } from '../hooks/usePastDueCount'
import { arcTestnet } from '../wagmi'
import './Layout.css'
import './AIChatPanel.css'

// ── Nav configuration ─────────────────────────────────────────────────────────

// Tabler icon components accept many SVG props; we only use size + aria-hidden.
// ComponentType<any> avoids coupling to Tabler's internal prop types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NavIcon = ComponentType<any>

interface NavItemDef {
    path:  string
    label: string
    icon:  NavIcon
    tag?:  'pitch'
}

interface NavGroupDef {
    label: string
    items: NavItemDef[]
}

const NAV_GROUPS: NavGroupDef[] = [
    {
        label: 'Workspace',
        items: [
            { path: '/dashboard',   label: 'Dashboard',   icon: IconLayoutDashboard },
            { path: '/subscribers', label: 'Subscribers', icon: IconUsers           },
            { path: '/past-due',    label: 'Past Due',    icon: IconAlertTriangle   },
            { path: '/plans',       label: 'Plans',       icon: IconStack2          },
            { path: '/settlements', label: 'Settlements', icon: IconReceipt         },
            { path: '/treasury',    label: 'Treasury',    icon: IconBuildingBank    },
        ],
    },
    {
        label: 'Analytics',
        items: [
            { path: '/analytics', label: 'Analytics', icon: IconChartBar },
            { path: '/webhooks',  label: 'Webhooks',  icon: IconWebhook  },
        ],
    },
    {
        label: 'Developers',
        items: [
            { path: '/developers', label: 'API & SDK',     icon: IconCode                     },
            { path: '/docs',       label: 'Documentation', icon: IconBook                     },
            { path: '/demo',       label: 'Live demo',     icon: IconPlayerPlay, tag: 'pitch' },
        ],
    },
]

/** Route path → top-bar title. */
const PAGE_TITLES: Record<string, string> = {
    '/dashboard':   'Overview',
    '/subscribers': 'Subscribers',
    '/past-due':    'Past Due',
    '/plans':       'Plans',
    '/settlements': 'Settlements',
    '/treasury':    'Treasury',
    '/analytics':   'Analytics',
    '/webhooks':    'Webhooks',
    '/developers':  'API & SDK',
    '/connect':     'Connect',
    '/docs':        'Documentation',
    '/demo':        'Live Demo',
}

// ── NavItem ───────────────────────────────────────────────────────────────────

interface NavItemProps extends NavItemDef {
    badge?: number
}

function NavItem({ path, label, icon: Icon, tag, badge }: NavItemProps) {
    const [active] = useRoute(path === '/dashboard' ? path : `${path}*`)
    return (
        <Link href={path}>
            <a className={`sl-nav-item${active ? ' sl-nav-item--active' : ''}`}>
                <Icon size={16} aria-hidden="true" />
                <span className="sl-nav-label">{label}</span>
                {badge !== undefined && badge > 0 && (
                    <span className="sl-nav-badge">{badge > 99 ? '99+' : badge}</span>
                )}
                {tag === 'pitch' && (
                    <span className="sl-nav-tag sl-nav-tag--pitch">Pitch</span>
                )}
            </a>
        </Link>
    )
}

// ── WrongNetworkBanner ────────────────────────────────────────────────────────

function WrongNetworkBanner() {
    const { switchChain, isPending } = useSwitchChain()
    return (
        <div className="sl-network-banner">
            <span className="sl-network-banner-text">
                Wrong network — switch to <strong>Arc Testnet</strong> (chain ID {arcTestnet.id}).
            </span>
            <button
                className="sl-network-switch-btn"
                disabled={isPending}
                onClick={() => switchChain({ chainId: arcTestnet.id })}
            >
                {isPending ? 'Switching…' : 'Switch network'}
            </button>
        </div>
    )
}

// ── Layout ────────────────────────────────────────────────────────────────────

export function Layout({ children }: { children: ReactNode }) {
    const { address, isConnected } = useAccount()
    const chainId                  = useChainId()
    const onCorrectChain           = !isConnected || chainId === arcTestnet.id
    const { profile }              = useMerchantProfile()
    const { usdcBalance }          = useSubscriptionManager()
    const pastDueCount             = usePastDueCount()
    const [location]               = useLocation()

    const [showProfileSetup, setShowProfileSetup] = useState(false)
    const [showAI, setShowAI]                     = useState(false)
    const [rightPanelContent, setRightPanel]      = useState<ReactNode>(null)
    const [isPanelOpen, setIsPanelOpen]           = useState(false)

    // Close the right panel drawer whenever the route changes
    useEffect(() => { setIsPanelOpen(false) }, [location])

    // Prompt merchant to complete their profile 1 s after connecting
    useEffect(() => {
        if (isConnected && address && profile === null) {
            const t = setTimeout(() => setShowProfileSetup(true), 1_000)
            return () => clearTimeout(t)
        }
        if (profile) setShowProfileSetup(false)
    }, [isConnected, address, profile])

    const pageTitle = PAGE_TITLES[location] ?? 'Dashboard'
    const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null
    /** Two-character initials derived from the wallet address. */
    const avatarInitials = address ? address.slice(2, 4).toUpperCase() : null

    return (
        <RightPanelCtx.Provider value={setRightPanel}>

            {showProfileSetup && (
                <ProfileSetupModal onComplete={() => setShowProfileSetup(false)} />
            )}

            <div className="sl-root">

                {/* ── Column 1: Left sidebar ──────────────────────────── */}
                <aside className="sl-sidebar">

                    {/* ── Top section: logo + merchant info ────────────── */}
                    <div className="sl-top">

                        {/* Logo row */}
                        <Link href="/dashboard">
                            <a className="sl-wordmark" aria-label="Cyclo dashboard">
                                <Logo size={24} wordmarkSize={13} />
                            </a>
                        </Link>

                        {/* Merchant info — only when profile is loaded */}
                        {profile && (
                            <div className="sl-merchant-info">
                                <p className="sl-merchant-name">{profile.business_name}</p>
                                <span className="sl-network-pill">Arc testnet</span>
                            </div>
                        )}
                    </div>

                    {/* ── Navigation ───────────────────────────────────── */}
                    <nav className="sl-nav" aria-label="Dashboard navigation">
                        {NAV_GROUPS.map(group => (
                            <div key={group.label} className="sl-nav-group">
                                <p className="sl-nav-group-label">{group.label}</p>
                                {group.items.map(item => (
                                    <NavItem
                                        key={item.path}
                                        {...item}
                                        badge={item.path === '/past-due' ? pastDueCount : undefined}
                                    />
                                ))}
                            </div>
                        ))}
                    </nav>

                    {/* ── Bottom: wallet row ────────────────────────────── */}
                    <div className="sl-bottom">
                        {shortAddr ? (
                            /* Connected — gradient avatar + address + balance */
                            <div className="sl-wallet-row">
                                <div
                                    className="sl-wallet-avatar"
                                    title={address}
                                    aria-label={`Wallet ${shortAddr}`}
                                >
                                    {avatarInitials}
                                </div>
                                <div className="sl-wallet-info">
                                    <p className="sl-wallet-addr">{shortAddr}</p>
                                    {usdcBalance !== undefined && (
                                        <p className="sl-wallet-balance">
                                            {fromUsdcUnits(usdcBalance).toFixed(2)} USDC
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* Not connected */
                            <Link href="/connect">
                                <a className="sl-connect-link">Connect wallet →</a>
                            </Link>
                        )}
                    </div>

                </aside>

                {/* ── Column 2: Main content ──────────────────────────── */}
                <main className="sl-main">

                    {/* ── Sticky top bar ───────────────────────────────── */}
                    <header className="sl-topbar">

                        {/* Left: Logo on mobile (sidebar hidden) / page title on desktop */}
                        <div className="sl-topbar-left">
                            <Link href="/dashboard">
                                <a className="sl-topbar-logo" aria-label="Cyclo dashboard">
                                    <Logo size={22} wordmarkSize={12} />
                                </a>
                            </Link>
                            <span className="sl-topbar-title">{pageTitle}</span>
                        </div>

                        {/* Centre: search */}
                        <div className="sl-search">
                            <IconSearch
                                size={14}
                                className="sl-search-icon"
                                aria-hidden="true"
                            />
                            <input
                                type="text"
                                className="sl-search-input"
                                placeholder="Search subscribers, plans, tx..."
                                aria-label="Search"
                            />
                        </div>

                        {/* Right: panel toggle (mobile) + socket indicator + divider + avatar */}
                        <div className="sl-topbar-right">
                            <button
                                onClick={() => setIsPanelOpen(v => !v)}
                                className="sl-panel-toggle"
                                aria-label={isPanelOpen ? 'Close panel' : 'Open panel'}
                                aria-expanded={isPanelOpen}
                            >
                                <IconLayoutSidebarRight size={18} aria-hidden="true" />
                            </button>
                            <SocketStatusIndicator />
                            <div className="sl-topbar-divider" aria-hidden="true" />
                            {avatarInitials && (
                                <div className="sl-avatar" title={address}>
                                    {avatarInitials}
                                </div>
                            )}
                        </div>

                    </header>

                    {isConnected && !onCorrectChain && <WrongNetworkBanner />}

                    <div className="sl-content">
                        {children}
                    </div>
                </main>

                {/* Mobile backdrop — closes the right panel on tap */}
                <div
                    className={`sl-panel-backdrop${isPanelOpen ? ' sl-panel-backdrop--open' : ''}`}
                    onClick={() => setIsPanelOpen(false)}
                    aria-hidden="true"
                />

                {/* ── Column 3: Right panel ───────────────────────────── */}
                <aside className={`sl-rightpanel${isPanelOpen ? ' sl-rightpanel--open' : ''}`} aria-label="Page context panel">
                    <div className="sl-rightpanel-body">
                        {rightPanelContent}
                    </div>

                    {/* AI trigger lives at the bottom of the right panel */}
                    <div className="sl-rightpanel-footer">
                        {showAI && <AIChatPanel onClose={() => setShowAI(false)} />}
                        <button
                            onClick={() => setShowAI(v => !v)}
                            className={`ai-trigger${showAI ? ' ai-trigger--active' : ''}`}
                            aria-label={showAI ? 'Close AI assistant' : 'Open AI assistant'}
                            aria-expanded={showAI}
                        >
                            <span className="ai-trigger-dot" aria-hidden="true" />
                            Cyclo AI
                        </button>
                    </div>
                </aside>

            </div>

        </RightPanelCtx.Provider>
    )
}
