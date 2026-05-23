import { useState, useEffect } from 'react'
import { useSubscriptionManager } from '../hooks/useSubscriptionManager'
import { CreatePlanForm, type CreatePlanInitialValues } from '../components/CreatePlanForm'
import { PlanTable } from '../components/PlanTable'

export function PlansPage() {
  const {
    plans, planStatuses, planTrials, isLoadingPlans,
    planEventsError, isPending, pendingPlanId,
    createPlan, deactivatePlan,
  } = useSubscriptionManager()

  const [showCreate, setShowCreate] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [nlInput, setNlInput] = useState('')
  const [parsing, setParsing] = useState(false)
  const [formValues, setFormValues] = useState<CreatePlanInitialValues | undefined>(undefined)

  const parseNaturalLanguage = async () => {
    if (!nlInput.trim()) return
    setParsing(true)
    try {
      const res = await fetch('/api/ai/parse-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: nlInput }),
      })
      const data = await res.json() as { price: number; intervalDays: number; trialDays: number }
      setFormValues({
        price:        String(data.price),
        intervalDays: String(data.intervalDays),
        trialDays:    String(data.trialDays),
      })
      setNlInput('')
      setShowCreate(true)
    } finally {
      setParsing(false)
    }
  }

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(''), 4000)
    return () => clearTimeout(t)
  }, [successMsg])

  async function handleCreate(price: bigint, interval: bigint, trialDuration: bigint) {
    await createPlan(price, interval, trialDuration)
    setSuccessMsg('Plan created successfully.')
    setShowCreate(false)
  }

  async function handleDeactivate(planId: bigint) {
    await deactivatePlan(planId)
    setSuccessMsg(`Plan ${planId} deactivated.`)
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Plans</h1>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          {showCreate ? 'Cancel' : '+ Create plan'}
        </button>
      </div>

      {successMsg && (
        <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          {successMsg}
        </div>
      )}

      {showCreate && (
        <div className="bg-white border rounded-xl p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">New plan</h2>
          <p className="text-sm text-gray-500 mb-4">
            Any address can act as a merchant. Subscribers will be charged the given USDC amount at every interval.
          </p>

          {/* Natural language input */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
            <p className="text-xs font-medium text-indigo-700 mb-2">✦ Create with AI</p>
            <div className="flex gap-2">
              <input
                value={nlInput}
                onChange={e => setNlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && parseNaturalLanguage()}
                placeholder='e.g. "monthly plan $9.99 with 7-day trial"'
                className="flex-1 border border-indigo-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={parseNaturalLanguage}
                disabled={parsing || !nlInput.trim()}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
              >
                {parsing ? '...' : 'Fill form'}
              </button>
            </div>
          </div>

          <CreatePlanForm isPending={isPending} onCreate={handleCreate} initialValues={formValues} />
        </div>
      )}

      <PlanTable
        plans={plans}
        isLoading={isLoadingPlans}
        isPending={isPending}
        pendingPlanId={pendingPlanId}
        planStatuses={planStatuses}
        planTrials={planTrials}
        error={planEventsError}
        onDeactivate={handleDeactivate}
        onCreatePlan={() => setShowCreate(true)}
      />
    </div>
  )
}
