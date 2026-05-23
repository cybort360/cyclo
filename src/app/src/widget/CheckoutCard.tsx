/**
 * Self-contained checkout card component for the embeddable widget.
 * Must be rendered inside a WagmiProvider + QueryClientProvider (supplied by Widget.tsx).
 */
import { useState } from 'react';
import {
    useAccount,
    useChainId,
    useConnect,
    useReadContract,
    useSwitchChain,
    useWriteContract,
    usePublicClient,
} from 'wagmi';
import { maxUint256 } from 'viem';
import { SUBSCRIPTION_MANAGER_ABI, USDC_ABI } from '../constants/abis';
import { fromUsdcUnits, intervalToLabel } from '../utils/formatting';
import { arcTestnet } from './Widget';

type Address = `0x${string}`;

interface CheckoutCardProps {
    planId:          bigint;
    contractAddress: string;
    usdcAddress:     string;
}

interface PlanStruct {
    merchant:      Address;
    active:        boolean;
    trialDuration: bigint;
    price:         bigint;
    interval:      bigint;
}

interface SubscriptionStruct {
    nextChargeTimestamp: bigint;
    active:              boolean;
}


function formatTrialDuration(seconds: bigint): string {
    const days = Number(seconds) / 86400;
    return days === Math.floor(days) ? `${days}-day` : `${Number(seconds)}s`;
}

function ConnectButton() {
    const { connect, connectors } = useConnect();
    return (
        <button
            onClick={() => connect({ connector: connectors[0] })}
            style={{ width: '100%', padding: '12px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: 600 }}
        >
            Connect Wallet
        </button>
    );
}

export function CheckoutCard({ planId, contractAddress, usdcAddress }: CheckoutCardProps) {
    const { isConnected, address } = useAccount();
    const chainId                  = useChainId();
    const { switchChain }          = useSwitchChain();
    const publicClient             = usePublicClient();
    const { writeContractAsync }   = useWriteContract();
    const onCorrectChain           = !isConnected || chainId === arcTestnet.id;
    const [isPending,  setIsPending]  = useState(false);
    const [error,      setError]      = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const { data: planData, isLoading: planLoading } = useReadContract({
        address:      contractAddress as Address,
        abi:          SUBSCRIPTION_MANAGER_ABI,
        functionName: 'getPlan',
        args:         [planId],
    });

    const { data: subData, refetch: refetchSub } = useReadContract({
        address:      contractAddress as Address,
        abi:          SUBSCRIPTION_MANAGER_ABI,
        functionName: 'getSubscription',
        args:         address ? [planId, address] : undefined,
        query:        { enabled: !!address },
    });

    const plan         = planData as PlanStruct | undefined;
    const sub          = subData  as SubscriptionStruct | undefined;
    const planExists   = plan && plan.price > 0n;
    const isSubscribed = sub?.active === true;
    const hasTrial     = plan && plan.trialDuration > 0n;

    async function handleSubscribe() {
        if (!publicClient) return;
        setError('');
        setIsPending(true);
        try {
            const approveHash = await writeContractAsync({
                address:      usdcAddress as Address,
                abi:          USDC_ABI,
                functionName: 'approve',
                args:         [contractAddress as Address, maxUint256],
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });
            const subHash = await writeContractAsync({
                address:      contractAddress as Address,
                abi:          SUBSCRIPTION_MANAGER_ABI,
                functionName: 'subscribe',
                args:         [planId],
            });
            await publicClient.waitForTransactionReceipt({ hash: subHash });
            await refetchSub();
            setSuccessMsg(hasTrial
                ? `Subscribed! Your ${formatTrialDuration(plan!.trialDuration)} free trial starts now.`
                : 'Subscribed successfully!');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Transaction failed.');
        } finally {
            setIsPending(false);
        }
    }

    if (planLoading) {
        return <div style={cardStyle}><p style={{ color: '#6b6375', margin: 0 }}>Loading plan…</p></div>;
    }

    if (!planExists) {
        return (
            <div style={cardStyle}>
                <p style={{ color: '#dc2626', margin: 0 }}>Plan {planId.toString()} not found.</p>
            </div>
        );
    }

    return (
        <div style={cardStyle}>
            <div>
                <div style={{ fontSize: '13px', color: '#6b6375', marginBottom: '4px' }}>Plan {planId.toString()}</div>
                <div style={{ fontSize: '32px', fontWeight: 700 }}>{fromUsdcUnits(plan!.price)} USDC</div>
                <div style={{ color: '#6b6375', marginTop: '4px' }}>per {intervalToLabel(Number(plan!.interval))}</div>
            </div>

            {hasTrial && (
                <div style={{ padding: '10px 14px', background: '#eff6ff', borderRadius: '6px', color: '#1d4ed8', fontWeight: 600, fontSize: '14px' }}>
                    {formatTrialDuration(plan!.trialDuration)} free trial — no charge until trial ends
                </div>
            )}

            <div style={{ fontSize: '13px', color: '#6b6375' }}>
                Merchant: <code style={{ fontSize: '12px' }}>{plan!.merchant}</code>
            </div>

            {!plan!.active && (
                <div style={{ padding: '10px 14px', background: '#fef3c7', borderRadius: '6px', color: '#92400e', fontSize: '14px' }}>
                    This plan is no longer accepting new subscribers.
                </div>
            )}

            <div style={{ borderTop: '1px solid #f4f3f6', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {!isConnected && <ConnectButton />}

                {isConnected && !onCorrectChain && (
                    <button
                        onClick={() => switchChain({ chainId: arcTestnet.id })}
                        style={{ width: '100%', padding: '12px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: 600 }}
                    >
                        Switch to Arc Testnet
                    </button>
                )}

                {isConnected && onCorrectChain && isSubscribed && sub && (
                    <div style={{ padding: '12px 16px', background: '#f0fdf4', borderRadius: '8px', color: '#166534', fontSize: '14px' }}>
                        ✓ You are subscribed — next charge: {new Date(Number(sub.nextChargeTimestamp) * 1000).toLocaleDateString()}
                    </div>
                )}

                {isConnected && onCorrectChain && !isSubscribed && plan!.active && (
                    <button
                        onClick={handleSubscribe}
                        disabled={isPending}
                        style={{ width: '100%', padding: '14px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', cursor: isPending ? 'wait' : 'pointer', fontSize: '16px', fontWeight: 600 }}
                    >
                        {isPending
                            ? 'Processing…'
                            : hasTrial
                                ? `Start ${formatTrialDuration(plan!.trialDuration)} Free Trial`
                                : 'Approve & Subscribe'}
                    </button>
                )}

                {error      && <p style={{ color: '#dc2626', margin: 0, fontSize: '14px' }}>{error}</p>}
                {successMsg && <p style={{ color: '#16a34a', margin: 0, fontSize: '14px' }}>{successMsg}</p>}
            </div>

            <p style={{ textAlign: 'center', fontSize: '11px', color: '#6b6375', margin: '4px 0 0' }}>
                Powered by Cyclo — on-chain recurring billing
            </p>
        </div>
    );
}

const cardStyle: React.CSSProperties = {
    padding:        '24px',
    border:         '1px solid #e5e4e7',
    borderRadius:   '12px',
    background:     '#fff',
    display:        'flex',
    flexDirection:  'column',
    gap:            '16px',
    fontFamily:     'system-ui, -apple-system, sans-serif',
    boxSizing:      'border-box',
};
