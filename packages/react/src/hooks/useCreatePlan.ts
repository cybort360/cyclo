import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCycloClient } from '../context.js'
import type { CreatePlanParams } from '@cyclo/sdk'

export function useCreatePlan() {
  const cyclo = useCycloClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: CreatePlanParams) => cyclo.createPlan(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cyclo', 'plans'] })
    },
  })
}
