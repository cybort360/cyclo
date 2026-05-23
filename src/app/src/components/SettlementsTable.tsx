/**
 * Table of PaymentCharged events for the merchant's plans.
 * Shows each settlement and the running total USDC received.
 *
 * newTxHashes — optional set of transaction hashes that arrived via the
 * Socket.io keeper feed. Rows whose txHash is in this set receive a
 * brief highlight animation when they first appear.
 */
import type { PaymentEvent } from '../hooks/useSubscriptionManager';
import { fromUsdcUnits } from '../utils/formatting';
import { EmptyState } from './EmptyState';

const SETTLEMENTS_EMPTY_ICON = (
    <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center">
        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24"
             stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6M9 16h4" />
        </svg>
    </div>
);

interface SettlementsTableProps {
    settlements:  PaymentEvent[];
    isLoading:    boolean;
    error?:       string;
    /** txHashes currently mid-highlight; supplied by SettlementsPage for live rows. */
    newTxHashes?: ReadonlySet<string>;
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #e5e4e7', fontWeight: 600, fontSize: '13px', color: '#6b6375' };
const tdStyle: React.CSSProperties = { padding: '10px 12px', borderBottom: '1px solid #f4f3f6', fontSize: '14px' };

/**
 * Returns a locale date string for a Unix-second timestamp.
 * Returns "—" for rows where the timestamp is unavailable (0n sentinel),
 * which is the case for live socket rows that lack nextChargeTimestamp.
 */
function formatTimestamp(ts: bigint): string {
    if (ts === 0n) return '—';
    return new Date(Number(ts) * 1000).toLocaleDateString();
}

export function SettlementsTable({ settlements, isLoading, error, newTxHashes }: SettlementsTableProps) {
    if (isLoading) return <p style={{ color: '#6b6375' }}>Loading settlements…</p>;
    if (error)     return <p style={{ color: '#dc2626' }}>Failed to load settlements: {error}</p>;
    if (settlements.length === 0) return (
        <EmptyState
            icon={SETTLEMENTS_EMPTY_ICON}
            heading="No settlements yet"
            subtext="Settlements appear here as the keeper processes due payments. Check back after your first billing cycle."
        />
    );

    const totalSettled = settlements.reduce((acc, s) => acc + s.amount, 0n);

    return (
        <>
            {/* Keyframe defined inline — no external CSS file or animation library needed. */}
            <style>{`
                @keyframes cyclo-row-highlight {
                    0%   { background-color: #eef2ff; }
                    60%  { background-color: #eef2ff; }
                    100% { background-color: transparent; }
                }
            `}</style>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontWeight: 600, fontSize: '18px' }}>
                    Total received: <span style={{ color: '#6366f1' }}>{fromUsdcUnits(totalSettled)} USDC</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Plan ID</th>
                                <th style={thStyle}>Subscriber</th>
                                <th style={thStyle}>Amount (USDC)</th>
                                <th style={thStyle}>Next charge</th>
                                <th style={thStyle}>Tx</th>
                            </tr>
                        </thead>
                        <tbody>
                            {settlements.map((s, i) => {
                                const isNew = newTxHashes?.has(s.txHash) ?? false;
                                return (
                                    <tr
                                        key={`${s.txHash}-${i}`}
                                        style={isNew ? { animation: 'cyclo-row-highlight 2s ease-out forwards' } : undefined}
                                    >
                                        <td style={tdStyle}>{s.planId.toString()}</td>
                                        <td style={tdStyle}>
                                            <code style={{ fontSize: '13px' }}>{s.subscriber.slice(0, 8)}…{s.subscriber.slice(-4)}</code>
                                        </td>
                                        <td style={tdStyle}>{fromUsdcUnits(s.amount)}</td>
                                        <td style={tdStyle}>{formatTimestamp(s.nextChargeTimestamp)}</td>
                                        <td style={tdStyle}>
                                            <a
                                                href={`https://testnet.arcscan.app/tx/${s.txHash}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{ color: '#6366f1', fontSize: '13px' }}
                                            >
                                                {s.txHash.slice(0, 10)}…
                                            </a>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
