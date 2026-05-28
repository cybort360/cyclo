/**
 * usePortalSubscriptions — fetches all active on-chain subscriptions for the
 * connected wallet using only direct contract view calls (no eth_getLogs).
 *
 * Algorithm:
 *   1. Call planCount() to get the total number of plans ever created.
 *   2. For each planId in [1, planCount], call getSubscription(planId, address)
 *      in batches of 20 concurrent calls to avoid overwhelming the RPC.
 *   3. Filter results where sub.active === true.
 *   4. For active subscriptions, call getPlan(planId) to fetch plan metadata.
 *
 * This approach makes zero eth_getLogs calls and is not subject to the Arc
 * testnet 100,000-block range restriction.
 */
import { useAccount, usePublicClient } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { SUBSCRIPTION_MANAGER_ABI } from '../constants/abis'
import { CONTRACT_ADDRESS } from '../constants/addresses'

type Address = `0x${string}`

// ── Public types ───────────────────────────────────────────────────────────────

export interface PortalPlan {
    /** Raw USDC price per billing cycle (6-decimal units, e.g. 9_990_000n = $9.99) */
    price:         bigint
    /** Seconds between charges */
    interval:      bigint
    /** Merchant wallet address */
    merchant:      Address
    /** Seconds of free trial; 0n if no trial */
    trialDuration: bigint
    /** False if the merchant has deactivated the plan (no new subscribers allowed) */
    active:        boolean
}

export interface PortalSubscription {
    planId:              bigint
    /** Plan metadata fetched from getPlan(planId) */
    plan:                PortalPlan
    /**
     * Unix timestamp (seconds) of the next scheduled charge.
     * If the subscription is in its trial period this is also the trial end date.
     */
    nextChargeTimestamp: bigint
    /**
     * True when plan.trialDuration > 0 and the first charge has not yet fired.
     * In this state nextChargeTimestamp marks the end of the free trial.
     */
    isInTrial:           boolean
    /** nextChargeTimestamp when isInTrial, null otherwise. */
    trialEndDate:        bigint | null
}

// Viem decodes uint48 as number at runtime; uint256 as bigint.
type RawSub  = { nextChargeTimestamp: number; active: boolean }
type RawPlan = {
    merchant:      Address
    active:        boolean
    trialDuration: number   // uint48
    price:         bigint   // uint256
    interval:      bigint   // uint256
}

const BATCH_SIZE = 20

/** Run an array of async thunks with at most `limit` concurrent at a time. */
async function batchedAll<T>(thunks: (() => Promise<T>)[], limit: number): Promise<T[]> {
    const results: T[] = []
    for (let i = 0; i < thunks.length; i += limit) {
        const chunk = await Promise.all(thunks.slice(i, i + limit).map(fn => fn()))
        results.push(...chunk)
    }
    return results
}

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Returns the connected wallet's active on-chain subscriptions with full plan
 * and subscription-struct details. Refreshes every 30 seconds.
 */
export function usePortalSubscriptions() {
    const { address }  = useAccount()
    const publicClient = usePublicClient()

    const query = useQuery<PortalSubscription[]>({
        queryKey:        ['portal', 'subscriptions', address],
        enabled:         !!address && !!publicClient,
        refetchInterval: 30_000,
        queryFn: async () => {
            // ── 1. Get total plan count ──────────────────────────────────────
            const count = await publicClient!.readContract({
                address:      CONTRACT_ADDRESS as Address,
                abi:          SUBSCRIPTION_MANAGER_ABI,
                functionName: 'planCount',
                args:         [],
            }) as bigint

            if (count === 0n) return []

            // ── 2. Fetch subscription struct for every planId in batches ─────
            const planIds = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1))

            const subs = await batchedAll(
                planIds.map(planId => () =>
                    publicClient!.readContract({
                        address:      CONTRACT_ADDRESS as Address,
                        abi:          SUBSCRIPTION_MANAGER_ABI,
                        functionName: 'getSubscription',
                        args:         [planId, address as Address],
                    }) as Promise<RawSub>
                ),
                BATCH_SIZE,
            )

            // ── 3. Filter to active subscriptions ────────────────────────────
            const activePairs = planIds
                .map((planId, i) => ({ planId, sub: subs[i] }))
                .filter(({ sub }) => sub.active)

            if (activePairs.length === 0) return []

            // ── 4. Fetch plan metadata for active subscriptions ──────────────
            const plans = await batchedAll(
                activePairs.map(({ planId }) => () =>
                    publicClient!.readContract({
                        address:      CONTRACT_ADDRESS as Address,
                        abi:          SUBSCRIPTION_MANAGER_ABI,
                        functionName: 'getPlan',
                        args:         [planId],
                    }) as Promise<RawPlan>
                ),
                BATCH_SIZE,
            )

            // ── 5. Build typed result array ───────────────────────────────────
            const now = BigInt(Math.floor(Date.now() / 1000))
            return activePairs.map(({ planId, sub }, i) => {
                const plan         = plans[i]
                const nextCharge   = BigInt(sub.nextChargeTimestamp)
                const trialDuration = BigInt(plan.trialDuration)
                const isInTrial    = trialDuration > 0n && nextCharge > now

                return {
                    planId,
                    plan: {
                        price:         plan.price,
                        interval:      plan.interval,
                        merchant:      plan.merchant,
                        trialDuration,
                        active:        plan.active,
                    },
                    nextChargeTimestamp: nextCharge,
                    isInTrial,
                    trialEndDate: isInTrial ? nextCharge : null,
                } satisfies PortalSubscription
            })
        },
    })

    return {
        subscriptions: query.data ?? [],
        isLoading:     query.isLoading,
        error:         query.error instanceof Error ? query.error.message : null,
    }
}
