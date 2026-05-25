/**
 * WalletStatus — connected-wallet card content rendered inside ConnectPage.
 * ConnectButton — shown when no wallet is connected.
 *
 * Both use Cyclo design-token CSS classes (cp-*) defined in ConnectPage.css.
 */
import { useState } from 'react'
import { useConnect, useDisconnect } from 'wagmi'
import { Link } from 'wouter'
import { fromUsdcUnits } from '../utils/formatting'

interface WalletStatusProps {
    address:     `0x${string}`
    usdcBalance: bigint | undefined
}

export function WalletStatus({ address, usdcBalance }: WalletStatusProps) {
    const { disconnect } = useDisconnect()
    const [copied, setCopied] = useState(false)

    const short = `${address.slice(0, 6)}…${address.slice(-4)}`

    function handleCopy() {
        navigator.clipboard.writeText(address).catch(() => {})
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
    }

    const balance = usdcBalance !== undefined
        ? `${Number(fromUsdcUnits(usdcBalance)).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
          })} USDC`
        : null

    return (
        <div className="cp-wallet-status">
            <div className="cp-wallet-top">
                <span className="cp-dot" />
                <span className="cp-connected-label">Connected</span>
            </div>
            <div className="cp-wallet-info">
                <div className="cp-address-row">
                    <span className="cp-address">{short}</span>
                    <button className="cp-copy-btn" onClick={handleCopy} title="Copy full address">
                        {copied ? '✓ Copied' : 'Copy'}
                    </button>
                </div>
                <div className="cp-balance">
                    {balance
                        ? <strong>{balance}</strong>
                        : <span style={{ color: 'var(--text-muted)' }}>Loading balance…</span>
                    }
                </div>
            </div>
            <div className="cp-wallet-actions">
                <Link href="/plans">
                    <a className="cp-btn cp-btn-primary">Create a plan →</a>
                </Link>
                <Link href="/subscribe">
                    <a className="cp-btn cp-btn-outline">Subscribe to a plan →</a>
                </Link>
                <button className="cp-btn cp-btn-ghost" onClick={() => disconnect()}>
                    Disconnect
                </button>
            </div>
        </div>
    )
}

export function ConnectButton() {
    const { connect, connectors, isPending } = useConnect()
    const injected = connectors.find(c => c.id === 'injected')

    return (
        <div className="cp-connect-gate">
            <p className="cp-connect-hint">
                Connect an injected wallet (MetaMask or compatible) to use Cyclo on Arc testnet.
            </p>
            <button
                className="cp-btn cp-btn-primary"
                onClick={() => injected && connect({ connector: injected })}
                disabled={isPending || !injected}
                style={{ alignSelf: 'flex-start' }}
            >
                {isPending ? 'Connecting…' : 'Connect wallet'}
            </button>
        </div>
    )
}
