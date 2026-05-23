/**
 * Subscriber view — look up any plan by ID, inspect details, and subscribe, migrate, or cancel.
 */
import { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { SUBSCRIPTION_MANAGER_ABI } from '../constants/abis';
import { CONTRACT_ADDRESS } from '../constants/addresses';
import { fromUsdcUnits, intervalToLabel } from '../utils/formatting';
import { useSubscriptionManager, type PlanStruct, type SubscriptionStruct } from '../hooks/useSubscriptionManager';

type Address = `0x${string}`;


function formatTrialDuration(seconds: bigint): string {
    const days = Number(seconds) / 86400;
    return days === Math.floor(days) ? `${days}-day` : `${seconds}s`;
}

const inputStyle: React.CSSProperties = {
    padding: '8px 12px', border: '1px solid #e5e4e7', borderRadius: '6px',
    fontSize: '15px', width: '100%', boxSizing: 'border-box',
};

export function SubscribeForm() {
    const [planIdInput, setPlanIdInput] = useState('');
    const [error,       setError]       = useState('');
    const [successMsg,  setSuccessMsg]  = useState('');
    const { address }                   = useAccount();
    const { subscribeToPlan, cancelSubscription, migratePlan, isPending } = useSubscriptionManager();

    useEffect(() => {
        if (!successMsg) return;
        const timer = setTimeout(() => setSuccessMsg(''), 5000);
        return () => clearTimeout(timer);
    }, [successMsg]);

    const planId = planIdInput.trim() !== '' && /^\d+$/.test(planIdInput.trim())
        ? BigInt(planIdInput.trim())
        : null;

    const { data: planData } = useReadContract({
        address:      CONTRACT_ADDRESS as Address,
        abi:          SUBSCRIPTION_MANAGER_ABI,
        functionName: 'getPlan',
        args:         planId !== null ? [planId] : undefined,
        query:        { enabled: planId !== null },
    });

    const { data: subData, refetch: refetchSub } = useReadContract({
        address:      CONTRACT_ADDRESS as Address,
        abi:          SUBSCRIPTION_MANAGER_ABI,
        functionName: 'getSubscription',
        args:         planId !== null && address ? [planId, address] : undefined,
        query:        { enabled: planId !== null && !!address },
    });

    const plan         = planData as PlanStruct | undefined;
    const sub          = subData  as SubscriptionStruct | undefined;
    const planExists   = plan && plan.price > 0n;
    const isSubscribed = sub?.active === true;
    const hasTrial     = plan && plan.trialDuration > 0n;

    async function handleSubscribe() {
        if (!planId) return;
        setError('');
        try {
            await subscribeToPlan(planId);
            await refetchSub();
            setSuccessMsg(hasTrial
                ? `Subscribed! Your ${formatTrialDuration(plan!.trialDuration)} free trial starts now.`
                : 'Subscribed successfully!');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Transaction failed.');
        }
    }

    async function handleCancel() {
        if (!planId) return;
        setError('');
        try {
            await cancelSubscription(planId);
            await refetchSub();
            setSuccessMsg('Subscription cancelled.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Transaction failed.');
        }
    }

    const [migrateFromInput, setMigrateFromInput] = useState('');
    const migrateFromId = migrateFromInput.trim() !== '' && /^\d+$/.test(migrateFromInput.trim())
        ? BigInt(migrateFromInput.trim())
        : null;

    async function handleMigrate() {
        if (!planId || !migrateFromId) return;
        setError('');
        try {
            await migratePlan(migrateFromId, planId);
            await refetchSub();
            setSuccessMsg(`Migrated from plan ${migrateFromId} to plan ${planId}.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Transaction failed.');
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '480px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontWeight: 600 }}>Plan ID</span>
                <input
                    type="number" min="1" step="1" placeholder="Enter a plan ID to look up"
                    value={planIdInput}
                    onChange={e => { setPlanIdInput(e.target.value); setError(''); }}
                    style={inputStyle}
                />
            </label>

            {planId !== null && !planExists && (
                <p style={{ color: '#6b6375', margin: 0 }}>No plan found for ID {planIdInput}.</p>
            )}

            {planExists && plan && (
                <div style={{ padding: '16px', border: '1px solid #e5e4e7', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                    <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>Plan {planIdInput}</div>
                    <div><span style={{ color: '#6b6375' }}>Price:</span> {fromUsdcUnits(plan.price)} USDC</div>
                    <div><span style={{ color: '#6b6375' }}>Interval:</span> {intervalToLabel(Number(plan.interval))}</div>
                    {hasTrial && (
                        <div style={{ padding: '6px 10px', background: '#eff6ff', borderRadius: '4px', color: '#1d4ed8', fontSize: '13px', fontWeight: 600 }}>
                            {formatTrialDuration(plan.trialDuration)} free trial included
                        </div>
                    )}
                    <div><span style={{ color: '#6b6375' }}>Merchant:</span> <code style={{ fontSize: '12px' }}>{plan.merchant}</code></div>
                    <div>
                        <span style={{ color: '#6b6375' }}>Status:</span>{' '}
                        <span style={{ fontWeight: 600, color: plan.active ? '#16a34a' : '#dc2626' }}>
                            {plan.active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    {isSubscribed && sub && (
                        <div style={{ marginTop: '4px', padding: '8px 12px', background: '#f0fdf4', borderRadius: '6px', fontSize: '13px', color: '#166534' }}>
                            You are subscribed — next charge: {new Date(Number(sub.nextChargeTimestamp) * 1000).toLocaleDateString()}
                        </div>
                    )}
                </div>
            )}

            {planExists && plan && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {!isSubscribed && plan.active && (
                        <button onClick={handleSubscribe} disabled={isPending}
                            style={{ padding: '10px 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', cursor: isPending ? 'wait' : 'pointer', fontSize: '15px' }}>
                            {isPending ? 'Processing…' : hasTrial ? `Start ${formatTrialDuration(plan.trialDuration)} Free Trial` : 'Approve & Subscribe'}
                        </button>
                    )}
                    {isSubscribed && (
                        <button onClick={handleCancel} disabled={isPending}
                            style={{ padding: '10px 20px', background: 'none', color: '#dc2626', border: '1px solid #dc2626', borderRadius: '6px', cursor: isPending ? 'wait' : 'pointer', fontSize: '15px' }}>
                            {isPending ? 'Processing…' : 'Cancel Subscription'}
                        </button>
                    )}
                    {!isSubscribed && plan.active && (
                        <details style={{ fontSize: '13px' }}>
                            <summary style={{ cursor: 'pointer', color: '#6b6375' }}>Migrate from another plan instead</summary>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px' }}>
                                <input
                                    type="number" min="1" step="1" placeholder="Current plan ID"
                                    value={migrateFromInput}
                                    onChange={e => setMigrateFromInput(e.target.value)}
                                    style={{ ...inputStyle, width: '160px' }}
                                />
                                <button onClick={handleMigrate} disabled={isPending || !migrateFromId}
                                    style={{ padding: '8px 16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', cursor: (isPending || !migrateFromId) ? 'not-allowed' : 'pointer', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                    {isPending ? 'Processing…' : 'Migrate Plan'}
                                </button>
                            </div>
                        </details>
                    )}
                </div>
            )}

            {error      && <p style={{ color: '#dc2626', margin: 0, fontSize: '14px' }}>{error}</p>}
            {successMsg && <p style={{ color: '#16a34a', margin: 0, fontSize: '14px' }}>{successMsg}</p>}
        </div>
    );
}
