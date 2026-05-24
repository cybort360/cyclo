/**
 * usePortalSubscriptions — fetches all active on-chain subscriptions for the
 * connected wallet by reading contract events and struct data via viem.
 *
 * Algorithm:
 *   1. Fetch SubscriptionCreated + SubscriptionCancelled events in parallel,
 *      both filtered by the connected subscriber address.
 *   2. Sort all events chronologically (blockNumber, then logIndex) and walk
 *      forward to determine the latest state for each planId.
 *      "SubscriptionCreated with no subsequent SubscriptionCancelled" = active.
 *   3. For all event-derived active planIds, call multicall to read
 *      getSubscription(planId, address) and getPlan(planId) in one round-trip.
 *   4. Cross-check: discard any entry where the on-chain struct returns
 *      active === false (handles edge cases where events are partially indexed).
 *
 * isInTrial heuristic:
 *   plan.trialDuration > 0  AND  nextChargeTimestamp > now
 *   This is accurate for the common case: the first charge hasn't fired yet.
 *   A subscriber who resubscribes to a plan with a trial, gets charged, and is
 *   now waiting for the second charge could be misidentified, but this is an
 *   acceptable approximation for the portal display.
 */
import { useAccount, usePublicClient } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { SUBSCRIPTION_MANAGER_ABI } from '../constants/abis'
import { CONTRACT_ADDRESS, DEPLOY_BLOCK } from '../constants/addresses'

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

// ── Internal types ─────────────────────────────────────────────────────────────

type EventEntry = {
    planId:      bigint
    type:        'created' | 'cancelled'
    blockNumber: bigint
    logIndex:    number
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

// ── Helper ─────────────────────────────────────────────────────────────────────

/**
 * Derives the set of currently active planIds from the merged, sorted event
 * stream. The final state per planId is whichever event type appeared last.
 */
function deriveActivePlanIds(events: EventEntry[]): bigint[] {
    // Walk in chronological order so later events overwrite earlier ones.
    const latest = new Map<string, 'created' | 'cancelled'>()
    for (const ev of events) {
        latest.set(ev.planId.toString(), ev.type)
    }
    return [...latest.entries()]
        .filter(([, state]) => state === 'created')
        .map(([key]) => BigInt(key))
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
        queryKey:       ['portal', 'subscriptions', address],
        enabled:        !!address && !!publicClient,
        refetchInterval: 30_000,
        queryFn: async () => {
            // ── 1. Fetch Created + Cancelled events in parallel ──────────────
            const [createdLogs, cancelledLogs] = await Promise.all([
                publicClient!.getContractEvents({
                    address:   CONTRACT_ADDRESS as Address,
                    abi:       SUBSCRIPTION_MANAGER_ABI,
                    eventName: 'SubscriptionCreated',
                    args:      { subscriber: address as Address },
                    fromBlock: DEPLOY_BLOCK,
                    toBlock:   'latest',
                }),
                publicClient!.getContractEvents({
                    address:   CONTRACT_ADDRESS as Address,
                    abi:       SUBSCRIPTION_MANAGER_ABI,
                    eventName: 'SubscriptionCancelled',
                    args:      { subscriber: address as Address },
                    fromBlock: DEPLOY_BLOCK,
                    toBlock:   'latest',
                }),
            ])

            // ── 2. Sort events chronologically and derive active planIds ──────
            const allEvents: EventEntry[] = [
                ...createdLogs.map(l => ({
                    planId:      (l.args as { planId: bigint }).planId,
                    type:        'created' as const,
                    // blockNumber is null only for pending txs; we query to 'latest'
                    blockNumber: l.blockNumber ?? 0n,
                    logIndex:    l.logIndex    ?? 0,
                })),
                ...cancelledLogs.map(l => ({
                    planId:      (l.args as { planId: bigint }).planId,
                    type:        'cancelled' as const,
                    blockNumber: l.blockNumber ?? 0n,
                    logIndex:    l.logIndex    ?? 0,
                })),
            ].sort((a, b) =>
                a.blockNumber !== b.blockNumber
                    ? Number(a.blockNumber - b.blockNumber)
                    : a.logIndex - b.logIndex
            )

            const activePlanIds = deriveActivePlanIds(allEvents)
            if (activePlanIds.length === 0) return []

            // ── 3. Batch-read subscription struct + plan in one multicall ─────
            // Interleave: [sub_0, plan_0, sub_1, plan_1, ...]
            const reads = await publicClient!.multicall({
                contracts: activePlanIds.flatMap(planId => [
                    {
                        address:      CONTRACT_ADDRESS as Address,
                        abi:          SUBSCRIPTION_MANAGER_ABI,
                        functionName: 'getSubscription' as const,
                        args:         [planId, address as Address] as const,
                    },
                    {
                        address:      CONTRACT_ADDRESS as Address,
                        abi:          SUBSCRIPTION_MANAGER_ABI,
                        functionName: 'getPlan' as const,
                        args:         [planId] as const,
                    },
                ]),
            })

            // ── 4. Build typed result array ───────────────────────────────────
            const now = BigInt(Math.floor(Date.now() / 1000))
            const result: PortalSubscription[] = []

            for (let i = 0; i < activePlanIds.length; i++) {
                const subRead  = reads[i * 2]
                const planRead = reads[i * 2 + 1]

                // Skip if either call reverted (e.g. plan was erased — should not happen
                // given the contract never deletes plan storage, but guard defensively).
                if (subRead.status !== 'success' || planRead.status !== 'success') continue

                const sub  = subRead.result  as RawSub
                const plan = planRead.result as RawPlan

                // Cross-check: event derivation is the primary source of truth, but
                // if the struct says inactive (e.g. a cancel that post-dates our last
                // indexed event), trust the struct.
                if (!sub.active) continue

                const nextCharge    = BigInt(sub.nextChargeTimestamp)
                const trialDuration = BigInt(plan.trialDuration)
                // In trial when: plan has a trial AND the next charge is still in the
                // future (meaning the first charge — which ends the trial — hasn't fired).
                const isInTrial = trialDuration > 0n && nextCharge > now

                result.push({
                    planId: activePlanIds[i],
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
                })
            }

            return result
        },
    })

    return {
        subscriptions: query.data ?? [],
        isLoading:     query.isLoading,
        error:         query.error instanceof Error ? query.error.message : null,
    }
}
