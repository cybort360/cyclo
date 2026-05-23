import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCycloClient } from '../context.js'

export function useMigratePlan() {
  const cyclo = useCycloClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ currentPlanId, newPlanId }: { currentPlanId: bigint; newPlanId: bigint }) =>
      cyclo.migratePlan(currentPlanId, newPlanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cyclo'] })
    },
  })
}
