import { useQuery } from '@tanstack/react-query'
import { useCycloClient } from '../context.js'
import type { Subscription } from '@cyclo/sdk'

export function useSubscription(subscriber: `0x${string}` | undefined, planId: bigint | undefined) {
  const cyclo = useCycloClient()

  return useQuery<Subscription>({
    queryKey: ['cyclo', 'subscription', subscriber, planId?.toString()],
    queryFn: () => cyclo.getSubscription(subscriber!, planId!),
    enabled: !!subscriber && planId !== undefined,
  })
}
