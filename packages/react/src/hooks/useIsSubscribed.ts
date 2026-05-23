import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCycloClient } from '../context.js'

/** Shape of on-chain NFT state fetched in parallel. */
interface NftState {
  isSubscribed: boolean
  tokenId: bigint | null
}

/** Args shape shared by SubscriptionCreated and SubscriptionCancelled events. */
type SubscriptionEventArgs = {
  planId?: bigint
  subscriber?: `0x${string}`
}

export interface UseIsSubscribedResult {
  isSubscribed: boolean
  tokenId: bigint | null
  isLoading: boolean
  error: Error | null
}

/** Stable default returned when either argument is undefined. */
const DISABLED_RESULT: UseIsSubscribedResult = {
  isSubscribed: false,
  tokenId: null,
  isLoading: false,
  error: null,
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
export function useIsSubscribed(
  subscriber: `0x${string}` | undefined,
  planId: bigint | undefined,
): UseIsSubscribedResult {
  const cyclo        = useCycloClient()
  const queryClient  = useQueryClient()
  const enabled      = !!subscriber && planId !== undefined

  const { data, isLoading, error } = useQuery<NftState>({
    queryKey: ['cyclo', 'isSubscribed', subscriber, planId?.toString()],
    queryFn: async () => {
      const [isSubscribed, tokenId] = await Promise.all([
        cyclo.isSubscribed(subscriber!, planId!),
        cyclo.getSubscriberTokenId(subscriber!, planId!),
      ])
      return { isSubscribed, tokenId }
    },
    enabled,
  })

  // Wire event listeners that refresh the query when on-chain state changes for
  // this specific subscriber+planId pair. Captured as local constants so the
  // closure types are narrowed (no non-null assertions in the callback body).
  useEffect(() => {
    if (!subscriber || planId === undefined) return

    const sub  = subscriber
    const plan = planId

    const handleEvent = (args: SubscriptionEventArgs) => {
      if (
        args.subscriber?.toLowerCase() === sub.toLowerCase() &&
        args.planId === plan
      ) {
        queryClient.invalidateQueries({
          queryKey: ['cyclo', 'isSubscribed', sub, plan.toString()],
        })
      }
    }

    const unsubCreated   = cyclo.on<SubscriptionEventArgs>('SubscriptionCreated',   handleEvent)
    const unsubCancelled = cyclo.on<SubscriptionEventArgs>('SubscriptionCancelled', handleEvent)

    return () => {
      unsubCreated()
      unsubCancelled()
    }
  }, [subscriber, planId, cyclo, queryClient])

  if (!enabled) return DISABLED_RESULT

  return {
    isSubscribed: data?.isSubscribed ?? false,
    tokenId:      data?.tokenId      ?? null,
    isLoading,
    error: error as Error | null,
  }
}
