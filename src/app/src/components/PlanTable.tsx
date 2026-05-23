/**
 * Table of PlanCreated events for the connected merchant.
 * Reads plan active status from chain; shows Inactive badge for deactivated plans.
 */
import type { PlanEvent } from '../hooks/useSubscriptionManager';
import { fromUsdcUnits, intervalToLabel } from '../utils/formatting';

interface PlanTableProps {
    plans:         PlanEvent[];
    isLoading:     boolean;
    isPending:     boolean;
    pendingPlanId: bigint | null;
    planStatuses:  Map<string, boolean>;
    planTrials:    Map<string, bigint>;
    error?:        string;
    onDeactivate:  (planId: bigint) => Promise<void>;
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #e5e4e7', fontWeight: 600, fontSize: '13px', color: '#6b6375' };
const tdStyle: React.CSSProperties = { padding: '10px 12px', borderBottom: '1px solid #f4f3f6', fontSize: '14px' };

function formatTrial(seconds: bigint | undefined): string {
    if (!seconds || seconds === 0n) return '—';
    const days = Number(seconds) / 86400;
    return Number.isInteger(days) ? `${days}d` : `${Number(seconds)}s`;
}

export function PlanTable({ plans, isLoading, isPending, pendingPlanId, planStatuses, planTrials, error, onDeactivate }: PlanTableProps) {
    if (isLoading) return <p style={{ color: '#6b6375' }}>Loading plans…</p>;
    if (error)     return <p style={{ color: '#dc2626' }}>Failed to load plans: {error}</p>;
    if (plans.length === 0) return <p style={{ color: '#6b6375' }}>No plans created yet.</p>;

    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        <th style={thStyle}>Plan ID</th>
                        <th style={thStyle}>Price (USDC)</th>
                        <th style={thStyle}>Interval</th>
                        <th style={thStyle}>Trial</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Tx</th>
                        <th style={thStyle}></th>
                    </tr>
                </thead>
                <tbody>
                    {plans.map(plan => {
                        const isActive      = planStatuses.get(plan.planId.toString()) !== false;
                        const isThisPending = pendingPlanId === plan.planId;
                        const rowOpacity    = isActive ? 1 : 0.45;
                        return (
                            <tr key={plan.txHash} style={{ opacity: rowOpacity }}>
                                <td style={tdStyle}>{plan.planId.toString()}</td>
                                <td style={tdStyle}>{fromUsdcUnits(plan.price)}</td>
                                <td style={tdStyle}>{intervalToLabel(Number(plan.interval))}</td>
                                <td style={tdStyle}>{formatTrial(planTrials.get(plan.planId.toString()))}</td>
                                <td style={tdStyle}>
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{
                                            fontSize:     '12px',
                                            fontWeight:   600,
                                            padding:      '2px 8px',
                                            borderRadius: '999px',
                                            background:   isActive ? '#dcfce7' : '#f4f3f6',
                                            color:        isActive ? '#16a34a' : '#6b6375',
                                        }}>
                                            {isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </td>
                                <td style={tdStyle}>
                                    <a
                                        href={`https://testnet.arcscan.app/tx/${plan.txHash}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ color: '#6366f1', fontSize: '13px' }}
                                    >
                                        {plan.txHash.slice(0, 10)}…
                                    </a>
                                </td>
                                <td style={tdStyle}>
                                    {isActive ? (
                                        <button
                                            onClick={() => onDeactivate(plan.planId)}
                                            disabled={pendingPlanId !== null || isPending}
                                            style={{
                                                padding:      '4px 10px',
                                                cursor:       isThisPending ? 'wait' : (pendingPlanId !== null || isPending) ? 'not-allowed' : 'pointer',
                                                fontSize:     '13px',
                                                borderRadius: '4px',
                                                border:       '1px solid #e5e4e7',
                                                opacity:      (pendingPlanId !== null && !isThisPending) ? 0.5 : 1,
                                            }}
                                        >
                                            {isThisPending ? 'Deactivating…' : 'Deactivate'}
                                        </button>
                                    ) : (
                                        <span style={{ fontSize: '13px', color: '#6b6375' }}>—</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
