/**
 * Displays the connected wallet address and USDC balance.
 * Rendered in ConnectPage — not shown when wallet is disconnected.
 */
import { useConnect, useDisconnect } from 'wagmi';
import { fromUsdcUnits } from '../utils/formatting';

interface WalletStatusProps {
    address:     `0x${string}`;
    usdcBalance: bigint | undefined;
}

export function WalletStatus({ address, usdcBalance }: WalletStatusProps) {
    const { disconnect } = useDisconnect();
    const shortAddress   = `${address.slice(0, 6)}…${address.slice(-4)}`;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start' }}>
            <div>
                <span style={{ fontWeight: 600 }}>Address: </span>
                <code style={{ fontSize: '14px' }}>{address}</code>
                <span style={{ marginLeft: '8px', color: '#6b6375', fontSize: '13px' }}>({shortAddress})</span>
            </div>
            <div>
                <span style={{ fontWeight: 600 }}>USDC Balance: </span>
                <span>{usdcBalance !== undefined ? `${fromUsdcUnits(usdcBalance)} USDC` : '—'}</span>
            </div>
            <button
                onClick={() => disconnect()}
                style={{ padding: '8px 16px', cursor: 'pointer', borderRadius: '6px', border: '1px solid #e5e4e7' }}
            >
                Disconnect
            </button>
        </div>
    );
}

export function ConnectButton() {
    const { connect, connectors, isPending } = useConnect();
    const injected = connectors.find(c => c.id === 'injected');

    return (
        <button
            onClick={() => injected && connect({ connector: injected })}
            disabled={isPending || !injected}
            style={{
                padding:      '12px 24px',
                background:   '#6366f1',
                color:        '#fff',
                border:       'none',
                borderRadius: '8px',
                cursor:       isPending ? 'wait' : 'pointer',
                fontSize:     '16px',
            }}
        >
            {isPending ? 'Connecting…' : 'Connect Wallet'}
        </button>
    );
}
