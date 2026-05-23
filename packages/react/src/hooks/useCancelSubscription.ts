import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCycloClient } from '../context.js'

export function useCancelSubscription() {
  const cyclo = useCycloClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (planId: bigint) => cyclo.cancelSubscription(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cyclo', 'subscription'] })
    },
  })
}
