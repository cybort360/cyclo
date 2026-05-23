import { useQuery } from '@tanstack/react-query'
import { useCycloClient } from '../context.js'
import type { Plan } from '@cyclo/sdk'

export function usePlan(planId: bigint | undefined) {
  const cyclo = useCycloClient()

  return useQuery<Plan>({
    queryKey: ['cyclo', 'plan', planId?.toString()],
    queryFn: () => cyclo.getPlan(planId!),
    enabled: planId !== undefined,
  })
}
