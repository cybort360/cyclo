import * as react_jsx_runtime from 'react/jsx-runtime';
import { ReactNode } from 'react';
import { CycloClient, Plan, Subscription, CreatePlanParams } from '@cyclo/sdk';
export { CreatePlanParams, Plan, Subscription } from '@cyclo/sdk';
import * as _tanstack_react_query from '@tanstack/react-query';

interface CycloProviderProps {
    contractAddress: `0x${string}`;
    usdcAddress: `0x${string}`;
    children: ReactNode;
}
declare function CycloProvider({ contractAddress, usdcAddress, children }: CycloProviderProps): react_jsx_runtime.JSX.Element | null;
declare function useCycloClient(): CycloClient;

declare function usePlan(planId: bigint | undefined): _tanstack_react_query.UseQueryResult<Plan, Error>;

declare function useSubscription(subscriber: `0x${string}` | undefined, planId: bigint | undefined): _tanstack_react_query.UseQueryResult<Subscription, Error>;

declare function useCreatePlan(): _tanstack_react_query.UseMutationResult<bigint, Error, CreatePlanParams, unknown>;

declare function useSubscribe(): _tanstack_react_query.UseMutationResult<void, Error, bigint, unknown>;

declare function useCancelSubscription(): _tanstack_react_query.UseMutationResult<void, Error, bigint, unknown>;

declare function useMigratePlan(): _tanstack_react_query.UseMutationResult<void, Error, {
    currentPlanId: bigint;
    newPlanId: bigint;
}, unknown>;

interface UseIsSubscribedResult {
    isSubscribed: boolean;
    tokenId: bigint | null;
    isLoading: boolean;
    error: Error | null;
}
/**
 * Returns the soulbound NFT subscription status for a subscriber on a plan.
 *
 * Calls `client.isSubscribed` and `client.getSubscriberTokenId` in parallel.
 * Re-fetches automatically when a `SubscriptionCreated` or `SubscriptionCancelled`
 * event is emitted for the exact subscriber+planId pair.
 *
 * Returns the disabled result immediately (no loading, no fetch) when either
 * `subscriber` or `planId` is undefined.
 */
declare function useIsSubscribed(subscriber: `0x${string}` | undefined, planId: bigint | undefined): UseIsSubscribedResult;

export { CycloProvider, type UseIsSubscribedResult, useCancelSubscription, useCreatePlan, useCycloClient, useIsSubscribed, useMigratePlan, usePlan, useSubscribe, useSubscription };
