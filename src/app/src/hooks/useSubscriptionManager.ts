/**
 * Compatibility layer — provides the old unified hook API while also re-exporting
 * individual SDK hooks for new code. Write operations are routed through CycloClient;
 * event-log reads use viem directly (the SDK does not yet expose historical event fetching).
 */
import { useState } from 'react';
import { useAccount, usePublicClient, useReadContract, useReadContracts, useConfig } from 'wagmi';
import { getWalletClient } from '@wagmi/core';
import { useQuery } from '@tanstack/react-query';
import { useCycloClient } from '@cyclo/react';
import { SUBSCRIPTION_MANAGER_ABI, USDC_ABI } from '../constants/abis';
import { CONTRACT_ADDRESS, DEPLOY_BLOCK, USDC_ADDRESS } from '../constants/addresses';

type Address = `0x${string}`;

export interface PlanEvent {
    planId:   bigint;
    merchant: Address;
    price:    bigint;
    interval: bigint;
    txHash:   Address;
}

export interface PaymentEvent {
    planId:              bigint;
    subscriber:          Address;
    merchant:            Address;
    amount:              bigint;
    nextChargeTimestamp: bigint;
    txHash:              Address;
}

export interface PlanStruct {
    merchant:      Address;
    active:        boolean;
    trialDuration: bigint;
    price:         bigint;
    interval:      bigint;
}

export interface SubscriptionStruct {
    nextChargeTimestamp: bigint;
    active:              boolean;
}

function useUsdcBalance(address: Address | undefined) {
    return useReadContract({
        address:      USDC_ADDRESS as Address,
        abi:          USDC_ABI,
        functionName: 'balanceOf',
        args:         address ? [address] : undefined,
        query:        { enabled: !!address },
    });
}

function usePlanEvents(merchant: Address | undefined) {
    const client = usePublicClient();
    return useQuery({
        queryKey: ['planEvents', merchant],
        queryFn:  async (): Promise<PlanEvent[]> => {
            if (!client || !merchant) return [];
            const logs = await client.getContractEvents({
                address:   CONTRACT_ADDRESS as Address,
                abi:       SUBSCRIPTION_MANAGER_ABI,
                eventName: 'PlanCreated',
                args:      { merchant },
                fromBlock: DEPLOY_BLOCK,
                toBlock:   'latest',
            });
            return logs.map(log => ({
                planId:   log.args.planId   as bigint,
                merchant: log.args.merchant as Address,
                price:    log.args.price    as bigint,
                interval: log.args.interval as bigint,
                txHash:   log.transactionHash as Address,
            }));
        },
        enabled:         !!client && !!merchant,
        refetchInterval: 30_000,
    });
}

function useSettlementEvents(merchant: Address | undefined) {
    const client = usePublicClient();
    return useQuery({
        queryKey: ['settlementEvents', merchant],
        queryFn:  async (): Promise<PaymentEvent[]> => {
            if (!client || !merchant) return [];
            const logs = await client.getContractEvents({
                address:   CONTRACT_ADDRESS as Address,
                abi:       SUBSCRIPTION_MANAGER_ABI,
                eventName: 'PaymentCharged',
                args:      { merchant },
                fromBlock: DEPLOY_BLOCK,
                toBlock:   'latest',
            });
            return logs.map(log => ({
                planId:              log.args.planId              as bigint,
                subscriber:          log.args.subscriber          as Address,
                merchant:            log.args.merchant            as Address,
                amount:              log.args.amount              as bigint,
                nextChargeTimestamp: log.args.nextChargeTimestamp as bigint,
                txHash:              log.transactionHash          as Address,
            }));
        },
        enabled:         !!client && !!merchant,
        refetchInterval: 30_000,
    });
}

function usePlanStatuses(planIds: bigint[]) {
    return useReadContracts({
        contracts: planIds.map(planId => ({
            address:      CONTRACT_ADDRESS as Address,
            abi:          SUBSCRIPTION_MANAGER_ABI,
            functionName: 'getPlan' as const,
            args:         [planId] as const,
        })),
        query: { enabled: planIds.length > 0 },
    });
}

export function useSubscriptionManager() {
    const { address }  = useAccount();
    const cyclo        = useCycloClient();
    const wagmiConfig  = useConfig();
    const [isPending,    setIsPending]    = useState(false);
    const [pendingPlanId, setPendingPlanId] = useState<bigint | null>(null);

    /**
     * Fetches the current WalletClient imperatively at write time.
     * This is more reliable than relying on useWalletClient() hook state,
     * which may not have resolved yet when the user triggers a write.
     */
    async function ensureWallet(): Promise<void> {
        const wc = await getWalletClient(wagmiConfig);
        cyclo.setWalletClient(wc);
    }

    const usdcBalance       = useUsdcBalance(address);
    const planEvents        = usePlanEvents(address);
    const settlements       = useSettlementEvents(address);
    const planIds           = (planEvents.data ?? []).map(p => p.planId);
    const planStatusResults = usePlanStatuses(planIds);

    const planStatuses = new Map<string, boolean>();
    const planTrials   = new Map<string, bigint>();
    planIds.forEach((planId, i) => {
        const result = planStatusResults.data?.[i];
        if (result?.status === 'success' && result.result) {
            const struct = result.result as unknown as PlanStruct;
            planStatuses.set(planId.toString(), struct.active);
            planTrials.set(planId.toString(), struct.trialDuration);
        }
    });

    async function createPlan(price: bigint, interval: bigint, trialDuration: bigint): Promise<void> {
        await ensureWallet();
        setIsPending(true);
        try {
            await cyclo.createPlan({
                price:       Number(price) / 1_000_000,
                intervalDays: Number(interval) / 86400,
                trialDays:    Number(trialDuration) / 86400,
            });
            await planEvents.refetch();
        } finally {
            setIsPending(false);
        }
    }

    async function deactivatePlan(planId: bigint): Promise<void> {
        await ensureWallet();
        setPendingPlanId(planId);
        try {
            await cyclo.deactivatePlan(planId);
            await Promise.all([planEvents.refetch(), planStatusResults.refetch()]);
        } finally {
            setPendingPlanId(null);
        }
    }

    async function subscribeToPlan(planId: bigint, onBroadcast?: () => void): Promise<void> {
        await ensureWallet();
        setIsPending(true);
        try {
            await cyclo.subscribe(planId, onBroadcast);
        } finally {
            setIsPending(false);
        }
    }

    async function cancelSubscription(planId: bigint): Promise<void> {
        await ensureWallet();
        setIsPending(true);
        try {
            await cyclo.cancelSubscription(planId);
        } finally {
            setIsPending(false);
        }
    }

    async function migratePlan(currentPlanId: bigint, newPlanId: bigint): Promise<void> {
        await ensureWallet();
        setIsPending(true);
        try {
            await cyclo.migratePlan(currentPlanId, newPlanId);
        } finally {
            setIsPending(false);
        }
    }

    return {
        address,
        usdcBalance:          usdcBalance.data,
        plans:                planEvents.data  ?? [],
        settlements:          settlements.data ?? [],
        planStatuses,
        planTrials,
        isLoadingPlans:       planEvents.isLoading,
        isLoadingSettlements: settlements.isLoading,
        planEventsError:      planEvents.error?.message,
        settlementsError:     settlements.error?.message,
        isPending,
        pendingPlanId,
        createPlan,
        deactivatePlan,
        subscribeToPlan,
        cancelSubscription,
        migratePlan,
    };
}

// SDK hook re-exports for new code
export {
    usePlan,
    useSubscription,
    useCreatePlan,
    useSubscribe,
    useCancelSubscription,
    useMigratePlan,
    useCycloClient,
} from '@cyclo/react';
