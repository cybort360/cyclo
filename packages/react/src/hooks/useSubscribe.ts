import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCycloClient } from '../context.js'

export function useSubscribe() {
  const cyclo = useCycloClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (planId: bigint) => cyclo.subscribe(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cyclo', 'subscription'] })
    },
  })
}
