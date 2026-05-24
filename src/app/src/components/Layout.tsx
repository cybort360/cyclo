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
import { useAccount, useChainId, useSwitchChain, useDisconnect } from 'wagmi'
import { useState, useEffect, useRef, type ReactNode, type ComponentType } from 'react'
import {
    IconLayoutDashboard, IconUsers, IconAlertTriangle, IconStack2,
    IconReceipt, IconBuildingBank, IconChartBar, IconWebhook,
    IconCode, IconBook, IconPlayerPlay, IconSearch, IconLayoutSidebarRight,
    IconPlugConnected, IconPlugConnectedX, IconMenu2,
} from '@tabler/icons-react'
import { useMerchantProfile } from '../context/MerchantProfileContext'
import { useSubscriptionManager } from '../hooks/useSubscriptionManager'
import { useSocket } from '../hooks/useSocket'
import { RightPanelCtx } from '../context/RightPanelContext'
import { ProfileSetupModal } from './ProfileSetupModal'
import { AIChatPanel } from './AIChatPanel'
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

// ── TopbarWallet ──────────────────────────────────────────────────────────────

/**
 * Wallet chip shown in the topbar right area.
 * Connected: USDC balance + abbreviated address, click → dropdown to disconnect.
 * Disconnected: pill link that navigates to /connect.
 */
function TopbarWallet({ usdcBalance }: { usdcBalance: bigint | undefined }) {
    const { address, isConnected } = useAccount()
    const { disconnect }           = useDisconnect()
    const [open, setOpen]          = useState(false)
    const wrapRef                  = useRef<HTMLDivElement>(null)

    // Close the dropdown when clicking outside.
    useEffect(() => {
        if (!open) return
        function handleClick(e: MouseEvent) {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [open])

    if (!isConnected || !address) {
        return (
            <Link href="/connect" className="sl-wallet-chip sl-wallet-chip--disconnected">
                <IconPlugConnected size={13} aria-hidden="true" />
                Connect wallet
            </Link>
        )
    }

    const shortAddr   = `${address.slice(0, 6)}…${address.slice(-4)}`
    const usdcDisplay = usdcBalance !== undefined
        ? `${fromUsdcUnits(usdcBalance).toFixed(2)} USDC`
        : '— USDC'

    return (
        <div className="sl-wallet-wrap" ref={wrapRef}>
            <button
                className={`sl-wallet-chip${open ? ' sl-wallet-chip--open' : ''}`}
                onClick={() => setOpen(v => !v)}
                aria-expanded={open}
                aria-haspopup="menu"
            >
                <span className="sl-wallet-balance">{usdcDisplay}</span>
                <span className="sl-wallet-divider" aria-hidden="true" />
                <span className="sl-wallet-addr">{shortAddr}</span>
            </button>

            {open && (
                <div className="sl-wallet-dropdown" role="menu">
                    <p className="sl-wallet-dropdown-addr" title={address}>{address}</p>
                    <button
                        className="sl-wallet-disconnect"
                        role="menuitem"
                        onClick={() => { disconnect(); setOpen(false) }}
                    >
                        <IconPlugConnectedX size={13} aria-hidden="true" />
                        Disconnect
                    </button>
                </div>
            )}
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

    // Acquire the socket here so it stays alive for the full Layout lifetime,
    // feeding real-time events to every dashboard page without each page
    // needing to manage its own connection.
    useSocket()

    const [showProfileSetup, setShowProfileSetup] = useState(false)
    const [showAI, setShowAI]                     = useState(false)
    const [rightPanelContent, setRightPanel]      = useState<ReactNode>(null)
    const [isPanelOpen, setIsPanelOpen]           = useState(false)
    const [isNavOpen, setIsNavOpen]               = useState(false)

    // Close both drawers whenever the route changes
    useEffect(() => {
        setIsPanelOpen(false)
        setIsNavOpen(false)
    }, [location])

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

                {/* ── Column 1: Left sidebar — desktop fixed, mobile slide-in drawer */}
                <aside className={`sl-sidebar${isNavOpen ? ' sl-sidebar--open' : ''}`}>

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


                </aside>

                {/* ── Column 2: Main content ──────────────────────────── */}
                <main className="sl-main">

                    {/* ── Sticky top bar ───────────────────────────────── */}
                    <header className="sl-topbar">

                        {/* Left: hamburger (mobile) + Logo / page title */}
                        <div className="sl-topbar-left">
                            {/* Hamburger — opens the nav drawer on mobile only */}
                            <button
                                onClick={() => setIsNavOpen(v => !v)}
                                className="sl-nav-toggle"
                                aria-label={isNavOpen ? 'Close navigation' : 'Open navigation'}
                                aria-expanded={isNavOpen}
                            >
                                <IconMenu2 size={18} aria-hidden="true" />
                            </button>
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

                        {/* Right: panel toggle (mobile) + wallet chip */}
                        <div className="sl-topbar-right">
                            <button
                                onClick={() => setIsPanelOpen(v => !v)}
                                className="sl-panel-toggle"
                                aria-label={isPanelOpen ? 'Close panel' : 'Open panel'}
                                aria-expanded={isPanelOpen}
                            >
                                <IconLayoutSidebarRight size={18} aria-hidden="true" />
                            </button>
                            <TopbarWallet usdcBalance={usdcBalance} />
                        </div>

                    </header>

                    {isConnected && !onCorrectChain && <WrongNetworkBanner />}

                    <div className="sl-content">
                        {children}
                    </div>
                </main>

                {/* Mobile backdrop — closes the nav drawer on tap */}
                <div
                    className={`sl-nav-backdrop${isNavOpen ? ' sl-nav-backdrop--open' : ''}`}
                    onClick={() => setIsNavOpen(false)}
                    aria-hidden="true"
                />

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
