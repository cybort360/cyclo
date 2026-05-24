/**
 * Feature highlights section — left-aligned header + 3-column tile grid.
 *
 * Tile 1 (Keeper automation) spans 2 columns and embeds a dark terminal widget
 * showing live keeper log output. Remaining 5 tiles are 1-column each.
 *
 * CSS: FeaturesSection.css — l- tokens only, no dark dashboard tokens.
 */
import type { ComponentType } from 'react'
import {
    IconBolt,
    IconCertificate,
    IconCurrencyDollar,
    IconCode,
    IconWebhook,
    IconPalette,
} from '@tabler/icons-react'
import './FeaturesSection.css'

// ── Keeper terminal widget ────────────────────────────────────────────────────

/**
 * Dark-bg terminal mockup embedded in the wide Keeper automation tile.
 * All content is decorative (aria-hidden on parent tile).
 */
function KeeperTerminal() {
    return (
        <div className="ft-terminal">
            <p className="ft-term-line ft-term-line--muted">{'> [09:14:02] scheduler started'}</p>
            <p className="ft-term-line ft-term-line--ok">{'> [09:14:05] batchCharge · 847 subs · OK'}</p>
            <p className="ft-term-line ft-term-line--ok">{'> [09:14:08] batchCharge · 312 subs · OK'}</p>
            <p className="ft-term-line ft-term-line--warn">{'> [09:14:11] preflight · low_balance · grace 2/3'}</p>
        </div>
    )
}

// ── Tile data ─────────────────────────────────────────────────────────────────

interface TileDef {
    id:    string
    /** Tabler icon component — rendered at 20px with l-accent colour. */
    Icon:  ComponentType<{ size?: number; 'aria-hidden'?: boolean | 'true' }>
    title: string
    body:  string
    wide?: true
}

const TILES: TileDef[] = [
    {
        id:    'keeper',
        Icon:  IconBolt,
        title: 'Keeper automation',
        body:  'Charges fire on schedule. 3-attempt grace period for low-balance subscribers. Graceful shutdown and reorg detection built in.',
        wide:  true,
    },
    {
        id:    'nfts',
        Icon:  IconCertificate,
        title: 'Soulbound NFTs',
        body:  'Every subscription mints a non-transferable ERC-721. Any Arc contract verifies access with one call — no Cyclo integration needed.',
    },
    {
        id:    'usdc',
        Icon:  IconCurrencyDollar,
        title: 'USDC native',
        body:  'Priced, settled, and gas-paid in USDC. No ETH exposure, no FX risk, perfectly predictable keeper costs.',
    },
    {
        id:    'sdk',
        Icon:  IconCode,
        title: '@cyclo/sdk',
        body:  'Viem-based SDK with auto-allowance management. @cyclo/react hooks for instant frontend integration. TypeScript-first.',
    },
    {
        id:    'webhooks',
        Icon:  IconWebhook,
        title: 'Webhooks',
        body:  'HTTP event delivery for every subscription and payment event. Block-polling relay with fan-out to multiple endpoints.',
    },
    {
        id:    'whitelabel',
        Icon:  IconPalette,
        title: 'White-label checkout',
        body:  'Branded checkout pages on your own subdomain. Custom logo, colours, and domain — feels like your own product.',
    },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function FeaturesSection() {
    return (
        <section id="features" className="ft-section">
            <div className="ft-inner">

                {/* ── Section header — left-aligned ───────────────────── */}
                <div className="ft-header">
                    <span className="ft-eyebrow">Features</span>
                    <h2 className="ft-h2">
                        Everything you need to<br />
                        <em className="ft-h2-em">run on-chain billing.</em>
                    </h2>
                </div>

                {/* ── Feature tile grid ────────────────────────────────── */}
                <div className="ft-grid">
                    {TILES.map(({ id, Icon, title, body, wide }) => (
                        <div
                            key={id}
                            className={`ft-tile${wide ? ' ft-tile--wide' : ''}`}
                        >
                            {/* Icon area */}
                            <div className="ft-icon-wrap" aria-hidden="true">
                                <Icon size={20} aria-hidden="true" />
                            </div>

                            <h3 className="ft-title">{title}</h3>
                            <p className="ft-desc">{body}</p>

                            {/* Terminal widget — wide tile only */}
                            {wide && <KeeperTerminal />}
                        </div>
                    ))}
                </div>

            </div>
        </section>
    )
}
