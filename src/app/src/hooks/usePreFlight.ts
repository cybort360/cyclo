/**
 * Pre-flight check before a subscribe() transaction.
 *
 * Calls checkPreFlight(planId, subscriber) and balanceOf(subscriber) as a
 * batched eth_call — no wallet signature required. Enabled only when a
 * subscriber address is provided; pass undefined to disable.
 *
 * Reason codes returned by checkPreFlight:
 *   0 — ready to subscribe
 *   1 — already subscribed and charge not yet due
 *   2 — subscriber USDC balance is too low
 *   3 — USDC allowance is insufficient (user must approve before subscribing)
 *   4 — plan is inactive and not accepting new subscribers
 */
import { useReadContracts } from 'wagmi'
import { SUBSCRIPTION_MANAGER_ABI, USDC_ABI } from '../constants/abis'
import { CONTRACT_ADDRESS, USDC_ADDRESS } from '../constants/addresses'

export type PreFlightReason = 0 | 1 | 2 | 3 | 4

export interface PreFlightResult {
    /** null while the call is in flight or the hook is disabled */
    reason:      PreFlightReason | null
    /** subscriber's USDC balance in raw 6-decimal units; 0n while loading or disabled */
    usdcBalance: bigint
    isLoading:   boolean
}

/** Zero address used as a placeholder arg when the hook is disabled. */
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as `0x${string}`

/**
 * Runs checkPreFlight and balanceOf as a single batched eth_call.
 * @param planId     - The plan to validate against
 * @param subscriber - Connected wallet address; pass undefined to disable
 */
export function usePreFlight(
    planId:     bigint,
    subscriber: string | undefined,
): PreFlightResult {
    const enabled   = !!subscriber
    const subAddr   = (subscriber ?? ZERO_ADDRESS) as `0x${string}`

    const { data, isLoading } = useReadContracts({
        contracts: [
            {
                address:      CONTRACT_ADDRESS as `0x${string}`,
                abi:          SUBSCRIPTION_MANAGER_ABI,
                functionName: 'checkPreFlight',
                args:         [planId, subAddr],
            },
            {
                address:      USDC_ADDRESS as `0x${string}`,
                abi:          USDC_ABI,
                functionName: 'balanceOf',
                args:         [subAddr],
            },
        ],
        query: { enabled },
    })

    const reasonRaw = data?.[0]?.result
    const reason: PreFlightReason | null =
        reasonRaw !== undefined && reasonRaw !== null
            ? (Number(reasonRaw) as PreFlightReason)
            : null

    // balanceOf returns uint256; cast is safe — viem types useReadContracts results as unknown.
    const usdcBalance = (data?.[1]?.result as bigint | undefined) ?? 0n

    return {
        reason,
        usdcBalance,
        // Only show isLoading while the hook is enabled and the call hasn't settled.
        isLoading: enabled && isLoading,
    }
}
